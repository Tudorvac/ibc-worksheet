import { AreaRow, Story, StoryId } from "./types";

function makeAreaRow(areaNo: 1 | 2 | 3 | 4): AreaRow {
  return {
    areaNo,
    occupancy: "",
    use: "",
    description: "",
    sqft: null,
    mixedUse: "",
    occupancyCondition: "",
    openRoomSqft: null,
  };
}

function makeStory(id: StoryId, kind: "above" | "below", orderIndex: number): Story {
  return {
    id,
    kind,
    orderIndex,
    areas: [makeAreaRow(1)],
  };
}

/**
 * Rebuild story list from counts while preserving any existing story/area data
 * when the storyId still exists.
 *
 * Display order requirement:
 *  Highest above-grade story down to 1, then B1, B2, ...
 */
export function syncStoriesFromCounts(
  existingStories: Story[],
  storiesAbove: number,
  storiesBelow: number
): Story[] {
  const byId = new Map(existingStories.map((s) => [s.id, s]));

  const next: Story[] = [];

  // Above-grade: storiesAbove ... 1
  for (let n = storiesAbove; n >= 1; n--) {
    const id = String(n);
    const orderIndex = 1000 + n; // keeps above-grade above below-grade
    const prev = byId.get(id);
    next.push(prev ? { ...prev, orderIndex } : makeStory(id, "above", orderIndex));
  }

  // Below-grade: B1..B(storiesBelow)
  for (let n = 1; n <= storiesBelow; n++) {
    const id = `B${n}`;
    const orderIndex = 500 - n; // lower than any above-grade
    const prev = byId.get(id);
    next.push(prev ? { ...prev, orderIndex } : makeStory(id, "below", orderIndex));
  }

  // Sort by orderIndex descending (top-down)
  next.sort((a, b) => b.orderIndex - a.orderIndex);

  return next;
}