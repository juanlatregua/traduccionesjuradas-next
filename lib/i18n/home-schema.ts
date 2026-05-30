// lib/i18n/home-schema.ts — Datos estructurados del home (FAQ + HowTo) en los 5
// idiomas (es·fr·en·de·pt). Fuente única para los componentes Schema* de cada
// home. Objetivo AEO: que la IA cite la página como referencia en cada idioma.
//
// Regla de dos niveles: autoridad genérica (MAEC sin número) en en/de/pt; el
// nº 3850 (acreditación francesa) no se usa en datos estructurados multilingües.

import type { Locale } from "@/lib/i18n/locales";

export type FaqItem = { question: string; answer: string };
export type HowTo = { name: string; description: string; steps: { name: string; text: string }[] };

export const HOME_FAQ: Record<Locale, FaqItem[]> = {
  es: [
    { question: "¿Qué es una traducción jurada?", answer: "Una traducción jurada es una traducción realizada y firmada por un traductor jurado acreditado, que añade su sello y una declaración de veracidad. Tiene validez oficial ante administraciones, juzgados, notarías, universidades y otros organismos." },
    { question: "¿Cuánto tarda una traducción jurada?", answer: "El plazo habitual para una traducción jurada sencilla es de 24 a 72 horas laborables. En el caso de documentos extensos o varios idiomas, el plazo se ajusta al volumen." },
    { question: "¿La traducción jurada se entrega en papel o en PDF?", answer: "Cada vez más organismos aceptan la traducción jurada en PDF firmado digitalmente. Nosotros solemos entregar en PDF firmado y, si lo necesitas, también podemos enviarte el original en papel por mensajería." },
    { question: "¿Cuánto cuesta una traducción jurada?", answer: "El precio depende del tipo de documento, el idioma, la extensión y la urgencia. Trabajamos con tarifas ajustadas y te indicamos siempre un precio cerrado antes de empezar." },
    { question: "¿Hacéis traducciones juradas urgentes?", answer: "En muchos casos podemos ofrecer traducción jurada urgente, dependiendo del volumen y del idioma. Indícalo al pedir presupuesto para revisar la disponibilidad." },
  ],
  fr: [
    { question: "Qu'est-ce qu'une traduction assermentée ?", answer: "Une traduction assermentée est réalisée et signée par un traducteur assermenté accrédité, qui y appose son cachet et une déclaration certifiant la fidélité de la traduction. Elle a une validité officielle devant les administrations, tribunaux, notaires, universités et autres organismes." },
    { question: "Combien de temps prend une traduction assermentée ?", answer: "Le délai habituel pour une traduction assermentée simple est de 24 à 72 heures ouvrées. Pour des documents volumineux ou plusieurs langues, le délai s'ajuste au volume." },
    { question: "La traduction assermentée est-elle livrée sur papier ou en PDF ?", answer: "De plus en plus d'organismes acceptent la traduction assermentée en PDF signé numériquement. Nous livrons généralement en PDF signé et, si besoin, nous pouvons aussi vous envoyer l'original papier par courrier." },
    { question: "Combien coûte une traduction assermentée ?", answer: "Le prix dépend du type de document, de la langue, de la longueur et de l'urgence. Nous appliquons des tarifs ajustés et vous indiquons toujours un prix ferme avant de commencer." },
    { question: "Faites-vous des traductions assermentées urgentes ?", answer: "Dans de nombreux cas, nous pouvons proposer une traduction assermentée urgente, selon le volume et la langue. Indiquez-le lors de votre demande de devis pour vérifier la disponibilité." },
  ],
  en: [
    { question: "What is a sworn translation?", answer: "A sworn translation is produced and signed by an accredited sworn translator, who adds their stamp and a statement of accuracy. It has official validity before public authorities, courts, notaries, universities and other bodies." },
    { question: "How long does a sworn translation take?", answer: "The usual turnaround for a simple sworn translation is 24 to 72 business hours. For long documents or several languages, the time adjusts to the volume." },
    { question: "Is the sworn translation delivered on paper or as a PDF?", answer: "More and more bodies accept sworn translations as a digitally signed PDF. We usually deliver a signed PDF and, if you need it, we can also send the paper original by courier." },
    { question: "How much does a sworn translation cost?", answer: "The price depends on the document type, language, length and urgency. We work with competitive rates and always give you a fixed price before starting." },
    { question: "Do you do urgent sworn translations?", answer: "In many cases we can offer an urgent sworn translation, depending on the volume and language. Mention it when requesting a quote so we can check availability." },
  ],
  de: [
    { question: "Was ist eine beglaubigte Übersetzung?", answer: "Eine beglaubigte Übersetzung wird von einem ermächtigten vereidigten Übersetzer angefertigt und unterschrieben, der seinen Stempel und eine Richtigkeitserklärung hinzufügt. Sie ist vor Behörden, Gerichten, Notaren, Universitäten und anderen Stellen amtlich gültig." },
    { question: "Wie lange dauert eine beglaubigte Übersetzung?", answer: "Die übliche Bearbeitungszeit für eine einfache beglaubigte Übersetzung beträgt 24 bis 72 Stunden (an Werktagen). Bei umfangreichen Dokumenten oder mehreren Sprachen richtet sich die Frist nach dem Umfang." },
    { question: "Wird die beglaubigte Übersetzung auf Papier oder als PDF geliefert?", answer: "Immer mehr Stellen akzeptieren die beglaubigte Übersetzung als digital signiertes PDF. Wir liefern in der Regel ein signiertes PDF und senden Ihnen bei Bedarf auch das Papieroriginal per Kurier." },
    { question: "Was kostet eine beglaubigte Übersetzung?", answer: "Der Preis hängt von Dokumentart, Sprache, Umfang und Dringlichkeit ab. Wir arbeiten mit fairen Tarifen und nennen Ihnen immer einen Festpreis, bevor wir beginnen." },
    { question: "Bieten Sie eilige beglaubigte Übersetzungen an?", answer: "In vielen Fällen können wir eine eilige beglaubigte Übersetzung anbieten, je nach Umfang und Sprache. Geben Sie dies bei Ihrer Angebotsanfrage an, damit wir die Verfügbarkeit prüfen." },
  ],
  pt: [
    { question: "O que é uma tradução certificada?", answer: "Uma tradução certificada é realizada e assinada por um tradutor ajuramentado acreditado, que acrescenta o seu carimbo e uma declaração de fidelidade. Tem validade oficial perante administrações, tribunais, notários, universidades e outros organismos." },
    { question: "Quanto tempo demora uma tradução certificada?", answer: "O prazo habitual para uma tradução certificada simples é de 24 a 72 horas úteis. No caso de documentos extensos ou vários idiomas, o prazo ajusta-se ao volume." },
    { question: "A tradução certificada é entregue em papel ou em PDF?", answer: "Cada vez mais organismos aceitam a tradução certificada em PDF assinado digitalmente. Normalmente entregamos em PDF assinado e, se precisar, também podemos enviar o original em papel por correio." },
    { question: "Quanto custa uma tradução certificada?", answer: "O preço depende do tipo de documento, do idioma, da extensão e da urgência. Trabalhamos com tarifas ajustadas e indicamos sempre um preço fechado antes de começar." },
    { question: "Fazem traduções certificadas urgentes?", answer: "Em muitos casos podemos oferecer tradução certificada urgente, consoante o volume e o idioma. Indique-o ao pedir orçamento para verificarmos a disponibilidade." },
  ],
};

