#!/bin/bash
# post-edit.sh — Prettier tras editar .ts/.tsx, SOLO si el repo tiene config de
# prettier (.prettierrc* o clave "prettier" en package.json). Sin config, el
# código nunca se formateó con prettier y cada edición reformatearía el fichero
# entero (7-sep-2026: comprobado, ningún printWidth reproduce el estilo actual).
# Hook PostToolUse (Edit|Write): recibe el JSON del tool en stdin. También
# acepta la ruta como argumento para usarlo a mano.

FILE="${1:-}"
if [[ -z "$FILE" ]] && [ ! -t 0 ]; then
  FILE=$(jq -r '.tool_input.file_path // empty' 2>/dev/null)
fi
[[ -z "$FILE" ]] && exit 0

ROOT="${CLAUDE_PROJECT_DIR:-.}"
if ! ls "$ROOT"/.prettierrc* >/dev/null 2>&1 && ! grep -q '"prettier"' "$ROOT/package.json" 2>/dev/null; then
  exit 0
fi

if [[ "$FILE" == *.ts || "$FILE" == *.tsx ]]; then
  cd "$ROOT" && npx prettier --write "$FILE" >/dev/null 2>&1 || true
fi
exit 0
