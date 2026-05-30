// lib/i18n/funnel.ts — Copias del funnel de pago (layout + checkout +
// confirmación + acciones de pago) en los 5 idiomas (es·fr·en·de·pt). Quien
// entra por la puerta en su idioma vive la promesa entera, también al pagar.
//
// El idioma NO se deriva de la ruta (/checkout no es prefijo de idioma): se lee
// de OrderSession.clientLocale (capturado en la puerta) y se normaliza con
// resolveLocale (ver getSessionLocale).

import type { Locale } from "@/lib/i18n/locales";

export type FunnelLang = Locale;

type FunnelDict = {
  layout: { eyebrow: string; title: string; subtitle: string };
  checkout: { regularizacionTitle: string; regularizacionBody: string };
  confirmation: {
    paidEyebrow: string;
    paidTitle: string;
    paidBody: (ref: string) => string;
    pendingEyebrow: string;
    pendingTitle: string;
    pendingBody: string;
    backToCheckout: string;
    toClientArea: string;
  };
  pay: {
    heading: string;
    referenceLabel: string;
    totalLabel: string;
    accessLabel: string;
    currentStatus: string;
    authedGoogle: string;
    guest: string;
    continueGoogle: string;
    cardTitle: string;
    redirecting: string;
    payByCard: string;
    cardError: string;
    manualTitle: string;
    beneficiary: string;
    concept: string;
    manualNote: string;
    trust: string;
    copied: (label: string) => string;
  };
};