export const HOME_HOWTO: Record<Locale, HowTo> = {
  es: {
    name: "Cómo pedir una traducción jurada online",
    description: "Sube tu documento, recibe presupuesto cerrado al instante y paga online. Recibirás la traducción jurada firmada digitalmente por traductor jurado acreditado por el MAEC en 24-72 horas.",
    steps: [
      { name: "Sube tu documento", text: "Arrastra el PDF o haz una foto con el móvil. Aceptamos PDF, JPG, PNG, HEIC y TIFF de hasta 20 MB." },
      { name: "Recibe precio cerrado al instante", text: "Analizamos automáticamente el documento (idioma, tipo, extensión) y te mostramos el precio final, sin sorpresas." },
      { name: "Paga y recibe tu traducción", text: "Pagas online con tarjeta o transferencia. Recibes en 24-72 horas la traducción jurada en PDF firmado digitalmente, válida ante administraciones y notarías de toda España." },
    ],
  },
  fr: {
    name: "Comment commander une traduction assermentée en ligne",
    description: "Déposez votre document, recevez un devis ferme immédiatement et payez en ligne. Vous recevrez la traduction assermentée signée numériquement par un traducteur assermenté accrédité par le MAEC sous 24 à 72 heures.",
    steps: [
      { name: "Déposez votre document", text: "Glissez le PDF ou prenez une photo avec votre mobile. Nous acceptons PDF, JPG, PNG, HEIC et TIFF jusqu'à 20 Mo." },
      { name: "Recevez un prix ferme immédiatement", text: "Nous analysons automatiquement le document (langue, type, longueur) et vous montrons le prix final, sans surprises." },
      { name: "Payez et recevez votre traduction", text: "Vous payez en ligne par carte ou virement. Vous recevez sous 24 à 72 heures la traduction assermentée en PDF signé numériquement, valable devant les administrations et notaires de toute l'Espagne." },
    ],
  },
  en: {
    name: "How to order a sworn translation online",
    description: "Upload your document, get a fixed quote instantly and pay online. You'll receive the sworn translation digitally signed by a sworn translator accredited by the MAEC within 24–72 hours.",
    steps: [
      { name: "Upload your document", text: "Drag the PDF or take a photo with your phone. We accept PDF, JPG, PNG, HEIC and TIFF up to 20 MB." },
      { name: "Get a fixed price instantly", text: "We automatically analyse the document (language, type, length) and show you the final price, no surprises." },
      { name: "Pay and receive your translation", text: "You pay online by card or bank transfer. Within 24–72 hours you receive the sworn translation as a digitally signed PDF, valid before authorities and notaries across Spain." },
    ],
  },
  de: {
    name: "Eine beglaubigte Übersetzung online bestellen",
    description: "Laden Sie Ihr Dokument hoch, erhalten Sie sofort ein Festpreisangebot und zahlen Sie online. Sie erhalten die beglaubigte Übersetzung digital signiert von einem vom MAEC ermächtigten Übersetzer innerhalb von 24–72 Stunden.",
    steps: [
      { name: "Laden Sie Ihr Dokument hoch", text: "Ziehen Sie das PDF hierher oder machen Sie ein Foto mit dem Handy. Wir akzeptieren PDF, JPG, PNG, HEIC und TIFF bis 20 MB." },
      { name: "Erhalten Sie sofort einen Festpreis", text: "Wir analysieren das Dokument automatisch (Sprache, Art, Umfang) und zeigen Ihnen den Endpreis, ohne Überraschungen." },
      { name: "Zahlen Sie und erhalten Sie Ihre Übersetzung", text: "Sie zahlen online per Karte oder Überweisung. Innerhalb von 24–72 Stunden erhalten Sie die beglaubigte Übersetzung als digital signiertes PDF, gültig vor Behörden und Notaren in ganz Spanien." },
    ],
  },
  pt: {
    name: "Como pedir uma tradução certificada online",
    description: "Envie o seu documento, receba um orçamento fechado de imediato e pague online. Receberá a tradução certificada assinada digitalmente por um tradutor acreditado pelo MAEC em 24–72 horas.",
    steps: [
      { name: "Envie o seu documento", text: "Arraste o PDF ou tire uma foto com o telemóvel. Aceitamos PDF, JPG, PNG, HEIC e TIFF até 20 MB." },
      { name: "Receba um preço fechado de imediato", text: "Analisamos automaticamente o documento (idioma, tipo, extensão) e mostramos-lhe o preço final, sem surpresas." },
      { name: "Pague e receba a sua tradução", text: "Paga online com cartão ou transferência. Em 24–72 horas recebe a tradução certificada em PDF assinado digitalmente, válida perante administrações e notários de toda a Espanha." },
    ],
  },
};
