"use client";

import React from "react";
import { ProjectState, Story } from "@/lib/types";
import { getOccupancyColor, getOccupancyTextColor, getOccupancyLabel } from "@/lib/occupancyColors";
import { OccupancyKey, LimitValue, getAreaFactor, mapConstructionType, mapSprinklerTag, mapOccupancyKey } from "@/lib/buildingLimits";

const EXCLUDED_MIXED_USES = ["Mezzanine", "Equipment Platform", "Occupied Roof", "Penthouse"];
const BASE_ROW_HEIGHT = 48; // px for a 10ft story
const BASE_STORY_HEIGHT_FT = 12;
const DEFAULT_STORY_HEIGHT_FT = 10;
const MIN_BLOCK_WIDTH = 80; // px minimum block width
const MAX_BLOCKS_PER_STORY = 6;
const LEADER_WIDTH = 110; // px for right-side leaders
const DIAGRAM_MAX_HEIGHT = 600; // px before scrolling

interface StoryBlock {
  occupancy: string;
  sqft: number;
  mixedUse: string;
  isMezzanine: boolean;
  isOccupiedRoof: boolean;
}

interface StoryRow {
  story: Story;
  blocks: StoryBlock[];
  totalSqft: number;
  heightFt: number;
  elevation: number | null; // bottom elevation in feet
  label: string;
}

function getMostRestrictiveOccupancy(
  story: Story,
  ct: ReturnType<typeof mapConstructionType>,
  spk: ReturnType<typeof mapSprinklerTag>
): string {
  const nonsepAreas = story.areas.filter(a =>
    !EXCLUDED_MIXED_USES.includes(a.mixedUse) &&
    a.mixedUse !== "Separated Use" &&
    a.occupancy
  );
  if (!ct || nonsepAreas.length === 0) return "";

  let mostRestrictiveOcc = "";
  let mostRestrictiveAt: LimitValue = "UL";

  for (const area of nonsepAreas) {
    const key = area.occupancyCondition
      ? area.occupancyCondition as OccupancyKey
      : mapOccupancyKey(area.occupancy);
    if (!key) continue;
    const at = getAreaFactor(key, ct, spk);
    if (mostRestrictiveOcc === "") {
      mostRestrictiveOcc = area.occupancy;
      mostRestrictiveAt = at;
      continue;
    }
    if (at === "NP") { mostRestrictiveOcc = area.occupancy; mostRestrictiveAt = at; continue; }
    if (mostRestrictiveAt === "NP") continue;
    if (at === "UL") continue;
    if (mostRestrictiveAt === "UL") { mostRestrictiveOcc = area.occupancy; mostRestrictiveAt = at; continue; }
    if (typeof at === "number" && typeof mostRestrictiveAt === "number" && at < mostRestrictiveAt) {
      mostRestrictiveOcc = area.occupancy;
      mostRestrictiveAt = at;
    }
  }
  return mostRestrictiveOcc;
}

