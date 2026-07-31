# Unir tj.net con lavori, o SEO propio — Informe final del STORM (31-jul-2026)

> Copia del artifact https://claude.ai/code/artifact/61263c0f-c4eb-47a3-859b-2e32a77f4438

## 1. TL;DR

**UNIR. No se crea SEO para lavori — ni ahora ni como "experimento barato".** tj.net es la única boca con demanda medida y creciendo (56 clics/28d, +44%, pos. 28,7); lavori declara en su propio `sitemap.ts` que "la captación vive en traduccionesjuradas.net" y el STORM del 26-jul ya prohibió abrirlo al público. Pero la unión NO es código ni API (prohibida): son hábitos de operación + una pieza que las tres tesis enterraron y es el mejor movimiento coste/señal del trimestre: **estrenar el flujo agregador** (gestoría como miembro demanda, ya construido y sin usar — lo único que alimenta el gate endurecido sin abrir nada al público). Y el día 0 no es nada de esto: es **tomar formalmente la prórroga del GATE 1**, que venció el 23-jul y sigue sin decidirse.

## 2. Veredicto por tesis

**A (unir por tj.net) — GANA, herida y corregida.** Es la única ejecutable y coherente con el canon. Sus tres heridas, que este informe corrige: (1) su plan operativo (Juan despachando pedidos de tj.net) produce dirigidos con autor=Juan y clientes DE Juan, que puntúan **cero** en el gate endurecido que dice usar "sin rebajar" — hay que separar los dos marcadores; (2) presupuesta el papel único como "una tarde" por tercera vez sin fecha dura; (3) verificado en código: el dirigido nace con `precioCliente: null` hardcodeado (`src/lib/encargos.ts:275-276`) — el "círculo que deja fila con precio" deja media fila sin un retoque no presupuestado.

**B (SEO propio de lavori) — MUERE.** Gates calibrados a lo imposible (≥20 clics/28d a 180 días = 36% del tráfico de tj.net entero con años de historial; probabilidad base 5,7% de top-10 el primer año), reabre el "NO abrir lavori al público jamás" del 26-jul, rompe el contrato tácito con miembros captados ESTA SEMANA bajo promesa de tablón privado, canibaliza los clusters nicho que tj.net acaba de sembrar, y su versión sin veneno ya existe congelada: mitraductorjurado.es. Se rescata una idea (el problema estructural real: el colectivo sin demanda propia) para dentro de 90 días, no la tesis.

**C (A + directorio con gates) — MUERE en su secuencia.** Quema el ask más delicado (fichas en Google) como TERCER mensaje al grupo cuando Juan aún debe el primero (campaña, pendiente desde el 29-jul, con su WhatsApp ya marcado por spam); se auto-canibaliza (mes 1 posts tj.net en NL/SV/RO/DA, mes 2 páginas lavori en las mismas lenguas); y sus relojes son incoherentes (decide el día 90 sobre un sandbox de ~118 días). Queda como **opción diferida**: solo reabrible tras ≥1 círculo completo, el mensaje de campaña enviado, y el destino de mtj.es decidido.

## 3. Secuencia recomendada 30/60/90

**DÍA 0 (esta semana, ~1h):**

- Tomar la prórroga del GATE 1 **por escrito** (la campaña del 29-jul cumplió la condición de la salida (b); falta formalizarla). Sin esto, todo lo demás es papel mojado.
- Mandar el mensaje al grupo pendiente desde el 29-jul — es la última bala de atención del verano, y ya se sabe qué venderá después: la apertura de /presupuestos.

**DÍAS 1-15 (~6-8h de Juan):**

