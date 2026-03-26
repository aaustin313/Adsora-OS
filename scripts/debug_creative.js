require('dotenv').config();
const token = process.env.FACEBOOK_ACCESS_TOKEN;
const BASE = 'https://graph.facebook.com/v21.0';

async function api(path, fields) {
  const url = `${BASE}${path}?fields=${fields}&access_token=${token}`;
  const res = await fetch(url);
  return res.json();
}

async function main() {
  // Find the ad
  const camps = await api('/act_1662862634650133/campaigns', 'id,name,status');
  console.log('Campaigns response:', JSON.stringify(camps).substring(0, 500));
  if (!camps.data) { console.log('No campaign data'); return; }
  const target = camps.data.find(c => c.name.includes('lemonade pet') && c.status === 'ACTIVE');
  if (!target) { console.log('No campaign found'); return; }

  console.log('Campaign ID:', target.id, target.name);

  const sets = await api(`/${target.id}/adsets`, 'id,name,status');
  console.log('Ad sets:', JSON.stringify(sets).substring(0, 500));
  if (!sets.data) { console.log('No ad set data'); return; }
  const targetSet = sets.data.find(s => s.name === 'New Leads Ad Set - Copy 2' && s.status === 'ACTIVE');
  if (!targetSet) {
    console.log('Available ad sets:', sets.data.map(s => s.name + ' (' + s.status + ')').join(', '));
    return;
  }

  const ads = await api(`/${targetSet.id}/ads`, 'id,name,status');
  console.log('Ads:', JSON.stringify(ads).substring(0, 500));
  if (!ads.data) { console.log('No ads data'); return; }
  const targetAd = ads.data.find(a => a.name === 'VIDEO 09' && a.status === 'ACTIVE');
  if (!targetAd) {
    console.log('Available ads:', ads.data.map(a => a.name + ' (' + a.status + ')').join(', '));
    return;
  }

  console.log('Ad ID:', targetAd.id);

  // Get creative
  const adData = await api(`/${targetAd.id}`, 'id,name,creative{id,name,object_story_spec},adset_id,tracking_specs');
  console.log('Creative ID:', adData.creative?.id);
  console.log('Ad Set ID:', adData.adset_id);

  const crData = await api(`/${adData.creative.id}`, 'id,name,object_story_spec,actor_id');
  console.log('\n=== SOURCE CREATIVE object_story_spec ===');
  console.log(JSON.stringify(crData.object_story_spec, null, 2));
  console.log('\nactor_id:', crData.actor_id);

  // Now test: upload a small image and try creating a link_data creative
  const { downloadFileBuffer } = require('../src/google/drive');
  const { listFolderMedia } = require('../src/google/drive');
  const images = await listFolderMedia('1bRDhB21ZLgAbZz5ziSEzdjxuVXoZ6R7w');
  const firstImage = images[0];
  console.log('\nTest image:', firstImage.name);

  const file = await downloadFileBuffer(firstImage.id);
  const base64 = file.buffer.toString('base64');

  // Upload image
  const uploadBody = new URLSearchParams();
  uploadBody.set('access_token', token);
  uploadBody.set('bytes', base64);
  const uploadRes = await fetch(`${BASE}/act_1662862634650133/adimages`, { method: 'POST', body: uploadBody });
  const uploadData = await uploadRes.json();
  console.log('\nUpload result:', JSON.stringify(uploadData));

  if (uploadData.images) {
    const key = Object.keys(uploadData.images)[0];
    const hash = uploadData.images[key].hash;
    console.log('Image hash:', hash);

    // Build the converted creative spec
    const oss = crData.object_story_spec;
    const vd = oss.video_data;
    const link = vd.call_to_action?.value?.link || '';
    const cta = vd.call_to_action?.type || 'LEARN_MORE';
    const message = vd.message || '';
    const pageId = oss.page_id || crData.actor_id;

    const newSpec = {
      page_id: pageId,
      link_data: {
        link: link,
        message: message,
        image_hash: hash,
        call_to_action: { type: cta, value: { link: link } },
      },
    };

    console.log('\n=== NEW CREATIVE SPEC ===');
    console.log(JSON.stringify(newSpec, null, 2));

    // Try creating the creative
    const createBody = new URLSearchParams();
    createBody.set('access_token', token);
    createBody.set('name', 'TEST - IMAGE 01 - Debug');
    createBody.set('object_story_spec', JSON.stringify(newSpec));
    const createRes = await fetch(`${BASE}/act_1662862634650133/adcreatives`, { method: 'POST', body: createBody });
    const createData = await createRes.json();
    console.log('\nCreative creation result:', JSON.stringify(createData, null, 2));
  }
}

main().catch(e => console.error('Error:', e.message, e.stack));
