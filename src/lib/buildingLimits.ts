// ============================================================
// src/lib/buildingLimits.ts
// Tables 504.3, 504.4, 506.2 — 2024 IBC
// ============================================================

export type ConstructionType =
  | "IA" | "IB"
  | "IIA" | "IIB"
  | "IIIA" | "IIIB"
  | "IVA" | "IVB" | "IVC" | "IVHT"
  | "VA" | "VB";

export type SprinklerTag = "NS" | "S1" | "SM" | "S13R" | "S13D";

export type OccupancyKey =
  | "A-1" | "A-2" | "A-3" | "A-4" | "A-5"
  | "B" 
  | "E"
  | "F-1" | "F-2"
  | "H-1" | "H-2" | "H-3" | "H-4" | "H-5"
  | "I-1" | "I-2" | "I-3" | "I-4"
  | "M"
  | "R-1" | "R-2" | "R-3" | "R-4"
  | "S-1" | "S-2"
  | "U";

// ── Mapping helpers ──────────────────────────────────────────

/** "Type I-A" → "IA", "Type IV-HT" → "IVHT" */
export function mapConstructionType(raw: string): ConstructionType | null {
  const map: Record<string, ConstructionType> = {
    "Type I-A":   "IA",
    "Type I-B":   "IB",
    "Type II-A":  "IIA",
    "Type II-B":  "IIB",
    "Type III-A": "IIIA",
    "Type III-B": "IIIB",
    "Type IV-A":  "IVA",
    "Type IV-B":  "IVB",
    "Type IV-C":  "IVC",
    "Type IV-HT": "IVHT",
    "Type V-A":   "VA",
    "Type V-B":   "VB",
  };
  return map[raw] ?? null;
}

/**
 * Maps sprinkler dropdown + stories above grade to SprinklerTag.
 * "None" and "Partial" → NS (conservative).
 * "NFPA 13" → S1 if storiesAbove <= 1, else SM.
 */
export function mapSprinklerTag(raw: string, storiesAbove: number): SprinklerTag {
  if (raw === "NFPA 13R") return "S13R";
  if (raw === "NFPA 13D") return "S13D";
  if (raw === "NFPA 13") return storiesAbove <= 1 ? "S1" : "SM";
  return "NS"; // "None" or "Partial"
}

/** "Group A-3" → "A-3", "Group B" → "B" */
export function mapOccupancyKey(raw: string): OccupancyKey | null {
  const stripped = raw.replace(/^Group\s+/, "").trim();
  const valid: OccupancyKey[] = [
    "A-1","A-2","A-3","A-4","A-5","B","E",
    "F-1","F-2","H-1","H-2","H-3","H-4","H-5",
    "I-1","I-2","I-3","I-4","M",
    "R-1","R-2","R-3","R-4","S-1","S-2","U",
  ];
  return valid.includes(stripped as OccupancyKey) ? (stripped as OccupancyKey) : null;
}

// ── Column order ─────────────────────────────────────────────
// IA IB IIA IIB IIIA IIIB IVA IVB IVC IVHT VA VB
type Row12 = [
  number|"UL"|"NP", number|"UL"|"NP",  // Type I  A B
  number|"UL"|"NP", number|"UL"|"NP",  // Type II A B
  number|"UL"|"NP", number|"UL"|"NP",  // Type III A B
  number|"UL"|"NP", number|"UL"|"NP",  // Type IV A B
  number|"UL"|"NP", number|"UL"|"NP",  // Type IV C HT
  number|"UL"|"NP", number|"UL"|"NP",  // Type V A B
];

const COLS: ConstructionType[] = [
  "IA","IB","IIA","IIB","IIIA","IIIB","IVA","IVB","IVC","IVHT","VA","VB"
];

function rowToMap(row: Row12): Record<ConstructionType, number|"UL"|"NP"> {
  const out = {} as Record<ConstructionType, number|"UL"|"NP">;
  COLS.forEach((c, i) => { out[c] = row[i]; });
  return out;
}

