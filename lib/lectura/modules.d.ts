declare module "pdf-parse/lib/pdf-parse.js" {
  type PageData = { getTextContent(opts?: Record<string, unknown>): Promise<{ items: Array<{ str: string; transform: number[]; width?: number }> }> };
  function pdfParse(data: Buffer, opts?: { pagerender?: (page: PageData) => Promise<string>; max?: number }): Promise<{ numpages: number; text: string }>;
  export default pdfParse;
}

declare module "heic-convert" {
  function convert(opts: { buffer: Uint8Array | ArrayBuffer; format: "JPEG" | "PNG"; quality?: number }): Promise<ArrayBuffer>;
  export default convert;
}
