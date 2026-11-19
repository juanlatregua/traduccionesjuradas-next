import type { Canal } from "./identidad.ts";

export const ENTRADA_ESTADOS = ["abierta", "leida", "confirmada", "sin_jurado", "prueba"] as const;
export type EntradaEstado = (typeof ENTRADA_ESTADOS)[number];

export type EntradaRow = {
  id: string;
  canal: Canal;
  estado: EntradaEstado;
  casoId: string | null;
  loteId: string | null;
  regla: string | null;
  posibles: string[];
  relacionados: string[];
  source: string | null;
  lang: string | null;
  email: string | null;
  phone9: string | null;
  nombre: string | null;
  sourceLang: string | null;
  targetLang: string | null;
  /** One line per pair: every target the client asked for (targetLang is the first). */
  targetLangs: string[];
  pais: string | null;
  respuestas: { pregunta: string; respuesta: string }[] | null;
  urgency: string | null;
  neededBy: Date | null;
  organismo: string | null;
  notas: string | null;
  confirmedAt: Date | null;
  emailVerifiedAt: Date | null;
  codeHash: string | null;
  codeExpiresAt: Date | null;
  codeAttempts: number;
  createdAt: Date;
  updatedAt: Date;
};

export type NuevaEntrada = Pick<EntradaRow, "canal" | "email" | "phone9" | "nombre" | "sourceLang" | "targetLang" | "targetLangs" | "source" | "lang"> & {
  tokenHash: string;
  ipHash: string | null;
  emailVerifiedAt: Date | null;
  gdprConsentAt: Date;
  marketingConsentAt: Date | null;
};

/** pages: counted when it was uploaded (0 = could not be opened, null = not counted). */
export type ArchivoRow = { id: string; name: string; url: string; mimeType: string; size: number; sha256: string; pages: number | null };

export type EntradaPatch = Partial<Pick<EntradaRow, "estado" | "casoId" | "loteId" | "regla" | "posibles" | "relacionados" | "sourceLang" | "targetLang" | "targetLangs" | "pais" | "respuestas" | "urgency" | "neededBy" | "organismo" | "notas" | "confirmedAt" | "emailVerifiedAt" | "codeHash" | "codeExpiresAt" | "codeAttempts">>;

export type EntradaStore = {
  create(data: NuevaEntrada): Promise<EntradaRow>;
  byTokenHash(tokenHash: string): Promise<EntradaRow | null>;
  get(id: string): Promise<EntradaRow | null>;
  files(entradaId: string): Promise<ArchivoRow[]>;
  /** The file row carries the entrada's contact and consent, and its caso once known. */
  addFile(entrada: EntradaRow, file: Omit<ArchivoRow, "id">): Promise<ArchivoRow>;
  removeFile(entradaId: string, fileId: string): Promise<boolean>;
  /** Applies only while the entrada is in one of `onlyIn`. */
  update(id: string, patch: EntradaPatch, onlyIn: readonly EntradaEstado[]): Promise<boolean>;
  linkFilesToCaso(entradaId: string, casoId: string): Promise<void>;
  /** Consumes one verification attempt while fewer than `max` were used; false when none are left. */
  takeAttempt(id: string, max: number): Promise<boolean>;
};

export const sessionKeyOf = (entradaId: string) => `entrada:${entradaId}`;