// ── TABLE 504.3 — Max height in FEET ─────────────────────────
// Keyed by OccupancyKey → SprinklerTag → ConstructionType → value

type HeightTable = Partial<Record<OccupancyKey,
  Partial<Record<SprinklerTag, Record<ConstructionType, number|"UL"|"NP">>>>>;

export const table504_3: HeightTable = (() => {
  const UL = "UL" as const;
  const NP = "NP" as const;

  // Helper: all occupancies that share the same A,B,E,F,M,S,U row
  const ABEFMSU_NS: Row12 = [UL,160, 65,55, 65,55, 65,65,65,65, 50,40];
  const ABEFMSU_S:  Row12 = [UL,180, 85,75, 85,75, 270,180,85,85, 70,60];

  const H135_NS: Row12 = [UL,160, 65,55, 65,55, 120,90,65,65, 50,40];
  // H-1,H-2,H-3,H-5 share same S row as NS (sprinkler required, no height increase)
  const H135_S:  Row12 = [UL,160, 65,55, 65,55, 120,90,65,65, 50,40];

  const H4_NS: Row12 = [UL,160, 65,55, 65,55, 65,65,65,65, 50,40];
  const H4_S:  Row12 = [UL,180, 85,75, 85,75, 140,100,85,85, 70,60];

  // I-1 Condition 1 and I-3: no IIB restriction
  const I1cond1_NS: Row12 = [UL,160, 65,55, 65,55, 65,65,65,65, 50,40];
  const I1cond1_S:  Row12 = [UL,180, 85,75, 85,75, 180,120,85,85, 70,60];

  // I-1 Condition 2 and I-2: IIB = NP (more restrictive)
  // I-1 uses the more restrictive Condition 2 row (conservative)
  const I1cond2_NS: Row12 = [UL,160, 65,NP, 65,55, 65,65,65,65, 50,40];
  const I1cond2_S:  Row12 = [UL,180, 85,NP, 85,75, 65,65,65,65, 50,40];

  const I4_NS: Row12 = [UL,160, 65,55, 65,55, 65,65,65,65, 50,40];
  const I4_S:  Row12 = [UL,180, 85,75, 85,75, 180,120,85,85, 70,60];

  const R_NS:   Row12 = [UL,160, 65,55, 65,55, 65,65,65,65, 50,40];
  const R_S13D: Row12 = [60,60,   60,60, 60,60, 60,60,60,60, 50,40];
  const R_S13R: Row12 = [60,60,   60,60, 60,60, 60,60,60,60, 60,60];
  const R_S:    Row12 = [UL,180,  85,75, 85,75, 270,180,85,85, 70,60];

  const build = (rows: Partial<Record<SprinklerTag, Row12>>) =>
    Object.fromEntries(
      Object.entries(rows).map(([k, v]) => [k, rowToMap(v as Row12)])
    ) as Partial<Record<SprinklerTag, Record<ConstructionType, number|"UL"|"NP">>>;

  const standard = build({ NS: ABEFMSU_NS, S1: ABEFMSU_S, SM: ABEFMSU_S });

  return {
    "A-1": standard,
    "A-2": standard,
    "A-3": standard,
    "A-4": standard,
    "A-5": standard,
    "B":   standard,
    "E":   standard,
    "F-1": standard,
    "F-2": standard,
    "M":   standard,
    "S-1": standard,
    "S-2": standard,
    "U":   standard,
    "H-1": build({ NS: H135_NS, S1: H135_S, SM: H135_S }),
    "H-2": build({ NS: H135_NS, S1: H135_S, SM: H135_S }),
    "H-3": build({ NS: H135_NS, S1: H135_S, SM: H135_S }),
    "H-5": build({ NS: H135_NS, S1: H135_S, SM: H135_S }),
    "H-4": build({ NS: H4_NS,   S1: H4_S,   SM: H4_S   }),
    // I-1 uses Condition 2 (more restrictive) — conservative approach
    "I-1": build({ NS: I1cond2_NS, S1: I1cond2_S, SM: I1cond2_S }),
    "I-2": build({ NS: I1cond2_NS, S1: I1cond2_S, SM: I1cond2_S }),
    "I-3": build({ NS: I1cond1_NS, S1: I1cond1_S, SM: I1cond1_S }),
    "I-4": build({ NS: I4_NS,      S1: I4_S,      SM: I4_S      }),
    "R-1": build({ NS: R_NS, S1: R_S, SM: R_S, S13R: R_S13R, S13D: R_S13D }),
    "R-2": build({ NS: R_NS, S1: R_S, SM: R_S, S13R: R_S13R, S13D: R_S13D }),
    "R-3": build({ NS: R_NS, S1: R_S, SM: R_S, S13R: R_S13R, S13D: R_S13D }),
    "R-4": build({ NS: R_NS, S1: R_S, SM: R_S, S13R: R_S13R, S13D: R_S13D }),
  };
})();

