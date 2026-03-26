require('dotenv').config();
const token = process.env.FACEBOOK_ACCESS_TOKEN;
const BASE = 'https://graph.facebook.com/v21.0';
const ACCOUNT_ID = 'act_2033791397467204';
const IMAGE_FOLDER = '1BckcoQgBTp__H-DIcKuEyz1IaljYnaWE';

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
  // STEP 1: Find best campaign and ad using nested fields (minimal API calls)
  console.log('Step 1: Finding best ad in Clinical Trials account...');
  const account = await fbGet(
    `/${ACCOUNT_ID}/campaigns`,
    'id,name,status,adsets{id,name,status,ads{id,name,status,creative{id},adset_id,tracking_specs}}'
  );

  if (!account.data?.length) {
    console.log('No campaigns found in account');
    return;
  }

  // Find active campaigns
  const activeCampaigns = account.data.filter(c => c.status === 'ACTIVE');
  if (activeCampaigns.length === 0) {
    console.log('No ACTIVE campaigns. Available:');
    account.data.forEach(c => console.log(`  ${c.name} (${c.status})`));
    return;
  }

  // Get insights for active campaigns to find best one
  console.log(`Found ${activeCampaigns.length} active campaigns. Getting insights...`);
  let bestAd = null;
  let bestScore = Infinity;
  let bestAdSetId = null;

  for (const campaign of activeCampaigns) {
    try {
      const insights = await fbGet(`/${campaign.id}/insights`, 'spend,actions&date_preset=last_7d');
      if (!insights.data?.length) continue;

      const d = insights.data[0];
      const spend = parseFloat(d.spend || 0);
      if (spend <= 0) continue;

      const leads = d.actions?.find(a => a.action_type === 'lead');
      const purchases = d.actions?.find(a => a.action_type === 'purchase');
      const conversions = (leads ? parseInt(leads.value) : 0) + (purchases ? parseInt(purchases.value) : 0);
      const cpr = conversions > 0 ? spend / conversions : spend * 100;

      console.log(`  ${campaign.name}: $${spend.toFixed(2)} spend, ${conversions} conversions, $${cpr.toFixed(2)} CPR`);

      // Now find best ad in this campaign
      if (!campaign.adsets?.data) continue;
      for (const adSet of campaign.adsets.data) {
        if (adSet.status !== 'ACTIVE') continue;
        if (!adSet.ads?.data) continue;
        for (const ad of adSet.ads.data) {
          if (ad.status !== 'ACTIVE') continue;
          try {
            const adInsights = await fbGet(`/${ad.id}/insights`, 'spend,actions&date_preset=last_7d');
            if (!adInsights.data?.length) continue;
            const ad_d = adInsights.data[0];
            const ad_spend = parseFloat(ad_d.spend || 0);
            if (ad_spend <= 0) continue;

            const ad_leads = ad_d.actions?.find(a => a.action_type === 'lead');
            const ad_purchases = ad_d.actions?.find(a => a.action_type === 'purchase');
            const ad_conv = (ad_leads ? parseInt(ad_leads.value) : 0) + (ad_purchases ? parseInt(ad_purchases.value) : 0);
            const ad_cpr = ad_conv > 0 ? ad_spend / ad_conv : ad_spend * 100;

            if (ad_cpr < bestScore) {
              bestScore = ad_cpr;
              bestAd = ad;
              bestAdSetId = adSet.id;
              console.log(`    Best so far: ${ad.name} (CPR: $${ad_cpr.toFixed(2)}, spend: $${ad_spend.toFixed(2)}, conv: ${ad_conv})`);
            }
          } catch (e) {
            // Skip ads that error on insights
          }
        }
      }
    } catch (e) {
      console.log(`  ${campaign.name}: Error getting insights - ${e.message}`);
    }
  }

  if (!bestAd) {
    console.log('\nNo active ads with spend found. Looking for ANY active ad to use as template...');
    for (const campaign of activeCampaigns) {
      if (!campaign.adsets?.data) continue;
      for (const adSet of campaign.adsets.data) {
        if (adSet.status !== 'ACTIVE') continue;
        if (!adSet.ads?.data) continue;
        for (const ad of adSet.ads.data) {
          if (ad.status === 'ACTIVE') {
            bestAd = ad;
            bestAdSetId = adSet.id;
            console.log(`Using template ad: ${ad.name} in ad set ${adSet.name}`);
            break;
          }
        }
        if (bestAd) break;
      }
      if (bestAd) break;
    }
  }

  if (!bestAd) {
    console.log('FATAL: No active ads found at all. Cannot launch.');
    return;
  }

  console.log(`\nBest ad: ${bestAd.name} | Ad Set: ${bestAdSetId}`);

  // STEP 2: Get creative details from best ad (ALL fields)
  console.log('\nStep 2: Getting source ad creative details...');
  const creativeDetails = await fbGet(`/${bestAd.creative.id}`, 'id,name,actor_id,title,body,object_story_spec,url_tags');
  const oss = creativeDetails.object_story_spec;
  const pageId = oss.page_id || creativeDetails.actor_id;
  const instagramUserId = oss.instagram_user_id || null;
  const title = creativeDetails.title || '';  // headline
  const body = creativeDetails.body || '';    // primary text
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
  console.log('  Link:', (link || '').substring(0, 80) + '...');
  console.log('  CTA:', cta);
  console.log('  Headline (title):', title);
  console.log('  Caption (display link):', caption);
  console.log('  Primary text:', (body || message || '').substring(0, 80) + '...');

  if (!pageId || !link) {
    console.log('FATAL: Could not extract page ID or link from source ad.');
    return;
  }

  // STEP 3: Download images from Drive
  console.log('\nStep 3: Downloading creatives from Drive...');
  const images = await listFolderMedia(IMAGE_FOLDER);
  const imageFiles = [];
  for (const img of images) {
    if (!img.mimeType.startsWith('image/')) continue;
    console.log('  Downloading', img.name);
    const file = await downloadFileBuffer(img.id);
    imageFiles.push({ name: img.name, buffer: file.buffer });
  }
  console.log(`Downloaded ${imageFiles.length} images`);

  // STEP 4: Upload and create ads
  console.log(`\n=== LAUNCHING ${imageFiles.length} IMAGE ADS (ACTIVE) ===`);
  let success = 0;
  let fail = 0;

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
      newLinkData.caption = caption || 'clinicaltrialconnect.com';
      if (description) newLinkData.description = description;
      // name field in link_data = headline
      if (title) newLinkData.name = title;

      const newSpec = { page_id: pageId, link_data: newLinkData };
      if (instagramUserId) newSpec.instagram_user_id = instagramUserId;

      const creativeParams = {
        name: adName,
        object_story_spec: newSpec,
      };
      if (title) creativeParams.title = title;
      if (body) creativeParams.body = body;
      if (urlTags) creativeParams.url_tags = urlTags;

      const newCreative = await fbPost(`/${ACCOUNT_ID}/adcreatives`, creativeParams);

      // Create ad - ACTIVE
      const newAd = await fbPost(`/${ACCOUNT_ID}/ads`, {
        adset_id: bestAdSetId,
        name: adName,
        creative: { creative_id: newCreative.id },
        status: 'ACTIVE',
      });

      console.log(`[${i + 1}/${imageFiles.length}] ✅ ${img.name} → ad ${newAd.id} (ACTIVE)`);
      success++;
    } catch (err) {
      console.log(`[${i + 1}/${imageFiles.length}] ❌ ${img.name} → ${err.message}`);
      fail++;
    }
  }

  console.log('\n========== LAUNCH COMPLETE ==========');
  console.log(`Images: ${success}/${imageFiles.length} ACTIVE (${fail} failed)`);
  console.log(`Account: Clinical Trials - everly price`);
  console.log(`Ad Set: ${bestAdSetId}`);
}

main().catch(e => {
  console.error('FATAL:', e.message);
  console.error(e.stack);
});
