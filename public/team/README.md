# /public/team/

Fotos del equipo. Servidas estáticamente desde `/team/`.

## Convenciones

- Nombre: `<slug>.jpg` (kebab-case, ASCII)
- Formato: JPG (next/image se encarga de optimización a WebP/AVIF en runtime)
- Resolución mínima: **400×500 px** (recomendado 800×1000 px para retina)
- Ratio: vertical (3:4 o 4:5) para byline circulares y card de perfil
- Recortado: cabeza + hombros, fondo neutro

## Archivos

- `juan-silva.jpg` — Juan Silva Moreno, traductor jurado MAEC nº 3850. Usado en:
  - `components/AuthorByline.tsx` — byline en cada blog post
  - `app/traductores-jurados/page.tsx` — perfil del autor canónico
  - `components/SchemaPerson.tsx` — campo `image` en Schema Person
  - `app/blog/[slug]/page.tsx` — campo `author.image` en Schema Article
