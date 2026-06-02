// lib/i18n/lector-schema.ts — Datos estructurados + cuerpo AEO del lector de
// requerimientos (5 idiomas). FAQ y HowTo se renderizan a la vez como JSON-LD
// (para IAs/Google) y visibles en la página (donde está el tráfico citable).
// Foco de contenido (decisión Juan): homologación de títulos, NIE/residencia/
// extranjería y registro civil. Encuadre YMYL: orientativo, verifica siempre.

import type { Locale } from "@/lib/i18n/locales";
import type { FaqItem, HowTo } from "@/lib/i18n/home-schema";

export type TramiteBlurb = { title: string; body: string };

export const HOWTO_LECTOR: Record<Locale, HowTo> = {
  es: {
    name: "Cómo saber qué traducciones necesitas para tu trámite",
    description:
      "Sube la carta o notificación oficial y te explicamos en claro qué documentos te piden y cuáles necesitan traducción jurada.",
    steps: [
      { name: "Sube tu carta", text: "Sube una foto o el PDF de la notificación de la administración." },
      { name: "Lee el requerimiento", text: "La herramienta lee la carta y te dice qué documentos te piden, cuáles parecen exigir traducción jurada y qué legalización podría aplicar." },
      { name: "Pide las traducciones", text: "Si necesitas traducción jurada de algún documento, la pides al instante con precio y plazo cerrados." },
    ],
  },
  fr: {
    name: "Comment savoir quelles traductions il vous faut pour votre démarche",
    description:
      "Déposez le courrier officiel et nous vous expliquons clairement quels documents on vous demande et lesquels exigent une traduction assermentée.",
    steps: [
      { name: "Déposez votre courrier", text: "Déposez une photo ou le PDF de la notification de l'administration." },
      { name: "Lisez le courrier", text: "L'outil lit le courrier et vous indique quels documents on vous demande, lesquels semblent exiger une traduction assermentée et quelle légalisation pourrait s'appliquer." },
      { name: "Demandez les traductions", text: "Si une traduction assermentée est nécessaire, vous la commandez aussitôt avec prix et délai fermes." },
    ],
  },
  en: {
    name: "How to know which translations you need for your procedure",
    description:
      "Upload the official letter and we'll explain plainly which documents you're asked for and which need a sworn translation.",
    steps: [
      { name: "Upload your letter", text: "Upload a photo or the PDF of the authority's notice." },
      { name: "Read the request", text: "The tool reads the letter and tells you which documents you're asked for, which appear to require a sworn translation and what legalisation may apply." },
      { name: "Order the translations", text: "If you need a sworn translation, order it instantly with a fixed price and delivery time." },
    ],
  },
  de: {
    name: "So erfahren Sie, welche Übersetzungen Sie für Ihr Verfahren brauchen",
    description:
      "Laden Sie das behördliche Schreiben hoch und wir erklären klar, welche Dokumente verlangt werden und welche eine beglaubigte Übersetzung brauchen.",
    steps: [
      { name: "Schreiben hochladen", text: "Laden Sie ein Foto oder das PDF der behördlichen Mitteilung hoch." },
      { name: "Aufforderung lesen", text: "Das Werkzeug liest das Schreiben und nennt die verlangten Dokumente, welche eine beglaubigte Übersetzung zu erfordern scheinen und welche Legalisation gelten könnte." },
      { name: "Übersetzungen anfragen", text: "Wenn Sie eine beglaubigte Übersetzung brauchen, bestellen Sie sie sofort mit festem Preis und Liefertermin." },
    ],
  },
  pt: {
    name: "Como saber que traduções precisa para o seu trâmite",
    description:
      "Envie a notificação oficial e explicamos com clareza que documentos lhe pedem e quais precisam de tradução certificada.",
    steps: [
      { name: "Envie a sua carta", text: "Envie uma foto ou o PDF da notificação da administração." },
      { name: "Leia a notificação", text: "A ferramenta lê a carta e indica que documentos lhe pedem, quais parecem exigir tradução certificada e que legalização se pode aplicar." },
      { name: "Peça as traduções", text: "Se precisar de tradução certificada, pede-a na hora com preço e prazo fechados." },
    ],
  },
};