// ── TABLE 504.4 — Max STORIES above grade ────────────────────

type StoriesTable = Partial<Record<OccupancyKey,
  Partial<Record<SprinklerTag, Record<ConstructionType, number|"UL"|"NP">>>>>;

export const table504_4: StoriesTable = (() => {
  const UL = "UL" as const;
  const NP = "NP" as const;

  const r = rowToMap;

  return {
    "A-1": {
      NS: r([UL,5, 3,2, 3,2, 3,3,3,3, 2,1]),
      S1: r([UL,6, 4,3, 4,3, 9,6,4,4, 3,2]),
      SM: r([UL,6, 4,3, 4,3, 9,6,4,4, 3,2]),
    },
    "A-2": {
      NS: r([UL,11, 3,2, 3,2, 3,3,3,3, 2,1]),
      S1: r([UL,12, 4,3, 4,3, 18,12,6,4, 3,2]),
      SM: r([UL,12, 4,3, 4,3, 18,12,6,4, 3,2]),
    },
    "A-3": {
      NS: r([UL,11, 3,2, 3,2, 3,3,3,3, 2,1]),
      S1: r([UL,12, 4,3, 4,3, 18,12,6,4, 3,2]),
      SM: r([UL,12, 4,3, 4,3, 18,12,6,4, 3,2]),
    },
    "A-4": {
      NS: r([UL,11, 3,2, 3,2, 3,3,3,3, 2,1]),
      S1: r([UL,12, 4,3, 4,3, 18,12,6,4, 3,2]),
      SM: r([UL,12, 4,3, 4,3, 18,12,6,4, 3,2]),
    },
    "A-5": {
      NS: r([UL,UL, UL,UL, UL,UL, 1,1,1,1, UL,UL]),
      S1: r([UL,UL, UL,UL, UL,UL, UL,UL,UL,UL, UL,UL]),
      SM: r([UL,UL, UL,UL, UL,UL, UL,UL,UL,UL, UL,UL]),
    },
    "B": {
      NS: r([UL,11, 5,3, 5,3, 5,5,5,5, 3,2]),
      S1: r([UL,12, 6,4, 6,4, 18,12,9,6, 4,3]),
      SM: r([UL,12, 6,4, 6,4, 18,12,9,6, 4,3]),
    },
    "E": {
      NS: r([UL,5, 3,2, 3,2, 3,3,3,3, 1,1]),
      S1: r([UL,6, 4,3, 4,3, 9,6,4,4, 2,2]),
      SM: r([UL,6, 4,3, 4,3, 9,6,4,4, 2,2]),
    },
    "F-1": {
      NS: r([UL,11, 4,2, 3,2, 3,3,3,3, 2,1]),
      S1: r([UL,12, 5,3, 4,3, 10,7,5,5, 3,2]),
      SM: r([UL,12, 5,3, 4,3, 10,7,5,5, 3,2]),
    },
    "F-2": {
      NS: r([UL,11, 5,3, 4,3, 5,5,5,5, 3,2]),
      S1: r([UL,12, 6,4, 5,4, 12,8,6,6, 4,3]),
      SM: r([UL,12, 6,4, 5,4, 12,8,6,6, 4,3]),
    },
    "H-1": {
      NS: r([1,1, 1,1, 1,1, NP,NP,NP,1, 1,NP]),
      S1: r([1,1, 1,1, 1,1, NP,NP,NP,1, 1,NP]),
      SM: r([1,1, 1,1, 1,1, NP,NP,NP,1, 1,NP]),
    },
    "H-2": {
      NS: r([UL,3, 2,1, 2,1, 1,1,1,1, 2,1]),  // note: Type IV-A,B,C from table
      S1: r([UL,3, 2,1, 2,1, 2,2,2,2, 2,1]),
      SM: r([UL,3, 2,1, 2,1, 2,2,2,2, 2,1]),
    },
    "H-3": {
      NS: r([UL,6, 4,2, 4,2, 3,3,3,3, 4,2]),
      S1: r([UL,6, 4,2, 4,2, 4,4,4,4, 4,2]),
      SM: r([UL,6, 4,2, 4,2, 4,4,4,4, 4,2]),
    },
    "H-4": {
      NS: r([UL,7, 5,3, 5,3, 5,5,5,5, 3,2]),
      S1: r([UL,8, 6,4, 6,4, 8,7,6,6, 4,3]),
      SM: r([UL,8, 6,4, 6,4, 8,7,6,6, 4,3]),
    },
    "H-5": {
      NS: r([4,4, 3,3, 3,3, 2,2,2,2, 3,3]),
      S1: r([4,4, 3,3, 3,3, 3,3,3,3, 3,3]),
      SM: r([4,4, 3,3, 3,3, 3,3,3,3, 3,3]),
    },
    // I-1 Condition 1 and I-3 share same story limits
    "I-1": {
      // Conservative: use Condition 2 limits (more restrictive, IIB=NP)
      NS: r([UL,9, 4,NP, 3,NP, 3,3,3,3, 3,2]),
      S1: r([UL,10, 5,NP, 4,NP, 10,6,4,4, 4,3]),
      SM: r([UL,10, 5,NP, 4,NP, 10,6,4,4, 4,3]),
    },
    "I-2": {
      NS: r([UL,4, 2,NP, 1,NP, NP,NP,NP,1, 1,NP]),
      S1: r([UL,5, 3,NP, 1,NP, 7,5,1,1, 1,NP]),
      SM: r([UL,5, 3,NP, 1,NP, 7,5,1,1, 1,NP]),
    },
    "I-3": {
      NS: r([UL,4, 2,1, 2,1, 2,2,2,2, 2,1]),
      S1: r([UL,5, 3,2, 3,2, 7,5,3,3, 3,2]),
      SM: r([UL,5, 3,2, 3,2, 7,5,3,3, 3,2]),
    },
    "I-4": {
      NS: r([UL,5, 3,2, 3,2, 3,3,3,3, 1,1]),
      S1: r([UL,6, 4,3, 4,3, 9,6,4,4, 2,2]),
      SM: r([UL,6, 4,3, 4,3, 9,6,4,4, 2,2]),
    },
    "M": {
      NS: r([UL,11, 4,2, 4,2, 4,4,4,4, 3,1]),
      S1: r([UL,12, 5,3, 5,3, 12,8,6,6, 4,2]),
      SM: r([UL,12, 5,3, 5,3, 12,8,6,6, 4,2]),
    },
    "R-1": {
      NS:   r([UL,11, 4,4, 4,4, 4,4,4,4, 3,2]),  // footnote d: NS value for existing only
      S13R: r([4,4,   4,4, 4,4, 4,4,4,4, 4,3]),
      S1:   r([UL,12, 5,5, 5,5, 18,12,8,5, 4,3]),
      SM:   r([UL,12, 5,5, 5,5, 18,12,8,5, 4,3]),
    },
    "R-2": {
      NS:   r([UL,11, 4,4, 4,4, 4,4,4,4, 3,2]),
      S13R: r([4,4,   4,4, 4,4, 4,4,4,4, 4,3]),
      S1:   r([UL,12, 5,5, 5,5, 18,12,8,5, 4,3]),
      SM:   r([UL,12, 5,5, 5,5, 18,12,8,5, 4,3]),
    },
    "R-3": {
      NS:   r([UL,11, 4,4, 4,4, 4,4,4,4, 3,3]),
      S13D: r([4,4,   4,4, 4,4, 4,4,4,4, 3,3]),
      S13R: r([4,4,   4,4, 4,4, 4,4,4,4, 4,4]),
      S1:   r([UL,12, 5,5, 5,5, 18,12,5,5, 4,4]),
      SM:   r([UL,12, 5,5, 5,5, 18,12,5,5, 4,4]),
    },
    "R-4": {
      NS:   r([UL,11, 4,4, 4,4, 4,4,4,4, 3,2]),
      S13D: r([4,4,   4,4, 4,4, 4,4,4,4, 3,2]),
      S13R: r([4,4,   4,4, 4,4, 4,4,4,4, 4,3]),
      S1:   r([UL,12, 5,5, 5,5, 18,12,8,5, 4,3]),
      SM:   r([UL,12, 5,5, 5,5, 18,12,8,5, 4,3]),
    },
    "S-1": {
      NS: r([UL,11, 4,2, 3,2, 4,4,4,4, 3,1]),
      S1: r([UL,12, 5,3, 4,3, 10,7,5,5, 3,2]),
      SM: r([UL,12, 5,3, 4,3, 10,7,5,5, 3,2]),
    },
    "S-2": {
      NS: r([UL,11, 5,3, 4,3, 4,4,5,4, 4,2]),
      S1: r([UL,12, 6,4, 5,4, 12,8,5,6, 5,3]),
      SM: r([UL,12, 6,4, 5,4, 12,8,5,6, 5,3]),
    },
    "U": {
      NS: r([UL,5, 4,2, 3,2, 4,4,4,4, 2,1]),
      S1: r([UL,6, 5,3, 4,3, 9,6,5,5, 3,2]),
      SM: r([UL,6, 5,3, 4,3, 9,6,5,5, 3,2]),
    },
  };
})();

