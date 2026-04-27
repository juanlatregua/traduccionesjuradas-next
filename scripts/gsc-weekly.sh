#!/bin/bash
# scripts/gsc-weekly.sh — Reporte semanal GSC + diff con anterior
# Llamado por launchd (~/Library/LaunchAgents/net.traduccionesjuradas.gsc-weekly.plist)

set -e
cd "$(dirname "$0")/.."

DATE=$(date +%Y-%m-%d)
mkdir -p qa/seo/gsc-history

# Reporte agregado
node scripts/gsc-report.mjs > qa/seo/gsc-history/report-${DATE}.log 2>&1

# Inspección de URLs críticas
node scripts/gsc-inspect-urls.mjs > qa/seo/gsc-history/inspect-${DATE}.log 2>&1

# Diff con reporte previo (si existe)
PREV=$(ls -1 qa/seo/gsc-report-*.md 2>/dev/null | grep -v "${DATE}" | tail -1)
CURR=$(ls -1 qa/seo/gsc-report-*.md 2>/dev/null | tail -1)
if [ -n "$PREV" ] && [ -n "$CURR" ] && [ "$PREV" != "$CURR" ]; then
  diff -u "$PREV" "$CURR" > qa/seo/gsc-history/diff-${DATE}.txt || true
fi

echo "✅ GSC weekly report done: ${DATE}"
