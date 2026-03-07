export interface Ciudad {
  slug: string;
  nombre: string;
  provincia: string;
  comunidad: string;
  poblacion: number;
  tieneConsulado?: boolean;
  altaInmigracionMarroqui?: boolean;
}

export const CIUDADES: Ciudad[] = [
  { slug: "madrid", nombre: "Madrid", provincia: "Madrid", comunidad: "Comunidad de Madrid", poblacion: 3300000, tieneConsulado: true },
  { slug: "barcelona", nombre: "Barcelona", provincia: "Barcelona", comunidad: "Cataluña", poblacion: 1600000, tieneConsulado: true },
  { slug: "valencia", nombre: "Valencia", provincia: "Valencia", comunidad: "Comunidad Valenciana", poblacion: 800000, tieneConsulado: true },
  { slug: "sevilla", nombre: "Sevilla", provincia: "Sevilla", comunidad: "Andalucía", poblacion: 700000, tieneConsulado: true },
  { slug: "zaragoza", nombre: "Zaragoza", provincia: "Zaragoza", comunidad: "Aragón", poblacion: 670000, tieneConsulado: true },
  { slug: "malaga", nombre: "Málaga", provincia: "Málaga", comunidad: "Andalucía", poblacion: 570000, tieneConsulado: true, altaInmigracionMarroqui: true },
  { slug: "murcia", nombre: "Murcia", provincia: "Murcia", comunidad: "Región de Murcia", poblacion: 460000 },
  { slug: "palma", nombre: "Palma", provincia: "Islas Baleares", comunidad: "Islas Baleares", poblacion: 415000 },
  { slug: "las-palmas", nombre: "Las Palmas de Gran Canaria", provincia: "Las Palmas", comunidad: "Canarias", poblacion: 380000 },
  { slug: "bilbao", nombre: "Bilbao", provincia: "Vizcaya", comunidad: "País Vasco", poblacion: 350000, tieneConsulado: true },
  { slug: "alicante", nombre: "Alicante", provincia: "Alicante", comunidad: "Comunidad Valenciana", poblacion: 330000 },
  { slug: "cordoba", nombre: "Córdoba", provincia: "Córdoba", comunidad: "Andalucía", poblacion: 320000 },
  { slug: "valladolid", nombre: "Valladolid", provincia: "Valladolid", comunidad: "Castilla y León", poblacion: 300000 },
  { slug: "vigo", nombre: "Vigo", provincia: "Pontevedra", comunidad: "Galicia", poblacion: 295000 },
  { slug: "gijon", nombre: "Gijón", provincia: "Asturias", comunidad: "Asturias", poblacion: 270000 },
  { slug: "granada", nombre: "Granada", provincia: "Granada", comunidad: "Andalucía", poblacion: 230000, altaInmigracionMarroqui: true },
  { slug: "tenerife", nombre: "Santa Cruz de Tenerife", provincia: "Santa Cruz de Tenerife", comunidad: "Canarias", poblacion: 220000 },
  { slug: "a-coruna", nombre: "A Coruña", provincia: "A Coruña", comunidad: "Galicia", poblacion: 245000 },
  { slug: "vitoria", nombre: "Vitoria-Gasteiz", provincia: "Álava", comunidad: "País Vasco", poblacion: 250000 },
  { slug: "oviedo", nombre: "Oviedo", provincia: "Asturias", comunidad: "Asturias", poblacion: 220000 },
  { slug: "pamplona", nombre: "Pamplona", provincia: "Navarra", comunidad: "Navarra", poblacion: 200000 },
  { slug: "santander", nombre: "Santander", provincia: "Cantabria", comunidad: "Cantabria", poblacion: 170000 },
  { slug: "almeria", nombre: "Almería", provincia: "Almería", comunidad: "Andalucía", poblacion: 196000, altaInmigracionMarroqui: true },
  { slug: "burgos", nombre: "Burgos", provincia: "Burgos", comunidad: "Castilla y León", poblacion: 175000 },
  { slug: "albacete", nombre: "Albacete", provincia: "Albacete", comunidad: "Castilla-La Mancha", poblacion: 172000 },
  { slug: "castellon", nombre: "Castellón de la Plana", provincia: "Castellón", comunidad: "Comunidad Valenciana", poblacion: 170000 },
  { slug: "logrono", nombre: "Logroño", provincia: "La Rioja", comunidad: "La Rioja", poblacion: 152000 },
  { slug: "badajoz", nombre: "Badajoz", provincia: "Badajoz", comunidad: "Extremadura", poblacion: 150000 },
  { slug: "huelva", nombre: "Huelva", provincia: "Huelva", comunidad: "Andalucía", poblacion: 144000, altaInmigracionMarroqui: true },
  { slug: "leon", nombre: "León", provincia: "León", comunidad: "Castilla y León", poblacion: 124000 },
  { slug: "salamanca", nombre: "Salamanca", provincia: "Salamanca", comunidad: "Castilla y León", poblacion: 145000 },
  { slug: "tarragona", nombre: "Tarragona", provincia: "Tarragona", comunidad: "Cataluña", poblacion: 132000 },
  { slug: "lleida", nombre: "Lleida", provincia: "Lleida", comunidad: "Cataluña", poblacion: 137000 },
  { slug: "girona", nombre: "Girona", provincia: "Girona", comunidad: "Cataluña", poblacion: 103000 },
  { slug: "jerez", nombre: "Jerez de la Frontera", provincia: "Cádiz", comunidad: "Andalucía", poblacion: 210000 },
  { slug: "marbella", nombre: "Marbella", provincia: "Málaga", comunidad: "Andalucía", poblacion: 147000, altaInmigracionMarroqui: true },
  { slug: "fuengirola", nombre: "Fuengirola", provincia: "Málaga", comunidad: "Andalucía", poblacion: 80000, altaInmigracionMarroqui: true },
  { slug: "torremolinos", nombre: "Torremolinos", provincia: "Málaga", comunidad: "Andalucía", poblacion: 70000 },
  { slug: "benidorm", nombre: "Benidorm", provincia: "Alicante", comunidad: "Comunidad Valenciana", poblacion: 71000 },
  { slug: "calpe", nombre: "Calpe", provincia: "Alicante", comunidad: "Comunidad Valenciana", poblacion: 22000 },
  { slug: "denia", nombre: "Dénia", provincia: "Alicante", comunidad: "Comunidad Valenciana", poblacion: 42000 },
  { slug: "altea", nombre: "Altea", provincia: "Alicante", comunidad: "Comunidad Valenciana", poblacion: 22000 },
  { slug: "elche", nombre: "Elche", provincia: "Alicante", comunidad: "Comunidad Valenciana", poblacion: 230000 },
  { slug: "cartagena", nombre: "Cartagena", provincia: "Murcia", comunidad: "Región de Murcia", poblacion: 215000 },
  { slug: "figueres", nombre: "Figueres", provincia: "Girona", comunidad: "Cataluña", poblacion: 46000 },
  { slug: "terrassa", nombre: "Terrassa", provincia: "Barcelona", comunidad: "Cataluña", poblacion: 220000 },
  { slug: "badalona", nombre: "Badalona", provincia: "Barcelona", comunidad: "Cataluña", poblacion: 215000 },
  { slug: "hospitalet", nombre: "L'Hospitalet de Llobregat", provincia: "Barcelona", comunidad: "Cataluña", poblacion: 255000 },
  { slug: "sabadell", nombre: "Sabadell", provincia: "Barcelona", comunidad: "Cataluña", poblacion: 210000 },
  { slug: "pontevedra", nombre: "Pontevedra", provincia: "Pontevedra", comunidad: "Galicia", poblacion: 83000 },
];
