// Los mensajes que el servidor de la puerta devuelve en español (lib/entrada/api.ts y flow.ts, motivos fijos de la
// vista y la subida), en el idioma de la página. Lo que no está aquí se enseña tal cual.
import type { EntradaLang } from "./i18n.ts";

type Otros = Record<Exclude<EntradaLang, "es">, string>;

const M: Record<string, Otros> = {
  "Ahora mismo no podemos revisar los archivos. Inténtalo en unos minutos.": { fr: "Nous ne pouvons pas examiner les fichiers pour le moment. Réessayez dans quelques minutes.", en: "We can't review the files right now. Try again in a few minutes.", de: "Wir können die Dateien gerade nicht prüfen. Versuchen Sie es in ein paar Minuten erneut.", pt: "Agora não podemos revisar os arquivos. Tente de novo em alguns minutos." },
  "Ahora no se puede cambiar.": { fr: "Ce n'est pas modifiable pour l'instant.", en: "This can't be changed now.", de: "Das lässt sich gerade nicht ändern.", pt: "Agora não se pode mudar." },
  "Archivo no válido.": { fr: "Fichier non valide.", en: "Invalid file.", de: "Ungültige Datei.", pt: "Arquivo inválido." },
  "Confirma tu email con el código para que podamos contestarte.": { fr: "Confirmez votre e-mail avec le code pour que nous puissions vous répondre.", en: "Confirm your email with the code so we can answer you.", de: "Bestätigen Sie Ihre E-Mail mit dem Code, damit wir antworten können.", pt: "Confirme o seu e-mail com o código para podermos responder." },
  "Confirma tu email con el código que te hemos enviado y revisamos tus archivos.": { fr: "Confirmez votre e-mail avec le code envoyé et nous examinons vos fichiers.", en: "Confirm your email with the code we sent and we review your files.", de: "Bestätigen Sie Ihre E-Mail mit dem gesendeten Code, dann prüfen wir Ihre Dateien.", pt: "Confirme o seu e-mail com o código enviado e revisamos os seus arquivos." },
  "Demasiados intentos. Pide un código nuevo.": { fr: "Trop d'essais. Demandez un nouveau code.", en: "Too many attempts. Ask for a new code.", de: "Zu viele Versuche. Fordern Sie einen neuen Code an.", pt: "Tentativas demais. Peça um código novo." },
  "Demasiados intentos. Prueba de nuevo en unos minutos.": { fr: "Trop d'essais. Réessayez dans quelques minutes.", en: "Too many attempts. Try again in a few minutes.", de: "Zu viele Versuche. Versuchen Sie es in ein paar Minuten erneut.", pt: "Tentativas demais. Tente de novo em alguns minutos." },
  "Dinos a qué idioma necesitas la traducción.": { fr: "Dites-nous vers quelle langue vous avez besoin de la traduction.", en: "Tell us which language you need the translation in.", de: "Sagen Sie uns, in welche Sprache übersetzt werden soll.", pt: "Diga-nos para que idioma precisa da tradução." },
  "El código ha caducado. Pide otro.": { fr: "Le code a expiré. Demandez-en un autre.", en: "The code has expired. Ask for another one.", de: "Der Code ist abgelaufen. Fordern Sie einen neuen an.", pt: "O código expirou. Peça outro." },
  "El código no es correcto.": { fr: "Le code n'est pas correct.", en: "The code is not correct.", de: "Der Code ist nicht korrekt.", pt: "O código não está correto." },
  "El idioma del documento y el de la traducción no pueden ser el mismo.": { fr: "La langue du document et celle de la traduction ne peuvent pas être identiques.", en: "The document language and the translation language can't be the same.", de: "Dokumentsprache und Zielsprache dürfen nicht gleich sein.", pt: "O idioma do documento e o da tradução não podem ser o mesmo." },
  "Ese archivo no está en tu solicitud.": { fr: "Ce fichier ne fait pas partie de votre demande.", en: "That file is not in your request.", de: "Diese Datei ist nicht in Ihrer Anfrage.", pt: "Esse arquivo não está no seu pedido." },
  "Ese email no parece válido.": { fr: "Cet e-mail ne semble pas valide.", en: "That email doesn't look valid.", de: "Diese E-Mail scheint ungültig zu sein.", pt: "Esse e-mail não parece válido." },
  "Ese teléfono no parece válido.": { fr: "Ce numéro ne semble pas valide.", en: "That phone number doesn't look valid.", de: "Diese Telefonnummer scheint ungültig zu sein.", pt: "Esse telefone não parece válido." },
  "Esta revisión ya no se puede cambiar.": { fr: "Cette vérification ne peut plus être modifiée.", en: "This review can no longer be changed.", de: "Diese Prüfung lässt sich nicht mehr ändern.", pt: "Esta revisão já não pode ser mudada." },
  "Esta solicitud ha cambiado: recarga la página.": { fr: "Cette demande a changé : rechargez la page.", en: "This request has changed: reload the page.", de: "Diese Anfrage hat sich geändert: Laden Sie die Seite neu.", pt: "Este pedido mudou: recarregue a página." },
  "Esta solicitud no existe o ha caducado.": { fr: "Cette demande n'existe pas ou a expiré.", en: "This request doesn't exist or has expired.", de: "Diese Anfrage existiert nicht oder ist abgelaufen.", pt: "Este pedido não existe ou expirou." },
  "Esta solicitud ya está enviada.": { fr: "Cette demande est déjà envoyée.", en: "This request has already been sent.", de: "Diese Anfrage wurde bereits gesendet.", pt: "Este pedido já foi enviado." },
  "Estamos revisando muchos documentos a la vez. Lo volvemos a intentar solos en un minuto.": { fr: "Nous examinons beaucoup de documents en même temps. Nous réessayons tout seuls dans une minute.", en: "We're reviewing many documents at once. We'll retry by ourselves in a minute.", de: "Wir prüfen gerade viele Dokumente gleichzeitig. Wir versuchen es in einer Minute selbst erneut.", pt: "Estamos revisando muitos documentos ao mesmo tempo. Tentamos de novo sozinhos em um minuto." },
  "Estamos revisando tus archivos: cambia el idioma en cuanto terminemos.": { fr: "Nous examinons vos fichiers : changez la langue dès que nous avons fini.", en: "We're reviewing your files: change the language once we finish.", de: "Wir prüfen Ihre Dateien: Ändern Sie die Sprache, sobald wir fertig sind.", pt: "Estamos revisando os seus arquivos: mude o idioma assim que terminarmos." },
  "Estamos revisando tus archivos: espera a que terminemos para añadir o quitar.": { fr: "Nous examinons vos fichiers : attendez la fin pour ajouter ou retirer.", en: "We're reviewing your files: wait until we finish to add or remove.", de: "Wir prüfen Ihre Dateien: Warten Sie, bis wir fertig sind, um etwas hinzuzufügen oder zu entfernen.", pt: "Estamos revisando os seus arquivos: espere terminarmos para adicionar ou remover." },
  "Falta el consentimiento para enviarte el presupuesto.": { fr: "Il manque votre accord pour vous envoyer le devis.", en: "We need your consent to send you the quote.", de: "Es fehlt Ihre Zustimmung, um Ihnen das Angebot zu senden.", pt: "Falta o consentimento para enviar o orçamento." },
  "Falta el email.": { fr: "Il manque l'e-mail.", en: "The email is missing.", de: "Die E-Mail fehlt.", pt: "Falta o e-mail." },
  "Hoy estamos revisando muchos documentos. Juan verá los tuyos personalmente: déjalos subidos y te escribimos.": { fr: "Nous examinons beaucoup de documents aujourd'hui. Juan regardera les vôtres personnellement : laissez-les envoyés et nous vous écrivons.", en: "We're reviewing many documents today. Juan will look at yours personally: leave them uploaded and we'll write to you.", de: "Heute prüfen wir viele Dokumente. Juan sieht sich Ihre persönlich an: Lassen Sie sie hochgeladen, wir schreiben Ihnen.", pt: "Hoje estamos revisando muitos documentos. Juan vai ver os seus pessoalmente: deixe-os enviados e escrevemos para você." },
  "Hoy ya has subido muchos archivos desde aquí. Déjanos tu email y seguimos, o inténtalo mañana.": { fr: "Vous avez déjà envoyé beaucoup de fichiers aujourd'hui. Laissez-nous votre e-mail et nous continuons, ou réessayez demain.", en: "You've already uploaded many files from here today. Leave us your email and we'll continue, or try tomorrow.", de: "Sie haben heute schon viele Dateien hochgeladen. Hinterlassen Sie Ihre E-Mail, dann machen wir weiter, oder versuchen Sie es morgen.", pt: "Hoje você já enviou muitos arquivos daqui. Deixe o seu e-mail e seguimos, ou tente amanhã." },
  "Indica para qué fecha lo necesitas (de hoy a un año vista).": { fr: "Indiquez pour quelle date vous en avez besoin (d'aujourd'hui à un an).", en: "Tell us the date you need it by (from today up to a year ahead).", de: "Geben Sie an, bis wann Sie es brauchen (von heute bis in einem Jahr).", pt: "Indique para que data precisa (de hoje até daqui a um ano)." },
  "Juan revisa estos documentos contigo: cuéntanos en «Algo más» lo que no haga falta traducir.": { fr: "Juan vérifie ces documents avec vous : dites-nous dans « Autre chose » ce qu'il n'est pas nécessaire de traduire.", en: "Juan reviews these documents with you: tell us under “Anything else” what doesn't need translating.", de: "Juan prüft diese Dokumente mit Ihnen: Schreiben Sie unter „Sonst noch etwas“, was nicht übersetzt werden muss.", pt: "Juan revisa estes documentos com você: diga em «Mais alguma coisa» o que não precisa traduzir." },
  "La revisión ha cambiado mientras la mirabas: repásala antes de enviarla.": { fr: "La vérification a changé pendant que vous la regardiez : relisez-la avant de l'envoyer.", en: "The review changed while you were looking at it: check it again before sending.", de: "Die Prüfung hat sich geändert, während Sie sie angesehen haben: Bitte vor dem Senden erneut ansehen.", pt: "A revisão mudou enquanto você a via: confira antes de enviar." },
  "La revisión ha cambiado: recarga la página.": { fr: "La vérification a changé : rechargez la page.", en: "The review has changed: reload the page.", de: "Die Prüfung hat sich geändert: Laden Sie die Seite neu.", pt: "A revisão mudou: recarregue a página." },
  "No disponible.": { fr: "Non disponible.", en: "Not available.", de: "Nicht verfügbar.", pt: "Não disponível." },
  "No hemos podido enviarte el código. Prueba de nuevo en un minuto.": { fr: "Nous n'avons pas pu vous envoyer le code. Réessayez dans une minute.", en: "We couldn't send you the code. Try again in a minute.", de: "Wir konnten Ihnen den Code nicht senden. Versuchen Sie es in einer Minute erneut.", pt: "Não conseguimos enviar o código. Tente de novo em um minuto." },
  "No hemos podido recibir ese archivo. Vuelve a subirlo.": { fr: "Nous n'avons pas pu recevoir ce fichier. Renvoyez-le.", en: "We couldn't receive that file. Upload it again.", de: "Wir konnten diese Datei nicht empfangen. Laden Sie sie erneut hoch.", pt: "Não conseguimos receber esse arquivo. Envie de novo." },
  "Primero revisamos tus archivos.": { fr: "Nous examinons d'abord vos fichiers.", en: "First we review your files.", de: "Zuerst prüfen wir Ihre Dateien.", pt: "Primeiro revisamos os seus arquivos." },
  "Revisa los datos.": { fr: "Vérifiez les données.", en: "Check the details.", de: "Bitte prüfen Sie die Angaben.", pt: "Confira os dados." },
  "Seguimos revisando tus archivos.": { fr: "Nous examinons toujours vos fichiers.", en: "We're still reviewing your files.", de: "Wir prüfen Ihre Dateien noch.", pt: "Ainda estamos revisando os seus arquivos." },
  "Sube al menos un archivo.": { fr: "Envoyez au moins un fichier.", en: "Upload at least one file.", de: "Laden Sie mindestens eine Datei hoch.", pt: "Envie pelo menos um arquivo." },
  "Tu email ya está confirmado.": { fr: "Votre e-mail est déjà confirmé.", en: "Your email is already confirmed.", de: "Ihre E-Mail ist bereits bestätigt.", pt: "O seu e-mail já está confirmado." },
  "Tus archivos han cambiado mientras los revisábamos: vuelve a pulsar «He terminado».": { fr: "Vos fichiers ont changé pendant notre lecture : appuyez de nouveau sur « Oui, tout y est ».", en: "Your files changed while we were reviewing them: press “Yes, that's all of them” again.", de: "Ihre Dateien haben sich während der Prüfung geändert: Drücken Sie erneut „Ja, das ist alles“.", pt: "Os seus arquivos mudaram enquanto os revisávamos: toque de novo em «Sim, estão todos»." },
  "Debes aceptar el tratamiento de datos para continuar.": { fr: "Vous devez accepter le traitement des données pour continuer.", en: "You must accept the data processing to continue.", de: "Sie müssen der Datenverarbeitung zustimmen, um fortzufahren.", pt: "Você deve aceitar o tratamento de dados para continuar." },
  "es una copia repetida de otra página": { fr: "c'est une copie d'une autre page", en: "it is a repeated copy of another page", de: "es ist eine doppelte Kopie einer anderen Seite", pt: "é uma cópia repetida de outra página" },
  "no se ha podido abrir": { fr: "n'a pas pu être ouvert", en: "could not be opened", de: "ließ sich nicht öffnen", pt: "não foi possível abrir" },
  "no hace falta traducirlo": { fr: "pas besoin de le traduire", en: "no need to translate it", de: "muss nicht übersetzt werden", pt: "não precisa traduzir" },
  "el cliente indica que no hace falta traducirlo": { fr: "vous avez indiqué qu'il n'est pas nécessaire de le traduire", en: "you said it doesn't need translating", de: "Sie haben angegeben, dass es nicht übersetzt werden muss", pt: "você indicou que não precisa traduzir" },
};

