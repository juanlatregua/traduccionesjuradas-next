// Única fuente de las respuestas a las dudas recurrentes del cliente (decisiones de Juan, 21-nov-2026).
// La leen el chat (lib/chat/system-prompt.ts), el conserje de la entrada (lib/entrada/conserje.ts)
// y /preguntas-frecuentes (HTML + FAQPage JSON-LD). Cambiar una respuesta aquí la cambia en los tres.
// Sin importaciones con alias: lo carga también `node --test`.
import { EMAIL, WHATSAPP_DISPLAY } from "../contact.ts";

export type FaqLang = "es" | "fr" | "en" | "de" | "pt";
export const FAQ_LANGS: readonly FaqLang[] = ["es", "fr", "en", "de", "pt"];

export const FAQ_FIXED = {
  whatsapp: WHATSAPP_DISPLAY,
  email: EMAIL,
  maec: "3850",
  maecUrl: "https://www.exteriores.gob.es/es/ServiciosAlCiudadano/Paginas/Buscador-STIJ.aspx",
  valide: "valide.redsara.es",
  guiaFirma: "/blog/comprobar-firma-electronica-traduccion-jurada",
  validityDays: 15,
  retentionDays: 30,
} as const;

/** Única cifra de dinero que el conserje puede decir. */
export const FROM_PRICE: Record<FaqLang, string> = {
  es: "desde 30 € + IVA",
  fr: "à partir de 30 € + TVA",
  en: "from €30 + VAT",
  de: "ab 30 € + MwSt.",
  pt: "a partir de 30 € + IVA",
};

type Txt = Record<FaqLang, string>;
export type FaqEntry = { id: string; q: Txt; a: Txt };

const WA = FAQ_FIXED.whatsapp;
const MAIL = FAQ_FIXED.email;
const MAEC = FAQ_FIXED.maec;
const MAEC_URL = FAQ_FIXED.maecUrl;
const VALIDE = FAQ_FIXED.valide;
const GUIA = FAQ_FIXED.guiaFirma;
const VALID_DAYS = FAQ_FIXED.validityDays;
const KEEP_DAYS = FAQ_FIXED.retentionDays;

