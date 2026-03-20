#!/usr/bin/env bash
# project-map.sh — Mapa completo del proyecto traduccionesjuradas.net
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== PROJECT MAP — traduccionesjuradas.net ==="
echo "Fecha: $(date '+%Y-%m-%d %H:%M')"
echo ""

# 1. API routes
echo "--- 1. API ROUTES ---"
find "$ROOT/app/api" -name "route.ts" | sort | sed "s|$ROOT/||"
echo ""

# 2. Pages
echo "--- 2. PAGES ---"
find "$ROOT/app" -name "page.tsx" | sort | sed "s|$ROOT/||"
echo ""

# 3. Components
echo "--- 3. COMPONENTS ---"
find "$ROOT/components" -name "*.tsx" | sort | sed "s|$ROOT/||"
echo ""

# 4. Scripts
echo "--- 4. SCRIPTS ---"
ls "$ROOT/scripts/"
echo ""

# 5. Cron jobs
echo "--- 5. CRON JOBS ---"
find "$ROOT/app/api" -path "*/cron*" -name "route.ts" 2>/dev/null | sort | sed "s|$ROOT/||" || echo "(none)"
echo ""

# 6. Environment variables (.env.example)
echo "--- 6. ENV VARIABLES (.env.example) ---"
if [ -f "$ROOT/.env.example" ]; then
  grep -E '^[A-Za-z_]' "$ROOT/.env.example" | cut -d'=' -f1 | sort
else
  echo "(no .env.example found)"
fi
echo ""

# 7. Stack (key dependencies from package.json)
echo "--- 7. STACK (package.json) ---"
DEPS=("next" "react" "typescript" "tailwindcss" "prisma" "@prisma/client" "drizzle-orm" "stripe" "redsys-easy" "resend" "twilio" "@vercel/blob" "@supabase/supabase-js" "@anthropic-ai/sdk" "next-auth" "velite" "jspdf" "pdf-parse" "@paypal/checkout-server-sdk")
for dep in "${DEPS[@]}"; do
  ver=$(node -e "try{const p=require('$ROOT/package.json');const v=(p.dependencies||{})['$dep']||(p.devDependencies||{})['$dep'];if(v)console.log(v);else process.exit(1)}catch{process.exit(1)}" 2>/dev/null) && echo "  $dep: $ver" || true
done
echo ""

echo "=== END ==="
