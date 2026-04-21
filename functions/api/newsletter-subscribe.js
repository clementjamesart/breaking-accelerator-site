const KIT_API_BASE = 'https://api.kit.com/v4';
const TAG_NAME = 'Newsletter';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

let tagIdCache = null;

async function resolveTagId(apiKey) {
  if (tagIdCache) return tagIdCache;

  const headers = { 'X-Kit-Api-Key': apiKey };

  const res = await fetch(`${KIT_API_BASE}/tags`, { headers });
  if (res.ok) {
    const { tags } = await res.json();
    const match = tags.find(t => t.name === TAG_NAME);
    if (match) {
      tagIdCache = match.id;
      return tagIdCache;
    }
  }

  const createRes = await fetch(`${KIT_API_BASE}/tags`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: TAG_NAME }),
  });
  if (createRes.ok) {
    const { tag } = await createRes.json();
    tagIdCache = tag.id;
    return tagIdCache;
  }

  return null;
}

export async function onRequestPost({ request, env }) {
  const apiKey = env.KIT_API_KEY;
  if (!apiKey) {
    console.error('newsletter-subscribe: KIT_API_KEY missing');
    return new Response(JSON.stringify({ error: 'config' }), { status: 500, headers: CORS });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'bad json' }), { status: 400, headers: CORS });
  }

  const email = (payload.email || '').trim().toLowerCase();
  const firstName = (payload.prenom || '').trim() || null;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: 'bad email' }), { status: 400, headers: CORS });
  }

  const kitHeaders = {
    'Content-Type': 'application/json',
    'X-Kit-Api-Key': apiKey,
  };

  try {
    await fetch(`${KIT_API_BASE}/subscribers`, {
      method: 'POST',
      headers: kitHeaders,
      body: JSON.stringify({
        email_address: email,
        first_name: firstName,
        state: 'active',
      }),
    });
  } catch (e) {
    console.error('newsletter subscriber failed:', e);
  }

  const tagId = await resolveTagId(apiKey);
  if (tagId) {
    try {
      await fetch(`${KIT_API_BASE}/tags/${tagId}/subscribers`, {
        method: 'POST',
        headers: kitHeaders,
        body: JSON.stringify({ email_address: email }),
      });
    } catch (e) {
      console.error('newsletter tag failed:', e);
    }
  }

  try {
    await fetch('https://automate.dancingaccelerator.com/webhook/newsletter-optin-ba', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, prenom: firstName || '' }),
    });
  } catch (e) {
    console.error('n8n webhook failed:', e);
  }

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS });
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}
