import test from "node:test";
import assert from "node:assert/strict";
import { altaHash, anulacionHash, verifyChainWithCut } from "../../lib/verifactu/hash.ts";
import { AeatDataError, buildEnvelope, countryToIso, registroXml, xmlEscape } from "../../lib/verifactu/aeat-xml.ts";
import { lineToResult, matchLines, parseAeatResponse } from "../../lib/verifactu/aeat-response.ts";
import type { ProviderSendInput } from "../../lib/verifactu/provider.ts";

const NIF = "B93712784";

function alta(over: Partial<ProviderSendInput> = {}): ProviderSendInput {
  const base = {
    emitterNif: NIF,
    numSerie: "26_041",
    issueDate: "16-10-2026",
    invoiceType: "F1",
    cuotaTotalCents: 2100,
    importeTotalCents: 12100,
    prevHash: null as string | null,
    generatedAtIso: "2026-10-16T10:00:00+02:00",
  };
  const merged = { ...base, ...over };
  const { hash } = altaHash({ ...merged, issueDate: merged.issueDate, generatedAt: merged.generatedAtIso, invoiceType: merged.invoiceType as any });
  return {
    recordId: "rec1",
    kind: "ALTA",
    vatRate: 0.21,
    recipient: { name: "Cliente SL", nif: "B12345674", country: "España" },
    hash,
    ...merged,
  } as ProviderSendInput;
}

const order = (xml: string, tags: string[]) => {
  let pos = -1;
  for (const t of tags) {
    const i = xml.indexOf(`<sf:${t}>`, pos + 1);
    assert.ok(i > pos, `${t} fuera de orden o ausente`);
    pos = i;
  }
};

test("F1 española: destinatario con NIF, desglose IVA 21 y primer registro", () => {
  const xml = registroXml(alta());
  order(xml, ["IDVersion", "IDFactura", "NombreRazonEmisor", "TipoFactura", "DescripcionOperacion", "Destinatarios", "Desglose", "CuotaTotal", "ImporteTotal", "Encadenamiento", "SistemaInformatico", "FechaHoraHusoGenRegistro", "TipoHuella", "Huella"]);
  assert.match(xml, /<sf:IDDestinatario><sf:NombreRazon>Cliente SL<\/sf:NombreRazon><sf:NIF>B12345674<\/sf:NIF>/);
  assert.match(xml, /<sf:ClaveRegimen>01<\/sf:ClaveRegimen><sf:CalificacionOperacion>S1<\/sf:CalificacionOperacion><sf:TipoImpositivo>21<\/sf:TipoImpositivo>/);
  assert.match(xml, /<sf:BaseImponibleOimporteNoSujeto>100\.00<\/sf:BaseImponibleOimporteNoSujeto><sf:CuotaRepercutida>21\.00<\/sf:CuotaRepercutida>/);
  assert.match(xml, /<sf:CuotaTotal>21\.00<\/sf:CuotaTotal><sf:ImporteTotal>121\.00<\/sf:ImporteTotal>/);
  assert.match(xml, /<sf:PrimerRegistro>S<\/sf:PrimerRegistro>/);
  assert.doesNotMatch(xml, /RegistroAnterior/);
  assert.match(xml, /<sf:DescripcionOperacion>Servicios de traducción jurada<\/sf:DescripcionOperacion>/);
  assert.match(xml, /<sf:TipoUsoPosibleSoloVerifactu>S<\/sf:TipoUsoPosibleSoloVerifactu><sf:TipoUsoPosibleMultiOT>N<\/sf:TipoUsoPosibleMultiOT><sf:IndicadorMultiplesOT>N/);
  assert.match(xml, /<sf:FechaHoraHusoGenRegistro>2026-10-16T10:00:00\+02:00<\/sf:FechaHoraHusoGenRegistro>/);
});

