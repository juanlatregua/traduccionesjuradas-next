#!/usr/bin/env bash
# Ignored Build Step para Vercel — ahorra minutos de build.
#
# Convención de Vercel:  exit 1 = CONSTRUIR  ·  exit 0 = SALTAR el build.
#
# Salta el build SOLO si el commit no toca nada que afecte al sitio:
# documentación, markdown, CONTEXT.md y .claude/. Cualquier cambio en
# código, schema, dependencias o contenido (blog .mdx incluido) → build.
#
# Activación (una vez): Vercel → Project → Settings → Git →
#   "Ignored Build Step" → "Run my Bash command" →
#   bash scripts/vercel-ignore-build.sh

# Sin commit previo (primer deploy o clon shallow) → construir por seguridad.
if ! git rev-parse HEAD^ >/dev/null 2>&1; then
  echo "Sin commit previo → build."
  exit 1
fi

# ¿Hay cambios FUERA de las rutas ignorables?
if git diff --quiet HEAD^ HEAD -- . \
    ':(exclude)*.md' \
    ':(exclude)docs/**' \
    ':(exclude).claude/**' \
    ':(exclude)CONTEXT.md'; then
  echo "Solo cambios en docs/markdown/CONTEXT → se salta el build (ahorro)."
  exit 0
fi

echo "Cambios relevantes para el sitio → build."
exit 1
