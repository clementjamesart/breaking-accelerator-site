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

    if (url.pathname === '/api/kit-optin') {
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

      const apiKey = env.KIT_API_KEY;
      if (!apiKey) {
        console.error('kit-optin: KIT_API_KEY missing');
        return new Response('ok', { status: 200, headers: cors });
      }

      let payload;
      try {
        payload = await request.json();
      } catch {
        return new Response('bad json', { status: 400, headers: cors });
      }

      const email = (payload.email || '').trim().toLowerCase();
      const firstName = (payload.prenom || '').trim() || null;
      const leadId = (payload.lead_id || '').trim() || null;

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return new Response('bad email', { status: 400, headers: cors });
      }

      const kitHeaders = {
        'Content-Type': 'application/json',
        'X-Kit-Api-Key': apiKey,
      };

      const subBody = { email_address: email, first_name: firstName, state: 'active' };
      if (leadId) subBody.fields = { lead_id: leadId };

      try {
        const subRes = await fetch('https://api.kit.com/v4/subscribers', {
          method: 'POST',
          headers: kitHeaders,
          body: JSON.stringify(subBody),
        });
        if (!subRes.ok) {
          const errBody = await subRes.text().catch(() => '');
          console.error('kit-optin subscriber:', subRes.status, errBody);
        }
      } catch (e) {
        console.error('kit-optin subscriber fetch:', e);
      }

      if (leadId && env.BA_LEAD_MAP) {
        try {
          await env.BA_LEAD_MAP.put(leadId, email, { expirationTtl: 2592000 });
        } catch (e) {
          console.error('kit-optin KV put:', e);
        }
      }

      try {
        const seqRes = await fetch('https://api.kit.com/v4/sequences/2722054/subscribers', {
          method: 'POST',
          headers: kitHeaders,
          body: JSON.stringify({ email_address: email }),
        });
        if (!seqRes.ok) {
          const errBody = await seqRes.text().catch(() => '');
          console.warn('kit-optin sequence:', seqRes.status, errBody);
        }
      } catch (e) {
        console.error('kit-optin sequence fetch:', e);
      }

      return new Response('ok', { status: 200, headers: { ...cors, 'Content-Type': 'text/plain' } });
    }

    if (url.pathname === '/api/calcom-booked') {
      if (request.method !== 'POST') {
        return new Response('method not allowed', { status: 405 });
      }

      const apiKey = env.KIT_API_KEY;
      const webhookSecret = env.CALCOM_WEBHOOK_SECRET;

      if (!apiKey) {
        console.error('calcom-booked: KIT_API_KEY missing');
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
      console.log('calcom-booked: extracted', { leadId, attendeeEmail: (body?.payload?.attendees?.[0]?.email || ''), bookingUid: body?.payload?.uid, hasResponses: !!body?.payload?.responses, hasMetadata: !!body?.payload?.metadata });

      if (!attendeeEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(attendeeEmail)) {
        console.error('calcom-booked: bad attendee email', { bookingUid });
        return new Response('bad email', { status: 400 });
      }

      const kitHeaders = { 'Content-Type': 'application/json', 'X-Kit-Api-Key': apiKey };
      const attendeeName = (body?.payload?.attendees?.[0]?.name || '').trim() || null;

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

      try {
        const subRes = await fetch('https://api.kit.com/v4/subscribers', {
          method: 'POST',
          headers: kitHeaders,
          body: JSON.stringify({ email_address: targetEmail, first_name: attendeeName, state: 'active' }),
        });
        if (!subRes.ok) {
          const errBody = await subRes.text().catch(() => '');
          console.error('calcom-booked kit subscriber:', subRes.status, errBody, { targetEmail, bookingUid });
        }
      } catch (e) {
        console.error('calcom-booked kit subscriber fetch:', e, { targetEmail, bookingUid });
      }

      try {
        const tagRes = await fetch('https://api.kit.com/v4/tags/18936476/subscribers', {
          method: 'POST',
          headers: kitHeaders,
          body: JSON.stringify({ email_address: targetEmail }),
        });
        if (!tagRes.ok) {
          const errBody = await tagRes.text().catch(() => '');
          console.error('calcom-booked kit tag:', tagRes.status, errBody, { targetEmail, bookingUid });
          return new Response('kit error', { status: 502 });
        }
      } catch (e) {
        console.error('calcom-booked kit fetch:', e, { targetEmail, bookingUid });
        return new Response('kit fetch failed', { status: 502 });
      }

      console.log('calcom-booked: tagged', { targetEmail, attendeeEmail, leadId, bookingUid });
      return new Response('ok', { status: 200 });
    }

    if (url.pathname === '/api/kit-webhook') {
      if (request.method !== 'POST') {
        return new Response('method not allowed', { status: 405 });
      }

      const expectedToken = env.KIT_WEBHOOK_TOKEN;
      if (!expectedToken) {
        console.error('kit-webhook: KIT_WEBHOOK_TOKEN missing');
        return new Response('server misconfigured', { status: 500 });
      }
      const providedToken = url.searchParams.get('token');
      if (providedToken !== expectedToken) {
        console.warn('kit-webhook: invalid token');
        return new Response('unauthorized', { status: 401 });
      }

      const projectKey = env.POSTHOG_PROJECT_KEY;
      if (!projectKey) {
        console.error('kit-webhook: POSTHOG_PROJECT_KEY missing');
        return new Response('ok', { status: 200 });
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return new Response('bad json', { status: 400 });
      }

      // Kit webhook payload shape: { subscriber: {...} } or { ... } depending on event
      const sub = body.subscriber || body;
      const email = (sub.email_address || sub.email || '').trim().toLowerCase();
      const subscriberId = sub.id || null;
      const firstName = sub.first_name || null;

      if (!email) {
        console.warn('kit-webhook: no email in payload', body);
        return new Response('ok', { status: 200 });
      }

      // Map Kit event name (from URL query ?kit_event=xxx) to PostHog event name
      const kitEvent = url.searchParams.get('kit_event') || 'unknown';
      const phEventMap = {
        subscriber_unsubscribe: 'email_unsubscribe',
        subscriber_bounce: 'email_bounce',
        subscriber_complain: 'email_complain',
        link_click: 'email_click',
      };
      const phEvent = phEventMap[kitEvent] || `kit_${kitEvent}`;

      try {
        const phRes = await fetch('https://eu.i.posthog.com/capture/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: projectKey,
            event: phEvent,
            distinct_id: email,
            properties: {
              email,
              kit_subscriber_id: subscriberId,
              kit_first_name: firstName,
              kit_event: kitEvent,
            },
            timestamp: new Date().toISOString(),
          }),
        });
        if (!phRes.ok) {
          const errBody = await phRes.text().catch(() => '');
          console.error('kit-webhook posthog:', phRes.status, errBody);
        }
      } catch (e) {
        console.error('kit-webhook posthog fetch:', e);
      }

      console.log('kit-webhook:', phEvent, { email, subscriberId });
      return new Response('ok', { status: 200 });
    }

    // Toutes les autres requêtes → fichiers statiques Astro
    return env.ASSETS.fetch(request);
  },
};
