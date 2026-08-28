// Tope de los carriles que mandan el fichero DENTRO de la petición
// (POST /api/estimador con FormData). Por encima, la plataforma responde 413
// con TEXTO PLANO ("Request Entity Too Large / FUNCTION_PAYLOAD_TOO_LARGE") y
// cualquier res.json() a ciegas revienta con un SyntaxError que acaba en la
// cara del cliente.
//
// Medido contra producción el 28-ago-2026: 3 MB y 4 MB pasan, 5 MB y 6 MB dan
// 413. El muro está en 4,5 MB; aquí se deja margen para el resto del multipart.
//
// La puerta (/presupuesto-instantaneo) NO tiene este problema: sube directo a
// Vercel Blob y admite 20 MB. Por eso el mensaje manda allí en vez de dejar al
// cliente con un error y sin salida.
export const MAX_INLINE_UPLOAD_BYTES = 4 * 1024 * 1024;

export const FILE_TOO_LARGE_MSG =
  "El documento pesa demasiado para calcularlo aquí (máx. 4 MB). Súbelo en el presupuesto instantáneo, que admite hasta 20 MB: /presupuesto-instantaneo";

/**
 * Lee la respuesta de /api/estimador sin fiarse de que sea JSON.
 * Devuelve el objeto ya parseado o lanza un Error con un mensaje que el cliente
 * pueda entender y accionar.
 */
export async function parseEstimadorResponse(res: Response): Promise<any> {
  if (res.status === 413) throw new Error(FILE_TOO_LARGE_MSG);
  const data = await res.json().catch(() => null);
  if (!data) throw new Error("No hemos podido leer la respuesta del servidor. Vuelve a intentarlo.");
  return data;
}
