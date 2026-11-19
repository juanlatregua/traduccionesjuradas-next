import type { EntradaLang } from "./i18n.ts";

export type HiloStrings = {
  hola: string; email: string; name: string; whatsapp: string; start: string;
  faltaEmail: string; faltaConsent: string; falta: (items: string[]) => string;
  pideCodigo: (email: string) => string; codigoLabel: string; reenviar: string; codigoOk: string; faltaCodigo: string;
  pideOrigen: string; noSe: string; pideDestino: string; mismoIdioma: string; listo: string; choose: string;
  pideArchivos: string; add: string; terminado: string; faltaArchivo: string; preguntaTerminado: string; si: string; mas: string;
  pages: (n: number) => string; noAbre: string; quitar: (n: string) => string;
  inicio: (files: number, pages: number | null) => string; archivo: (name: string, pages: number | null) => string; agrupar: string; comprobar: string; casi: string;
  resumenLectura: (files: number, docs: number) => string; manual: string; conApostilla: string; faltan: (p: string) => string; ilegible: string;
  noNecesito: string; siNecesito: string; noIncluido: string;
  soloLecturaOtra: string; soloLecturaCaso: string; responder: string; enviarRespuesta: string;
  pidePlazo: string; asap: string; fecha: string; sinPrisa: string; para: (d: string) => string;
  pideLugar: string; pais: string; organismo: string; organismoPh: string; continuar: string; noSeAun: string;
  resumen: string; notas: string; notasPh: string; enviar: string; enviado: string;
  sinJurado: (l: string) => string; maec: string; tocar: string; cancelar: string; uploading: (n: string) => string; badType: (n: string) => string; tooBig: (n: string) => string; error: string;
};

const es: HiloStrings = {
  hola: "Hola. Así funciona: me dejas tu email, te mando un código para confirmarlo, subes tus documentos, los reviso todos juntos y Juan te manda el presupuesto cerrado, normalmente en el día.",
  email: "Email", name: "Nombre (opcional)", whatsapp: "WhatsApp (opcional)", start: "Empezar",
  faltaEmail: "un email válido", faltaConsent: "marcar las dos casillas", falta: (i) => `Para seguir falta: ${i.join(" y ")}.`,
  pideCodigo: (e) => `Te he mandado un código de 6 cifras a ${e}. Escríbelo o pégalo aquí.`, codigoLabel: "Código de 6 cifras", reenviar: "Enviar otro código", codigoOk: "Email confirmado, gracias.", faltaCodigo: "Faltan cifras: el código tiene 6.",
  pideOrigen: "¿En qué idioma está el documento?", noSe: "No lo sé", pideDestino: "¿A qué idioma lo necesitas? Puedes elegir más de uno.", mismoIdioma: "Es el mismo idioma que el del documento: elige otro.", listo: "Listo", choose: "Elige…",
  pideArchivos: "Sube tus documentos: cada página, el reverso si tiene algo y la apostilla si la lleva. Varias fotos de un mismo documento valen; las junto yo.",
  add: "Añadir archivos", terminado: "He terminado", faltaArchivo: "Sube al menos un archivo.", preguntaTerminado: "¿Están todos? Comprueba las páginas, el reverso y la apostilla.", si: "Sí, ya están todos", mas: "Añadir más",
  pages: (n) => `${n} ${n === 1 ? "pág." : "págs."}`, noAbre: "No se abre: vuelve a subirlo", quitar: (n) => `Quitar ${n}`,
  inicio: (f, p) => `Estoy revisando tus ${f} ${f === 1 ? "archivo" : "archivos"}${p ? ` (${p} ${p === 1 ? "página" : "páginas"})` : ""}…`,
  archivo: (n, p) => `Miro «${n}»${p && p > 1 ? `, ${p} páginas` : ""}…`, agrupar: "Agrupo las páginas que son del mismo documento…", comprobar: "Compruebo si falta alguna página o la apostilla…", casi: "Ya casi está…",
  resumenLectura: (f, d) => `Has subido ${f} ${f === 1 ? "archivo" : "archivos"} que corresponden a ${d} ${d === 1 ? "documento" : "documentos"}:`,
  manual: "No he podido revisarlos automáticamente. Juan los mira personalmente; sigamos con lo demás.", conApostilla: "con apostilla",
  faltan: (p) => `El documento numera más páginas: falta la ${p}. Si la tienes, añádela.`, ilegible: "Se lee mal: si puedes, haz otra foto con más luz.",
  noNecesito: "No hace falta traducirlo", siNecesito: "Sí, traducirlo", noIncluido: "No incluido",
  soloLecturaOtra: "Estos documentos ya los teníamos de otra solicitud, así que no puedes cambiarlos aquí. Si sobra o falta algo, cuéntamelo al final, en «Algo más», y Juan lo ajusta.",
  soloLecturaCaso: "Esto se suma a una solicitud tuya que ya estaba abierta, así que los documentos no se cambian aquí. El idioma sí: toca tu respuesta. Si sobra o falta algo, cuéntamelo al final, en «Algo más».",
  responder: "Tu respuesta", enviarRespuesta: "Responder",
  pidePlazo: "¿Para cuándo lo necesitas?", asap: "Lo antes posible", fecha: "Para una fecha", sinPrisa: "Sin prisa", para: (d) => `Para el ${d}`,
  pideLugar: "¿Dónde lo vas a presentar? Elige el país y, si lo sabes, el organismo.", pais: "País", organismo: "Organismo", organismoPh: "Ej.: Registro Civil, consulado, universidad…", continuar: "Continuar", noSeAun: "Aún no lo sé",
  resumen: "Perfecto. ¿Algo más que deba saber Juan? (si lo necesitas en papel, a nombre de quién va…)", notas: "Algo más (opcional)", notasPh: "Escribe aquí…", enviar: "Enviar a Juan",
  enviado: "Recibido. Juan revisa tus documentos y te escribe con el presupuesto cerrado, normalmente en el día. Si le falta algo, te lo pide él.",
  sinJurado: (l) => `Ahora mismo no tenemos traductor jurado de ${l}. Preferimos decírtelo ya: el Ministerio de Asuntos Exteriores publica la lista oficial de traductores jurados por idioma y provincia.`,
  maec: "Buscar en la lista oficial del MAEC", tocar: "Toca para cambiar", cancelar: "Cancelar",
  uploading: (n) => `Subiendo «${n}»…`, badType: (n) => `«${n}»: sube PDF o fotos (JPG, PNG, HEIC).`, tooBig: (n) => `«${n}» pasa de 20 MB.`, error: "Algo ha fallado. Inténtalo de nuevo.",
};

