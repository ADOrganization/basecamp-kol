import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { handle, keyword } = body;

    // Get Apify key from org
    const org = await db.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { apifyApiKey: true },
    });

    if (!org?.apifyApiKey) {
      return NextResponse.json({ error: "No Apify API key configured" }, { status: 400 });
    }

    const cleanHandle = handle.replace('@', '').toLowerCase();
    const actorId = 'CJdippxWmn9uRfooo';

    // Build search term exactly like their docs
    const searchTerm = keyword
      ? `from:${cleanHandle} ${keyword}`
      : `from:${cleanHandle}`;

    const input = {
      searchTerms: [searchTerm],
      maxItems: 10,
    };

    console.log(`[Test Apify] Starting run with input:`, JSON.stringify(input));

    // Start the actor run
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${org.apifyApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(30000),
      }
    );

    const runResponseText = await runResponse.text();
    console.log(`[Test Apify] Run response status:`, runResponse.status);
    console.log(`[Test Apify] Run response:`, runResponseText.slice(0, 500));

    if (!runResponse.ok) {
      return NextResponse.json({
        error: `Apify run failed: ${runResponse.status}`,
        response: runResponseText
      }, { status: 500 });
    }

    const runData = JSON.parse(runResponseText);
    const runId = runData.data?.id;

    if (!runId) {
      return NextResponse.json({
        error: 'No run ID returned',
        response: runData
      }, { status: 500 });
    }

    console.log(`[Test Apify] Run started: ${runId}`);

    // Poll for completion (max 60 seconds)
    const maxWait = 60000;
    const pollInterval = 2000;
    let elapsed = 0;

    while (elapsed < maxWait) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      elapsed += pollInterval;

      const statusResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${org.apifyApiKey}`,
        { signal: AbortSignal.timeout(10000) }
      );

      if (!statusResponse.ok) continue;

      const statusData = await statusResponse.json();
      const status = statusData.data?.status;

      console.log(`[Test Apify] Status: ${status} (${elapsed / 1000}s)`);

      if (status === 'SUCCEEDED') {
        const datasetId = statusData.data?.defaultDatasetId;

        const resultsResponse = await fetch(
          `https://api.apify.com/v2/datasets/${datasetId}/items?token=${org.apifyApiKey}&limit=10`,
          { signal: AbortSignal.timeout(15000) }
        );

        const results = await resultsResponse.json();

        return NextResponse.json({
          success: true,
          searchTerm,
          runId,
          datasetId,
          resultCount: Array.isArray(results) ? results.length : 0,
          results: results,
        });
      } else if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
        return NextResponse.json({
          error: `Run ${status}`,
          runId,
          statusData: statusData.data,
        }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Timeout waiting for results' }, { status: 500 });
  } catch (error) {
    console.error("[Test Apify] Error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
