// Current UK car models for every make in data/approved-vehicle-makes.json,
// including the electric and hybrid models the older make/model dataset
// misses. getModelsForMake (vehicleModels.ts) merges these with that list.
//
// Each make's models are separated by "|". A trailing "*" marks an electric
// model and "~" a model that only comes as a hybrid, so the diagnosis tool
// can tell an EV from a petrol or diesel car.

const RAW: Record<string, string> = {
  Abarth: "500|595|695|124 Spider|500e*|600e*",
  AION: "Y Plus*|V*",
  "Alfa Romeo": "Giulia|Giulietta|Stelvio|Tonale|MiTo|Junior|Junior Elettrica*|4C",
  Alpine: "A110|A290*|A390*",
  Audi: "A1|A3|A4|A5|A6|A7|A8|Q2|Q3|Q5|Q7|Q8|TT|R8|S3|S4|S5|RS3|RS4|RS5|RS6|RS Q8|SQ5|e-tron*|e-tron GT*|Q4 e-tron*|Q6 e-tron*|Q8 e-tron*|A6 e-tron*",
  BMW: "1 Series|2 Series|2 Series Active Tourer|2 Series Gran Coupe|3 Series|4 Series|5 Series|6 Series|7 Series|8 Series|X1|X2|X3|X4|X5|X6|X7|XM|Z4|M2|M3|M4|M5|i3*|i4*|i5*|i7*|iX*|iX1*|iX2*|iX3*",
  BYD: "Atto 2*|Atto 3*|Dolphin*|Dolphin Surf*|Seal*|Seal U*|Seal U DM-i~|Sealion 7*|Han*|Tang*",
  Changan: "Deepal S07*|Avatr 11*",
  Citroen:
    "C1|C3|C3 Aircross|C4|C4 X|C5 Aircross|C5 X|Berlingo|SpaceTourer|DS3|ë-C3*|ë-C4*|ë-C4 X*|ë-Berlingo*|ë-SpaceTourer*|Ami*",
  CUPRA: "Born*|Tavascan*|Raval*|Formentor|Leon|Ateca|Terramar",
  Dacia: "Sandero|Sandero Stepway|Duster|Jogger|Bigster|Logan|Spring*",
  "DS AUTOMOBILES": "DS 3|DS 3 Crossback|DS 3 E-Tense*|DS 4|DS 7|DS 9|N°8*",
  Fiat: "500|500C|500X|500L|Panda|Tipo|Doblo|Ducato|600|600e*|500e*|Grande Panda|Grande Panda Electric*|Topolino*",
  Fisker: "Ocean*",
  Ford: "Fiesta|Focus|Puma|Puma Gen-E*|Kuga|EcoSport|Mondeo|S-Max|Galaxy|Mustang|Mustang Mach-E*|Explorer|Explorer EV*|Capri*|Ranger|Transit|Transit Custom|Transit Connect|Tourneo Custom|E-Transit*|E-Transit Custom*|B-Max|C-Max|Ka",
  Geely: "EX5*|Starray",
  Genesis: "G70|G80|Electrified G80*|GV60*|GV70|Electrified GV70*|GV80",
  GMC: "Hummer EV*|Sierra|Yukon",
  GWM: "Ora 03*|Ora 07*|Haval H6|Haval Jolion|Tank 300|Cannon",
  Honda: "Jazz|Civic|Civic Type R|HR-V|ZR-V|CR-V|e*|e:Ny1*|Insight~|Accord|NSX|CR-Z",
  Hummer: "H2|H3|EV*",
  Hyundai:
    "i10|i20|i30|i20 N|i30 N|Bayon|Kona|Kona Electric*|Tucson|Santa Fe|ix20|ix35|Ioniq~|Ioniq Electric*|Ioniq 5*|Ioniq 5 N*|Ioniq 6*|Ioniq 9*|Inster*|Nexo",
  Isuzu: "D-Max",
  JAECOO: "7",
  Jaguar: "XE|XF|XJ|F-Type|F-Pace|E-Pace|I-Pace*|Type 00*",
  Jeep: "Avenger|Avenger Electric*|Renegade|Compass|Wrangler|Grand Cherokee|Cherokee",
  KGM: "Tivoli|Korando|Korando e-Motion*|Torres|Torres EVX*|Rexton|Musso",
  Kia: "Picanto|Rio|Ceed|ProCeed|XCeed|Stonic|Niro|Niro EV*|e-Niro*|Soul|Soul EV*|Sportage|Sorento|Optima|Stinger|Carens|Venga|EV3*|EV4*|EV5*|EV6*|EV9*",
  "Land Rover":
    "Defender|Discovery|Discovery Sport|Freelander|Range Rover|Range Rover Sport|Range Rover Velar|Range Rover Evoque|Range Rover Electric*",
  Leapmotor: "T03*|C10*|B10*",
  LEVC: "TX~|VN5~",
  Lexus: "CT~|ES~|IS|LS|LBX~|NX|RX|UX|UX 300e*|RZ*|LC|RC|LM~",
  Lotus: "Elise|Exige|Evora|Emira|Eletre*|Emeya*|Evija*",
  Maserati:
    "Ghibli|Levante|Quattroporte|Grecale|Grecale Folgore*|GranTurismo|GranTurismo Folgore*|MC20",
  MAXUS: "Deliver 9|T60|eDeliver 3*|eDeliver 7*|eDeliver 9*|T90 EV*|MIFA 9*|Euniq 5*",
  Mazda: "2|2 Hybrid~|3|6|CX-3|CX-30|CX-5|CX-60|CX-80|MX-5|MX-30*|6e*|RX-8",
  "Mercedes-Benz":
    "A-Class|B-Class|C-Class|CLA|CLS|E-Class|S-Class|G-Class|GLA|GLB|GLC|GLE|GLS|SL|AMG GT|V-Class|Vito|Sprinter|Citan|EQA*|EQB*|EQC*|EQE*|EQE SUV*|EQS*|EQS SUV*|EQV*|eVito*|eSprinter*|G 580 EQ*|CLA Electric*",
  MG: "MG3|MG3 Hybrid+~|MG4*|MG5*|ZS|ZS EV*|HS|HS Plug-in~|MG S5 EV*|Cyberster*|Marvel R*|IM5*|IM6*|MG6|GS",
  Micro: "Microlino*",
  MINI: "Hatch|Convertible|Clubman|Countryman|Countryman E*|Paceman|Coupe|Roadster|Cooper|Cooper S|John Cooper Works|Electric*|Cooper E*|Cooper SE*|Aceman*",
  MOKE: "Moke|Moke Electric*",
  Nissan:
    "Micra|Note|Juke|Qashqai|X-Trail|Navara|Pulsar|370Z|GT-R|Leaf*|e-NV200*|Ariya*|Townstar|Townstar EV*|Primastar|Interstar|Pathfinder|Murano|Almera",
  OMODA: "5|E5*|9",
  Peugeot:
    "107|108|207|208|e-208*|307|308|e-308*|407|408|e-408*|508|2008|e-2008*|3008|e-3008*|5008|e-5008*|Rifter|e-Rifter*|Partner|e-Partner*|Expert|Traveller|e-Traveller*|iOn*|RCZ",
  Polestar: "1~|2*|3*|4*",
  Porsche: "911|718 Boxster|718 Cayman|Cayenne|Macan|Macan Electric*|Panamera|Taycan*",
  Renault:
    "Clio|Captur|Megane|Megane E-Tech Electric*|Scenic|Scenic E-Tech Electric*|Kadjar|Koleos|Austral|Arkana|Espace|Symbioz|Rafale|Twingo|Twingo Electric*|Zoe*|5 E-Tech*|4 E-Tech*|Kangoo|Kangoo E-Tech*|Trafic|Master|Twizy*",
  Rimac: "Nevera*",
  Rivian: "R1T*|R1S*|R2*",
  "Rolls-Royce": "Ghost|Phantom|Wraith|Dawn|Cullinan|Spectre*",
  SEAT: "Ibiza|Arona|Leon|Ateca|Tarraco|Alhambra|Toledo|Mii|Mii Electric*",
  Skoda:
    "Fabia|Scala|Octavia|Superb|Kamiq|Karoq|Kodiaq|Rapid|Yeti|Citigo|Citigo e iV*|Enyaq*|Elroq*",
  Skywell: "ET5*|BE11*",
  Smart: "Fortwo|Forfour|EQ fortwo*|EQ forfour*|#1*|#3*|#5*",
  SsangYong: "Tivoli|Korando|Korando e-Motion*|Rexton|Musso",
  Subaru: "Impreza|XV|Crosstrek|Forester|Outback|Levorg|BRZ|WRX|Solterra*",
  Suzuki: "Celerio|Swift|Ignis|Baleno|Vitara|S-Cross|Jimny|Swace~|Across|e Vitara*",
  Tesla: "Model 3*|Model Y*|Model S*|Model X*|Cybertruck*|Roadster*",
  Toyota:
    "Aygo|Aygo X|Yaris|Yaris Cross|GR Yaris|Auris|Corolla|C-HR|RAV4|Avensis|Verso|Camry|Prius~|Prius Plug-in~|Mirai|Highlander|Land Cruiser|Hilux|Supra|GT86|GR86|Proace|Proace City|bZ4X*|Urban Cruiser*|Proace Electric*",
  Vauxhall:
    "Adam|Viva|Corsa|Corsa Electric*|Corsa-e*|Astra|Astra Electric*|Mokka|Mokka Electric*|Mokka-e*|Frontera|Frontera Electric*|Crossland|Grandland|Grandland Electric*|Insignia|Meriva|Zafira|Zafira Life|Antara|Combo Life|Combo Electric*|Vivaro|Vivaro Life|Vivaro Electric*|Movano|Ampera~|Ampera-e*",
  Volkswagen:
    "up!|e-up!*|Polo|Golf|Golf GTI|Golf R|e-Golf*|T-Cross|T-Roc|Taigo|Tiguan|Tiguan Allspace|Touareg|Touran|Passat|Arteon|Sharan|Scirocco|Beetle|Caddy|Transporter|Multivan|California|Crafter|Amarok|ID.2*|ID.3*|ID.4*|ID.5*|ID.7*|ID. Buzz*|e-Crafter*",
  Volvo:
    "V40|V60|V90|S60|S90|XC40|XC60|XC90|XC40 Recharge*|C40 Recharge*|EX30*|EX40*|EC40*|EX90*|ES90*",
};

