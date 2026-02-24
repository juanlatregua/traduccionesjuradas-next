#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://www.traduccionesjuradas.net}"
QUOTE_TOKEN="${QUOTE_TOKEN:-}"
TEST_EMAIL="${TEST_EMAIL:-qa-go-$(date +%s)@example.com}"

TMP_DIR="$(mktemp -d)"
COOKIE_JAR="$TMP_DIR/cookies.txt"
trap 'rm -rf "$TMP_DIR"' EXIT

PASS=0
FAIL=0
WARN=0

green() { printf "\033[32m%s\033[0m\n" "$1"; }
red() { printf "\033[31m%s\033[0m\n" "$1"; }
yellow() { printf "\033[33m%s\033[0m\n" "$1"; }

pass() { PASS=$((PASS + 1)); green "PASS  $1"; }
fail() { FAIL=$((FAIL + 1)); red "FAIL  $1"; }
warn() { WARN=$((WARN + 1)); yellow "WARN  $1"; }

extract_reference() {
  sed -n 's/.*"reference":"\([^"]*\)".*/\1/p'
}

echo "BASE_URL=$BASE_URL"
echo "TEST_EMAIL=$TEST_EMAIL"
echo

echo "1) Funnel crítico live (/start + /api/session/*)"
code_start="$(curl -sS -o /dev/null -w "%{http_code}" "$BASE_URL/start")"
[[ "$code_start" == "200" ]] && pass "GET /start => 200" || fail "GET /start => $code_start"

session_resp="$(curl -sS -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -H "content-type: application/json" \
  -d '{"purpose":"smoke-go"}' \
  "$BASE_URL/api/session/start")"
if echo "$session_resp" | grep -q '"ok":true'; then
  pass "POST /api/session/start crea sesión"
else
  fail "POST /api/session/start no devolvió ok=true"
fi

code_proceed="$(curl -sS -o /dev/null -w "%{http_code}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST \
  "$BASE_URL/api/session/proceed-checkout")"
if [[ "$code_proceed" == "400" || "$code_proceed" == "200" ]]; then
  pass "POST /api/session/proceed-checkout responde (sin 404)"
else
  fail "POST /api/session/proceed-checkout => $code_proceed"
fi

code_upload="$(curl -sS -o /dev/null -w "%{http_code}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST \
  "$BASE_URL/api/session/upload")"
if [[ "$code_upload" == "400" || "$code_upload" == "503" || "$code_upload" == "401" ]]; then
  pass "POST /api/session/upload responde (sin 404)"
else
  fail "POST /api/session/upload => $code_upload"
fi

echo
echo "2) Cobro de presupuestos (sin 500)"
if [[ -n "$QUOTE_TOKEN" ]]; then
  quote_status="$(curl -sS -o /dev/null -w "%{http_code}" "$BASE_URL/q/$QUOTE_TOKEN")"
  [[ "$quote_status" == "200" ]] && pass "GET /q/[token] => 200" || fail "GET /q/[token] => $quote_status"

  quote_checkout_status="$(curl -sS -o /dev/null -w "%{http_code}" -X POST \
    "$BASE_URL/api/quotes/public/$QUOTE_TOKEN/checkout")"
  if [[ "$quote_checkout_status" == "200" || "$quote_checkout_status" == "400" || "$quote_checkout_status" == "429" || "$quote_checkout_status" == "503" ]]; then
    pass "POST /api/quotes/public/[token]/checkout sin 500"
  else
    fail "POST /api/quotes/public/[token]/checkout => $quote_checkout_status"
  fi
else
  warn "QUOTE_TOKEN no definido: se omite prueba de quote checkout"
fi

