#!/bin/bash
# post-edit.sh — Ejecuta prettier tras editar archivos .ts/.tsx
# Uso: .claude/hooks/post-edit.sh <archivo>

FILE="$1"

if [[ -z "$FILE" ]]; then
  echo "Uso: post-edit.sh <archivo>"
  exit 1
fi

if [[ "$FILE" == *.ts || "$FILE" == *.tsx ]]; then
  npx prettier --write "$FILE" 2>/dev/null
fi
