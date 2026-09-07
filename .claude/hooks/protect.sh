#!/bin/bash
# protect.sh — Zonas protegidas: auth, pagos, webhooks y migraciones.
# Hook PreToolUse (Edit|Write): recibe el JSON del tool en stdin y, si el
# archivo está en zona protegida, pide confirmación al usuario (permissionDecision
# "ask") en vez de bloquear. A mano: protect.sh <archivo> imprime el aviso.

FILE="${1:-}"
if [[ -z "$FILE" ]] && [ ! -t 0 ]; then
  FILE=$(jq -r '.tool_input.file_path // empty' 2>/dev/null)
fi
[[ -z "$FILE" ]] && exit 0

REL="${FILE#${CLAUDE_PROJECT_DIR:-$PWD}/}"
ZONE=""
case "$REL" in
  app/api/auth/*)        ZONE="AUTH (NextAuth + OAuth) — .claude/skills/auth-patterns" ;;
  app/api/payment/*)     ZONE="PAGOS (Stripe/Redsys webhooks) — .claude/skills/payments-patterns" ;;
  app/api/webhook*)      ZONE="WEBHOOKS" ;;
  prisma/migrations/*)   ZONE="MIGRACIONES Prisma — nunca editar una aplicada; ver docs/runbooks/prisma-migrations.md" ;;
esac
[[ -z "$ZONE" ]] && exit 0

if [ -t 0 ] || [[ -n "$1" ]]; then
  echo "⚠️  ZONA PROTEGIDA: $ZONE"
  echo "   Archivo: $REL"
  exit 0
fi
jq -cn --arg z "$ZONE" --arg f "$REL" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"ask",permissionDecisionReason:("Zona protegida: " + $z + " — " + $f)}}'
exit 0
