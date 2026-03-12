#!/bin/bash
# pre-commit.sh — Verificaciones antes de commit
# Uso: .claude/hooks/pre-commit.sh
# Si cualquier paso falla → bloquea el commit

set -e

echo "=== 1/3 Lint ==="
npm run lint
echo "✓ Lint OK"

echo ""
echo "=== 2/3 TypeScript ==="
npx tsc --noEmit --skipLibCheck
echo "✓ TypeScript OK"

echo ""
echo "=== 3/3 Prisma validate ==="
npx prisma validate
echo "✓ Prisma OK"

echo ""
echo "✓ Todas las verificaciones pasaron"