test("encadenado: RegistroAnterior con emisor, número, fecha y huella del anterior", () => {
  const prev = alta({ numSerie: "26_040" });
  const xml = registroXml(alta({ prevHash: prev.hash, prev: { emitterNif: NIF, numSerie: "26_040", issueDate: "15-10-2026" } }));
  assert.match(xml, new RegExp(`<sf:RegistroAnterior><sf:IDEmisorFactura>${NIF}</sf:IDEmisorFactura><sf:NumSerieFactura>26_040</sf:NumSerieFactura><sf:FechaExpedicionFactura>15-10-2026</sf:FechaExpedicionFactura><sf:Huella>${prev.hash}</sf:Huella></sf:RegistroAnterior>`));
  assert.doesNotMatch(xml, /PrimerRegistro/);
  assert.throws(() => registroXml(alta({ prevHash: prev.hash, prev: null })), AeatDataError);
});

test("F2 simplificada: sin Destinatarios aunque haya datos de cliente", () => {
  const xml = registroXml(alta({ invoiceType: "F2", recipient: null }));
  assert.doesNotMatch(xml, /Destinatarios/);
  assert.match(xml, /<sf:TipoFactura>F2<\/sf:TipoFactura>/);
});

test("F1 extranjera: IDOtro 02 con NIF-IVA UE, 06 para el resto, error si no hay país o ID", () => {
  const de = registroXml(alta({ recipient: { name: "Kunde GmbH", nif: "DE 811.115.368", country: "Alemania" } }));
  assert.match(de, /<sf:IDOtro><sf:CodigoPais>DE<\/sf:CodigoPais><sf:IDType>02<\/sf:IDType><sf:ID>DE811115368<\/sf:ID><\/sf:IDOtro>/);
  const gr = registroXml(alta({ recipient: { name: "Pelatis", nif: "EL123456789", country: "Grecia" } }));
  assert.match(gr, /<sf:CodigoPais>GR<\/sf:CodigoPais><sf:IDType>02<\/sf:IDType>/);
  const ma = registroXml(alta({ recipient: { name: "Client Maroc", nif: "AB123456", country: "Marruecos" } }));
  assert.match(ma, /<sf:CodigoPais>MA<\/sf:CodigoPais><sf:IDType>06<\/sf:IDType><sf:ID>AB123456<\/sf:ID>/);
  const fr = registroXml(alta({ recipient: { name: "Client", nif: "12345", country: "France" } }));
  assert.match(fr, /<sf:IDType>06<\/sf:IDType>/, "un ID sin prefijo de país no es NIF-IVA");
  assert.throws(() => registroXml(alta({ recipient: { name: "X", nif: "123", country: "Narnia" } })), /no reconocido/);
  assert.throws(() => registroXml(alta({ recipient: { name: "X", nif: "", country: "Francia" } })), /NIF/);
  assert.throws(() => registroXml(alta({ recipient: { name: "X", nif: "123", country: "España" } })), /NIF español/);
  assert.throws(() => registroXml(alta({ recipient: null })), AeatDataError);
});

test("país texto libre → ISO 3166-1 alfa-2", () => {
  assert.equal(countryToIso("España"), "ES");
  assert.equal(countryToIso(" Spain "), "ES");
  assert.equal(countryToIso("EE.UU."), "US");
  assert.equal(countryToIso("Reino Unido"), "GB");
  assert.equal(countryToIso("Países Bajos"), "NL");
  assert.equal(countryToIso("fr"), "FR");
  assert.equal(countryToIso(""), "ES");
  assert.equal(countryToIso("Narnia"), null);
});