export const FAQ_LECTOR: Record<Locale, FaqItem[]> = {
  es: [
    {
      question: "¿Cómo sé qué traducciones necesito para mi trámite en España?",
      answer:
        "Sube la carta o notificación que te ha enviado la administración. La herramienta la lee y te dice, en tu idioma, qué documentos te piden y cuáles parecen necesitar traducción jurada. Es gratuita y orientativa: confirma siempre los requisitos con el organismo.",
    },
    {
      question: "¿Qué documentos hay que traducir para homologar un título extranjero en España?",
      answer:
        "Lo habitual es traducir el título y, según el caso, el certificado de notas o el expediente académico. Si el documento está en otro idioma, suele exigirse traducción jurada al español. La apostilla o legalización del original depende del país emisor. Verifícalo con el Ministerio competente.",
    },
    {
      question: "¿Cuándo exige traducción jurada un trámite de extranjería (NIE, residencia, arraigo)?",
      answer:
        "Los documentos públicos extranjeros redactados en otro idioma normalmente deben presentarse con traducción jurada al español. La propia notificación suele indicarlo. Sube tu carta y te señalamos qué documentos lo requerirían según su texto; confírmalo con la oficina de extranjería.",
    },
    {
      question: "¿El certificado de nacimiento o de antecedentes penales extranjero necesita apostilla además de traducción jurada?",
      answer:
        "Con frecuencia hacen falta las dos cosas: la apostilla o legalización sobre el documento original y, aparte, la traducción jurada. Que sea apostilla o legalización consular depende de si el país está en el Convenio de La Haya. Es un terreno con excepciones: confírmalo siempre con el organismo emisor y el receptor.",
    },
    {
      question: "¿Cuánto cuesta el lector y sustituye al criterio del organismo?",
      answer:
        "El lector es gratuito. Es una ayuda de orientación basada solo en el texto de tu carta; puede contener errores y no es asesoramiento jurídico ni sustituye lo que decida la administración. Úsalo para entender qué te piden y verifica los requisitos con el organismo competente.",
    },
  ],
  fr: [
    {
      question: "Comment savoir quelles traductions il me faut pour ma démarche en Espagne ?",
      answer:
        "Déposez le courrier que l'administration vous a envoyé. L'outil le lit et vous indique, dans votre langue, quels documents on vous demande et lesquels semblent nécessiter une traduction assermentée. C'est gratuit et indicatif : confirmez toujours les exigences auprès de l'organisme.",
    },
    {
      question: "Quels documents faut-il traduire pour faire homologuer un diplôme étranger en Espagne ?",
      answer:
        "On traduit généralement le diplôme et, selon le cas, le relevé de notes. Si le document est dans une autre langue, une traduction assermentée vers l'espagnol est souvent exigée. L'apostille ou la légalisation de l'original dépend du pays émetteur. Vérifiez auprès du ministère compétent.",
    },
    {
      question: "Quand une démarche d'immigration (NIE, résidence) exige-t-elle une traduction assermentée ?",
      answer:
        "Les documents publics étrangers rédigés dans une autre langue doivent normalement être présentés avec une traduction assermentée vers l'espagnol. La notification l'indique souvent. Déposez votre courrier et nous vous signalons les documents concernés d'après son texte ; confirmez auprès du bureau des étrangers.",
    },
    {
      question: "Un acte de naissance ou un casier judiciaire étranger doit-il être apostillé en plus d'être traduit ?",
      answer:
        "Souvent les deux sont nécessaires : l'apostille ou la légalisation sur le document original et, à part, la traduction assermentée. Apostille ou légalisation consulaire dépend de l'appartenance du pays à la Convention de La Haye. Il y a des exceptions : confirmez toujours auprès de l'organisme émetteur et destinataire.",
    },
    {
      question: "Combien coûte le lecteur et remplace-t-il l'appréciation de l'organisme ?",
      answer:
        "Le lecteur est gratuit. C'est une aide d'orientation fondée uniquement sur le texte de votre courrier ; il peut contenir des erreurs et ne constitue pas un conseil juridique ni ne remplace la décision de l'administration. Vérifiez les exigences auprès de l'organisme compétent.",
    },
  ],
  en: [
    {
      question: "How do I know which translations I need for my procedure in Spain?",
      answer:
        "Upload the letter the authority sent you. The tool reads it and tells you, in your language, which documents you're asked for and which appear to need a sworn translation. It's free and for guidance only: always confirm the requirements with the authority.",
    },
    {
      question: "Which documents must be translated to have a foreign degree recognised in Spain?",
      answer:
        "Usually the degree and, depending on the case, the academic transcript. If the document is in another language, a sworn translation into Spanish is often required. Whether the original needs an apostille or legalisation depends on the issuing country. Check with the competent ministry.",
    },
    {
      question: "When does an immigration procedure (NIE, residence) require a sworn translation?",
      answer:
        "Foreign public documents written in another language normally have to be filed with a sworn translation into Spanish. The notice itself usually says so. Upload your letter and we'll flag which documents would require it based on the text; confirm with the immigration office.",
    },
    {
      question: "Does a foreign birth certificate or criminal record need an apostille as well as a sworn translation?",
      answer:
        "Often both are needed: an apostille or legalisation on the original document and, separately, the sworn translation. Whether it's an apostille or consular legalisation depends on whether the country is in the Hague Convention. There are exceptions: always confirm with the issuing and receiving authorities.",
    },
    {
      question: "How much does the reader cost, and does it replace the authority's judgement?",
      answer:
        "The reader is free. It's a guidance aid based only on the text of your letter; it may contain errors and is not legal advice, nor does it replace what the administration decides. Use it to understand what's being asked and verify the requirements with the competent authority.",
    },
  ],
  de: [
    {
      question: "Woher weiß ich, welche Übersetzungen ich für mein Verfahren in Spanien brauche?",
      answer:
        "Laden Sie das Schreiben der Behörde hoch. Das Werkzeug liest es und nennt Ihnen in Ihrer Sprache, welche Dokumente verlangt werden und welche eine beglaubigte Übersetzung zu brauchen scheinen. Es ist kostenlos und nur orientierend: Bestätigen Sie die Anforderungen stets bei der Behörde.",
    },
    {
      question: "Welche Dokumente müssen für die Anerkennung eines ausländischen Abschlusses in Spanien übersetzt werden?",
      answer:
        "In der Regel das Abschlusszeugnis und je nach Fall die Notenübersicht. Ist das Dokument in einer anderen Sprache, wird oft eine beglaubigte Übersetzung ins Spanische verlangt. Ob das Original eine Apostille oder Legalisation braucht, hängt vom Ausstellerland ab. Prüfen Sie es beim zuständigen Ministerium.",
    },
    {
      question: "Wann verlangt ein Aufenthaltsverfahren (NIE, Residencia) eine beglaubigte Übersetzung?",
      answer:
        "Ausländische öffentliche Dokumente in einer anderen Sprache müssen normalerweise mit einer beglaubigten Übersetzung ins Spanische eingereicht werden. Die Mitteilung weist meist darauf hin. Laden Sie Ihr Schreiben hoch und wir markieren die betroffenen Dokumente anhand des Texts; bestätigen Sie es bei der Ausländerbehörde.",
    },
    {
      question: "Braucht eine ausländische Geburtsurkunde oder ein Führungszeugnis neben der beglaubigten Übersetzung auch eine Apostille?",
      answer:
        "Oft beides: eine Apostille oder Legalisation auf dem Originaldokument und, getrennt davon, die beglaubigte Übersetzung. Ob Apostille oder konsularische Legalisation hängt davon ab, ob das Land dem Haager Übereinkommen angehört. Es gibt Ausnahmen: Bestätigen Sie es immer bei ausstellender und empfangender Behörde.",
    },
    {
      question: "Was kostet der Leser und ersetzt er die Beurteilung der Behörde?",
      answer:
        "Der Leser ist kostenlos. Er ist eine Orientierungshilfe allein auf Basis des Texts Ihres Schreibens; er kann Fehler enthalten und ist keine Rechtsberatung und ersetzt nicht die Entscheidung der Verwaltung. Prüfen Sie die Anforderungen bei der zuständigen Behörde.",
    },
  ],
  pt: [
    {
      question: "Como sei que traduções preciso para o meu trâmite em Espanha?",
      answer:
        "Envie a carta que a administração lhe enviou. A ferramenta lê-a e indica, no seu idioma, que documentos lhe pedem e quais parecem precisar de tradução certificada. É grátis e meramente orientativa: confirme sempre os requisitos com o organismo.",
    },
    {
      question: "Que documentos é preciso traduzir para homologar um título estrangeiro em Espanha?",
      answer:
        "Normalmente o título e, conforme o caso, a certidão de notas. Se o documento estiver noutro idioma, costuma exigir-se tradução certificada para espanhol. A apostila ou legalização do original depende do país emissor. Verifique junto do ministério competente.",
    },
    {
      question: "Quando é que um trâmite de imigração (NIE, residência) exige tradução certificada?",
      answer:
        "Os documentos públicos estrangeiros redigidos noutro idioma normalmente têm de ser apresentados com tradução certificada para espanhol. A própria notificação costuma indicá-lo. Envie a sua carta e assinalamos que documentos a exigiriam segundo o texto; confirme junto do serviço de estrangeiros.",
    },
    {
      question: "Uma certidão de nascimento ou um registo criminal estrangeiro precisa de apostila além da tradução certificada?",
      answer:
        "Muitas vezes são precisas as duas coisas: a apostila ou legalização sobre o documento original e, à parte, a tradução certificada. Ser apostila ou legalização consular depende de o país pertencer à Convenção de Haia. Há exceções: confirme sempre junto do organismo emissor e recetor.",
    },
    {
      question: "Quanto custa o leitor e substitui o critério do organismo?",
      answer:
        "O leitor é grátis. É uma ajuda de orientação baseada apenas no texto da sua carta; pode conter erros e não é aconselhamento jurídico nem substitui o que a administração decida. Use-o para perceber o que lhe pedem e verifique os requisitos com o organismo competente.",
    },
  ],
};

