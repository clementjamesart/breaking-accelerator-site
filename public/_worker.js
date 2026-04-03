export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/subscribe') {
      const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      };

      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            ...headers,
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        });
      }

      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Méthode non autorisée.' }), { status: 405, headers });
      }

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

      const payload = { email, fields: {} };
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
          return new Response(JSON.stringify({ success: true }), { status: 200, headers });
        }

        return new Response(JSON.stringify({ error: "Erreur lors de l'inscription. Réessaie." }), { status: 502, headers });

      } catch {
        return new Response(JSON.stringify({ error: 'Erreur réseau. Réessaie.' }), { status: 500, headers });
      }
    }

    // Toutes les autres requêtes → fichiers statiques Astro
    return env.ASSETS.fetch(request);
  },
};
