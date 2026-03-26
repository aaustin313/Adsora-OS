/**
 * Minimal API call launch script for pet insurance.
 * Uses nested field expansion to minimize API calls and avoid rate limits.
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
  // STEP 1: Single API call to get campaigns with nested ad sets, ads, and creative details
  console.log('Step 1: Finding source ad (single API call with nested fields)...');
  const campaign = await fbGet(
    '/120241562779660465',  // campaign ID from previous discovery
    'id,name,adsets{id,name,status,ads{id,name,status,creative{id,name,object_story_spec},adset_id,tracking_specs}}'
  );

  // Find the right ad set and ad
  let sourceAd = null;
  let sourceAdSetId = null;
  for (const adSet of campaign.adsets.data) {
    if (adSet.status !== 'ACTIVE' || adSet.name !== 'New Leads Ad Set - Copy 2') continue;
    for (const ad of (adSet.ads?.data || [])) {
      if (ad.name === 'VIDEO 09' && ad.status === 'ACTIVE') {
        sourceAd = ad;
        sourceAdSetId = adSet.id;
        break;
      }
    }
    if (sourceAd) break;
  }

  if (!sourceAd) {
    console.log('Could not find VIDEO 09 in expected ad set. Dumping available:');
    for (const adSet of campaign.adsets.data) {
      console.log(`  ${adSet.name} (${adSet.status})`);
      for (const ad of (adSet.ads?.data || [])) {
        console.log(`    ${ad.name} (${ad.status})`);
      }
    }
    return;
  }

  console.log('Found:', sourceAd.name, '| Ad Set:', sourceAdSetId);

  // STEP 2: Get ALL creative fields
  console.log('Step 2: Getting full creative details...');
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
  console.log('  Instagram ID:', instagramUserId);
  console.log('  Headline:', title);
  console.log('  Caption:', caption);
  console.log('  Link:', (link || '').substring(0, 80) + '...');
  console.log('  CTA:', cta);
  console.log('  Primary text:', (body || message || '').substring(0, 80) + '...');

  // STEP 3: Download all creatives from Drive (no FB API calls)
  console.log('\nStep 3: Downloading creatives from Drive...');
  const images = await listFolderMedia('1bRDhB21ZLgAbZz5ziSEzdjxuVXoZ6R7w');
  const videos = await listFolderMedia('1UQBBHuA0HsMQrSTU3wKnQe0LSjpj-L1c');

  const imageFiles = [];
  for (const img of images) {
    if (!img.mimeType.startsWith('image/')) continue;
    console.log('  Downloading', img.name);
    const file = await downloadFileBuffer(img.id);
    imageFiles.push({ name: img.name, buffer: file.buffer });
  }

  const videoFiles = [];
  for (const vid of videos) {
    if (!vid.mimeType.startsWith('video/')) continue;
    console.log('  Downloading', vid.name);
    const file = await downloadFileBuffer(vid.id);
    videoFiles.push({ name: vid.name, buffer: file.buffer });
  }

  console.log(`Downloaded ${imageFiles.length} images, ${videoFiles.length} videos`);

  // STEP 4: Upload images and create ads
  console.log('\n=== LAUNCHING IMAGE ADS ===');
  let imgSuccess = 0;
  let imgFail = 0;

  for (let i = 0; i < imageFiles.length; i++) {
    const img = imageFiles[i];
    const adName = img.name.replace(/\.[^.]+$/, '') + ' - ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    try {
      // Upload image
      const base64 = img.buffer.toString('base64');
      const uploadResult = await fbPost(`/${ACCOUNT_ID}/adimages`, { bytes: base64 });
      const key = Object.keys(uploadResult.images)[0];
      const hash = uploadResult.images[key].hash;

      // Create link_data creative with ALL fields from source
      const newLinkData = {
        link: link,
        message: message || body,
        image_hash: hash,
        call_to_action: { type: cta, value: { link: link } },
      };
      newLinkData.caption = caption || 'unitedpetinsurance.com';
      if (description) newLinkData.description = description;
      if (title) newLinkData.name = title;

      const newSpec = { page_id: pageId, link_data: newLinkData };
      if (instagramUserId) newSpec.instagram_user_id = instagramUserId;

      const creativeParams = { name: adName, object_story_spec: newSpec };
      if (title) creativeParams.title = title;
      if (body) creativeParams.body = body;
      if (urlTags) creativeParams.url_tags = urlTags;

      const newCreative = await fbPost(`/${ACCOUNT_ID}/adcreatives`, creativeParams);

      // Create ad - ACTIVE
      const newAd = await fbPost(`/${ACCOUNT_ID}/ads`, {
        adset_id: sourceAdSetId,
        name: adName,
        creative: { creative_id: newCreative.id },
        status: 'ACTIVE',
        tracking_specs: sourceAd.tracking_specs ? JSON.stringify(sourceAd.tracking_specs) : undefined,
      });

      console.log(`[${i + 1}/${imageFiles.length}] ✅ ${img.name} → ad ${newAd.id} (ACTIVE)`);
      imgSuccess++;
    } catch (err) {
      console.log(`[${i + 1}/${imageFiles.length}] ❌ ${img.name} → ${err.message}`);
      imgFail++;
    }
  }

  // STEP 5: Upload videos and create ads
  console.log('\n=== LAUNCHING VIDEO ADS ===');
  let vidSuccess = 0;
  let vidFail = 0;

  for (let i = 0; i < videoFiles.length; i++) {
    const vid = videoFiles[i];
    const adName = vid.name.replace(/\.[^.]+$/, '') + ' - ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    try {
      // Upload video via multipart
      const FormData = (await import('form-data')).default;
      const form = new FormData();
      form.append('access_token', token);
      form.append('source', vid.buffer, { filename: vid.name, contentType: 'video/mp4' });
      form.append('title', vid.name);

      const uploadRes = await fetch(`${BASE}/${ACCOUNT_ID}/advideos`, {
        method: 'POST',
        body: form,
        headers: form.getHeaders(),
      });
      const uploadData = await uploadRes.json();
      if (uploadData.error) throw new Error(`Video upload: ${uploadData.error.message}`);
      const videoId = uploadData.id;
      console.log(`  Video uploaded: ${videoId}, waiting for processing...`);

      // Poll for video ready
      let ready = false;
      for (let attempt = 0; attempt < 40; attempt++) {
        await new Promise(r => setTimeout(r, 3000));
        const statusRes = await fetch(`${BASE}/${videoId}?fields=status&access_token=${token}`);
        const statusData = await statusRes.json();
        const videoStatus = statusData.status?.video_status;
        if (videoStatus === 'ready') { ready = true; break; }
        if (videoStatus === 'error') throw new Error('Video processing failed');
      }
      if (!ready) throw new Error('Video processing timed out');

      // Create video ad creative with ALL fields from source
      const videoData = {
        video_id: videoId,
        message: message || body,
        call_to_action: { type: cta, value: { link: link } },
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
      vidSuccess++;
    } catch (err) {
      console.log(`[${i + 1}/${videoFiles.length}] ❌ ${vid.name} → ${err.message}`);
      vidFail++;
    }
  }

  // SUMMARY
  console.log('\n========== LAUNCH COMPLETE ==========');
  console.log(`Images: ${imgSuccess}/${imageFiles.length} ACTIVE (${imgFail} failed)`);
  console.log(`Videos: ${vidSuccess}/${videoFiles.length} ACTIVE (${vidFail} failed)`);
  console.log(`Account: Pet insurance / Final expense`);
  console.log(`Total ads created: ${imgSuccess + vidSuccess}`);
}

main().catch(e => {
  console.error('FATAL:', e.message);
  console.error(e.stack);
});