test("R1: rectificativa por diferencias con la factura rectificada; sin ella no se envía", () => {
  const xml = registroXml(alta({ invoiceType: "R1", cuotaTotalCents: -2100, importeTotalCents: -12100, rectifies: { numSerie: "26_030", issueDate: "01-10-2026" } }));
  order(xml, ["TipoFactura", "TipoRectificativa", "FacturasRectificadas", "DescripcionOperacion"]);
  assert.match(xml, /<sf:TipoRectificativa>I<\/sf:TipoRectificativa>/);
  assert.match(xml, /<sf:IDFacturaRectificada><sf:IDEmisorFactura>B93712784<\/sf:IDEmisorFactura><sf:NumSerieFactura>26_030<\/sf:NumSerieFactura><sf:FechaExpedicionFactura>01-10-2026<\/sf:FechaExpedicionFactura>/);
  assert.match(xml, /<sf:BaseImponibleOimporteNoSujeto>-100\.00<\/sf:BaseImponibleOimporteNoSujeto><sf:CuotaRepercutida>-21\.00<\/sf:CuotaRepercutida>/);
  assert.throws(() => registroXml(alta({ invoiceType: "R1", rectifies: null })), /rectificada/);
});

test("IVA 0 %: no se inventa un desglose", () => {
  assert.throws(() => registroXml(alta({ vatRate: 0, cuotaTotalCents: 0, importeTotalCents: 10000 })), /IVA/);
});

test("anulación: IDFacturaAnulada, huella y SinRegistroPrevio solo si procede", () => {
  const g = "2026-10-17T09:00:00+02:00";
  const { hash } = anulacionHash({ emitterNif: NIF, numSerie: "26_041", issueDate: "16-10-2026", prevHash: null, generatedAt: g });
  const base: ProviderSendInput = { recordId: "rec2", kind: "ANULACION", emitterNif: NIF, numSerie: "26_041", issueDate: "16-10-2026", invoiceType: "", cuotaTotalCents: 0, importeTotalCents: 0, hash, prevHash: null, generatedAtIso: g };
  const xml = registroXml(base);
  assert.match(xml, /<sf:RegistroAnulacion>/);
  assert.match(xml, /<sf:IDFactura><sf:IDEmisorFacturaAnulada>B93712784<\/sf:IDEmisorFacturaAnulada><sf:NumSerieFacturaAnulada>26_041<\/sf:NumSerieFacturaAnulada><sf:FechaExpedicionFacturaAnulada>16-10-2026<\/sf:FechaExpedicionFacturaAnulada>/);
  assert.doesNotMatch(xml, /SinRegistroPrevio|Desglose|Destinatarios/);
  order(xml, ["IDVersion", "IDFactura", "RefExterna", "Encadenamiento", "SistemaInformatico", "FechaHoraHusoGenRegistro", "TipoHuella", "Huella"]);
  assert.match(registroXml({ ...base, sinRegistroPrevio: true }), /<sf:SinRegistroPrevio>S<\/sf:SinRegistroPrevio>/);
});

test("sobre SOAP: cabecera del obligado, N registros, un solo emisor, escape XML", () => {
  const env = buildEnvelope([alta({ recipient: { name: "A & B <Co> \"x\"", nif: "B12345674", country: "España" } }), alta({ numSerie: "26_042" })]);
  assert.match(env, /^<\?xml version="1.0" encoding="UTF-8"\?><soapenv:Envelope/);
  assert.match(env, /<sum:Cabecera><sf:ObligadoEmision><sf:NombreRazon>HBTJ CONSULTORES LINGÜISTICOS SL<\/sf:NombreRazon><sf:NIF>B93712784<\/sf:NIF>/);
  assert.equal((env.match(/<sum:RegistroFactura>/g) || []).length, 2);
  assert.ok(env.includes("A &amp; B &lt;Co&gt; &quot;x&quot;"));
  assert.equal(xmlEscape("a&b"), "a&amp;b");
  assert.throws(() => buildEnvelope([]), AeatDataError);
  assert.throws(() => buildEnvelope([alta(), alta({ emitterNif: "A00000000" })]), AeatDataError);
});

