#!/bin/bash
# session-start.sh — Prepara el contenedor de Claude Code on the web.
# En local no hace nada: la máquina de Juan ya tiene todo.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# npm install (no ci): el estado del contenedor se cachea tras el hook y
# install reaprovecha lo que ya esté. postinstall dispara `prisma generate`,
# que es lo que quita los errores de @prisma/client en tsc y en los tests.
npm install --no-audit --no-fund

# Velite genera `@/content` (blog MDX). Sin esto, tsc y next lint fallan con
# "Cannot find module '@/content'" — el error preexistente que documenta CLAUDE.md.
npx velite build || echo "[session-start] velite build fallo — @/content no disponible"
