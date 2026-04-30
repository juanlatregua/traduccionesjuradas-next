
type Props = { id?: string };

export function SchemaPerson({ id }: Props) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": "https://www.traduccionesjuradas.net/traductores-jurados#juan-silva",
    name: "Juan Silva Moreno",
    givenName: "Juan",
    familyName: "Silva Moreno",
    image: "https://www.traduccionesjuradas.net/team/juan-silva.jpg",
    jobTitle: "Traductor-intérprete jurado de francés",
    description:
      "Traductor-intérprete jurado de francés nombrado por el Ministerio de Asuntos Exteriores de España (MAEC nº 3850). Especializado en documentación civil, académica, jurídica y mercantil entre francés y español.",
    identifier: {
      "@type": "PropertyValue",
      propertyID: "MAEC Spain — Traductor-intérprete jurado",
      value: "3850",
    },
    url: "https://www.traduccionesjuradas.net/traductores-jurados",
    worksFor: {
      "@type": "Organization",
      "@id": "https://www.traduccionesjuradas.net/#organization",
      name: "HBTJ Consultores Lingüísticos S.L.",
      url: "https://www.traduccionesjuradas.net",
    },
    knowsLanguage: ["es", "fr", "en"],
    hasCredential: {
      "@type": "EducationalOccupationalCredential",
      credentialCategory: "Traductor-intérprete jurado",
      identifier: "3850",
      recognizedBy: {
        "@type": "GovernmentOrganization",
        name: "Ministerio de Asuntos Exteriores de España",
        url: "https://www.exteriores.gob.es",
      },
    },
    sameAs: [
      "https://www.exteriores.gob.es/es/ServiciosAlCiudadano/Paginas/Traductores-Interpretes-Jurados.aspx",
    ],
  };
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
