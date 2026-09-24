// lib/i18n/home-hero.ts — Copys del hero nuevo (maqueta 22-sep) en los 5
// idiomas. Lo consumen components/home/*. El aviso de WhatsApp vive en
// whatsapp-arrival.ts y el prefill de WhatsApp en puerta.ts (no se repiten).
//
// El H1 lleva la palabra clave de cada idioma: traducción jurada / traduction
// assermentée / sworn translation / beglaubigte Übersetzung / tradução
// certificada (juramentada).

import { LOCALE_HOME, type Locale, type Tr } from "@/lib/i18n/locales";

const tr = (es: string, fr: string, en: string, de: string, pt: string): Tr => ({ es, fr, en, de, pt });

/** Idiomas en los que habla el asistente (components/ChatWidget.tsx). En el
 *  resto, el panel del asistente se sustituye por WhatsApp. */
export const CHAT_LANGS: Locale[] = ["es", "fr"];

/** Las 5 portadas con hero nuevo (components/home/HomeHero.tsx): ya llevan su
 *  propio panel (chat anclado en es/fr, WhatsApp en en/de/pt), así que ni el
 *  globo flotante de WhatsApp (WhatsAppFloat) ni el del chat (ChatWidget) se
 *  montan ahí. */
export const NEW_HERO_HOME_PATHS = new Set(Object.values(LOCALE_HOME));

