# Reporte semanal Google Search Console

## Comandos manuales

```bash
npm run gsc:report    # tabla agregada (clicks, impr, CTR, top queries/pages, oportunidades)
npm run gsc:inspect   # URL Inspection a 15 páginas críticas (estado de indexación)
```

Ambos generan archivos en `qa/seo/gsc-*-YYYY-MM-DD.md`.

## Programar ejecución semanal (macOS launchd)

1. Crear el plist:

```bash
cat > ~/Library/LaunchAgents/net.traduccionesjuradas.gsc-weekly.plist <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>net.traduccionesjuradas.gsc-weekly</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>/Users/juan/Code/HBTJ/traduccionesjuradas-net/scripts/gsc-weekly.sh</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Weekday</key>
    <integer>1</integer>
    <key>Hour</key>
    <integer>9</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>/tmp/gsc-weekly.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/gsc-weekly.err</string>
</dict>
</plist>
EOF
```

2. Cargar:

```bash
launchctl load ~/Library/LaunchAgents/net.traduccionesjuradas.gsc-weekly.plist
launchctl list | grep traduccionesjuradas
```

3. Ejecutar manualmente para probar:

```bash
launchctl start net.traduccionesjuradas.gsc-weekly
```

Cada ejecución guarda log en `qa/seo/gsc-history/` y crea diff con la semana anterior (si existe).

## Requisitos

- Variable `GOOGLE_VISION_SERVICE_ACCOUNT_JSON` en `.env.local` (Service Account con Search Console API habilitada).
- La SA debe estar añadida en Search Console → Settings → Users con permiso lectura.

## Desinstalar

```bash
launchctl unload ~/Library/LaunchAgents/net.traduccionesjuradas.gsc-weekly.plist
rm ~/Library/LaunchAgents/net.traduccionesjuradas.gsc-weekly.plist
```