// ── Respuesta ───────────────────────────────────────────────────────────────────
const wrap = (inner: string) =>
  `<?xml version="1.0"?><env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><tikR:RespuestaRegFactuSistemaFacturacion xmlns:tikR="https://x/RespuestaSuministro.xsd" xmlns:tik="https://x/SuministroInformacion.xsd">${inner}</tikR:RespuestaRegFactuSistemaFacturacion></env:Body></env:Envelope>`;
const linea = (num: string, estado: string, extra = "", ref = "") =>
  `<tikR:RespuestaLinea><tikR:IDFactura><tik:IDEmisorFactura>B93712784</tik:IDEmisorFactura><tik:NumSerieFactura>${num}</tik:NumSerieFactura><tik:FechaExpedicionFactura>16-10-2026</tik:FechaExpedicionFactura></tikR:IDFactura><tikR:Operacion><tik:TipoOperacion>Alta</tik:TipoOperacion></tikR:Operacion>${ref}<tikR:EstadoRegistro>${estado}</tikR:EstadoRegistro>${extra}</tikR:RespuestaLinea>`;

test("respuesta: Correcto con CSV y tiempo de espera", () => {
  const r = parseAeatResponse(wrap(`<tikR:CSV>A-N3E6X2ETYC9NMN</tikR:CSV><tikR:TiempoEsperaEnvio>60</tikR:TiempoEsperaEnvio><tikR:EstadoEnvio>Correcto</tikR:EstadoEnvio>${linea("26_041", "Correcto", "", "<tikR:RefExterna>rec1</tikR:RefExterna>")}`));
  assert.equal(r.estadoEnvio, "Correcto");
  assert.equal(r.csv, "A-N3E6X2ETYC9NMN");
  assert.equal(r.tiempoEsperaEnvio, 60);
  assert.equal(r.lines.length, 1);
  assert.equal(r.lines[0].numSerie, "26_041");
  assert.equal(r.lines[0].refExterna, "rec1");
  const res = lineToResult(r.lines[0], r.csv);
  assert.equal(res.status, "ACCEPTED");
  assert.equal(res.providerRef, "A-N3E6X2ETYC9NMN");
});

test("respuesta: AceptadoConErrores e Incorrecto con código y descripción", () => {
  const r = parseAeatResponse(
    wrap(
      `<tikR:CSV>A-X</tikR:CSV><tikR:TiempoEsperaEnvio>60</tikR:TiempoEsperaEnvio><tikR:EstadoEnvio>ParcialmenteCorrecto</tikR:EstadoEnvio>` +
        linea("26_041", "AceptadoConErrores", "<tikR:CodigoErrorRegistro>2007</tikR:CodigoErrorRegistro><tikR:DescripcionErrorRegistro>No debe informarse como primer registro</tikR:DescripcionErrorRegistro>") +
        linea("26_042", "Incorrecto", "<tikR:CodigoErrorRegistro>1239</tikR:CodigoErrorRegistro><tikR:DescripcionErrorRegistro>El valor del campo ID es incorrecto &amp; mal</tikR:DescripcionErrorRegistro>")
    )
  );
  const [a, b] = r.lines.map((l) => lineToResult(l, r.csv));
  assert.equal(a.status, "ACCEPTED_WITH_ERRORS");
  assert.match(a.error!, /2007/);
  assert.equal(b.status, "REJECTED");
  assert.equal(b.providerRef, null);
  assert.equal(b.error, "1239: El valor del campo ID es incorrecto & mal");
});

