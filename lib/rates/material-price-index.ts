import type { City } from "@/lib/rates";
import type { MaterialKey } from "@/lib/rates";

export type MarketMaterialKey = MaterialKey | "aggregate";

export type MaterialPricePoint = {
  date: string;
  price: number;
};

export type MaterialPriceEntry = {
  material: MarketMaterialKey;
  city: City;
  current_price: number;
  last_updated: string;
  source_url: string;
  price_history: MaterialPricePoint[];
};

const DEFAULT_SOURCE = "https://cpwd.gov.in/";
const TODAY = "2026-04-06";

const DEFAULT_PRICE_BY_MATERIAL: Record<MarketMaterialKey, number> = {
  cement: 420,
  steel: 62,
  sand: 4200,
  aggregate: 3600,
  bricks: 7800,
  tiles: 72,
  labour: 900
};

const ALL_CITIES: City[] = [
  "Mumbai",
  "Delhi",
  "Bangalore",
  "Chennai",
  "Hyderabad",
  "Pune",
  "Ahmedabad",
  "Kolkata",
  "Jaipur",
  "Lucknow",
  "Chandigarh",
  "Kochi",
  "Bhopal",
  "Nagpur",
  "Coimbatore",
  "Vizag",
  "Patna",
  "Indore",
  "Surat",
  "Vadodara"
];

const priceDb = new Map<string, MaterialPriceEntry>();

function key(city: City, material: MarketMaterialKey): string {
  return `${city}:${material}`;
}

function initDefaults() {
  for (const city of ALL_CITIES) {
    for (const material of Object.keys(DEFAULT_PRICE_BY_MATERIAL) as MarketMaterialKey[]) {
      const price = DEFAULT_PRICE_BY_MATERIAL[material];
      priceDb.set(key(city, material), {
        material,
        city,
        current_price: price,
        last_updated: TODAY,
        source_url: DEFAULT_SOURCE,
        price_history: [{ date: TODAY, price }]
      });
    }
  }
}
initDefaults();

export function getMaterialPriceIndexForCity(city: City): MaterialPriceEntry[] {
  return (Object.keys(DEFAULT_PRICE_BY_MATERIAL) as MarketMaterialKey[])
    .map((material) => priceDb.get(key(city, material)))
    .filter((x): x is MaterialPriceEntry => Boolean(x));
}

export function getMaterialPrice(city: City, material: MarketMaterialKey): number {
  return priceDb.get(key(city, material))?.current_price ?? DEFAULT_PRICE_BY_MATERIAL[material];
}

export function upsertMaterialPrice(params: {
  city: City;
  material: MarketMaterialKey;
  current_price: number;
  last_updated: string;
  source_url: string;
}): MaterialPriceEntry {
  const recordKey = key(params.city, params.material);
  const existing = priceDb.get(recordKey);
  const nextHistory = [...(existing?.price_history ?? [])];
  nextHistory.push({ date: params.last_updated, price: params.current_price });
  const trimmedHistory = nextHistory.slice(-24);

  const updated: MaterialPriceEntry = {
    city: params.city,
    material: params.material,
    current_price: params.current_price,
    last_updated: params.last_updated,
    source_url: params.source_url,
    price_history: trimmedHistory
  };
  priceDb.set(recordKey, updated);
  return updated;
}

export function getLastRateUpdate(city: City): string {
  const entries = getMaterialPriceIndexForCity(city);
  return entries.reduce((latest, item) => (item.last_updated > latest ? item.last_updated : latest), TODAY);
}