const fr: HiloStrings = {
  hola: "Bonjour. Voici comment ça marche : vous me laissez votre e-mail, je vous envoie un code pour le confirmer, vous envoyez vos documents, je les examine ensemble et Juan vous envoie le devis définitif, en général dans la journée.",
  email: "E-mail", name: "Nom (facultatif)", whatsapp: "WhatsApp (facultatif)", start: "Commencer",
  faltaEmail: "un e-mail valide", faltaConsent: "cocher les deux cases", falta: (i) => `Pour continuer, il manque : ${i.join(" et ")}.`,
  pideCodigo: (e) => `Je vous ai envoyé un code à 6 chiffres à ${e}. Saisissez-le ou collez-le ici.`, codigoLabel: "Code à 6 chiffres", reenviar: "Renvoyer un code", codigoOk: "E-mail confirmé, merci.", faltaCodigo: "Il manque des chiffres : le code en a 6.",
  pideOrigen: "Dans quelle langue est le document ?", noSe: "Je ne sais pas", pideDestino: "Vers quelle langue ? Vous pouvez en choisir plusieurs.", mismoIdioma: "C'est la même langue que celle du document : choisissez-en une autre.", listo: "Valider", choose: "Choisissez…",
  pideArchivos: "Envoyez vos documents : chaque page, le verso s'il est écrit et l'apostille s'il y en a une. Plusieurs photos d'un même document conviennent ; je les regroupe.",
  add: "Ajouter des fichiers", terminado: "J'ai terminé", faltaArchivo: "Envoyez au moins un fichier.", preguntaTerminado: "Tout y est ? Vérifiez les pages, le verso et l'apostille.", si: "Oui, tout y est", mas: "Ajouter d'autres",
  pages: (n) => `${n} p.`, noAbre: "Illisible : renvoyez-le", quitar: (n) => `Retirer ${n}`,
  inicio: (f, p) => `J'examine vos ${f} fichier${f === 1 ? "" : "s"}${p ? ` (${p} page${p === 1 ? "" : "s"})` : ""}…`,
  archivo: (n, p) => `Je regarde « ${n} »${p && p > 1 ? `, ${p} pages` : ""}…`, agrupar: "Je regroupe les pages d'un même document…", comprobar: "Je vérifie s'il manque une page ou l'apostille…", casi: "C'est presque fini…",
  resumenLectura: (f, d) => `Vous avez envoyé ${f} fichier${f === 1 ? "" : "s"} qui correspondent à ${d} document${d === 1 ? "" : "s"} :`,
  manual: "Je n'ai pas pu les examiner automatiquement. Juan les regarde personnellement ; continuons.", conApostilla: "avec apostille",
  faltan: (p) => `Le document numérote plus de pages : il manque la ${p}. Si vous l'avez, ajoutez-la.`, ilegible: "Il se lit mal : si possible, refaites la photo avec plus de lumière.",
  noNecesito: "Pas besoin de le traduire", siNecesito: "Oui, le traduire", noIncluido: "Non inclus",
  soloLecturaOtra: "Nous avions déjà ces documents d'une autre demande : vous ne pouvez pas les modifier ici. S'il manque ou s'il y a trop de choses, dites-le-moi à la fin, dans « Autre chose ».",
  soloLecturaCaso: "Cela s'ajoute à une demande déjà ouverte : les documents ne se modifient pas ici. La langue, si : touchez votre réponse. S'il manque quelque chose, dites-le-moi à la fin.",
  responder: "Votre réponse", enviarRespuesta: "Répondre",
  pidePlazo: "Pour quand en avez-vous besoin ?", asap: "Au plus vite", fecha: "Pour une date", sinPrisa: "Sans urgence", para: (d) => `Pour le ${d}`,
  pideLugar: "Où allez-vous le présenter ? Choisissez le pays et, si vous le savez, l'organisme.", pais: "Pays", organismo: "Organisme", organismoPh: "Ex. : état civil, consulat, université…", continuar: "Continuer", noSeAun: "Je ne sais pas encore",
  resumen: "Parfait. Autre chose que Juan doit savoir ? (sur papier, au nom de qui…)", notas: "Autre chose (facultatif)", notasPh: "Écrivez ici…", enviar: "Envoyer à Juan",
  enviado: "Bien reçu. Juan examine vos documents et vous écrit avec le devis définitif, en général dans la journée. S'il manque quelque chose, il vous le demandera.",
  sinJurado: (l) => `Nous n'avons pas de traducteur assermenté de ${l} pour le moment. Le ministère espagnol des Affaires étrangères publie la liste officielle par langue et province.`,
  maec: "Chercher dans la liste officielle du MAEC", tocar: "Touchez pour modifier", cancelar: "Annuler",
  uploading: (n) => `Envoi de « ${n} »…`, badType: (n) => `« ${n} » : envoyez un PDF ou des photos (JPG, PNG, HEIC).`, tooBig: (n) => `« ${n} » dépasse 20 Mo.`, error: "Une erreur s'est produite. Réessayez.",
};

