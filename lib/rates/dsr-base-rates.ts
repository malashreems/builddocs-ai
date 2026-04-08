import type { BaseRateItemKey, MaterialKey } from "@/lib/rates";

export type DsrBaseRateItem = {
  item_key: BaseRateItemKey;
  base_rate: number;
  dominant_material: MaterialKey;
  dsr_reference_price: number;
  source: "CPWD DSR 2024";
  last_verified: string;
};

const LAST_VERIFIED = "2026-04-06";

const BASE_RATE_VALUES: Record<BaseRateItemKey, number> = {
  earth_excavation: 194,
  earth_sand_fill: 517,
  earth_anti_termite: 66,
  conc_pcc: 4675,
  conc_rcc_footing: 6832,
  conc_plinth_beam: 7120,
  conc_roof_slab: 7372,
  conc_lintel_sunshade: 7552,
  mas_external_walls: 2373,
  mas_internal_walls: 2194,
  mas_dpc: 131,
  shut_foundation: 205,
  shut_roof: 248,
  shut_beam_lintel: 248,
  steel_main: 20,
  steel_extra: 20,
  plas_internal: 86,
  plas_external: 97,
  plas_putty: 32,
  floor_main_tiles: 517,
  floor_bath_tiles: 461,
  floor_bath_dado: 490,
  floor_kitchen_dado: 432,
  floor_threshold: 144,
  dw_main_door: 12658,
  dw_internal_door: 2589,
  dw_bath_door: 1654,
  dw_windows: 3596,
  dw_ventilator: 1007,
  dw_grills: 82,
  plumb_cpvc: 71,
  plumb_drain: 78,
  plumb_ewc: 2733,
  plumb_basin: 1438,
  plumb_sink: 1690,
  plumb_cp_fittings: 9709,
  plumb_tank: 2877,
  plumb_septic: 16182,
  elec_light: 353,
  elec_fan: 378,
  elec_socket: 403,
  elec_heavy: 805,
  elec_mcb: 4783,
  elec_earthing: 2115,
  elec_led: 327,
  elec_ceiling_fan: 1108,
  paint_external: 71,
  paint_internal: 64,
  paint_enamel: 60,
  paint_primer: 30,
  misc_compound_wall: 767,
  misc_main_gate: 12738,
  misc_tank_stand: 4777,
  misc_apron: 111,
  misc_contingency: 1
};

const DOMINANT_MATERIAL: Record<BaseRateItemKey, MaterialKey> = {
  earth_excavation: "labour",
  earth_sand_fill: "sand",
  earth_anti_termite: "labour",
  conc_pcc: "cement",
  conc_rcc_footing: "steel",
  conc_plinth_beam: "steel",
  conc_roof_slab: "steel",
  conc_lintel_sunshade: "steel",
  mas_external_walls: "bricks",
  mas_internal_walls: "bricks",
  mas_dpc: "cement",
  shut_foundation: "labour",
  shut_roof: "labour",
  shut_beam_lintel: "labour",
  steel_main: "steel",
  steel_extra: "steel",
  plas_internal: "cement",
  plas_external: "cement",
  plas_putty: "labour",
  floor_main_tiles: "tiles",
  floor_bath_tiles: "tiles",
  floor_bath_dado: "tiles",
  floor_kitchen_dado: "tiles",
  floor_threshold: "tiles",
  dw_main_door: "labour",
  dw_internal_door: "labour",
  dw_bath_door: "labour",
  dw_windows: "labour",
  dw_ventilator: "labour",
  dw_grills: "steel",
  plumb_cpvc: "labour",
  plumb_drain: "labour",
  plumb_ewc: "labour",
  plumb_basin: "labour",
  plumb_sink: "labour",
  plumb_cp_fittings: "labour",
  plumb_tank: "labour",
  plumb_septic: "labour",
  elec_light: "labour",
  elec_fan: "labour",
  elec_socket: "labour",
  elec_heavy: "labour",
  elec_mcb: "labour",
  elec_earthing: "labour",
  elec_led: "labour",
  elec_ceiling_fan: "labour",
  paint_external: "labour",
  paint_internal: "labour",
  paint_enamel: "labour",
  paint_primer: "labour",
  misc_compound_wall: "bricks",
  misc_main_gate: "steel",
  misc_tank_stand: "steel",
  misc_apron: "cement",
  misc_contingency: "labour"
};

const DSR_REFERENCE_PRICE: Record<MaterialKey, number> = {
  cement: 420,
  steel: 62,
  sand: 4200,
  bricks: 7800,
  tiles: 72,
  labour: 900
};

export const DSR_BASE_RATES: Record<BaseRateItemKey, DsrBaseRateItem> = Object.fromEntries(
  (Object.keys(BASE_RATE_VALUES) as BaseRateItemKey[]).map((itemKey) => [
    itemKey,
    {
      item_key: itemKey,
      base_rate: BASE_RATE_VALUES[itemKey],
      dominant_material: DOMINANT_MATERIAL[itemKey],
      dsr_reference_price: DSR_REFERENCE_PRICE[DOMINANT_MATERIAL[itemKey]],
      source: "CPWD DSR 2024",
      last_verified: LAST_VERIFIED
    }
  ])
) as Record<BaseRateItemKey, DsrBaseRateItem>;

