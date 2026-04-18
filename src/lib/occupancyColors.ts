// Color palette by occupancy group letter
export const OCCUPANCY_COLORS: Record<string, string> = {
  A: "#7aab8a",  // sage green
  B: "#c9b96a",  // tan/gold
  E: "#c47a3a",  // orange
  F: "#5a8a7a",  // teal green
  H: "#c4522a",  // burnt orange
  I: "#6a7faa",  // steel blue
  M: "#7a8aaa",  // blue grey
  R: "#b05a3a",  // terracotta
  S: "#8a6a4a",  // brown
  U: "#5a7a6a",  // dark sage
};

export const OCCUPANCY_TEXT_COLORS: Record<string, string> = {
  A: "#1a3a2a",
  B: "#3a3010",
  E: "#3a1a00",
  F: "#0a2a20",
  H: "#3a1000",
  I: "#0a1a3a",
  M: "#0a1a3a",
  R: "#3a1000",
  S: "#2a1a00",
  U: "#0a2a1a",
};

export function getOccupancyColor(occupancy: string): string {
  // Strip "Group " prefix
  const clean = occupancy.replace(/^Group\s+/i, "");
  // Get first letter
  const letter = clean.charAt(0).toUpperCase();
  return OCCUPANCY_COLORS[letter] ?? "#aaaaaa";
}

export function getOccupancyTextColor(occupancy: string): string {
  const clean = occupancy.replace(/^Group\s+/i, "");
  const letter = clean.charAt(0).toUpperCase();
  return OCCUPANCY_TEXT_COLORS[letter] ?? "#111111";
}

export function getOccupancyLabel(occupancy: string): string {
  return occupancy.replace(/^Group\s+/i, "");
}