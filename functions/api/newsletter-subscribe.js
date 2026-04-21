const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestPost({ request }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'bad json' }), { status: 400, headers: CORS });
  }

  const email = (payload.email || '').trim().toLowerCase();
  const prenom = (payload.prenom || '').trim() || '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: 'bad email' }), { status: 400, headers: CORS });
  }

  try {
    const res = await fetch('https://automate.dancingaccelerator.com/webhook/newsletter-optin-ba', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, prenom }),
    });
    if (!res.ok) {
      console.error('n8n webhook error:', res.status);
      return new Response(JSON.stringify({ error: 'webhook' }), { status: 502, headers: CORS });
    }
  } catch (e) {
    console.error('n8n webhook failed:', e);
    return new Response(JSON.stringify({ error: 'webhook' }), { status: 502, headers: CORS });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS });
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}