export function ElevationDiagram({ project }: { project: ProjectState }) {
  const ct = mapConstructionType(project.m1.constructionType);
  const aboveCount = project.stories.filter(s => s.kind === "above").length;
  const spk = mapSprinklerTag(project.m1.sprinklers, aboveCount);

  // Sort stories: above grade top to bottom (highest orderIndex first), then below grade
  const aboveStories = project.stories
    .filter(s => s.kind === "above")
    .sort((a, b) => b.orderIndex - a.orderIndex);
  const belowStories = project.stories
    .filter(s => s.kind === "below")
    .sort((a, b) => b.orderIndex - a.orderIndex);

  const allStories = [...aboveStories, ...belowStories];

  if (allStories.length === 0) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: 200,
        color: "#9ca3af",
        fontSize: 13,
        fontStyle: "italic",
      }}>
        Add stories in Module 2 to see the elevation diagram.
      </div>
    );
  }

  // Find reference story (1st above grade = lowest orderIndex above)
  const firstAbove = aboveStories[aboveStories.length - 1];
  const refSqft = firstAbove
    ? firstAbove.areas
        .filter(a => !EXCLUDED_MIXED_USES.includes(a.mixedUse))
        .reduce((sum, a) => sum + (a.sqft ?? 0), 0)
    : 1;

    const separatedTypes = ["Separated Use", "Incidental Use", "Control Area"];

  // Build story rows
  const storyRows: StoryRow[] = allStories.map(story => {
    const heightFt = story.floorHeight?.feet ?? DEFAULT_STORY_HEIGHT_FT;
    const mostRestrictive = getMostRestrictiveOccupancy(story, ct, spk);

    // Collect blocks
    const regularAreas = story.areas.filter(a =>
      !EXCLUDED_MIXED_USES.includes(a.mixedUse) && a.occupancy
    ).slice(0, MAX_BLOCKS_PER_STORY);

    const mezzAreas = story.areas.filter(a => a.mixedUse === "Mezzanine");
    const roofAreas = story.areas.filter(a => a.mixedUse === "Occupied Roof");

    let blocks: StoryBlock[] = [];

// All displayable areas (not excluded)
const displayAreas = story.areas.filter(a =>
  !["Equipment Platform", "Penthouse"].includes(a.mixedUse) && a.occupancy
).slice(0, MAX_BLOCKS_PER_STORY);

blocks = displayAreas.map((a, idx) => {
  return {
  occupancy: a.occupancy,
  sqft: a.sqft ?? 0,
  mixedUse: a.mixedUse,
  isMezzanine: a.mixedUse === "Mezzanine",
  isOccupiedRoof: a.mixedUse === "Occupied Roof",
};
});

// Add occupied roof if present and not already included
if (roofAreas.length > 0 && !blocks.some(b => b.isOccupiedRoof)) {
  blocks.push({
    occupancy: "Occupied Roof",
    sqft: roofAreas.reduce((sum, a) => sum + (a.sqft ?? 0), 0),
    isMezzanine: false,
    isOccupiedRoof: true,
    mixedUse: "Occupied Roof",
  });
}

    const totalSqft = blocks.reduce((sum, b) => sum + b.sqft, 0);

    return {
      story,
      blocks,
      totalSqft,
      heightFt: Math.max(heightFt, DEFAULT_STORY_HEIGHT_FT),
      elevation: null,
      label: story.kind === "below"
        ? `B${story.id.replace("B", "")} Story`
        : `${story.id}${["1","2","3"].includes(story.id) ? ["st","nd","rd"][parseInt(story.id)-1] : "th"} Story`,
    };
  });

  // aboveRows = [1st, 2nd, 3rd, ...top] (ascending order, index 0 = 1st story)
  const aboveRows = storyRows.filter(r => r.story.kind === "above").reverse();
  // belowRows = [B1, B2...] (B1 closest to grade)
  const belowRows = storyRows.filter(r => r.story.kind === "below");

  // Above grade:
  // - elevation = this story's own floorHeight.feet (= bottom slab elevation)
  // - leader renders at BOTTOM of each row div, so it aligns with the floor slab line
  // - rect height = next story's floorHeight - this story's floorHeight
  for (let i = 0; i < aboveRows.length; i++) {
    const thisElev = aboveRows[i].story.floorHeight?.feet ?? null;
    const nextElev = i + 1 < aboveRows.length
      ? (aboveRows[i + 1].story.floorHeight?.feet ?? null)
      : null;

    // Elevation label = this story's bottom slab = floorHeight directly
    aboveRows[i].elevation = thisElev;

    if (i === aboveRows.length - 1) {
      // Top story — no floor above, use BASE height
      aboveRows[i].heightFt = BASE_STORY_HEIGHT_FT;
    } else if (thisElev !== null && nextElev !== null) {
      aboveRows[i].heightFt = Math.max(BASE_STORY_HEIGHT_FT, nextElev - thisElev);
    } else {
      aboveRows[i].heightFt = BASE_STORY_HEIGHT_FT;
    }
  }

  // Below grade:
  // - elevation = this story's own floorHeight.feet (negative value)
  // - rect height = distance between this floor and the floor above it
  for (let i = 0; i < belowRows.length; i++) {
    const thisElev = belowRows[i].story.floorHeight?.feet ?? null;
    const aboveElev = i === 0
      ? 0  // grade = 0
      : (belowRows[i - 1].story.floorHeight?.feet ?? 0);

    // Elevation label = this story's bottom slab = floorHeight directly
    belowRows[i].elevation = thisElev;

    if (thisElev !== null) {
      belowRows[i].heightFt = Math.max(BASE_STORY_HEIGHT_FT, Math.abs(thisElev - aboveElev));
    } else {
      belowRows[i].heightFt = BASE_STORY_HEIGHT_FT;
    }
  }

