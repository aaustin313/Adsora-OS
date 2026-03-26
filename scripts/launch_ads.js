/**
 * Universal ad launcher.
 * - Downloads videos/images from Google Drive folders
 * - Matches by filename prefix to the right ad account
 * - Duplicates best ad, swaps creative, launches ACTIVE
 * - Fixed-wait video processing (no polling spam)
 * - Auto-duplicates ad set when full (50 limit)
 * - Rate limit retry: 60-minute wait
 * - No skip logic — every file gets launched
 *
 * Usage:
 *   node scripts/launch_ads.js                     # launches all configured folders
 *   node scripts/launch_ads.js <folderID> <vertical>  # launch specific folder for one vertical
 */
require('dotenv').config();
const token = process.env.FACEBOOK_ACCESS_TOKEN;
const BASE = 'https://graph.facebook.com/v21.0';

const { google } = require('googleapis');
const { downloadFileBuffer } = require('../src/google/drive');
const fs = require('fs');
const path = require('path');

// ─── Account mapping (add new verticals here) ───
const ACCOUNTS = {
  BATH:     { id: 'act_726611190359174',  displayLink: 'premiumbathremodel.com' },
  WINDOW:   { id: 'act_1497079531710704', displayLink: 'premiumwindowpros.com' },
  SIDING:   { id: 'act_1156048933035295', displayLink: 'americansidingpros.com' },
  ROOF:     { id: 'act_1195051932524874', displayLink: 'trustedroofingpros.com' },
  PET:      { id: 'act_1662862634650133', displayLink: 'unitedpetinsurance.com' },
  CLINICAL: { id: 'act_2033791397467204', displayLink: 'clinicaltrialconnect.com' },
  TALC:     { id: 'act_2404527333314185', displayLink: 'americanprograms.org' },
};

// ─── Default Drive folders (home services launch) ───
const DEFAULT_FOLDERS = [
  '1NeYt__40K8SCIT_ZY9PmAv7VJFgsmB1D',
  '1fehpOtKX82p8FjSMyDfEjkIWy9p17-k3',
  '1RVvmbThi325Qvuzpko3_5C_rvqCBcMnI',
];

// ─── Helpers ───
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let driveClient;
function getDrive() {
  if (driveClient) return driveClient;
  const creds = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'token.json'), 'utf8'));
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI
  );
  oauth2.setCredentials(creds);
  driveClient = google.drive({ version: 'v3', auth: oauth2 });
  return driveClient;
}

async function listDriveFolder(folderId) {
  const drive = getDrive();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id,name,mimeType,size)',
    pageSize: 100,
  });
  return res.data.files;
}

async function fbPost(apiPath, params) {
  const body = new URLSearchParams();
  body.set('access_token', token);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    body.set(k, typeof v === 'object' ? JSON.stringify(v) : v);
  }
  const res = await fetch(`${BASE}${apiPath}`, { method: 'POST', body });
  const data = await res.json();
  if (data.error) {
    if (data.error.code === 32 || data.error.code === 4 || data.error.code === 17 ||
        (data.error.message && data.error.message.includes('rate limit'))) {
      throw Object.assign(new Error(`RATE_LIMIT: ${data.error.message}`), { isRateLimit: true });
    }
    if (data.error.error_subcode === 1487809) {
      throw Object.assign(new Error(`AD_SET_FULL: ${data.error.message}`), { isAdSetFull: true });
    }
    throw new Error(`FB API: ${data.error.message} | ${JSON.stringify(data.error)}`);
  }
  return data;
}

