export type StoryId = string; // "1", "2", ... "7", "B1", "B2", ...

export type OccupancyCode = string; // later: constrain to allowed values
export type UseCode = string; // later: dependent on occupancy
export type MixedUseTag = string;

export type StoryKind = "above" | "below";

// Checklist types
export type ChecklistState = "UNSET" | "RESOLVED" | "INDET" | "NA";

export type ChecklistResponse = {
  state: ChecklistState;
  autoNote: string;       // system-generated, shown grey italic
  userNote: string;       // manually entered, shown black
  noteEdited: boolean;    // true once reviewer has touched the note field
};

export type ChecklistChapterResponses = Record<string, ChecklistResponse>;

// ADD THESE TWO:
export type ChecklistRowDef = {
  id: string;
  code: string;
  title: string;
  isMainSection: boolean;
};

export type ApplicabilityRule = {
  id: string;
  occupancies: string[]; // empty = always applicable
};

export interface AreaRow {
  areaNo: 1 | 2 | 3 | 4;
  occupancy: OccupancyCode | "";
  use: UseCode | "";
  description: string;
  sqft: number | null;
  mixedUse: MixedUseTag | "";
  occupancyCondition: string; // e.g. "I-1-C1", "" if not applicable
}

export interface Story {
  id: StoryId;              // display label: "7" or "B2"
  kind: StoryKind;          // above/below grade
  orderIndex: number;       // higher = shown first
  areas: AreaRow[];         // always at least Area 1
}

export interface FeetInches {
  feet: number | null;   // null = not entered
  inches: number | null; // null = not entered (0–11 later)
}

export interface Module1State {
  storiesAbove: number;
  storiesBelow: number;

  constructionType: string;
  sprinklers: string;
  fireAlarm: string;

  buildingHeight: FeetInches;
  highestFloor: FeetInches;
  personsReceivingCare: number | null;
}

export interface ProjectState {
  m1: Module1State;
  stories: Story[];         // Module 2 working data
}