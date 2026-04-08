import { type BaseRateItemKey, getRateForItem, type City, type MaterialKey, type SpecProfile } from "@/lib/rates";

export type BldType = "2BHK" | "3BHK" | "4BHK" | "Duplex";
export type StructureType = "RCC Framed" | "Load Bearing";

export type MaterialRatesInput = Partial<Record<MaterialKey, number>>;

export type BoqInput = {
  widthFt: number;
  lengthFt: number;
  floors: number;
  city: City;
  buildingType: BldType;
  structureType: StructureType;
  specificationProfile: SpecProfile;
  customRates?: MaterialRatesInput;
};

export type BoqItem = {
  scheduleId: string;
  scheduleName: string;
  dsr_item_no: string;
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  amount: number;
  itemKey: BaseRateItemKey;
};

export type BoqResult = {
  input: BoqInput;
  project: {
    plotAreaSqft: number;
    plotAreaSqm: number;
    builtUpAreaSqft: number;
    builtUpAreaSqm: number;
    perimeterM: number;
    wallHeightM: number;
    floors: number;
    roomCounts: RoomCounts;
  };
  items: BoqItem[];
  scheduleTotals: Array<{ scheduleId: string; scheduleName: string; amount: number }>;
  totals: {
    schedulesTotal: number;
    contractorProfit: number;
    gst: number;
    grandTotal: number;
    costPerSqft: number;
  };
  metrics: {
    totalConcreteVolume: number;
    totalBrickVolume: number;
    totalPlasterArea: number;
    internalPlasterArea: number;
    externalPlasterArea: number;
    flooringMainArea: number;
    flooringDadoArea: number;
    steelKg: number;
    /** Total cement bags: concrete + plaster + masonry mortar + tile/screed bedding (procurement summary). */
    totalCementBags: number;
    plumbingPipesRm: number;
    electricalPoints: number;
  };
};

type RoomCounts = {
  bedrooms: number;
  bathrooms: number;
  kitchen: number;
  living: number;
  dining: number;
  study: number;
  doors: number;
  windows: number;
};

const SCHEDULES: Array<{ id: string; name: string }> = [
  { id: "A", name: "SCHEDULE A - EARTHWORK" },
  { id: "B", name: "SCHEDULE B - CONCRETE" },
  { id: "C", name: "SCHEDULE C - MASONRY" },
  { id: "D", name: "SCHEDULE D - SHUTTERING" },
  { id: "E", name: "SCHEDULE E - STEEL REINFORCEMENT" },
  { id: "F", name: "SCHEDULE F - PLASTERING" },
  { id: "G", name: "SCHEDULE G - FLOORING" },
  { id: "H", name: "SCHEDULE H - DOORS & WINDOWS" },
  { id: "I", name: "SCHEDULE I - PLUMBING" },
  { id: "J", name: "SCHEDULE J - ELECTRICAL" },
  { id: "K", name: "SCHEDULE K - PAINTING" },
  { id: "L", name: "SCHEDULE L - MISCELLANEOUS" }
];