// ── TABLE 506.2 — Allowable Area Factor (sq ft) ──────────────
// UL = unlimited

type AreaTable = Partial<Record<OccupancyKey,
  Partial<Record<SprinklerTag, Record<ConstructionType, number|"UL"|"NP">>>>>;

export const table506_2: AreaTable = (() => {
  const UL = "UL" as const;
  const NP = "NP" as const;
  const r = rowToMap;

  return {
    "A-1": {
      NS: r([UL,UL, 15000,8500, 14000,8500, 15000,8500,18750,15000, 11500,5500]),
      S1: r([UL,UL, 62000,34000, 56000,34000, 180000,120000,75000,60000, 46000,22000]),
      SM: r([UL,UL, 46500,25500, 42000,25500, 135000,90000,56250,45000, 34500,16500]),
    },
    "A-2": {
      NS: r([UL,UL, 15000,9500, 14000,9500, 15000,9500,18750,15000, 11500,6000]),
      S1: r([UL,UL, 62000,38000, 56000,38000, 180000,120000,75000,60000, 46000,24000]),
      SM: r([UL,UL, 46500,28500, 42000,28500, 135000,90000,56250,45000, 34500,18000]),
    },
    "A-3": {
      NS: r([UL,UL, 15000,9500, 14000,9500, 15000,9500,18750,15000, 11500,6000]),
      S1: r([UL,UL, 62000,38000, 56000,38000, 180000,120000,75000,60000, 46000,24000]),
      SM: r([UL,UL, 46500,28500, 42000,28500, 135000,90000,56250,45000, 34500,18000]),
    },
    "A-4": {
      NS: r([UL,UL, 15000,9500, 14000,9500, 15000,9500,18750,15000, 11500,6000]),
      S1: r([UL,UL, 62000,38000, 56000,38000, 180000,120000,75000,60000, 46000,24000]),
      SM: r([UL,UL, 46500,28500, 42000,28500, 135000,90000,56250,45000, 34500,18000]),
    },
    "A-5": {
      NS: r([UL,UL, UL,UL, UL,UL, UL,UL,UL,UL, UL,UL]),
      S1: r([UL,UL, UL,UL, UL,UL, UL,UL,UL,UL, UL,UL]),
      SM: r([UL,UL, UL,UL, UL,UL, UL,UL,UL,UL, UL,UL]),
    },
    "B": {
      NS: r([UL,UL, 37500,23000, 28500,19000, 108000,72000,45000,36000, 18000,9000]),
      S1: r([UL,UL, 150000,92000, 114000,76000, 432000,288000,180000,144000, 72000,36000]),
      SM: r([UL,UL, 112500,69000, 85500,57000, 324000,216000,135000,108000, 54000,27000]),
    },
    "E": {
      NS: r([UL,UL, 26500,14500, 23500,14500, 76500,51000,31875,25500, 18500,9500]),
      S1: r([UL,UL, 106000,58000, 94000,58000, 306000,204000,127500,102000, 74000,38000]),
      SM: r([UL,UL, 79500,43500, 70500,43500, 229500,153000,95625,76500, 55500,28500]),
    },
    "F-1": {
      NS: r([UL,UL, 25000,15500, 19000,12000, 100500,67000,41875,33500, 14000,8500]),
      S1: r([UL,UL, 100000,62000, 76000,48000, 402000,268000,167500,134000, 56000,34000]),
      SM: r([UL,UL, 75000,46500, 57000,36000, 301500,201000,125625,100500, 42000,25500]),
    },
    "F-2": {
      NS: r([UL,UL, 37500,23000, 28500,18000, 151500,101000,63125,50500, 21000,13000]),
      S1: r([UL,UL, 150000,92000, 114000,72000, 606000,404000,252500,202000, 84000,52000]),
      SM: r([UL,UL, 112500,69000, 85500,54000, 454500,303000,189375,151500, 63000,39000]),
    },
    "H-1": {
      NS: r([21000,16500, 11000,7000, 9500,7000, 10500,10500,10500,10500, 7500,NP]),
      S1: r([21000,16500, 11000,7000, 9500,7000, 10500,10500,10500,10500, 7500,NP]),
      SM: r([21000,16500, 11000,7000, 9500,7000, 10500,10500,10500,10500, 7500,NP]),
    },
    "H-2": {
      NS: r([21000,16500, 11000,7000, 9500,7000, 10500,10500,10500,10500, 7500,3000]),
      S1: r([21000,16500, 11000,7000, 9500,7000, 10500,10500,10500,10500, 7500,3000]),
      SM: r([21000,16500, 11000,7000, 9500,7000, 10500,10500,10500,10500, 7500,3000]),
    },
    "H-3": {
      NS: r([UL,UL, 60000,26500, 14000,17500, 13000,25500,25500,25500, 10000,5000]),
      S1: r([UL,UL, 60000,26500, 14000,17500, 13000,25500,25500,25500, 10000,5000]),
      SM: r([UL,UL, 60000,26500, 14000,17500, 13000,25500,25500,25500, 10000,5000]),
    },
    "H-4": {
      NS: r([UL,UL, 37500,17500, 28500,17500, 72000,54000,40500,36000, 18000,6500]),
      S1: r([UL,UL, 150000,70000, 114000,70000, 288000,216000,162000,144000, 72000,26000]),
      SM: r([UL,UL, 112500,52500, 85500,52500, 216000,162000,121500,108000, 54000,19500]),
    },
    "H-5": {
      NS: r([UL,UL, 37500,17500, 28500,17500, 72000,54000,40500,36000, 18000,9000]),
      S1: r([UL,UL, 150000,92000, 114000,76000, 288000,216000,162000,144000, 72000,36000]),
      SM: r([UL,UL, 112500,69000, 85500,57000, 216000,162000,121500,108000, 54000,27000]),
    },
    "I-1": {
      NS: r([UL,UL, 55000,19000, 10000,16500, 10000,54000,36000,18000, 18000,10500]),
      S1: r([UL,UL, 220000,76000, 40000,66000, 40000,216000,144000,72000, 72000,42000]),
      SM: r([UL,UL, 165000,57000, 30000,49500, 30000,162000,108000,54000, 54000,31500]),
    },
    "I-2": {
      NS: r([UL,UL, 15000,11000, 12000,NP, 36000,24000,12000,12000, 9500,NP]),
      S1: r([UL,UL, 60000,44000, 48000,NP, 144000,96000,48000,48000, 38000,NP]),
      SM: r([UL,UL, 45000,33000, 36000,NP, 108000,72000,36000,36000, 28500,NP]),
    },
    "I-3": {
      NS: r([UL,UL, 15000,10500, 10500,7500, 36000,24000,12000,12000, 7500,5000]),
      S1: r([UL,UL, 60000,40000, 42000,30000, 144000,96000,48000,48000, 30000,20000]),
      SM: r([UL,UL, 45000,30000, 31500,22500, 108000,72000,36000,36000, 22500,15000]),
    },
    "I-4": {
      NS: r([UL,UL, 60500,26500, 13000,23500, 13000,76500,51000,25500, 25500,18500]),
      S1: r([UL,UL, 121000,106000, 52000,94000, 52000,306000,204000,102000, 102000,74000]),
      SM: r([UL,UL, 181500,79500, 39000,70500, 39000,229500,153000,76500, 76500,55500]),
    },
    "M": {
      NS: r([UL,UL, 21500,12500, 18500,12500, 61500,41000,26625,20500, 14000,9000]),
      S1: r([UL,UL, 86000,50000, 74000,50000, 246000,164000,102500,82000, 56000,36000]),
      SM: r([UL,UL, 64500,37500, 55500,37500, 184500,123000,76875,61500, 42000,27000]),
    },
    "R-1": {
      NS:   r([UL,UL, 24000,16000, 24000,16000, 61500,41000,25625,20500, 12000,7000]),
      S13R: r([UL,UL, 24000,16000, 24000,16000, 61500,41000,25625,20500, 12000,7000]),
      S1:   r([UL,UL, 96000,64000, 96000,64000, 246000,164000,102500,82000, 48000,28000]),
      SM:   r([UL,UL, 72000,48000, 72000,48000, 184500,123000,76875,61500, 36000,21000]),
    },
    "R-2": {
      NS:   r([UL,UL, 24000,16000, 24000,16000, 61500,41000,25625,20500, 12000,7000]),
      S13R: r([UL,UL, 24000,16000, 24000,16000, 61500,41000,25625,20500, 12000,7000]),
      S1:   r([UL,UL, 96000,64000, 96000,64000, 246000,164000,102500,82000, 48000,28000]),
      SM:   r([UL,UL, 72000,48000, 72000,48000, 184500,123000,76875,61500, 36000,21000]),
    },
    "R-3": {
      NS:   r([UL,UL, UL,UL, UL,UL, UL,UL,UL,UL, UL,UL]),
      S13D: r([UL,UL, UL,UL, UL,UL, UL,UL,UL,UL, UL,UL]),
      S13R: r([UL,UL, UL,UL, UL,UL, UL,UL,UL,UL, UL,UL]),
      S1:   r([UL,UL, UL,UL, UL,UL, UL,UL,UL,UL, UL,UL]),
      SM:   r([UL,UL, UL,UL, UL,UL, UL,UL,UL,UL, UL,UL]),
    },
    "R-4": {
      NS:   r([UL,UL, 24000,16000, 24000,16000, 61500,41000,25625,20500, 12000,7000]),
      S13D: r([UL,UL, 24000,16000, 24000,16000, 61500,41000,25625,20500, 12000,7000]),
      S13R: r([UL,UL, 24000,16000, 24000,16000, 61500,41000,25625,20500, 12000,7000]),
      S1:   r([UL,UL, 96000,64000, 96000,64000, 246000,164000,102500,82000, 48000,28000]),
      SM:   r([UL,UL, 72000,48000, 72000,48000, 184500,123000,76875,61500, 36000,21000]),
    },
    "S-1": {
      NS: r([UL,UL, 48000,26000, 17500,26000, 17500,76500,31875,31500, 25500,14000]),
      S1: r([UL,UL, 192000,104000, 70000,104000, 70000,306000,127500,127500, 102000,56000]),
      SM: r([UL,UL, 144000,78000, 52500,78000, 52500,229500,95625,95625, 76500,42000]),
    },
    "S-2": {
      NS: r([UL,UL, 79000,39000, 26000,39000, 26000,115500,77000,48125, 38500,21000]),
      S1: r([UL,UL, 316000,156000, 104000,156000, 104000,462000,308000,192500, 154000,84000]),
      SM: r([UL,UL, 237000,117000, 78000,117000, 78000,346500,231000,144375, 115500,63000]),
    },
    "U": {
      NS: r([UL,UL, 35000,19000, 14000,8500, 8500,54000,36000,22500, 9000,5500]),
      S1: r([UL,UL, 142000,76000, 56000,34000, 34000,216000,144000,90000, 72000,36000]),
      SM: r([UL,UL, 106500,57000, 42000,25500, 25500,162000,108000,67500, 54000,27000]),
    },
  };
})();

