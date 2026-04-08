import type { BaseRateItemKey, City, MaterialKey, SpecProfile } from "@/lib/rates";
import { getCityCostIndex } from "@/lib/rates/city-index";
import { DSR_BASE_RATES } from "@/lib/rates/dsr-base-rates";
import { getMaterialPrice } from "@/lib/rates/material-price-index";

export const SPEC_ITEM_MULTIPLIER: Record<SpecProfile, Partial<Record<BaseRateItemKey, number>>> = {
  Economy: {
    floor_main_tiles: 0.85,
    floor_bath_tiles: 0.85,
    floor_bath_dado: 0.85,
    floor_kitchen_dado: 0.85,
    dw_main_door: 0.9,
    dw_internal_door: 0.9,
    dw_windows: 0.95,
    paint_internal: 0.92
  },
  Standard: {
    floor_main_tiles: 1.0,
    floor_bath_tiles: 1.0,
    floor_bath_dado: 1.0,
    floor_kitchen_dado: 1.0,
    dw_main_door: 1.0,
    dw_internal_door: 1.0,
    dw_windows: 1.0,
    paint_internal: 1.0
  },
  Premium: {
    floor_main_tiles: 1.75,
    floor_bath_tiles: 1.6,
    floor_bath_dado: 1.7,
    floor_kitchen_dado: 1.65,
    floor_threshold: 1.35,
    dw_main_door: 1.8,
    dw_internal_door: 1.35,
    dw_windows: 1.3,
    dw_grills: 1.2,
    paint_internal: 1.35,
    paint_external: 1.25,
    plumb_cp_fittings: 1.5,
    elec_mcb: 1.25,
    elec_led: 1.2
  }
};

const DEFAULT_SPEC_FACTOR: Record<SpecProfile, number> = {
  Economy: 0.95,
  Standard: 1.0,
  Premium: 1.2
};

function resolveSpecMultiplier(itemKey: BaseRateItemKey, profile: SpecProfile): number {
  return SPEC_ITEM_MULTIPLIER[profile][itemKey] ?? DEFAULT_SPEC_FACTOR[profile];
}

function resolveMaterialAdjustment(params: {
  city: City;
  dominantMaterial: MaterialKey;
  dsrReferencePrice: number;
  overridePrice?: number;
}): number {
  const marketPrice = typeof params.overridePrice === "number" ? params.overridePrice : getMaterialPrice(params.city, params.dominantMaterial);
  if (!Number.isFinite(marketPrice) || marketPrice <= 0 || params.dsrReferencePrice <= 0) return 1;
  return Math.max(0.75, Math.min(1.4, marketPrice / params.dsrReferencePrice));
}

export function calculateRateForItem(params: {
  itemKey: BaseRateItemKey;
  city: City;
  profile: SpecProfile;
  materialOverride?: Partial<Record<MaterialKey, number>>;
}): number {
  const dsr = DSR_BASE_RATES[params.itemKey];
  const cityIndex = getCityCostIndex(params.city);
  const specMultiplier = resolveSpecMultiplier(params.itemKey, params.profile);
  const overridePrice = params.materialOverride?.[dsr.dominant_material];
  const materialPriceAdjustment = resolveMaterialAdjustment({
    city: params.city,
    dominantMaterial: dsr.dominant_material,
    dsrReferencePrice: dsr.dsr_reference_price,
    overridePrice
  });

  return dsr.base_rate * cityIndex * specMultiplier * materialPriceAdjustment;
}

