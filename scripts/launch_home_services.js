/**
 * Multi-vertical home services video launch.
 * - Downloads videos from multiple Drive folders
 * - Matches by prefix to the right ad account
 * - Duplicates best ad, swaps creative, launches ACTIVE
 * - Handles rate limits with auto-retry
 * - Skips already-launched ads (checks by name)
 * - Auto-finds new ad set if current one is full (50 limit)
 */
require('dotenv').config();
const token = process.env.FACEBOOK_ACCESS_TOKEN;
const BASE = 'https://graph.facebook.com/v21.0';

const { google } = require('googleapis');
const { downloadFileBuffer } = require('../src/google/drive');
const fs = require('fs');
const path = require('path');

// Account mapping
const ACCOUNTS = {
  BATH: { id: 'act_726611190359174', displayLink: 'premiumbathremodel.com' },
  WINDOW: { id: 'act_1497079531710704', displayLink: 'premiumwindowpros.com' },
  SIDING: { id: 'act_1156048933035295', displayLink: 'americansidingpros.com' },
  ROOF: { id: 'act_1195051932524874', displayLink: 'trustedroofingpros.com' },
};

const DRIVE_FOLDERS = [
  '1NeYt__40K8SCIT_ZY9PmAv7VJFgsmB1D',
  '1fehpOtKX82p8FjSMyDfEjkIWy9p17-k3',
  '1RVvmbThi325Qvuzpko3_5C_rvqCBcMnI',
];

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
    // Rate limit check
    if (data.error.code === 32 || data.error.code === 4 || (data.error.message && data.error.message.includes('rate limit'))) {
      throw Object.assign(new Error(`RATE_LIMIT: ${data.error.message}`), { isRateLimit: true });
    }
    // Ad set full check
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

async function duplicateAdSet(accountId, sourceAdSetId) {
  // Duplicate an ad set via the FB API copy endpoint
  const res = await fbPost(`/${sourceAdSetId}/copies`, {
    deep_copy: 'false',
    status_option: 'ACTIVE',
  });
  const newId = res.copied_adset_id || (res.ad_object_ids && res.ad_object_ids[0]);
  console.log(`  Created new ad set: ${newId}`);
  return newId;
}

