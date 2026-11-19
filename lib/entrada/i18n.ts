export type EntradaLang = "es" | "fr" | "en" | "de" | "pt";

type Strings = {
  startTitle: string; startSub: string; email: string; name: string; whatsapp: string; target: string; targetUnknown: string; source: string; sourceDetect: string; startBtn: string;
  uploadTitle: string; uploadSub: string; add: string; finished: string; askTitle: string; askBody: string; askYes: string; askMore: string;
  uploading: (n: string) => string; badType: (n: string) => string; tooBig: (n: string) => string; remove: (n: string) => string;
  reading: string; summary: (files: number, docs: number) => string; manual: string; pages: (n: number) => string; withApostille: string;
  notNeeded: string; wantIt: string; missing: (p: string) => string; illegible: string; excluded: string; notIncluded: string;
  questionsTitle: string; questionsHint: string; addRemove: string; targetRequired: string; choose: string;
  deadline: string; asap: string; date: string; flexible: string; organismo: string; organismoPh: string; notes: string; notesPh: string; confirm: string; sending: string;
  doneTitle: string; doneBody: string; again: string; noJuradoTitle: (l: string) => string; noJuradoBody: string; maecBtn: string; noJuradoFoot: string;
  oneMoment: string; startError: string; genericError: string;
};

const es: Strings = {
  startTitle: "Empecemos por ti", startSub: "Te escribimos aquí con el presupuesto cerrado. No hace falta crear cuenta.", email: "Email *", name: "Nombre", whatsapp: "WhatsApp (opcional)",
  target: "¿A qué idioma lo necesitas?", targetUnknown: "Aún no lo sé", source: "Idioma del documento", sourceDetect: "Lo vemos nosotros", startBtn: "Subir mis documentos",
  uploadTitle: "Tus documentos", uploadSub: "Sube todo lo que tengas: cada página, el reverso y la apostilla si la lleva. Varias fotos de un mismo documento valen; las juntamos nosotros.",
  add: "+ Añadir", finished: "He terminado", askTitle: "¿Has terminado?", askBody: "Revisamos el conjunto de una vez. Comprueba que están todas las páginas, el reverso si tiene algo escrito y la apostilla o legalización.",
  askYes: "Sí, ya están todos", askMore: "Añadir más", uploading: (n) => `Subiendo «${n}»…`, badType: (n) => `«${n}»: sube PDF o fotos (JPG, PNG, HEIC).`, tooBig: (n) => `«${n}» pasa de 20 MB.`, remove: (n) => `Quitar ${n}`,
  reading: "Estamos revisando el conjunto de tus archivos. Suele tardar uno o dos minutos…",
  summary: (f, d) => `Has subido ${f} ${f === 1 ? "archivo" : "archivos"} que corresponden a ${d} ${d === 1 ? "documento" : "documentos"}.`,
  manual: "No hemos podido revisarlos automáticamente. Juan los mira personalmente; dinos para cuándo lo necesitas y envíalo.",
  pages: (n) => `${n} ${n === 1 ? "página" : "páginas"}`, withApostille: " · con apostilla", notNeeded: "No hace falta traducirlo", wantIt: "Sí, quiero traducirlo",
  missing: (p) => `El documento numera más páginas: faltan la ${p}. Si las tienes, añádelas.`, illegible: "Se lee mal. Si puedes, vuelve a hacer la foto con más luz y sin reflejos.",
  excluded: "No incluido", notIncluded: "No incluido", questionsTitle: "Para que no falte nada", questionsHint: "Puedes contestar abajo, en «Algo más».", addRemove: "Añadir o quitar archivos",
  targetRequired: "¿A qué idioma necesitas la traducción? *", choose: "Elige", deadline: "¿Para cuándo lo necesitas? *", asap: "Lo antes posible", date: "Para una fecha", flexible: "Sin prisa",
  organismo: "¿Dónde lo vas a presentar? (organismo y país)", organismoPh: "Ej.: Consulado de Francia en Madrid", notes: "Algo más",
  notesPh: "Si lo necesitas en papel, a nombre de quién va, o lo que quieras contarnos", confirm: "Confirmar y enviar a Juan", sending: "Enviando…",
  doneTitle: "Recibido, gracias", doneBody: "Juan revisa tus documentos y te escribe con el presupuesto cerrado, normalmente en el día. Si le falta algo, te lo pide él.", again: "Empezar otra solicitud",
  noJuradoTitle: (l) => `Ahora mismo no tenemos traductor jurado de ${l}`, noJuradoBody: "Preferimos decírtelo ya a hacerte esperar. El Ministerio de Asuntos Exteriores publica la lista oficial de traductores jurados por idioma y provincia:",
  maecBtn: "Buscar en la lista oficial del MAEC", noJuradoFoot: "Juan ha recibido tu solicitud; si encontramos a alguien, te escribimos.",
  oneMoment: "Un momento…", startError: "No hemos podido empezar.", genericError: "Algo ha fallado.",
};

