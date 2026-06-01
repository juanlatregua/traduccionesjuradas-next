# Logos de marca para facturas

Coloca aquí el PNG del logo de cada marca/actividad. El generador de facturas
(`lib/invoice-pdf.ts`) lo incrusta en la cabecera; si falta, usa un wordmark de
respaldo.

- `holabonjour.png` — logo de Hola Bonjour (academia). Recomendado: PNG con fondo
  transparente, ~1200×1280 px. Se dibuja a ~30×32 mm en la esquina superior izquierda.

La ruta de cada logo se define en `lib/invoice-brands.ts` (`logo.path`).