async function fbGet(apiPath, fields) {
  const url = `${BASE}${apiPath}?fields=${fields}&access_token=${token}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) {
    if (data.error.code === 32 || data.error.code === 4 || data.error.code === 17) {
      throw Object.assign(new Error(`RATE_LIMIT: ${data.error.message}`), { isRateLimit: true });
    }
    throw new Error(`FB API: ${data.error.message}`);
  }
  return data;
}

// ─── Ad Set Duplication ───
async function duplicateAdSet(sourceAdSetId) {
  const res = await fbPost(`/${sourceAdSetId}/copies`, {
    deep_copy: 'false',
    status_option: 'ACTIVE',
  });
  const newId = res.copied_adset_id || (res.ad_object_ids && res.ad_object_ids[0]);
  console.log(`  ✂ Duplicated ad set -> ${newId}`);
  return newId;
}

// ─── Find Source Ad ───
async function findSourceAd(accountId) {
  const account = await fbGet(
    `/${accountId}/campaigns`,
    'id,name,status,adsets{id,name,status,ads{id,name,status,creative{id},adset_id,tracking_specs}}'
  );
  if (!account.data?.length) return null;

  let firstAd = null;
  let firstAdSetId = null;
  let campaignName = '';

  for (const campaign of account.data) {
    if (campaign.status !== 'ACTIVE') continue;
    if (!campaign.adsets?.data) continue;
    for (const adSet of campaign.adsets.data) {
      if (adSet.status !== 'ACTIVE') continue;
      if (!adSet.ads?.data) continue;
      for (const ad of adSet.ads.data) {
        if (ad.status === 'ACTIVE' && !firstAd) {
          firstAd = ad;
          firstAdSetId = adSet.id;
          campaignName = campaign.name;
        }
      }
    }
  }

  if (!firstAd) return null;
  return { ad: firstAd, adSetId: firstAdSetId, campaignName };
}

// ─── Upload + Create Ad (fixed-wait, no polling spam) ───
async function uploadAndCreateAd(vid, accountId, sourceAd, adSetId, creative, displayLink, adName) {
  // Upload video
  const form = new FormData();
  form.append('access_token', token);
  form.append('source', new Blob([vid.buffer], { type: 'video/mp4' }), vid.name);
  form.append('title', vid.name);

  const uploadRes = await fetch(`${BASE}/${accountId}/advideos`, { method: 'POST', body: form });
  const uploadData = await uploadRes.json();
  if (uploadData.error) throw new Error(`Video upload: ${uploadData.error.message}`);
  const videoId = uploadData.id;
  console.log(`    Uploaded video ${videoId}, waiting for processing...`);

  // Fixed-wait based on file size (instead of polling every 3s)
  const sizeMB = vid.buffer.length / 1024 / 1024;
  const initialWait = sizeMB >= 50 ? 4 * 60 * 1000 : 2 * 60 * 1000; // 4 min for large, 2 min for small
  await sleep(initialWait);

  // Check status (max 8 attempts with 2-min gaps, 15-min on rate limit)
  let ready = false;
  let thumbnailUrl = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const statusRes = await fetch(`${BASE}/${videoId}?fields=status,thumbnails&access_token=${token}`);
    const statusData = await statusRes.json();

    if (statusData.error) {
      if (statusData.error.code === 4 || statusData.error.code === 32 || statusData.error.code === 17) {
        console.log(`    Rate limited during status check. Waiting 15 minutes...`);
        await sleep(15 * 60 * 1000);
        continue;
      }
      continue;
    }

    if (statusData.thumbnails?.data?.length) thumbnailUrl = statusData.thumbnails.data[0].uri;
    const videoStatus = statusData.status?.video_status;
    if (videoStatus === 'ready') { ready = true; break; }
    if (videoStatus === 'error') throw new Error('Video processing failed');

    // Not ready yet — wait 2 more minutes
    console.log(`    Video not ready yet (attempt ${attempt + 1}/5). Waiting 2 more minutes...`);
    await sleep(2 * 60 * 1000);
  }
  if (!ready) throw new Error('Video processing timed out after 8 attempts');

  // Extract creative details from source
  const oss = creative.object_story_spec;
  const pageId = oss.page_id || creative.actor_id;
  const instagramUserId = oss.instagram_user_id || null;
  const title = creative.title || '';
  const body = creative.body || '';
  const urlTags = creative.url_tags || '';

  let link, cta, message, description;
  if (oss.video_data) {
    const vd = oss.video_data;
    link = vd.call_to_action?.value?.link || vd.link_url || '';
    cta = vd.call_to_action?.type || 'LEARN_MORE';
    message = vd.message || body || '';
    description = vd.link_description || '';
  } else if (oss.link_data) {
    const ld = oss.link_data;
    link = ld.link || '';
    cta = ld.call_to_action?.type || 'LEARN_MORE';
    message = ld.message || body || '';
    description = ld.description || '';
  }

  // Build video creative — display link goes in call_to_action.value.link_caption
  const videoData = {
    video_id: videoId,
    message: message || body,
    call_to_action: {
      type: cta,
      value: { link: link, link_caption: displayLink },
    },
    image_url: thumbnailUrl,
  };
  if (title) videoData.title = title;
  if (description) videoData.link_description = description;

  const videoSpec = { page_id: pageId, video_data: videoData };
  if (instagramUserId) videoSpec.instagram_user_id = instagramUserId;

  const creativeParams = { name: adName, object_story_spec: videoSpec };
  if (title) creativeParams.title = title;
  if (body) creativeParams.body = body;
  if (urlTags) creativeParams.url_tags = urlTags;

  const newCreative = await fbPost(`/${accountId}/adcreatives`, creativeParams);

  const newAd = await fbPost(`/${accountId}/ads`, {
    adset_id: adSetId,
    name: adName,
    creative: { creative_id: newCreative.id },
    status: 'ACTIVE',
    tracking_specs: sourceAd.tracking_specs ? JSON.stringify(sourceAd.tracking_specs) : undefined,
  });

  return { adId: newAd.id, adName };
}

// ─── Collect Videos from Drive ───
async function collectAllVideos(folderIds, verticalOverride) {
  const allVideos = [];

  for (const folderId of folderIds) {
    const topFiles = await listDriveFolder(folderId);
    const subfolders = topFiles.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
    const directVideos = topFiles.filter(f => f.mimeType.startsWith('video/'));

    for (const sub of subfolders) {
      const subFiles = await listDriveFolder(sub.id);
      for (const f of subFiles) {
        if (!f.mimeType.startsWith('video/')) continue;
        const vertical = verticalOverride || f.name.split(' ')[0].toUpperCase();
        allVideos.push({
          displayName: `${sub.name} - ${f.name}`,
          driveId: f.id,
          size: parseInt(f.size) || 0,
          vertical,
          originalName: f.name,
        });
      }
    }

    for (const f of directVideos) {
      const vertical = verticalOverride || f.name.split(' ')[0].toUpperCase();
      allVideos.push({
        displayName: f.name,
        driveId: f.id,
        size: parseInt(f.size) || 0,
        vertical,
        originalName: f.name,
      });
    }
  }

  return allVideos;
}

// ─── Main ───
async function main() {
  // Parse args: optional folderID, vertical override, and target ad set
  // Usage: node launch_ads.js [folderID] [vertical] [adSetId]
  const args = process.argv.slice(2);
  let folderIds = DEFAULT_FOLDERS;
  let verticalFilter = null;
  let targetAdSetId = null;

  if (args.length >= 3) {
    folderIds = [args[0]];
    verticalFilter = args[1].toUpperCase();
    targetAdSetId = args[2];
  } else if (args.length >= 2) {
    folderIds = [args[0]];
    verticalFilter = args[1].toUpperCase();
  } else if (args.length === 1) {
    folderIds = [args[0]];
  }

  console.log('Step 1: Collecting all videos from Drive folders...');
  const allVideos = await collectAllVideos(folderIds, verticalFilter);

  const byVertical = {};
  for (const v of allVideos) {
    if (!byVertical[v.vertical]) byVertical[v.vertical] = [];
    byVertical[v.vertical].push(v);
  }

  console.log('\nVideos found:');
  for (const [v, files] of Object.entries(byVertical)) {
    const account = ACCOUNTS[v];
    console.log(`  ${v}: ${files.length} videos -> ${account ? account.id : 'NO ACCOUNT'}`);
  }

  const allResults = {};

  for (const [vertical, config] of Object.entries(ACCOUNTS)) {
    if (verticalFilter && vertical !== verticalFilter) continue;

    const videos = byVertical[vertical];
    if (!videos || videos.length === 0) continue;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`  ${vertical} — ${config.id} — ${videos.length} videos`);
    console.log(`${'='.repeat(60)}`);

    // Find source ad (with rate limit retry)
    console.log('  Finding source ad...');
    let source;

    if (targetAdSetId) {
      // When a target ad set is specified, find the best ad within it
      console.log(`  Using target ad set: ${targetAdSetId}`);
      const adsRes = await fbGet(`/${targetAdSetId}/ads`, 'id,name,status,creative{id},tracking_specs');
      const activeAds = adsRes.data?.filter(a => a.status === 'ACTIVE') || [];
      if (activeAds.length === 0) {
        console.log(`  No active ads in target ad set. Skipping.`);
        continue;
      }
      source = { ad: activeAds[0], adSetId: targetAdSetId, campaignName: '(target ad set)' };
    } else {
      try {
        source = await findSourceAd(config.id);
      } catch (err) {
        if (err.isRateLimit) {
          console.log(`  Rate limited. Waiting 60 minutes...`);
          await sleep(60 * 60 * 1000);
          try { source = await findSourceAd(config.id); }
          catch { console.log(`  Still limited. Skipping ${vertical}.`); continue; }
        } else {
          console.log(`  Error: ${err.message}. Skipping.`);
          continue;
        }
      }
    }

    if (!source) {
      console.log(`  No active ads found. Skipping.`);
      continue;
    }
    console.log(`  Source: ${source.ad.name} | Campaign: ${source.campaignName}`);

    // Get creative details
    const creative = await fbGet(`/${source.ad.creative.id}`, 'id,actor_id,title,body,object_story_spec,url_tags');

    let success = 0;
    let fail = 0;
    const launchedAds = [];
    let currentAdSetId = source.adSetId;

    for (let i = 0; i < videos.length; i++) {
      const vid = videos[i];
      const sizeMB = (vid.size / 1024 / 1024).toFixed(1);
      const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const adName = vid.displayName.replace(/\.[^.]+$/, '') + ' - ' + dateStr;

      console.log(`\n  [${i + 1}/${videos.length}] ${vid.displayName} (${sizeMB}MB)`);

      try {
        const file = await downloadFileBuffer(vid.driveId);
        const result = await uploadAndCreateAd(
          { name: vid.originalName, buffer: file.buffer },
          config.id, source.ad, currentAdSetId, creative, config.displayLink, adName
        );
        result.adSetId = currentAdSetId;
        console.log(`  [${i + 1}/${videos.length}] ✅ -> ad ${result.adId} | ad set ${currentAdSetId} (ACTIVE)`);
        launchedAds.push(result);
        success++;
      } catch (err) {
        if (err.isRateLimit) {
          console.log(`  ⏳ Rate limited. Waiting 60 minutes... (${new Date().toLocaleTimeString()})`);
          await sleep(60 * 60 * 1000);
          i--; // retry
          continue;
        }
        if (err.isAdSetFull) {
          console.log(`  Ad set full (50 limit). Duplicating ad set...`);
          try {
            currentAdSetId = await duplicateAdSet(currentAdSetId);
            i--; // retry in new ad set
            continue;
          } catch (dupErr) {
            console.log(`  Failed to duplicate: ${dupErr.message}`);
          }
        }
        console.log(`  [${i + 1}/${videos.length}] ❌ ${err.message}`);
        fail++;
      }
    }

    allResults[vertical] = { accountId: config.id, ads: launchedAds, success, fail, total: videos.length };
  }

  // ─── Summary ───
  console.log('\n' + '='.repeat(60));
  console.log('  LAUNCH COMPLETE');
  console.log('='.repeat(60));

  let grandTotal = 0;
  let grandSuccess = 0;

  for (const [vertical, result] of Object.entries(allResults)) {
    const acctNum = result.accountId.replace('act_', '');
    console.log(`\n${vertical}: ${result.success}/${result.total} ACTIVE (${result.fail} failed)`);
    console.log(`  Account: ${result.accountId}`);
    console.log(`  Ads Manager: https://www.facebook.com/adsmanager/manage/ads?act=${acctNum}`);

    // Group ads by ad set
    const byAdSet = {};
    for (const ad of result.ads) {
      if (!byAdSet[ad.adSetId]) byAdSet[ad.adSetId] = [];
      byAdSet[ad.adSetId].push(ad);
    }
    for (const [adSetId, ads] of Object.entries(byAdSet)) {
      console.log(`\n  Ad Set ID: ${adSetId} (${ads.length} ads)`);
      console.log(`  Ad Set Link: https://www.facebook.com/adsmanager/manage/ads?act=${acctNum}&selected_adset_ids=${adSetId}`);
      for (const ad of ads) {
        console.log(`    - ${ad.adName} (${ad.adId})`);
      }
    }

    grandTotal += result.total;
    grandSuccess += result.success;
  }

  console.log(`\nTOTAL: ${grandSuccess}/${grandTotal} ads launched ACTIVE`);
}

main().catch(e => {
  console.error('FATAL:', e.message);
  console.error(e.stack);
});
