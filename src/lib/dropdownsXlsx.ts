import * as XLSX from "xlsx";

export type DropdownLists = Record<string, string[]>;
export type UsesByOccupancy = Record<string, string[]>;

export interface DropdownData {
  lists: DropdownLists;           // e.g. lists["Construction Type"] = [...]
  usesByOccupancy: UsesByOccupancy; // e.g. usesByOccupancy["Group B"] = [...]
}

/**
 * Loads /dropdowns.xlsx and returns:
 * - lists keyed by sheet name (for simple dropdown sheets)
 * - usesByOccupancy keyed by "Group X" sheet names
 *
 * Assumptions:
 * - Each sheet has a header in row 1, values starting row 2 in column A
 * - Blank rows are ignored
 */
export async function loadDropdownsXlsx(url = "/dropdowns.xlsx"): Promise<DropdownData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);

  const buf = await res.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });

  const lists: DropdownLists = {};
  const usesByOccupancy: UsesByOccupancy = {};

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    // Read first column as rows, including header row
    const colA = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false }) as any[][];
    // colA is a 2D array of rows; value we want is row[i][0]
    const values = colA
      .slice(1) // skip header row
      .map((r) => (r?.[0] ?? "").toString().trim())
      .filter((v) => v.length > 0);

    // De-dupe while preserving order
    const seen = new Set<string>();
    const deduped = values.filter((v) => (seen.has(v) ? false : (seen.add(v), true)));

    // Separate "Use sheets" (your Group A-1, Group B, etc.)
    if (/^Group\s+/i.test(sheetName)) {
      usesByOccupancy[sheetName] = deduped;
    } else {
      lists[sheetName] = deduped;
    }
  }

  return { lists, usesByOccupancy };
}