- **Papel único con fecha dura y consecuencia**: condiciones de uso de /presupuestos + DPA art. 28 (sub-encargados Anthropic/Vercel/Neon, checkbox) + mini-acuerdo del dirigido + compromiso anti-hub + **la línea nueva del red-team**: qué circuito manda cuando el rail es de lavori y la factura de HBTJ. Fecha: publicado el día 15 o se contrata la revisión externa (300-600 EUR) ese mismo día. Es la TERCERA vez que se presupuesta como "una tarde".
- **Mini-acuerdo al 75%, no "≥70%"**: el padrón real ya paga 75% (margen 25% sobre 1.404 EUR). Formalizar por debajo de la práctica vigente rompe la confianza.
- **Kill-switch del bug de 40 EUR planos ANTES de publicar ningún post nicho nuevo** (restricción de orden, no de fechas: contenido no-FR nuevo escala la cotización a pérdida AR/NL mientras el bug viva).
- Código de la unión (~3-5h total): línea "traducción realizada y firmada por X, nº T-IJ Y" en /p/&lt;token&gt; cuando emisor≠firmante (costura A7) + **registrar precioCliente y margen en el dirigido** (el retoque que faltaba) + kill-switch.
- **mtj.es**: rotar las claves live (pendiente desde el 14-jul, es un pasivo de seguridad) y decidir: 301 a tj.net (regalo de autoridad gratis) o reserva formal. 30 minutos.

**DÍAS 15-45 — OPERAR (el hito, no el volumen):**

- Próximo pedido no-FR de tj.net: recotizar A MANO con mínimos (no-FR 50 EUR, AR 55) → dirigido a un colega vía /preguntas → pasar-a-encargo, CON precio en la fila → factura por circuito HBTJ. Sería el primer dirigido y el primer precio real de la historia (0 jamás). **Marcador 1: "círculo Juan" = señal de operación, NO del gate colectivo.** Con singleton (AR/DA/FA/RO): plazo de respuesta de 24h y plan B antes de dirigir (precedente Badri).
- Contenido en tj.net: vigilar indexación del post NL (3.934 impr/90d con 0 clics) y publicar SV/RO/homologación-título — solo tras el kill-switch.
- Abrir /presupuestos al tablón cuando el papel esté publicado (~1-2h, 5 gates `requireAdmin`→`requireMiembro` documentados en el código).

**DÍAS 30-90 — EL MOVIMIENTO QUE NADIE PUSO EN EL CAMINO CRÍTICO:**

- **Invitar 1-2 gestorías/despachos como miembro demanda.** Está construido de punta a punta y sin estrenar (`schema.ts` funcion='demanda', "Publicar un pedido", enrutado automático por lengua). Es la ÚNICA vía que alimenta el gate endurecido sin abrir nada al público: la gestoría publica pedidos (clientes de terceros) y los presupuestos los emiten colegas (autores no-Juan). **Marcador 2: "gate colectivo" = enlaces /p/ a clientes de terceros, ≥2 autores no-Juan** — la métrica original del 26-jul, sin mutar.
- Decidir precio fundador (9 EUR/mes vs 90/año) ANTES del segundo mensaje al grupo.
- Seguro RC: contratar **antes del primer dirigido de lengua que Juan no puede revisar**, no en los días 61-90 (la secuencia de A estaba invertida).

**DÍA 90 — decisión con dos marcadores separados:**

- Círculo Juan: ≥3 dirigidos con precio y margen facturado.
- Gate colectivo: ≥5 enlaces /p/ a clientes de terceros, ≥2 autores no-Juan.
- **MATAR si**: al día 60 sigue habiendo 0 dirigidos con ≥2 pedidos no-FR entrados (fallo de operación, no de diseño — el precedente son los 5 leads de mtj.es), o al día 90 el gate colectivo da &lt;2. Salida digna: tj.net negocio personal con su padrón (~78 EUR/mes de margen ya), lavori tablón gratuito, cero horas más en puentes.
- Solo si ambos marcadores dan vida: reabrir la conversación del directorio público (la parte limpia de C), con opt-in, protección anti-scraping del contacto, y sin tocar las lenguas singleton.

**Horas de Juan en 90 días: ~15-20h totales**, el grueso operar y WhatsApp, no construir.

## 4. Los números que sostienen la decisión

