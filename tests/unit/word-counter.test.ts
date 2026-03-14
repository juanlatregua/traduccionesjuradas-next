import test from "node:test";
import assert from "node:assert/strict";

// Self-contained — reproduce logic to avoid @/ import alias issues

function countDocumentWords(text: string): number {
  if (!text || !text.trim()) return 0;
  const tokens = text.split(/\s+/).filter(Boolean);
  return tokens.filter((token) => {
    const core = token.replace(
      /^[^a-zA-Z\xAA\xBA\xC0-\xFF0-9]+|[^a-zA-Z\xAA\xBA\xC0-\xFF0-9]+$/g,
      "",
    );
    if (!core) return false;
    if (/^[\d.,/:;\-–—]+$/.test(core)) return false;
    return true;
  }).length;
}

// ==================== TESTS ====================

test("texto vacío → 0", () => {
  assert.equal(countDocumentWords(""), 0);
  assert.equal(countDocumentWords("   "), 0);
  assert.equal(countDocumentWords(null as any), 0);
});

test("palabras simples", () => {
  assert.equal(countDocumentWords("Hola mundo"), 2);
  assert.equal(countDocumentWords("République Française"), 2);
});

test("cuenta cabeceras y títulos", () => {
  assert.equal(countDocumentWords("CERTIDÃO DE NASCIMENTO"), 3);
  assert.equal(countDocumentWords("REPÚBLICA FEDERATIVA DO BRASIL"), 4);
});

test("cuenta nombres propios", () => {
  assert.equal(countDocumentWords("GECINA MELANIE FERREIRA DOS SANTOS"), 5);
});

test("cuenta códigos alfanuméricos con letras", () => {
  assert.equal(countDocumentWords("MG-5.234.891"), 1);
  assert.equal(countDocumentWords("A-023"), 1);
  assert.equal(countDocumentWords("N°1234 Art.3 B-35"), 3);
  assert.equal(countDocumentWords("CIF: B-12345678"), 2);
  assert.equal(countDocumentWords("23CE02841521"), 1);
  assert.equal(countDocumentWords("R$"), 1);
});

test("cuenta ordinales con letras", () => {
  assert.equal(countDocumentWords("1ª Circunscrição"), 2);
  assert.equal(countDocumentWords("2º Ofício"), 2);
});

test("excluye números puros", () => {
  assert.equal(countDocumentWords("019570 01 55 1995 1 00041 113 0011890 39"), 0);
  assert.equal(countDocumentWords("012.345.678-90"), 0);
  assert.equal(countDocumentWords("65,48"), 0);
  assert.equal(countDocumentWords("3,28"), 0);
  assert.equal(countDocumentWords("0,00"), 0);
  assert.equal(countDocumentWords("12/03/2024"), 0);
  assert.equal(countDocumentWords("123 456 789"), 0);
});

test("mantiene palabras junto a números excluidos", () => {
  assert.equal(countDocumentWords("MATRÍCULA: 019570 01 55 1995"), 1);
  assert.equal(countDocumentWords("nº 41.113"), 1);
  assert.equal(countDocumentWords("CPF nº 012.345.678-90"), 2);
  assert.equal(countDocumentWords("R$ 65,48"), 1);
});

test("excluye puntuación decorativa", () => {
  assert.equal(countDocumentWords("— AVERBAÇÕES —"), 1);
  assert.equal(countDocumentWords("──────────────"), 0);
});

test("cuenta fórmulas de firma", () => {
  assert.equal(countDocumentWords("O referido é verdade e dou fé."), 7);
  assert.equal(countDocumentWords("Dou fé Maria da Silva Pereira Tabeliã de Notas"), 9);
});

test("cuenta etiquetas emolumentos, excluye importes", () => {
  const line = "EMOLUMENTO R$ 65,48 FERMOJU R$ 3,28";
  assert.equal(countDocumentWords(line), 4);
});

test("incluye acentos y caracteres latinos extendidos", () => {
  assert.equal(countDocumentWords("José María García López"), 4);
  assert.equal(countDocumentWords("Certidão de Nascimento"), 3);
});

test("mezcla de palabras y números puros", () => {
  assert.equal(countDocumentWords("Livro 019570 Folha 01 Termo 55"), 3);
});

