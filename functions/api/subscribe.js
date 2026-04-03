export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Corps de requête invalide.' }), { status: 400, headers });
  }

  const { email, prenom } = body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: 'Adresse email invalide.' }), { status: 400, headers });
  }

  const payload = {
    email,
    fields: {},
  };

  if (prenom && prenom.trim()) {
    payload.fields.first_name = prenom.trim();
  }

  try {
    const res = await fetch('https://api.systeme.io/api/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': env.SYSTEME_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok || res.status === 409) {
      // 409 = contact déjà existant, on considère ça comme un succès
      return new Response(JSON.stringify({ success: true }), { status: 200, headers });
    }

    const err = await res.text();
    console.error('Systeme.io error:', res.status, err);
    return new Response(JSON.stringify({ error: 'Erreur lors de l\'inscription. Réessaie.' }), { status: 502, headers });

  } catch (e) {
    console.error('Fetch error:', e);
    return new Response(JSON.stringify({ error: 'Erreur réseau. Réessaie.' }), { status: 500, headers });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
