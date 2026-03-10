// lib/draft-docx.ts — Genera borrador DOCX de traducción jurada a partir del JSON de Claude

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  Footer,
  PageNumber,
  SectionType,
  convertMillimetersToTwip,
} from "docx";
import type { TranslationDraftResult } from "./translation-prompts";

const FONT = "Times New Roman";
const FONT_SIZE = 20; // half-points (10pt = 20)
const MARGIN_MM = 18;
const MARGIN_TWIP = convertMillimetersToTwip(MARGIN_MM);

function heading(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [
      new TextRun({ text, bold: true, font: FONT, size: FONT_SIZE + 4 }),
    ],
  });
}

function sectionTitle(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 300, after: 200 },
    children: [
      new TextRun({ text, bold: true, underline: {}, font: FONT, size: FONT_SIZE }),
    ],
  });
}

function bodyParagraph(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: convertMillimetersToTwip(8) },
    spacing: { after: 120 },
    children: [
      new TextRun({ text, font: FONT, size: FONT_SIZE }),
    ],
  });
}

function emptyLine(): Paragraph {
  return new Paragraph({ spacing: { after: 100 }, children: [] });
}

const INVISIBLE_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = {
  top: INVISIBLE_BORDER,
  bottom: INVISIBLE_BORDER,
  left: INVISIBLE_BORDER,
  right: INVISIBLE_BORDER,
};

function makeFooter(parsed: TranslationDraftResult): Footer {
  const code = parsed.codigo_verificacion || "—";
  const date = parsed.fecha_documento || "—";
  const firmantes = parsed.firmantes.length > 0 ? parsed.firmantes : ["—"];

  const rows: TableRow[] = [
    new TableRow({
      children: [
        new TableCell({
          borders: NO_BORDERS,
          width: { size: 25, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: "Code", bold: true, font: FONT, size: 14 })] })],
        }),
        new TableCell({
          borders: NO_BORDERS,
          width: { size: 25, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: code, font: FONT, size: 14 })] })],
        }),
        new TableCell({
          borders: NO_BORDERS,
          width: { size: 25, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: "DATE", bold: true, font: FONT, size: 14 })] })],
        }),
        new TableCell({
          borders: NO_BORDERS,
          width: { size: 25, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: date, font: FONT, size: 14 })] })],
        }),
      ],
    }),
  ];

  for (const f of firmantes) {
    rows.push(
      new TableRow({
        children: [
          new TableCell({
            borders: NO_BORDERS,
            children: [new Paragraph({ children: [new TextRun({ text: "SIGNÉ PAR", bold: true, font: FONT, size: 14 })] })],
          }),
          new TableCell({
            borders: NO_BORDERS,
            columnSpan: 3,
            children: [new Paragraph({ children: [new TextRun({ text: f, font: FONT, size: 14 })] })],
          }),
        ],
      })
    );
  }

  // Page number row
  rows.push(
    new TableRow({
      children: [
        new TableCell({
          borders: NO_BORDERS,
          columnSpan: 3,
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: "Borrador IA — traduccionesjuradas.net nº 3850", font: FONT, size: 12, italics: true }),
              ],
            }),
          ],
        }),
        new TableCell({
          borders: NO_BORDERS,
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({ text: "PÁGINA ", font: FONT, size: 12 }),
                new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 12 }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  return new Footer({
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows,
      }),
    ],
  });
}

function certificationBlock(direccion: "ES→FR" | "FR→ES"): Paragraph[] {
  const certFR = `Juan Silva Moreno, Traducteur-Interprète Assermenté de français n° 3850, nommé par le Ministère des Affaires Étrangères, de l'Union Européenne et de la Coopération d'Espagne, certifie que la présente traduction est fidèle et complète par rapport au document original rédigé en langue ${direccion === "ES→FR" ? "espagnole" : "française"}.\nFait à Málaga, le ___ de _______________ de 20__.`;

  const certES = `D. Juan Silva Moreno, Traductor-Intérprete Jurado de Francés nº 3850, nombrado por el Ministerio de Asuntos Exteriores, Unión Europea y Cooperación, certifica que la que antecede es traducción fiel y completa al ${direccion === "ES→FR" ? "francés" : "español"} de un documento redactado en ${direccion === "ES→FR" ? "español" : "francés"}.\nHecho en Málaga, el ___ de _______________ de 20__.`;

  return [
    emptyLine(),
    new Paragraph({
      spacing: { before: 400 },
      children: [
        new TextRun({ text: "CERTIFICATION / CERTIFICACIÓN", bold: true, font: FONT, size: FONT_SIZE }),
      ],
      alignment: AlignmentType.CENTER,
    }),
    emptyLine(),
    new Paragraph({
      children: [],
    }),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      children: [new TextRun({ text: certFR, font: FONT, size: FONT_SIZE - 2, italics: true })],
    }),
    emptyLine(),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      children: [new TextRun({ text: certES, font: FONT, size: FONT_SIZE - 2 })],
    }),
    emptyLine(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200 },
      children: [new TextRun({ text: "[Firma y sello]", font: FONT, size: FONT_SIZE - 2, italics: true })],
    }),
  ];
}

export async function generateDraftDocx(
  parsed: TranslationDraftResult,
  direccion: "ES→FR" | "FR→ES"
): Promise<Buffer> {
  const children: Paragraph[] = [];

  // Draft watermark
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: "⚠ BORRADOR GENERADO POR IA — PENDIENTE DE REVISIÓN",
          bold: true,
          color: "CC0000",
          font: FONT,
          size: FONT_SIZE + 2,
        }),
      ],
    })
  );

  // Title
  const mainTitle = direccion === "ES→FR" ? "TRADUCTION ASSERMENTÉE" : "TRADUCCIÓN JURADA";
  children.push(heading(mainTitle));

  // Tribunal / organism
  if (parsed.tribunal_organismo) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [
          new TextRun({ text: parsed.tribunal_organismo, italics: true, font: FONT, size: FONT_SIZE }),
        ],
      })
    );
  }

  // Reference
  if (parsed.referencia_original) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new TextRun({ text: `Réf. / Ref.: ${parsed.referencia_original}`, font: FONT, size: FONT_SIZE - 2 }),
        ],
      })
    );
  }

  children.push(emptyLine());

  // Sections
  for (const section of parsed.secciones) {
    if (section.titulo_seccion) {
      children.push(sectionTitle(section.titulo_seccion));
    }
    const paragraphs = section.contenido.split("\n").filter(Boolean);
    for (const p of paragraphs) {
      children.push(bodyParagraph(p));
    }
    children.push(emptyLine());
  }

  // Certification
  children.push(...certificationBlock(direccion));

  // Final watermark
  children.push(emptyLine());
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
      children: [
        new TextRun({
          text: "⚠ BORRADOR GENERADO POR IA — PENDIENTE DE REVISIÓN Y FIRMA",
          bold: true,
          color: "CC0000",
          font: FONT,
          size: FONT_SIZE,
        }),
      ],
    })
  );

  const footer = makeFooter(parsed);

  const doc = new Document({
    sections: [
      {
        properties: {
          type: SectionType.CONTINUOUS,
          page: {
            margin: {
              top: MARGIN_TWIP,
              right: MARGIN_TWIP,
              bottom: MARGIN_TWIP,
              left: MARGIN_TWIP,
            },
          },
        },
        headers: {},
        footers: { default: footer },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
