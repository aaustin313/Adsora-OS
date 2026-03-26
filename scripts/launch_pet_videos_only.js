/**
 * Video-only launch script for pet insurance.
 * Images are already live (18/18). This launches the 5 remaining videos.
 */
require('dotenv').config();
const token = process.env.FACEBOOK_ACCESS_TOKEN;
const BASE = 'https://graph.facebook.com/v21.0';
const ACCOUNT_ID = 'act_1662862634650133';

const { listFolderMedia, downloadFileBuffer } = require('../src/google/drive');

async function fbPost(path, params) {
  const body = new URLSearchParams();
  body.set('access_token', token);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    body.set(k, typeof v === 'object' ? JSON.stringify(v) : v);
  }
  const res = await fetch(`${BASE}${path}`, { method: 'POST', body });
  const data = await res.json();
  if (data.error) throw new Error(`FB API: ${data.error.message} | ${JSON.stringify(data.error)}`);
  return data;
}

async function fbGet(path, fields) {
  const url = `${BASE}${path}?fields=${fields}&access_token=${token}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(`FB API: ${data.error.message}`);
  return data;
}

async function main() {
  // STEP 1: Get source ad info (same as before)
  console.log('Step 1: Finding source ad...');
  const campaign = await fbGet(
    '/120241562779660465',
    'id,name,adsets{id,name,status,ads{id,name,status,creative{id},adset_id,tracking_specs}}'
  );

  let sourceAd = null;
  let sourceAdSetId = null;
  for (const adSet of campaign.adsets.data) {
    if (adSet.status !== 'ACTIVE' || adSet.name !== 'New Leads Ad Set - Copy 2') continue;
    sourceAdSetId = adSet.id;
    for (const ad of (adSet.ads?.data || [])) {
      if (ad.status === 'ACTIVE') {
        sourceAd = ad;
        break;
      }
    }
    if (sourceAd) break;
  }

  if (!sourceAd) {
    console.log('Could not find any active ad in the target ad set.');
    return;
  }

  console.log('Found:', sourceAd.name, '| Ad Set:', sourceAdSetId);

  // STEP 2: Get full creative details
  console.log('Step 2: Getting creative details...');
  const creativeDetails = await fbGet(`/${sourceAd.creative.id}`, 'id,actor_id,title,body,object_story_spec,url_tags');
  const oss = creativeDetails.object_story_spec;
  const pageId = oss.page_id || creativeDetails.actor_id;
  const instagramUserId = oss.instagram_user_id || null;
  const title = creativeDetails.title || '';
  const body = creativeDetails.body || '';
  const urlTags = creativeDetails.url_tags || '';

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

  console.log('  Page ID:', pageId);
  console.log('  Link:', (link || '').substring(0, 80) + '...');
  console.log('  CTA:', cta);

  // STEP 3: Download ONLY videos from Drive
  console.log('\nStep 3: Downloading videos from Drive...');
  const videos = await listFolderMedia('1UQBBHuA0HsMQrSTU3wKnQe0LSjpj-L1c');

  const videoFiles = [];
  for (const vid of videos) {
    if (!vid.mimeType.startsWith('video/')) continue;
    console.log('  Downloading', vid.name);
    const file = await downloadFileBuffer(vid.id);
    videoFiles.push({ name: vid.name, buffer: file.buffer });
  }
  console.log(`Downloaded ${videoFiles.length} videos`);

  // STEP 4: Upload videos and create ads
  console.log(`\n=== LAUNCHING ${videoFiles.length} VIDEO ADS ===`);
  let success = 0;
  let fail = 0;

  for (let i = 0; i < videoFiles.length; i++) {
    const vid = videoFiles[i];
    const adName = vid.name.replace(/\.[^.]+$/, '') + ' - ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    try {
      // Upload video via native FormData + Blob
      const form = new FormData();
      form.append('access_token', token);
      form.append('source', new Blob([vid.buffer], { type: 'video/mp4' }), vid.name);
      form.append('title', vid.name);

      const uploadRes = await fetch(`${BASE}/${ACCOUNT_ID}/advideos`, {
        method: 'POST',
        body: form,
      });
      const uploadData = await uploadRes.json();
      if (uploadData.error) throw new Error(`Video upload: ${uploadData.error.message}`);
      const videoId = uploadData.id;
      console.log(`  Video uploaded: ${videoId}, waiting for processing...`);

      // Poll for video ready and get thumbnail
      let ready = false;
      let thumbnailUrl = null;
      for (let attempt = 0; attempt < 40; attempt++) {
        await new Promise(r => setTimeout(r, 3000));
        const statusRes = await fetch(`${BASE}/${videoId}?fields=status,thumbnails&access_token=${token}`);
        const statusData = await statusRes.json();
        const videoStatus = statusData.status?.video_status;
        if (statusData.thumbnails?.data?.length) {
          thumbnailUrl = statusData.thumbnails.data[0].uri;
        }
        if (videoStatus === 'ready') { ready = true; break; }
        if (videoStatus === 'error') throw new Error('Video processing failed');
      }
      if (!ready) throw new Error('Video processing timed out');

      // Create video ad creative with ALL fields from source
      const videoData = {
        video_id: videoId,
        message: message || body,
        call_to_action: { type: cta, value: { link: link } },
        image_url: thumbnailUrl,
      };
      if (title) videoData.title = title;
      videoData.link_caption = caption || 'unitedpetinsurance.com';
      if (description) videoData.link_description = description;

      const videoSpec = { page_id: pageId, video_data: videoData };
      if (instagramUserId) videoSpec.instagram_user_id = instagramUserId;

      const vidCreativeParams = { name: adName, object_story_spec: videoSpec };
      if (title) vidCreativeParams.title = title;
      if (body) vidCreativeParams.body = body;
      if (urlTags) vidCreativeParams.url_tags = urlTags;

      const newCreative = await fbPost(`/${ACCOUNT_ID}/adcreatives`, vidCreativeParams);

      // Create ad - ACTIVE
      const newAd = await fbPost(`/${ACCOUNT_ID}/ads`, {
        adset_id: sourceAdSetId,
        name: adName,
        creative: { creative_id: newCreative.id },
        status: 'ACTIVE',
        tracking_specs: sourceAd.tracking_specs ? JSON.stringify(sourceAd.tracking_specs) : undefined,
      });

      console.log(`[${i + 1}/${videoFiles.length}] ✅ ${vid.name} → ad ${newAd.id} (ACTIVE)`);
      success++;
    } catch (err) {
      console.log(`[${i + 1}/${videoFiles.length}] ❌ ${vid.name} → ${err.message}`);
      fail++;
    }
  }

  console.log('\n========== LAUNCH COMPLETE ==========');
  console.log(`Videos: ${success}/${videoFiles.length} ACTIVE (${fail} failed)`);
  console.log(`Account: Pet insurance`);
  console.log(`Ad Set: ${sourceAdSetId}`);
}

main().catch(e => {
  console.error('FATAL:', e.message);
  console.error(e.stack);
});