const en: HiloStrings = {
  hola: "Hello. Here's how it works: you leave your email, I send you a code to confirm it, you upload your documents, I review them all together and Juan sends you the final quote, usually the same day.",
  email: "Email", name: "Name (optional)", whatsapp: "WhatsApp (optional)", start: "Start",
  faltaEmail: "a valid email", faltaConsent: "tick both boxes", falta: (i) => `To continue we still need: ${i.join(" and ")}.`,
  pideCodigo: (e) => `I've sent a 6-digit code to ${e}. Type or paste it here.`, codigoLabel: "6-digit code", reenviar: "Send another code", codigoOk: "Email confirmed, thanks.", faltaCodigo: "Digits missing: the code has 6.",
  pideOrigen: "Which language is the document in?", noSe: "I don't know", pideDestino: "Which language do you need it in? You can choose more than one.", mismoIdioma: "That's the document's own language: choose another.", listo: "Done", choose: "Choose…",
  pideArchivos: "Upload your documents: every page, the back if anything is on it and the apostille if there is one. Several photos of one document are fine; I put them together.",
  add: "Add files", terminado: "I'm done", faltaArchivo: "Upload at least one file.", preguntaTerminado: "Is that everything? Check the pages, the back and the apostille.", si: "Yes, that's all", mas: "Add more",
  pages: (n) => `${n} p.`, noAbre: "Can't be opened: upload it again", quitar: (n) => `Remove ${n}`,
  inicio: (f, p) => `I'm reviewing your ${f} file${f === 1 ? "" : "s"}${p ? ` (${p} page${p === 1 ? "" : "s"})` : ""}…`,
  archivo: (n, p) => `Looking at “${n}”${p && p > 1 ? `, ${p} pages` : ""}…`, agrupar: "Putting together pages of the same document…", comprobar: "Checking for missing pages or the apostille…", casi: "Almost done…",
  resumenLectura: (f, d) => `You uploaded ${f} file${f === 1 ? "" : "s"} that make up ${d} document${d === 1 ? "" : "s"}:`,
  manual: "I couldn't review them automatically. Juan will look at them personally; let's carry on.", conApostilla: "with apostille",
  faltan: (p) => `The document numbers more pages: page ${p} is missing. If you have it, add it.`, ilegible: "Hard to read: if you can, take another photo with more light.",
  noNecesito: "No need to translate it", siNecesito: "Yes, translate it", noIncluido: "Not included",
  soloLecturaOtra: "We already had these documents from another request, so you can't change them here. If anything is extra or missing, tell me at the end under “Anything else”.",
  soloLecturaCaso: "This adds to a request of yours that was already open, so the documents aren't changed here. The language can be: tap your answer. If anything is missing, tell me at the end.",
  responder: "Your answer", enviarRespuesta: "Reply",
  pidePlazo: "When do you need it?", asap: "As soon as possible", fecha: "By a date", sinPrisa: "No rush", para: (d) => `By ${d}`,
  pideLugar: "Where will you submit it? Choose the country and, if you know it, the authority.", pais: "Country", organismo: "Authority", organismoPh: "E.g. civil registry, consulate, university…", continuar: "Continue", noSeAun: "I don't know yet",
  resumen: "Perfect. Anything else Juan should know? (on paper, whose name it goes under…)", notas: "Anything else (optional)", notasPh: "Type here…", enviar: "Send to Juan",
  enviado: "Received. Juan is reviewing your documents and will write to you with the final quote, usually the same day. If anything is missing, he'll ask you.",
  sinJurado: (l) => `We don't have a sworn translator for ${l} right now. The Spanish Ministry of Foreign Affairs publishes the official list by language and province.`,
  maec: "Search the official MAEC list", tocar: "Tap to change", cancelar: "Cancel",
  uploading: (n) => `Uploading “${n}”…`, badType: (n) => `“${n}”: upload a PDF or photos (JPG, PNG, HEIC).`, tooBig: (n) => `“${n}” is over 20 MB.`, error: "Something went wrong. Try again.",
};