const fr: Strings = {
  startTitle: "Commençons par vous", startSub: "Nous vous écrivons ici avec le devis définitif. Pas besoin de créer de compte.", email: "E-mail *", name: "Nom", whatsapp: "WhatsApp (facultatif)",
  target: "Vers quelle langue ?", targetUnknown: "Je ne sais pas encore", source: "Langue du document", sourceDetect: "Nous la détectons", startBtn: "Envoyer mes documents",
  uploadTitle: "Vos documents", uploadSub: "Envoyez tout ce que vous avez : chaque page, le verso et l'apostille s'il y en a une. Plusieurs photos d'un même document conviennent ; nous les regroupons.",
  add: "+ Ajouter", finished: "J'ai terminé", askTitle: "Vous avez terminé ?", askBody: "Nous examinons l'ensemble en une fois. Vérifiez que toutes les pages sont là, le verso s'il est écrit et l'apostille ou la légalisation.",
  askYes: "Oui, tout y est", askMore: "Ajouter d'autres", uploading: (n) => `Envoi de « ${n} »…`, badType: (n) => `« ${n} » : envoyez un PDF ou des photos (JPG, PNG, HEIC).`, tooBig: (n) => `« ${n} » dépasse 20 Mo.`, remove: (n) => `Retirer ${n}`,
  reading: "Nous examinons l'ensemble de vos fichiers. Cela prend en général une ou deux minutes…",
  summary: (f, d) => `Vous avez envoyé ${f} ${f === 1 ? "fichier" : "fichiers"} qui correspondent à ${d} ${d === 1 ? "document" : "documents"}.`,
  manual: "Nous n'avons pas pu les examiner automatiquement. Juan les regarde personnellement ; dites-nous pour quand vous en avez besoin et envoyez.",
  pages: (n) => `${n} page${n === 1 ? "" : "s"}`, withApostille: " · avec apostille", notNeeded: "Pas besoin de le traduire", wantIt: "Oui, je veux le traduire",
  missing: (p) => `Le document numérote plus de pages : il manque la ${p}. Si vous les avez, ajoutez-les.`, illegible: "Il se lit mal. Si possible, refaites la photo avec plus de lumière et sans reflets.",
  excluded: "Non inclus", notIncluded: "Non inclus", questionsTitle: "Pour que rien ne manque", questionsHint: "Vous pouvez répondre plus bas, dans « Autre chose ».", addRemove: "Ajouter ou retirer des fichiers",
  targetRequired: "Vers quelle langue faut-il traduire ? *", choose: "Choisissez", deadline: "Pour quand en avez-vous besoin ? *", asap: "Au plus vite", date: "Pour une date", flexible: "Sans urgence",
  organismo: "Où allez-vous le présenter ? (organisme et pays)", organismoPh: "Ex. : Consulat d'Espagne à Paris", notes: "Autre chose",
  notesPh: "Si vous en avez besoin sur papier, au nom de qui, ou ce que vous voulez nous dire", confirm: "Confirmer et envoyer à Juan", sending: "Envoi…",
  doneTitle: "Bien reçu, merci", doneBody: "Juan examine vos documents et vous écrit avec le devis définitif, en général dans la journée. S'il manque quelque chose, il vous le demandera.", again: "Nouvelle demande",
  noJuradoTitle: (l) => `Nous n'avons pas de traducteur assermenté de ${l} pour le moment`, noJuradoBody: "Nous préférons vous le dire tout de suite. Le ministère espagnol des Affaires étrangères publie la liste officielle des traducteurs assermentés par langue et province :",
  maecBtn: "Chercher dans la liste officielle du MAEC", noJuradoFoot: "Juan a reçu votre demande ; si nous trouvons quelqu'un, nous vous écrivons.",
  oneMoment: "Un instant…", startError: "Impossible de commencer.", genericError: "Une erreur s'est produite.",
};