const getElevationSuffix = (row: StoryRow): string => {
  if (row.story.kind === "above") {
    const idx = aboveRows.findIndex(r => r.story.id === row.story.id);
    if (idx === 0) return "Grade";
    const n = idx + 1;
    const suffix = n === 2 ? "nd" : n === 3 ? "rd" : "th";
    return `${n}${suffix} Story`;
  } else {
    const idx = belowRows.findIndex(r => r.story.id === row.story.id);
    return `Basement ${idx + 1}`;
  }
};

  // Diagram width (content area)
  const diagramWidth = 400; // px — blocks scale within this

  // Row height scaling
  const getRowHeight = (heightFt: number) =>
    Math.max(48, (heightFt / BASE_STORY_HEIGHT_FT) * BASE_ROW_HEIGHT);

  const totalHeight = storyRows.reduce((sum, r) => sum + getRowHeight(r.heightFt), 0);
  const shouldScroll = allStories.length > 10;

  const firstStoryRow = aboveRows[0];
  const firstStoryWidthPx = firstStoryRow
    ? Math.max(MIN_BLOCK_WIDTH, (firstStoryRow.totalSqft / refSqft) * diagramWidth)
    : diagramWidth;
  const b1Row = belowRows[0];
  const b1WidthPx = b1Row
    ? Math.max(MIN_BLOCK_WIDTH, (b1Row.totalSqft / refSqft) * diagramWidth)
    : 0;
  const gradeLineWidthPx = Math.max(firstStoryWidthPx, b1WidthPx);
  const GRADE_OVERHANG = 36; // px extension on each side

  return (
    <div style={{
      overflowY: shouldScroll ? "auto" : "visible",
      maxHeight: shouldScroll ? DIAGRAM_MAX_HEIGHT : "none",
    }}>
      <div style={{
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}>
        
        {storyRows.map((row, rowIdx) => {
          const rowHeight = getRowHeight(row.heightFt);
          const storyWidthPct = refSqft > 0 ? row.totalSqft / refSqft : 1;
          const storyWidthPx = Math.max(MIN_BLOCK_WIDTH, storyWidthPct * diagramWidth);
          const isGradeTop = row.story.kind === "below" && rowIdx > 0 && storyRows[rowIdx - 1].story.kind === "above";
          const hasElevation = row.elevation !== null && row.story.floorHeight?.feet !== null;
          
          // One divider per interior boundary between blocks
          const dividers: ("dashed" | "solid" | "perimeter")[] = row.blocks.slice(0, -1).map((b, i) => {
            const next = row.blocks[i + 1];
            if (b.isOccupiedRoof || next.isOccupiedRoof) return "perimeter";
            const isSep =
              separatedTypes.includes(b.mixedUse) ||
              separatedTypes.includes(next.mixedUse);
            return isSep ? "solid" : "dashed";
          });

          return (
            <div key={row.story.id}>
              {isGradeTop && (
                <div style={{
                  display: "flex",
                }}>
                  <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
                    <div style={{ 
                      width: gradeLineWidthPx + GRADE_OVERHANG * 2,
                      height: 3,
                      background: "#111",
                      marginRight: -GRADE_OVERHANG, 
                    }} />
                  </div>
                  <div style={{ width: LEADER_WIDTH, flexShrink: 0 }} />
                </div>
              )}

              <div style={{
                display: "flex",
                alignItems: "stretch",
                height: rowHeight,
                position: "relative",
              }}>
                {/* Story blocks — flush right */}
                <div style={{
                  flex: 1,
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "stretch",
                }}>
                  <div style={{
                    display: "flex",
                    width: storyWidthPx,
                    overflow: "hidden",
                    background: row.story.kind === "below" ? "#e8e8e8" : "#fff",
                  }}>
                    {row.blocks.map((block, blockIdx) => {
                      const blockPct = row.totalSqft > 0
                        ? block.sqft / row.totalSqft
                        : 1 / row.blocks.length;
                      const blockWidth = blockPct * storyWidthPx;
                      const bgColor = block.isOccupiedRoof
                        ? "transparent"
                        : getOccupancyColor(block.occupancy);
                      const textColor = block.isOccupiedRoof
                        ? "#555"
                        : getOccupancyTextColor(block.occupancy);
                      const label = getOccupancyLabel(block.occupancy);

                      return (
                        <div
                          key={blockIdx}
                          title={`${label}${block.sqft > 0 ? ` — ${block.sqft.toLocaleString()} sf` : ""}${block.mixedUse ? ` (${block.mixedUse})` : ""}`}
                          style={{
                            width: blockWidth,
                            minWidth: 0,
                            background: bgColor,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "4px 6px",
                            position: "relative",
                            borderTop: block.isOccupiedRoof ? "none" : "1px solid #222",
                            borderBottom: "1px solid #222",
                            borderLeft: block.isOccupiedRoof ? "none"
                              : blockIdx === 0
                                ? "1px solid #222"
                                : dividers[blockIdx - 1] === "solid"
                                    ? "1.5px solid #111"
                                    : dividers[blockIdx - 1] === "perimeter"
                                      ? "1px solid #222"
                                      : "1px dashed rgba(0,0,0,0.3)",
                            borderRight: block.isOccupiedRoof ? "none"
                              : blockIdx === row.blocks.length - 1
                                ? "1px solid #222"
                                : dividers[blockIdx] === "solid"
                                    ? "1.5px solid #111"
                                    : dividers[blockIdx] === "perimeter"
                                      ? "1px solid #222"
                                      : "1px dashed rgba(0,0,0,0.3)",
                          }}
                        >
                          {/* Mezzanine indicator */}
                          {block.isMezzanine && (
                            <div style={{
                              position: "absolute",
                              right: 6,
                              bottom: 10,
                              display: "flex",
                              flexDirection: "column",
                              gap: 3,
                            }}>
                              <div style={{ width: 24, height: 1.5, background: textColor }} />
                              <div style={{ width: 24, height: 1.5, background: textColor }} />
                            </div>
                          )}
                          {blockWidth >= 40 && block.isOccupiedRoof && (
                            <div style={{
                              fontSize: 8,
                              color: textColor,
                              opacity: 0.7,
                              textAlign: "center",
                              marginBottom: 2,
                            }}>
                              Occupied Roof
                            </div>
                          )}
                          {blockWidth >= 40 && (
                            <div style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: textColor,
                              textAlign: "center",
                              lineHeight: 1.2,
                            }}>
                              {label}
                            </div>
                          )}
                          {blockWidth >= 70 && block.sqft > 0 && (
                            <div style={{
                              fontSize: 10,
                              color: textColor,
                              opacity: 0.8,
                              marginTop: 2,
                            }}>
                              {block.sqft.toLocaleString()} sf
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Leader line + elevation label — anchored to BOTTOM of row = floor slab line */}
                <div style={{
                  width: LEADER_WIDTH,
                  display: "flex",
                  alignItems: "flex-end",  // anchor to bottom of row
                  flexShrink: 0,
                }}>
                  {hasElevation && (
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      marginBottom: row.story.kind === "above" && aboveRows.findIndex(r => r.story.id === row.story.id) === 0 ? 2 : -6,
                    }}>
                      <div style={{
                        width: 20,
                        borderTop: (row.story.kind === "above" && aboveRows.findIndex(r => r.story.id === row.story.id) === 0)
                          ? "none"
                          : "1px dashed #888",
                      }} />
                      <span style={{
                        fontSize: 10,
                        color: "#555",
                        whiteSpace: "nowrap",
                      }}>
                        {row.elevation !== null
                          ? `${row.elevation >= 0 ? "" : "-"}${Math.abs(row.elevation ?? 0)}'-0" ${getElevationSuffix(row)}`
                          : ""}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}