| Dato | Valor | Origen |
|---|---|---|
| SEO tj.net | 56 clics/28d (+44%), pos 34,9→28,7, 86-87 pág. indexadas | API GSC, context.md tj.net 28-jul |
| Demanda desatendida que coincide con capacidad nueva | NL 3.934 impr/90d 0 clics; SV ~990; RO 102; homologación 2.113 impr | GSC Consultas.csv + context.md:11,33 |
| tj.net como motor: escala honesta | 12 pedidos web históricos, 1.817 EUR, 0 repetidores, ~0,3/mes; overflow ~1,5 no-FR/mes | hoja-ruta-negocio-14-jul:25 |
| Circuito fiscal ya operativo | 1.404 EUR a 9 colaboradores en 2026, margen 25% (=75% al colega) | hoja-ruta:25,129 |
| lavori: uso real | 0 dirigidos jamás, 2 cruces, 0 precios reales en BD (las 2 filas con precio son pruebas) | storm-cerrar-circulo:29,36 verificado |
| lavori: diseño anti-SEO deliberado | 4 URLs indexables; comentario literal en sitemap.ts | src/app/sitemap.ts, robots.ts |
| SEO desde cero: probabilidad | 118 días de media para top-50; 5,7% de páginas nuevas en top-10 el primer año; ≥5 clones del censo MAEC ya rankeando; CBLingua 864 reseñas 4,9 | SISTRIX/Ahrefs vía dimensión SERPs |
| Coste código de la unión | ~3-5h (firmante en /p/ + precioCliente + kill-switch + 5 gates) | auditoría de código, dimensión 2 |
| Bug funnel | 40 EUR planos vs mínimos 50/55 EUR | storm-cerrar-circulo:30 |

## 5. Riesgos y prohibiciones que aplican

- **Prohibiciones vigentes intactas**: sin API tj.net→lavori (12 pedidos no la justifican); sin precio sugerido de datos agregados (hub-and-spoke, art. 1 LDC — precedentes ICAM 180.000 EUR, ICAB 500.000 EUR); sin tercer modelo fiscal híbrido; el sello jamás lleva marca (RD 724/2020: nombre, idioma y número, nada más).
- **Riesgo nº1 de esta vía: "Juan no-despachador"** — el simétrico del constructor. mtj.es murió con 5 leads desatendidos. Todo cuelga de contestar WhatsApps y recotizar a mano. El kill del día 60 existe para esto.
- **WhatsApp es el punto único de fallo real**: bloqueo por spam ya sufrido el 29-jul. Envíos escalonados, nada automatizado, y plan B por email escrito ANTES del próximo barrido.
- **Ventana sin seguro**: ningún dirigido de lengua no revisable por Juan antes de tener RC.
- **Lenguas singleton** (AR, DA, FA, RO×2, EL pendiente): una baja borra la lengua. No construir contenido público sobre capacidad N=1; en tj.net los posts son de HBTJ-agencia, no promesas de un jurado concreto.
- **Transparencia con el colectivo**: los miembros deben saber que un dirigido desde tj.net lleva margen HBTJ (el 75% lo hace defendible frente al ~66% de la agencia típica). Ocultarlo rompe el único activo de lavori.

## 6. Qué NO hacer

1. **NO crear SEO para lavori.es** — ni landing, ni directorio, ni "solo un experimento de 2 sesiones". La decisión queda cerrada 90 días; solo se reabre la variante directorio-puro si ambos marcadores dan vida.
2. **NO tocar sitemap.ts/robots.ts de lavori.**
3. **NO pedir el opt-in de fichas públicas al grupo** — es el tercer mensaje que quemaría el ask más delicado con la confianza más baja.
4. **NO publicar posts nicho nuevos en tj.net antes del kill-switch** del bug de 40 EUR.
5. **NO dirigir nada al precio del funnel** — todo pedido no-FR se recotiza a mano.
6. **NO acuñar más gates** — los dos marcadores de arriba y se acabó. El GATE 1 vencido se resuelve el día 0, no se sustituye.
7. **NO dejar mtj.es como está** — claves live sin rotar desde el 14-jul es un pasivo, no una opción aplazada.

## 7. La primera acción de MAÑANA

Dos líneas en `research/` o donde Juan quiera, pero **por escrito**: *"Tomo la prórroga del GATE 1 (salida b, condición cumplida con la campaña del 29-jul). Fecha dura del papel único: 15 de agosto — si ese día no está publicado, encargo la revisión externa esa misma tarde."* Y acto seguido, **mandar el mensaje al grupo** que se debe desde el 29-jul. Todo lo demás de este informe viene después de esas dos cosas.