const en: Strings = {
  startTitle: "Let's start with you", startSub: "We'll write to you here with the final quote. No account needed.", email: "Email *", name: "Name", whatsapp: "WhatsApp (optional)",
  target: "Which language do you need it in?", targetUnknown: "I don't know yet", source: "Language of the document", sourceDetect: "We'll detect it", startBtn: "Upload my documents",
  uploadTitle: "Your documents", uploadSub: "Upload everything you have: every page, the back and the apostille if there is one. Several photos of the same document are fine; we put them together.",
  add: "+ Add", finished: "I'm done", askTitle: "Are you done?", askBody: "We review the whole set at once. Check that all pages are there, the back if anything is written on it, and the apostille or legalisation.",
  askYes: "Yes, that's all", askMore: "Add more", uploading: (n) => `Uploading “${n}”…`, badType: (n) => `“${n}”: upload a PDF or photos (JPG, PNG, HEIC).`, tooBig: (n) => `“${n}” is over 20 MB.`, remove: (n) => `Remove ${n}`,
  reading: "We're reviewing your files as a set. It usually takes a minute or two…",
  summary: (f, d) => `You uploaded ${f} ${f === 1 ? "file" : "files"} that make up ${d} ${d === 1 ? "document" : "documents"}.`,
  manual: "We couldn't review them automatically. Juan will look at them personally; tell us when you need it and send it.",
  pages: (n) => `${n} page${n === 1 ? "" : "s"}`, withApostille: " · with apostille", notNeeded: "No need to translate it", wantIt: "Yes, translate it",
  missing: (p) => `The document numbers more pages: page ${p} is missing. If you have it, add it.`, illegible: "It's hard to read. If you can, take the photo again with more light and no glare.",
  excluded: "Not included", notIncluded: "Not included", questionsTitle: "So nothing is missing", questionsHint: "You can answer below, under “Anything else”.", addRemove: "Add or remove files",
  targetRequired: "Which language do you need the translation in? *", choose: "Choose", deadline: "When do you need it? *", asap: "As soon as possible", date: "By a date", flexible: "No rush",
  organismo: "Where will you submit it? (authority and country)", organismoPh: "E.g. Spanish Consulate in London", notes: "Anything else",
  notesPh: "Whether you need it on paper, whose name it goes under, or anything you want to tell us", confirm: "Confirm and send to Juan", sending: "Sending…",
  doneTitle: "Received, thank you", doneBody: "Juan is reviewing your documents and will write to you with the final quote, usually the same day. If anything is missing, he'll ask you.", again: "Start another request",
  noJuradoTitle: (l) => `We don't have a sworn translator for ${l} right now`, noJuradoBody: "We'd rather tell you now than keep you waiting. The Spanish Ministry of Foreign Affairs publishes the official list of sworn translators by language and province:",
  maecBtn: "Search the official MAEC list", noJuradoFoot: "Juan has received your request; if we find someone, we'll write to you.",
  oneMoment: "One moment…", startError: "We couldn't start.", genericError: "Something went wrong.",
};

