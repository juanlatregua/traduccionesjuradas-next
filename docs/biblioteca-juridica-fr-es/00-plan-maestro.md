# Biblioteca jurídica FR-ES — Plan maestro

> **Propósito**: documentar los recursos, motores de traducción y glosarios que utilizamos en el ecosistema HBTJ (traduccionesjuradas.net + TraduCAT + mitraductorjurado.es) para producir traducciones juradas francés-español más rápidas y consistentes.
>
> **Formato**: cada archivo de este directorio es un nodo de la biblioteca. El usuario puede portarlos a Notion (markdown nativo) o consumirlos directamente como referencia.

## Estructura propuesta

```
docs/biblioteca-juridica-fr-es/
├── 00-plan-maestro.md              # este archivo
├── 01-ugr-master-traduccion-juridica.md  # análisis del Máster UGR
├── 02-recursos-online.md           # diccionarios, BBDD, normativa online
├── 03-glosarios-fr-es.md           # nuestros glosarios por dominio
├── 04-motores-traduccion.md        # CAT/MT que utilizamos (TraduCAT, otros)
├── 05-corpus-y-pares-bilingues.md  # corpus orig/trad disponible
├── 06-tipologia-documental.md      # tipos de documentos (con guías de extracción)
├── 07-fuentes-oficiales.md         # MAEC, BOE, HCCH, CIEC, EUR-Lex
└── 08-flujos-de-trabajo.md         # cómo encadenamos análisis → traducción → revisión
```

## Por qué esta organización

**Capas de la biblioteca**:

1. **Formación y referencia académica** (01) — qué se enseña en programas de traducción jurídica reconocidos, para asegurar que cubrimos las mismas competencias.
2. **Recursos abiertos** (02, 07) — dónde verificar terminología, normativa y conceptos cuando aparece una duda.
3. **Activos propios** (03, 04, 05, 06) — lo que hemos construido o curado nosotros: glosarios, motores, corpus, plantillas.
4. **Operativa** (08) — cómo encadenar lo anterior para entregar traducciones consistentes y rápidas.

## Estado inicial (30 abril 2026)

| Sección | Estado | Próximo paso |
|---|---|---|
| 01 — UGR Máster | Datos oficiales recopilados de la guía docente M21/56/2/10 | Cruzar competencias con nuestra cobertura actual |
| 02 — Recursos online | Inventario base | Validar accesos y categorizar por dominio |
| 03 — Glosarios FR-ES | Pendiente extracción de TraduCAT | Volcar glosarios de TraduCAT (`~/nlp-projects/traducat/`) |
| 04 — Motores de traducción | Pendiente | Documentar CAT actual + opciones MT (DeepL, Google, ChatGPT) |
| 05 — Corpus | Inventario inicial | Listar pares orig/trad disponibles en `~/nlp-projects/dataset/` |
| 06 — Tipología | Mapa básico de tipos | Cruzar con extractores de TraduCAT |
| 07 — Fuentes oficiales | Inventario | Verificar URLs y caducidad de cada fuente |
| 08 — Flujos | Pendiente | Documentar el flujo actual (análisis IA → presupuesto → traducción) |

## Plan de portabilidad a Notion

Cuando se renueve el token de la API de Notion (actualmente da 401), el contenido de este directorio puede:

1. **Importarse como página jerárquica**: cada `.md` se convierte en página hija dentro de un padre "Biblioteca jurídica FR-ES" en el workspace HBTJ.
2. **Convertirse a database**: las secciones tipológicas (glosarios, recursos, fuentes) pueden vivir mejor como bases de datos con propiedades estructuradas (categoría, idioma, dominio, dificultad).
3. **Quedarse en el repo**: si preferimos versión con git para histórico de cambios, los `.md` siguen siendo la fuente y Notion solo refleja.

Recomendación: **híbrido**. Páginas estables (planes, fuentes oficiales, flujos) en Notion. Glosarios y corpus en el repo + TraduCAT con sincronización periódica.

## Ecosistema referenciado

- **traduccionesjuradas.net** (este repo) — captación + funnel de pedidos
- **TraduCAT** (`~/nlp-projects/traducat/`) — motor interno de traducción jurada
- **mitraductorjurado.es** — marketplace
- **holabonjour.es** — academia francés (vector docente, glosarios pueden cruzarse)

Páginas Notion principales referenciadas:
- traduccionesjuradas.net: `333e8a45-b4e6-8176-8bbe-dc607bc5143d`
- mitraductorjurado.es: `333e8a45-b4e6-81d6-b9a5-e822012b48a9`
- NLP Journey (padre): `332e8a45-b4e6-8039-9c36-f29d3687e8cd`
- NLP Project Arquitectura: `333e8a45-b4e6-81a4-b567-ef753e6bb83c`

La biblioteca FR-ES idealmente cuelga del padre **NLP Journey** o de un nuevo padre dedicado "Recursos jurídico-lingüísticos".