echo
echo "3) No exposición de PII en páginas públicas"
if [[ -n "$QUOTE_TOKEN" ]]; then
  quote_html="$(curl -sS "$BASE_URL/q/$QUOTE_TOKEN")"
  if echo "$quote_html" | grep -q "Cliente: <strong>Datos protegidos</strong>"; then
    pass "Página pública de quote muestra datos protegidos"
  else
    fail "Página pública de quote no muestra placeholder de privacidad"
  fi
  if echo "$quote_html" | grep -Eiq "[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}"; then
    warn "Detectado patrón email en HTML público. Revisar manualmente si es PII real."
  else
    pass "No hay email visible en HTML público de quote"
  fi
else
  warn "QUOTE_TOKEN no definido: se omite validación PII pública en /q/[token]"
fi

echo
echo "4) Idempotencia creación de pedidos"
IDEMP_KEY="smoke-$(date +%s)-$RANDOM"
ORDER_TITLE="SMOKE GO $(date +%s)"
ORDER_BODY="$(cat <<JSON
{"source":"file","title":"$ORDER_TITLE","langPair":"fr-es","amountCents":100,"guestEmail":"$TEST_EMAIL","idempotencyKey":"$IDEMP_KEY"}
JSON
)"

resp1="$(curl -sS -H "content-type: application/json" -H "x-idempotency-key: $IDEMP_KEY" \
  -d "$ORDER_BODY" "$BASE_URL/api/orders")"
resp2="$(curl -sS -H "content-type: application/json" -H "x-idempotency-key: $IDEMP_KEY" \
  -d "$ORDER_BODY" "$BASE_URL/api/orders")"
ref1="$(echo "$resp1" | extract_reference)"
ref2="$(echo "$resp2" | extract_reference)"
if [[ -n "$ref1" && -n "$ref2" && "$ref1" == "$ref2" ]]; then
  pass "Idempotencia activa: misma referencia en reintento"
else
  fail "Idempotencia fallida (ref1=$ref1 ref2=$ref2)"
fi

echo
echo "5) Rate limiting activo"
hits_429=0
for i in $(seq 1 25); do
  code="$(curl -sS -o /dev/null -w "%{http_code}" -H "content-type: application/json" \
    -d '{"reference":"NO_EXISTE_123","email":"nobody@example.com"}' \
    "$BASE_URL/api/orders/lookup")"
  if [[ "$code" == "429" ]]; then
    hits_429=$((hits_429 + 1))
  fi
done
if [[ "$hits_429" -ge 1 ]]; then
  pass "Rate limit responde 429 tras ráfaga ($hits_429 veces)"
else
  fail "No se observó 429 en ráfaga de /api/orders/lookup"
fi

echo
echo "6) Webhook pedidos único y alias legacy controlado"
stripe_code="$(curl -sS -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/payment/stripe/webhook")"
legacy_headers="$(curl -sS -i -X POST "$BASE_URL/api/payment/webhook")"
legacy_code="$(echo "$legacy_headers" | awk 'NR==1 {print $2}')"
if [[ "$stripe_code" == "400" ]]; then
  pass "/api/payment/stripe/webhook operativo (400 esperado sin firma)"
else
  fail "/api/payment/stripe/webhook => $stripe_code"
fi
if [[ "$legacy_code" == "400" ]] && echo "$legacy_headers" | grep -qi "x-webhook-alias: deprecated:/api/payment/stripe/webhook"; then
  pass "/api/payment/webhook alias legacy controlado"
else
  fail "/api/payment/webhook alias no validado (code=$legacy_code)"
fi

echo
echo "===== RESUMEN ====="
echo "PASS=$PASS FAIL=$FAIL WARN=$WARN"

if [[ "$FAIL" -gt 0 ]]; then
  red "DECISIÓN AUTOMÁTICA: NO-GO"
  exit 1
fi

yellow "Validaciones manuales aún necesarias para GO final:"
echo "- E2E manual cliente + traductor (documento -> pago -> entrega -> cierre)"
echo "- WCAG mínimo funnel + backoffice (teclado/foco/contraste/zoom 200%)"
echo "- Confirmar en Vercel: RATE_LIMIT_STORE=db y claves Stripe/webhooks correctas"
green "DECISIÓN AUTOMÁTICA: GO TÉCNICO (pendiente validación manual final)"