// ── Lookup functions ─────────────────────────────────────────

function getBestSprinklerRow<T>(
  table: Partial<Record<OccupancyKey, Partial<Record<SprinklerTag, T>>>>,
  occ: OccupancyKey,
  spk: SprinklerTag
): T | null {
  const occRow = table[occ];
  if (!occRow) return null;

  // Try exact tag first
  if (occRow[spk] !== undefined) return occRow[spk]!;

  // S1 is NFPA 13 single-story — can use SM row if S1 not explicitly defined
  if (spk === "S1") return occRow["SM"] ?? occRow["NS"] ?? null;

  // S13R and S13D only have explicit table rows for R occupancies.
  // For all other occupancies the table does not grant a sprinkler increase
  // for these systems, so fall back to NS (conservative).
  if (spk === "S13R" || spk === "S13D") return occRow["NS"] ?? null;

  return occRow["NS"] ?? null;
}

export type LimitValue = number | "UL" | "NP" | null;

export function getMaxHeightFt(
  occ: OccupancyKey,
  construction: ConstructionType,
  sprinkler: SprinklerTag
): LimitValue {
  const row = getBestSprinklerRow(table504_3, occ, sprinkler);
  return row ? row[construction] : null;
}

export function getMaxStories(
  occ: OccupancyKey,
  construction: ConstructionType,
  sprinkler: SprinklerTag
): LimitValue {
  const row = getBestSprinklerRow(table504_4, occ, sprinkler);
  return row ? row[construction] : null;
}

export function getAreaFactor(
  occ: OccupancyKey,
  construction: ConstructionType,
  sprinkler: SprinklerTag
): LimitValue {
  const row = getBestSprinklerRow(table506_2, occ, sprinkler);
  return row ? row[construction] : null;
}

/**
 * For a mixed-occupancy building, returns the most restrictive
 * (lowest numeric) limit across all occupancies.
 * "NP" beats all numbers. "UL" is least restrictive.
 */
export function getMostRestrictiveLimit(values: LimitValue[]): LimitValue {
  if (values.some(v => v === "NP")) return "NP";
  const nums = values.filter((v): v is number => typeof v === "number");
  if (nums.length === 0) return values.some(v => v === "UL") ? "UL" : null;
  const min = Math.min(...nums);
  return min;
}

/**
 * Compares actual value to limit.
 * Returns "complies", "fails", or "unknown".
 */
export function checkCompliance(
  actual: number,
  limit: LimitValue
): "complies" | "fails" | "unknown" {
  if (limit === null) return "unknown";
  if (limit === "NP") return "fails";
  if (limit === "UL") return "complies";
  return actual <= limit ? "complies" : "fails";
}
