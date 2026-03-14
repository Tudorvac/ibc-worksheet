// Auto-generated from Chapter_3_-_checklist_data.xlsx
// A section is applicable if the building has AT LEAST ONE matching occupancy tag.
// Empty array = always applicable regardless of occupancy.

import type { ApplicabilityRule } from "@/lib/types"

export const ch3ApplicabilityRules: ApplicabilityRule[] = [
  // Always applicable
  { id: "301",   occupancies: [] },
  { id: "301.1", occupancies: [] },
  { id: "302",   occupancies: [] },
  { id: "302.1", occupancies: [] },
  { id: "302.2", occupancies: [] },
  { id: "303",   occupancies: [] },
  { id: "303.1", occupancies: [] },
  { id: "303.1.1", occupancies: [] },
  { id: "303.1.2", occupancies: [] },

  // 303 - Assembly Group A (A-1 through A-5, E)
  { id: "303.1.3",   occupancies: ["A-1","A-2","A-3","A-4","A-5","E"] },
  { id: "303.1.4",   occupancies: ["A-3","E"] },
  { id: "303.1.5",   occupancies: ["A-2","A-3","B"] },
  { id: "303.2",     occupancies: ["A-1"] },
  { id: "303.3",     occupancies: ["A-2"] },
  { id: "303.4",     occupancies: ["A-3"] },
  { id: "303.5",     occupancies: ["A-4"] },
  { id: "303.6",     occupancies: ["A-5"] },

  // 304 - Business Group B
  { id: "304",   occupancies: ["B"] },
  { id: "304.1", occupancies: ["B"] },
  { id: "304.2", occupancies: ["B"] },
  { id: "304.3", occupancies: ["B"] },
  { id: "304.4", occupancies: ["B"] },

  // 305 - Educational Group E
  { id: "305",     occupancies: ["A-3","E","R-3"] },
  { id: "305.1",   occupancies: ["A-3","E"] },
  { id: "305.1.1", occupancies: ["A-3","E"] },
  { id: "305.2",   occupancies: ["A-3","E","R-3"] },
  { id: "305.2.1", occupancies: ["A-3","E"] },
  { id: "305.2.2", occupancies: ["A-3","E"] },
  { id: "305.2.3", occupancies: ["E","R-3"] },
  { id: "305.3",   occupancies: ["E"] },

  // 306 - Factory Group F
  { id: "306",     occupancies: ["F-1","F-2"] },
  { id: "306.1",   occupancies: ["F-1","F-2"] },
  { id: "306.2",   occupancies: ["F-1"] },
  { id: "306.2.1", occupancies: ["F-1"] },
  { id: "306.3",   occupancies: ["F-2"] },

  // 307 - High-Hazard Group H
  { id: "307",     occupancies: ["H-1","H-2","H-3","H-4","H-5"] },
  { id: "307.1",   occupancies: ["H-1","H-2","H-3","H-4","H-5"] },
  { id: "307.1.1", occupancies: ["H-1","H-2","H-3","H-4","H-5"] },
  { id: "307.2",   occupancies: ["H-1","H-2","H-3","H-4","H-5"] },
  { id: "307.3",   occupancies: ["H-1"] },
  { id: "307.3.1", occupancies: ["H-1"] },
  { id: "307.4",   occupancies: ["H-2"] },
  { id: "307.5",   occupancies: ["H-3"] },
  { id: "307.6",   occupancies: ["H-4"] },
  { id: "307.7",   occupancies: ["H-5"] },
  { id: "307.8",   occupancies: ["H-1","H-2","H-3","H-4","H-5"] },

  // 308 - Institutional Group I
  { id: "308",       occupancies: ["A-3","E","I-1","I-2","I-3", "I-4", "R-3","R-4"] },
  { id: "308.1",     occupancies: ["A-3","E","I-1","I-2","I-3","R-3","R-4"] },
  { id: "308.2",     occupancies: ["I-1","R-3","R-4"] },
  { id: "308.2.1",   occupancies: ["I-1"] },
  { id: "308.2.2",   occupancies: ["I-1"] },
  { id: "308.2.3",   occupancies: ["I-1","R-4"] },
  { id: "308.2.4",   occupancies: ["I-1","R-3"] },
  { id: "308.3",     occupancies: ["I-2","R-3"] },
  { id: "308.3.1",   occupancies: ["I-2"] },
  { id: "308.3.1.1", occupancies: ["I-2"] },
  { id: "308.3.1.2", occupancies: ["I-2"] },
  { id: "308.3.2",   occupancies: ["I-2","R-3"] },
  { id: "308.4",     occupancies: ["I-3"] },
  { id: "308.4.1",   occupancies: ["I-3"] },
  { id: "308.4.2",   occupancies: ["I-3"] },
  { id: "308.4.3",   occupancies: ["I-3"] },
  { id: "308.4.4",   occupancies: ["I-3"] },
  { id: "308.4.5",   occupancies: ["I-3"] },
  { id: "308.5",     occupancies: ["I-4", "A-3","E","R-3"] },
  { id: "308.5.1",   occupancies: ["I-4","E",] },
  { id: "308.5.2",   occupancies: ["I-4", "A-3","E"] },
  { id: "308.5.3",   occupancies: ["I-4","E","R-3"] },
  { id: "308.5.4",   occupancies: ["I-4","R-3"] },

  // 309 - Mercantile Group M
  { id: "309",   occupancies: ["M"] },
  { id: "309.1", occupancies: ["M"] },
  { id: "309.2", occupancies: ["M"] },
  { id: "309.3", occupancies: ["M"] },

  // 310 - Residential Group R
  { id: "310",     occupancies: ["R-1","R-2","R-3","R-4"] },
  { id: "310.1",   occupancies: ["R-1","R-2","R-3","R-4"] },
  { id: "310.2",   occupancies: ["R-1"] },
  { id: "310.3",   occupancies: ["R-2"] },
  { id: "310.4",   occupancies: ["R-3", "R-4"] },
  { id: "310.4.1", occupancies: ["R-3","R-4"] },
  { id: "310.4.2", occupancies: ["R-3","R-4"] },
  { id: "310.5",   occupancies: ["R-4"] },
  { id: "310.5.1", occupancies: ["R-4"] },
  { id: "310.5.2", occupancies: ["R-4"] },

  // 311 - Storage Group S
  { id: "311",     occupancies: ["S-1","S-2"] },
  { id: "311.1",   occupancies: ["S-1","S-2"] },
  { id: "311.1.1", occupancies: ["S-1","S-2"] },
  { id: "311.1.2", occupancies: ["S-1","S-2"] },
  { id: "311.2",   occupancies: ["S-1"] },
  { id: "311.2.1", occupancies: ["S-1"] },
  { id: "311.2.2", occupancies: ["S-1"] },
  { id: "311.3",   occupancies: ["S-2"] },
  { id: "311.3.1", occupancies: ["S-2"] },

  // 312 - Utility Group U
  { id: "312",     occupancies: ["U"] },
  { id: "312.1",   occupancies: ["U"] },
  { id: "312.1.1", occupancies: ["U"] },
  { id: "312.2",   occupancies: ["U"] },
  { id: "312.3",   occupancies: ["U"] },
];