const de: Strings = {
  startTitle: "Zuerst zu Ihnen", startSub: "Wir schreiben Ihnen hierhin mit dem verbindlichen Angebot. Kein Konto nötig.", email: "E-Mail *", name: "Name", whatsapp: "WhatsApp (optional)",
  target: "In welche Sprache?", targetUnknown: "Weiß ich noch nicht", source: "Sprache des Dokuments", sourceDetect: "Erkennen wir", startBtn: "Dokumente hochladen",
  uploadTitle: "Ihre Dokumente", uploadSub: "Laden Sie alles hoch: jede Seite, die Rückseite und die Apostille, falls vorhanden. Mehrere Fotos desselben Dokuments sind in Ordnung; wir fügen sie zusammen.",
  add: "+ Hinzufügen", finished: "Fertig", askTitle: "Sind Sie fertig?", askBody: "Wir prüfen alles auf einmal. Bitte prüfen Sie, ob alle Seiten dabei sind, die Rückseite, falls beschrieben, und die Apostille oder Legalisation.",
  askYes: "Ja, das ist alles", askMore: "Mehr hinzufügen", uploading: (n) => `„${n}“ wird hochgeladen…`, badType: (n) => `„${n}“: bitte PDF oder Fotos (JPG, PNG, HEIC).`, tooBig: (n) => `„${n}“ ist größer als 20 MB.`, remove: (n) => `${n} entfernen`,
  reading: "Wir prüfen Ihre Dateien als Ganzes. Das dauert meist ein bis zwei Minuten…",
  summary: (f, d) => `Sie haben ${f} ${f === 1 ? "Datei" : "Dateien"} hochgeladen, die ${d} ${d === 1 ? "Dokument" : "Dokumente"} ergeben.`,
  manual: "Wir konnten sie nicht automatisch prüfen. Juan sieht sie sich persönlich an; sagen Sie uns, bis wann Sie es brauchen, und senden Sie ab.",
  pages: (n) => `${n} ${n === 1 ? "Seite" : "Seiten"}`, withApostille: " · mit Apostille", notNeeded: "Muss nicht übersetzt werden", wantIt: "Doch, übersetzen",
  missing: (p) => `Das Dokument nummeriert mehr Seiten: Seite ${p} fehlt. Wenn Sie sie haben, fügen Sie sie hinzu.`, illegible: "Schlecht lesbar. Wenn möglich, fotografieren Sie es mit mehr Licht und ohne Spiegelungen neu.",
  excluded: "Nicht enthalten", notIncluded: "Nicht enthalten", questionsTitle: "Damit nichts fehlt", questionsHint: "Sie können unten unter „Sonstiges“ antworten.", addRemove: "Dateien hinzufügen oder entfernen",
  targetRequired: "In welche Sprache soll übersetzt werden? *", choose: "Auswählen", deadline: "Bis wann brauchen Sie es? *", asap: "So bald wie möglich", date: "Bis zu einem Datum", flexible: "Keine Eile",
  organismo: "Wo reichen Sie es ein? (Behörde und Land)", organismoPh: "z. B. Spanisches Konsulat in Berlin", notes: "Sonstiges",
  notesPh: "Ob Sie es auf Papier brauchen, auf wessen Namen, oder was Sie uns sagen möchten", confirm: "Bestätigen und an Juan senden", sending: "Wird gesendet…",
  doneTitle: "Erhalten, danke", doneBody: "Juan prüft Ihre Dokumente und schreibt Ihnen mit dem verbindlichen Angebot, meist am selben Tag. Falls etwas fehlt, fragt er nach.", again: "Neue Anfrage",
  noJuradoTitle: (l) => `Derzeit haben wir keinen vereidigten Übersetzer für ${l}`, noJuradoBody: "Wir sagen es Ihnen lieber gleich. Das spanische Außenministerium veröffentlicht die offizielle Liste vereidigter Übersetzer nach Sprache und Provinz:",
  maecBtn: "In der offiziellen MAEC-Liste suchen", noJuradoFoot: "Juan hat Ihre Anfrage erhalten; wenn wir jemanden finden, schreiben wir Ihnen.",
  oneMoment: "Einen Moment…", startError: "Wir konnten nicht beginnen.", genericError: "Etwas ist schiefgelaufen.",
};

