// lib/i18n/funnel.ts — Copias del funnel de pago (layout + checkout +
// confirmación + acciones de pago) en es/fr. El francófono que entra por la
// puerta FR vive la promesa entera en su idioma, también al pagar.
//
// El idioma NO se deriva de la ruta (/checkout no es prefijo FR): se lee de
// OrderSession.clientLocale, capturado en la puerta (ver getSessionLocale).

export type FunnelLang = "es" | "fr";

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
    copied: (label: string) => string;
  };
};

export const funnelT: Record<FunnelLang, FunnelDict> = {
  es: {
    layout: {
      eyebrow: "Encargo de traducción jurada",
      title: "Proceso oficial guiado",
      subtitle:
        "Completa los pasos en orden. El sistema conserva tu sesión y evita pagos sin documento original.",
    },
    checkout: {
      regularizacionTitle: "Tarifa especial regularización 2026 · 25 € / documento",
      regularizacionBody:
        "Plazo del expediente: 30 de junio de 2026 (RD 316/2026). Entrega de la traducción jurada en PDF firmado digitalmente, 24h. Métodos de pago: Bizum, tarjeta, PayPal o transferencia.",
    },
    confirmation: {
      paidEyebrow: "Pago confirmado",
      paidTitle: "Pedido recibido correctamente",
      paidBody: (ref) =>
        `Referencia ${ref}. Te avisaremos de los siguientes hitos por SMS y email.`,
      pendingEyebrow: "Verificación en curso",
      pendingTitle: "Estamos validando tu pago",
      pendingBody:
        "Hemos recibido la vuelta del checkout y estamos esperando confirmación final del proveedor.",
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
      manualNote:
        "Los métodos manuales no marcan pago automático inmediato. Se revisan y se notifican por SMS y email.",
      copied: (label) => `Copiado: ${label}`,
    },
  },
  fr: {
    layout: {
      eyebrow: "Commande de traduction assermentée",
      title: "Démarche officielle guidée",
      subtitle:
        "Suivez les étapes dans l'ordre. Le système conserve votre session et empêche tout paiement sans document original.",
    },
    checkout: {
      regularizacionTitle: "Tarif spécial régularisation 2026 · 25 € / document",
      regularizacionBody:
        "Délai du dossier : 30 juin 2026 (RD 316/2026). Livraison de la traduction assermentée en PDF signé numériquement, 24h. Moyens de paiement : Bizum, carte, PayPal ou virement.",
    },
    confirmation: {
      paidEyebrow: "Paiement confirmé",
      paidTitle: "Commande bien reçue",
      paidBody: (ref) =>
        `Référence ${ref}. Nous vous informerons des prochaines étapes par SMS et e-mail.`,
      pendingEyebrow: "Vérification en cours",
      pendingTitle: "Nous validons votre paiement",
      pendingBody:
        "Nous avons reçu le retour du paiement et attendons la confirmation finale du prestataire.",
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
      manualNote:
        "Les moyens manuels ne valident pas le paiement immédiatement. Ils sont vérifiés et confirmés par SMS et e-mail.",
      copied: (label) => `Copié : ${label}`,
    },
  },
};
