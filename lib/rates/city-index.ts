export type CityIndexEntry = {
  city: string;
  state: string;
  ssr_reference: string;
  cost_index: number;
  last_updated: string;
};

const LAST_UPDATED = "2026-04-06";

export const CITY_COST_INDEX: Record<string, CityIndexEntry> = {
  Mumbai: { city: "Mumbai", state: "Maharashtra", ssr_reference: "Maharashtra PWD SSR (derived vs CPWD DSR)", cost_index: 1.15, last_updated: LAST_UPDATED },
  Delhi: { city: "Delhi", state: "Delhi", ssr_reference: "CPWD + Delhi schedule correlation", cost_index: 1.25, last_updated: LAST_UPDATED },
  Bangalore: { city: "Bangalore", state: "Karnataka", ssr_reference: "Karnataka PWD SSR (derived vs CPWD DSR)", cost_index: 1.2, last_updated: LAST_UPDATED },
  Chennai: { city: "Chennai", state: "Tamil Nadu", ssr_reference: "Tamil Nadu PWD SSR (derived vs CPWD DSR)", cost_index: 1.1, last_updated: LAST_UPDATED },
  Hyderabad: { city: "Hyderabad", state: "Telangana", ssr_reference: "Telangana SSR (derived vs CPWD DSR)", cost_index: 1.05, last_updated: LAST_UPDATED },
  Pune: { city: "Pune", state: "Maharashtra", ssr_reference: "Maharashtra PWD SSR (derived vs CPWD DSR)", cost_index: 1.15, last_updated: LAST_UPDATED },
  Ahmedabad: { city: "Ahmedabad", state: "Gujarat", ssr_reference: "Gujarat PWD SSR (derived vs CPWD DSR)", cost_index: 1.0, last_updated: LAST_UPDATED },
  Kolkata: { city: "Kolkata", state: "West Bengal", ssr_reference: "WB PWD SSR (derived vs CPWD DSR)", cost_index: 1.05, last_updated: LAST_UPDATED },
  Jaipur: { city: "Jaipur", state: "Rajasthan", ssr_reference: "Rajasthan PWD SSR (derived vs CPWD DSR)", cost_index: 0.95, last_updated: LAST_UPDATED },
  Lucknow: { city: "Lucknow", state: "Uttar Pradesh", ssr_reference: "UP PWD SSR (derived vs CPWD DSR)", cost_index: 0.9, last_updated: LAST_UPDATED },
  Chandigarh: { city: "Chandigarh", state: "Chandigarh", ssr_reference: "CPWD regional schedule correlation", cost_index: 1.1, last_updated: LAST_UPDATED },
  Kochi: { city: "Kochi", state: "Kerala", ssr_reference: "Kerala PWD SSR (derived vs CPWD DSR)", cost_index: 1.1, last_updated: LAST_UPDATED },
  Bhopal: { city: "Bhopal", state: "Madhya Pradesh", ssr_reference: "MP PWD SSR (derived vs CPWD DSR)", cost_index: 0.85, last_updated: LAST_UPDATED },
  Nagpur: { city: "Nagpur", state: "Maharashtra", ssr_reference: "Maharashtra PWD SSR (derived vs CPWD DSR)", cost_index: 0.9, last_updated: LAST_UPDATED },
  Coimbatore: { city: "Coimbatore", state: "Tamil Nadu", ssr_reference: "Tamil Nadu PWD SSR (derived vs CPWD DSR)", cost_index: 1.0, last_updated: LAST_UPDATED },
  Vizag: { city: "Vizag", state: "Andhra Pradesh", ssr_reference: "AP SSR (derived vs CPWD DSR)", cost_index: 0.95, last_updated: LAST_UPDATED },
  Patna: { city: "Patna", state: "Bihar", ssr_reference: "Bihar SSR (derived vs CPWD DSR)", cost_index: 0.85, last_updated: LAST_UPDATED },
  Indore: { city: "Indore", state: "Madhya Pradesh", ssr_reference: "MP PWD SSR (derived vs CPWD DSR)", cost_index: 0.88, last_updated: LAST_UPDATED },
  Surat: { city: "Surat", state: "Gujarat", ssr_reference: "Gujarat PWD SSR (derived vs CPWD DSR)", cost_index: 1.0, last_updated: LAST_UPDATED },
  Vadodara: { city: "Vadodara", state: "Gujarat", ssr_reference: "Gujarat PWD SSR (derived vs CPWD DSR)", cost_index: 0.95, last_updated: LAST_UPDATED }
};

export function getCityCostIndex(city: string): number {
  return CITY_COST_INDEX[city]?.cost_index ?? 1;
}