const pt: Strings = {
  startTitle: "Comecemos por você", startSub: "Escrevemos aqui com o orçamento fechado. Não precisa criar conta.", email: "E-mail *", name: "Nome", whatsapp: "WhatsApp (opcional)",
  target: "Para que idioma precisa?", targetUnknown: "Ainda não sei", source: "Idioma do documento", sourceDetect: "Nós detectamos", startBtn: "Enviar meus documentos",
  uploadTitle: "Seus documentos", uploadSub: "Envie tudo o que tiver: cada página, o verso e a apostila, se houver. Várias fotos do mesmo documento servem; nós as juntamos.",
  add: "+ Adicionar", finished: "Terminei", askTitle: "Terminou?", askBody: "Revisamos o conjunto de uma vez. Confira se estão todas as páginas, o verso se tiver algo escrito e a apostila ou legalização.",
  askYes: "Sim, está tudo", askMore: "Adicionar mais", uploading: (n) => `Enviando «${n}»…`, badType: (n) => `«${n}»: envie PDF ou fotos (JPG, PNG, HEIC).`, tooBig: (n) => `«${n}» passa de 20 MB.`, remove: (n) => `Remover ${n}`,
  reading: "Estamos revisando o conjunto dos seus arquivos. Costuma levar um ou dois minutos…",
  summary: (f, d) => `Você enviou ${f} ${f === 1 ? "arquivo" : "arquivos"} que correspondem a ${d} ${d === 1 ? "documento" : "documentos"}.`,
  manual: "Não conseguimos revisá-los automaticamente. Juan vai olhá-los pessoalmente; diga para quando precisa e envie.",
  pages: (n) => `${n} ${n === 1 ? "página" : "páginas"}`, withApostille: " · com apostila", notNeeded: "Não precisa traduzir", wantIt: "Sim, quero traduzir",
  missing: (p) => `O documento numera mais páginas: falta a ${p}. Se tiver, adicione.`, illegible: "Está difícil de ler. Se puder, tire a foto de novo com mais luz e sem reflexos.",
  excluded: "Não incluído", notIncluded: "Não incluído", questionsTitle: "Para não faltar nada", questionsHint: "Pode responder abaixo, em «Algo mais».", addRemove: "Adicionar ou remover arquivos",
  targetRequired: "Para que idioma precisa da tradução? *", choose: "Escolha", deadline: "Para quando precisa? *", asap: "O quanto antes", date: "Para uma data", flexible: "Sem pressa",
  organismo: "Onde vai apresentar? (órgão e país)", organismoPh: "Ex.: Consulado da Espanha em São Paulo", notes: "Algo mais",
  notesPh: "Se precisa em papel, em nome de quem, ou o que quiser nos contar", confirm: "Confirmar e enviar ao Juan", sending: "Enviando…",
  doneTitle: "Recebido, obrigado", doneBody: "Juan revisa seus documentos e escreve com o orçamento fechado, normalmente no mesmo dia. Se faltar algo, ele pede.", again: "Começar outro pedido",
  noJuradoTitle: (l) => `No momento não temos tradutor juramentado de ${l}`, noJuradoBody: "Preferimos dizer já a fazer você esperar. O Ministério de Assuntos Exteriores da Espanha publica a lista oficial de tradutores juramentados por idioma e província:",
  maecBtn: "Buscar na lista oficial do MAEC", noJuradoFoot: "Juan recebeu seu pedido; se encontrarmos alguém, escrevemos.",
  oneMoment: "Um momento…", startError: "Não conseguimos começar.", genericError: "Algo deu errado.",
};

export const ENTRADA_T: Record<EntradaLang, Strings> = { es, fr, en, de, pt };
