const WEBHOOK_URL = 'https://automate.dancingaccelerator.com/webhook/vsl-tracking-ba';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestPost({ request }) {
  let body;
  try {
    body = await request.text();
  } catch {
    return new Response('bad body', { status: 400, headers: CORS });
  }

  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } catch {
  }

  return new Response('ok', {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'text/plain' },
  });
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}