export const LECTOR_TRAMITES: Record<Locale, TramiteBlurb[]> = {
  es: [
    { title: "Homologación de títulos", body: "Para homologar o dar equivalencia a un título extranjero suele pedirse el título y el expediente académico traducidos al español por traductor jurado, más la apostilla o legalización del original según el país." },
    { title: "NIE, residencia y extranjería", body: "Los documentos extranjeros que acompañan a una solicitud de NIE, residencia, arraigo o reagrupación familiar normalmente se presentan con traducción jurada al español; la notificación suele detallar cuáles." },
    { title: "Registro civil (nacimiento, matrimonio, penales)", body: "Certificados de nacimiento, matrimonio o antecedentes penales emitidos fuera de España suelen requerir traducción jurada y, además, apostilla o legalización del documento original." },
  ],
  fr: [
    { title: "Homologation de diplômes", body: "Pour faire homologuer ou reconnaître un diplôme étranger, on demande souvent le diplôme et le relevé de notes traduits en espagnol par un traducteur assermenté, plus l'apostille ou la légalisation de l'original selon le pays." },
    { title: "NIE, résidence et immigration", body: "Les documents étrangers joints à une demande de NIE, de résidence, d'arraigo ou de regroupement familial se présentent normalement avec une traduction assermentée vers l'espagnol ; la notification précise généralement lesquels." },
    { title: "État civil (naissance, mariage, casier)", body: "Les actes de naissance, de mariage ou les casiers judiciaires délivrés hors d'Espagne exigent souvent une traduction assermentée et, en plus, l'apostille ou la légalisation du document original." },
  ],
  en: [
    { title: "Recognition of degrees", body: "To have a foreign degree recognised, you're often asked for the degree and the academic transcript translated into Spanish by a sworn translator, plus an apostille or legalisation of the original depending on the country." },
    { title: "NIE, residence and immigration", body: "Foreign documents filed with a NIE, residence, arraigo or family-reunification application are normally submitted with a sworn translation into Spanish; the notice usually spells out which ones." },
    { title: "Civil registry (birth, marriage, criminal record)", body: "Birth, marriage or criminal-record certificates issued outside Spain often need a sworn translation and, in addition, an apostille or legalisation of the original document." },
  ],
  de: [
    { title: "Anerkennung von Abschlüssen", body: "Für die Anerkennung eines ausländischen Abschlusses werden oft das Zeugnis und die Notenübersicht in beglaubigter Übersetzung ins Spanische verlangt, dazu Apostille oder Legalisation des Originals je nach Land." },
    { title: "NIE, Aufenthalt und Migration", body: "Ausländische Dokumente zu einem Antrag auf NIE, Aufenthalt, Arraigo oder Familienzusammenführung werden normalerweise mit beglaubigter Übersetzung ins Spanische eingereicht; die Mitteilung nennt meist, welche." },
    { title: "Personenstand (Geburt, Heirat, Führungszeugnis)", body: "Geburts-, Heirats- oder Führungszeugnisurkunden von außerhalb Spaniens brauchen oft eine beglaubigte Übersetzung und zusätzlich eine Apostille oder Legalisation des Originals." },
  ],
  pt: [
    { title: "Homologação de títulos", body: "Para homologar ou reconhecer um título estrangeiro costuma pedir-se o título e a certidão de notas traduzidos para espanhol por tradutor certificado, mais a apostila ou legalização do original conforme o país." },
    { title: "NIE, residência e imigração", body: "Os documentos estrangeiros juntos a um pedido de NIE, residência, arraigo ou reagrupamento familiar apresentam-se normalmente com tradução certificada para espanhol; a notificação costuma detalhar quais." },
    { title: "Registo civil (nascimento, casamento, criminal)", body: "Certidões de nascimento, casamento ou registo criminal emitidas fora de Espanha costumam exigir tradução certificada e, além disso, apostila ou legalização do documento original." },
  ],
};
