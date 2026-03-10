import { ch3ApplicabilityRules } from "@/content/checklists/ch3Applicability";
import { ch3Rows } from "@/content/checklists/ch3";
import {
  ChecklistChapterResponses,
  ChecklistResponse,
  ChecklistState,
} from "@/lib/types";
import { ProjectState } from "@/lib/types";

// Extract the set of occupancy codes present anywhere in the project
export function getProjectOccupancies(project: ProjectState): Set<string> {
  const set = new Set<string>();
  for (const story of project.stories) {
    for (const area of story.areas) {
      // Occupancy values from dropdowns look like "Group B" — strip the prefix
      const raw = (area.occupancy ?? "").trim();
      if (!raw) continue;
      const code = raw.replace(/^Group\s+/i, "").trim();
      if (code) set.add(code);
    }
  }
  return set;
}

// Given current project inputs, return the set of row IDs that should be N/A
export function computeNaRowIds(project: ProjectState): Set<string> {
  const projectOccupancies = getProjectOccupancies(project);
  const naIds = new Set<string>();

  for (const rule of ch3ApplicabilityRules) {
    // Empty occupancies = always applicable, never auto-N/A
    if (rule.occupancies.length === 0) continue;

    // N/A if none of the rule's occupancies are present in the project
    const applicable = rule.occupancies.some((occ) => projectOccupancies.has(occ));
    if (!applicable) naIds.add(rule.id);
  }

  return naIds;
}

// Determine which manually-set R or I rows would be overridden by new N/A ids
export function findConflicts(
  newNaIds: Set<string>,
  responses: ChecklistChapterResponses
): string[] {
  const conflicts: string[] = [];
  for (const id of newNaIds) {
    const state = responses[id]?.state ?? "UNSET";
    if (state === "RESOLVED" || state === "INDET") {
      conflicts.push(id);
    }
  }
  return conflicts;
}

// Build the section label for conflict display (e.g. "303.1")
export function getCodeForId(id: string): string {
  const row = ch3Rows.find((r) => r.id === id);
  return row?.code ?? id;
}

// Apply N/A updates to responses, optionally skipping conflict IDs
export function applyNaUpdates(
  newNaIds: Set<string>,
  currentResponses: ChecklistChapterResponses,
  skipIds: Set<string> = new Set()
): ChecklistChapterResponses {
  const next = { ...currentResponses };

  // First pass: apply N/A to newly-NA rows
  for (const id of newNaIds) {
    if (skipIds.has(id)) continue;
    const prev = next[id] ?? { state: "UNSET" as ChecklistState, autoNote: "", userNote: "", noteEdited: false };
    next[id] = {
      ...prev,
      state: "NA",
      autoNote: "Not Applicable.",
    };
  }

  // Second pass: clear auto-N/A from rows that are no longer N/A
  // (only if they were auto-set, i.e. noteEdited is false and autoNote is "Not Applicable.")
  for (const row of ch3Rows) {
    if (!row.id) continue;
    if (newNaIds.has(row.id)) continue;
    if (skipIds.has(row.id)) continue;

    const r = next[row.id];
    if (!r) continue;

    // Only clear if it was auto-set to N/A (not manually set)
    if (r.state === "NA" && !r.noteEdited && r.autoNote === "Not Applicable.") {
      next[row.id] = {
        ...r,
        state: "UNSET",
        autoNote: "",
      };
    }
  }

  return next;
}

// Compute which section codes should be collapsed based on N/A row ids
// Only collapse a code if it is a main section (no dots) and is itself N/A
export function computeCollapsedFromNa(naIds: Set<string>): Set<string> {
  const collapsed = new Set<string>();
  for (const id of naIds) {
    const row = ch3Rows.find((r) => r.id === id);
    if (!row?.code) continue;
    // Only collapse main sections (301, 302, 303...) not subsections
    if (!row.code.includes(".")) {
      collapsed.add(row.code);
    }
  }
  return collapsed;
}