export const funnelT: Record<FunnelLang, FunnelDict> = {
  es: {
    layout: {
      eyebrow: "Encargo de traducción jurada",
      title: "Proceso oficial guiado",
      subtitle: "Completa los pasos en orden. El sistema conserva tu sesión y evita pagos sin documento original.",
    },
    checkout: {
      regularizacionTitle: "Tarifa especial regularización 2026 · 25 € / documento",
      regularizacionBody: "Plazo del expediente: 30 de junio de 2026 (RD 316/2026). Entrega de la traducción jurada en PDF firmado digitalmente, 24h. Métodos de pago: Bizum, tarjeta, PayPal o transferencia.",
    },
    confirmation: {
      paidEyebrow: "Pago confirmado",
      paidTitle: "Pedido recibido correctamente",
      paidBody: (ref) => `Referencia ${ref}. Te avisaremos de los siguientes hitos por SMS y email.`,
      pendingEyebrow: "Verificación en curso",
      pendingTitle: "Estamos validando tu pago",
      pendingBody: "Hemos recibido la vuelta del checkout y estamos esperando confirmación final del proveedor.",
      backToCheckout: "Volver a checkout",
      toClientArea: "Ir a área cliente",
    },
    pay: {
      heading: "Paso 4. Pago",
      referenceLabel: "Referencia",
      totalLabel: "Total",
      accessLabel: "Acceso",
      currentStatus: "Estado actual",
      authedGoogle: "Autenticado con Google",
      guest: "Invitado",
      continueGoogle: "Continuar con Google",
      cardTitle: "Tarjeta de crédito o débito",
      redirecting: "Redirigiendo...",
      payByCard: "Pagar con tarjeta",
      cardError: "No se pudo iniciar pago con tarjeta.",
      manualTitle: "Transferencia, Bizum o PayPal",
      beneficiary: "Beneficiario",
      concept: "Concepto",
      manualNote: "Los métodos manuales no marcan pago automático inmediato. Se revisan y se notifican por SMS y email.",
      trust: "Pago seguro · factura con IVA · traductor jurado acreditado por el MAEC · HBTJ Consultores Lingüísticos S.L.",
      copied: (label) => `Copiado: ${label}`,
    },
  },
  fr: {
    layout: {
      eyebrow: "Commande de traduction assermentée",
      title: "Démarche officielle guidée",
      subtitle: "Suivez les étapes dans l'ordre. Le système conserve votre session et empêche tout paiement sans document original.",
    },
    checkout: {
      regularizacionTitle: "Tarif spécial régularisation 2026 · 25 € / document",
      regularizacionBody: "Délai du dossier : 30 juin 2026 (RD 316/2026). Livraison de la traduction assermentée en PDF signé numériquement, 24h. Moyens de paiement : Bizum, carte, PayPal ou virement.",
    },
    confirmation: {
      paidEyebrow: "Paiement confirmé",
      paidTitle: "Commande bien reçue",
      paidBody: (ref) => `Référence ${ref}. Nous vous informerons des prochaines étapes par SMS et e-mail.`,
      pendingEyebrow: "Vérification en cours",
      pendingTitle: "Nous validons votre paiement",
      pendingBody: "Nous avons reçu le retour du paiement et attendons la confirmation finale du prestataire.",
      backToCheckout: "Retour au paiement",
      toClientArea: "Accéder à l'espace client",
    },
    pay: {
      heading: "Étape 4. Paiement",
      referenceLabel: "Référence",
      totalLabel: "Total",
      accessLabel: "Accès",
      currentStatus: "Statut actuel",
      authedGoogle: "Authentifié avec Google",
      guest: "Invité",
      continueGoogle: "Continuer avec Google",
      cardTitle: "Carte de crédit ou de débit",
      redirecting: "Redirection...",
      payByCard: "Payer par carte",
      cardError: "Impossible de lancer le paiement par carte.",
      manualTitle: "Virement, Bizum ou PayPal",
      beneficiary: "Bénéficiaire",
      concept: "Motif",
      manualNote: "Les moyens manuels ne valident pas le paiement immédiatement. Ils sont vérifiés et confirmés par SMS et e-mail.",
      trust: "Paiement sécurisé · facture avec TVA · traducteur assermenté accrédité par le MAEC · HBTJ Consultores Lingüísticos S.L.",
      copied: (label) => `Copié : ${label}`,
    },
  },
  en: {
    layout: {
      eyebrow: "Sworn translation order",
      title: "Guided official process",
      subtitle: "Complete the steps in order. The system keeps your session and prevents payments without the original document.",
    },
    checkout: {
      regularizacionTitle: "Special 2026 regularisation rate · €25 / document",
      regularizacionBody: "File deadline: 30 June 2026 (RD 316/2026). Sworn translation delivered as a digitally signed PDF, 24h. Payment methods: Bizum, card, PayPal or bank transfer.",
    },
    confirmation: {
      paidEyebrow: "Payment confirmed",
      paidTitle: "Order received successfully",
      paidBody: (ref) => `Reference ${ref}. We'll notify you of the next milestones by SMS and email.`,
      pendingEyebrow: "Verification in progress",
      pendingTitle: "We're validating your payment",
      pendingBody: "We've received the return from checkout and are awaiting final confirmation from the provider.",
      backToCheckout: "Back to checkout",
      toClientArea: "Go to client area",
    },
    pay: {
      heading: "Step 4. Payment",
      referenceLabel: "Reference",
      totalLabel: "Total",
      accessLabel: "Access",
      currentStatus: "Current status",
      authedGoogle: "Signed in with Google",
      guest: "Guest",
      continueGoogle: "Continue with Google",
      cardTitle: "Credit or debit card",
      redirecting: "Redirecting...",
      payByCard: "Pay by card",
      cardError: "We couldn't start the card payment.",
      manualTitle: "Bank transfer, Bizum or PayPal",
      beneficiary: "Beneficiary",
      concept: "Reference",
      manualNote: "Manual methods don't mark payment automatically. They're reviewed and confirmed by SMS and email.",
      trust: "Secure payment · invoice with VAT · sworn translator accredited by the MAEC · HBTJ Consultores Lingüísticos S.L.",
      copied: (label) => `Copied: ${label}`,
    },
  },
  de: {
    layout: {
      eyebrow: "Auftrag für beglaubigte Übersetzung",
      title: "Geführter offizieller Ablauf",
      subtitle: "Führen Sie die Schritte der Reihe nach aus. Das System bewahrt Ihre Sitzung und verhindert Zahlungen ohne Originaldokument.",
    },
    checkout: {
      regularizacionTitle: "Sondertarif Regularisierung 2026 · 25 € / Dokument",
      regularizacionBody: "Frist der Akte: 30. Juni 2026 (RD 316/2026). Lieferung der beglaubigten Übersetzung als digital signiertes PDF, 24 Std. Zahlungsmethoden: Bizum, Karte, PayPal oder Überweisung.",
    },
    confirmation: {
      paidEyebrow: "Zahlung bestätigt",
      paidTitle: "Bestellung erfolgreich erhalten",
      paidBody: (ref) => `Referenz ${ref}. Wir informieren Sie über die nächsten Schritte per SMS und E-Mail.`,
      pendingEyebrow: "Überprüfung läuft",
      pendingTitle: "Wir prüfen Ihre Zahlung",
      pendingBody: "Wir haben die Rückmeldung vom Checkout erhalten und warten auf die endgültige Bestätigung des Anbieters.",
      backToCheckout: "Zurück zum Checkout",
      toClientArea: "Zum Kundenbereich",
    },
    pay: {
      heading: "Schritt 4. Zahlung",
      referenceLabel: "Referenz",
      totalLabel: "Gesamt",
      accessLabel: "Zugang",
      currentStatus: "Aktueller Status",
      authedGoogle: "Mit Google angemeldet",
      guest: "Gast",
      continueGoogle: "Mit Google fortfahren",
      cardTitle: "Kredit- oder Debitkarte",
      redirecting: "Weiterleitung...",
      payByCard: "Mit Karte zahlen",
      cardError: "Kartenzahlung konnte nicht gestartet werden.",
      manualTitle: "Überweisung, Bizum oder PayPal",
      beneficiary: "Empfänger",
      concept: "Verwendungszweck",
      manualNote: "Manuelle Methoden markieren die Zahlung nicht automatisch. Sie werden geprüft und per SMS und E-Mail bestätigt.",
      trust: "Sichere Zahlung · Rechnung mit MwSt. · vom MAEC ermächtigter vereidigter Übersetzer · HBTJ Consultores Lingüísticos S.L.",
      copied: (label) => `Kopiert: ${label}`,
    },
  },
  pt: {
    layout: {
      eyebrow: "Encomenda de tradução certificada",
      title: "Processo oficial guiado",
      subtitle: "Conclua os passos por ordem. O sistema conserva a sua sessão e evita pagamentos sem documento original.",
    },
    checkout: {
      regularizacionTitle: "Tarifa especial regularização 2026 · 25 € / documento",
      regularizacionBody: "Prazo do processo: 30 de junho de 2026 (RD 316/2026). Entrega da tradução certificada em PDF assinado digitalmente, 24h. Métodos de pagamento: Bizum, cartão, PayPal ou transferência.",
    },
    confirmation: {
      paidEyebrow: "Pagamento confirmado",
      paidTitle: "Pedido recebido com sucesso",
      paidBody: (ref) => `Referência ${ref}. Avisaremos dos próximos passos por SMS e email.`,
      pendingEyebrow: "Verificação em curso",
      pendingTitle: "Estamos a validar o seu pagamento",
      pendingBody: "Recebemos o retorno do checkout e aguardamos a confirmação final do fornecedor.",
      backToCheckout: "Voltar ao checkout",
      toClientArea: "Ir para a área de cliente",
    },
    pay: {
      heading: "Passo 4. Pagamento",
      referenceLabel: "Referência",
      totalLabel: "Total",
      accessLabel: "Acesso",
      currentStatus: "Estado atual",
      authedGoogle: "Autenticado com Google",
      guest: "Convidado",
      continueGoogle: "Continuar com Google",
      cardTitle: "Cartão de crédito ou débito",
      redirecting: "A redirecionar...",
      payByCard: "Pagar com cartão",
      cardError: "Não foi possível iniciar o pagamento com cartão.",
      manualTitle: "Transferência, Bizum ou PayPal",
      beneficiary: "Beneficiário",
      concept: "Descrição",
      manualNote: "Os métodos manuais não marcam pagamento automático imediato. São verificados e notificados por SMS e email.",
      trust: "Pagamento seguro · fatura com IVA · tradutor ajuramentado acreditado pelo MAEC · HBTJ Consultores Lingüísticos S.L.",
      copied: (label) => `Copiado: ${label}`,
    },
  },
};
