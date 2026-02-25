# French Pillar Plan

## Qué se cambió

1. Pilar `/traductor-jurado-frances`
- Se reforzó metadata (title/description) orientada a intención transaccional principal.
- Se añadieron `SchemaBreadcrumbs` y `SchemaFAQ` con preguntas reales de precio/plazo/validez.
- Se reescribió la cabecera para explicar en los primeros párrafos: qué es, para qué sirve y quién firma.
- Se incorporaron H2 explícitos de negocio: precio, plazo, validez MAEC, documentos frecuentes y proceso.
- Se añadió bloque E-E-A-T con: entidad legal (HBTJ Consultores Lingüísticos S.L.), sede física (Calle Esperanto 9, Málaga), privacidad y contacto.

2. Descanibalización de URLs de soporte
- `/traductores-jurados`: metadata y H1 más corporativos; se redujo foco principal en francés y se enlazó al pilar como servicio específico.
- `/traduccion-jurada-frances-malaga`: enfoque local más claro y enlace al pilar general para intención no geográfica.
- `/traduccion-jurada-online`: bloque de francés prioriza enlace al pilar y deja Málaga como caso local.
- `/traducciones-juradas-baratas`: CTA con anchor natural al pilar (sin exact match repetitivo).

3. Internal linking estratégico
- Home (`/`): bloque textual nuevo con enlace contextual al pilar (además del icono).
- Documentos relevantes: enlaces de soporte al pilar en
  - `/documentos-oficiales/certificados-registro-civil`
  - `/documentos-oficiales/antecedentes-penales`
  - `/documentos-oficiales/documentos-academicos`
- Footer global: enlace adicional “Servicio oficial de francés”.

4. Ajuste global de metadata base
- `app/layout.tsx`: title/description por defecto más genéricos para evitar sobreoptimización sitewide en la keyword francesa.

## Por qué

- Evitar canibalización entre página pilar, página corporativa y variantes de soporte.
- Concentrar señales semánticas y de autoridad en la URL objetivo.
- Mejorar alineación intención SERP (precio, plazo, validez, documentos, proceso).
- Reforzar confianza legal y credibilidad (E-E-A-T) para intención transaccional.

## Impacto esperado

- Mayor estabilidad de ranking de `/traductor-jurado-frances` para queries core y variantes transaccionales.
- Menor competencia interna de `/traductores-jurados` y páginas de soporte.
- Mejor CTR potencial por title/headline más alineados con intención.
- Mejor relevancia de entidad/autoridad por refuerzo MAEC + SL + sede + privacidad.