async function findSourceAdAndAlternates(accountId) {
  const account = await fbGet(
    `/${accountId}/campaigns`,
    'id,name,status,adsets{id,name,status,ads{id,name,status,creative{id},adset_id,tracking_specs}}'
  );
  if (!account.data?.length) return null;

  const adSets = []; // collect all active ad sets
  let firstAd = null;
  let firstAdSetId = null;
  let campaignName = '';

  for (const campaign of account.data) {
    if (campaign.status !== 'ACTIVE') continue;
    if (!campaign.adsets?.data) continue;
    for (const adSet of campaign.adsets.data) {
      if (adSet.status !== 'ACTIVE') continue;
      adSets.push(adSet);
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
  return { ad: firstAd, adSetId: firstAdSetId, campaignName, allAdSets: adSets };
}

async function uploadAndCreateVideoAd(vid, accountId, sourceAd, adSetId, creative, displayLink, adNameOverride) {
  const adName = adNameOverride;

  // Upload video
  const form = new FormData();
  form.append('access_token', token);
  form.append('source', new Blob([vid.buffer], { type: 'video/mp4' }), vid.name);
  form.append('title', vid.name);

  const uploadRes = await fetch(`${BASE}/${accountId}/advideos`, { method: 'POST', body: form });
  const uploadData = await uploadRes.json();
  if (uploadData.error) throw new Error(`Video upload: ${uploadData.error.message}`);
  const videoId = uploadData.id;

  // Poll for ready + thumbnail (with rate limit handling)
  let ready = false;
  let thumbnailUrl = null;
  for (let attempt = 0; attempt < 120; attempt++) {
    await new Promise(r => setTimeout(r, 5000)); // 5s between polls to reduce API calls
    const statusRes = await fetch(`${BASE}/${videoId}?fields=status,thumbnails&access_token=${token}`);
    const statusData = await statusRes.json();
    if (statusData.error) {
      // Rate limited during polling — wait 5 minutes and retry
      if (statusData.error.code === 4 || statusData.error.code === 32 || statusData.error.code === 17) {
        console.log(`    Rate limited during video poll. Waiting 5 minutes...`);
        await new Promise(r => setTimeout(r, 5 * 60 * 1000));
        continue;
      }
      continue; // Other errors — just retry
    }
    if (statusData.thumbnails?.data?.length) thumbnailUrl = statusData.thumbnails.data[0].uri;
    const videoStatus = statusData.status?.video_status;
    if (videoStatus === 'ready') { ready = true; break; }
    if (videoStatus === 'error') throw new Error('Video processing failed');
  }
  if (!ready) throw new Error('Video processing timed out');

  // Extract creative details
  const oss = creative.object_story_spec;
  const pageId = oss.page_id || creative.actor_id;
  const instagramUserId = oss.instagram_user_id || null;
  const title = creative.title || '';
  const body = creative.body || '';
  const urlTags = creative.url_tags || '';

  let link, cta, message, caption, description;
  if (oss.video_data) {
    const vd = oss.video_data;
    link = vd.call_to_action?.value?.link || vd.link_url || '';
    cta = vd.call_to_action?.type || 'LEARN_MORE';
    message = vd.message || body || '';
    caption = vd.link_caption || '';
    description = vd.link_description || '';
  } else if (oss.link_data) {
    const ld = oss.link_data;
    link = ld.link || '';
    cta = ld.call_to_action?.type || 'LEARN_MORE';
    message = ld.message || body || '';
    caption = ld.caption || '';
    description = ld.description || '';
  }

  // Build video creative — use video_data without deprecated link_caption
  const videoData = {
    video_id: videoId,
    message: message || body,
    call_to_action: { type: cta, value: { link: link } },
    image_url: thumbnailUrl,
  };
  if (title) videoData.title = title;
  if (description) videoData.link_description = description;

  const videoSpec = { page_id: pageId, video_data: videoData };
  if (instagramUserId) videoSpec.instagram_user_id = instagramUserId;

  // Set display link via top-level creative fields
  const creativeParams = { name: adName, object_story_spec: videoSpec };
  if (title) creativeParams.title = title;
  if (body) creativeParams.body = body;
  if (urlTags) creativeParams.url_tags = urlTags;
  // Use source caption or generate one
  creativeParams.link_url = displayLink;

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

async function collectAllVideos() {
  const allVideos = [];

  for (const folderId of DRIVE_FOLDERS) {
    const topFiles = await listDriveFolder(folderId);
    const subfolders = topFiles.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
    const directVideos = topFiles.filter(f => f.mimeType.startsWith('video/'));

    if (subfolders.length > 0) {
      for (const sub of subfolders) {
        const subFiles = await listDriveFolder(sub.id);
        for (const f of subFiles) {
          if (!f.mimeType.startsWith('video/')) continue;
          const vertical = f.name.split(' ')[0].toUpperCase();
          allVideos.push({ name: `${sub.name} - ${f.name}`, driveId: f.id, size: f.size, folder: folderId, vertical, originalName: f.name });
        }
      }
    }

    for (const f of directVideos) {
      const vertical = f.name.split(' ')[0].toUpperCase();
      allVideos.push({ name: f.name, driveId: f.id, size: f.size, folder: folderId, vertical, originalName: f.name });
    }
  }

  return allVideos;
}

async function main() {
  console.log('Step 1: Collecting all videos from Drive folders...');
  const allVideos = await collectAllVideos();

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
    const videos = byVertical[vertical];
    if (!videos || videos.length === 0) {
      console.log(`\n  ${vertical}: No videos found`);
      continue;
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`  ${vertical} — ${config.id} — ${videos.length} videos`);
    console.log(`${'='.repeat(60)}`);

    // Find source ad
    console.log('  Finding source ad...');
    let source;
    try {
      source = await findSourceAdAndAlternates(config.id);
    } catch (err) {
      if (err.isRateLimit) {
        console.log(`  RATE LIMITED on ${vertical}. Waiting 60 minutes...`);
        await new Promise(r => setTimeout(r, 60 * 60 * 1000));
        try {
          source = await findSourceAdAndAlternates(config.id);
        } catch {
          console.log(`  Still rate limited. Skipping ${vertical}.`);
          continue;
        }
      } else {
        console.log(`  Error: ${err.message}. Skipping.`);
        continue;
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
      console.log(`\n  [${i + 1}/${videos.length}] Downloading ${vid.name} (${sizeMB}MB)...`);

      try {
        const file = await downloadFileBuffer(vid.driveId);
        // Use full display name (includes subfolder context) for unique ad names
        const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const adName = vid.name.replace(/\.[^.]+$/, '') + ' - ' + dateStr;
        const result = await uploadAndCreateVideoAd(
          { name: vid.originalName, buffer: file.buffer },
          config.id, source.ad, currentAdSetId, creative, config.displayLink, adName
        );
        console.log(`  [${i + 1}/${videos.length}] ✅ ${vid.name} -> ad ${result.adId} (ACTIVE)`);
        launchedAds.push(result);
        success++;
      } catch (err) {
        if (err.isRateLimit) {
          console.log(`  RATE LIMITED. Waiting 60 minutes before retrying...`);
          console.log(`  Time: ${new Date().toLocaleTimeString()}`);
          await new Promise(r => setTimeout(r, 60 * 60 * 1000));
          // Retry this video
          i--;
          continue;
        }
        if (err.isAdSetFull) {
          // Duplicate the current ad set to create a new one
          console.log(`  Ad set ${currentAdSetId} full (50 limit). Duplicating...`);
          try {
            const newAdSetId = await duplicateAdSet(config.id, currentAdSetId);
            currentAdSetId = newAdSetId;
            i--; // retry this video in the new ad set
            continue;
          } catch (dupErr) {
            console.log(`  Failed to duplicate ad set: ${dupErr.message}`);
          }
        }
        console.log(`  [${i + 1}/${videos.length}] ❌ ${vid.name} -> ${err.message}`);
        fail++;
      }
    }

    allResults[vertical] = { accountId: config.id, ads: launchedAds, success, fail, total: videos.length };
  }

  // FINAL SUMMARY
  console.log('\n' + '='.repeat(60));
  console.log('  LAUNCH COMPLETE — SUMMARY');
  console.log('='.repeat(60));

  let grandTotal = 0;
  let grandSuccess = 0;

  for (const [vertical, result] of Object.entries(allResults)) {
    const acctNum = result.accountId.replace('act_', '');
    console.log(`\n${vertical}: ${result.success}/${result.total} ACTIVE (${result.fail} failed)`);
    console.log(`  Account: ${result.accountId}`);
    console.log(`  Ads Manager: https://www.facebook.com/adsmanager/manage/ads?act=${acctNum}`);
    if (result.ads.length > 0) {
      console.log('  Launched ads:');
      for (const ad of result.ads) {
        console.log(`    - ${ad.adName}: https://www.facebook.com/adsmanager/manage/ads?act=${acctNum}&selected_ad_ids=${ad.adId}`);
      }
    }
    grandTotal += result.total;
    grandSuccess += result.success;
  }

  console.log(`\nGRAND TOTAL: ${grandSuccess}/${grandTotal} ads launched ACTIVE`);
}

main().catch(e => {
  console.error('FATAL:', e.message);
  console.error(e.stack);
});
