export type TranslatorProfile = {
  id: string;
  fullName: string;
  swornNumber: string;
  aliases: string[];
};

export const BASE_TRANSLATOR_PROFILES: TranslatorProfile[] = [
  {
    id: "juan-silva-moreno",
    fullName: "Juan Silva Moreno",
    swornNumber: "3850",
    aliases: ["juan silva", "juan silva moreno"],
  },
  {
    id: "vanessa-bech-dennis",
    fullName: "Vanessa Bech Dennis",
    swornNumber: "8272",
    aliases: ["vanessa bech dennis", "vanessa bech"],
  },
  {
    id: "juan-amor",
    fullName: "Juan Amor",
    swornNumber: "132",
    aliases: ["juan amor"],
  },
];

function normalizeName(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function parseEnvCollaborators(): TranslatorProfile[] {
  const raw = String(process.env.TRANSLATOR_COLLABORATORS || "").trim();
  if (!raw) return [];

  // Format: "Nombre Apellido|3850;Otro Nombre|8272"
  return raw
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk, idx) => {
      const [nameRaw, numberRaw] = chunk.split("|");
      const fullName = String(nameRaw || "").trim();
      const swornNumber = String(numberRaw || "").trim();
      if (!fullName || !swornNumber) return null;
      return {
        id: `env-collab-${idx + 1}`,
        fullName,
        swornNumber,
        aliases: [fullName],
      } satisfies TranslatorProfile;
    })
    .filter((profile): profile is TranslatorProfile => !!profile);
}

export function getTranslatorProfiles() {
  return [...BASE_TRANSLATOR_PROFILES, ...parseEnvCollaborators()];
}

export function findTranslatorProfile(value?: string | null) {
  const normalized = normalizeName(value);
  if (!normalized) return null;
  const profiles = getTranslatorProfiles();
  return (
    profiles.find((profile) => {
      if (normalizeName(profile.fullName) === normalized) return true;
      return profile.aliases.some((alias) => normalizeName(alias) === normalized);
    }) || null
  );
}

export function formatTranslatorCredential(profile: TranslatorProfile) {
  return `${profile.fullName} · Traductor jurado Nº ${profile.swornNumber}`;
}
