require('dotenv').config();
const launcher = require('../src/facebook/launcher');
const { listFolderMedia, downloadFileBuffer } = require('../src/google/drive');

const ACCOUNT_ID = 'act_1662862634650133';
const IMAGE_FOLDER = '1bRDhB21ZLgAbZz5ziSEzdjxuVXoZ6R7w';
const VIDEO_FOLDER = '1UQBBHuA0HsMQrSTU3wKnQe0LSjpj-L1c';

// Cached from first run to avoid rate limits
const SKIP_DISCOVERY = process.env.SKIP_DISCOVERY === '1';
const CACHED_BEST_AD = {
  id: null, // will be fetched with a single API call
  adSetId: null,
  adSetName: 'New Leads Ad Set - Copy 2',
};

async function main() {
  let bestAd;

  if (SKIP_DISCOVERY) {
    // Use cached values - just need to find the ad ID with minimal API calls
    console.log('Using cached best ad info (skipping full discovery)...');
    const fb = require('../src/facebook/ads');
    const campaigns = await fb.getCampaigns(ACCOUNT_ID);
    const activeCampaigns = campaigns.data.filter(c => c.status === 'ACTIVE');
    // Find the campaign we identified
    const targetCampaign = activeCampaigns.find(c => c.name.includes('lemonade pet'));
    if (!targetCampaign) { console.log('Could not find target campaign'); return; }

    const adSets = await fb.getAdSets(targetCampaign.id);
    const targetAdSet = adSets.data.find(a => a.name === 'New Leads Ad Set - Copy 2' && a.status === 'ACTIVE');
    if (!targetAdSet) { console.log('Could not find target ad set'); return; }

    const ads = await fb.getAds(targetAdSet.id);
    const targetAd = ads.data.find(a => a.name === 'VIDEO 09' && a.status === 'ACTIVE');
    if (!targetAd) { console.log('Could not find target ad VIDEO 09'); return; }

    bestAd = { id: targetAd.id, name: targetAd.name, adSetId: targetAdSet.id, adSetName: targetAdSet.name };
    console.log('Found ad:', bestAd.name, '| Ad Set:', bestAd.adSetName);
  } else {
    // Full discovery
    console.log('Finding best campaign...');
    const bestCampaign = await launcher.findBestCampaign(ACCOUNT_ID);
    if (!bestCampaign) { console.log('No active campaigns with spend found'); return; }
    console.log('Best campaign:', bestCampaign.name, '| CPR: $' + bestCampaign.costPerResult?.toFixed(2), '| Spend: $' + bestCampaign.spend);

    console.log('Finding best ad...');
    bestAd = await launcher.findBestAd(bestCampaign.id);
    if (!bestAd) { console.log('No active ads with spend found'); return; }
    console.log('Best ad:', bestAd.name);
    console.log('  Ad Set:', bestAd.adSetName);
    console.log('  CPR: $' + bestAd.costPerResult?.toFixed(2), '| Spend: $' + bestAd.spend, '| Conversions:', bestAd.conversions);
  }

  // 3. Download images
  console.log('\nLoading images from Drive...');
  const images = await listFolderMedia(IMAGE_FOLDER);
  const imageCreatives = [];
  for (const img of images) {
    if (!img.mimeType.startsWith('image/')) continue;
    console.log('  Downloading', img.name);
    const file = await downloadFileBuffer(img.id);
    imageCreatives.push({ name: img.name, buffer: file.buffer });
  }
  console.log('Downloaded', imageCreatives.length, 'images');

  // 4. Launch images (ACTIVE)
  console.log('\n=== LAUNCHING ' + imageCreatives.length + ' IMAGE ADS ===');
  const imagePlan = {
    accounts: [{
      id: ACCOUNT_ID,
      name: 'Pet insurance /Final expense',
      bestAd: bestAd,
    }],
    creatives: imageCreatives,
  };

  const imageResults = await launcher.executeLaunch(imagePlan, msg => console.log(msg));
  const imgOk = imageResults.filter(r => r.success).length;
  const imgFail = imageResults.filter(r => !r.success).length;
  console.log('\nImages: ' + imgOk + ' launched, ' + imgFail + ' failed');
  imageResults.filter(r => !r.success).forEach(r => console.log('  FAILED:', r.creativeName, '-', r.error));

  // 5. Download videos
  console.log('\nLoading videos from Drive...');
  const videos = await listFolderMedia(VIDEO_FOLDER);
  const videoCreatives = [];
  for (const vid of videos) {
    if (!vid.mimeType.startsWith('video/')) continue;
    console.log('  Downloading', vid.name);
    const file = await downloadFileBuffer(vid.id);
    videoCreatives.push({ name: vid.name, buffer: file.buffer, fileId: vid.id });
  }
  console.log('Downloaded', videoCreatives.length, 'videos');

  // 6. For video launch, we need to get the source ad's creative details
  const fb = require('../src/facebook/ads');
  const sourceAd = await fb.getAdFull(bestAd.id);
  const sourceCreative = await fb.getAdCreative(sourceAd.creative.id);
  const storySpec = sourceCreative.object_story_spec;

  // Extract page ID and link from the best ad's creative
  const pageId = storySpec?.page_id || sourceCreative.actor_id || null;
  const link = storySpec?.link_data?.link
    || storySpec?.video_data?.call_to_action?.value?.link
    || storySpec?.video_data?.link_url
    || null;
  const linkCaption = storySpec?.link_data?.caption || null;
  const cta = storySpec?.link_data?.call_to_action?.type
    || storySpec?.video_data?.call_to_action?.type
    || 'LEARN_MORE';
  const imageHash = storySpec?.link_data?.image_hash || null;

  console.log('\nSource ad details:');
  console.log('  Page ID:', pageId);
  console.log('  Link:', link);
  console.log('  CTA:', cta);

  if (!pageId || !link) {
    console.log('WARNING: Could not extract page ID or link from best ad. Skipping video launch.');
    return;
  }

  // 7. Launch videos (ACTIVE)
  console.log('\n=== LAUNCHING ' + videoCreatives.length + ' VIDEO ADS ===');
  const videoPlan = {
    accountId: ACCOUNT_ID,
    accountName: 'Pet insurance /Final expense',
    adSetId: bestAd.adSetId,
    adSetName: bestAd.adSetName,
    sourceAd: bestAd,
    creatives: videoCreatives,
    pageId: pageId,
    link: link,
    linkCaption: linkCaption,
    callToAction: cta,
    imageHash: imageHash,
  };

  const videoResult = await launcher.executeVideoLaunch(videoPlan, msg => console.log(msg));
  const vidOk = videoResult.results.filter(r => r.success).length;
  const vidFail = videoResult.results.filter(r => !r.success).length;
  console.log('\nVideos: ' + vidOk + ' launched, ' + vidFail + ' failed');
  videoResult.results.filter(r => !r.success).forEach(r => console.log('  FAILED:', r.creativeName, '-', r.error));

  // Final summary
  console.log('\n========== LAUNCH COMPLETE ==========');
  console.log('Images: ' + imgOk + '/' + imageCreatives.length + ' ACTIVE');
  console.log('Videos: ' + vidOk + '/' + videoCreatives.length + ' ACTIVE');
  console.log('Account: Pet insurance /Final expense');
  console.log('Ad Set: ' + bestAd.adSetName);
  console.log('Total ads created: ' + (imgOk + vidOk));
}

main().catch(e => {
  console.error('FATAL ERROR:', e.message);
  console.error(e.stack);
});
