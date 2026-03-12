#!/bin/bash
# protect.sh — Verifica si el archivo está en una zona protegida
# Uso: .claude/hooks/protect.sh <archivo>
# Retorna exit 1 si el archivo está protegido y el usuario no confirma

FILE="$1"
PROTECTED=false

case "$FILE" in
  app/api/auth/*)
    PROTECTED=true
    ZONE="AUTH (NextAuth + OAuth)"
    ;;
  app/api/payment/*)
    PROTECTED=true
    ZONE="PAGOS (Stripe/Redsys webhooks)"
    ;;
  app/api/webhook*)
    PROTECTED=true
    ZONE="WEBHOOKS"
    ;;
  prisma/migrations/*)
    PROTECTED=true
    ZONE="MIGRACIONES Prisma"
    ;;
esac

if [ "$PROTECTED" = true ]; then
  echo "⚠️  ZONA PROTEGIDA: $ZONE"
  echo "   Archivo: $FILE"
  echo ""
  echo "   Revisa .claude/skills/ para entender el módulo antes de modificar."
  read -p "   ¿Continuar? (s/N): " CONFIRM
  if [[ "$CONFIRM" != "s" && "$CONFIRM" != "S" ]]; then
    echo "❌ Edición cancelada."
    exit 1
  fi
fi
