const KIT_API_BASE = 'https://api.kit.com/v4';
const SEQUENCE_ID = '2722054';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestPost({ request, env }) {
  const apiKey = env.KIT_API_KEY;
  if (!apiKey) {
    console.error('kit-optin: KIT_API_KEY missing from env');
    return new Response('ok', { status: 200, headers: CORS });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response('bad json', { status: 400, headers: CORS });
  }

  const email = (payload.email || '').trim().toLowerCase();
  const firstName = (payload.prenom || '').trim() || null;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response('bad email', { status: 400, headers: CORS });
  }

  const headers = {
    'Content-Type': 'application/json',
    'X-Kit-Api-Key': apiKey,
  };

  // Upsert subscriber (creates or updates by email_address)
  try {
    const subRes = await fetch(`${KIT_API_BASE}/subscribers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email_address: email,
        first_name: firstName,
        state: 'active',
      }),
    });
    if (!subRes.ok) {
      const body = await subRes.text().catch(() => '');
      console.error('kit-optin subscriber:', subRes.status, body);
    }
  } catch (e) {
    console.error('kit-optin subscriber fetch failed:', e);
  }

  // Add subscriber to sequence (no-op if already added; 422 if sequence inactive)
  try {
    const seqRes = await fetch(`${KIT_API_BASE}/sequences/${SEQUENCE_ID}/subscribers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email_address: email }),
    });
    if (!seqRes.ok) {
      const body = await seqRes.text().catch(() => '');
      console.warn('kit-optin sequence:', seqRes.status, body);
    }
  } catch (e) {
    console.error('kit-optin sequence fetch failed:', e);
  }

  return new Response('ok', { status: 200, headers: CORS });
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}