const de: HiloStrings = {
  hola: "Hallo. So geht's: Sie hinterlassen Ihre E-Mail, ich schicke Ihnen einen Code zur Bestätigung, Sie laden Ihre Dokumente hoch, ich prüfe alle zusammen und Juan schickt Ihnen das verbindliche Angebot, meist am selben Tag.",
  email: "E-Mail", name: "Name (optional)", whatsapp: "WhatsApp (optional)", start: "Los geht's",
  faltaEmail: "eine gültige E-Mail", faltaConsent: "beide Kästchen ankreuzen", falta: (i) => `Zum Weitermachen fehlt: ${i.join(" und ")}.`,
  pideCodigo: (e) => `Ich habe Ihnen einen 6-stelligen Code an ${e} geschickt. Tippen oder fügen Sie ihn hier ein.`, codigoLabel: "6-stelliger Code", reenviar: "Neuen Code senden", codigoOk: "E-Mail bestätigt, danke.", faltaCodigo: "Es fehlen Ziffern: der Code hat 6.",
  pideOrigen: "In welcher Sprache ist das Dokument?", noSe: "Weiß ich nicht", pideDestino: "In welche Sprache brauchen Sie es? Sie können mehrere wählen.", mismoIdioma: "Das ist die Sprache des Dokuments: wählen Sie eine andere.", listo: "Fertig", choose: "Auswählen…",
  pideArchivos: "Laden Sie Ihre Dokumente hoch: jede Seite, die Rückseite, falls beschrieben, und die Apostille, falls vorhanden. Mehrere Fotos eines Dokuments sind in Ordnung; ich füge sie zusammen.",
  add: "Dateien hinzufügen", terminado: "Fertig", faltaArchivo: "Laden Sie mindestens eine Datei hoch.", preguntaTerminado: "Ist alles dabei? Prüfen Sie Seiten, Rückseite und Apostille.", si: "Ja, das ist alles", mas: "Mehr hinzufügen",
  pages: (n) => `${n} S.`, noAbre: "Lässt sich nicht öffnen: neu hochladen", quitar: (n) => `${n} entfernen`,
  inicio: (f, p) => `Ich prüfe Ihre ${f} ${f === 1 ? "Datei" : "Dateien"}${p ? ` (${p} ${p === 1 ? "Seite" : "Seiten"})` : ""}…`,
  archivo: (n, p) => `Ich sehe mir „${n}“ an${p && p > 1 ? `, ${p} Seiten` : ""}…`, agrupar: "Ich füge Seiten desselben Dokuments zusammen…", comprobar: "Ich prüfe, ob eine Seite oder die Apostille fehlt…", casi: "Gleich fertig…",
  resumenLectura: (f, d) => `Sie haben ${f} ${f === 1 ? "Datei" : "Dateien"} hochgeladen, die ${d} ${d === 1 ? "Dokument" : "Dokumente"} ergeben:`,
  manual: "Ich konnte sie nicht automatisch prüfen. Juan sieht sie sich persönlich an; machen wir weiter.", conApostilla: "mit Apostille",
  faltan: (p) => `Das Dokument nummeriert mehr Seiten: Seite ${p} fehlt. Wenn Sie sie haben, fügen Sie sie hinzu.`, ilegible: "Schlecht lesbar: wenn möglich, ein neues Foto mit mehr Licht.",
  noNecesito: "Muss nicht übersetzt werden", siNecesito: "Doch, übersetzen", noIncluido: "Nicht enthalten",
  soloLecturaOtra: "Diese Dokumente hatten wir schon aus einer anderen Anfrage, daher können Sie sie hier nicht ändern. Wenn etwas fehlt oder zu viel ist, sagen Sie es mir am Ende unter „Sonstiges“.",
  soloLecturaCaso: "Das gehört zu einer bereits offenen Anfrage, daher werden die Dokumente hier nicht geändert. Die Sprache schon: tippen Sie auf Ihre Antwort. Fehlt etwas, sagen Sie es am Ende.",
  responder: "Ihre Antwort", enviarRespuesta: "Antworten",
  pidePlazo: "Bis wann brauchen Sie es?", asap: "So bald wie möglich", fecha: "Bis zu einem Datum", sinPrisa: "Keine Eile", para: (d) => `Bis ${d}`,
  pideLugar: "Wo reichen Sie es ein? Wählen Sie das Land und, falls bekannt, die Behörde.", pais: "Land", organismo: "Behörde", organismoPh: "z. B. Standesamt, Konsulat, Universität…", continuar: "Weiter", noSeAun: "Weiß ich noch nicht",
  resumen: "Perfekt. Sonst noch etwas für Juan? (auf Papier, auf wessen Namen…)", notas: "Sonstiges (optional)", notasPh: "Hier schreiben…", enviar: "An Juan senden",
  enviado: "Erhalten. Juan prüft Ihre Dokumente und schreibt Ihnen mit dem verbindlichen Angebot, meist am selben Tag. Falls etwas fehlt, fragt er nach.",
  sinJurado: (l) => `Derzeit haben wir keinen vereidigten Übersetzer für ${l}. Das spanische Außenministerium veröffentlicht die offizielle Liste nach Sprache und Provinz.`,
  maec: "In der offiziellen MAEC-Liste suchen", tocar: "Zum Ändern tippen", cancelar: "Abbrechen",
  uploading: (n) => `„${n}“ wird hochgeladen…`, badType: (n) => `„${n}“: bitte PDF oder Fotos (JPG, PNG, HEIC).`, tooBig: (n) => `„${n}“ ist größer als 20 MB.`, error: "Etwas ist schiefgelaufen. Bitte erneut versuchen.",
};

