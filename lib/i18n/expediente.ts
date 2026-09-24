// lib/i18n/expediente.ts — Textos del intake público de expediente
// (components/ExpedientePublicIntake.tsx) en los 5 idiomas. Lo usan /expediente
// (es) y la pestaña «expediente grande» de las portadas por idioma.

import type { Locale } from "@/lib/i18n/locales";

export type ExpedienteStrings = {
  gateTitle: string;
  gateHelp: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  gdpr: string;
  privacy: string;
  locked: string;
  dropTitle: string;
  dropHint: string;
  dropAria: string;
  uploading: string;
  ready: string;
  failed: string;
  retry: string;
  remove: string;
  tooLarge: (name: string) => string;
  maxDocs: (n: number) => string;
  sendFail: string;
  connFail: string;
  submitSending: string;
  submitUploading: string;
  submit: (n: number) => string;
  doneTitle: string;
  doneRef: string;
  doneEmail: string;
  doneNext: string;
  doneCta: string;
};

export const expedienteT: Record<Locale, ExpedienteStrings> = {
  es: {
    gateTitle: "Antes de subir los documentos",
    gateHelp: "Con tu nombre, tu email, los idiomas y tu consentimiento guardamos el expediente y te enviamos el presupuesto. Si hay varios idiomas, indica el principal y cuéntanoslo en la nota.",
    name: "Nombre y apellidos",
    email: "Email",
    phone: "Teléfono (opcional)",
    notes: "¿Para qué trámite? (opcional)",
    gdpr: "Consiento el tratamiento de mis documentos para preparar un presupuesto de traducción jurada. Se eliminan automáticamente a los 30 días.",
    privacy: "Política de privacidad",
    locked: "Escribe tu nombre y tu email, elige los idiomas y marca la casilla para poder subir los documentos.",
    dropTitle: "Arrastra todos tus documentos",
    dropHint: "PDF, fotos, escaneos o ZIP · varios a la vez · hasta 300 documentos · máx. 500 MB c/u",
    dropAria: "Arrastra tus documentos aquí o pulsa para seleccionarlos",
    uploading: "Subiendo",
    ready: "Subido",
    failed: "No se pudo subir",
    retry: "Reintentar",
    remove: "Quitar",
    tooLarge: (n) => `"${n}" supera los 500 MB y se ha omitido.`,
    maxDocs: (n) => `Máximo ${n} documentos por expediente.`,
    sendFail: "No se pudo enviar el expediente.",
    connFail: "Error de conexión. Inténtalo de nuevo.",
    submitSending: "Enviando…",
    submitUploading: "Subiendo documentos…",
    submit: (n) => `Enviar expediente (${n} doc${n === 1 ? "" : "s"})`,
    doneTitle: "Expediente recibido",
    doneRef: "Referencia",
    doneEmail: "Te hemos enviado un email de confirmación a",
    doneNext: "Prepararemos tu presupuesto y te lo mandaremos por email.",
    doneCta: "Consultar mi expediente",
  },
  fr: {
    gateTitle: "Avant de déposer les documents",
    gateHelp: "Avec votre nom, votre e-mail, les langues et votre consentement, nous enregistrons le dossier et vous envoyons le devis. S'il y a plusieurs langues, indiquez la principale et précisez-le dans la note.",
    name: "Nom et prénom",
    email: "E-mail",
    phone: "Téléphone (facultatif)",
    notes: "Pour quelle démarche ? (facultatif)",
    gdpr: "J'accepte le traitement de mes documents pour préparer un devis de traduction assermentée. Ils sont supprimés automatiquement après 30 jours.",
    privacy: "Politique de confidentialité",
    locked: "Indiquez votre nom et votre e-mail, choisissez les langues et cochez la case pour pouvoir déposer les documents.",
    dropTitle: "Déposez tous vos documents",
    dropHint: "PDF, photos, scans ou ZIP · plusieurs à la fois · jusqu'à 300 documents · 500 Mo max. chacun",
    dropAria: "Déposez vos documents ici ou cliquez pour les sélectionner",
    uploading: "Envoi en cours",
    ready: "Envoyé",
    failed: "Échec de l'envoi",
    retry: "Réessayer",
    remove: "Retirer",
    tooLarge: (n) => `« ${n} » dépasse 500 Mo et a été ignoré.`,
    maxDocs: (n) => `Maximum ${n} documents par dossier.`,
    sendFail: "Le dossier n'a pas pu être envoyé.",
    connFail: "Erreur de connexion. Réessayez.",
    submitSending: "Envoi…",
    submitUploading: "Envoi des documents…",
    submit: (n) => `Envoyer le dossier (${n} doc${n === 1 ? "" : "s"})`,
    doneTitle: "Dossier reçu",
    doneRef: "Référence",
    doneEmail: "Nous vous avons envoyé un e-mail de confirmation à",
    doneNext: "Nous préparons votre devis et vous l'envoyons par e-mail.",
    doneCta: "Consulter mon dossier",
  },
  en: {
    gateTitle: "Before uploading your documents",
    gateHelp: "With your name, email, languages and consent we save the file and send you the quote. If there are several languages, pick the main one and tell us in the note.",
    name: "Full name",
    email: "Email",
    phone: "Phone (optional)",
    notes: "What is it for? (optional)",
    gdpr: "I consent to the processing of my documents to prepare a sworn translation quote. They are deleted automatically after 30 days.",
    privacy: "Privacy policy",
    locked: "Enter your name and email, choose the languages and tick the box to upload your documents.",
    dropTitle: "Drop all your documents here",
    dropHint: "PDF, photos, scans or ZIP · several at once · up to 300 documents · max. 500 MB each",
    dropAria: "Drop your documents here or click to select them",
    uploading: "Uploading",
    ready: "Uploaded",
    failed: "Upload failed",
    retry: "Retry",
    remove: "Remove",
    tooLarge: (n) => `"${n}" exceeds 500 MB and was skipped.`,
    maxDocs: (n) => `Maximum ${n} documents per file.`,
    sendFail: "The file could not be sent.",
    connFail: "Connection error. Please try again.",
    submitSending: "Sending…",
    submitUploading: "Uploading documents…",
    submit: (n) => `Send file (${n} doc${n === 1 ? "" : "s"})`,
    doneTitle: "File received",
    doneRef: "Reference",
    doneEmail: "We've sent a confirmation email to",
    doneNext: "We'll prepare your quote and email it to you.",
    doneCta: "View my file",
  },
  de: {
    gateTitle: "Bevor Sie die Dokumente hochladen",
    gateHelp: "Mit Ihrem Namen, Ihrer E-Mail, den Sprachen und Ihrer Einwilligung speichern wir die Akte und schicken Ihnen das Angebot. Bei mehreren Sprachen wählen Sie die wichtigste und vermerken es in der Notiz.",
    name: "Vor- und Nachname",
    email: "E-Mail",
    phone: "Telefon (optional)",
    notes: "Wofür brauchen Sie es? (optional)",
    gdpr: "Ich willige in die Verarbeitung meiner Dokumente zur Erstellung eines Angebots für eine beglaubigte Übersetzung ein. Sie werden nach 30 Tagen automatisch gelöscht.",
    privacy: "Datenschutzerklärung",
    locked: "Geben Sie Ihren Namen und Ihre E-Mail ein, wählen Sie die Sprachen und setzen Sie das Häkchen, um die Dokumente hochzuladen.",
    dropTitle: "Alle Dokumente hier ablegen",
    dropHint: "PDF, Fotos, Scans oder ZIP · mehrere auf einmal · bis zu 300 Dokumente · max. 500 MB je Datei",
    dropAria: "Dokumente hier ablegen oder klicken, um sie auszuwählen",
    uploading: "Wird hochgeladen",
    ready: "Hochgeladen",
    failed: "Upload fehlgeschlagen",
    retry: "Erneut versuchen",
    remove: "Entfernen",
    tooLarge: (n) => `„${n}“ überschreitet 500 MB und wurde übersprungen.`,
    maxDocs: (n) => `Maximal ${n} Dokumente pro Akte.`,
    sendFail: "Die Akte konnte nicht gesendet werden.",
    connFail: "Verbindungsfehler. Bitte erneut versuchen.",
    submitSending: "Wird gesendet…",
    submitUploading: "Dokumente werden hochgeladen…",
    submit: (n) => `Akte senden (${n} Dok.)`,
    doneTitle: "Akte erhalten",
    doneRef: "Referenz",
    doneEmail: "Wir haben eine Bestätigungs-E-Mail gesendet an",
    doneNext: "Wir erstellen Ihr Angebot und schicken es Ihnen per E-Mail.",
    doneCta: "Meine Akte ansehen",
  },
  pt: {
    gateTitle: "Antes de enviar os documentos",
    gateHelp: "Com o seu nome, o seu email, os idiomas e o seu consentimento guardamos o processo e enviamos-lhe o orçamento. Se houver vários idiomas, indique o principal e diga-nos na nota.",
    name: "Nome completo",
    email: "Email",
    phone: "Telefone (opcional)",
    notes: "Para que trâmite? (opcional)",
    gdpr: "Consinto o tratamento dos meus documentos para preparar um orçamento de tradução certificada. São eliminados automaticamente ao fim de 30 dias.",
    privacy: "Política de privacidade",
    locked: "Escreva o seu nome e o seu email, escolha os idiomas e marque a caixa para poder enviar os documentos.",
    dropTitle: "Arraste todos os seus documentos",
    dropHint: "PDF, fotos, digitalizações ou ZIP · vários de uma vez · até 300 documentos · máx. 500 MB cada",
    dropAria: "Arraste os seus documentos para aqui ou clique para os selecionar",
    uploading: "A enviar",
    ready: "Enviado",
    failed: "Não foi possível enviar",
    retry: "Tentar de novo",
    remove: "Remover",
    tooLarge: (n) => `"${n}" ultrapassa os 500 MB e foi ignorado.`,
    maxDocs: (n) => `Máximo ${n} documentos por processo.`,
    sendFail: "Não foi possível enviar o processo.",
    connFail: "Erro de ligação. Tente de novo.",
    submitSending: "A enviar…",
    submitUploading: "A enviar documentos…",
    submit: (n) => `Enviar processo (${n} doc${n === 1 ? "" : "s"})`,
    doneTitle: "Processo recebido",
    doneRef: "Referência",
    doneEmail: "Enviámos um email de confirmação para",
    doneNext: "Vamos preparar o seu orçamento e enviá-lo por email.",
    doneCta: "Consultar o meu processo",
  },
};