export const FAQ_CLIENTE: readonly FaqEntry[] = [
  {
    id: "que-es",
    q: {
      es: "¿Qué es una traducción jurada?",
      fr: "Qu'est-ce qu'une traduction assermentée ?",
      en: "What is a sworn translation?",
      de: "Was ist eine beeidigte Übersetzung?",
      pt: "O que é uma tradução juramentada?",
    },
    a: {
      es: "Es una traducción hecha y firmada por un traductor-intérprete jurado, que añade su sello y una declaración de que es fiel al original. Tiene validez oficial en España ante administraciones, juzgados, notarías y universidades, aunque cada organismo fija sus requisitos.",
      fr: "C'est une traduction réalisée et signée par un traducteur-interprète assermenté, qui y appose son cachet et une déclaration de fidélité à l'original. Elle a une valeur officielle en Espagne auprès des administrations, tribunaux, notaires et universités, même si chaque organisme fixe ses exigences.",
      en: "It is a translation made and signed by a sworn translator-interpreter, who adds a seal and a statement that it is faithful to the original. It has official validity in Spain before administrations, courts, notaries and universities, although each authority sets its own requirements.",
      de: "Es ist eine Übersetzung, die ein beeidigter Übersetzer anfertigt und unterzeichnet und mit Stempel sowie einer Treueerklärung zum Original versieht. Sie hat in Spanien amtliche Gültigkeit gegenüber Verwaltungen, Gerichten, Notaren und Universitäten; jede Stelle legt jedoch eigene Anforderungen fest.",
      pt: "É uma tradução feita e assinada por um tradutor-intérprete juramentado, que acrescenta o seu carimbo e uma declaração de fidelidade ao original. Tem validade oficial em Espanha perante administrações, tribunais, notários e universidades, embora cada organismo fixe os seus requisitos.",
    },
  },
  {
    id: "precio",
    q: {
      es: "¿Cuánto cuesta una traducción jurada y qué incluye?",
      fr: "Combien coûte une traduction assermentée et que comprend le prix ?",
      en: "How much does a sworn translation cost and what does it include?",
      de: "Was kostet eine beeidigte Übersetzung und was ist enthalten?",
      pt: "Quanto custa uma tradução juramentada e o que inclui?",
    },
    a: {
      es: "Desde 30 € + IVA. El precio cerrado depende del idioma, del tipo de documento y de las páginas: lo ves en el presupuesto, antes de pagar y sin compromiso. Incluye la traducción jurada firmada, todas las páginas del documento y, si la lleva, su apostilla.",
      fr: "À partir de 30 € + TVA. Le prix définitif dépend de la langue, du type de document et du nombre de pages : vous le voyez dans le devis, avant de payer et sans engagement. Il comprend la traduction assermentée signée, toutes les pages du document et, le cas échéant, son apostille.",
      en: "From €30 + VAT. The final price depends on the language, the type of document and the number of pages: you see it in the quote, before paying and with no commitment. It includes the signed sworn translation, every page of the document and, if it has one, its apostille.",
      de: "Ab 30 € + MwSt. Der verbindliche Preis hängt von Sprache, Dokumenttyp und Seitenzahl ab: Sie sehen ihn im Angebot, vor der Zahlung und unverbindlich. Enthalten sind die unterzeichnete beeidigte Übersetzung, alle Seiten des Dokuments und gegebenenfalls die Apostille.",
      pt: "A partir de 30 € + IVA. O preço final depende do idioma, do tipo de documento e das páginas: você o vê no orçamento, antes de pagar e sem compromisso. Inclui a tradução juramentada assinada, todas as páginas do documento e, se tiver, a apostila.",
    },
  },
  {
    id: "paginas",
    q: {
      es: "¿Tengo que subir todas las páginas? ¿Y la apostilla?",
      fr: "Dois-je envoyer toutes les pages ? Et l'apostille ?",
      en: "Do I have to upload every page? And the apostille?",
      de: "Muss ich alle Seiten hochladen? Und die Apostille?",
      pt: "Preciso enviar todas as páginas? E a apostila?",
    },
    a: {
      es: "Sí: todas las páginas, también el reverso si tiene texto, sellos o anotaciones, y la hoja de la apostilla. Una traducción jurada ha de ser completa, así que lo que falte no se puede traducir. Todas esas páginas y la apostilla entran en el presupuesto.",
      fr: "Oui : toutes les pages, y compris le verso s'il contient du texte, des cachets ou des mentions, et la feuille de l'apostille. Une traduction assermentée doit être complète : ce qui manque ne peut pas être traduit. Toutes ces pages et l'apostille sont comprises dans le devis.",
      en: "Yes: every page, including the back if it has text, stamps or notes, and the apostille sheet. A sworn translation must be complete, so anything missing can't be translated. All those pages and the apostille are covered in the quote.",
      de: "Ja: alle Seiten, auch die Rückseite, wenn sie Text, Stempel oder Vermerke enthält, sowie das Apostille-Blatt. Eine beeidigte Übersetzung muss vollständig sein; was fehlt, kann nicht übersetzt werden. Alle diese Seiten und die Apostille sind im Angebot berücksichtigt.",
      pt: "Sim: todas as páginas, inclusive o verso se tiver texto, carimbos ou anotações, e a folha da apostila. Uma tradução juramentada tem de ser completa, então o que faltar não pode ser traduzido. Todas essas páginas e a apostila entram no orçamento.",
    },
  },
  {
    id: "oficial",
    q: {
      es: "¿Es una traducción oficial? ¿Cómo compruebo que el traductor es jurado?",
      fr: "Est-ce une traduction officielle ? Comment vérifier que le traducteur est assermenté ?",
      en: "Is it an official translation? How can I check the translator is sworn?",
      de: "Ist das eine amtliche Übersetzung? Wie prüfe ich, ob der Übersetzer beeidigt ist?",
      pt: "É uma tradução oficial? Como verifico que o tradutor é juramentado?",
    },
    a: {
      es: `Sí: la firma un traductor-intérprete jurado nombrado por el Ministerio de Asuntos Exteriores (MAEC). Juan Silva Moreno es el n.º ${MAEC} (francés) y puedes comprobarlo en el listado oficial del MAEC: ${MAEC_URL}. Los traductores jurados de otros idiomas también figuran en ese listado.`,
      fr: `Oui : elle est signée par un traducteur-interprète assermenté nommé par le ministère espagnol des Affaires étrangères (MAEC). Juan Silva Moreno est le n° ${MAEC} (français) et vous pouvez le vérifier dans la liste officielle du MAEC : ${MAEC_URL}. Les traducteurs assermentés des autres langues figurent aussi dans cette liste.`,
      en: `Yes: it is signed by a sworn translator-interpreter appointed by Spain's Ministry of Foreign Affairs (MAEC). Juan Silva Moreno is no. ${MAEC} (French) and you can check it in the official MAEC list: ${MAEC_URL}. Sworn translators for other languages are listed there too.`,
      de: `Ja: Sie wird von einem beeidigten Übersetzer unterzeichnet, der vom spanischen Außenministerium (MAEC) bestellt wurde. Juan Silva Moreno ist Nr. ${MAEC} (Französisch); das lässt sich in der offiziellen MAEC-Liste prüfen: ${MAEC_URL}. Beeidigte Übersetzer anderer Sprachen stehen ebenfalls dort.`,
      pt: `Sim: é assinada por um tradutor-intérprete juramentado nomeado pelo Ministério dos Negócios Estrangeiros de Espanha (MAEC). Juan Silva Moreno é o n.º ${MAEC} (francês) e você pode conferir na lista oficial do MAEC: ${MAEC_URL}. Os tradutores juramentados de outros idiomas também constam dessa lista.`,
    },
  },
  {
    id: "firma",
    q: {
      es: "¿Cómo verifico la firma electrónica del PDF?",
      fr: "Comment vérifier la signature électronique du PDF ?",
      en: "How do I verify the PDF's electronic signature?",
      de: "Wie prüfe ich die elektronische Signatur des PDF?",
      pt: "Como verifico a assinatura eletrónica do PDF?",
    },
    a: {
      es: `Sube el PDF a VALIDe (${VALIDE}), el validador oficial del Gobierno de España: te dice si la firma es válida y quién firma. Tienes el paso a paso en nuestra guía: ${GUIA}.`,
      fr: `Téléversez le PDF sur VALIDe (${VALIDE}), le validateur officiel du gouvernement espagnol : il indique si la signature est valide et qui a signé. Le pas à pas est dans notre guide : ${GUIA}.`,
      en: `Upload the PDF to VALIDe (${VALIDE}), the Spanish Government's official validator: it tells you whether the signature is valid and who signed. Step by step in our guide: ${GUIA}.`,
      de: `Laden Sie das PDF bei VALIDe (${VALIDE}) hoch, dem offiziellen Validator der spanischen Regierung: Er zeigt, ob die Signatur gültig ist und wer unterzeichnet hat. Die Schritt-für-Schritt-Anleitung steht in unserem Leitfaden: ${GUIA}.`,
      pt: `Envie o PDF para o VALIDe (${VALIDE}), o validador oficial do Governo de Espanha: ele diz se a assinatura é válida e quem assinou. O passo a passo está no nosso guia: ${GUIA}.`,
    },
  },
  {
    id: "pdf-papel",
    q: {
      es: "¿Me la dais en PDF o en papel?",
      fr: "La recevrai-je en PDF ou sur papier ?",
      en: "Do I get it as a PDF or on paper?",
      de: "Bekomme ich sie als PDF oder auf Papier?",
      pt: "Recebo em PDF ou em papel?",
    },
    a: {
      es: "Te la entregamos en PDF con firma electrónica, válido en España. Si el organismo exige papel, o si la traducción va a apostillarse o legalizarse, te enviamos el original en papel por mensajería; el envío se cobra aparte y su importe figura en el presupuesto.",
      fr: "Nous la livrons en PDF signé électroniquement, valable en Espagne. Si l'organisme exige du papier, ou si la traduction doit être apostillée ou légalisée, nous vous envoyons l'original sur papier par coursier ; l'envoi est facturé en plus et son montant figure dans le devis.",
      en: "We deliver it as an electronically signed PDF, valid in Spain. If the authority requires paper, or the translation is to be apostilled or legalised, we send the paper original by courier; shipping is charged extra and the amount is shown in the quote.",
      de: "Wir liefern sie als elektronisch signiertes PDF, das in Spanien gültig ist. Verlangt die Behörde Papier oder soll die Übersetzung apostilliert bzw. legalisiert werden, senden wir das Original per Kurier auf Papier; der Versand wird zusätzlich berechnet, der Betrag steht im Angebot.",
      pt: "Entregamos em PDF com assinatura eletrónica, válido em Espanha. Se o organismo exigir papel, ou se a tradução for apostilada ou legalizada, enviamos o original em papel por correio expresso; o envio é cobrado à parte e o valor consta do orçamento.",
    },
  },
  {
    id: "imprimir",
    q: {
      es: "¿Puedo imprimir el PDF yo mismo?",
      fr: "Puis-je imprimer le PDF moi-même ?",
      en: "Can I print the PDF myself?",
      de: "Kann ich das PDF selbst ausdrucken?",
      pt: "Posso imprimir o PDF eu mesmo?",
    },
    a: {
      es: "Sí, si el trámite acepta el PDF: impreso (mejor en color) es válido. No sirve para legalizar o apostillar la traducción: para eso hace falta el original en papel, que te enviamos por mensajería.",
      fr: "Oui, si la démarche accepte le PDF : imprimé (de préférence en couleur), il est valable. Il ne sert pas à faire légaliser ou apostiller la traduction : il faut pour cela l'original sur papier, que nous vous envoyons par coursier.",
      en: "Yes, if the procedure accepts the PDF: printed (preferably in colour) it is valid. It does not work for legalising or apostilling the translation: for that you need the paper original, which we send by courier.",
      de: "Ja, wenn das Verfahren das PDF akzeptiert: ausgedruckt (am besten in Farbe) ist es gültig. Für eine Legalisierung oder Apostille der Übersetzung genügt der Ausdruck nicht; dafür brauchen Sie das Papieroriginal, das wir per Kurier senden.",
      pt: "Sim, se o trâmite aceitar o PDF: impresso (de preferência a cores) é válido. Não serve para legalizar ou apostilar a tradução: para isso é preciso o original em papel, que enviamos por correio expresso.",
    },
  },
  {
    id: "presencial",
    q: {
      es: "¿Puedo ir a una oficina a entregar o recoger documentos?",
      fr: "Puis-je me rendre dans un bureau pour déposer ou retirer des documents ?",
      en: "Can I visit an office to drop off or collect documents?",
      de: "Kann ich Dokumente persönlich abgeben oder abholen?",
      pt: "Posso ir a um escritório entregar ou recolher documentos?",
    },
    a: {
      es: `No: el servicio es 100 % online y no hay atención presencial. Nos mandas los documentos por la web, por email (${MAIL}) o por WhatsApp (${WA}), y recibes la traducción por email.`,
      fr: `Non : le service est 100 % en ligne et il n'y a pas d'accueil sur place. Vous nous envoyez les documents par le site, par e-mail (${MAIL}) ou par WhatsApp (${WA}), et vous recevez la traduction par e-mail.`,
      en: `No: the service is 100% online and there is no in-person service. You send the documents through the website, by email (${MAIL}) or by WhatsApp (${WA}), and you receive the translation by email.`,
      de: `Nein: Der Service ist zu 100 % online, es gibt keinen Publikumsverkehr. Sie senden uns die Dokumente über die Website, per E-Mail (${MAIL}) oder WhatsApp (${WA}) und erhalten die Übersetzung per E-Mail.`,
      pt: `Não: o serviço é 100 % online e não há atendimento presencial. Você nos envia os documentos pelo site, por e-mail (${MAIL}) ou por WhatsApp (${WA}) e recebe a tradução por e-mail.`,
    },
  },
  {
    id: "enviar",
    q: {
      es: "¿Cómo os envío los documentos?",
      fr: "Comment vous envoyer les documents ?",
      en: "How do I send you the documents?",
      de: "Wie sende ich Ihnen die Dokumente?",
      pt: "Como envio os documentos?",
    },
    a: {
      es: `Por la web, por email (${MAIL}) o por WhatsApp (${WA}). Mándalos todos juntos, con todas las páginas, para que el presupuesto sea único y no haya que rehacerlo. Basta una foto o un escaneo legible.`,
      fr: `Par le site, par e-mail (${MAIL}) ou par WhatsApp (${WA}). Envoyez-les tous ensemble, avec toutes les pages, pour obtenir un seul devis sans avoir à le refaire. Une photo ou un scan lisible suffit.`,
      en: `Through the website, by email (${MAIL}) or by WhatsApp (${WA}). Send them all together, with every page, so you get a single quote that doesn't need redoing. A legible photo or scan is enough.`,
      de: `Über die Website, per E-Mail (${MAIL}) oder WhatsApp (${WA}). Senden Sie alles zusammen, mit allen Seiten, damit es ein einziges Angebot gibt, das nicht neu erstellt werden muss. Ein gut lesbares Foto oder Scan genügt.`,
      pt: `Pelo site, por e-mail (${MAIL}) ou por WhatsApp (${WA}). Envie tudo junto, com todas as páginas, para ter um único orçamento que não precise ser refeito. Uma foto ou digitalização legível basta.`,
    },
  },
  {
    id: "solo-uno",
    q: {
      es: "Solo he podido subir un documento. ¿Puedo añadir más después?",
      fr: "Je n'ai pu envoyer qu'un document. Puis-je en ajouter plus tard ?",
      en: "I could only upload one document. Can I add more later?",
      de: "Ich konnte nur ein Dokument hochladen. Kann ich später weitere ergänzen?",
      pt: "Só consegui enviar um documento. Posso acrescentar mais depois?",
    },
    a: {
      es: `Sí. Envía el resto por email (${MAIL}) o por WhatsApp (${WA}) indicando que es para el mismo encargo y lo añadimos. Si cambia el alcance (más páginas o más documentos), te lo presupuestamos.`,
      fr: `Oui. Envoyez le reste par e-mail (${MAIL}) ou WhatsApp (${WA}) en indiquant que c'est pour la même commande et nous l'ajoutons. Si l'ampleur change (plus de pages ou de documents), nous vous établissons un devis.`,
      en: `Yes. Send the rest by email (${MAIL}) or WhatsApp (${WA}) saying it's for the same order and we'll add it. If the scope changes (more pages or documents), we'll quote it.`,
      de: `Ja. Senden Sie den Rest per E-Mail (${MAIL}) oder WhatsApp (${WA}) und nennen Sie den bestehenden Auftrag; wir ergänzen ihn. Ändert sich der Umfang (mehr Seiten oder Dokumente), erstellen wir ein Angebot dafür.`,
      pt: `Sim. Envie o restante por e-mail (${MAIL}) ou WhatsApp (${WA}) dizendo que é para o mesmo pedido e nós acrescentamos. Se o âmbito mudar (mais páginas ou documentos), fazemos um orçamento.`,
    },
  },
  {
    id: "plazos",
    q: {
      es: "¿Cuánto tarda?",
      fr: "Quel est le délai ?",
      en: "How long does it take?",
      de: "Wie lange dauert es?",
      pt: "Quanto tempo demora?",
    },
    a: {
      es: "En francés, hasta 5 páginas se entregan en 1 día hábil. En el resto de idiomas el plazo lo fija el traductor jurado y figura en el presupuesto: dinos tu fecha límite al pedirlo y lo tenemos en cuenta.",
      fr: "En français, jusqu'à 5 pages sont livrées en 1 jour ouvré. Pour les autres langues, le délai est fixé par le traducteur assermenté et figure dans le devis : indiquez-nous votre date limite en le demandant et nous en tiendrons compte.",
      en: "In French, up to 5 pages are delivered in 1 business day. For other languages the sworn translator sets the deadline and it appears in the quote: tell us your deadline when you ask and we'll take it into account.",
      de: "Auf Französisch werden bis zu 5 Seiten innerhalb von 1 Werktag geliefert. Bei anderen Sprachen legt der beeidigte Übersetzer die Frist fest; sie steht im Angebot: Nennen Sie uns bei der Anfrage Ihre Frist, wir berücksichtigen sie.",
      pt: "Em francês, até 5 páginas são entregues em 1 dia útil. Nos outros idiomas o prazo é fixado pelo tradutor juramentado e consta do orçamento: diga-nos o seu prazo limite ao pedir e nós o levamos em conta.",
    },
  },
  {
    id: "urgencia",
    q: {
      es: "Lo necesito urgente. ¿Se puede?",
      fr: "C'est urgent. Est-ce possible ?",
      en: "I need it urgently. Is that possible?",
      de: "Ich brauche es dringend. Ist das möglich?",
      pt: "Preciso com urgência. É possível?",
    },
    a: {
      es: "Muchas veces sí: dinos la fecha límite y lo vemos. La urgencia se cobra con un recargo que verás en el presupuesto, antes de pagar.",
      fr: "Souvent oui : indiquez-nous la date limite et nous regardons. L'urgence est facturée avec un supplément que vous verrez dans le devis, avant de payer.",
      en: "Often yes: tell us your deadline and we'll see. Urgency carries a surcharge that you'll see in the quote, before paying.",
      de: "Oft ja: Nennen Sie uns die Frist, wir prüfen es. Für Eilaufträge wird ein Aufschlag berechnet, den Sie im Angebot vor der Zahlung sehen.",
      pt: "Muitas vezes sim: diga-nos o prazo limite e vemos. A urgência é cobrada com um acréscimo que você verá no orçamento, antes de pagar.",
    },
  },
  {
    id: "pagos",
    q: {
      es: "¿Cómo se paga y cómo sé que el pago ha llegado?",
      fr: "Comment payer et comment savoir que le paiement est arrivé ?",
      en: "How do I pay, and how do I know the payment arrived?",
      de: "Wie bezahle ich und woher weiß ich, dass die Zahlung angekommen ist?",
      pt: "Como se paga e como sei que o pagamento chegou?",
    },
    a: {
      es: "Puedes pagar con tarjeta, transferencia bancaria o Bizum. Recibes un email de confirmación; si en unos minutos no lo ves, escríbenos. La transferencia se confirma cuando vemos el ingreso: indica el número de presupuesto en el concepto.",
      fr: "Vous pouvez payer par carte, virement bancaire ou Bizum. Vous recevez un e-mail de confirmation ; si vous ne le voyez pas au bout de quelques minutes, écrivez-nous. Le virement est confirmé lorsque nous voyons le versement : indiquez le numéro de devis en référence.",
      en: "You can pay by card, bank transfer or Bizum. You get a confirmation email; if you don't see it after a few minutes, write to us. A transfer is confirmed once we see the deposit: put the quote number in the reference.",
      de: "Sie können per Karte, Banküberweisung oder Bizum zahlen. Sie erhalten eine Bestätigungs-E-Mail; sehen Sie sie nach einigen Minuten nicht, schreiben Sie uns. Eine Überweisung wird bestätigt, sobald wir den Eingang sehen: Geben Sie die Angebotsnummer als Verwendungszweck an.",
      pt: "Pode pagar com cartão, transferência bancária ou Bizum. Você recebe um e-mail de confirmação; se não o vir em alguns minutos, escreva-nos. A transferência é confirmada quando vemos o depósito: indique o número do orçamento na referência.",
    },
  },
  {
    id: "factura",
    q: {
      es: "¿Me dais factura?",
      fr: "Recevrai-je une facture ?",
      en: "Will I get an invoice?",
      de: "Bekomme ich eine Rechnung?",
      pt: "Vocês emitem fatura?",
    },
    a: {
      es: "Sí: la factura te llega por email tras el pago. Si necesitas otros datos fiscales, respóndenos a ese email antes de pagar.",
      fr: "Oui : la facture vous parvient par e-mail après le paiement. Si vous avez besoin d'autres données fiscales, répondez-nous à cet e-mail avant de payer.",
      en: "Yes: the invoice reaches you by email after payment. If you need different tax details, reply to that email before paying.",
      de: "Ja: Die Rechnung kommt nach der Zahlung per E-Mail. Brauchen Sie andere Steuerdaten, antworten Sie vor der Zahlung auf diese E-Mail.",
      pt: "Sim: a fatura chega por e-mail após o pagamento. Se precisar de outros dados fiscais, responda a esse e-mail antes de pagar.",
    },
  },
  {
    id: "correcciones",
    q: {
      es: "¿Y si hay un error en la traducción o necesito cambios?",
      fr: "Et s'il y a une erreur dans la traduction ou si je veux des modifications ?",
      en: "What if there's a mistake in the translation, or I need changes?",
      de: "Was, wenn die Übersetzung einen Fehler enthält oder ich Änderungen brauche?",
      pt: "E se houver um erro na tradução ou eu precisar de alterações?",
    },
    a: {
      es: "Si el error es del traductor, la corrección es gratis. Si cambia el alcance (más páginas o más documentos), te lo presupuestamos aparte.",
      fr: "Si l'erreur vient du traducteur, la correction est gratuite. Si l'ampleur change (plus de pages ou de documents), nous établissons un devis à part.",
      en: "If the mistake is the translator's, the correction is free. If the scope changes (more pages or documents), we quote it separately.",
      de: "Liegt der Fehler beim Übersetzer, ist die Korrektur kostenlos. Ändert sich der Umfang (mehr Seiten oder Dokumente), erstellen wir ein gesondertes Angebot.",
      pt: "Se o erro for do tradutor, a correção é gratuita. Se o âmbito mudar (mais páginas ou documentos), fazemos um orçamento à parte.",
    },
  },
  {
    id: "apostilla",
    q: {
      es: "¿Necesito apostilla? ¿Hay que traducirla?",
      fr: "Ai-je besoin d'une apostille ? Faut-il la traduire ?",
      en: "Do I need an apostille? Does it have to be translated?",
      de: "Brauche ich eine Apostille? Muss sie übersetzt werden?",
      pt: "Preciso de apostila? Tem de ser traduzida?",
    },
    a: {
      es: "Depende del país del documento y del organismo que lo pide: la apostilla de La Haya la tramita quien tiene el documento, en el país que lo emitió, normalmente antes de traducirlo. Si el documento la lleva, se traduce junto con él. Confirma con el organismo si se la exige.",
      fr: "Cela dépend du pays du document et de l'organisme qui le demande : l'apostille de La Haye est obtenue par le titulaire du document, dans le pays émetteur, normalement avant la traduction. Si le document en porte une, elle est traduite avec lui. Vérifiez auprès de l'organisme s'il l'exige.",
      en: "It depends on the document's country and the authority asking for it: the Hague apostille is obtained by whoever holds the document, in the issuing country, normally before translation. If the document carries one, it is translated along with it. Check with the authority whether it requires it.",
      de: "Das hängt vom Land des Dokuments und von der anfordernden Stelle ab: Die Haager Apostille besorgt der Inhaber des Dokuments im Ausstellerstaat, üblicherweise vor der Übersetzung. Trägt das Dokument eine, wird sie mitübersetzt. Klären Sie mit der Stelle, ob sie sie verlangt.",
      pt: "Depende do país do documento e do organismo que o pede: a apostila da Haia é obtida por quem tem o documento, no país emissor, normalmente antes da tradução. Se o documento a tiver, é traduzida junto com ele. Confirme com o organismo se a exige.",
    },
  },
  {
    id: "validez",
    q: {
      es: "¿Me la aceptará mi organismo?",
      fr: "Mon organisme l'acceptera-t-il ?",
      en: "Will my authority accept it?",
      de: "Wird meine Behörde sie akzeptieren?",
      pt: "O meu organismo vai aceitá-la?",
    },
    a: {
      es: "Una traducción jurada firmada por un traductor jurado del MAEC tiene validez oficial en España, pero cada organismo fija sus propios requisitos (formato, apostilla, antigüedad del documento) y no podemos decidir por él. Si tienes dudas, consúltalo con el organismo y dinos qué te pide.",
      fr: "Une traduction assermentée signée par un traducteur assermenté du MAEC a une valeur officielle en Espagne, mais chaque organisme fixe ses propres exigences (format, apostille, ancienneté du document) et nous ne pouvons pas décider à sa place. En cas de doute, interrogez l'organisme et dites-nous ce qu'il demande.",
      en: "A sworn translation signed by an MAEC sworn translator has official validity in Spain, but each authority sets its own requirements (format, apostille, age of the document) and we cannot decide for it. If in doubt, ask the authority and tell us what it requires.",
      de: "Eine von einem MAEC-beeidigten Übersetzer unterzeichnete Übersetzung hat in Spanien amtliche Gültigkeit, doch jede Stelle legt eigene Anforderungen fest (Format, Apostille, Alter des Dokuments) und wir können nicht für sie entscheiden. Fragen Sie im Zweifel dort nach und sagen Sie uns, was verlangt wird.",
      pt: "Uma tradução juramentada assinada por um tradutor juramentado do MAEC tem validade oficial em Espanha, mas cada organismo fixa os seus próprios requisitos (formato, apostila, antiguidade do documento) e não podemos decidir por ele. Em caso de dúvida, consulte o organismo e diga-nos o que ele exige.",
    },
  },
  {
    id: "idiomas",
    q: {
      es: "¿Traducís desde o hacia mi idioma?",
      fr: "Traduisez-vous depuis ou vers ma langue ?",
      en: "Do you translate from or into my language?",
      de: "Übersetzen Sie aus bzw. in meine Sprache?",
      pt: "Traduzem de ou para o meu idioma?",
    },
    a: {
      es: `Trabajamos 10 idiomas: francés, inglés, alemán, italiano, portugués, catalán, neerlandés, sueco, noruego y rumano, con el español. Si tu idioma no está, no podemos ofrecerlo; en el listado oficial del MAEC (${MAEC_URL}) encontrarás traductores jurados de otras lenguas.`,
      fr: `Nous travaillons 10 langues avec l'espagnol : français, anglais, allemand, italien, portugais, catalan, néerlandais, suédois, norvégien et roumain. Si votre langue n'y figure pas, nous ne pouvons pas la proposer ; la liste officielle du MAEC (${MAEC_URL}) recense des traducteurs assermentés d'autres langues.`,
      en: `We work in 10 languages with Spanish: French, English, German, Italian, Portuguese, Catalan, Dutch, Swedish, Norwegian and Romanian. If yours isn't there, we can't offer it; the official MAEC list (${MAEC_URL}) has sworn translators for other languages.`,
      de: `Wir arbeiten in 10 Sprachen mit Spanisch: Französisch, Englisch, Deutsch, Italienisch, Portugiesisch, Katalanisch, Niederländisch, Schwedisch, Norwegisch und Rumänisch. Ist Ihre Sprache nicht dabei, können wir sie nicht anbieten; die offizielle MAEC-Liste (${MAEC_URL}) führt beeidigte Übersetzer anderer Sprachen.`,
      pt: `Trabalhamos 10 idiomas com o espanhol: francês, inglês, alemão, italiano, português, catalão, neerlandês, sueco, norueguês e romeno. Se o seu não estiver na lista, não podemos oferecê-lo; a lista oficial do MAEC (${MAEC_URL}) tem tradutores juramentados de outras línguas.`,
    },
  },
  {
    id: "datos",
    q: {
      es: "¿Qué hacéis con mis documentos y datos?",
      fr: "Que faites-vous de mes documents et de mes données ?",
      en: "What do you do with my documents and data?",
      de: "Was geschieht mit meinen Dokumenten und Daten?",
      pt: "O que fazem com os meus documentos e dados?",
    },
    a: {
      es: `Los usamos solo para preparar el presupuesto y la traducción. Los documentos se borran solos ${KEEP_DAYS} días después de la entrega.`,
      fr: `Nous les utilisons uniquement pour préparer le devis et la traduction. Les documents sont supprimés automatiquement ${KEEP_DAYS} jours après la livraison.`,
      en: `We use them only to prepare the quote and the translation. Documents are deleted automatically ${KEEP_DAYS} days after delivery.`,
      de: `Wir verwenden sie nur, um Angebot und Übersetzung vorzubereiten. Die Dokumente werden ${KEEP_DAYS} Tage nach der Lieferung automatisch gelöscht.`,
      pt: `Usamo-los apenas para preparar o orçamento e a tradução. Os documentos são apagados automaticamente ${KEEP_DAYS} dias após a entrega.`,
    },
  },
  {
    id: "original",
    q: {
      es: "¿Necesitáis el original en papel o vale una foto?",
      fr: "Faut-il l'original sur papier ou une photo suffit-elle ?",
      en: "Do you need the paper original, or is a photo enough?",
      de: "Brauchen Sie das Papieroriginal oder genügt ein Foto?",
      pt: "Precisam do original em papel ou basta uma foto?",
    },
    a: {
      es: "Nos basta una foto o escaneo legible de todas las páginas. Si el organismo te pide el original, consúltalo con él.",
      fr: "Une photo ou un scan lisible de toutes les pages nous suffit. Si l'organisme vous demande l'original, vérifiez-le auprès de lui.",
      en: "A legible photo or scan of every page is enough for us. If the authority asks you for the original, check that with them.",
      de: "Uns genügt ein gut lesbares Foto oder Scan aller Seiten. Verlangt die Stelle das Original, klären Sie das mit ihr.",
      pt: "Basta-nos uma foto ou digitalização legível de todas as páginas. Se o organismo lhe pedir o original, consulte-o.",
    },
  },
  {
    id: "caducado",
    q: {
      es: "Mi presupuesto ha caducado. ¿Qué hago?",
      fr: "Mon devis a expiré. Que faire ?",
      en: "My quote has expired. What do I do?",
      de: "Mein Angebot ist abgelaufen. Was tun?",
      pt: "O meu orçamento caducou. O que faço?",
    },
    a: {
      es: `Los presupuestos valen ${VALID_DAYS} días. Si ha caducado, respóndenos al email del presupuesto o escríbenos por WhatsApp (${WA}) y lo reactivamos.`,
      fr: `Les devis sont valables ${VALID_DAYS} jours. S'il a expiré, répondez à l'e-mail du devis ou écrivez-nous sur WhatsApp (${WA}) et nous le réactivons.`,
      en: `Quotes are valid for ${VALID_DAYS} days. If it has expired, reply to the quote email or message us on WhatsApp (${WA}) and we'll reactivate it.`,
      de: `Angebote gelten ${VALID_DAYS} Tage. Ist es abgelaufen, antworten Sie auf die Angebots-E-Mail oder schreiben Sie uns per WhatsApp (${WA}); wir reaktivieren es.`,
      pt: `Os orçamentos valem ${VALID_DAYS} dias. Se caducou, responda ao e-mail do orçamento ou escreva-nos por WhatsApp (${WA}) e nós o reativamos.`,
    },
  },
  {
    id: "tramites",
    q: {
      es: "¿Sirve para homologar un título o pedir la nacionalidad?",
      fr: "Est-ce valable pour faire homologuer un diplôme ou demander la nationalité ?",
      en: "Is it valid to validate a degree or apply for nationality?",
      de: "Ist sie für die Anerkennung eines Abschlusses oder einen Staatsangehörigkeitsantrag geeignet?",
      pt: "Serve para homologar um diploma ou pedir a nacionalidade?",
    },
    a: {
      es: "La traducción jurada es el documento que esos trámites suelen pedir, pero los requisitos concretos (qué documentos, apostilla, antigüedad) los fija el organismo. Tienes las guías en /blog/homologacion-titulo-universitario y /blog/nacionalidad-espanola-documentos.",
      fr: "La traduction assermentée est le document que ces démarches demandent habituellement, mais les exigences précises (quels documents, apostille, ancienneté) sont fixées par l'organisme. Guides (en espagnol) : /blog/homologacion-titulo-universitario et /blog/nacionalidad-espanola-documentos.",
      en: "A sworn translation is what these procedures usually ask for, but the exact requirements (which documents, apostille, age) are set by the authority. Guides (in Spanish): /blog/homologacion-titulo-universitario and /blog/nacionalidad-espanola-documentos.",
      de: "Die beeidigte Übersetzung ist das, was diese Verfahren üblicherweise verlangen; die genauen Anforderungen (welche Dokumente, Apostille, Alter) legt jedoch die Stelle fest. Leitfäden (auf Spanisch): /blog/homologacion-titulo-universitario und /blog/nacionalidad-espanola-documentos.",
      pt: "A tradução juramentada é o que esses trâmites costumam pedir, mas os requisitos concretos (que documentos, apostila, antiguidade) são fixados pelo organismo. Guias (em espanhol): /blog/homologacion-titulo-universitario e /blog/nacionalidad-espanola-documentos.",
    },
  },
];

export function faqItems(lang: FaqLang = "es"): { id: string; question: string; answer: string }[] {
  return FAQ_CLIENTE.map((e) => ({ id: e.id, question: e.q[lang], answer: e.a[lang] }));
}

/** Bloque estable (idéntico en cada petición, cacheable) para el prompt del chat. En español; el modelo responde en el idioma del cliente. */
export function faqPromptBlock(): string {
  return FAQ_CLIENTE.map((e) => `- **${e.q.es}** ${e.a.es}`).join("\n");
}

/** Variante para el conserje: sin la entrada de precio (el único importe permitido es «desde 30 € + IVA»). */
export function faqConserjeBlock(): string {
  return FAQ_CLIENTE.filter((e) => e.id !== "precio")
    .map((e) => `- ${e.q.es} → ${e.a.es}`)
    .join("\n");
}
