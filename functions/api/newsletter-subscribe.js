const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const BREVO_LIST_ID = 10;

export async function onRequestPost({ request, env }) {
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

  const body = {
    email,
    listIds: [BREVO_LIST_ID],
    updateEnabled: true,
  };
  if (prenom) {
    body.attributes = { PRENOM: prenom };
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': env.BREVO_API_KEY,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok && res.status !== 204) {
      const err = await res.text();
      console.error('Brevo API error:', res.status, err);
      return new Response(JSON.stringify({ error: 'api' }), { status: 502, headers: CORS });
    }
  } catch (e) {
    console.error('Brevo API failed:', e);
    return new Response(JSON.stringify({ error: 'api' }), { status: 502, headers: CORS });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS });
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}
