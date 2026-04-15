#!/bin/bash
# Simule un webhook Cal.com BOOKING_CREATED vers un endpoint local ou distant.
#
# Usage:
#   CALCOM_WEBHOOK_SECRET=xxx ./scripts/test-calcom-webhook.sh
#   CALCOM_WEBHOOK_SECRET=xxx ./scripts/test-calcom-webhook.sh https://breakingaccelerator.com/api/calcom-booked
#
# Par défaut vise http://localhost:8788/api/calcom-booked (wrangler pages dev).
#
# Si KIT_API_KEY est set côté endpoint (local ou prod), ce test TAGUERA
# réellement l'email de test dans Kit. Utilise un email jetable ou un
# compte test ; sinon attends-toi à une 502 (Kit rejette clé manquante).

set -euo pipefail

if [ -z "${CALCOM_WEBHOOK_SECRET:-}" ]; then
  echo "error: set CALCOM_WEBHOOK_SECRET to the same value as the endpoint's env var"
  exit 1
fi

URL="${1:-http://localhost:8788/api/calcom-booked}"
EMAIL="${TEST_EMAIL:-test+calcom-$(date +%s)@example.com}"

BODY=$(cat <<EOF
{"triggerEvent":"BOOKING_CREATED","createdAt":"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)","payload":{"uid":"test-uid-$(date +%s)","bookingId":999999,"eventTypeId":123,"type":"appel-bilan-de-carriere","title":"Appel bilan de carriere","startTime":"2026-04-20T10:00:00.000Z","endTime":"2026-04-20T10:30:00.000Z","attendees":[{"email":"$EMAIL","name":"Test Lead","timeZone":"Europe/Paris","language":{"locale":"fr"}}]}}
EOF
)

SIGNATURE=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$CALCOM_WEBHOOK_SECRET" | awk '{print $2}')

echo "POST $URL"
echo "Email: $EMAIL"
echo "Signature: $SIGNATURE"
echo "---"

curl -sS -i -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "x-cal-signature-256: $SIGNATURE" \
  -d "$BODY"
echo
