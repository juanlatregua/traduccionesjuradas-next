-- Idioma del PDF del presupuesto (es|en|fr|it|pt|de). Aditivo, nullable:
-- null = español (comportamiento anterior). Peticion Juan 21-ago-2026: "poner
-- el presupuesto en otros idiomas como los mensajes de comunicacion".

ALTER TABLE "Quote" ADD COLUMN "pdfLang" TEXT;