const pt: HiloStrings = {
  hola: "Olá. Funciona assim: você me deixa seu e-mail, eu envio um código para confirmá-lo, você envia seus documentos, eu reviso todos juntos e o Juan envia o orçamento fechado, normalmente no mesmo dia.",
  email: "E-mail", name: "Nome (opcional)", whatsapp: "WhatsApp (opcional)", start: "Começar",
  faltaEmail: "um e-mail válido", faltaConsent: "marcar as duas caixas", falta: (i) => `Para continuar falta: ${i.join(" e ")}.`,
  pideCodigo: (e) => `Enviei um código de 6 dígitos para ${e}. Digite ou cole aqui.`, codigoLabel: "Código de 6 dígitos", reenviar: "Enviar outro código", codigoOk: "E-mail confirmado, obrigado.", faltaCodigo: "Faltam dígitos: o código tem 6.",
  pideOrigen: "Em que idioma está o documento?", noSe: "Não sei", pideDestino: "Para que idioma precisa? Pode escolher mais de um.", mismoIdioma: "É o mesmo idioma do documento: escolha outro.", listo: "Pronto", choose: "Escolha…",
  pideArchivos: "Envie seus documentos: cada página, o verso se tiver algo e a apostila, se houver. Várias fotos do mesmo documento servem; eu as junto.",
  add: "Adicionar arquivos", terminado: "Terminei", faltaArchivo: "Envie pelo menos um arquivo.", preguntaTerminado: "Está tudo? Confira as páginas, o verso e a apostila.", si: "Sim, está tudo", mas: "Adicionar mais",
  pages: (n) => `${n} pág.`, noAbre: "Não abre: envie de novo", quitar: (n) => `Remover ${n}`,
  inicio: (f, p) => `Estou revisando seus ${f} ${f === 1 ? "arquivo" : "arquivos"}${p ? ` (${p} ${p === 1 ? "página" : "páginas"})` : ""}…`,
  archivo: (n, p) => `Olhando «${n}»${p && p > 1 ? `, ${p} páginas` : ""}…`, agrupar: "Juntando as páginas do mesmo documento…", comprobar: "Verificando se falta alguma página ou a apostila…", casi: "Quase pronto…",
  resumenLectura: (f, d) => `Você enviou ${f} ${f === 1 ? "arquivo" : "arquivos"} que correspondem a ${d} ${d === 1 ? "documento" : "documentos"}:`,
  manual: "Não consegui revisá-los automaticamente. O Juan vai olhá-los pessoalmente; vamos continuar.", conApostilla: "com apostila",
  faltan: (p) => `O documento numera mais páginas: falta a ${p}. Se tiver, adicione.`, ilegible: "Difícil de ler: se puder, tire outra foto com mais luz.",
  noNecesito: "Não precisa traduzir", siNecesito: "Sim, traduzir", noIncluido: "Não incluído",
  soloLecturaOtra: "Já tínhamos esses documentos de outro pedido, então não dá para mudá-los aqui. Se sobra ou falta algo, me diga no final, em «Algo mais».",
  soloLecturaCaso: "Isto se soma a um pedido seu que já estava aberto, então os documentos não mudam aqui. O idioma sim: toque na sua resposta. Se faltar algo, me diga no final.",
  responder: "Sua resposta", enviarRespuesta: "Responder",
  pidePlazo: "Para quando precisa?", asap: "O quanto antes", fecha: "Para uma data", sinPrisa: "Sem pressa", para: (d) => `Para ${d}`,
  pideLugar: "Onde vai apresentar? Escolha o país e, se souber, o órgão.", pais: "País", organismo: "Órgão", organismoPh: "Ex.: cartório, consulado, universidade…", continuar: "Continuar", noSeAun: "Ainda não sei",
  resumen: "Perfeito. Algo mais que o Juan deva saber? (em papel, em nome de quem…)", notas: "Algo mais (opcional)", notasPh: "Escreva aqui…", enviar: "Enviar ao Juan",
  enviado: "Recebido. O Juan revisa seus documentos e escreve com o orçamento fechado, normalmente no mesmo dia. Se faltar algo, ele pede.",
  sinJurado: (l) => `No momento não temos tradutor juramentado de ${l}. O Ministério de Assuntos Exteriores da Espanha publica a lista oficial por idioma e província.`,
  maec: "Buscar na lista oficial do MAEC", tocar: "Toque para mudar", cancelar: "Cancelar",
  uploading: (n) => `Enviando «${n}»…`, badType: (n) => `«${n}»: envie PDF ou fotos (JPG, PNG, HEIC).`, tooBig: (n) => `«${n}» passa de 20 MB.`, error: "Algo deu errado. Tente de novo.",
};

export const HILO_T: Record<EntradaLang, HiloStrings> = { es, fr, en, de, pt };

/** Countries offered in the «where» step (ISO 3166-1); names come from Intl in the client's language. */
export const PAISES = [
  "ES", "FR", "DE", "IT", "PT", "GB", "IE", "BE", "NL", "CH", "AT", "LU", "SE", "NO", "DK", "FI", "PL", "RO", "BG", "GR", "UA", "RU",
  "US", "CA", "MX", "CU", "DO", "VE", "CO", "EC", "PE", "BO", "CL", "AR", "UY", "PY", "BR",
  "MA", "DZ", "TN", "EG", "SN", "CI", "CM", "NG", "GQ", "CN", "IN", "PK", "PH", "TR", "AE", "SA", "IL", "AU",
] as const;
