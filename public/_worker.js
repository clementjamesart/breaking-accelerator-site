export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/lp' || url.pathname === '/lp/') {
      const cookies = request.headers.get('Cookie') || '';
      const match = cookies.match(/ba_lp_variant=(lpa|lpb)/);
      const variant = match ? match[1] : (Math.random() < 0.5 ? 'lpa' : 'lpb');

      const dest = new URL(`/${variant}`, url.origin);
      url.searchParams.forEach((v, k) => dest.searchParams.set(k, v));

      return new Response(null, {
        status: 302,
        headers: {
          'Location': dest.toString(),
          'Set-Cookie': `ba_lp_variant=${variant}; Path=/; Max-Age=2592000; SameSite=Lax; Secure`,
          'Cache-Control': 'no-store',
        },
      });
    }

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

    if (url.pathname === '/api/track') {
      const cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      };

      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors });
      }

      if (request.method !== 'POST') {
        return new Response('method not allowed', { status: 405, headers: cors });
      }

      let body;
      try {
        body = await request.text();
      } catch {
        return new Response('bad body', { status: 400, headers: cors });
      }

      try {
        await fetch('https://automate.dancingaccelerator.com/webhook/vsl-tracking-ba', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
      } catch {}

      return new Response('ok', {
        status: 200,
        headers: { ...cors, 'Content-Type': 'text/plain' },
      });
    }

    if (url.pathname === '/api/brevo-optin') {
      const cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      };

      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors });
      }

      if (request.method !== 'POST') {
        return new Response('method not allowed', { status: 405, headers: cors });
      }

      const apiKey = env.BREVO_API_KEY;
      if (!apiKey) {
        console.error('brevo-optin: BREVO_API_KEY missing');
        return new Response('ok', { status: 200, headers: cors });
      }

      let payload;
      try {
        payload = await request.json();
      } catch {
        return new Response('bad json', { status: 400, headers: cors });
      }

      const email = (payload.email || '').trim().toLowerCase();
      const leadId = (payload.lead_id || '').trim() || null;

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return new Response('bad email', { status: 400, headers: cors });
      }

      const str = (v) => (v === null || v === undefined ? '' : String(v));
      const page = str(payload.page || payload.path).toLowerCase();
      const variant = page.includes('/lpb') ? 'B' : page.includes('/lpa') ? 'A' : '';

      const attributes = {
        PRENOM: str(payload.prenom).trim(),
        LEAD_ID: leadId || '',
        UTM_SOURCE: str(payload.utm_source),
        UTM_MEDIUM: str(payload.utm_medium),
        UTM_CAMPAIGN: str(payload.utm_campaign),
        UTM_CONTENT: str(payload.utm_content),
        UTM_TERM: str(payload.utm_term),
        FBCLID: str(payload.fbclid),
        AD_ID: str(payload.ad_id),
        ADSET_ID: str(payload.adset_id),
        CAMPAIGN_ID: str(payload.campaign_id),
        PLACEMENT: str(payload.placement),
        FUNNEL_VARIANT: variant,
        DATE_OPTIN: new Date().toISOString().slice(0, 10),
        CALL_BOOKED: false,
      };

      if (leadId && env.BA_LEAD_MAP) {
        try {
          await env.BA_LEAD_MAP.put(leadId, email, { expirationTtl: 2592000 });
        } catch (e) {
          console.error('brevo-optin KV put:', e);
        }
      }

      // Fan-out vers n8n (source de vérité NocoDB leads)
      try {
        await fetch('https://automate.dancingaccelerator.com/webhook/optin-ba', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (e) {
        console.error('brevo-optin n8n fanout:', e);
      }

      // Upsert Brevo contact + ajout liste 6 (déclenche automation Brevo native)
      try {
        const res = await fetch('https://api.brevo.com/v3/contacts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': apiKey,
            'accept': 'application/json',
          },
          body: JSON.stringify({
            email,
            attributes,
            listIds: [6],
            updateEnabled: true,
          }),
        });
        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          console.error('brevo-optin:', res.status, errBody);
        }
      } catch (e) {
        console.error('brevo-optin fetch:', e);
      }

      return new Response('ok', { status: 200, headers: { ...cors, 'Content-Type': 'text/plain' } });
    }

    if (url.pathname === '/api/calcom-booked') {
      if (request.method !== 'POST') {
        return new Response('method not allowed', { status: 405 });
      }

      const apiKey = env.BREVO_API_KEY;
      const webhookSecret = env.CALCOM_WEBHOOK_SECRET;

      if (!apiKey) {
        console.error('calcom-booked: BREVO_API_KEY missing');
        return new Response('ok', { status: 200 });
      }
      if (!webhookSecret) {
        console.error('calcom-booked: CALCOM_WEBHOOK_SECRET missing');
        return new Response('server misconfigured', { status: 500 });
      }

      const rawBody = await request.text();
      const signature = request.headers.get('x-cal-signature-256');

      const verifySig = async () => {
        if (!signature) return false;
        const key = await crypto.subtle.importKey(
          'raw',
          new TextEncoder().encode(webhookSecret),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign'],
        );
        const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
        const expected = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
        const received = signature.replace(/^sha256=/, '').trim().toLowerCase();
        if (expected.length !== received.length) return false;
        let diff = 0;
        for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ received.charCodeAt(i);
        return diff === 0;
      };

      if (!(await verifySig())) {
        console.warn('calcom-booked: invalid signature');
        return new Response('invalid signature', { status: 401 });
      }

      let body;
      try {
        body = JSON.parse(rawBody);
      } catch {
        return new Response('bad json', { status: 400 });
      }

      if (body.triggerEvent !== 'BOOKING_CREATED') {
        return new Response('ignored', { status: 200 });
      }

      const attendeeEmail = (body?.payload?.attendees?.[0]?.email || '').trim().toLowerCase();
      const bookingUid = body?.payload?.uid || null;
      const leadId = (
        body?.payload?.responses?.lead_id?.value
        || body?.payload?.metadata?.lead_id
        || body?.payload?.booking?.metadata?.lead_id
        || ''
      ).trim() || null;

      if (!attendeeEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(attendeeEmail)) {
        console.error('calcom-booked: bad attendee email', { bookingUid });
        return new Response('bad email', { status: 400 });
      }

      let targetEmail = attendeeEmail;

      if (leadId && env.BA_LEAD_MAP) {
        try {
          const optinEmail = await env.BA_LEAD_MAP.get(leadId);
          if (optinEmail) {
            targetEmail = optinEmail;
            console.log('calcom-booked: lead_id matched via KV', { leadId, targetEmail, attendeeEmail });
          } else {
            console.warn('calcom-booked: lead_id not found in KV, falling back to attendee email', { leadId, attendeeEmail });
          }
        } catch (e) {
          console.warn('calcom-booked: KV lookup error', e, { leadId });
        }
      }

      const brevoHeaders = {
        'Content-Type': 'application/json',
        'api-key': apiKey,
        'accept': 'application/json',
      };

      // Set CALL_BOOKED=true → déclenche exit condition automation Brevo
      try {
        const res = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(targetEmail)}`, {
          method: 'PUT',
          headers: brevoHeaders,
          body: JSON.stringify({ attributes: { CALL_BOOKED: true } }),
        });
        if (!res.ok && res.status !== 204) {
          const errBody = await res.text().catch(() => '');
          console.error('calcom-booked brevo update:', res.status, errBody, { targetEmail, bookingUid });
          return new Response('brevo error', { status: 502 });
        }
      } catch (e) {
        console.error('calcom-booked brevo fetch:', e, { targetEmail, bookingUid });
        return new Response('brevo fetch failed', { status: 502 });
      }

      // Arrête le nurturing NocoDB (backup si jamais un cron n8n tourne encore)
      const nocodbToken = env.NOCODB_API_TOKEN;
      if (nocodbToken) {
        try {
          const findRes = await fetch(
            `https://sheets.dancingaccelerator.com/api/v2/tables/mgv2xe041qyspnh/records?where=(Email,eq,${encodeURIComponent(targetEmail)})&limit=1`,
            { headers: { 'xc-token': nocodbToken } },
          );
          const findBody = await findRes.json().catch(() => ({}));
          const leadRow = (findBody.list || [])[0];
          if (leadRow && leadRow.Id) {
            await fetch('https://sheets.dancingaccelerator.com/api/v2/tables/mgv2xe041qyspnh/records', {
              method: 'PATCH',
              headers: { 'xc-token': nocodbToken, 'Content-Type': 'application/json' },
              body: JSON.stringify([{ Id: leadRow.Id, nurturing_active: false, Resultat: 'booked' }]),
            });
          }
        } catch (e) {
          console.error('calcom-booked nocodb stop nurturing:', e);
        }
      }

      console.log('calcom-booked: CALL_BOOKED=true + nurturing stopped', { targetEmail, attendeeEmail, leadId, bookingUid });
      return new Response('ok', { status: 200 });
    }

    // Toutes les autres requêtes → fichiers statiques Astro
    return env.ASSETS.fetch(request);
  },
};
