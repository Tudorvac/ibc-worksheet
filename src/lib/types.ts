export type StoryId = string; // "1", "2", ... "7", "B1", "B2", ...

export type OccupancyCode = string; // later: constrain to allowed values
export type UseCode = string; // later: dependent on occupancy
export type MixedUseTag = string;

export type StoryKind = "above" | "below";

export interface AreaRow {
  areaNo: 1 | 2 | 3 | 4;
  occupancy: OccupancyCode | "";
  use: UseCode | "";
  description: string;
  sqft: number | null; // null = not entered
  mixedUse: MixedUseTag | ""; // only used for areaNo 2-4
}

export interface Story {
  id: StoryId;              // display label: "7" or "B2"
  kind: StoryKind;          // above/below grade
  orderIndex: number;       // higher = shown first
  areas: AreaRow[];         // always at least Area 1
}

export interface Module1State {
  storiesAbove: number;     // 0..?
  storiesBelow: number;     // 0..?
}

export interface ProjectState {
  m1: Module1State;
  stories: Story[];         // Module 2 working data
}