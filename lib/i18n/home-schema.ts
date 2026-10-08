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
    { question: "¿Cuánto tarda una traducción jurada?", answer: "Francés↔español: 24 horas desde la confirmación del pago en documentos de 1 a 2 páginas y 48 horas a partir de 3 páginas, en horario laborable. En el resto de idiomas (inglés, alemán, neerlandés, portugués, rumano…) el traductor jurado confirma el plazo en el presupuesto, normalmente el mismo día. Los documentos extensos o de varios idiomas se ajustan al volumen." },
    { question: "¿La traducción jurada se entrega en papel o en PDF?", answer: "Cada vez más organismos aceptan la traducción jurada en PDF firmado digitalmente. Nosotros solemos entregar en PDF firmado y, si lo necesitas, también podemos enviarte el original en papel por mensajería." },
    { question: "¿Cuánto cuesta una traducción jurada?", answer: "Traducción jurada de francés y de alemán a español: 30 € + IVA por página del original en certificados, actas, títulos, expedientes y antecedentes, y 35 € + IVA si está apostillado (la apostilla no cuenta como página; en alemán, 35 € + IVA por página si lleva tablas); contratos y textos largos, por palabra. Español→francés: desde 35 € + IVA. Inglés, neerlandés, portugués y rumano: desde 40 € + IVA por documento; otros idiomas, presupuesto. Te damos el precio cerrado antes de empezar y solo pagas después de recibirlo." },
    { question: "¿Hacéis traducciones juradas urgentes?", answer: "En muchos casos podemos ofrecer traducción jurada urgente, dependiendo del volumen y del idioma. Indícalo al pedir presupuesto para revisar la disponibilidad." },
    { question: "¿Es válida una traducción jurada ante las autoridades españolas?", answer: "Sí. Según el Ministerio de Asuntos Exteriores (MAEC), las traducciones de un traductor jurado nombrado por el MAEC tienen carácter oficial y pueden aportarse ante órganos judiciales y administrativos (https://www.exteriores.gob.es/es/ServiciosAlCiudadano/Paginas/Traductores-Interpretes-Jurados.aspx). Cada organismo fija sus requisitos de formato y de aportación del original, así que conviene confirmarlos con quien recibirá el documento." },
    { question: "¿Necesito apostilla para traducir un documento extranjero?", answer: "Depende del país que emitió el documento. La apostilla afecta al documento original, no a la traducción, y la pone la autoridad del país emisor. Si ese país es parte del Convenio de La Haya de 1961 (p. ej. Francia, Países Bajos, Bélgica, Alemania, Portugal, Reino Unido o Marruecos) el trámite habitual es la apostilla; si no lo es, suele exigirse otra legalización. Lista oficial de Estados parte: https://www.hcch.net/en/instruments/conventions/status-table/?cid=41." },
  ],
  fr: [
    { question: "Qu'est-ce qu'une traduction assermentée français-espagnol ?", answer: "Une traduction assermentée français-espagnol est réalisée et signée par un traducteur assermenté espagnol accrédité par le Ministère espagnol des Affaires étrangères (MAEC), qui y appose son cachet et une déclaration certifiant la fidélité de la traduction. Elle a une validité officielle devant les administrations, tribunaux, notaires et universités en Espagne." },
    { question: "Combien de temps prend une traduction assermentée ?", answer: "Français-espagnol : 24 heures à compter de la confirmation du paiement pour un document de 1 à 2 pages et 48 heures à partir de 3 pages, en jours ouvrés. Pour les autres langues (anglais, allemand, néerlandais, portugais, roumain…), le traducteur assermenté confirme le délai dans le devis, en général le jour même. Pour les documents volumineux ou multilingues, le délai s'adapte au volume." },
    { question: "La traduction assermentée est-elle livrée sur papier ou en PDF ?", answer: "De plus en plus d'organismes acceptent la traduction assermentée en PDF signé numériquement. Nous livrons généralement en PDF signé et, si besoin, nous pouvons aussi vous envoyer l'original papier par courrier." },
    { question: "Combien coûte une traduction assermentée espagnol-français ?", answer: "Traduction assermentée du français et de l'allemand vers l'espagnol : 30 € HT par page de l'original pour les actes, certificats, diplômes, casiers et apostilles (pour l'allemand, 35 € HT par page avec tableaux) ; contrats et textes longs au mot. Espagnol-français : à partir de 35 € HT. Anglais, néerlandais, portugais et roumain : à partir de 40 € HT par document ; autres langues, sur devis. Vous recevez un prix ferme avant de commencer et ne payez qu'après l'avoir reçu." },
    { question: "Faites-vous des traductions assermentées urgentes ?", answer: "Dans de nombreux cas, nous pouvons proposer une traduction assermentée urgente, selon le volume et la langue. Indiquez-le lors de votre demande de devis pour vérifier la disponibilité." },
    { question: "Une traduction assermentée est-elle valable devant les autorités espagnoles ?", answer: "Oui. Selon le Ministère espagnol des Affaires étrangères (MAEC), les traductions d'un traducteur assermenté nommé par le MAEC ont un caractère officiel et peuvent être présentées devant les organes judiciaires et administratifs (https://www.exteriores.gob.es/es/ServiciosAlCiudadano/Paginas/Traductores-Interpretes-Jurados.aspx). Chaque organisme fixe ses exigences de forme et de présentation de l'original : vérifiez-les auprès de celui qui recevra le document." },
    { question: "Faut-il une apostille pour faire traduire un document étranger ?", answer: "Cela dépend du pays qui a émis le document. L'apostille concerne le document original, pas la traduction, et elle est apposée par l'autorité du pays émetteur. Si ce pays est partie à la Convention de La Haye de 1961 (par ex. France, Pays-Bas, Belgique, Allemagne, Portugal, Royaume-Uni ou Maroc), la démarche habituelle est l'apostille ; sinon, une autre légalisation est en général exigée. Liste officielle des États parties : https://www.hcch.net/en/instruments/conventions/status-table/?cid=41." },
  ],
  en: [
    { question: "What is a sworn translation?", answer: "A sworn translation is produced and signed by an accredited sworn translator, who adds their stamp and a statement of accuracy. It has official validity before public authorities, courts, notaries, universities and other bodies." },
    { question: "How long does a sworn translation take?", answer: "French ↔ Spanish: 24 hours from payment confirmation for documents of 1–2 pages and 48 hours from 3 pages, in business hours. For other languages (English, German, Dutch, Portuguese, Romanian…) the sworn translator confirms the deadline in the quote, usually the same day. Long documents or several languages are adjusted to the volume." },
    { question: "Is the sworn translation delivered on paper or as a PDF?", answer: "More and more bodies accept sworn translations as a digitally signed PDF. We usually deliver a signed PDF and, if you need it, we can also send the paper original by courier." },
    { question: "How much does a sworn translation cost?", answer: "French and German into Spanish: €30 + VAT per page of the original for certificates, records, degrees, criminal records and apostilles (German: €35 + VAT per page with tables); contracts and long texts are priced per word. Spanish into French: from €35 + VAT. English, Dutch, Portuguese and Romanian: from €40 + VAT per document; other languages, by quote. You get a fixed price before we start and only pay after receiving it." },
    { question: "Do you do urgent sworn translations?", answer: "In many cases we can offer an urgent sworn translation, depending on the volume and language. Mention it when requesting a quote so we can check availability." },
    { question: "Is a sworn translation valid before Spanish authorities?", answer: "Yes. According to Spain's Ministry of Foreign Affairs (MAEC), translations by a sworn translator appointed by the MAEC have official status and may be submitted to judicial and administrative bodies (https://www.exteriores.gob.es/es/ServiciosAlCiudadano/Paginas/Traductores-Interpretes-Jurados.aspx). Each body sets its own format and original-document requirements, so confirm them with whoever will receive the document." },
    { question: "Do I need an apostille to translate a foreign document?", answer: "It depends on the country that issued the document. The apostille applies to the original document, not to the translation, and is added by the issuing country's authority. If that country is party to the 1961 Hague Convention (e.g. France, the Netherlands, Belgium, Germany, Portugal, the United Kingdom or Morocco), the usual route is the apostille; if not, another form of legalisation is generally required. Official list of contracting states: https://www.hcch.net/en/instruments/conventions/status-table/?cid=41." },
  ],
  de: [
    { question: "Was ist eine beglaubigte Übersetzung?", answer: "Eine beglaubigte Übersetzung wird von einem ermächtigten vereidigten Übersetzer angefertigt und unterschrieben, der seinen Stempel und eine Richtigkeitserklärung hinzufügt. Sie ist vor Behörden, Gerichten, Notaren, Universitäten und anderen Stellen amtlich gültig." },
    { question: "Wie lange dauert eine beglaubigte Übersetzung?", answer: "Französisch ↔ Spanisch: 24 Stunden ab Zahlungsbestätigung bei Dokumenten mit 1–2 Seiten und 48 Stunden ab 3 Seiten, zu Geschäftszeiten. Für andere Sprachen (Englisch, Deutsch, Niederländisch, Portugiesisch, Rumänisch…) bestätigt der ermächtigte Übersetzer die Frist im Angebot, in der Regel am selben Tag. Bei umfangreichen Dokumenten oder mehreren Sprachen verlängert sich die Frist entsprechend." },
    { question: "Wird die beglaubigte Übersetzung auf Papier oder als PDF geliefert?", answer: "Immer mehr Stellen akzeptieren die beglaubigte Übersetzung als digital signiertes PDF. Wir liefern in der Regel ein signiertes PDF und senden Ihnen bei Bedarf auch das Papieroriginal per Kurier." },
    { question: "Was kostet eine beglaubigte Übersetzung?", answer: "Beglaubigte Übersetzung aus dem Deutschen und Französischen ins Spanische: 30 € zzgl. MwSt. pro Seite des Originals bei Urkunden, Zeugnissen, Führungszeugnissen und Apostillen (Deutsch: 35 € pro Seite mit Tabellen); Verträge und lange Texte nach Wörtern. Spanisch → Französisch: ab 35 € zzgl. MwSt. Englisch, Niederländisch, Portugiesisch und Rumänisch: ab 40 € zzgl. MwSt. pro Dokument; andere Sprachen auf Anfrage. Sie erhalten vor Beginn einen Festpreis und zahlen erst danach." },
    { question: "Bieten Sie eilige beglaubigte Übersetzungen an?", answer: "In vielen Fällen können wir eine eilige beglaubigte Übersetzung anbieten, je nach Umfang und Sprache. Geben Sie dies bei Ihrer Angebotsanfrage an, damit wir die Verfügbarkeit prüfen." },
    { question: "Ist eine beglaubigte Übersetzung vor spanischen Behörden gültig?", answer: "Ja. Nach Angaben des spanischen Außenministeriums (MAEC) haben Übersetzungen eines vom MAEC ernannten vereidigten Übersetzers amtlichen Charakter und können bei Gerichten und Verwaltungsbehörden eingereicht werden (https://www.exteriores.gob.es/es/ServiciosAlCiudadano/Paginas/Traductores-Interpretes-Jurados.aspx). Jede Stelle legt ihre Anforderungen an Format und Vorlage des Originals selbst fest; klären Sie das mit der Stelle, die das Dokument erhält." },
    { question: "Brauche ich eine Apostille, um ein ausländisches Dokument übersetzen zu lassen?", answer: "Das hängt vom ausstellenden Land ab. Die Apostille betrifft das Originaldokument, nicht die Übersetzung, und wird von der Behörde des Ausstellerlandes angebracht. Ist dieses Land Vertragsstaat des Haager Übereinkommens von 1961 (z. B. Frankreich, Niederlande, Belgien, Deutschland, Portugal, Vereinigtes Königreich oder Marokko), ist die Apostille der übliche Weg; andernfalls ist meist eine andere Legalisation nötig. Offizielle Liste der Vertragsstaaten: https://www.hcch.net/en/instruments/conventions/status-table/?cid=41." },
  ],
  pt: [
    { question: "O que é uma tradução certificada?", answer: "Uma tradução certificada é realizada e assinada por um tradutor jurado acreditado, que acrescenta o seu carimbo e uma declaração de fidelidade. Tem validade oficial perante administrações, tribunais, notários, universidades e outros organismos." },
    { question: "Quanto tempo demora uma tradução certificada?", answer: "Francês ↔ espanhol: 24 horas após a confirmação do pagamento em documentos de 1 a 2 páginas e 48 horas a partir de 3 páginas, em horário útil. Nos restantes idiomas (inglês, alemão, neerlandês, português, romeno…) o tradutor confirma o prazo no orçamento, normalmente no mesmo dia. Em documentos extensos ou com vários idiomas, o prazo pode ser maior." },
    { question: "A tradução certificada é entregue em papel ou em PDF?", answer: "Cada vez mais organismos aceitam a tradução certificada em PDF assinado digitalmente. Normalmente entregamos em PDF assinado e, se precisar, também podemos enviar o original em papel por correio." },
    { question: "Quanto custa uma tradução certificada?", answer: "Francês e alemão para espanhol: 30 € + IVA por página do original em certidões, diplomas, registos criminais e apostilas (alemão: 35 € + IVA por página com tabelas); contratos e textos longos, à palavra. Espanhol para francês: desde 35 € + IVA. Inglês, neerlandês, português e romeno: desde 40 € + IVA por documento; outros idiomas, por orçamento. Indicamos um preço fechado antes de começar e só paga depois de o receber." },
    { question: "Fazem traduções certificadas urgentes?", answer: "Em muitos casos podemos oferecer tradução certificada urgente, consoante o volume e o idioma. Indique-o ao pedir orçamento para verificarmos a disponibilidade." },
    { question: "A tradução certificada é válida perante as autoridades espanholas?", answer: "Sim. Segundo o Ministério dos Negócios Estrangeiros de Espanha (MAEC), as traduções de um tradutor jurado nomeado pelo MAEC têm carácter oficial e podem ser apresentadas perante órgãos judiciais e administrativos (https://www.exteriores.gob.es/es/ServiciosAlCiudadano/Paginas/Traductores-Interpretes-Jurados.aspx). Cada organismo define os seus requisitos de formato e de apresentação do original; confirme-os com quem vai receber o documento." },
    { question: "Preciso de apostila para traduzir um documento estrangeiro?", answer: "Depende do país que emitiu o documento. A apostila diz respeito ao documento original, não à tradução, e é aposta pela autoridade do país emissor. Se esse país for parte da Convenção da Haia de 1961 (por ex. França, Países Baixos, Bélgica, Alemanha, Portugal, Reino Unido ou Marrocos), o procedimento habitual é a apostila; caso contrário, costuma exigir-se outra legalização. Lista oficial dos Estados parte: https://www.hcch.net/en/instruments/conventions/status-table/?cid=41." },
  ],
};

