export interface Ciudad {
  slug: string;
  nombre: string;
  provincia: string;
  comunidad: string;
  poblacion: number;
  tieneConsulado?: boolean;
  altaInmigracionMarroqui?: boolean;
  consuladoFrances?: {
    direccion: string;
    telefono: string;
    web: string;
  };
  registroCivil?: {
    nombre: string;
    direccion: string;
  };
  extranjeria?: {
    nombre: string;
    direccion: string;
  };
  datosUnicos: string[];
  documentosMasFrecuentes: string[];
}

export const CIUDADES: Ciudad[] = [
  // ─── TOP 10 CIUDADES (datos detallados) ────────────────────────────────

  {
    slug: "madrid",
    nombre: "Madrid",
    provincia: "Madrid",
    comunidad: "Comunidad de Madrid",
    poblacion: 3300000,
    tieneConsulado: true,
    consuladoFrances: {
      direccion: "C/ Salustiano Olózaga 9, 28001 Madrid",
      telefono: "+34 914 234 900",
      web: "https://es.ambafrance.org",
    },
    registroCivil: {
      nombre: "Registro Civil Central",
      direccion: "C/ Montera 18, 28013 Madrid",
    },
    extranjeria: {
      nombre: "Oficina de Extranjería de Madrid",
      direccion: "C/ García de Paredes 65, 28010 Madrid",
    },
    datosUnicos: [
      "Madrid concentra el mayor número de solicitudes de traducción jurada de francés de España, con una demanda especialmente alta para trámites de nacionalidad y reagrupación familiar.",
      "El Consulado de Francia en Madrid gestiona visados, nacionalidad y documentos para toda la zona centro peninsular, generando una demanda constante de traducciones juradas al francés y del francés.",
      "La Oficina de Extranjería de Madrid tramita miles de expedientes de ciudadanos francófonos al año, incluyendo residentes de origen francés, belga, suizo y de países del Magreb.",
      "Las empresas francesas con sede en Madrid — como Renault, BNP Paribas, AXA o Carrefour — generan una demanda continua de traducciones juradas de documentos corporativos y laborales.",
    ],
    documentosMasFrecuentes: [
      "Acta de nacimiento francesa para registro civil",
      "Certificado de nacionalidad francesa",
      "Contrato de trabajo para visado de larga duración",
    ],
  },

  {
    slug: "barcelona",
    nombre: "Barcelona",
    provincia: "Barcelona",
    comunidad: "Cataluña",
    poblacion: 1600000,
    tieneConsulado: true,
    consuladoFrances: {
      direccion: "C/ Consell de Cent 265, 08011 Barcelona",
      telefono: "+34 933 174 700",
      web: "https://barcelona.consulfrance.org",
    },
    registroCivil: {
      nombre: "Registro Civil de Barcelona",
      direccion: "Plaza del Duc de Medinaceli 3, 08002 Barcelona",
    },
    extranjeria: {
      nombre: "Oficina de Extranjería de Barcelona",
      direccion: "C/ Murcia 42, 08027 Barcelona",
    },
    datosUnicos: [
      "Barcelona tiene la mayor comunidad francesa residente fuera de Francia en España, con más de 25 000 franceses inscritos en el consulado, lo que la convierte en uno de los principales mercados de traducción jurada de francés.",
      "El Consolat de France a Barcelona gestiona documentos en francés y catalán, y es punto de referencia para trámites de residencia, nacionalidad y estado civil para toda Cataluña y Aragón.",
      "La alta demanda de traducciones juradas en Barcelona se vincula al sector tecnológico y de startups con sede en Francia, así como a programas de intercambio universitario con universidades francófonas.",
      "Barcelona acoge anualmente a miles de estudiantes Erasmus franceses y francófonos que necesitan traducciones de títulos, expedientes académicos y certificados para homologaciones en universidades catalanas.",
    ],
    documentosMasFrecuentes: [
      "Documentos para reagrupación familiar",
      "Certificados para empresas franco-españolas",
      "Títulos universitarios franceses para homologación",
    ],
  },

  {
    slug: "valencia",
    nombre: "Valencia",
    provincia: "Valencia",
    comunidad: "Comunidad Valenciana",
    poblacion: 800000,
    tieneConsulado: true,
    consuladoFrances: {
      direccion: "C/ Colón 5, 46004 Valencia",
      telefono: "+34 963 510 359",
      web: "https://valencia.consulfrance.org",
    },
    registroCivil: {
      nombre: "Registro Civil de Valencia",
      direccion: "Plaza del Ayuntamiento 1, 46002 Valencia",
    },
    extranjeria: {
      nombre: "Oficina de Extranjería de Valencia",
      direccion: "C/ Zapadores 52, 46006 Valencia",
    },
    datosUnicos: [
      "Valencia tiene presencia creciente de empresas francesas en el sector agroalimentario, con exportaciones de cítricos y productos hortofrutícolas que requieren documentación comercial bilingüe.",
      "El puerto de Valencia, primero del Mediterráneo en tráfico de contenedores, gestiona documentación comercial franco-española para decenas de empresas importadoras y exportadoras.",
      "La Universitat de València y la UPV reciben un alto volumen de estudiantes francófonos en programas de intercambio, lo que genera una demanda constante de traducciones académicas.",
      "Valencia alberga una creciente comunidad de teletrabajadores y nómadas digitales franceses atraídos por el clima y el coste de vida, que necesitan traducir documentos de residencia y empadronamiento.",
    ],
    documentosMasFrecuentes: [
      "Documentos comerciales para importación y exportación",
      "Contratos laborales para trabajadores franceses",
      "Certificados académicos para Erasmus y homologaciones",
    ],
  },

  {
    slug: "sevilla",
    nombre: "Sevilla",
    provincia: "Sevilla",
    comunidad: "Andalucía",
    poblacion: 700000,
    tieneConsulado: true,
    consuladoFrances: {
      direccion: "Plaza de España, Sector Sur, 41013 Sevilla",
      telefono: "+34 954 222 896",
      web: "https://sevilla.consulfrance.org",
    },
    registroCivil: {
      nombre: "Registro Civil de Sevilla",
      direccion: "C/ Almirante Apodaca 2, 41003 Sevilla",
    },
    extranjeria: {
      nombre: "Oficina de Extranjería de Sevilla",
      direccion: "Plaza de España, Torre Norte, 41013 Sevilla",
    },
    datosUnicos: [
      "Sevilla tiene una importante presencia de Airbus y empresas aeronáuticas francesas que operan en la factoría de San Pablo, generando una demanda continua de traducciones técnicas y laborales entre francés y español.",
      "La alta demanda de traducciones en Sevilla se vincula al sector turístico y hostelero, con cadenas francesas como Accor que requieren documentación bilingüe para sus operaciones en Andalucía.",
      "La Universidad de Sevilla mantiene convenios con universidades francesas en programas de doble titulación, lo que genera traducciones de expedientes académicos y títulos.",
      "Sevilla acoge a una comunidad creciente de residentes franceses atraídos por el estilo de vida andaluz, que necesitan traducir documentos civiles para empadronamiento y trámites de residencia.",
    ],
    documentosMasFrecuentes: [
      "Documentos técnicos y laborales del sector aeronáutico",
      "Certificados de estado civil para trámites consulares",
      "Títulos y expedientes para dobles titulaciones universitarias",
    ],
  },

  {
    slug: "zaragoza",
    nombre: "Zaragoza",
    provincia: "Zaragoza",
    comunidad: "Aragón",
    poblacion: 670000,
    tieneConsulado: true,
    consuladoFrances: {
      direccion: "C/ Paseo de la Independencia 12, 50001 Zaragoza",
      telefono: "+34 976 235 740",
      web: "https://zaragoza.consulfrance.org",
    },
    registroCivil: {
      nombre: "Registro Civil de Zaragoza",
      direccion: "C/ Don Jaime I 18, 50003 Zaragoza",
    },
    datosUnicos: [
      "Zaragoza es un polo logístico estratégico con empresas francesas como Stellantis (antigua Opel-PSA) que emplean a miles de trabajadores y generan documentación laboral bilingüe franco-española.",
      "La proximidad de Zaragoza a la frontera francesa la convierte en punto de paso clave para empresas de transporte y logística que necesitan documentación aduanera y mercantil traducida.",
      "La Universidad de Zaragoza tiene convenios activos con universidades de Toulouse, Pau y Burdeos, lo que genera una demanda sostenida de traducciones de títulos y expedientes académicos.",
      "Zaragoza cuenta con una comunidad francesa estable vinculada al sector automovilístico e industrial, que precisa traducciones para trámites de residencia, contratos laborales y documentos familiares.",
    ],
    documentosMasFrecuentes: [
      "Documentos laborales del sector automovilístico y logístico",
      "Certificados académicos para convenios con universidades francesas",
      "Documentos mercantiles para empresas de transporte transfronterizo",
    ],
  },

  {
    slug: "malaga",
    nombre: "Málaga",
    provincia: "Málaga",
    comunidad: "Andalucía",
    poblacion: 570000,
    tieneConsulado: true,
    altaInmigracionMarroqui: true,
    consuladoFrances: {
      direccion: "C/ Ferrándiz 5, 29001 Málaga",
      telefono: "+34 952 226 590",
      web: "https://malaga.consulfrance.org",
    },
    registroCivil: {
      nombre: "Registro Civil de Málaga",
      direccion: "C/ Fiscal Luis Portero García s/n, 29010 Málaga",
    },
    extranjeria: {
      nombre: "Oficina de Extranjería de Málaga",
      direccion: "C/ Compositor Lehmberg Ruiz 19, 29007 Málaga",
    },
    datosUnicos: [
      "Málaga tiene una de las mayores comunidades francesas de la Costa del Sol, con miles de residentes que necesitan traducciones de documentos civiles, inmobiliarios y de residencia.",
      "La alta demanda de traducciones de documentos marroquíes en Málaga — partidas de nacimiento, certificados de matrimonio, antecedentes penales — se debe a la numerosa comunidad magrebí de la provincia.",
      "Muchos residentes franceses en la provincia de Málaga necesitan documentos traducidos para trámites de compraventa de inmuebles, residencia fiscal y herencias transfronterizas.",
      "Málaga se ha consolidado como hub tecnológico con empresas francesas del sector digital que necesitan documentación corporativa bilingüe para sus operaciones en el Málaga Tech Park.",
    ],
    documentosMasFrecuentes: [
      "Documentos marroquíes para reagrupación familiar",
      "Escrituras de propiedad para compradores franceses",
      "Certificados de residencia para franceses en la Costa del Sol",
    ],
  },

  {
    slug: "murcia",
    nombre: "Murcia",
    provincia: "Murcia",
    comunidad: "Región de Murcia",
    poblacion: 460000,
    registroCivil: {
      nombre: "Registro Civil de Murcia",
      direccion: "C/ Puerta Nueva 5, 30001 Murcia",
    },
    extranjeria: {
      nombre: "Oficina de Extranjería de Murcia",
      direccion: "C/ Ceballos 6, 30003 Murcia",
    },
    datosUnicos: [
      "Murcia es una de las regiones con mayor inmigración magrebí de España, lo que genera una fuerte demanda de traducciones juradas de documentos de Marruecos, Argelia y Túnez del árabe y francés al español.",
      "El sector agrícola de la Región de Murcia emplea a miles de trabajadores extranjeros que necesitan traducciones de contratos laborales, permisos de trabajo y documentos de identidad.",
      "La Universidad de Murcia mantiene programas de intercambio con universidades francófonas, generando necesidad de traducciones de expedientes y títulos académicos.",
    ],
    documentosMasFrecuentes: [
      "Actas de nacimiento y matrimonio marroquíes",
      "Contratos laborales para el sector agroindustrial",
      "Documentos de reagrupación familiar para ciudadanos magrebíes",
    ],
  },

  {
    slug: "palma",
    nombre: "Palma",
    provincia: "Islas Baleares",
    comunidad: "Islas Baleares",
    poblacion: 415000,
    registroCivil: {
      nombre: "Registro Civil de Palma",
      direccion: "C/ Foners 10, 07006 Palma",
    },
    datosUnicos: [
      "Palma de Mallorca tiene una importante comunidad de residentes franceses y belgas que adquieren propiedades en la isla y necesitan traducciones juradas de escrituras, contratos y documentos fiscales.",
      "El sector turístico balear genera una demanda constante de traducciones de documentos mercantiles y laborales para empresas hoteleras con propietarios o inversores francófonos.",
      "Mallorca atrae a jubilados franceses que se establecen en la isla y necesitan traducciones de documentos de pensión, seguros médicos y certificados de residencia.",
    ],
    documentosMasFrecuentes: [
      "Escrituras y contratos inmobiliarios",
      "Documentos fiscales para residentes franceses y belgas",
      "Certificados de pensión y seguros médicos",
    ],
  },

  {
    slug: "las-palmas",
    nombre: "Las Palmas de Gran Canaria",
    provincia: "Las Palmas",
    comunidad: "Canarias",
    poblacion: 380000,
    registroCivil: {
      nombre: "Registro Civil de Las Palmas",
      direccion: "C/ Pérez Galdós 2, 35002 Las Palmas",
    },
    datosUnicos: [
      "Las Palmas de Gran Canaria recibe una importante comunidad de residentes franceses y belgas que se establecen en las islas y necesitan documentos traducidos para empadronamiento y residencia fiscal.",
      "Canarias, como zona franca fiscal, atrae a empresarios francófonos que necesitan traducciones de documentos mercantiles, estatutos sociales y poderes notariales para constituir empresas.",
      "El clima y el coste de vida de Gran Canaria atraen a nómadas digitales y teletrabajadores franceses que precisan traducciones de contratos laborales y certificados de residencia.",
    ],
    documentosMasFrecuentes: [
      "Documentos fiscales y mercantiles para empresas",
      "Certificados de empadronamiento y residencia",
      "Contratos laborales para teletrabajadores francófonos",
    ],
  },

  {
    slug: "bilbao",
    nombre: "Bilbao",
    provincia: "Vizcaya",
    comunidad: "País Vasco",
    poblacion: 350000,
    tieneConsulado: true,
    consuladoFrances: {
      direccion: "C/ Diputación 1, 48008 Bilbao",
      telefono: "+34 944 153 065",
      web: "https://bilbao.consulfrance.org",
    },
    registroCivil: {
      nombre: "Registro Civil de Bilbao",
      direccion: "C/ Buenos Aires 6, 48001 Bilbao",
    },
    datosUnicos: [
      "Bilbao mantiene lazos económicos estrechos con el País Vasco francés y Aquitania, lo que genera un flujo constante de documentación empresarial y laboral bilingüe entre francés y español.",
      "La proximidad del País Vasco a Francia hace que muchas familias transfronterizas necesiten traducciones juradas de documentos civiles para trámites en ambos países.",
      "El sector industrial vasco — siderurgia, energía y máquina-herramienta — tiene importantes vínculos comerciales con empresas francesas que requieren documentación técnica y mercantil traducida.",
      "Bilbao es punto de referencia consular para ciudadanos franceses residentes en todo el norte de España, desde Cantabria hasta Navarra.",
    ],
    documentosMasFrecuentes: [
      "Documentos transfronterizos para familias franco-españolas",
      "Documentos mercantiles para empresas industriales",
      "Certificados de estado civil para el consulado francés",
    ],
  },

  // ─── CIUDADES 11-50 ────────────────────────────────────────────────────

  {
    slug: "alicante",
    nombre: "Alicante",
    provincia: "Alicante",
    comunidad: "Comunidad Valenciana",
    poblacion: 330000,
    datosUnicos: [
      "Alicante tiene una de las mayores comunidades de residentes franceses de la costa mediterránea, con miles de ciudadanos que han adquirido propiedades y necesitan documentos traducidos para trámites inmobiliarios y fiscales.",
      "La provincia de Alicante es destino preferente de jubilados franceses que se establecen en localidades costeras y necesitan traducciones de documentos de pensión, seguros y herencias.",
    ],
    documentosMasFrecuentes: [
      "Escrituras de compraventa para residentes franceses",
      "Documentos de pensión y Seguridad Social francesa",
      "Certificados de residencia para trámites fiscales",
    ],
  },

  {
    slug: "cordoba",
    nombre: "Córdoba",
    provincia: "Córdoba",
    comunidad: "Andalucía",
    poblacion: 320000,
    datosUnicos: [
      "Córdoba atrae a un importante flujo de turistas e investigadores francófonos vinculados al patrimonio histórico andalusí, generando demanda de traducciones de documentos académicos y de investigación.",
      "El sector oleícola cordobés exporta a Francia y países francófonos, lo que requiere traducciones de documentación mercantil, certificaciones de calidad y contratos comerciales.",
    ],
    documentosMasFrecuentes: [
      "Documentos comerciales para exportación agroalimentaria",
      "Certificados académicos para programas de investigación",
      "Documentos de estado civil para residentes magrebíes",
    ],
  },

  {
    slug: "valladolid",
    nombre: "Valladolid",
    provincia: "Valladolid",
    comunidad: "Castilla y León",
    poblacion: 300000,
    datosUnicos: [
      "Valladolid es sede de Renault España, lo que genera una demanda constante de traducciones de documentación laboral, técnica y corporativa entre francés y español vinculada al sector del automóvil.",
      "La Universidad de Valladolid mantiene acuerdos de intercambio con universidades francesas, creando necesidad de traducciones de títulos, expedientes y certificados académicos.",
    ],
    documentosMasFrecuentes: [
      "Documentos laborales y técnicos del sector automovilístico",
      "Títulos y expedientes académicos para homologación",
      "Contratos corporativos franco-españoles",
    ],
  },

  {
    slug: "vigo",
    nombre: "Vigo",
    provincia: "Pontevedra",
    comunidad: "Galicia",
    poblacion: 295000,
    datosUnicos: [
      "Vigo es sede de Stellantis (antigua PSA-Citroën), la mayor fábrica de automóviles de España, lo que genera una demanda continua de traducciones de documentación técnica, laboral y corporativa en francés.",
      "El sector pesquero y conservero de Vigo exporta a Francia y necesita traducciones de certificaciones sanitarias, documentos comerciales y contratos de suministro.",
    ],
    documentosMasFrecuentes: [
      "Documentos técnicos y laborales del sector automovilístico",
      "Certificaciones sanitarias para exportación pesquera",
      "Documentos mercantiles para comercio con Francia",
    ],
  },

  {
    slug: "gijon",
    nombre: "Gijón",
    provincia: "Asturias",
    comunidad: "Asturias",
    poblacion: 270000,
    datosUnicos: [
      "Gijón mantiene vínculos industriales con empresas francesas del sector siderúrgico y energético que requieren documentación técnica y contratos traducidos al francés.",
      "La Universidad de Oviedo, con campus en Gijón, tiene convenios con universidades francesas que generan demanda de traducciones de títulos y expedientes académicos.",
    ],
    documentosMasFrecuentes: [
      "Documentos técnicos del sector industrial y energético",
      "Certificados académicos para programas de intercambio",
      "Contratos laborales para ingenieros en empresas francesas",
    ],
  },

  {
    slug: "granada",
    nombre: "Granada",
    provincia: "Granada",
    comunidad: "Andalucía",
    poblacion: 230000,
    altaInmigracionMarroqui: true,
    datosUnicos: [
      "Granada tiene una importante comunidad magrebí que necesita traducciones juradas de documentos marroquíes — actas de nacimiento, certificados de matrimonio y antecedentes penales — del árabe y francés al español.",
      "La Universidad de Granada es una de las más internacionales de España, con un alto volumen de estudiantes francófonos que precisan traducciones de títulos y expedientes para homologaciones.",
    ],
    documentosMasFrecuentes: [
      "Documentos del registro civil marroquí para reagrupación familiar",
      "Títulos universitarios franceses para homologación en la UGR",
      "Certificados de antecedentes penales para trámites de residencia",
    ],
  },

  {
    slug: "tenerife",
    nombre: "Santa Cruz de Tenerife",
    provincia: "Santa Cruz de Tenerife",
    comunidad: "Canarias",
    poblacion: 220000,
    datosUnicos: [
      "Tenerife atrae a residentes franceses y belgas que se establecen en la isla por su clima y régimen fiscal favorable, generando demanda de traducciones de documentos de residencia y fiscalidad.",
      "El sector turístico de Tenerife, con importante presencia de turoperadores franceses, necesita traducciones de contratos mercantiles, acuerdos hoteleros y documentación laboral.",
    ],
    documentosMasFrecuentes: [
      "Documentos de residencia fiscal para ciudadanos franceses",
      "Contratos inmobiliarios para compradores francófonos",
      "Certificados de pensión y Seguridad Social extranjera",
    ],
  },

  {
    slug: "a-coruna",
    nombre: "A Coruña",
    provincia: "A Coruña",
    comunidad: "Galicia",
    poblacion: 245000,
    datosUnicos: [
      "A Coruña es sede de Inditex y tiene un tejido empresarial con vínculos comerciales con Francia, generando demanda de traducciones de documentos mercantiles, contratos de distribución y acuerdos internacionales.",
      "El puerto de A Coruña gestiona tráfico marítimo con puertos franceses del Atlántico, lo que requiere traducciones de documentación aduanera y certificados de transporte.",
    ],
    documentosMasFrecuentes: [
      "Documentos mercantiles para comercio textil internacional",
      "Certificados de transporte marítimo y aduaneros",
      "Contratos de distribución con empresas francesas",
    ],
  },

  {
    slug: "vitoria",
    nombre: "Vitoria-Gasteiz",
    provincia: "Álava",
    comunidad: "País Vasco",
    poblacion: 250000,
    datosUnicos: [
      "Vitoria-Gasteiz, capital del País Vasco, tiene un sector industrial con presencia de empresas francesas del sector aeronáutico y energético que necesitan documentación técnica traducida.",
      "La proximidad de Vitoria a la frontera francesa genera un flujo de familias transfronterizas y trabajadores que requieren traducciones de documentos civiles y laborales.",
    ],
    documentosMasFrecuentes: [
      "Documentos técnicos del sector aeronáutico",
      "Certificados de estado civil para familias transfronterizas",
      "Contratos laborales para trabajadores franco-españoles",
    ],
  },

  {
    slug: "oviedo",
    nombre: "Oviedo",
    provincia: "Asturias",
    comunidad: "Asturias",
    poblacion: 220000,
    datosUnicos: [
      "Oviedo es capital del Principado de Asturias y concentra los trámites administrativos de la región, incluyendo expedientes de extranjería que requieren traducciones juradas de documentos francófonos.",
      "La Universidad de Oviedo tiene acuerdos de intercambio con universidades de Francia y Bélgica, generando demanda de traducciones de títulos y certificados académicos.",
    ],
    documentosMasFrecuentes: [
      "Certificados académicos para convenios universitarios",
      "Documentos de extranjería para residentes francófonos",
      "Poderes notariales para trámites administrativos",
    ],
  },

  {
    slug: "pamplona",
    nombre: "Pamplona",
    provincia: "Navarra",
    comunidad: "Navarra",
    poblacion: 200000,
    datosUnicos: [
      "Pamplona tiene una vinculación histórica y económica con el sur de Francia — Aquitania y Occitania — que genera un flujo constante de documentación bilingüe para empresas y familias transfronterizas.",
      "El sector automovilístico navarro, con Volkswagen Navarra, y las empresas del sector eólico con presencia francesa necesitan traducciones de documentación técnica y contratos.",
    ],
    documentosMasFrecuentes: [
      "Documentos para empresas transfronterizas franco-navarras",
      "Contratos laborales del sector industrial y automovilístico",
      "Certificados de estado civil para familias con vínculos con Francia",
    ],
  },

  {
    slug: "santander",
    nombre: "Santander",
    provincia: "Cantabria",
    comunidad: "Cantabria",
    poblacion: 170000,
    datosUnicos: [
      "Santander conecta con Francia a través del ferry Brittany Ferries, generando un flujo de residentes y empresas que necesitan documentos traducidos para trámites transfronterizos.",
      "La Universidad Internacional Menéndez Pelayo y la UC atraen a investigadores y estudiantes francófonos que necesitan traducciones de títulos y certificados académicos.",
    ],
    documentosMasFrecuentes: [
      "Documentos de residencia para familias franco-españolas",
      "Certificados académicos para investigadores y doctorandos",
      "Documentos mercantiles para empresas con sede en Francia",
    ],
  },

  {
    slug: "almeria",
    nombre: "Almería",
    provincia: "Almería",
    comunidad: "Andalucía",
    poblacion: 196000,
    altaInmigracionMarroqui: true,
    datosUnicos: [
      "Almería tiene una de las mayores comunidades magrebíes de España, lo que genera una demanda muy alta de traducciones juradas de documentos marroquíes del árabe y francés al español para trámites de reagrupación familiar y residencia.",
      "El sector agrícola almeriense — el mayor invernadero de Europa — emplea a miles de trabajadores de origen magrebí cuyos documentos oficiales están redactados en francés y árabe.",
    ],
    documentosMasFrecuentes: [
      "Actas de nacimiento y matrimonio marroquíes",
      "Documentos para reagrupación familiar de ciudadanos magrebíes",
      "Permisos de trabajo y contratos laborales para el sector agrícola",
    ],
  },

  {
    slug: "burgos",
    nombre: "Burgos",
    provincia: "Burgos",
    comunidad: "Castilla y León",
    poblacion: 175000,
    datosUnicos: [
      "Burgos es un importante polo industrial con presencia de empresas francesas en el sector de la alimentación y la automoción que requieren traducciones de documentación técnica y mercantil.",
      "La posición de Burgos en el Camino de Santiago genera un flujo de peregrinos franceses que ocasionalmente necesitan traducciones de documentos para trámites de asistencia sanitaria o incidencias.",
    ],
    documentosMasFrecuentes: [
      "Documentos mercantiles para el sector alimentario",
      "Contratos laborales para empresas industriales francesas",
      "Certificados académicos para intercambios universitarios",
    ],
  },

  {
    slug: "albacete",
    nombre: "Albacete",
    provincia: "Albacete",
    comunidad: "Castilla-La Mancha",
    poblacion: 172000,
    datosUnicos: [
      "Albacete concentra trámites de extranjería para Castilla-La Mancha, con una importante comunidad de origen magrebí que necesita traducciones juradas de documentos francófonos.",
      "El sector cuchillero de Albacete exporta a Francia, generando demanda de traducciones de certificaciones de producto, contratos comerciales y documentación aduanera.",
    ],
    documentosMasFrecuentes: [
      "Documentos de registro civil para ciudadanos magrebíes",
      "Certificaciones de producto para exportación",
      "Documentos de extranjería y reagrupación familiar",
    ],
  },

  {
    slug: "castellon",
    nombre: "Castellón de la Plana",
    provincia: "Castellón",
    comunidad: "Comunidad Valenciana",
    poblacion: 170000,
    datosUnicos: [
      "Castellón es líder mundial en producción de azulejos y cerámica, con exportaciones a Francia que requieren traducciones de certificaciones técnicas, fichas de seguridad y documentación comercial.",
      "La provincia de Castellón tiene una comunidad de residentes francófonos en la costa — Benicàssim, Peñíscola — que necesitan documentos traducidos para trámites de residencia y fiscalidad.",
    ],
    documentosMasFrecuentes: [
      "Documentos técnicos y comerciales del sector cerámico",
      "Certificados de residencia para ciudadanos franceses",
      "Documentos mercantiles para exportación industrial",
    ],
  },

  {
    slug: "logrono",
    nombre: "Logroño",
    provincia: "La Rioja",
    comunidad: "La Rioja",
    poblacion: 152000,
    datosUnicos: [
      "Logroño y La Rioja exportan vino a Francia y países francófonos, generando necesidad de traducciones de documentación comercial, denominaciones de origen y contratos de distribución.",
      "La cercanía de La Rioja a la frontera francesa facilita el tránsito de familias y empresas transfronterizas que necesitan documentos civiles y mercantiles traducidos.",
    ],
    documentosMasFrecuentes: [
      "Documentos comerciales para exportación vinícola",
      "Contratos de distribución con importadores franceses",
      "Certificados de denominación de origen para mercados francófonos",
    ],
  },

  {
    slug: "badajoz",
    nombre: "Badajoz",
    provincia: "Badajoz",
    comunidad: "Extremadura",
    poblacion: 150000,
    datosUnicos: [
      "Badajoz, frontera con Portugal, gestiona trámites de extranjería para Extremadura y recibe documentación de ciudadanos de antiguas colonias francesas — Senegal, Costa de Marfil — que residen en la región.",
      "El sector agrícola extremeño exporta productos a Francia, requiriendo traducciones de certificados fitosanitarios, documentos de calidad y contratos de suministro.",
    ],
    documentosMasFrecuentes: [
      "Documentos de extranjería para ciudadanos de países francófonos africanos",
      "Certificados fitosanitarios para exportación agrícola",
      "Documentos de estado civil para trámites de residencia",
    ],
  },

  {
    slug: "huelva",
    nombre: "Huelva",
    provincia: "Huelva",
    comunidad: "Andalucía",
    poblacion: 144000,
    altaInmigracionMarroqui: true,
    datosUnicos: [
      "Huelva tiene una importante comunidad de trabajadores marroquíes en el sector de la fresa y los frutos rojos, generando una alta demanda de traducciones de documentos del registro civil marroquí.",
      "El sector agrícola onubense emplea a miles de temporeros de países francófonos del Magreb y África subsahariana cuyos documentos oficiales incluyen textos en francés.",
    ],
    documentosMasFrecuentes: [
      "Actas de nacimiento y matrimonio de Marruecos",
      "Contratos laborales de temporada para trabajadores agrícolas",
      "Documentos de reagrupación familiar para ciudadanos magrebíes",
    ],
  },

  {
    slug: "leon",
    nombre: "León",
    provincia: "León",
    comunidad: "Castilla y León",
    poblacion: 124000,
    datosUnicos: [
      "León es punto clave del Camino de Santiago y recibe peregrinos franceses que ocasionalmente necesitan traducciones urgentes de documentos médicos, seguros o denuncias.",
      "La Universidad de León tiene convenios con universidades francófonas en veterinaria y agroalimentación, generando traducciones de títulos y certificados para homologación.",
    ],
    documentosMasFrecuentes: [
      "Certificados académicos para programas de veterinaria",
      "Documentos de estado civil para residentes francófonos",
      "Documentos médicos y de seguros para peregrinos",
    ],
  },

  {
    slug: "salamanca",
    nombre: "Salamanca",
    provincia: "Salamanca",
    comunidad: "Castilla y León",
    poblacion: 145000,
    datosUnicos: [
      "Salamanca, ciudad universitaria por excelencia, recibe a miles de estudiantes francófonos cada año que necesitan traducciones de títulos, expedientes académicos y certificados para matriculación y homologación.",
      "La Universidad de Salamanca mantiene convenios históricos con universidades francesas y el Instituto Cervantes, lo que genera una demanda constante de traducciones académicas.",
    ],
    documentosMasFrecuentes: [
      "Títulos y expedientes académicos franceses para homologación",
      "Certificados de estudios para programas de intercambio",
      "Documentos de becas y ayudas de instituciones francesas",
    ],
  },

  {
    slug: "tarragona",
    nombre: "Tarragona",
    provincia: "Tarragona",
    comunidad: "Cataluña",
    poblacion: 132000,
    datosUnicos: [
      "Tarragona tiene un importante polo petroquímico con presencia de empresas francesas como TotalEnergies y Repsol (con socios franceses) que requieren traducciones de documentación técnica y medioambiental.",
      "La Costa Dorada atrae a residentes franceses y belgas que adquieren propiedades vacacionales y necesitan traducciones de escrituras, contratos y documentos fiscales.",
    ],
    documentosMasFrecuentes: [
      "Documentos técnicos del sector petroquímico",
      "Escrituras de compraventa para residentes francófonos",
      "Certificados medioambientales y de seguridad industrial",
    ],
  },

  {
    slug: "lleida",
    nombre: "Lleida",
    provincia: "Lleida",
    comunidad: "Cataluña",
    poblacion: 137000,
    datosUnicos: [
      "Lleida está a dos horas de la frontera francesa y tiene una importante comunidad de trabajadores magrebíes y subsaharianos del sector frutícola que necesitan traducciones de documentos en francés.",
      "El sector agroindustrial leridano — fruta, cereales y ganadería — exporta a Francia y requiere traducciones de certificaciones fitosanitarias y contratos de suministro.",
    ],
    documentosMasFrecuentes: [
      "Documentos del registro civil para ciudadanos magrebíes",
      "Certificados fitosanitarios para exportación frutícola",
      "Contratos laborales de temporada en el sector agrícola",
    ],
  },

  {
    slug: "girona",
    nombre: "Girona",
    provincia: "Girona",
    comunidad: "Cataluña",
    poblacion: 103000,
    datosUnicos: [
      "Girona es puerta de entrada desde Francia por La Jonquera y el Pertús, con un flujo constante de familias y empresas transfronterizas que necesitan documentos bilingües francés-español.",
      "La provincia de Girona tiene una de las mayores comunidades de residentes franceses de Cataluña, establecidos en la Costa Brava, que precisan traducciones para trámites inmobiliarios y de residencia.",
    ],
    documentosMasFrecuentes: [
      "Documentos para empresas transfronterizas franco-catalanas",
      "Escrituras de compraventa para residentes en la Costa Brava",
      "Documentos de estado civil para familias franco-españolas",
    ],
  },

  {
    slug: "jerez",
    nombre: "Jerez de la Frontera",
    provincia: "Cádiz",
    comunidad: "Andalucía",
    poblacion: 210000,
    datosUnicos: [
      "Jerez de la Frontera exporta vinos y brandies a Francia — uno de sus principales mercados — requiriendo traducciones de documentación comercial, etiquetado y contratos de distribución.",
      "La provincia de Cádiz tiene una comunidad magrebí que necesita traducciones de documentos civiles marroquíes para trámites de extranjería y reagrupación familiar.",
    ],
    documentosMasFrecuentes: [
      "Documentos comerciales para exportación de vinos y spirits",
      "Documentos de extranjería para ciudadanos magrebíes",
      "Contratos de distribución con importadores franceses",
    ],
  },

  {
    slug: "marbella",
    nombre: "Marbella",
    provincia: "Málaga",
    comunidad: "Andalucía",
    poblacion: 147000,
    altaInmigracionMarroqui: true,
    datosUnicos: [
      "Marbella tiene una de las mayores comunidades de residentes franceses de la Costa del Sol, con una intensa actividad inmobiliaria de lujo que requiere traducciones de escrituras, contratos y documentos fiscales.",
      "El sector turístico de alta gama de Marbella incluye hoteles y restaurantes franceses que necesitan documentación laboral y mercantil bilingüe.",
      "La comunidad marroquí de Marbella genera una demanda importante de traducciones de documentos civiles del registro civil marroquí para trámites de reagrupación familiar.",
    ],
    documentosMasFrecuentes: [
      "Escrituras de propiedad de lujo para compradores franceses",
      "Documentos marroquíes para reagrupación familiar",
      "Contratos mercantiles para el sector hostelero francés",
    ],
  },

  {
    slug: "fuengirola",
    nombre: "Fuengirola",
    provincia: "Málaga",
    comunidad: "Andalucía",
    poblacion: 80000,
    altaInmigracionMarroqui: true,
    datosUnicos: [
      "Fuengirola tiene una de las comunidades extranjeras más diversas de la Costa del Sol, con miles de residentes franceses, belgas y magrebíes que necesitan traducciones de documentos civiles y de residencia.",
      "La presencia de una importante comunidad marroquí en Fuengirola genera demanda constante de traducciones de actas de nacimiento, certificados de soltería y documentos del registro civil marroquí.",
    ],
    documentosMasFrecuentes: [
      "Documentos del registro civil marroquí",
      "Certificados de residencia para ciudadanos franceses",
      "Documentos de empadronamiento y extranjería",
    ],
  },

  {
    slug: "torremolinos",
    nombre: "Torremolinos",
    provincia: "Málaga",
    comunidad: "Andalucía",
    poblacion: 70000,
    datosUnicos: [
      "Torremolinos atrae a jubilados y residentes franceses que se establecen en la Costa del Sol y necesitan traducciones de documentos de pensión, seguros médicos y certificados de residencia.",
      "El sector hotelero de Torremolinos, con presencia de cadenas francesas, genera demanda de traducciones de contratos laborales y documentación mercantil bilingüe.",
    ],
    documentosMasFrecuentes: [
      "Documentos de pensión y Seguridad Social francesa",
      "Certificados de residencia y empadronamiento",
      "Contratos laborales del sector turístico",
    ],
  },

  {
    slug: "benidorm",
    nombre: "Benidorm",
    provincia: "Alicante",
    comunidad: "Comunidad Valenciana",
    poblacion: 71000,
    datosUnicos: [
      "Benidorm tiene una importante colonia de residentes franceses y belgas, muchos de ellos jubilados, que necesitan traducciones de documentos de pensión, seguros y testamentos para trámites en España.",
      "El sector turístico de Benidorm incluye empresas hoteleras con inversores francófonos que requieren documentación mercantil y contratos traducidos al francés.",
    ],
    documentosMasFrecuentes: [
      "Documentos de pensión para jubilados franceses y belgas",
      "Testamentos y documentos sucesorios",
      "Contratos inmobiliarios para compradores francófonos",
    ],
  },

  {
    slug: "calpe",
    nombre: "Calpe",
    provincia: "Alicante",
    comunidad: "Comunidad Valenciana",
    poblacion: 22000,
    datosUnicos: [
      "Calpe tiene una de las mayores proporciones de residentes franceses por habitante de la Comunidad Valenciana, con una intensa actividad inmobiliaria que requiere traducciones de escrituras y contratos.",
      "La comunidad francesa de Calpe gestiona trámites de residencia fiscal, herencias y seguros médicos que precisan documentos traducidos oficialmente del francés al español.",
    ],
    documentosMasFrecuentes: [
      "Escrituras de compraventa de inmuebles",
      "Documentos de residencia fiscal y tributarios",
      "Certificados de herencia y testamentos franceses",
    ],
  },

  {
    slug: "denia",
    nombre: "Dénia",
    provincia: "Alicante",
    comunidad: "Comunidad Valenciana",
    poblacion: 42000,
    datosUnicos: [
      "Dénia conecta con Ibiza y Baleares por ferry y tiene una importante comunidad de residentes franceses en la Marina Alta que necesitan traducciones para trámites de residencia, sanidad y fiscalidad.",
      "El sector gastronómico de Dénia, Ciudad Creativa de la Gastronomía por la UNESCO, atrae a profesionales franceses de la restauración que necesitan documentación laboral traducida.",
    ],
    documentosMasFrecuentes: [
      "Documentos de residencia para ciudadanos franceses",
      "Contratos laborales del sector hostelero",
      "Escrituras y documentos inmobiliarios",
    ],
  },

  {
    slug: "altea",
    nombre: "Altea",
    provincia: "Alicante",
    comunidad: "Comunidad Valenciana",
    poblacion: 22000,
    datosUnicos: [
      "Altea tiene una comunidad consolidada de residentes franceses y belgas atraídos por su casco antiguo y estilo de vida mediterráneo, que necesitan traducciones de documentos de residencia y propiedad.",
      "La Facultad de Bellas Artes de Altea (UMH) recibe a artistas y profesores francófonos que necesitan traducciones de títulos y certificaciones profesionales.",
    ],
    documentosMasFrecuentes: [
      "Escrituras de compraventa para residentes francófonos",
      "Documentos de empadronamiento y residencia",
      "Certificados académicos y profesionales artísticos",
    ],
  },

  {
    slug: "elche",
    nombre: "Elche",
    provincia: "Alicante",
    comunidad: "Comunidad Valenciana",
    poblacion: 230000,
    datosUnicos: [
      "Elche es capital del calzado en España, con empresas que exportan a Francia y necesitan traducciones de catálogos, contratos de distribución y certificaciones de producto.",
      "La Universidad Miguel Hernández de Elche mantiene programas de intercambio con universidades francófonas, generando demanda de traducciones de expedientes académicos.",
    ],
    documentosMasFrecuentes: [
      "Documentos comerciales del sector del calzado",
      "Contratos de distribución con importadores franceses",
      "Certificados académicos para programas de intercambio",
    ],
  },

  {
    slug: "cartagena",
    nombre: "Cartagena",
    provincia: "Murcia",
    comunidad: "Región de Murcia",
    poblacion: 215000,
    datosUnicos: [
      "Cartagena tiene una base naval y un sector industrial con presencia de empresas francesas del sector de la defensa y la energía que requieren traducciones de documentación técnica.",
      "El puerto de Cartagena gestiona tráfico comercial con puertos franceses del Mediterráneo, generando necesidad de traducciones de documentación aduanera y certificados marítimos.",
    ],
    documentosMasFrecuentes: [
      "Documentos técnicos del sector industrial y de defensa",
      "Certificados marítimos y documentación aduanera",
      "Documentos de extranjería para trabajadores magrebíes",
    ],
  },

  {
    slug: "figueres",
    nombre: "Figueres",
    provincia: "Girona",
    comunidad: "Cataluña",
    poblacion: 46000,
    datosUnicos: [
      "Figueres está a 25 kilómetros de la frontera francesa y es paso obligado para miles de familias y empresas transfronterizas que necesitan documentos bilingües francés-español-catalán.",
      "La proximidad de Figueres a Perpiñán y la Cataluña Norte francesa genera un flujo constante de documentos civiles, notariales y mercantiles que requieren traducción jurada.",
    ],
    documentosMasFrecuentes: [
      "Documentos de estado civil para familias transfronterizas",
      "Documentos notariales para herencias y propiedades",
      "Contratos mercantiles para empresas franco-catalanas",
    ],
  },

  {
    slug: "terrassa",
    nombre: "Terrassa",
    provincia: "Barcelona",
    comunidad: "Cataluña",
    poblacion: 220000,
    datosUnicos: [
      "Terrassa es un importante centro industrial del Vallès Occidental con empresas del sector textil y automoción que mantienen relaciones comerciales con Francia y necesitan documentación bilingüe.",
      "La comunidad magrebí de Terrassa necesita traducciones de documentos del registro civil de Marruecos y otros países francófonos para trámites de reagrupación familiar y extranjería.",
    ],
    documentosMasFrecuentes: [
      "Documentos del registro civil para ciudadanos magrebíes",
      "Documentos mercantiles para empresas con socios franceses",
      "Certificados de extranjería y reagrupación familiar",
    ],
  },

  {
    slug: "badalona",
    nombre: "Badalona",
    provincia: "Barcelona",
    comunidad: "Cataluña",
    poblacion: 215000,
    datosUnicos: [
      "Badalona tiene una importante comunidad de origen magrebí y subsahariano cuyos documentos oficiales están en francés o árabe, generando demanda de traducciones juradas para trámites de extranjería.",
      "El sector farmacéutico de Badalona, con presencia de laboratorios con vínculos franceses, necesita traducciones de documentación regulatoria y prospectos.",
    ],
    documentosMasFrecuentes: [
      "Documentos de extranjería para ciudadanos francófonos",
      "Documentos regulatorios del sector farmacéutico",
      "Actas de nacimiento y matrimonio de países francófonos",
    ],
  },

  {
    slug: "hospitalet",
    nombre: "L'Hospitalet de Llobregat",
    provincia: "Barcelona",
    comunidad: "Cataluña",
    poblacion: 255000,
    datosUnicos: [
      "L'Hospitalet de Llobregat, la segunda ciudad más poblada de Cataluña, tiene una importante comunidad de ciudadanos de países francófonos africanos que necesitan traducciones de documentos civiles y académicos.",
      "La proximidad al aeropuerto de El Prat y a la Zona Franca de Barcelona atrae a empresas francesas de logística y distribución que requieren documentación mercantil bilingüe.",
    ],
    documentosMasFrecuentes: [
      "Documentos de estado civil de países francófonos africanos",
      "Documentos mercantiles para empresas logísticas",
      "Certificados académicos para homologación de títulos",
    ],
  },

  {
    slug: "sabadell",
    nombre: "Sabadell",
    provincia: "Barcelona",
    comunidad: "Cataluña",
    poblacion: 210000,
    datosUnicos: [
      "Sabadell tiene un tejido empresarial industrial con vínculos comerciales con Francia, especialmente en los sectores textil y metalúrgico, que requiere traducciones de contratos y documentación técnica.",
      "La comunidad de origen magrebí de Sabadell necesita traducciones juradas de documentos del registro civil marroquí para trámites de reagrupación familiar y nacionalidad.",
    ],
    documentosMasFrecuentes: [
      "Documentos civiles marroquíes para trámites de nacionalidad",
      "Contratos comerciales para el sector industrial",
      "Documentos de extranjería y reagrupación familiar",
    ],
  },

  {
    slug: "pontevedra",
    nombre: "Pontevedra",
    provincia: "Pontevedra",
    comunidad: "Galicia",
    poblacion: 83000,
    datosUnicos: [
      "Pontevedra, etapa final del Camino Portugués, recibe peregrinos franceses que ocasionalmente necesitan traducciones de documentos médicos, seguros o incidencias durante el camino.",
      "El sector conservero y pesquero de la ría de Pontevedra exporta a Francia, generando necesidad de traducciones de certificaciones sanitarias, contratos de suministro y documentación comercial.",
    ],
    documentosMasFrecuentes: [
      "Certificaciones sanitarias para exportación pesquera",
      "Documentos de seguros para peregrinos franceses",
      "Contratos de suministro con distribuidores franceses",
    ],
  },
];