function getRoomCounts(buildingType: BldType): RoomCounts {
  if (buildingType === "2BHK") {
    return { bedrooms: 2, bathrooms: 2, kitchen: 1, living: 1, dining: 0, study: 0, doors: 5, windows: 4 };
  }
  if (buildingType === "3BHK") {
    return { bedrooms: 3, bathrooms: 2, kitchen: 1, living: 1, dining: 1, study: 0, doors: 7, windows: 6 };
  }
  if (buildingType === "4BHK") {
    return { bedrooms: 4, bathrooms: 3, kitchen: 1, living: 1, dining: 1, study: 1, doors: 9, windows: 8 };
  }
  return { bedrooms: 4, bathrooms: 3, kitchen: 1, living: 1, dining: 1, study: 1, doors: 9, windows: 8 };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function generateBoq(input: BoqInput): BoqResult {
  const widthFt = Math.max(input.widthFt, 0);
  const lengthFt = Math.max(input.lengthFt, 0);
  const floors = Math.max(Math.floor(input.floors), 1);
  const groundCoverage = 0.6;

  const plotAreaSqft = widthFt * lengthFt;
  const plotAreaSqm = plotAreaSqft / 10.764;
  const footprintAreaSqft = plotAreaSqft * groundCoverage;
  const footprintAreaSqm = footprintAreaSqft / 10.764;
  const builtUpAreaSqft = plotAreaSqft * groundCoverage * floors;
  const builtUpAreaSqm = builtUpAreaSqft / 10.764;
  const perimeterM = (2 * (widthFt + lengthFt)) / 3.281;
  const wallHeightM = 3.0;
  const rooms = getRoomCounts(input.buildingType);
  const internalWallLength = perimeterM * 0.8;
  const bathroomArea = rooms.bathrooms * 3;
  const bathroomDadoArea = rooms.bathrooms * 3 * 4 * 2.1;
  const numberOfFootings = Math.ceil(footprintAreaSqm / 9);

  const items: BoqItem[] = [];

  const addItem = (
    scheduleId: string,
    dsr_item_no: string,
    description: string,
    unit: string,
    quantity: number,
    itemKey: BaseRateItemKey,
    materialKey?: MaterialKey
  ) => {
    const scheduleName = SCHEDULES.find((s) => s.id === scheduleId)?.name ?? scheduleId;
    const rate = getRateForItem({
      itemKey,
      city: input.city,
      profile: input.specificationProfile,
      materialKey,
      customRates: input.customRates
    });
    items.push({
      scheduleId,
      scheduleName,
      dsr_item_no,
      description,
      unit,
      quantity: round2(quantity),
      rate: round2(rate),
      amount: round2(quantity * rate),
      itemKey
    });
  };

  // Schedule A
  addItem(
    "A",
    "2.8.1",
    "Earthwork in excavation in foundation trenches in ordinary soil complete as per IS 1200.",
    "Cu.m",
    perimeterM * 0.9 * 1.2,
    "earth_excavation",
    "labour"
  );
  addItem(
    "A",
    "2.25",
    "Filling in plinth with sand under floors including watering and compaction as per IS 2720.",
    "Cu.m",
    footprintAreaSqm * 0.3,
    "earth_sand_fill",
    "sand"
  );
  addItem(
    "A",
    "4.17",
    "Anti-termite treatment at plinth level with chlorpyrifos emulsion as per IS 6313 (Part 2).",
    "Sq.m",
    footprintAreaSqm,
    "earth_anti_termite"
  );

  // Schedule B
  const pccQty = perimeterM * 0.9 * 0.1;
  const rccFootingQty = numberOfFootings * 1.2 * 1.2 * 0.3;
  const plinthBeamQty = perimeterM * 0.23 * 0.3;
  const roofSlabQty = footprintAreaSqm * 0.125 * floors;
  const lintelQty = (rooms.doors + rooms.windows) * 1.2 * 0.23 * 0.15 * floors;
  addItem(
    "B",
    "4.1.8",
    "Providing and laying PCC M7.5 in foundations with nominal mix as per IS 456:2000.",
    "Cu.m",
    pccQty,
    "conc_pcc",
    "cement"
  );
  addItem(
    "B",
    "5.33",
    "RCC work in footings M20 grade including centering and curing as per IS 456:2000.",
    "Cu.m",
    rccFootingQty,
    "conc_rcc_footing",
    "cement"
  );
  addItem(
    "B",
    "5.10",
    "RCC plinth beam M20 with vibration and curing complete as per IS 456:2000.",
    "Cu.m",
    plinthBeamQty,
    "conc_plinth_beam",
    "cement"
  );
  addItem(
    "B",
    "5.9",
    "RCC roof slab M25 including pumping and mechanical compaction as per IS 456:2000.",
    "Cu.m",
    roofSlabQty,
    "conc_roof_slab",
    "cement"
  );
  addItem(
    "B",
    "5.22",
    "RCC lintels and sunshades over openings with nominal reinforcement as per IS 456:2000.",
    "Cu.m",
    lintelQty,
    "conc_lintel_sunshade",
    "cement"
  );

  // Schedule C
  const doorOpeningVol = rooms.doors * 2.1 * 1.0 * 0.23;
  const windowOpeningVol = rooms.windows * 1.2 * 1.2 * 0.23;
  const extWallQty = perimeterM * wallHeightM * floors * 0.23 - doorOpeningVol - windowOpeningVol;
  const intWallQty = internalWallLength * wallHeightM * floors * 0.115;
  const dpcQty = perimeterM * 0.23 * floors;
  addItem(
    "C",
    "6.4.2",
    "Brick masonry in cement mortar 1:6 for external walls 230mm thick as per IS 2212.",
    "Cu.m",
    Math.max(extWallQty, 0),
    "mas_external_walls",
    "bricks"
  );
  addItem(
    "C",
    "6.4.4",
    "Half brick masonry 115mm thick in CM 1:4 for internal partitions as per IS 1905.",
    "Cu.m",
    intWallQty,
    "mas_internal_walls",
    "bricks"
  );
  addItem(
    "C",
    "7.3",
    "Damp proof course 40mm thick in cement concrete 1:2:4 with waterproofing compound as per IS 2645.",
    "Sq.m",
    dpcQty,
    "mas_dpc",
    "cement"
  );

  // Schedule D
  addItem(
    "D",
    "5.9.1",
    "Centering and shuttering for foundations and footings complete as per IS 4990.",
    "Sq.m",
    perimeterM * 0.9 * 2,
    "shut_foundation",
    "labour"
  );
  addItem(
    "D",
    "5.9.12",
    "Centering and shuttering for suspended slabs including propping and deshuttering as per IS 14687.",
    "Sq.m",
    footprintAreaSqm * floors,
    "shut_roof",
    "labour"
  );
  addItem(
    "D",
    "5.9.6",
    "Shuttering for beams and lintels with plywood forms and supports as per IS 4990.",
    "Sq.m",
    perimeterM * 0.3 * 2 * floors,
    "shut_beam_lintel",
    "labour"
  );

  // Schedule E — total steel = built-up × kg/sqft (main + 15% extra must equal that total)
  const steelKgPerSqftAllIn = input.structureType === "RCC Framed" ? 3.8 : 2.0;
  const steelTotalKg = builtUpAreaSqft * steelKgPerSqftAllIn;
  const steelMainQty = steelTotalKg / 1.15;
  addItem(
    "E",
    "5.22.6",
    "TMT reinforcement Fe500D including cutting, bending and binding complete as per IS 1786.",
    "Kg",
    steelMainQty,
    "steel_main",
    "steel"
  );
  addItem(
    "E",
    "5.22.7",
    "Extra steel for distribution and smaller diameter bars including wastage as per IS 2502.",
    "Kg",
    steelMainQty * 0.15,
    "steel_extra",
    "steel"
  );

  // Schedule F
  const internalPlasterArea = (perimeterM + internalWallLength) * wallHeightM * floors * 2 + builtUpAreaSqm;
  const externalPlasterArea = perimeterM * wallHeightM * floors;
  addItem(
    "F",
    "13.1.1",
    "12mm cement plaster in CM 1:6 on internal walls and ceilings including curing as per IS 1661.",
    "Sq.m",
    internalPlasterArea,
    "plas_internal",
    "cement"
  );
  addItem(
    "F",
    "13.7.1",
    "15mm cement plaster in CM 1:4 on exterior surfaces including scaffolding as per IS 1661.",
    "Sq.m",
    externalPlasterArea,
    "plas_external",
    "cement"
  );
  addItem(
    "F",
    "13.80",
    "Wall putty two coats over primer on internal plastered surfaces as per IS 15489.",
    "Sq.m",
    internalPlasterArea,
    "plas_putty",
    "labour"
  );

  // Schedule G
  const mainFloorArea = builtUpAreaSqm - bathroomArea * floors;
  addItem(
    "G",
    "11.41.2",
    "Vitrified floor tiles 600x600 in CM with polymer grout as per IS 15622.",
    "Sq.m",
    Math.max(mainFloorArea, 0),
    "floor_main_tiles",
    "tiles"
  );
  addItem(
    "G",
    "11.37.1",
    "Anti-skid ceramic tiles in bathrooms and utility areas complete as per IS 15622.",
    "Sq.m",
    rooms.bathrooms * 3 * floors,
    "floor_bath_tiles",
    "tiles"
  );
  addItem(
    "G",
    "11.36",
    "Glazed ceramic wall tiles dado in bathrooms up to 2.1m height as per IS 15622.",
    "Sq.m",
    bathroomDadoArea * floors,
    "floor_bath_dado",
    "tiles"
  );
  addItem(
    "G",
    "11.37.3",
    "Ceramic tile dado in kitchen above platform to 600mm height as per IS 15622.",
    "Sq.m",
    1 * 3 * 0.6 * floors,
    "floor_kitchen_dado",
    "tiles"
  );
  addItem(
    "G",
    "11.62",
    "Granite thresholds at door openings with machine-cut edges as per IS 3316.",
    "R.m",
    rooms.doors,
    "floor_threshold",
    "tiles"
  );

  // Schedule H
  addItem(
    "H",
    "9.1.1",
    "Main entrance teak wood door frame and shutter with fittings as per IS 1003.",
    "No.",
    1,
    "dw_main_door"
  );
  addItem(
    "H",
    "9.122.1",
    "Flush doors internal with hardwood frame and SS fittings as per IS 2202.",
    "No.",
    Math.max(rooms.doors - rooms.bathrooms - 1, 0),
    "dw_internal_door"
  );
  addItem(
    "H",
    "9.147",
    "PVC bathroom door shutters complete with fixtures as per IS 4020.",
    "No.",
    rooms.bathrooms,
    "dw_bath_door"
  );
  addItem(
    "H",
    "10.28",
    "Aluminium sliding windows with 5mm glass and hardware as per IS 1948.",
    "No.",
    rooms.windows,
    "dw_windows"
  );
  addItem(
    "H",
    "10.31",
    "Aluminium ventilators with louvers and mosquito mesh complete as per IS 1948.",
    "No.",
    rooms.bathrooms,
    "dw_ventilator"
  );
  addItem(
    "H",
    "10.28A",
    "MS grill for windows including primer and paint complete as per IS 808.",
    "Sq.ft",
    rooms.windows * 1.2 * 1.2 * 10.764,
    "dw_grills",
    "steel"
  );

  // Schedule I
  const cpvcLength = rooms.bathrooms * 15 + 10;
  const drainLength = rooms.bathrooms * 10 + 8;
  addItem(
    "I",
    "18.13.1",
    "CPVC water supply piping complete with fittings and clamps as per IS 15778.",
    "R.m",
    cpvcLength,
    "plumb_cpvc"
  );
  addItem(
    "I",
    "18.10.1",
    "PVC drainage and SWR pipes with specials and solvent joints as per IS 13592.",
    "R.m",
    drainLength,
    "plumb_drain"
  );
  addItem(
    "I",
    "17.2.1",
    "EWC with low-level cistern and seat cover complete with connections as per IS 2556.",
    "No.",
    rooms.bathrooms,
    "plumb_ewc"
  );
  addItem("I", "17.7", "Wall hung wash basin with CP waste coupling as per IS 2556.", "No.", rooms.bathrooms, "plumb_basin");
  addItem("I", "17.12", "Stainless steel kitchen sink with waste pipe and fittings as per IS 13983.", "No.", 1, "plumb_sink");
  addItem(
    "I",
    "17.50",
    "CP fittings complete set for baths and kitchen including shower mixer as per IS 8931.",
    "L.S.",
    1,
    "plumb_cp_fittings"
  );
  addItem("I", "18.48", "1000L rotational moulded overhead water tank complete with base and fittings.", "No.", 1, "plumb_tank");
  addItem("I", "18.30", "Septic tank with soak pit including excavation and brick masonry as per IS 2470.", "No.", 1, "plumb_septic");

  // Schedule J
  const lightPoints = rooms.bedrooms * 2 + rooms.bathrooms + rooms.kitchen * 2 + rooms.living * 3 + rooms.dining * 2 + 4;
  const fanPoints = rooms.bedrooms + rooms.living + rooms.dining;
  const powerPoints = rooms.bedrooms * 3 + rooms.kitchen * 4 + rooms.living * 3 + rooms.bathrooms;
  const heavyPoints = rooms.bedrooms + rooms.kitchen;
  addItem(
    "J",
    "1.13.1",
    "Light point wiring with FRLS copper wire in concealed conduit including modular switch as per IS 694.",
    "Point",
    lightPoints,
    "elec_light"
  );
  addItem(
    "J",
    "1.13.2",
    "Fan point wiring with regulator point complete in concealed conduit as per IS 732.",
    "Point",
    fanPoints,
    "elec_fan"
  );
  addItem("J", "1.13.3", "Power socket wiring with 6/16A outlets complete as per IS 1293.", "Point", powerPoints, "elec_socket");
  addItem(
    "J",
    "1.13.4",
    "Heavy-duty point for AC/geyser with dedicated MCB and cable as per IS 694.",
    "Point",
    heavyPoints,
    "elec_heavy"
  );
  addItem("J", "1.15", "MCB distribution board complete with busbar and earthing as per IS/IEC 61439.", "No.", 1, "elec_mcb");
  addItem("J", "1.18", "Earthing set with GI pipe electrode and chamber as per IS 3043.", "Set", 2, "elec_earthing");
  addItem("J", "1.41", "LED luminaire supply and installation complete as per IS 10322.", "No.", lightPoints, "elec_led");
  addItem("J", "1.42", "Ceiling fans supply and fixing with down-rod complete as per IS 374.", "No.", fanPoints, "elec_ceiling_fan");

  // Schedule K
  const enamelArea = rooms.doors * 2.1 * 1.0 * 2 + rooms.windows * 1.2 * 1.2 * 2;
  addItem(
    "K",
    "13.43.2",
    "Exterior weatherproof acrylic paint two coats over primer as per IS 15489.",
    "Sq.m",
    externalPlasterArea,
    "paint_external"
  );
  addItem(
    "K",
    "13.60.1",
    "Interior acrylic emulsion paint on puttied surface complete as per IS 15489.",
    "Sq.m",
    internalPlasterArea,
    "paint_internal"
  );
  addItem(
    "K",
    "13.71.1",
    "Synthetic enamel paint on wood and steel two coats over primer as per IS 2932.",
    "Sq.m",
    enamelArea,
    "paint_enamel"
  );
  addItem("K", "13.70", "Wood primer coat on joinery surfaces complete as per IS 3536.", "Sq.m", enamelArea, "paint_primer");

  // Schedule L (contingency inserted later)
  addItem(
    "L",
    "16.1",
    "Compound wall with brick masonry and RCC coping including foundation as per IS 456.",
    "R.m",
    perimeterM,
    "misc_compound_wall"
  );
  addItem("L", "10.5", "MS main gate with primer and enamel paint complete as per IS 2062.", "No.", 1, "misc_main_gate");
  addItem("L", "18.48A", "Water tank stand in RCC with ladder and platform complete as per IS 456.", "No.", 1, "misc_tank_stand");
  addItem(
    "L",
    "11.12",
    "Building apron in PCC around perimeter with slope and joints complete as per IS 456.",
    "Sq.m",
    perimeterM * 0.6,
    "misc_apron"
  );

  const interimTotal = items.reduce((sum, item) => sum + item.amount, 0);
  addItem(
    "L",
    "99.01",
    "Contingencies and unforeseen works @ 3% of estimated construction cost.",
    "L.S.",
    1,
    "misc_contingency"
  );
  items[items.length - 1].rate = round2(interimTotal * 0.03);
  items[items.length - 1].amount = round2(interimTotal * 0.03);

  const scheduleTotals = SCHEDULES.map((schedule) => {
    const amount = items
      .filter((item) => item.scheduleId === schedule.id)
      .reduce((sum, item) => sum + item.amount, 0);
    return { scheduleId: schedule.id, scheduleName: schedule.name, amount: round2(amount) };
  });

  const schedulesTotal = scheduleTotals.reduce((sum, s) => sum + s.amount, 0);
  const contractorProfit = round2(schedulesTotal * 0.15);
  const gst = round2((schedulesTotal + contractorProfit) * 0.18);
  const grandTotal = Math.round(schedulesTotal + contractorProfit + gst);
  const costPerSqft = builtUpAreaSqft > 0 ? round2(grandTotal / builtUpAreaSqft) : 0;

  const totalConcreteVolume = pccQty + rccFootingQty + plinthBeamQty + roofSlabQty + lintelQty;
  const totalBrickVolume = Math.max(extWallQty, 0) + intWallQty;
  const totalPlasterArea = internalPlasterArea + externalPlasterArea;
  const plumbingPipesRm = cpvcLength + drainLength;
  const electricalPoints = lightPoints + fanPoints + powerPoints + heavyPoints;

  const tileBedAreaSqm =
    Math.max(mainFloorArea, 0) +
    rooms.bathrooms * 3 * floors +
    bathroomDadoArea * floors +
    1 * 3 * 0.6 * floors;
  const totalCementBags = round2(
    totalConcreteVolume * 8.5 +
      totalPlasterArea * 0.1 +
      totalBrickVolume * 1.1 +
      tileBedAreaSqm * 0.11
  );

  return {
    input: { ...input, floors, widthFt, lengthFt },
    project: {
      plotAreaSqft: round2(plotAreaSqft),
      plotAreaSqm: round2(plotAreaSqm),
      builtUpAreaSqft: round2(builtUpAreaSqft),
      builtUpAreaSqm: round2(builtUpAreaSqm),
      perimeterM: round2(perimeterM),
      wallHeightM,
      floors,
      roomCounts: rooms
    },
    items,
    scheduleTotals,
    totals: {
      schedulesTotal: round2(schedulesTotal),
      contractorProfit,
      gst,
      grandTotal,
      costPerSqft
    },
    metrics: {
      totalConcreteVolume: round2(totalConcreteVolume),
      totalBrickVolume: round2(totalBrickVolume),
      totalPlasterArea: round2(totalPlasterArea),
      internalPlasterArea: round2(internalPlasterArea),
      externalPlasterArea: round2(externalPlasterArea),
      flooringMainArea: round2(Math.max(mainFloorArea, 0)),
      flooringDadoArea: round2(bathroomDadoArea * floors + 1 * 3 * 0.6 * floors),
      steelKg: round2(steelTotalKg),
      totalCementBags,
      plumbingPipesRm: round2(plumbingPipesRm),
      electricalPoints: round2(electricalPoints)
    }
  };
}
