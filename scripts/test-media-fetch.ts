/**
 * Test script to verify Twitter media (avatar/banner) fetching
 * Run with: npx tsx scripts/test-media-fetch.ts
 */

import { fetchTwitterMedia, fetchTwitterAvatar, fetchTwitterBanner, setApifyApiKey } from '../src/lib/scraper/x-scraper';

const TEST_HANDLES = ['elonmusk', 'InfraredFinance', 'Twitter'];

async function testWithoutApify() {
  console.log('=== Testing WITHOUT Apify API key ===\n');

  for (const handle of TEST_HANDLES) {
    console.log(`Testing @${handle}...`);

    const avatar = await fetchTwitterAvatar(handle);
    console.log(`  Avatar: ${avatar || 'NOT FOUND'}`);

    const banner = await fetchTwitterBanner(handle);
    console.log(`  Banner: ${banner || 'NOT FOUND'}`);

    console.log('');
  }
}

async function testWithApify(apiKey: string) {
  console.log('=== Testing WITH Apify API key ===\n');
  setApifyApiKey(apiKey);

  for (const handle of TEST_HANDLES) {
    console.log(`Testing @${handle}...`);

    const media = await fetchTwitterMedia(handle);
    console.log(`  Avatar: ${media.avatarUrl || 'NOT FOUND'}`);
    console.log(`  Banner: ${media.bannerUrl || 'NOT FOUND'}`);

    console.log('');
  }
}

async function main() {
  // First test without Apify
  await testWithoutApify();

  // If APIFY_API_KEY is set in environment, test with it
  const apifyKey = process.env.APIFY_API_KEY;
  if (apifyKey) {
    await testWithApify(apifyKey);
  } else {
    console.log('Set APIFY_API_KEY environment variable to test with Apify');
  }
}

main().catch(console.error);
