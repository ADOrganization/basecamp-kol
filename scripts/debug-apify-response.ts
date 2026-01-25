/**
 * Debug script to see actual Apify response structure
 * Run with: APIFY_API_KEY=your_key npx tsx scripts/debug-apify-response.ts
 */

async function debugApifyResponse() {
  const apiKey = process.env.APIFY_API_KEY;

  if (!apiKey) {
    console.error('Set APIFY_API_KEY environment variable');
    process.exit(1);
  }

  console.log('Starting Apify run for @InfraredFinance...\n');

  const actorId = 'CJdippxWmn9uRfooo';
  const input = {
    searchTerms: ['from:InfraredFinance'],
    maxItems: 1,
  };

  try {
    // Start the run
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }
    );

    const runData = await runResponse.json();
    const runId = runData.data?.id;
    console.log('Run ID:', runId);

    if (!runId) {
      console.error('Failed to start run:', runData);
      return;
    }

    // Poll for completion
    let status = 'RUNNING';
    while (status === 'RUNNING' || status === 'READY') {
      await new Promise(r => setTimeout(r, 3000));

      const statusResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${apiKey}`
      );
      const statusData = await statusResponse.json();
      status = statusData.data?.status;
      console.log('Status:', status);

      if (status === 'SUCCEEDED') {
        const datasetId = statusData.data?.defaultDatasetId;

        const resultsResponse = await fetch(
          `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiKey}&limit=1`
        );
        const results = await resultsResponse.json();

        console.log('\n=== FULL RESPONSE STRUCTURE ===\n');
        console.log(JSON.stringify(results, null, 2));

        if (results.length > 0) {
          console.log('\n=== TOP-LEVEL KEYS ===\n');
          console.log(Object.keys(results[0]));

          if (results[0].author) {
            console.log('\n=== AUTHOR KEYS ===\n');
            console.log(Object.keys(results[0].author));
            console.log('\n=== AUTHOR DATA ===\n');
            console.log(JSON.stringify(results[0].author, null, 2));
          }
        }
        break;
      } else if (status === 'FAILED' || status === 'ABORTED') {
        console.error('Run failed:', status);
        break;
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

debugApifyResponse();