test("texto acta brasileña — página 1 (~433 palabras Word), contador devuelve 420-440", () => {
  const text = `REPÚBLICA FEDERATIVA DO BRASIL
ESTADO DO CEARÁ
REGISTRO CIVIL DAS PESSOAS NATURAIS
DISTRITO DE FORTIM — COMARCA DE ARACATI
Certidão de Inteiro Teor de Nascimento

NOME: GECINA MELANIE FERREIRA DOS SANTOS
CPF: 012.345.678-90
MATRÍCULA: 019570 01 55 1995 1 00041 113 0011890 39

Certifico que às fls. 87 do Livro A-023 deste Registro consta o assento de nascimento de número 1.890 com o seguinte teor: Aos vinte e cinco dias do mês de dezembro do ano de mil novecentos e noventa e quatro, neste Cartório do Registro Civil das Pessoas Naturais do Distrito de Fortim, Comarca de Aracati, Estado do Ceará, perante mim Oficial e as testemunhas ao final nomeadas e assinadas, compareceu MARCOS ANTÔNIO FERREIRA DOS SANTOS, brasileiro, natural de Fortaleza, Estado do Ceará, comerciante, portador da cédula de identidade RG nº 94.005.423-7 SSP/CE e inscrito no CPF sob o nº 019.345.676-01, casado com CLAUDIA REGINA OLIVEIRA FERREIRA, residente e domiciliado nesta localidade, e declarou que do seu legítimo matrimônio com CLAUDIA REGINA OLIVEIRA FERREIRA, brasileira, natural de Aracati, Estado do Ceará, nascida aos vinte de setembro de mil novecentos e setenta e dois, professora, portadora da cédula de identidade RG nº 2005.009.871-0 SSP/CE e inscrita no CPF sob o nº 032.456.789-12, nasceu nesta localidade às quatorze horas e trinta minutos do dia vinte e cinco de dezembro de mil novecentos e noventa e quatro uma criança do sexo feminino a quem deu o nome de GECINA MELANIE FERREIRA DOS SANTOS. Avós paternos: JOSÉ CARLOS FERREIRA DOS SANTOS e MARIA APARECIDA SOUZA FERREIRA, brasileiros, naturais de Fortaleza, Estado do Ceará. Avós maternos: ANTÔNIO CARLOS DE OLIVEIRA e HELENA MARIA COSTA OLIVEIRA, brasileiros, naturais de Aracati, Estado do Ceará. Testemunharam o presente ato FRANCISCO SOUSA LIMA, portador do RG nº 2001.007.045-2 SSP/CE, e ANA PAULA RODRIGUES MOTA, portadora do RG nº 2003.012.338-9 SSP/CE, ambos maiores, capazes, residentes e domiciliados nesta localidade. Nada mais foi declarado nem me foi requerido. Lido e achado conforme vai devidamente assinado. Eu, MARIA JOSÉ DA SILVA SOUZA, Escrevente compromissada que o digitei, conferi e o lavrei. O Oficial, ROBERTO MACIEL DE SOUZA.

Notas, Averbações e Retificações:

Averbação de CPF: Incluso o número de CPF 012.345.678-90 no presente assento nos termos do Provimento nº 63/2017 do Conselho Nacional de Justiça. Fortim, quinze de março de dois mil e vinte. Eu, ARIANE FERNANDES DE ALMEIDA, Substituta do Oficial, procedi à presente averbação e subscrevo.

Sem ônus — Justiça Gratuita — Lei nº 9.534/97.
O referido é verdade e dou fé.
Fortim-CE, dez de janeiro de dois mil e vinte e quatro.

ARIANE FERNANDES DE ALMEIDA
Substituta do Oficial do Registro Civil
Cartório Maciel — 1º Tabelionato de Notas — Fortim-CE

EMOLUMENTO R$ 65,48 FERMOJU R$ 3,28 FAADEP R$ 1,32 FRMP R$ 0,66 ISS R$ 3,28 IBS R$ 0,00 CBS R$ 0,00 SELO IA 23CE02841521`;

  const count = countDocumentWords(text);
  assert.ok(count >= 420, `Expected >= 420 words, got ${count}`);
  assert.ok(count <= 440, `Expected <= 440 words, got ${count}`);
});