export type ModelPowertrain = "electric" | "hybrid";

type UkModel = { name: string; powertrain?: ModelPowertrain };

const key = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const BY_MAKE = new Map<string, UkModel[]>(
  Object.entries(RAW).map(([make, list]) => [
    key(make),
    list.split("|").map((entry) => {
      if (entry.endsWith("*")) return { name: entry.slice(0, -1), powertrain: "electric" };
      if (entry.endsWith("~")) return { name: entry.slice(0, -1), powertrain: "hybrid" };
      return { name: entry };
    }),
  ]),
);

/** Current UK models for a make (names only), or [] if we have none. */
export function ukModelsForMake(make: string): string[] {
  return (BY_MAKE.get(key(make)) ?? []).map((m) => m.name);
}

// Typed-in models we don't list: names that only ever mean an EV.
const EV_NAME =
  /\b(ev|electric|e-tron|e-?golf|leaf|zoe|ioniq [5-9]|id\.\s?\d|id\. buzz|eq[a-z]|mach-e|taycan|i-pace|model [3sxy]|e-\d{3,4})\b/i;

/**
 * "electric" or "hybrid" when the make and model tell us, otherwise null
 * (most models come as petrol or diesel, so we can't know which).
 */
export function modelPowertrain(make: string, model: string): ModelPowertrain | null {
  if (!model.trim()) return null;
  const listed = (BY_MAKE.get(key(make)) ?? []).find((m) => key(m.name) === key(model));
  if (listed) return listed.powertrain ?? null;
  return EV_NAME.test(model) ? "electric" : null;
}

export const modelKey = key;
