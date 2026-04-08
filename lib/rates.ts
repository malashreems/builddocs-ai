import { CITY_COST_INDEX } from "@/lib/rates/city-index";
import { DSR_BASE_RATES } from "@/lib/rates/dsr-base-rates";
import { calculateRateForItem } from "@/lib/rates/rate-calculator";

export const CITY_MULTIPLIER = {
  Mumbai: CITY_COST_INDEX.Mumbai.cost_index,
  Delhi: CITY_COST_INDEX.Delhi.cost_index,
  Bangalore: CITY_COST_INDEX.Bangalore.cost_index,
  Chennai: CITY_COST_INDEX.Chennai.cost_index,
  Hyderabad: CITY_COST_INDEX.Hyderabad.cost_index,
  Pune: CITY_COST_INDEX.Pune.cost_index,
  Ahmedabad: CITY_COST_INDEX.Ahmedabad.cost_index,
  Kolkata: CITY_COST_INDEX.Kolkata.cost_index,
  Jaipur: CITY_COST_INDEX.Jaipur.cost_index,
  Lucknow: CITY_COST_INDEX.Lucknow.cost_index,
  Chandigarh: CITY_COST_INDEX.Chandigarh.cost_index,
  Kochi: CITY_COST_INDEX.Kochi.cost_index,
  Bhopal: CITY_COST_INDEX.Bhopal.cost_index,
  Nagpur: CITY_COST_INDEX.Nagpur.cost_index,
  Coimbatore: CITY_COST_INDEX.Coimbatore.cost_index,
  Vizag: CITY_COST_INDEX.Vizag.cost_index,
  Patna: CITY_COST_INDEX.Patna.cost_index,
  Indore: CITY_COST_INDEX.Indore.cost_index,
  Surat: CITY_COST_INDEX.Surat.cost_index,
  Vadodara: CITY_COST_INDEX.Vadodara.cost_index
} as const;

export type City = keyof typeof CITY_MULTIPLIER;
export type SpecProfile = "Economy" | "Standard" | "Premium";
export type MaterialKey = "cement" | "steel" | "sand" | "bricks" | "tiles" | "labour";

export type BaseRateItemKey =
  | "earth_excavation"
  | "earth_sand_fill"
  | "earth_anti_termite"
  | "conc_pcc"
  | "conc_rcc_footing"
  | "conc_plinth_beam"
  | "conc_roof_slab"
  | "conc_lintel_sunshade"
  | "mas_external_walls"
  | "mas_internal_walls"
  | "mas_dpc"
  | "shut_foundation"
  | "shut_roof"
  | "shut_beam_lintel"
  | "steel_main"
  | "steel_extra"
  | "plas_internal"
  | "plas_external"
  | "plas_putty"
  | "floor_main_tiles"
  | "floor_bath_tiles"
  | "floor_bath_dado"
  | "floor_kitchen_dado"
  | "floor_threshold"
  | "dw_main_door"
  | "dw_internal_door"
  | "dw_bath_door"
  | "dw_windows"
  | "dw_ventilator"
  | "dw_grills"
  | "plumb_cpvc"
  | "plumb_drain"
  | "plumb_ewc"
  | "plumb_basin"
  | "plumb_sink"
  | "plumb_cp_fittings"
  | "plumb_tank"
  | "plumb_septic"
  | "elec_light"
  | "elec_fan"
  | "elec_socket"
  | "elec_heavy"
  | "elec_mcb"
  | "elec_earthing"
  | "elec_led"
  | "elec_ceiling_fan"
  | "paint_external"
  | "paint_internal"
  | "paint_enamel"
  | "paint_primer"
  | "misc_compound_wall"
  | "misc_main_gate"
  | "misc_tank_stand"
  | "misc_apron"
  | "misc_contingency";

export const BASE_RATES: Record<BaseRateItemKey, number> = Object.fromEntries(
  (Object.keys(DSR_BASE_RATES) as BaseRateItemKey[]).map((key) => [key, DSR_BASE_RATES[key].base_rate])
) as Record<BaseRateItemKey, number>;

export function getRateForItem(params: {
  itemKey: BaseRateItemKey;
  city: City;
  profile: SpecProfile;
  materialKey?: MaterialKey;
  customRates?: Partial<Record<MaterialKey, number>>;
}): number {
  const override = params.customRates ?? {};
  return calculateRateForItem({
    itemKey: params.itemKey,
    city: params.city,
    profile: params.profile,
    materialOverride: override
  });
}