export const HOME_HOWTO: Record<Locale, HowTo> = {
  es: {
    name: "Cómo pedir una traducción jurada online",
    description: "Sube tu documento, recibe un presupuesto cerrado (al instante en francés) y paga online. Recibirás la traducción jurada firmada digitalmente por traductor jurado acreditado por el MAEC en 24-48 horas (francés) o en el plazo confirmado en el presupuesto.",
    steps: [
      { name: "Sube tu documento", text: "Arrastra el PDF o haz una foto con el móvil. Aceptamos PDF, JPG, PNG, HEIC y TIFF de hasta 20 MB." },
      { name: "Recibe tu presupuesto cerrado", text: "Analizamos el documento (idioma, tipo, extensión): en francés ves el precio final al instante; en otros idiomas, un traductor jurado te confirma precio y plazo, normalmente el mismo día. Pagas después de recibirlo." },
      { name: "Paga y recibe tu traducción", text: "Pagas online con tarjeta o transferencia. Recibes en el plazo indicado (24-48 horas en francés) la traducción jurada en PDF firmado digitalmente, válida ante administraciones y notarías de toda España." },
    ],
  },
  fr: {
    name: "Comment commander une traduction assermentée en ligne",
    description: "Déposez votre document, recevez un devis ferme immédiatement et payez en ligne. Vous recevrez la traduction assermentée signée numériquement par un traducteur assermenté accrédité par le MAEC sous 24 à 48 heures.",
    steps: [
      { name: "Déposez votre document", text: "Glissez le PDF ou prenez une photo avec votre mobile. Nous acceptons PDF, JPG, PNG, HEIC et TIFF jusqu'à 20 Mo." },
      { name: "Recevez un prix ferme immédiatement", text: "Nous analysons automatiquement le document (langue, type, longueur) et vous montrons le prix final, sans surprises." },
      { name: "Payez et recevez votre traduction", text: "Vous payez en ligne par carte ou virement. Vous recevez sous 24 à 48 heures la traduction assermentée en PDF signé numériquement, valable devant les administrations et notaires de toute l'Espagne." },
    ],
  },
  en: {
    name: "How to order a sworn translation online",
    description: "Upload your document, get a fixed quote before you pay (instantly for French) and pay online. You'll receive the sworn translation digitally signed by a sworn translator accredited by the MAEC within 24–48 hours (French) or the deadline confirmed in the quote.",
    steps: [
      { name: "Upload your document", text: "Drag the PDF or take a photo with your phone. We accept PDF, JPG, PNG, HEIC and TIFF up to 20 MB." },
      { name: "Get a fixed quote before paying", text: "We analyse the document (language, type, length): for French you see the final price instantly; for other languages a sworn translator confirms price and deadline, usually the same day." },
      { name: "Pay and receive your translation", text: "You pay online by card or bank transfer. Within 24–48 hours (French) or the deadline in your quote, you receive the sworn translation as a digitally signed PDF, valid before authorities and notaries across Spain." },
    ],
  },
  de: {
    name: "Eine beglaubigte Übersetzung online bestellen",
    description: "Laden Sie Ihr Dokument hoch, erhalten Sie ein Festpreisangebot vor der Zahlung (bei Französisch sofort) und zahlen Sie online. Sie erhalten die beglaubigte Übersetzung digital signiert von einem vom MAEC ermächtigten Übersetzer innerhalb von 24–48 Stunden (Französisch) bzw. der im Angebot bestätigten Frist.",
    steps: [
      { name: "Laden Sie Ihr Dokument hoch", text: "Ziehen Sie das PDF hierher oder machen Sie ein Foto mit dem Handy. Wir akzeptieren PDF, JPG, PNG, HEIC und TIFF bis 20 MB." },
      { name: "Erhalten Sie ein Festpreisangebot", text: "Wir analysieren das Dokument (Sprache, Art, Umfang): bei Französisch sehen Sie den Endpreis sofort; bei anderen Sprachen bestätigt ein ermächtigter Übersetzer Preis und Frist, in der Regel am selben Tag." },
      { name: "Zahlen Sie und erhalten Sie Ihre Übersetzung", text: "Sie zahlen online per Karte oder Überweisung. Innerhalb von 24–48 Stunden (Französisch) bzw. der im Angebot genannten Frist erhalten Sie die beglaubigte Übersetzung als digital signiertes PDF, gültig vor Behörden und Notaren in ganz Spanien." },
    ],
  },
  pt: {
    name: "Como pedir uma tradução certificada online",
    description: "Envie o seu documento, receba um orçamento fechado antes de pagar (de imediato em francês) e pague online. Receberá a tradução certificada assinada digitalmente por um tradutor acreditado pelo MAEC em 24–48 horas (francês) ou no prazo confirmado no orçamento.",
    steps: [
      { name: "Envie o seu documento", text: "Arraste o PDF ou tire uma foto com o telemóvel. Aceitamos PDF, JPG, PNG, HEIC e TIFF até 20 MB." },
      { name: "Receba um orçamento fechado", text: "Analisamos o documento (idioma, tipo, extensão): em francês vê o preço final de imediato; nos outros idiomas, um tradutor confirma preço e prazo, normalmente no mesmo dia." },
      { name: "Pague e receba a sua tradução", text: "Paga online com cartão ou transferência. Em 24–48 horas (francês) ou no prazo do orçamento recebe a tradução certificada em PDF assinado digitalmente, válida perante administrações e notários de toda a Espanha." },
    ],
  },
};