test("respuesta: duplicado ya almacenado como Correcta se acepta; Anulada sigue rechazado", () => {
  const dup = (estado: string) =>
    `<tikR:RegistroDuplicado><tik:IdPeticionRegistroDuplicado>PET1</tik:IdPeticionRegistroDuplicado><tik:EstadoRegistroDuplicado>${estado}</tik:EstadoRegistroDuplicado></tikR:RegistroDuplicado>`;
  const mk = (estado: string) =>
    parseAeatResponse(wrap(`<tikR:EstadoEnvio>Incorrecto</tikR:EstadoEnvio>${linea("26_041", "Incorrecto", `<tikR:CodigoErrorRegistro>3000</tikR:CodigoErrorRegistro><tikR:DescripcionErrorRegistro>Registro duplicado</tikR:DescripcionErrorRegistro>${dup(estado)}`)}`));
  const ok = mk("Correcta");
  assert.equal(ok.lines[0].duplicado?.estado, "Correcta");
  assert.equal(ok.lines[0].codigoError, "3000", "el código del registro no se mezcla con el del duplicado");
  assert.equal(lineToResult(ok.lines[0], null).status, "ACCEPTED");
  assert.equal(lineToResult(mk("AceptadaConErrores").lines[0], null).status, "ACCEPTED_WITH_ERRORS");
  assert.equal(lineToResult(mk("Anulada").lines[0], null).status, "REJECTED");
});

test("respuesta: SOAP Fault y casado de líneas por RefExterna o número+operación", () => {
  const f = parseAeatResponse(`<env:Envelope xmlns:env="x"><env:Body><env:Fault><faultcode>env:Client</faultcode><faultstring>Certificado no válido</faultstring></env:Fault></env:Body></env:Envelope>`);
  assert.equal(f.fault, "Certificado no válido");
  assert.equal(f.estadoEnvio, null);

  const lines = parseAeatResponse(wrap(`<tikR:EstadoEnvio>Correcto</tikR:EstadoEnvio>${linea("B", "Correcto", "", "<tikR:RefExterna>r2</tikR:RefExterna>")}${linea("A", "Incorrecto", "", "<tikR:RefExterna>r1</tikR:RefExterna>")}`)).lines;
  const m = matchLines([{ recordId: "r1", numSerie: "A", kind: "ALTA" }, { recordId: "r2", numSerie: "B", kind: "ALTA" }], lines);
  assert.equal(m[0]?.estadoRegistro, "Incorrecto");
  assert.equal(m[1]?.estadoRegistro, "Correcto");
  const sinRef = matchLines([{ numSerie: "A", kind: "ALTA" }, { numSerie: "A", kind: "ANULACION" }], [lines[1]]);
  assert.ok(sinRef[0]);
  assert.equal(sinRef[1], null, "la misma línea no se casa dos veces");
});

// ── Corte de cadena ─────────────────────────────────────────────────────────────
function row(n: number, prevHash: string | null, sendStatus: string) {
  const { canonical, hash } = altaHash({ emitterNif: NIF, numSerie: `26_0${n}`, issueDate: "16-10-2026", invoiceType: "F1", cuotaTotalCents: 100, importeTotalCents: 600, prevHash, generatedAt: `2026-10-16T10:00:0${n}+02:00` });
  return { canonical, hash, prevHash, sendStatus };
}

test("cadena con corte: el primer no-LOCAL con prevHash vacío reinicia; LOCAL siguen su cadena", () => {
  const l1 = row(1, null, "LOCAL");
  const l2 = row(2, l1.hash, "LOCAL");
  const p3 = row(3, null, "PENDING"); // corte: primer registro enviado
  const p4 = row(4, p3.hash, "ACCEPTED");
  assert.equal(verifyChainWithCut([l1, l2, p3, p4]), -1);
  // El corte solo vale una vez: otro no-LOCAL con prevHash vacío después es una ruptura.
  const p5 = row(5, null, "PENDING");
  assert.equal(verifyChainWithCut([l1, l2, p3, p4, p5]), 4);
  // Sin corte (histórico LOCAL puro) sigue siendo la verificación de siempre.
  assert.equal(verifyChainWithCut([l1, l2]), -1);
  assert.equal(verifyChainWithCut([l1, row(2, "DEADBEEF", "LOCAL")]), 1);
  // Huella manipulada.
  assert.equal(verifyChainWithCut([l1, { ...l2, hash: "00" }]), 1);
  // Un no-LOCAL encadenado al LOCAL anterior (proveedor activado sin corte) también es válido.
  assert.equal(verifyChainWithCut([l1, row(2, l1.hash, "PENDING")]), -1);
});