export const HOME_HERO = {
  // No repite el H1 (revisión 24-sep): la palabra clave va en el H1.
  eyebrow: tr(
    "10 idiomas · validez oficial en toda España · 100 % online",
    "10 langues · validité officielle dans toute l'Espagne · 100 % en ligne",
    "10 languages · official validity across Spain · 100% online",
    "10 Sprachen · amtlich gültig in ganz Spanien · 100 % online",
    "10 idiomas · validade oficial em toda a Espanha · 100 % online"
  ),
  h1: tr(
    "Traducción jurada oficial: cuéntanos tu trámite o sube tu documento",
    "Traduction assermentée officielle : dites-nous votre démarche ou déposez votre document",
    "Official sworn translation: tell us your procedure or upload your document",
    "Beglaubigte Übersetzung: Sagen Sie uns Ihr Anliegen oder laden Sie Ihr Dokument hoch",
    "Tradução certificada (juramentada) oficial: diga-nos o seu trâmite ou envie o seu documento"
  ),
  lede: tr(
    "Te decimos qué necesitas traducir, con qué validez y cuánto cuesta. En francés, precio cerrado al momento; en los demás idiomas, un traductor jurado te lo presupuesta en el día.",
    "Nous vous disons quoi traduire, avec quelle validité et à quel prix. Pour le français, prix ferme immédiat ; pour les autres langues, un traducteur assermenté vous envoie le devis dans la journée.",
    "We tell you what needs translating, with what validity and how much it costs. French: fixed price instantly; other languages: a sworn translator sends your quote the same day.",
    "Wir sagen Ihnen, was übersetzt werden muss, mit welcher Gültigkeit und zu welchem Preis. Französisch: Festpreis sofort; andere Sprachen: ein vereidigter Übersetzer schickt Ihnen das Angebot noch am selben Tag.",
    "Dizemos-lhe o que precisa de traduzir, com que validade e quanto custa. Em francês, preço fechado no momento; nos outros idiomas, um tradutor ajuramentado envia-lhe o orçamento no próprio dia."
  ),
  asistente: {
    title: tr("Escríbenos qué necesitas", "Dites-nous ce qu'il vous faut", "Tell us what you need", "Sagen Sie uns, was Sie brauchen", "Diga-nos o que precisa"),
    sub: tr(
      "Te guiamos paso a paso, como en WhatsApp",
      "On vous guide pas à pas, comme sur WhatsApp",
      "We guide you step by step, like on WhatsApp",
      "Wir führen Sie Schritt für Schritt, wie auf WhatsApp",
      "Guiamo-lo passo a passo, como no WhatsApp"
    ),
    label: tr("Tu trámite o tu duda", "Votre démarche ou votre question", "Your procedure or question", "Ihr Anliegen oder Ihre Frage", "O seu trâmite ou a sua dúvida"),
    placeholder: tr(
      "Ej.: nacionalidad, tengo el acta de nacimiento en árabe",
      "Ex. : nationalité, mon acte de naissance est en arabe",
      "e.g. citizenship, my birth certificate is in Arabic",
      "z. B. Einbürgerung, meine Geburtsurkunde ist auf Arabisch",
      "Ex.: nacionalidade, tenho a certidão de nascimento em árabe"
    ),
    button: tr("Preguntar", "Demander", "Ask", "Fragen", "Perguntar"),
    buttonAria: tr("Preguntar al asistente", "Demander à l'assistant", "Ask the assistant", "Den Assistenten fragen", "Perguntar ao assistente"),
    chipsAria: tr("Trámites frecuentes", "Démarches fréquentes", "Common procedures", "Häufige Anliegen", "Trâmites frequentes"),
    foot: tr(
      "El asistente te dice qué documentos hacen falta y con qué validez. Para el precio, sube el documento aquí al lado.",
      "L'assistant vous dit quels documents il faut et avec quelle validité. Pour le prix, déposez le document juste à côté.",
      "The assistant tells you which documents you need and with what validity. For the price, upload the document next to this panel.",
      "Der Assistent sagt Ihnen, welche Dokumente nötig sind und mit welcher Gültigkeit. Für den Preis laden Sie das Dokument nebenan hoch.",
      "O assistente diz-lhe que documentos são precisos e com que validade. Para o preço, envie o documento aqui ao lado."
    ),
    chips: [
      {
        label: tr("Nacionalidad española", "Nationalité espagnole", "Spanish citizenship", "Spanische Staatsbürgerschaft", "Nacionalidade espanhola"),
        short: tr("Nacionalidad", "Nationalité", "Citizenship", "Einbürgerung", "Nacionalidade"),
        question: tr(
          "Estoy con la nacionalidad española. ¿Qué documentos necesito traducir y cuánto cuesta?",
          "Je demande la nationalité espagnole. Quels documents dois-je faire traduire et à quel prix ?",
          "I'm applying for Spanish citizenship. Which documents do I need translated and how much does it cost?",
          "Ich beantrage die spanische Staatsbürgerschaft. Welche Dokumente muss ich übersetzen lassen und was kostet das?",
          "Estou a tratar da nacionalidade espanhola. Que documentos preciso de traduzir e quanto custa?"
        ),
      },
      {
        label: tr("Homologar un título", "Homologuer un diplôme", "Recognise a degree", "Abschluss anerkennen", "Homologar um diploma"),
        short: tr("Homologar título", "Diplôme", "Degree", "Abschluss", "Diploma"),
        question: tr(
          "Quiero homologar un título extranjero en España. ¿Qué tengo que traducir?",
          "Je veux faire homologuer un diplôme étranger en Espagne. Que dois-je faire traduire ?",
          "I want to have a foreign degree recognised in Spain. What do I need translated?",
          "Ich möchte einen ausländischen Abschluss in Spanien anerkennen lassen. Was muss ich übersetzen lassen?",
          "Quero homologar um diploma estrangeiro em Espanha. O que tenho de traduzir?"
        ),
      },
      {
        label: tr("Reagrupación familiar", "Regroupement familial", "Family reunification", "Familienzusammenführung", "Reagrupamento familiar"),
        short: tr("Reagrupación", "Regroupement", "Reunification", "Familie", "Reagrupamento"),
        question: tr(
          "Estoy con una reagrupación familiar. ¿Qué documentos deben llevar traducción jurada?",
          "Je fais un regroupement familial. Quels documents doivent avoir une traduction assermentée ?",
          "I'm applying for family reunification. Which documents need a sworn translation?",
          "Ich beantrage Familienzusammenführung. Welche Dokumente brauchen eine beglaubigte Übersetzung?",
          "Estou a tratar de um reagrupamento familiar. Que documentos precisam de tradução certificada?"
        ),
      },
      {
        label: tr("Me ha llegado una carta oficial", "J'ai reçu un courrier officiel", "I received an official letter", "Ich habe ein Behördenschreiben erhalten", "Recebi uma carta oficial"),
        short: tr("Carta oficial", "Courrier officiel", "Official letter", "Behördenbrief", "Carta oficial"),
        question: tr(
          "Me ha llegado una carta oficial en otro idioma y no sé qué me piden. ¿Me ayudáis?",
          "J'ai reçu un courrier officiel dans une autre langue et je ne sais pas ce qu'on me demande. Pouvez-vous m'aider ?",
          "I received an official letter in another language and I don't know what they're asking for. Can you help?",
          "Ich habe ein Behördenschreiben in einer anderen Sprache erhalten und weiß nicht, was verlangt wird. Können Sie helfen?",
          "Recebi uma carta oficial noutro idioma e não sei o que me pedem. Podem ajudar?"
        ),
      },
    ],
  },
  // Panel que sustituye al asistente en los idiomas que el chat no habla.
  whatsappPanel: {
    title: tr("Escríbenos por WhatsApp", "Écrivez-nous sur WhatsApp", "Message us on WhatsApp", "Schreiben Sie uns auf WhatsApp", "Escreva-nos pelo WhatsApp"),
    sub: tr("Te contestamos en el día", "Réponse dans la journée", "We reply the same day", "Antwort am selben Tag", "Respondemos no próprio dia"),
    body: tr(
      "Cuéntanos tu trámite y manda una foto del documento: un traductor jurado te responde con el precio, normalmente en el día.",
      "Décrivez votre démarche et envoyez une photo du document : un traducteur assermenté vous répond avec le prix, en général dans la journée.",
      "Tell us your procedure and send a photo of the document: a sworn translator replies with the price, usually within the day.",
      "Beschreiben Sie Ihr Anliegen und schicken Sie ein Foto des Dokuments: Ein vereidigter Übersetzer antwortet mit dem Preis, meist noch am selben Tag.",
      "Descreva o seu trâmite e envie uma foto do documento: um tradutor ajuramentado responde com o preço, normalmente no próprio dia."
    ),
    cta: tr("Abrir WhatsApp", "Ouvrir WhatsApp", "Open WhatsApp", "WhatsApp öffnen", "Abrir o WhatsApp"),
  },
  subida: {
    title: tr(
      "Sube o fotografía tu documento",
      "Déposez ou photographiez votre document",
      "Upload or photograph your document",
      "Dokument hochladen oder fotografieren",
      "Envie ou fotografe o seu documento"
    ),
    sub: tr(
      "Precio cerrado al momento en francés · en el día en los demás idiomas",
      "Prix ferme immédiat pour le français · dans la journée pour les autres langues",
      "Fixed price instantly for French · same day for other languages",
      "Festpreis sofort für Französisch · am selben Tag für andere Sprachen",
      "Preço fechado no momento em francês · no próprio dia nos outros idiomas"
    ),
    tabsAria: tr("Qué vas a subir", "Que déposez-vous ?", "What are you uploading?", "Was laden Sie hoch?", "O que vai enviar?"),
    langNavAria: tr("Idioma", "Langue", "Language", "Sprache", "Idioma"),
    tabOne: tr("Un documento", "Un document", "One document", "Ein Dokument", "Um documento"),
    tabOneHint: tr("Presupuesto al instante", "Devis immédiat", "Instant quote", "Sofortangebot", "Orçamento imediato"),
    tabMany: tr(
      "Varios documentos o expediente grande",
      "Plusieurs documents ou dossier volumineux",
      "Several documents or a large file",
      "Mehrere Dokumente oder große Akte",
      "Vários documentos ou processo grande"
    ),
    tabManyHint: tr(
      "Hasta 300 archivos, ZIP, 500 MB c/u",
      "Jusqu'à 300 fichiers, ZIP, 500 Mo chacun",
      "Up to 300 files, ZIP, 500 MB each",
      "Bis zu 300 Dateien, ZIP, je 500 MB",
      "Até 300 ficheiros, ZIP, 500 MB cada"
    ),
    manyIntroPre: tr(
      "Sube todos los documentos del expediente de una vez: PDF, fotos, escaneos o ZIP. Preparamos ",
      "Déposez tous les documents du dossier en une fois : PDF, photos, scans ou ZIP. Nous préparons ",
      "Upload all the documents in one go: PDF, photos, scans or ZIP. We prepare ",
      "Laden Sie alle Dokumente auf einmal hoch: PDF, Fotos, Scans oder ZIP. Wir erstellen ",
      "Envie todos os documentos do processo de uma vez: PDF, fotos, digitalizações ou ZIP. Preparamos "
    ),
    manyIntroStrong: tr("un presupuesto único", "un devis unique", "a single quote", "ein einziges Angebot", "um orçamento único"),
    manyIntroPost: tr(
      " y te lo enviamos por email.",
      " et vous l'envoyons par e-mail.",
      " and email it to you.",
      " und schicken es Ihnen per E-Mail.",
      " e enviamo-lo por email."
    ),
    loading: tr(
      "Preparando la subida del expediente…",
      "Préparation du dépôt du dossier…",
      "Preparing the file upload…",
      "Upload der Akte wird vorbereitet…",
      "A preparar o envio do processo…"
    ),
  },
  whatsapp: {
    prefer: tr("¿Prefieres WhatsApp?", "Vous préférez WhatsApp ?", "Prefer WhatsApp?", "Lieber WhatsApp?", "Prefere WhatsApp?"),
    writeShort: tr("Escríbenos", "Écrivez-nous", "Message us", "Schreiben Sie uns", "Escreva-nos"),
    sameDay: tr("te contestamos en el día", "réponse dans la journée", "we reply the same day", "Antwort am selben Tag", "respondemos no próprio dia"),
  },
  trust: [
    tr(
      "Traductores jurados nombrados por el Ministerio de Asuntos Exteriores",
      "Traducteurs assermentés nommés par le ministère espagnol des Affaires étrangères",
      "Sworn translators appointed by Spain's Ministry of Foreign Affairs",
      "Vom spanischen Außenministerium ernannte vereidigte Übersetzer",
      "Tradutores ajuramentados nomeados pelo Ministério dos Negócios Estrangeiros de Espanha"
    ),
    tr(
      "Pago seguro: tarjeta, Bizum o transferencia",
      "Paiement sécurisé : carte, Bizum ou virement",
      "Secure payment: card, Bizum or bank transfer",
      "Sichere Zahlung: Karte, Bizum oder Überweisung",
      "Pagamento seguro: cartão, Bizum ou transferência"
    ),
    tr(
      "Entrega en PDF firmado o en papel",
      "Livraison en PDF signé ou sur papier",
      "Delivery as a signed PDF or on paper",
      "Lieferung als signiertes PDF oder auf Papier",
      "Entrega em PDF assinado ou em papel"
    ),
  ],
  ratingAria: tr("4,8 de 5", "4,8 sur 5", "4.8 out of 5", "4,8 von 5", "4,8 em 5"),
};