const CABEN = /^Caben como mucho (\d+) archivos\. Si tienes más, escríbenos y te ayudamos\.$/;
const CABEN_T: Record<Exclude<EntradaLang, "es">, (n: string) => string> = {
  fr: (n) => `${n} fichiers au maximum. Si vous en avez plus, écrivez-nous et nous vous aidons.`,
  en: (n) => `At most ${n} files fit. If you have more, write to us and we'll help.`,
  de: (n) => `Höchstens ${n} Dateien. Wenn Sie mehr haben, schreiben Sie uns, wir helfen Ihnen.`,
  pt: (n) => `Cabem no máximo ${n} arquivos. Se tiver mais, escreva-nos e ajudamos.`,
};

/** A server message in the page language; unknown messages pass through unchanged. */
export function enIdioma(lang: EntradaLang, es: string): string {
  if (lang === "es" || !es) return es;
  const exact = M[es.trim()];
  if (exact) return exact[lang];
  const n = CABEN.exec(es.trim());
  if (n) return CABEN_T[lang](n[1]);
  const pref = /^(el cliente indica que no hace falta traducirlo): (.+)$/.exec(es.trim());
  if (pref) return `${M[pref[1]][lang]}: ${pref[2]}`;
  return es;
}

export const MENSAJES_TRADUCIDOS = Object.keys(M);