// ── Arreglos de la revisión ─────────────────────────────────────────────────────
import { anulacionSinRegistroPrevio, shouldChain, subsanacionFlags, unresolvedRejected } from "../../lib/verifactu/hash.ts";
import { pdfEnvMatches, verifactuEnv } from "../../lib/verifactu/provider.ts";
import { validateAltaData } from "../../lib/verifactu/aeat-xml.ts";

test("verifactuEnv: fail-closed en producción de Vercel", () => {
  const saved = { v: process.env.VERCEL_ENV, e: process.env.VERIFACTU_ENV };
  try {
    process.env.VERCEL_ENV = "production";
    delete process.env.VERIFACTU_ENV;
    assert.throws(() => verifactuEnv(), /VERIFACTU_ENV/);
    process.env.VERIFACTU_ENV = "Prod";
    assert.throws(() => verifactuEnv(), /exactamente/);
    process.env.VERIFACTU_ENV = "prod";
    assert.equal(verifactuEnv(), "prod");
    process.env.VERIFACTU_ENV = "test";
    assert.equal(verifactuEnv(), "test");
    process.env.VERCEL_ENV = "development";
    delete process.env.VERIFACTU_ENV;
    assert.equal(verifactuEnv(), "test", "fuera de producción cae a pruebas");
  } finally {
    if (saved.v === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = saved.v;
    if (saved.e === undefined) delete process.env.VERIFACTU_ENV;
    else process.env.VERIFACTU_ENV = saved.e;
  }
});

test("PDF: QR solo si el entorno guardado coincide con el actual", () => {
  assert.equal(pdfEnvMatches("prod", "prod"), true);
  assert.equal(pdfEnvMatches("test", "prod"), false);
  assert.equal(pdfEnvMatches(undefined, "test"), false);
  assert.equal(pdfEnvMatches(null, "prod"), false);
});

test("modo cadena: nunca LOCAL tras el primer no-LOCAL aunque falte el proveedor", () => {
  assert.equal(shouldChain(true, false), true);
  assert.equal(shouldChain(false, true), true);
  assert.equal(shouldChain(false, false), false);
});

test("validación al emitir: la misma que el XML", () => {
  const ok = { invoiceType: "F1", vatRate: 0.21, recipient: { name: "X SL", nif: "B12345674", country: "España" } };
  assert.doesNotThrow(() => validateAltaData(ok));
  assert.throws(() => validateAltaData({ ...ok, vatRate: 0 }), /IVA/);
  assert.throws(() => validateAltaData({ ...ok, recipient: { name: "X", nif: "123", country: "Narnia" } }), /no reconocido/);
  assert.throws(() => validateAltaData({ ...ok, recipient: { name: "X", nif: "", country: "Francia" } }), /NIF/);
  assert.throws(() => validateAltaData({ ...ok, recipient: null }), AeatDataError);
  assert.throws(() => validateAltaData({ ...ok, invoiceType: "R1", hasRectified: false }), /rectificada/);
  assert.doesNotThrow(() => validateAltaData({ invoiceType: "F2", vatRate: 0.21, recipient: null }), "la simplificada no pide destinatario");
  assert.doesNotThrow(() => validateAltaData({ invoiceType: "R5", vatRate: 0.21, recipient: null, hasRectified: true }));
});

test("mapa de países ampliado: Latinoamérica, variantes con y sin tilde y puntos", () => {
  const casos: [string, string][] = [
    ["Estados Unidos de América", "US"], ["Estados Unidos de America", "US"], ["United States of America", "US"], ["E.E.U.U.", "US"], ["EE. UU.", "US"],
    ["UK", "GB"], ["Reino Unido", "GB"], ["México", "MX"], ["Perú", "PE"], ["Panamá", "PA"], ["República Dominicana", "DO"], ["Uruguay", "UY"],
    ["Venezuela", "VE"], ["Chile", "CL"], ["Ecuador", "EC"], ["Bolivia", "BO"], ["Paraguay", "PY"], ["Costa Rica", "CR"], ["El Salvador", "SV"],
    ["Guatemala", "GT"], ["Honduras", "HN"], ["Nicaragua", "NI"], ["Cuba", "CU"], ["Colombia", "CO"], ["Argentina", "AR"], ["Brasil", "BR"],
    ["Côte d'Ivoire", "CI"], ["Türkiye", "TR"], ["Arabia Saudí", "SA"],
  ];
  for (const [txt, iso] of casos) assert.equal(countryToIso(txt), iso, txt);
});

test("R5: la rectificativa de una simplificada no lleva destinatario", () => {
  const xml = registroXml(alta({ invoiceType: "R5", recipient: null, cuotaTotalCents: -2100, importeTotalCents: -12100, rectifies: { numSerie: "26_030", issueDate: "01-10-2026" } }));
  assert.match(xml, /<sf:TipoFactura>R5<\/sf:TipoFactura><sf:TipoRectificativa>I/);
  assert.doesNotMatch(xml, /Destinatarios/);
  const conDatos = registroXml(alta({ invoiceType: "R5", recipient: { name: "X", nif: "B12345674", country: "España" }, rectifies: { numSerie: "26_030", issueDate: "01-10-2026" } }));
  assert.doesNotMatch(conDatos, /Destinatarios/, "aunque vengan datos, R5 no los envía");
});

test("subsanación: Subsanacion=S y RechazoPrevio=X solo si el anterior se rechazó", () => {
  assert.deepEqual(subsanacionFlags([]), { subsanacion: false, rechazoPrevio: false });
  assert.deepEqual(subsanacionFlags(["REJECTED"]), { subsanacion: true, rechazoPrevio: true });
  assert.deepEqual(subsanacionFlags(["REJECTED", "REJECTED"]), { subsanacion: true, rechazoPrevio: true });
  assert.deepEqual(subsanacionFlags(["ACCEPTED_WITH_ERRORS"]), { subsanacion: true, rechazoPrevio: false });
  const rech = registroXml(alta({ subsanacion: true, rechazoPrevio: true }));
  order(rech, ["NombreRazonEmisor", "Subsanacion", "RechazoPrevio", "TipoFactura"]);
  const sola = registroXml(alta({ subsanacion: true }));
  assert.match(sola, /<sf:Subsanacion>S<\/sf:Subsanacion><sf:TipoFactura>/);
  assert.doesNotMatch(sola, /RechazoPrevio/);
  assert.doesNotMatch(registroXml(alta()), /Subsanacion/);
});

test("cadena bloqueada solo por rechazados SIN subsanar", () => {
  const rej = [{ invoiceId: "a", chainIndex: 3 }, { invoiceId: "b", chainIndex: 5 }];
  assert.equal(unresolvedRejected(rej, []).length, 2);
  assert.deepEqual(unresolvedRejected(rej, [{ invoiceId: "a", chainIndex: 9 }]).map((r) => r.invoiceId), ["b"]);
  assert.equal(unresolvedRejected(rej, [{ invoiceId: "a", chainIndex: 2 }]).length, 2, "un alta ANTERIOR no releva al rechazado");
});

test("anulación: SinRegistroPrevio si ningún alta está registrado (LOCAL o REJECTED)", () => {
  assert.equal(anulacionSinRegistroPrevio(["LOCAL"]), true);
  assert.equal(anulacionSinRegistroPrevio(["REJECTED"]), true);
  assert.equal(anulacionSinRegistroPrevio(["REJECTED", "ACCEPTED"]), false);
  assert.equal(anulacionSinRegistroPrevio(["ACCEPTED_WITH_ERRORS"]), false);
  assert.equal(anulacionSinRegistroPrevio([]), true);
});
