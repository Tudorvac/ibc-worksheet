"use client";

import React from "react";
import { ChapterChecklist } from "@/components/checklists/ChapterChecklist";
import { ch3Rows } from "@/content/checklists/ch3";
import { ch4Rows } from "@/content/checklists/ch4";
import { ch5Rows } from "@/content/checklists/ch5";
import { ch6Rows } from "@/content/checklists/ch6";
import type { ChecklistChapterResponses } from "@/lib/types";
import { ProjectState, FrontageState, FrontageSegment, StoryKind, Module3State } from "@/lib/types";
import { syncStoriesFromCounts } from "@/lib/storyGeneration";
import { DropdownData, loadDropdownsXlsx } from "@/lib/dropdownsXlsx";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { saveProject, loadProject } from "@/lib/persistence";
import { PanelInfoTable, type PanelInfoCell } from "@/components/PanelInfoTable";

import {
  computeNaRowIds,
  findConflicts,
  getCodeForId,
  applyNaUpdates,
  computeCollapsedFromNa,
} from "@/lib/applicability";

import {
  mapConstructionType,
  mapSprinklerTag,
  mapOccupancyKey,
  getMaxStories,
  getMaxHeightFt,
  getAreaFactor,
  getMostRestrictiveLimit,
  checkCompliance,
  type LimitValue,
  type OccupancyKey,
  type SprinklerTag,
  type ConstructionType,
} from "@/lib/buildingLimits";

function useWindowWidth(): number {
  const [width, setWidth] = React.useState(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );
  React.useEffect(() => {
    function handle() { setWidth(window.innerWidth); }
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);
  return width;
}

export default function Home() {
  const windowWidth = useWindowWidth();
  const [navExpanded, setNavExpanded] = React.useState(true);
  const [ch3Responses, setCh3Responses] = React.useState<ChecklistChapterResponses>({});
  const [ch4Responses, setCh4Responses] = React.useState<ChecklistChapterResponses>({});
  const [ch5Responses, setCh5Responses] = React.useState<ChecklistChapterResponses>({});
  const [ch6Responses, setCh6Responses] = React.useState<ChecklistChapterResponses>({});
  const [ch3Collapsed, setCh3Collapsed] = React.useState<Set<string>>(new Set());
  const [ch4Collapsed, setCh4Collapsed] = React.useState<Set<string>>(new Set());
  const [ch5Collapsed, setCh5Collapsed] = React.useState<Set<string>>(new Set());
  const [ch6Collapsed, setCh6Collapsed] = React.useState<Set<string>>(new Set());
  const [pendingNaIds, setPendingNaIds] = React.useState<Set<string> | null>(null);
  const [conflictCodes, setConflictCodes] = React.useState<string[]>([]);
  const [ch3PanelCollapsed, setCh3PanelCollapsed] = React.useState(true);
  const [ch4PanelCollapsed, setCh4PanelCollapsed] = React.useState(true);
  const [ch5PanelCollapsed, setCh5PanelCollapsed] = React.useState(true);
  const [ch6PanelCollapsed, setCh6PanelCollapsed] = React.useState(true);

  const [project, setProject] = React.useState<ProjectState>(() => {
    const saved = loadProject();
    if (saved) return saved;
    return ({
      m1: {
        storiesAbove: 0,
        storiesBelow: 0,
        constructionType: "",
        sprinklers: "",
        fireAlarm: "",
        buildingHeight: { feet: null, inches: null },
        highestFloor: { feet: null, inches: null },
        personsReceivingCare: null,
      },
      stories: [],
      m3: {
        specialIndustrialOccupancy: false,
        oneStoryAircraftHangar: false,
        unlimitedAreaBuilding: false,
        specialProvisions: false,
        rooftopStructures: false,
        specialIndustrialOccupancyNote: "",
        oneStoryAircraftHangarNote: "",
        unlimitedAreaBuildingNote: "",
        specialProvisionsNote: "",
        rooftopStructuresNote: "",
        frontage: {
          north: { perimeterLength: null, frontageWidth: null },
          east:  { perimeterLength: null, frontageWidth: null },
          south: { perimeterLength: null, frontageWidth: null },
          west:  { perimeterLength: null, frontageWidth: null },
          useInterpolated: false,
          frontageEnabled: false,
        },
        panel504Collapsed: true,
        panel505Collapsed: true,
        panel506Collapsed: true,
        panel507Collapsed: true,
        panel508Collapsed: true,
        panel509Collapsed: true,
        panel510Collapsed: true,
      },
    });
  });

  const [collapsedStories, setCollapsedStories] = React.useState<Set<string>>(new Set());

  function toggleStoryCollapsed(storyId: string) {
    setCollapsedStories(prev => {
      const next = new Set(prev);
      if (next.has(storyId)) next.delete(storyId);
      else next.add(storyId);
      return next;
    });
  }

  // Auto-collapse nav below 900px
  React.useEffect(() => {
    if (windowWidth < 900) setNavExpanded(false);
    else setNavExpanded(true);
  }, [windowWidth]);

  const hasGroupI = project.stories.some(s =>
    s.areas.some(a => a.occupancy.startsWith("Group I"))
  );

  const buildingLimits = React.useMemo(() => {
    const ct = mapConstructionType(project.m1.constructionType);
    const storiesAbove = countAboveStories(project);
    const spk = mapSprinklerTag(project.m1.sprinklers, storiesAbove);

  // Collect unique occupancy keys from all story areas
const occKeys = Array.from(new Set(
    project.stories
      .flatMap(s => s.areas.map(a => {
        if (a.occupancyCondition) return a.occupancyCondition as OccupancyKey;
        return mapOccupancyKey(a.occupancy);
      }))
      .filter((k): k is OccupancyKey => k !== null)
  ));

  if (!ct || occKeys.length === 0) return null;

  const maxStories = getMostRestrictiveLimit(
    occKeys.map(o => getMaxStories(o, ct, spk))
  );
  const maxHeightFt = getMostRestrictiveLimit(
    occKeys.map(o => getMaxHeightFt(o, ct, spk))
  );
  const maxAreaFactor = getMostRestrictiveLimit(
    occKeys.map(o => getAreaFactor(o, ct, spk))
  );

  return { maxStories, maxHeightFt, maxAreaFactor, spk, ct };
}, [project]);

const calc504 = React.useMemo(() => compute504(project), [project]);
const calc506 = React.useMemo(() => computeArea506(project), [project]);

  function scrollToId(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function updateArea(
    storyId: string,
    areaNo: 1 | 2 | 3 | 4 | 5 | 6,
    patch: Partial<{
      occupancy: string;
      use: string;
      description: string;
      sqft: number | null;
      mixedUse: string;
      occupancyCondition: string;
      openRoomSqft: number | null;
    }>
  ) {
    setProject((prev) => ({
      ...prev,
      stories: prev.stories.map((s) => {
        if (s.id !== storyId) return s;
        return {
          ...s,
          areas: s.areas.map((a) => (a.areaNo === areaNo ? { ...a, ...patch } : a)),
        };
      }),
    }));
  }

  function addArea(storyId: string) {
    setProject((prev) => ({
      ...prev,
      stories: prev.stories.map((s) => {
        if (s.id !== storyId) return s;
        if (s.areas.length >= 6) return s;

        const nextAreaNo = (s.areas.length + 1) as 2 | 3 | 4 | 5 | 6;
        return {
          ...s,
          areas: [
            ...s.areas,
            {
              areaNo: nextAreaNo,
              occupancy: "",
              use: "",
              description: "",
              sqft: null,
              mixedUse: "",
              occupancyCondition: "",
              openRoomSqft: null,
            },
          ],
        };
      }),
    }));
  }

  function deleteAreaRow(storyId: string, areaNo: 2 | 3 | 4 | 5 | 6) {
    setProject((prev) => ({
      ...prev,
      stories: prev.stories.map((s) => {
        if (s.id !== storyId) return s;

        const remaining = s.areas.filter((a) => a.areaNo !== areaNo);

        const renumbered = remaining
          .slice()
          .sort((a, b) => a.areaNo - b.areaNo)
          .map((a, idx) => ({
            ...a,
            areaNo: (idx + 1) as 1 | 2 | 3 | 4 | 5 | 6,
          }));

        return { ...s, areas: renumbered };
      }),
    }));
  }

  function removeStory(storyId: string) {
    const story = project.stories.find(s => s.id === storyId);
    if (!story) return;
    if (story.areas.length > 0) {
      const label = ordinalStoryLabel(story);
      if (!confirm(`Are you sure you want to delete ${label} and all its areas?`)) return;
    }
    setProject((prev) => {
      const target = prev.stories.find((s) => s.id === storyId);
      if (!target) return prev;

      const remaining = prev.stories.filter((s) => s.id !== storyId);

      const above = remaining.filter((s) => s.kind === "above");
      const below = remaining.filter((s) => s.kind === "below");

      const aboveSorted = [...above].sort((a, b) => Number(b.id) - Number(a.id)); // 5,4,3...
      const belowSorted = [...below].sort(
        (a, b) => Number(a.id.replace(/^B/i, "")) - Number(b.id.replace(/^B/i, ""))
      ); // B1,B2...

      const aboveRenumbered = aboveSorted.map((s, idx) => ({
        ...s,
        id: String(aboveSorted.length - idx), // 4,3,2,1 top-down
      }));

      const belowRenumbered = belowSorted.map((s, idx) => ({
        ...s,
        id: `B${idx + 1}`, // B1,B2,...
      }));

      const stories = [...aboveRenumbered, ...belowRenumbered];

      return {
        ...prev,
        stories,
        m1: {
          ...prev.m1,
          storiesAbove: aboveRenumbered.length,
          storiesBelow: belowRenumbered.length,
        },
      };
    });
  }

  function storyTotalSqft(story: { areas: { sqft: number | null }[] }): number {
    return story.areas.reduce((sum, a) => sum + (a.sqft ?? 0), 0);
  }

  function areaPercent(story: { areas: { sqft: number | null }[] }, areaSqft: number | null): string {
    const total = storyTotalSqft(story);
    if (!total || !areaSqft) return "—";
    const pct = (areaSqft / total) * 100;
    return pct === 100 ? "100%" : `${pct.toFixed(1)}%`;
  }

  function onOccupancyChange(storyId: string, areaNo: 1 | 2 | 3 | 4 | 5 | 6, occ: string) {
  updateArea(storyId, areaNo, { occupancy: occ, use: "", occupancyCondition: "" });
}

const highestFloorHeight = React.useMemo(() => {
  const aboveStories = project.stories
    .filter(s => s.kind === "above")
    .sort((a, b) => b.orderIndex - a.orderIndex);
  if (aboveStories.length === 0) return null;
  const top = aboveStories[0];
  return top.floorHeight ?? null;
}, [project.stories]);

  const [dropdownData, setDropdownData] = React.useState<DropdownData>({
    lists: {},
    usesByOccupancy: {},
  });

  React.useEffect(() => {
    (async () => {
      try {
        const data = await loadDropdownsXlsx("/dropdowns.xlsx");
        setDropdownData(data);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  React.useEffect(() => {
    setProject((prev) => ({
      ...prev,
      stories: syncStoriesFromCounts(prev.stories, prev.m1.storiesAbove, prev.m1.storiesBelow),
    }));
  }, [project.m1.storiesAbove, project.m1.storiesBelow]);

  React.useEffect(() => {
    const newNaIds = computeNaRowIds(project);
    const conflicts = findConflicts(newNaIds, ch3Responses);

    if (conflicts.length > 0) {
      setPendingNaIds(newNaIds);
      setConflictCodes(conflicts.map(getCodeForId));
    } else {
      setCh3Responses((prev) => applyNaUpdates(newNaIds, prev));
      setCh3Collapsed(computeCollapsedFromNa(newNaIds));
    }
  }, [project]);

React.useEffect(() => {
    saveProject(project);
  }, [project]);

function handleKeepManual() {
  if (!pendingNaIds) return;
  const skipIds = new Set(
    Array.from(pendingNaIds).filter((id) => {
      const state = ch3Responses[id]?.state ?? "UNSET";
      return state === "RESOLVED" || state === "INDET";
    })
  );
  setCh3Responses((prev) => applyNaUpdates(pendingNaIds, prev, skipIds));
  setPendingNaIds(null);
  setConflictCodes([]);
}

function handleUpdateSections() {
  if (!pendingNaIds) return;
  setCh3Responses((prev) => applyNaUpdates(pendingNaIds, prev));
  setCh3Collapsed(computeCollapsedFromNa(pendingNaIds));
  setPendingNaIds(null);
  setConflictCodes([]);
}

  return (
    <main style={{ 
      height: "100vh",
      overflowY: "auto",
      overflowX: "auto",
      padding: "24px", 
      fontFamily: "system-ui, Arial, sans-serif",
    }}>

          {pendingNaIds && (
            <div style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 1000,
            }}>
              <div style={{
                background: "#fff", borderRadius: 14, padding: 24,
                maxWidth: 480, width: "90%", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
              }}>
                <h3 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 800 }}>
                  Building Input Conflict
                </h3>
                <p style={{ margin: "0 0 12px", color: "#444", fontSize: 14 }}>
                  This change would override manual review entries in the following sections:
                </p>
                <div style={{
                  background: "#f6f6f6", borderRadius: 8, padding: "8px 12px",
                  marginBottom: 16, fontSize: 13, fontWeight: 600, color: "#333",
                  maxHeight: 160, overflowY: "auto",
                }}>
                  {conflictCodes.join(", ")}
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={handleKeepManual}
                    style={{
                      border: "1px solid #cfcfcf", borderRadius: 10,
                      padding: "8px 16px", fontSize: 13, fontWeight: 700,
                      background: "#fafafa", color: "#333", cursor: "pointer",
                    }}
                  >
                    Keep Manual Overrides
                  </button>
                  <button
                    type="button"
                    onClick={handleUpdateSections}
                    style={{
                      border: "1px solid #3b82f6", borderRadius: 10,
                      padding: "8px 16px", fontSize: 13, fontWeight: 700,
                      background: "#3b82f6", color: "#fff", cursor: "pointer",
                    }}
                  >
                    Update Sections
                  </button>
                </div>
              </div>
            </div>
          )}

      <div style={{ minWidth: 800, padding: "0px 24px", boxSizing: "border-box" }}>
        <header style={{ marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#989898" }}>2024 IBC Review Worksheet</h1>
          <p style={{ margin: "6px 0 0", color: "#989898" }}>
            This worksheet assists in evaluating buildings for compliance with the 2024 International Building Code, functioning as a dynamic, input-driven checklist and formal record.
          </p>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: `${navExpanded ? 200 : 48}px 1fr`, gap: 54, transition: "grid-template-columns 200ms ease" }}>
          {/* LEFT NAV (sticky jump menu) */}
          {/* Nav panel wrapper */}
          <div style={{
            position: "sticky",
            top: 12,
            alignSelf: "start",
            zIndex: 10,
          }}>

            <nav
              style={{
                width: navExpanded ? 238 : 56,
                minWidth: navExpanded ? 238 : 56,
                maxHeight: "calc(100vh - 24px)",
                overflowY: "auto",
                overflowX: "hidden",
                border: "1px solid #d6d6d6",
                borderRadius: 14,
                padding: navExpanded ? "12px 12px" : "12px 0",
                background: "#fff",
                transition: "width 200ms ease, min-width 200ms ease, padding 200ms ease",
              }}
            >
              {navExpanded ? (
                // Expanded — full text
                <>
                  {/* Hamburger — top of expanded nav */}
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                    <button
                      type="button"
                      onClick={() => setNavExpanded(v => !v)}
                      style={{
                        width: 32, height: 32,
                        border: "1px solid #d6d6d6",
                        borderRadius: 8,
                        background: "#fff",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                      }}
                    >
                      <div style={{ width: 14, height: 1.5, background: "#555", borderRadius: 2 }} />
                      <div style={{ width: 14, height: 1.5, background: "#555", borderRadius: 2 }} />
                      <div style={{ width: 14, height: 1.5, background: "#555", borderRadius: 2 }} />
                    </button>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.8, color: "#666", marginBottom: 10 }}>
                    INFORMATION
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <button type="button" style={navBtnStyle} onClick={() => scrollToId("mod1")}>MOD 1 — Building Summary</button>
                    <button type="button" style={navBtnStyle} onClick={() => scrollToId("mod2")}>MOD 2 — Heights & Areas</button>
                    <button type="button" style={navBtnStyle} onClick={() => scrollToId("mod3")}>MOD 3 — Building Analysis</button>
                  </div>

                  <div style={{ height: 12 }} />

                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.8, color: "#666", marginBottom: 10 }}>
                    CHECKLISTS
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <button type="button" style={navBtnStyle} onClick={() => scrollToId("ch3")}>CH 3 — Occupancy & Use</button>
                    <button type="button" style={navBtnStyle} onClick={() => scrollToId("ch4")}>CH 4 — Special Occupancy</button>
                    <button type="button" style={navBtnStyle} onClick={() => scrollToId("ch5")}>CH 5 — Heights & Areas</button>
                    <button type="button" style={navBtnStyle} onClick={() => scrollToId("ch6")}>CH 6 — Construction Type</button>
                    <button type="button" style={navBtnDisabledStyle} disabled>CH 7 — Fire-rated Assemblies</button>
                    <button type="button" style={navBtnDisabledStyle} disabled>CH 8 — Interior Finishes</button>
                    <button type="button" style={navBtnDisabledStyle} disabled>CH 9 — Fire Protection</button>
                    <button type="button" style={navBtnDisabledStyle} disabled>CH 10 — Means of Egress</button>
                    <button type="button" style={navBtnDisabledStyle} disabled>CH 11 — Accessibility</button>
                    <button type="button" style={navBtnDisabledStyle} disabled>CH 12 — Interior Environment</button>
                    <button type="button" style={navBtnDisabledStyle} disabled>CH 13 — Energy Efficiency</button>
                    <button type="button" style={navBtnDisabledStyle} disabled>CH 14 — Exterior Walls</button>
                    <button type="button" style={navBtnDisabledStyle} disabled>CH 15 — Roof Assemblies</button>
                    <button type="button" style={navBtnDisabledStyle} disabled>CH 16 — Structural Design</button>
                    <button type="button" style={navBtnDisabledStyle} disabled>CH 17 — Special Inspections</button>
                    <button type="button" style={navBtnDisabledStyle} disabled>CH 18 — Soils and Foundations</button>
                    <button type="button" style={navBtnDisabledStyle} disabled>CH 19 — Concrete</button>
                    <button type="button" style={navBtnDisabledStyle} disabled>CH 20 — Aluminum</button>
                    <button type="button" style={navBtnDisabledStyle} disabled>CH 21 — Masonry</button>
                    <button type="button" style={navBtnDisabledStyle} disabled>CH 22 — Steel</button>
                    <button type="button" style={navBtnDisabledStyle} disabled>CH 23 — Wood</button>
                    <button type="button" style={navBtnDisabledStyle} disabled>CH 24 — Glass and Glazing</button>
                    <button type="button" style={navBtnDisabledStyle} disabled>CH 25 — Gypsum and Plaster</button>
                    <button type="button" style={navBtnDisabledStyle} disabled>CH 26 — Plastic</button>
                    <button type="button" style={navBtnDisabledStyle} disabled>CH 27 — Electrical</button>
                    <button type="button" style={navBtnDisabledStyle} disabled>CH 28 — Mechanical Systems</button>
                    <button type="button" style={navBtnDisabledStyle} disabled>CH 29 — Plumbing Systems</button>
                    <button type="button" style={navBtnDisabledStyle} disabled>CH 30 — Elevator Systems</button>
                    <button type="button" style={navBtnDisabledStyle} disabled>CH 31 — Special Construction</button>
                    <button type="button" style={navBtnDisabledStyle} disabled>CH 32 — ROW Encroachments</button>
                    <button type="button" style={navBtnDisabledStyle} disabled>CH 33 — Construction Safeguards</button>
                  </div>
                </>
              ) : (
                // Collapsed — icon labels only
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  {/* Hamburger — top of collapsed nav */}
                  <button
                    type="button"
                    onClick={() => setNavExpanded(v => !v)}
                    style={{
                      width: 36, height: 36,
                      border: "1px solid #d6d6d6",
                      borderRadius: 8,
                      background: "#fff",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      marginBottom: 2,
                    }}
                  >
                    <div style={{ width: 14, height: 1.5, background: "#555", borderRadius: 2 }} />
                    <div style={{ width: 14, height: 1.5, background: "#555", borderRadius: 2 }} />
                    <div style={{ width: 14, height: 1.5, background: "#555", borderRadius: 2 }} />
                  </button>
                  {[
                    { label: "MOD 1", id: "mod1" },
                    { label: "MOD 2", id: "mod2" },
                    { label: "MOD 3", id: "mod3" },
                    { label: "CH 3",  id: "ch3"  },
                    { label: "CH 4",  id: "ch4"  },
                    { label: "CH 5",  id: "ch5"  },
                    { label: "CH 6",  id: "ch6"  },
                  ].map(({ label, id }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => scrollToId(id)}
                      style={{
                        width: 46,
                        height: 36,
                        border: "1px solid #d6d6d6",
                        borderRadius: 8,
                        background: "#fafafa",
                        cursor: "pointer",
                        fontSize: 9,
                        fontWeight: 800,
                        color: "#555",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 0,
                        letterSpacing: 0.3,
                      }}
                      title={label}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </nav>
          </div>

          {/* RIGHT COLUMN (all panels stacked) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    
            {/* Module 1 */}
            <div id="mod1" style={{ scrollMarginTop: 12 }}>
              <section style={cardStyle}>
                <div style={cardHeaderStyle}>
                  <div>
                    <div style={moduleTagStyle}>MOD 1</div>
                    <h2 style={cardTitleStyle}>Building Summary</h2>
                    <p style={{ margin: "4px 0 0", fontSize: 14, color: "#555", fontWeight: 400 }}>
                      This module contains general building information.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Reset the entire worksheet? All inputs will be cleared.")) {
                        localStorage.removeItem("ibc-worksheet-project-v2");
                        window.location.replace(window.location.href);
                      }
                    }}
                    style={{
                      border: "1px solid #cfcfcf",
                      borderRadius: 10,
                      padding: "6px 14px",
                      fontSize: 12,
                      fontWeight: 700,
                      background: "#fafafa",
                      color: "#333",
                      cursor: "pointer",
                      lineHeight: 1.3,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Reset<br />Worksheet
                  </button>
                </div>

                <div style={gridStyle}>
                  <Field 
                    label="Occupancy Groups" 
                    placeholder={occupancyGroups(project)} 
                    muted 
                    />
                  <Field
                    label="Stories Above Grade"
                    placeholder={String(countAboveStories(project))}
                    muted
                    hint={calc504.maxStories !== null ? {
                      text: `(${formatLimit(calc504.maxStories)} stories max.)`,
                      color: limitColor(countAboveStories(project), calc504.maxStories),
                    } : undefined}
                  />
                  <Field
                    label="Total Above-Grade Area"
                    placeholder={totalAboveGradeArea(project).toLocaleString()}
                    muted
                    hint={calc506.aaTotal !== null ? {
                      text: `(${formatLimit(calc506.aaTotal)} max.)`,
                      color: limitColor(totalAboveGradeArea(project), calc506.aaTotal),
                    } : undefined}
                  />

                  <SelectField
                    label="Construction Type"
                    value={project.m1.constructionType}
                    options={dropdownData.lists["Construction Type"] ?? []}
                    onChange={(v) => setProject((p) => ({ ...p, m1: { ...p.m1, constructionType: v } }))}
                  />
                  
                  <Field label="Stories Below Grade" placeholder={String(countBelowStories(project))} muted />
                  
                  <Field
                    label="Total Below-Grade Area"
                    placeholder={totalBelowGradeArea(project).toLocaleString()}
                    muted
                    hint={calc506.aaStory !== null && totalBelowGradeArea(project) > 0 ? {
                      text: `(${formatLimit(calc506.aaStory)} max.)`,
                      color: limitColor(totalBelowGradeArea(project), calc506.aaStory),
                    } : undefined}
                  />

                  <SelectField
                    label="Sprinklers"
                    value={project.m1.sprinklers}
                    options={dropdownData.lists["Fire Sprinklers"] ?? []}
                    placeholder="Select…"
                    onChange={(v) => setProject((p) => ({ ...p, m1: { ...p.m1, sprinklers: v } }))}
                  />
                  <FeetInchesInput
                    label="Building Height"
                    value={project.m1.buildingHeight}
                    onChange={(next) => setProject((p) => ({ ...p, m1: { ...p.m1, buildingHeight: next } }))}
                    hint={calc504.maxHeightFt !== null && project.m1.buildingHeight.feet !== null ? {
                      text: `(${formatAllowableHeight(calc504.maxHeightFt)} max.)`,
                      color: limitColor(project.m1.buildingHeight.feet, calc504.maxHeightFt),
                    } : undefined}
                  />
                  <Field
                    label="Highest Floor"
                    placeholder={highestFloorHeight ? formatFeetInches(highestFloorHeight) : "—"}
                    muted
                  />

                  <SelectField
                    label="Fire Alarm"
                    value={project.m1.fireAlarm}
                    options={dropdownData.lists["Fire Alarm"] ?? []}
                    placeholder="Select…"
                    onChange={(v) => setProject((p) => ({ ...p, m1: { ...p.m1, fireAlarm: v } }))}
                  />
                  
                  {hasGroupI && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>
                        Persons Receiving Care
                      </div>
                      <input
                        inputMode="numeric"
                        placeholder="# of custodial/medical/nursing/restraint"
                        value={project.m1.personsReceivingCare ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value.trim();
                          const n = raw === "" ? null : Math.max(0, Math.floor(Number(raw)));
                          setProject((p) => ({
                            ...p,
                            m1: { ...p.m1, personsReceivingCare: n },
                          }));
                        }}
                        style={{
                          border: "1px solid #cfcfcf",
                          borderRadius: 10,
                          padding: "6px 10px",
                          fontSize: 13,
                          background: "#fff",
                          color: "#111",
                          fontWeight: 500,
                          width: "100%",
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Height & Area Modifiers */}
                <div style={{ marginTop: 14, borderTop: "1px solid #e9e9e9", paddingTop: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#333", marginBottom: 8 }}>
                    Height & Area Modifiers
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {([
                      { key: "specialIndustrialOccupancy",  label: "Special Industrial Occupancy (503.1.1) — height and area exemption" },
                      { key: "oneStoryAircraftHangar",      label: "One-Story Aircraft Hangar (504.1) — height modifiers" },
                      { key: "unlimitedAreaBuilding",       label: "507 Unlimited Area Building — height and area modifiers" },
                      { key: "specialProvisions",           label: "510 Special Provisions (504.1.2) — height and area modifiers" },
                      { key: "rooftopStructures",           label: "1511 Rooftop Structures (504.3) — height modifier" },
                    ] as { key: keyof typeof project.m3; label: string }[]).map(({ key, label }) => (
                      <label
                        key={key}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 13,
                          color: "#333",
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                      >
                        <Checkbox
                          checked={project.m3[key] as boolean}
                          onChange={(checked) => setProject((p) => ({
                            ...p,
                            m3: { ...p.m3, [key]: checked },
                          }))}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </section>
            </div>

            {/* Module 2 */}
            <div id="mod2" style={{ scrollMarginTop: 12 }}>
              <section style={cardStyle}>
                <div style={cardHeaderStyle}>
                  <div>
                    <div style={moduleTagStyle}>MOD 2</div>
                    <h2 style={cardTitleStyle}>Building Heights & Areas</h2>
                    <p style={{ margin: "4px 0 0", fontSize: 14, color: "#555", fontWeight: 400 }}>
                      This module establishes building heights, areas, occupancies, and uses including mezzanines, accessory and mixed occupancies.
                    </p>
                  </div>
                </div>

                <div style={{ marginBottom: 8 }}>
                  <button
                    type="button"
                    onClick={() => setProject((p) => ({ ...p, m1: { ...p.m1, storiesAbove: p.m1.storiesAbove + 1 } }))}
                    style={{
                      border: "1px solid #cfcfcf",
                      borderRadius: 10,
                      padding: "6px 14px",
                      fontSize: 11,
                      fontWeight: 700,
                      background: "#fafafa",
                      color: "#333",
                      cursor: "pointer",
                      lineHeight: 1.4,
                      textAlign: "center" as const,
                    }}
                  >
                    + Add Story<br />Above Grade
                  </button>
                </div>

                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  border: "1px solid #d0d0d0",
                  borderRadius: 12,
                  overflow: "hidden",
                }}>
                  {project.stories.length === 0 ? (
                    <div style={{
                      padding: "14px 16px",
                      border: "1px solid #d0d0d0",
                      borderRadius: 12,
                      color: "#9ca3af",
                      fontSize: 13,
                      fontStyle: "italic",
                    }}>
                      Add stories using the buttons above.
                    </div>
                  ) : (
                    project.stories.map((story) => {
                      const isCollapsed = collapsedStories.has(story.id);
                      const storyLabel = ordinalStoryLabel(story);
                      const storyOccupancies = Array.from(new Set(
                        story.areas
                          .filter(a => a.occupancy && a.mixedUse !== "Accessory Use")
                          .map(a => a.occupancy.replace(/^Group\s+/i, ""))
                      )).join(", ");
                      const storyTotal = sumStorySqftFiltered(story);
                      const ct = mapConstructionType(project.m1.constructionType);
                      const storiesAbove = countAboveStories(project);
                      const spk = mapSprinklerTag(project.m1.sprinklers, storiesAbove);
                      const totalBelowArea = story.kind === "below"
                        ? project.stories
                            .filter(s => s.kind === "below")
                            .reduce((sum, s) => sum + sumStorySqftFiltered(s), 0)
                        : null;

                      const areaComplies = calc506.aaStory === null ? null
                        : calc506.aaStory === "UL" ? true
                        : calc506.aaStory === "NP" ? false
                        : story.kind === "below"
                          ? (totalBelowArea ?? 0) <= (calc506.aaStory as number)
                          : storyTotal <= (calc506.aaStory as number);
                      const areaColor = areaComplies === null ? "#9ca3af" : areaComplies ? "#16a34a" : "#dc2626";

                      return (
                        <div key={story.id} style={{
                          borderBottom: "1px solid #d0d0d0",
                          borderTop: (() => {
                            const idx = project.stories.indexOf(story);
                            const prev = project.stories[idx - 1];
                            if (story.kind === "below" && (!prev || prev.kind === "above")) {
                              return "3px solid #333";
                            }
                            return "none";
                          })(),
                        }}>
                          {/* Story Header */}
                          <div
                            onClick={() => toggleStoryCollapsed(story.id)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "5px 10px",
                              background: story.kind === "below" ? "#e0e0e0" : "#ebebeb",
                              borderBottom: isCollapsed ? "none" : "1px solid #d0d0d0",
                              flexWrap: "nowrap",
                              cursor: "pointer",
                              userSelect: "none",
                            }}>
                            {/* Chevron */}
                            <div style={{
                              fontSize: 11,
                              color: "#666",
                              transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                              transition: "transform 120ms ease",
                              flexShrink: 0,
                            }}>▼</div>

                            {/* Story label */}
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#111", flexShrink: 0 }}>
                              {storyLabel}
                            </div>

                            {/* Story controls */}
                            <div
                              style={{ display: "flex", gap: 6, flexShrink: 0 }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                style={miniBtnStyle}
                                onClick={() => removeStory(story.id)}
                              >
                                - Story
                              </button>
                              <button
                                type="button"
                                style={miniBtnStyle}
                                onClick={() => addArea(story.id)}
                                disabled={story.areas.length >= 6}
                              >
                                + Area
                              </button>
                            </div>

                            {/* Spacer */}
                            <div style={{ flex: 1 }} />

                            {/* Right side info — occupancies, floor height, total area */}
                            <div
                              style={{ display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}
                              onClick={(e) => e.stopPropagation()}
                            >

                            {/* Occupancies */}
                            {storyOccupancies && (
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <span style={{ fontSize: 11, color: "#888" }}>Occupancies:</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: "#555" }}>{storyOccupancies}</span>
                              </div>
                            )}

                            {/* Floor Height — no outer box */}
                            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                              <span style={{ fontSize: 11, color: "#888" }}>Floor Height:</span>
                              <NumBox
                                placeholder="ft"
                                value={story.floorHeight?.feet ?? null}
                                onChange={(v) => setProject(p => ({
                                  ...p,
                                  stories: p.stories.map(s => s.id !== story.id ? s : {
                                    ...s,
                                    floorHeight: { ...(s.floorHeight ?? { feet: null, inches: null }), feet: v }
                                  })
                                }))}
                                min={0}
                                subtle
                              />
                              <span style={{ fontSize: 11, color: "#555" }}>ft</span>
                              <NumBox
                                placeholder="in"
                                value={story.floorHeight?.inches ?? null}
                                onChange={(v) => setProject(p => ({
                                  ...p,
                                  stories: p.stories.map(s => s.id !== story.id ? s : {
                                    ...s,
                                    floorHeight: { ...(s.floorHeight ?? { feet: null, inches: null }), inches: v }
                                  })
                                }))}
                                min={0}
                                max={11}
                                subtle
                              />
                              <span style={{ fontSize: 11, color: "#555" }}>in</span>
                              <span style={{ fontSize: 11, color: "#9ca3af" }}>
                                ({formatFeetInches(story.floorHeight ?? { feet: null, inches: null })})
                              </span>
                            </div>

                            {/* Total Story Area */}
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <span style={{ fontSize: 11, color: "#888" }}>Total Story Area:</span>
                                <div style={{
                                  border: `1px solid ${areaColor}`,
                                  borderRadius: 6,
                                  padding: "3px 10px",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: areaColor,
                                  background: "#fff",
                                  minWidth: 60,
                                  textAlign: "center",
                                }}>
                                  {storyTotal.toLocaleString()}
                                </div>
                              </div>
                              {calc506.aaStory !== null && (
                                <div style={{ fontSize: 10, color: areaColor, marginTop: 1 }}>
                                  ({formatLimit(calc506.aaStory)} max)
                                </div>
                              )}
                            </div>

                            </div> {/* end right side info */}
                          </div>

                          {/* Area rows */}
                          {!isCollapsed && (
                            <div style={{ padding: "6px 20px", background: story.kind === "below" ? "#f3f3f3" : "#fafafa" }}>
                              {story.areas.length === 0 ? (
                                <div style={{
                                  padding: "8px 0",
                                  fontSize: 12,
                                  color: "#9ca3af",
                                  fontStyle: "italic",
                                }}>
                                  No areas — use + Area to add one.
                                </div>
                              ) : (
                                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 860, tableLayout: "fixed" }}>
                                  <colgroup>
                                    <col style={{ width: 50 }} />
                                    <col style={{ width: 160 }} />
                                    <col style={{ width: 200 }} />
                                    <col style={{ width: 160 }} />
                                    <col style={{ width: 140 }} />
                                    <col style={{ width: 90 }} />
                                    <col style={{ width: 50 }} />
                                    <col style={{ width: 80 }} />
                                  </colgroup>
                                  <thead>
                                    <tr style={{ borderBottom: "1px solid #efefef", background: "#fafafa" }}>
                                      {["Area", "Occupancy", "Use", "Description", "Mixed-Use", "Sq Ft", "%", "Control"].map((h, i) => (
                                        <th key={h} style={{
                                          padding: "2px 8px",
                                          fontSize: 10,
                                          fontWeight: 600,
                                          color: "#aaa",
                                          textAlign: i === 0 || i === 5 || i === 6 || i === 7 ? "center" : "left",
                                          whiteSpace: "nowrap",
                                          borderBottom: "1px solid #efefef",
                                          background: "#fafafa",
                                        }}>{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {story.areas.map((area) => {
                                      const occOptions = dropdownData.lists["Occupancy"] ?? [];
                                      const useOptions = dropdownData.usesByOccupancy[area.occupancy] ?? [];
                                      const mixedUseOptions = dropdownData.lists["Mixed Use"] ?? [];
                                      const conditionOptions = getConditionOptions(area.occupancy);
                                      const storyTotalForPct = story.areas.reduce((s, a) => s + (a.sqft ?? 0), 0);

                                      return (
                                        <tr key={area.areaNo} style={{ borderBottom: "1px solid #efefef" }}>
                                          <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>
                                            {area.areaNo}
                                          </td>
                                          <td style={{ ...tdStyle, minWidth: 140 }}>
                                            <TableSelect
                                              value={area.occupancy}
                                              options={occOptions}
                                              placeholder="Occupancy…"
                                              onChange={(v) => onOccupancyChange(story.id, area.areaNo, v)}
                                            />
                                            {conditionOptions.length > 0 && (
                                              <div style={{ marginTop: 3 }}>
                                                <TableSelect
                                                  value={conditionOptions.find(c => c.tag === area.occupancyCondition)?.label ?? ""}
                                                  options={conditionOptions.map(c => c.label)}
                                                  placeholder="Condition…"
                                                  onChange={(v) => {
                                                    const match = conditionOptions.find(c => c.label === v);
                                                    updateArea(story.id, area.areaNo, { occupancyCondition: match?.tag ?? "" });
                                                  }}
                                                />
                                              </div>
                                            )}
                                          </td>
                                          <td style={{ ...tdStyle, minWidth: 120 }}>
                                            <TableSelect
                                              value={area.use}
                                              options={useOptions}
                                              placeholder={area.occupancy ? "Use…" : "Select occupancy first"}
                                              disabled={!area.occupancy}
                                              onChange={(v) => updateArea(story.id, area.areaNo, { use: v })}
                                            />
                                          </td>
                                          <td style={{ ...tdStyle, minWidth: 120 }}>
                                            <TableTextInput
                                              value={area.description}
                                              placeholder="Description…"
                                              onChange={(v) => updateArea(story.id, area.areaNo, { description: v })}
                                            />
                                          </td>
                                          <td style={{ ...tdStyle, minWidth: 120 }}>
                                            <TableSelect
                                              value={area.mixedUse}
                                              options={mixedUseOptions}
                                              placeholder="Mixed Use…"
                                              onChange={(v) => updateArea(story.id, area.areaNo, { mixedUse: v })}
                                            />
                                          </td>
                                          <td style={{ ...tdRightStyle }}>
                                            <TableNumberInput
                                              value={area.sqft}
                                              placeholder="Sq Ft"
                                              onChange={(v) => updateArea(story.id, area.areaNo, { sqft: v })}
                                            />
                                          </td>
                                          <td style={{ ...tdRightStyle }}>
                                            <span style={{ color: "#333", fontWeight: 600 }}>
                                              {storyTotalForPct > 0 && area.sqft
                                                ? `${((area.sqft / storyTotalForPct) * 100).toFixed(1)}%`
                                                : "—"}
                                            </span>
                                          </td>
                                          <td style={{ ...tdStyle, textAlign: "center" }}>
                                            <TableAction
                                              label="– Area"
                                              onClick={() => deleteAreaRow(story.id, area.areaNo as 2 | 3 | 4 | 5 | 6)}
                                            />
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setProject((p) => ({ ...p, m1: { ...p.m1, storiesBelow: p.m1.storiesBelow + 1 } }))}
                    style={{
                      border: "1px solid #cfcfcf",
                      borderRadius: 10,
                      padding: "6px 14px",
                      fontSize: 11,
                      fontWeight: 700,
                      background: "#fafafa",
                      color: "#333",
                      cursor: "pointer",
                      lineHeight: 1.4,
                      textAlign: "center" as const,
                    }}
                  >
                    + Add Story<br />Below Grade
                  </button>
                </div>
              </section>
            </div>

            {/* Module 3 */}
            <div id="mod3" style={{ scrollMarginTop: 12 }}>
              <section style={cardStyle}>
                <div style={cardHeaderStyle}>
                  <div>
                    <div style={moduleTagStyle}>MOD 3</div>
                    <h2 style={cardTitleStyle}>Chapter 5: Height & Area Analysis</h2>
                    <p style={{ margin: "4px 0 0", fontSize: 14, color: "#555", fontWeight: 400 }}>
                      This module analyzes building heights, areas, and related requirements under IBC Chapter 5.
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <CollapsiblePanel
                    title="Building Height and Stories (504)"
                    description="This panel determines the maximum allowable building height and stories."
                    summarySlot={(() => {
                      const ct = mapConstructionType(project.m1.constructionType);
                      const storiesAbove = countAboveStories(project);
                      const spk = mapSprinklerTag(project.m1.sprinklers, storiesAbove);
                      const occKeys = Array.from(new Set(
                        project.stories.flatMap(s => s.areas.map(a =>
                          a.occupancyCondition ? a.occupancyCondition as OccupancyKey : mapOccupancyKey(a.occupancy)
                        )).filter((k): k is OccupancyKey => k !== null)
                      ));
                      const maxH = ct && occKeys.length > 0 ? getMostRestrictiveLimit(occKeys.map(o => getMaxHeightFt(o, ct, spk))) : null;
                      const maxS = ct && occKeys.length > 0 ? getMostRestrictiveLimit(occKeys.map(o => getMaxStories(o, ct, spk))) : null;
                      const actualFt = project.m1.buildingHeight.feet;
                      const actualStories = countAboveStories(project);
                      const heightColor = actualFt !== null && maxH !== null ? limitColor(actualFt, maxH) : "#9ca3af";
                      const storiesColor = maxS !== null ? limitColor(actualStories, maxS) : "#9ca3af";
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 12, color: "#555" }}>Max. Height Allowed:</span>
                            <div style={{
                              border: `1px solid ${heightColor}`,
                              borderRadius: 6,
                              padding: "2px 10px",
                              fontSize: 12,
                              fontWeight: 700,
                              color: heightColor,
                              minWidth: 70,
                              textAlign: "center",
                              background: "#fff",
                            }}>
                              {maxH !== null ? formatAllowableHeight(maxH) : "—"}
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 12, color: "#555" }}>Max. Stories Allowed:</span>
                            <div style={{
                              border: `1px solid ${storiesColor}`,
                              borderRadius: 6,
                              padding: "2px 10px",
                              fontSize: 12,
                              fontWeight: 700,
                              color: storiesColor,
                              minWidth: 70,
                              textAlign: "center",
                              background: "#fff",
                            }}>
                              {maxS !== null ? formatLimit(maxS) : "—"}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    collapsed={project.m3.panel504Collapsed}
                    onToggle={() => setProject((p) => ({
                      ...p,
                      m3: { ...p.m3, panel504Collapsed: !p.m3.panel504Collapsed },
                    }))}
                  >
                    <>{(() => {
                      const ct = calc504.ct;
                      const spk = calc504.spk;
                      const occEntries = calc504.occEntries;
                      const occupiedRoofRows = calc504.occupiedRoofRows;
                      const activeModifiers = calc504.activeModifiers;
                      const heightColor = calc504.heightComplies === "complies" ? "#16a34a" : calc504.heightComplies === "fails" ? "#dc2626" : undefined;
                      const storiesColor = calc504.storiesComplies === "complies" ? "#16a34a" : calc504.storiesComplies === "fails" ? "#dc2626" : undefined;

return (
  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

    {/* Info table */}
    <PanelInfoTable cells={[
      { label: "Const. Type", value: calc504.ctLabel },
      { label: "Sprinklers", value: calc504.spkLabel },
      { label: "Fire Alarm", value: project.m1.fireAlarm || "—" },
      { label: "Stories", value: String(calc504.actualStories), color: storiesColor },
      { label: "Height", value: calc504.actualHeightFt !== null ? formatFeetInches(project.m1.buildingHeight) : "—", color: heightColor },
    ]} />

    {/* 40/60 grid */}
    <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 40%) 1fr", gap: 24 }}>
    {/* Left column — tables */}
    <div style={{ minWidth: 0 }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>
          Height and Stories (504.3 & 504.4)
        </div>
      </div>

      {/* Per-occupancy table */}
      {occEntries.length > 0 && ct ? (
        <table style={{ borderCollapse: "collapse", width: "auto", marginBottom: 16 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #d0d0d0" }}>
              <th style={{ ...thStyle, textAlign: "center" }}>Occupancy</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Allowable Height</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Allowable Stories</th>
            </tr>
          </thead>
          <tbody>
            {occEntries.map(([key, rawOcc]) => {
              const h = getMaxHeightFt(key, ct, spk);
              const s = getMaxStories(key, ct, spk);
              const displayOcc = rawOcc.replace(/^Group\s+/i, "");
              return (
                <tr key={key} style={{ borderBottom: "1px solid #efefef" }}>
                  <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>{displayOcc}</td>
                  <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>{formatAllowableHeight(h)}</td>
                  <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>{formatLimit(s)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 16 }}>
          Add occupancies and construction type in Modules 1 & 2 to see results.
        </div>
      )}

      {/* Occupiable Roofs */}
      {occupiedRoofRows.length > 0 && (
        <>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 8 }}>
            Occupiable Roofs (503.1.4)
          </div>
          <table style={{ borderCollapse: "collapse", width: "auto" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #d0d0d0" }}>
                <th style={{ ...thStyle, textAlign: "center" }}>Story</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Rooftop Occupancies</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Sq Ft</th>
              </tr>
            </thead>
            <tbody>
              {occupiedRoofRows.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid #efefef" }}>
                  <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>{row.storyId}</td>
                  <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>{row.occupancy}</td>
                  <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>
                    {row.sqft !== null ? row.sqft.toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>

    {/* Right column — modifiers */}
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {activeModifiers.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 8 }}>
            Height Modifiers:
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {activeModifiers.map((mod) => (
              <div key={mod.noteKey}>
                <div style={{ fontSize: 13, color: "#333", marginBottom: 4 }}>
                  {mod.label}
                </div>
                <input
                  type="text"
                  placeholder="Notes..."
                  value={project.m3[mod.noteKey] as string}
                  onChange={(e) => setProject((p) => ({
                    ...p,
                    m3: { ...p.m3, [mod.noteKey]: e.target.value },
                  }))}
                  style={{
                    width: "100%",
                    border: "1px solid #cfcfcf",
                    borderRadius: 8,
                    padding: "5px 8px",
                    fontSize: 12,
                    color: "#333",
                    background: "#fff",
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>  {/* end 40/60 grid */}
  </div>  
  );})()}</>
                  </CollapsiblePanel>

                  <CollapsiblePanel
                    title="Mezzanines and Equipment Platforms (505)"
                    description="This panel determines the requirements for mezzanines and equipment platforms."
                    summarySlot={(() => {
                      const mezzRows = project.stories.flatMap(s =>
                        s.areas.filter(a => a.mixedUse === "Mezzanine")
                      );
                      const epRows = project.stories.flatMap(s =>
                        s.areas.filter(a => a.mixedUse === "Equipment Platform")
                      );
                      if (mezzRows.length === 0 && epRows.length === 0) {
                        return <div style={{ fontSize: 12, color: "#999" }}>No mezzanines or equipment platforms designated.</div>;
                      }
                      const ct = project.m1.constructionType;
                      const isTypeIorII = ct.startsWith("Type I-") || ct.startsWith("Type II-");
                      const isNFPA13 = project.m1.sprinklers === "NFPA 13";
                      const isNFPA13orR = isNFPA13 || project.m1.sprinklers === "NFPA 13R";
                      const isEmVoice = project.m1.fireAlarm === "Emergency Voice/Alarm";
                      const isSpecialInd = project.m3.specialIndustrialOccupancy;

                      const getMezzMax = (occ: string) => {
                        if (isTypeIorII && isSpecialInd) return 2/3;
                        if (isTypeIorII && isNFPA13 && isEmVoice) return 0.5;
                        if (occ.startsWith("Group R") && isNFPA13orR) return 0.5;
                        return 1/3;
                      };

                      const mezzMeets = mezzRows.every(a => {
                        if (!a.openRoomSqft || !a.sqft) return true;
                        return a.sqft / a.openRoomSqft <= getMezzMax(a.occupancy);
                      });
                      const epMeets = epRows.every(a => {
                        if (!a.openRoomSqft || !a.sqft) return true;
                        return a.sqft / a.openRoomSqft <= 2/3;
                      });

                      const resultBox = (label: string, meets: boolean, hasRows: boolean) => hasRows ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, color: "#555" }}>{label}:</span>
                          <div style={{
                            border: `1px solid ${meets ? "#16a34a" : "#dc2626"}`,
                            borderRadius: 6,
                            padding: "2px 10px",
                            fontSize: 12,
                            fontWeight: 700,
                            color: meets ? "#16a34a" : "#dc2626",
                            minWidth: 70,
                            textAlign: "center" as const,
                            background: "#fff",
                          }}>
                            {meets ? "Meets" : "Exceeds"}
                          </div>
                        </div>
                      ) : null;

                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                          {resultBox("Mezzanines", mezzMeets, mezzRows.length > 0)}
                          {resultBox("Equipment Platforms", epMeets, epRows.length > 0)}
                        </div>
                      );
                    })()}
                    collapsed={project.m3.panel505Collapsed}
                    onToggle={() => setProject((p) => ({
                      ...p,
                      m3: { ...p.m3, panel505Collapsed: !p.m3.panel505Collapsed },
                    }))}
                  >
                    {(() => {
                      const ct = project.m1.constructionType;
                      const isTypeIorII = ct.startsWith("Type I-") || ct.startsWith("Type II-");
                      const isNFPA13 = project.m1.sprinklers === "NFPA 13";
                      const isNFPA13orR = isNFPA13 || project.m1.sprinklers === "NFPA 13R";
                      const isEmVoice = project.m1.fireAlarm === "Emergency Voice/Alarm";
                      const isSpecialInd = project.m3.specialIndustrialOccupancy;
                      const spkLabel = project.m1.sprinklers || "—";
                      const ctLabel = project.m1.constructionType || "—";
                      const fireAlarmLabel = project.m1.fireAlarm || "—";

                      const getMezzMax = (occ: string): number => {
                        if (isTypeIorII && isSpecialInd) return 2/3;
                        if (isTypeIorII && isNFPA13 && isEmVoice) return 0.5;
                        if (occ.startsWith("Group R") && isNFPA13orR) return 0.5;
                        return 1/3;
                      };

                      const formatPct = (n: number) => `${(n * 100).toFixed(1)}%`;

                      // Collect mezzanine and equipment platform rows
                      const mezzRows = project.stories.flatMap(s =>
                        s.areas
                          .filter(a => a.mixedUse === "Mezzanine")
                          .map(a => ({ story: s, area: a }))
                      );
                      const epRows = project.stories.flatMap(s =>
                        s.areas
                          .filter(a => a.mixedUse === "Equipment Platform")
                          .map(a => ({ story: s, area: a }))
                      );

                      // Check if any story-area has both mezzanine and equipment platform
                      const storyAreaIds = new Set(mezzRows.map(r => `${r.story.id}`));
                      const hasCombined = epRows.some(r => storyAreaIds.has(r.story.id));

                      // Auto-notes
                      const autoNotes: string[] = [];
                      if (mezzRows.length > 0) {
                        autoNotes.push("Total mezzanine area shall not exceed one-third of the room's open floor area. (505.2.1)");
                        if (isTypeIorII && isSpecialInd)
                          autoNotes.push("Total mezzanine area shall not exceed two-thirds of the room's open floor area in Type I or II, Special Industrial Occupancies. (505.2.1, Exc 1)");
                        if (isTypeIorII && isNFPA13 && isEmVoice)
                          autoNotes.push("Total mezzanine area shall not exceed one-half of the room's open floor area in buildings with NFPA 13 sprinklers and Emergency Voice/Alarm systems. (505.2.1, Exc 2)");
                        if (mezzRows.some(r => r.area.occupancy.startsWith("Group R")) && isNFPA13orR)
                          autoNotes.push("Total mezzanine area shall not exceed one-half of the room's open floor area in Group R dwelling units with NFPA 13 or NFPA 13R sprinklers. (505.2.1, Exc 3)");
                      }
                      if (epRows.length > 0)
                        autoNotes.push("Total equipment platform area shall not exceed two-thirds of the room's open floor area. (505.3.1)");
                      if (hasCombined)
                        autoNotes.push("Total combined mezzanine and equipment platform area shall not exceed two-thirds of the room's open floor area. The mezzanine portion cannot exceed the max allowed. (505.2.1.1)");

                      const mutedText: React.CSSProperties = { color: "#9ca3af", fontSize: 13 };
                      const infoBox = (value: string): React.CSSProperties => ({
                        border: "1px solid #d6d6d6",
                        borderRadius: 6,
                        padding: "2px 10px",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#9ca3af",
                        background: "#fafafa",
                        minWidth: 60,
                        textAlign: "center" as const,
                      });

                      const allRows = [...mezzRows, ...epRows];
                      if (allRows.length === 0) {
                        return (
                          <div style={{ fontSize: 13, color: "#9ca3af" }}>
                            No mezzanines or equipment platforms designated in Module 2.
                          </div>
                        );
                      }

                      const mezzTotal = project.stories.flatMap(s => s.areas).filter(a => a.mixedUse === "Mezzanine").reduce((sum, a) => sum + (a.sqft ?? 0), 0);
                      const equipTotal = project.stories.flatMap(s => s.areas).filter(a => a.mixedUse === "Equipment Platform").reduce((sum, a) => sum + (a.sqft ?? 0), 0);

                      return (
                          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            {/* Info table */}
                            <PanelInfoTable cells={[
                              { label: "Const. Type", value: calc504.ctLabel },
                              { label: "Sprinklers", value: calc504.spkLabel },
                              { label: "Fire Alarm", value: project.m1.fireAlarm || "—" },
                              { label: "Stories", value: String(calc504.actualStories) },
                              { label: "Mezz. Area", value: mezzTotal > 0 ? mezzTotal.toLocaleString() : "—", color: mezzTotal > 0 ? "#16a34a" : undefined },
                              { label: "Equip. Plat.", value: equipTotal > 0 ? equipTotal.toLocaleString() : "—", color: equipTotal > 0 ? "#16a34a" : undefined },
                            ]} />
                            {/* Row 1 — title/notes (40%) + info bar (60%) */}
                            <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 40%) 1fr", gap: 24 }}>
                              {/* Left: sub-section title + auto-notes */}
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 10 }}>
                                  Mezzanines (505.2) and Equipment Platforms (505.3)
                                </div>
                                {autoNotes.length > 0 && (
                                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                    {autoNotes.map((note, i) => (
                                      <div key={i} style={{ fontSize: 12, color: "#9ca3af", fontStyle: "italic" }}>
                                        {note}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Right: info bar — now in PanelInfoTable above */}
                              <div />
                            </div>

                            {/* Row 2 — full width table */}
                            <div>
                              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                              <thead>
                                <tr style={{ borderBottom: "1px solid #d0d0d0" }}>
                                  <th style={{ ...thStyle, textAlign: "center" }}>Story-Area</th>
                                  <th style={{ ...thStyle, textAlign: "center" }}>Occupancy</th>
                                  <th style={{ ...thStyle, textAlign: "center" }}>Type</th>
                                  <th style={{ ...thStyle, textAlign: "center" }}>Open Room (Sq Ft)</th>
                                  <th style={{ ...thStyle, textAlign: "center" }}>Mezzanine (Sq Ft)</th>
                                  <th style={{ ...thStyle, textAlign: "center" }}>Equip. Platform (Sq Ft)</th>
                                  <th style={{ ...thStyle, textAlign: "center" }}>Total %</th>
                                  <th style={{ ...thStyle, textAlign: "center" }}>Max % Allowed</th>
                                </tr>
                              </thead>
                              <tbody>
                                {allRows.map(({ story, area }, idx) => {
                                  const isMezz = area.mixedUse === "Mezzanine";
                                  const maxPct = isMezz ? getMezzMax(area.occupancy) : 2/3;
                                  const sqft = area.sqft ?? 0;
                                  const openRoom = area.openRoomSqft;
                                  const totalPct = openRoom && openRoom > 0 ? sqft / openRoom : null;
                                  const meets = totalPct !== null ? totalPct <= maxPct : true;
                                  const pctColor = totalPct !== null ? (meets ? "#16a34a" : "#dc2626") : "#9ca3af";
                                  const displayOcc = area.occupancy.replace(/^Group\s+/i, "");
                                  const storyArea = `${story.id}-${area.areaNo}`;

                                  return (
                                    <tr key={idx} style={{ borderBottom: "1px solid #efefef" }}>
                                      <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>{storyArea}</td>
                                      <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>{displayOcc || "—"}</td>
                                      <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>{area.mixedUse}</td>
                                      <td style={{ ...tdStyle, textAlign: "center" }}>
                                        <TableNumberInput
                                          value={area.openRoomSqft}
                                          placeholder="Sq Ft"
                                          onChange={(v) => updateArea(story.id, area.areaNo, { openRoomSqft: v })}
                                        />
                                      </td>
                                      <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>
                                        {isMezz ? (sqft > 0 ? sqft.toLocaleString() : "—") : "—"}
                                      </td>
                                      <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>
                                        {!isMezz ? (sqft > 0 ? sqft.toLocaleString() : "—") : "—"}
                                      </td>
                                      <td style={{ ...tdStyle, textAlign: "center" }}>
                                        <div style={{
                                          display: "inline-block",
                                          padding: "2px 8px",
                                          borderRadius: 6,
                                          border: `1px solid ${pctColor}`,
                                          color: pctColor,
                                          fontWeight: 700,
                                          fontSize: 12,
                                          background: "#fff",
                                        }}>
                                          {totalPct !== null ? formatPct(totalPct) : "—"}
                                        </div>
                                      </td>
                                      <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>
                                        {formatPct(maxPct)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            </div>
                          </div>
                      );
                    })()}
                  </CollapsiblePanel>

                  <CollapsiblePanel
                    title="Building Area (506)"
                    description="This panel determines the maximum allowable building areas."
                    summarySlot={(() => {
                      const calc = computeArea506(project);
                      const storyColor = calc.storyComplies === "complies" ? "#16a34a" : calc.storyComplies === "fails" ? "#dc2626" : "#9ca3af";
                      const totalColor = calc.totalComplies === "complies" ? "#16a34a" : calc.totalComplies === "fails" ? "#dc2626" : "#9ca3af";
                      const fmtArea = (v: number | "UL" | "NP" | null) =>
                        v === null ? "—" : v === "UL" ? "Unlimited" : v === "NP" ? "Not Permitted" : Math.round(v as number).toLocaleString();
                      const summaryBox = (label: string, value: string, color: string) => (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, color: "#555" }}>{label}:</span>
                          <div style={{
                            border: `1px solid ${color}`,
                            borderRadius: 6,
                            padding: "2px 10px",
                            fontSize: 12,
                            fontWeight: 700,
                            color,
                            minWidth: 80,
                            textAlign: "center" as const,
                            background: "#fff",
                          }}>{value}</div>
                        </div>
                      );
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                          {summaryBox("Story Allowable Area", fmtArea(calc.aaStory), storyColor)}
                          {summaryBox("Total Allowable Area", fmtArea(calc.aaTotal), totalColor)}
                        </div>
                      );
                    })()}
                    collapsed={project.m3.panel506Collapsed}
                    onToggle={() => setProject((p) => ({
                      ...p,
                      m3: { ...p.m3, panel506Collapsed: !p.m3.panel506Collapsed },
                    }))}
                  >
                    {(() => {
                      const calc = computeArea506(project);
                      const fr = computeFrontage(project.m3.frontage);
                      const spkLabel = project.m1.sprinklers || "—";
                      const ctLabel = project.m1.constructionType || "—";
                      const storiesLabel = String(calc.storiesAbove);
                      const fmtArea = (v: number | "UL" | "NP" | null) =>
                        v === null ? "—" : v === "UL" ? "Unlimited" : v === "NP" ? "Not Permitted" : Math.round(v as number).toLocaleString();
                      const storyColor = calc.storyComplies === "complies" ? "#16a34a" : calc.storyComplies === "fails" ? "#dc2626" : "#9ca3af";
                      const totalColor = calc.totalComplies === "complies" ? "#16a34a" : calc.totalComplies === "fails" ? "#dc2626" : "#9ca3af";

                      const mutedText: React.CSSProperties = { color: "#9ca3af", fontSize: 13 };
                      const infoBox = (value: string, color?: string): React.CSSProperties => ({
                        border: `1px solid ${color ?? "#d6d6d6"}`,
                        borderRadius: 6,
                        padding: "2px 10px",
                        fontSize: 12,
                        fontWeight: 600,
                        color: color ?? "#9ca3af",
                        background: "#fafafa",
                        minWidth: 60,
                        textAlign: "center" as const,
                      });

                      // Active area modifiers
                      const activeModifiers: { label: string; noteKey: keyof typeof project.m3 }[] = [];
                      if (project.m3.specialIndustrialOccupancy)
                        activeModifiers.push({ label: "Special Industrial Occupancy (503.1.1)", noteKey: "specialIndustrialOccupancyNote" });
                      if (project.m3.unlimitedAreaBuilding)
                        activeModifiers.push({ label: "507 Unlimited Area Building", noteKey: "unlimitedAreaBuildingNote" });
                      if (project.m3.specialProvisions)
                        activeModifiers.push({ label: "510 Special Provisions (504.1.2)", noteKey: "specialProvisionsNote" });

                      const segInput = (dir: keyof Omit<FrontageState, "useInterpolated">, label: string) => {
                        const seg = project.m3.frontage[dir] as FrontageSegment;
                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>{label}</div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <div style={{ fontSize: 11, color: "#9ca3af" }}>Perimeter Length</div>
                                <TableNumberInput
                                  value={seg.perimeterLength}
                                  placeholder="ft"
                                  onChange={(v) => setProject((p) => ({
                                    ...p,
                                    m3: {
                                      ...p.m3,
                                      frontage: {
                                        ...p.m3.frontage,
                                        [dir]: { ...(p.m3.frontage[dir] as FrontageSegment), perimeterLength: v },
                                      },
                                    },
                                  }))}
                                />
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <div style={{ fontSize: 11, color: "#9ca3af" }}>Frontage Width</div>
                                <TableNumberInput
                                  value={seg.frontageWidth}
                                  placeholder="ft"
                                  onChange={(v) => setProject((p) => ({
                                    ...p,
                                    m3: {
                                      ...p.m3,
                                      frontage: {
                                        ...p.m3.frontage,
                                        [dir]: { ...(p.m3.frontage[dir] as FrontageSegment), frontageWidth: v },
                                      },
                                    },
                                  }))}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      };

                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                          {/* Info table */}
                          <PanelInfoTable cells={[
                            { label: "Const. Type", value: calc504.ctLabel },
                            { label: "Sprinklers", value: spkLabel },
                            { label: "Fire Alarm", value: project.m1.fireAlarm || "—" },
                            { label: "Stories", value: storiesLabel },
                            { label: "Basement Area", value: calc.totalBelow > 0 ? calc.totalBelow.toLocaleString() : "—", color: calc.totalBelow > 0 ? calc.basementColor : undefined },
                            { label: "Largest Story", value: calc.largestStory > 0 ? calc.largestStory.toLocaleString() : "—", color: calc.largestStory > 0 ? storyColor : undefined },
                            { label: "Building Area", value: calc.totalAbove > 0 ? calc.totalAbove.toLocaleString() : "—", color: calc.totalAbove > 0 ? totalColor : undefined },
                          ]} />

                          {/* Row 1 — 40/60 grid: occupancy table | modifiers */}
    <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 40%) 1fr", gap: 24 }}>

      {/* Left — occupancy table */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 10 }}>
          Allowable Area (506.2)
        </div>
        {calc.occRows.length > 0 ? (
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #d0d0d0" }}>
                <th style={{ ...thStyle, textAlign: "center" }}>Occupancy</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Tabular Area (At)</th>
                <th style={{ ...thStyle, textAlign: "center" }}>NS Area</th>
              </tr>
            </thead>
            <tbody>
              {calc.occRows
                .slice()
                .sort((a, b) => {
                  if (a.at === "NP") return -1;
                  if (b.at === "NP") return 1;
                  if (a.at === "UL") return 1;
                  if (b.at === "UL") return -1;
                  if (typeof a.at === "number" && typeof b.at === "number") return a.at - b.at;
                  return 0;
                })
                .map((row) => {
                  const isMostRestrictive = row.key === calc.mostRestrictiveKey;
                  return (
                    <tr key={row.key} style={{
                      borderBottom: "1px solid #efefef",
                      background: isMostRestrictive ? "#fef9c3" : "transparent",
                    }}>
                      <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af", fontWeight: isMostRestrictive ? 700 : 400 }}>{row.displayName}</td>
                      <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af", fontWeight: isMostRestrictive ? 700 : 400 }}>{fmtArea(row.at)}</td>
                      <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af", fontWeight: isMostRestrictive ? 700 : 400 }}>{fmtArea(row.ns)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        ) : (
          <div style={{ fontSize: 13, color: "#9ca3af" }}>
            Add occupancies in Module 2 to see results.
          </div>
        )}
      </div>

      {/* Right — modifiers only, info now in PanelInfoTable */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {activeModifiers.length > 0 && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 8 }}>
              Area Modifiers:
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {activeModifiers.map((mod) => (
                <div key={mod.noteKey}>
                  <div style={{ fontSize: 13, color: "#333", marginBottom: 4 }}>{mod.label}</div>
                  <input
                    type="text"
                    placeholder="Notes..."
                    value={project.m3[mod.noteKey] as string}
                    onChange={(e) => setProject((p) => ({
                      ...p,
                      m3: { ...p.m3, [mod.noteKey]: e.target.value },
                    }))}
                    style={{
                      width: "100%",
                      border: "1px solid #cfcfcf",
                      borderRadius: 8,
                      padding: "5px 8px",
                      fontSize: 12,
                      color: "#333",
                      background: "#fff",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Row 2 — Allowable Area Determination — table format */}
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 10 }}>
        Allowable Area Determination
      </div>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #d0d0d0" }}>
            <th style={{ ...thStyle, textAlign: "center" }}>Tabular Area (At)</th>
            <th style={{ ...thStyle, textAlign: "center", width: 24 }}>+</th>
            <th style={{ ...thStyle, textAlign: "center" }}>(NS) Factor</th>
            <th style={{ ...thStyle, textAlign: "center", width: 24 }}>×</th>
            <th style={{ ...thStyle, textAlign: "center" }}>Frontage (If)</th>
            <th style={{ ...thStyle, textAlign: "center", width: 24 }}>=</th>
            <th style={{ ...thStyle, textAlign: "center" }}>Allowable Area (Aa)</th>
            <th style={{ ...thStyle, textAlign: "center", borderLeft: "1px solid #d0d0d0" }}>
              {calc.storiesAbove > 3 ? "Story Factor (Sa)" : "Stories"}
            </th>
            <th style={{ ...thStyle, textAlign: "center", borderLeft: "1px solid #d0d0d0" }}>Total Allowable Area</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: "1px solid #efefef" }}>
            <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>{fmtArea(calc.mostRestrictiveAt)}</td>
            <td style={{ ...tdStyle, textAlign: "center", color: "#555" }}>+</td>
            <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>{fmtArea(calc.mostRestrictiveNs)}</td>
            <td style={{ ...tdStyle, textAlign: "center", color: "#555" }}>×</td>
            <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>{calc.If.toFixed(2)}</td>
            <td style={{ ...tdStyle, textAlign: "center", color: "#555" }}>=</td>
            <td style={{ ...tdStyle, textAlign: "center" }}>
              <div style={{
                display: "inline-block",
                border: `1px solid ${storyColor}`,
                borderRadius: 6,
                padding: "2px 10px",
                fontSize: 12,
                fontWeight: 700,
                color: storyColor,
                background: "#fff",
              }}>
                {fmtArea(calc.aaStory)}
              </div>
            </td>
            <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af", borderLeft: "1px solid #efefef" }}>
              {calc.storiesAbove > 3 ? calc.Sa : calc.storiesAbove}
            </td>
            <td style={{ ...tdStyle, textAlign: "center", borderLeft: "1px solid #efefef" }}>
              <div style={{
                display: "inline-block",
                border: `1px solid ${totalColor}`,
                borderRadius: 6,
                padding: "2px 10px",
                fontSize: 12,
                fontWeight: 700,
                color: totalColor,
                background: "#fff",
              }}>
                {fmtArea(calc.aaTotal)}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    {/* Row 3 — Frontage Increase — 40/60 grid */}
    <div style={{ borderTop: "1px solid #e9e9e9", paddingTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Checkbox
          checked={project.m3.frontage.frontageEnabled}
          onChange={(checked) => setProject((p) => ({
            ...p,
            m3: {
              ...p.m3,
              frontage: { ...p.m3.frontage, frontageEnabled: checked },
            },
          }))}
        />
        <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>
          Frontage Increase (506.3)
        </div>
      </div>

      {project.m3.frontage.frontageEnabled && (
      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 40%) 1fr", gap: 24 }}>

        {/* Left — direction inputs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(["north", "east", "south", "west"] as const).map(dir => {
            const seg = project.m3.frontage[dir] as FrontageSegment;
            return (
              <div key={dir} style={{
                border: "1px solid #e9e9e9",
                borderRadius: 10,
                padding: "8px 12px",
                background: "#fafafa",
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>
                  Facing {dir.charAt(0).toUpperCase() + dir.slice(1)}
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>Perimeter Length (ft)</div>
                    <TableNumberInput
                      value={seg.perimeterLength}
                      placeholder="ft"
                      onChange={(v) => setProject((p) => ({
                        ...p,
                        m3: {
                          ...p.m3,
                          frontage: {
                            ...p.m3.frontage,
                            [dir]: { ...p.m3.frontage[dir], perimeterLength: v },
                          },
                        },
                      }))}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>Frontage Width (ft)</div>
                    <TableNumberInput
                      value={seg.frontageWidth}
                      placeholder="ft"
                      onChange={(v) => setProject((p) => ({
                        ...p,
                        m3: {
                          ...p.m3,
                          frontage: {
                            ...p.m3.frontage,
                            [dir]: { ...p.m3.frontage[dir], frontageWidth: v },
                          },
                        },
                      }))}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right — computed results */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            ["Frontage Increase (If)", calc.If.toFixed(2), "#3b82f6"],
          ].map(([label, value, color]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#555", minWidth: 200 }}>{label}:</span>
              <div style={{
                border: `1px solid ${color}`,
                borderRadius: 6,
                padding: "2px 10px",
                fontSize: 12,
                fontWeight: 600,
                color,
                minWidth: 80,
                textAlign: "center" as const,
                background: "#fff",
              }}>{value}</div>
            </div>
          ))}

          {/* Interpolated value with inline checkbox */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#555", minWidth: 200 }}>Interpolated Value:</span>
            <div style={{
              border: "1px solid #9ca3af",
              borderRadius: 6,
              padding: "2px 10px",
              fontSize: 12,
              fontWeight: 600,
              color: "#9ca3af",
              minWidth: 80,
              textAlign: "center" as const,
              background: "#fff",
            }}>{fr.interpolatedIf.toFixed(3)}</div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#333", cursor: "pointer" }}>
              <Checkbox
                checked={project.m3.frontage.useInterpolated}
                onChange={(checked) => setProject((p) => ({
                  ...p,
                  m3: {
                    ...p.m3,
                    frontage: { ...p.m3.frontage, useInterpolated: checked },
                  },
                }))}
              />
              Use interpolated value
            </label>
          </div>

          {[
            ["Tabular Increase Factor", fr.tabularIf.toFixed(2), "#9ca3af"],
            ["Min. Qualifying Distance", fr.minQualifyingDist !== null ? `${fr.minQualifyingDist}'-0"` : "—", "#9ca3af"],
            ["Qualifying Perimeter %", fr.totalPerimeter > 0 ? `${fr.qualifyingPct.toFixed(1)}%` : "—", "#9ca3af"],
            [`Total Frontage (≥20'-0")`, fr.totalQualifying > 0 ? `${fr.totalQualifying.toLocaleString()}'-0"` : "—", "#9ca3af"],
            ["Total Perimeter", fr.totalPerimeter > 0 ? `${fr.totalPerimeter.toLocaleString()}'-0"` : "—", "#9ca3af"],
          ].map(([label, value, color]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#555", minWidth: 200 }}>{label}:</span>
              <div style={{
                border: `1px solid ${color}`,
                borderRadius: 6,
                padding: "2px 10px",
                fontSize: 12,
                fontWeight: 600,
                color,
                minWidth: 80,
                textAlign: "center" as const,
                background: "#fff",
              }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
      )}
    </div>

  </div>
);
                    })()}
                  </CollapsiblePanel>

                  <CollapsiblePanel
                    title="Mixed Use and Occupancy (508)"
                    description="This panel determines the classification of mixed occupancies."
                    summarySlot={(() => {
                      const calc = compute508(project);
                      const summaryBox = (label: string, meets: boolean | null) => (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, color: "#555" }}>{label}:</span>
                          <div style={{
                            border: `1px solid ${meets === null ? "#9ca3af" : meets ? "#16a34a" : "#dc2626"}`,
                            borderRadius: 6,
                            padding: "2px 10px",
                            fontSize: 12,
                            fontWeight: 700,
                            color: meets === null ? "#9ca3af" : meets ? "#16a34a" : "#dc2626",
                            minWidth: 70,
                            textAlign: "center" as const,
                            background: "#fff",
                          }}>
                            {meets === null ? "—" : meets ? "Meets" : "Exceeds"}
                          </div>
                        </div>
                      );
                      const hasSeparated = calc.separatedStories.some(s => s.rows.some(r => r.type === "Separated"));
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                          {summaryBox("Accessory Occupancies", calc.accessoryRows.length > 0 ? calc.accessoryMeets : null)}
                          {summaryBox("Nonseparated Occupancies", calc.nonseparatedRows.length > 0 ? (calc.nonsepHeightComplies === "complies" && calc.nonsepStoriesComplies === "complies") : null)}
                          {summaryBox("Separated Occupancies", hasSeparated ? calc.separatedMeets : null)}
                        </div>
                      );
                    })()}
                    collapsed={project.m3.panel508Collapsed}
                    onToggle={() => setProject((p) => ({
                      ...p,
                      m3: { ...p.m3, panel508Collapsed: !p.m3.panel508Collapsed },
                    }))}
                  >
                    {(() => {
                      const calc = compute508(project);
                      const ct = mapConstructionType(project.m1.constructionType);
                      const storiesAbove = countAboveStories(project);
                      const spk = mapSprinklerTag(project.m1.sprinklers, storiesAbove);
                      const spkLabel = project.m1.sprinklers || "—";
                      const ctLabel = project.m1.constructionType || "—";
                      const storiesLabel = String(storiesAbove);
                      const fmtArea = (v: LimitValue) =>
                        v === null ? "—" : v === "UL" ? "Unlimited" : v === "NP" ? "Not Permitted" : Math.round(v as number).toLocaleString();
                      const fmtHeight = (v: LimitValue) =>
                        v === null ? "—" : v === "UL" ? "Unlimited" : v === "NP" ? "Not Permitted" : `${v}'-0"`;
                      const complianceColor = (c: "complies" | "fails" | "unknown") =>
                        c === "complies" ? "#16a34a" : c === "fails" ? "#dc2626" : "#9ca3af";
                      const mutedText: React.CSSProperties = { color: "#9ca3af", fontSize: 13 };
                      const infoBox = (value: string, color?: string): React.CSSProperties => ({
                        border: `1px solid ${color ?? "#d6d6d6"}`,
                        borderRadius: 6,
                        padding: "2px 10px",
                        fontSize: 12,
                        fontWeight: 600,
                        color: color ?? "#9ca3af",
                        background: "#fafafa",
                        minWidth: 60,
                        textAlign: "center" as const,
                      });

                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

                          {/* Info table */}
                          <PanelInfoTable cells={[
                            { label: "Const. Type", value: ctLabel },
                            { label: "Sprinklers", value: spkLabel },
                            { label: "Fire Alarm", value: project.m1.fireAlarm || "—" },
                            { label: "Stories", value: storiesLabel },
                            { label: "Height", value: project.m1.buildingHeight.feet !== null ? formatFeetInches(project.m1.buildingHeight) : "—", color: complianceColor(calc.nonsepHeightComplies) !== "#9ca3af" ? complianceColor(calc.nonsepHeightComplies) : undefined },
                            { label: "Building Area", value: totalAboveGradeArea(project).toLocaleString(), color: complianceColor(calc.nonsepAreaComplies) !== "#9ca3af" ? complianceColor(calc.nonsepAreaComplies) : undefined },
                          ]} />

                          {/* Table 1 — Accessory Occupancies */}
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 10 }}>
                              Accessory Occupancies (508.2)
                            </div>
                            {calc.accessoryRows.length > 0 ? (
                              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                                <thead>
                                  <tr style={{ borderBottom: "1px solid #d0d0d0" }}>
                                    <th style={{ ...thStyle, textAlign: "center" }}>Story</th>
                                    <th style={{ ...thStyle, textAlign: "center" }}>Occupancy</th>
                                    <th style={{ ...thStyle, textAlign: "center" }}>Total Sq Ft</th>
                                    <th style={{ ...thStyle, textAlign: "center" }}>Story Area</th>
                                    <th style={{ ...thStyle, textAlign: "center" }}>NS Area</th>
                                    <th style={{ ...thStyle, textAlign: "center" }}>% Story</th>
                                    <th style={{ ...thStyle, textAlign: "center" }}>% NS Area</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {calc.accessoryRows.map((row, idx) => {
                                    const storyColor = row.storyComplies ? "#16a34a" : "#dc2626";
                                    const nsColor = row.nsComplies ? "#16a34a" : "#dc2626";
                                    return (
                                      <tr key={idx} style={{ borderBottom: "1px solid #efefef" }}>
                                        <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>{row.storyId}</td>
                                        <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>{row.occupancy}</td>
                                        <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>{row.sqft.toLocaleString()}</td>
                                        <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>{row.storyArea.toLocaleString()}</td>
                                        <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>{fmtArea(row.nsArea)}</td>
                                        <td style={{ ...tdStyle, textAlign: "center" }}>
                                          <div style={{
                                            display: "inline-block",
                                            border: `1px solid ${storyColor}`,
                                            borderRadius: 6,
                                            padding: "2px 8px",
                                            fontSize: 12,
                                            fontWeight: 700,
                                            color: storyColor,
                                            background: "#fff",
                                          }}>
                                            {row.pctStory !== null ? `${row.pctStory.toFixed(2)}%` : "—"}
                                          </div>
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: "center" }}>
                                          <div style={{
                                            display: "inline-block",
                                            border: `1px solid ${nsColor}`,
                                            borderRadius: 6,
                                            padding: "2px 8px",
                                            fontSize: 12,
                                            fontWeight: 700,
                                            color: nsColor,
                                            background: "#fff",
                                          }}>
                                            {row.pctNS !== null ? `${row.pctNS.toFixed(1)}%` : "—"}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            ) : (
                              <div style={{ fontSize: 13, color: "#9ca3af" }}>
                                No accessory occupancies designated in Module 2.
                              </div>
                            )}
                          </div>

                          {/* Divider */}
                          <div style={{ borderTop: "1px solid #e9e9e9" }} />

                          {/* Table 2 — Nonseparated Occupancies */}
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 10 }}>
                              Nonseparated Occupancies (508.3)
                            </div>
                            {calc.nonseparatedRows.length > 0 ? (
                              <>
                                {/* Compliance bar */}
                                <div style={{
                                  display: "flex",
                                  gap: 16,
                                  marginBottom: 12,
                                  padding: "8px 12px",
                                  background: "#f7f7f7",
                                  borderRadius: 10,
                                  border: "1px solid #e9e9e9",
                                  flexWrap: "wrap",
                                }}>
                                  {[
                                    ["Max Height", fmtHeight(calc.mostRestrictiveNonsep?.maxHeight ?? null), complianceColor(calc.nonsepHeightComplies)],
                                    ["Max Stories", fmtArea(calc.mostRestrictiveNonsep?.maxStories ?? null), complianceColor(calc.nonsepStoriesComplies)],
                                    ["Max Area (At)", fmtArea(calc.mostRestrictiveNonsep?.at ?? null), complianceColor(calc.nonsepAreaComplies)],
                                  ].map(([label, value, color]) => (
                                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <span style={mutedText}>{label}:</span>
                                      <div style={{ ...infoBox(value, color), color, border: `1px solid ${color}` }}>{value}</div>
                                    </div>
                                  ))}
                                </div>
                                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                                  <thead>
                                    <tr style={{ borderBottom: "1px solid #d0d0d0" }}>
                                      <th style={{ ...thStyle, textAlign: "center" }}>Occupancy</th>
                                      <th style={{ ...thStyle, textAlign: "center" }}>Tabular Height</th>
                                      <th style={{ ...thStyle, textAlign: "center" }}>Tabular Stories</th>
                                      <th style={{ ...thStyle, textAlign: "center" }}>Tabular Area (At)</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {calc.nonseparatedRows.map((row, idx) => (
                                      <tr key={idx} style={{
                                        borderBottom: "1px solid #efefef",
                                        background: row.isMostRestrictive ? "#fef9c3" : "transparent",
                                      }}>
                                        <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af", fontWeight: row.isMostRestrictive ? 700 : 400 }}>{row.displayName}</td>
                                        <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af", fontWeight: row.isMostRestrictive ? 700 : 400 }}>{fmtHeight(row.maxHeight)}</td>
                                        <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af", fontWeight: row.isMostRestrictive ? 700 : 400 }}>{fmtArea(row.maxStories)}</td>
                                        <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af", fontWeight: row.isMostRestrictive ? 700 : 400 }}>{fmtArea(row.at)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </>
                            ) : (
                              <div style={{ fontSize: 13, color: "#9ca3af" }}>
                                No nonseparated occupancies designated in Module 2.
                              </div>
                            )}
                          </div>

                          {/* Divider */}
                          <div style={{ borderTop: "1px solid #e9e9e9" }} />

                          {/* Table 3 — Separated Occupancies */}
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 10 }}>
                              Separated Occupancies (508.4)
                            </div>
                            {calc.separatedStories.some(s => s.rows.some(r => r.type === "Separated")) ? (
                              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                                <thead>
                                  <tr style={{ borderBottom: "1px solid #d0d0d0" }}>
                                    <th style={{ ...thStyle, textAlign: "center" }}>Story</th>
                                    <th style={{ ...thStyle, textAlign: "center" }}>Max Stories</th>
                                    <th style={{ ...thStyle, textAlign: "center" }}>Occupancies</th>
                                    <th style={{ ...thStyle, textAlign: "center" }}>Mixed Use</th>
                                    <th style={{ ...thStyle, textAlign: "center" }}>Sq Ft</th>
                                    <th style={{ ...thStyle, textAlign: "center" }}>Max Area (story)</th>
                                    <th style={{ ...thStyle, textAlign: "center" }}>Max Height</th>
                                    <th style={{ ...thStyle, textAlign: "center" }}>Ratio</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {calc.separatedStories.map((story) => (
                                    <React.Fragment key={story.storyId}>
                                      {story.rows.map((row, idx) => (
                                        <tr key={idx} style={{ borderBottom: "1px solid #efefef" }}>
                                          <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>{idx === 0 ? row.storyId : ""}</td>
                                          <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>{fmtArea(row.maxStories)}</td>
                                          <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>{row.occupancies}</td>
                                          <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>{row.type}</td>
                                          <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>{row.sqft.toLocaleString()}</td>
                                          <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>{fmtArea(row.allowableArea)}</td>
                                          <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>{fmtHeight(row.maxHeight)}</td>
                                          <td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>
                                            {row.ratio !== null ? row.ratio.toFixed(3) : "—"}
                                          </td>
                                        </tr>
                                      ))}
                                      {/* Story total row */}
                                      <tr style={{ borderBottom: "2px solid #d0d0d0", background: "#fafafa" }}>
                                        <td colSpan={7} style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: "#555" }}>
                                          Story {story.storyId} Total:
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: "center" }}>
                                          <div style={{
                                            display: "inline-block",
                                            border: `1px solid ${story.complies === null ? "#9ca3af" : story.complies ? "#16a34a" : "#dc2626"}`,
                                            borderRadius: 6,
                                            padding: "2px 8px",
                                            fontSize: 12,
                                            fontWeight: 700,
                                            color: story.complies === null ? "#9ca3af" : story.complies ? "#16a34a" : "#dc2626",
                                            background: "#fff",
                                          }}>
                                            {story.totalRatio !== null ? story.totalRatio.toFixed(3) : "—"}
                                          </div>
                                        </td>
                                      </tr>
                                    </React.Fragment>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <div style={{ fontSize: 13, color: "#9ca3af" }}>
                                No separated occupancies designated in Module 2.
                              </div>
                            )}
                          </div>

                        </div>
                      );
                    })()}
                  </CollapsiblePanel>
                </div>
              </section>
            </div>

            {/* Chapter 3 checklist panel */}
            <div id="ch3" style={{ scrollMarginTop: 12 }}>
              <CollapsiblePanel
                title="Chapter 3: Occupancy Classification and Use"
                description="This chapter controls the classification of all buildings and structures as to occupancy and use."
                collapsed={ch3PanelCollapsed}
                onToggle={() => setCh3PanelCollapsed(v => !v)}
              >
                <ChapterChecklist
                  rows={ch3Rows}
                  responses={ch3Responses}
                  setResponses={setCh3Responses}
                  externalCollapsed={ch3Collapsed}
                  setExternalCollapsed={setCh3Collapsed}
                />
              </CollapsiblePanel>
            </div>

            {/* Chapter 4 checklist panel */}
            <div id="ch4" style={{ scrollMarginTop: 12 }}>
              <CollapsiblePanel
                title="Chapter 4: Special Detailed Requirements Based on Occupancy and Use"
                description="This chapter provides detailed criteria for special uses and occupancies."
                collapsed={ch4PanelCollapsed}
                onToggle={() => setCh4PanelCollapsed(v => !v)}
              >
                <ChapterChecklist
                  rows={ch4Rows}
                  responses={ch4Responses}
                  setResponses={setCh4Responses}
                />
              </CollapsiblePanel>
            </div>

            {/* Chapter 5 checklist panel */}
            <div id="ch5" style={{ scrollMarginTop: 12 }}>
              <CollapsiblePanel
                title="Chapter 5: General Building Heights and Areas"
                description="This chapter establishes the limits to which a building can be built."
                collapsed={ch5PanelCollapsed}
                onToggle={() => setCh5PanelCollapsed(v => !v)}
              >
                <ChapterChecklist
                  rows={ch5Rows}
                  responses={ch5Responses}
                  setResponses={setCh5Responses}
                />
              </CollapsiblePanel>
            </div>


            {/* Chapter 6 checklist panel */}
            <div id="ch6" style={{ scrollMarginTop: 12 }}>
              <CollapsiblePanel
                title="Chapter 6: Types of Construction"
                description="This Chapter establishes five types of construction in which each building must be categorized."
                collapsed={ch6PanelCollapsed}
                onToggle={() => setCh6PanelCollapsed(v => !v)}
              >
                <ChapterChecklist
                  rows={ch6Rows}
                  responses={ch6Responses}
                  setResponses={setCh6Responses}
                />
              </CollapsiblePanel>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ---- Helpers ---- */

function countAboveStories(project: ProjectState): number {
  return project.stories.filter((s) => s.kind === "above").length;
}

function countBelowStories(project: ProjectState): number {
  return project.stories.filter((s) => s.kind === "below").length;
}

function sumStorySqft(story: { areas: { sqft: number | null }[] }): number {
  return story.areas.reduce((acc, a) => acc + (a.sqft ?? 0), 0);
}

const EXCLUDED_MIXED_USES = ["Mezzanine", "Equipment Platform", "Occupied Roof", "Penthouse"];

function sumStorySqftFiltered(story: { areas: { sqft: number | null; mixedUse: string }[] }): number {
  return story.areas
    .filter(a => !EXCLUDED_MIXED_USES.includes(a.mixedUse))
    .reduce((acc, a) => acc + (a.sqft ?? 0), 0);
}

function totalAboveGradeArea(project: ProjectState): number {
  return project.stories
    .filter((s) => s.kind === "above")
    .reduce((acc, s) => acc + sumStorySqftFiltered(s), 0);
}

function totalBelowGradeArea(project: ProjectState): number {
  return project.stories
    .filter((s) => s.kind === "below")
    .reduce((acc, s) => acc + sumStorySqftFiltered(s), 0);
}

function largestStoryArea(project: ProjectState): number {
  return Math.max(0, ...project.stories
    .filter(s => s.kind === "above")
    .map(s => sumStorySqftFiltered(s))
  );
}

function ordinalStoryLabel(story: { id: string; kind: StoryKind }): string {
  if (story.kind === "below") return `${story.id} Story`;
  const n = parseInt(story.id, 10);
  if (isNaN(n)) return `${story.id} Story`;
  const suffix = n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
  return `${n}${suffix} Story`;
}

// Table 506.3.3 — Frontage Increase Factor
// Rows: qualifying % brackets [0-25, 25-50, 50-75, 75-100]
// Cols: min distance brackets [20-25, 25-30, 30+]
const FRONTAGE_TABLE = [
  [0,    0,    0   ],  // 0-25%
  [0.17, 0.21, 0.25],  // 25-50%
  [0.33, 0.42, 0.50],  // 50-75%
  [0.50, 0.63, 0.75],  // 75-100%
];

function getFrontageRowIndex(pct: number): number {
  if (pct < 25) return 0;
  if (pct < 50) return 1;
  if (pct < 75) return 2;
  return 3;
}

function getFrontageColIndex(minDist: number): number {
  if (minDist < 25) return 0;
  if (minDist < 30) return 1;
  return 2;
}

function interpolateFrontage(pct: number, minDist: number): number {
  // Clamp inputs
  const clampedPct = Math.min(100, Math.max(0, pct));
  const clampedDist = Math.max(20, minDist);

  // % breakpoints and distance breakpoints for interpolation
  const pctBreaks = [0, 25, 50, 75, 100];
  const distBreaks = [20, 25, 30, 999];

  // Full table including 0% row and extrapolated 100% boundary
  const fullTable = [
    [0,    0,    0   ],  // 0%
    [0,    0,    0   ],  // 25%  (row 0 → same as 0%)
    [0.17, 0.21, 0.25],  // 25%
    [0.33, 0.42, 0.50],  // 50%
    [0.50, 0.63, 0.75],  // 75%
    [0.50, 0.63, 0.75],  // 100% (same as 75+ row per table)
  ];

  const pctBreaksFull = [0, 25, 25, 50, 75, 100];

  // Find surrounding % rows
  let r0 = 0;
  for (let i = 0; i < pctBreaksFull.length - 1; i++) {
    if (clampedPct >= pctBreaksFull[i] && clampedPct <= pctBreaksFull[i + 1]) {
      r0 = i;
      break;
    }
  }
  const r1 = Math.min(r0 + 1, fullTable.length - 1);
  const pctT = pctBreaksFull[r0] === pctBreaksFull[r1]
    ? 0
    : (clampedPct - pctBreaksFull[r0]) / (pctBreaksFull[r1] - pctBreaksFull[r0]);

  // Find surrounding distance cols
  const c0 = clampedDist < 25 ? 0 : clampedDist < 30 ? 1 : 2;
  const c1 = Math.min(c0 + 1, 2);
  const distBreakLow = [20, 25, 30][c0];
  const distBreakHigh = [25, 30, 999][c0];
  const distT = distBreakHigh === 999
    ? 0
    : (clampedDist - distBreakLow) / (distBreakHigh - distBreakLow);

  // Bilinear interpolation
  const v00 = fullTable[r0][c0];
  const v01 = fullTable[r0][c1];
  const v10 = fullTable[r1][c0];
  const v11 = fullTable[r1][c1];

  return v00 * (1 - pctT) * (1 - distT)
       + v01 * (1 - pctT) * distT
       + v10 * pctT * (1 - distT)
       + v11 * pctT * distT;
}

interface FrontageResult {
  totalPerimeter: number;
  totalQualifying: number;
  qualifyingPct: number;
  minQualifyingDist: number | null;
  tabularIf: number;
  interpolatedIf: number;
  qualifies: boolean; // >= 25% perimeter threshold
}

function computeFrontage(frontage: FrontageState): FrontageResult {
  const directions = [frontage.north, frontage.east, frontage.south, frontage.west];

  let totalPerimeter = 0;
  let totalQualifying = 0;
  let minQualifyingDist: number | null = null;

  for (const seg of directions) {
    const len = seg.perimeterLength ?? 0;
    const width = seg.frontageWidth ?? 0;
    if (len > 0) {
      totalPerimeter += len;
      if (width >= 20) {
        totalQualifying += len;
        if (minQualifyingDist === null || width < minQualifyingDist) {
          minQualifyingDist = width;
        }
      }
    }
  }

  const qualifyingPct = totalPerimeter > 0
    ? (totalQualifying / totalPerimeter) * 100
    : 0;

  const qualifies = qualifyingPct >= 25 && minQualifyingDist !== null;

  const tabularIf = qualifies && minQualifyingDist !== null
    ? FRONTAGE_TABLE[getFrontageRowIndex(qualifyingPct)][getFrontageColIndex(minQualifyingDist)]
    : 0;

  const interpolatedIf = qualifies && minQualifyingDist !== null
    ? Math.round(interpolateFrontage(qualifyingPct, minQualifyingDist) * 1000) / 1000
    : 0;

  return {
    totalPerimeter,
    totalQualifying,
    qualifyingPct,
    minQualifyingDist,
    tabularIf,
    interpolatedIf,
    qualifies,
  };
}

interface AreaCalcResult {
  // Occupancy table data
  occRows: {
    key: OccupancyKey;
    displayName: string;
    at: LimitValue;
    ns: LimitValue;
  }[];
  mostRestrictiveKey: OccupancyKey | null;
  mostRestrictiveAt: LimitValue;
  mostRestrictiveNs: LimitValue;

  // Equation inputs
  If: number;
  Sa: number;
  storiesAbove: number;

  // Results
  aaStory: number | "UL" | "NP" | null;  // Eq 5-1 per story
  aaTotal: number | "UL" | "NP" | null;  // total allowable
  largestStory: number;
  totalAbove: number;
  totalBelow: number;
  basementComplies: boolean | null;

  // Compliance
  storyComplies: "complies" | "fails" | "unknown";
  totalComplies: "complies" | "fails" | "unknown";
  basementColor: string;
}

interface Calc504Result {
  maxHeightFt: LimitValue;
  maxStories: LimitValue;
  spkLabel: string;
  ctLabel: string;
  actualHeightFt: number | null;
  actualStories: number;
  heightComplies: "complies" | "fails" | "unknown";
  storiesComplies: "complies" | "fails" | "unknown";
  occEntries: [OccupancyKey, string][];
  occupiedRoofRows: { storyId: string; occupancy: string; sqft: number | null }[];
  activeModifiers: { label: string; noteKey: keyof Module3State }[];
  spk: SprinklerTag;
  ct: ConstructionType | null;
}

function compute504(project: ProjectState): Calc504Result {
  const ct = mapConstructionType(project.m1.constructionType);
  const storiesAbove = countAboveStories(project);
  const spk = mapSprinklerTag(project.m1.sprinklers, storiesAbove);
  const actualHeightFt = project.m1.buildingHeight.feet;
  const actualStories = storiesAbove;

  const occEntries = Array.from(new Map(
    project.stories.flatMap(s => s.areas.map(a => {
      const key = a.occupancyCondition
        ? a.occupancyCondition as OccupancyKey
        : mapOccupancyKey(a.occupancy);
      return key ? [key, a.occupancy] as [OccupancyKey, string] : null;
    }).filter((x): x is [OccupancyKey, string] => x !== null))
  ).entries());

  const maxHeightFt = ct && occEntries.length > 0
    ? getMostRestrictiveLimit(occEntries.map(([o]) => getMaxHeightFt(o, ct, spk)))
    : null;
  const maxStories = ct && occEntries.length > 0
    ? getMostRestrictiveLimit(occEntries.map(([o]) => getMaxStories(o, ct, spk)))
    : null;

  const heightComplies = actualHeightFt !== null && maxHeightFt !== null
    ? checkCompliance(actualHeightFt, maxHeightFt)
    : "unknown";
  const storiesComplies = maxStories !== null
    ? checkCompliance(actualStories, maxStories)
    : "unknown";

  const occupiedRoofRows = project.stories
    .filter(s => s.kind === "above")
    .flatMap(s => s.areas
      .filter(a => a.mixedUse === "Occupied Roof")
      .map(a => ({
        storyId: s.id,
        occupancy: a.occupancy.replace(/^Group\s+/i, ""),
        sqft: a.sqft,
      }))
    );

  const activeModifiers: { label: string; noteKey: keyof Module3State }[] = [];
  if (project.m3.specialIndustrialOccupancy)
    activeModifiers.push({ label: "Special Industrial Occupancy (503.1.1)", noteKey: "specialIndustrialOccupancyNote" });
  if (project.m3.oneStoryAircraftHangar)
    activeModifiers.push({ label: "One-Story Aircraft Hangar (504.1)", noteKey: "oneStoryAircraftHangarNote" });
  if (project.m3.unlimitedAreaBuilding)
    activeModifiers.push({ label: "507 Unlimited Area Building", noteKey: "unlimitedAreaBuildingNote" });
  if (project.m3.specialProvisions)
    activeModifiers.push({ label: "510 Special Provisions (504.1.2)", noteKey: "specialProvisionsNote" });
  if (project.m3.rooftopStructures)
    activeModifiers.push({ label: "1511 Rooftop Structures (504.3)", noteKey: "rooftopStructuresNote" });

  return {
    maxHeightFt,
    maxStories,
    spkLabel: project.m1.sprinklers || "—",
    ctLabel: project.m1.constructionType || "—",
    actualHeightFt,
    actualStories,
    heightComplies,
    storiesComplies,
    occEntries,
    occupiedRoofRows,
    activeModifiers,
    spk,
    ct,
  };
}

function computeArea506(project: ProjectState): AreaCalcResult {
  const ct = mapConstructionType(project.m1.constructionType);
  const storiesAbove = countAboveStories(project);
  const spk = mapSprinklerTag(project.m1.sprinklers, storiesAbove);
  const frontageResult = computeFrontage(project.m3.frontage);
  const If = project.m3.frontage.frontageEnabled
    ? (project.m3.frontage.useInterpolated
        ? frontageResult.interpolatedIf
        : frontageResult.tabularIf)
    : 0;

  // Sa determination per 506.2.1
  // Sa = 4 only for Group R with NFPA 13R (903.3.1.2)
  // Sa = 3 for all other cases where stories > 3
  // Sa = 4 only when ALL occupancies are Group R and sprinkler is NFPA 13R
  const nonExcludedOccupancies = project.stories.flatMap(s =>
    s.areas.filter(a =>
      !EXCLUDED_MIXED_USES.includes(a.mixedUse) &&
      a.mixedUse !== "Accessory Use" &&
      a.occupancy
    ).map(a => a.occupancy)
  );
  const allGroupR = nonExcludedOccupancies.length > 0 &&
    nonExcludedOccupancies.every(occ => occ.startsWith("Group R"));
  const Sa = (spk === "S13R" && allGroupR) ? 4 : 3;

  // Collect unique occupancy keys — exclude separated occupancies for now
  const rawOccEntries = Array.from(new Map(
    project.stories.flatMap(s => s.areas
      .filter(a => !EXCLUDED_MIXED_USES.includes(a.mixedUse))
      .filter(a => a.mixedUse !== "Separated Use")
      .map(a => {
        const key = a.occupancyCondition
          ? a.occupancyCondition as OccupancyKey
          : mapOccupancyKey(a.occupancy);
        return key ? [key, a.occupancy] as [OccupancyKey, string] : null;
      })
      .filter((x): x is [OccupancyKey, string] => x !== null)
    )
  ).entries());

  // Build occupancy rows with At and NS values
  const occRows = ct ? rawOccEntries.map(([key, rawOcc]) => ({
    key,
    displayName: rawOcc.replace(/^Group\s+/i, ""),
    at: getAreaFactor(key, ct, spk),
    ns: getAreaFactor(key, ct, "NS"),
  })) : [];

  // Find most restrictive — lowest numeric At (NP < numbers < UL)
  let mostRestrictiveKey: OccupancyKey | null = null;
  let mostRestrictiveAt: LimitValue = null;
  let mostRestrictiveNs: LimitValue = null;

  for (const row of occRows) {
    if (mostRestrictiveKey === null) {
      mostRestrictiveKey = row.key;
      mostRestrictiveAt = row.at;
      mostRestrictiveNs = row.ns;
      continue;
    }
    // NP is most restrictive
    if (row.at === "NP") {
      mostRestrictiveKey = row.key;
      mostRestrictiveAt = row.at;
      mostRestrictiveNs = row.ns;
      continue;
    }
    if (mostRestrictiveAt === "NP") continue;
    // UL is least restrictive
    if (row.at === "UL") continue;
    if (mostRestrictiveAt === "UL") {
      mostRestrictiveKey = row.key;
      mostRestrictiveAt = row.at;
      mostRestrictiveNs = row.ns;
      continue;
    }
    // Both numeric — lower wins
    if (typeof row.at === "number" && typeof mostRestrictiveAt === "number") {
      if (row.at < mostRestrictiveAt) {
        mostRestrictiveKey = row.key;
        mostRestrictiveAt = row.at;
        mostRestrictiveNs = row.ns;
      }
    }
  }

  // Compute allowable areas
  const totalAbove = totalAboveGradeArea(project);
  const totalBelow = totalBelowGradeArea(project);
  const largest = largestStoryArea(project);

  let aaStory: number | "UL" | "NP" | null = null;
  let aaTotal: number | "UL" | "NP" | null = null;

  if (mostRestrictiveAt !== null && mostRestrictiveNs !== null) {
    if (mostRestrictiveAt === "NP") {
      aaStory = "NP";
      aaTotal = "NP";
    } else if (mostRestrictiveAt === "UL") {
      aaStory = "UL";
      aaTotal = "UL";
    } else if (typeof mostRestrictiveAt === "number" && typeof mostRestrictiveNs === "number") {
      // Eq 5-1
      aaStory = mostRestrictiveAt + (mostRestrictiveNs * If);

      // Eq 5-2 or simple multiplication
      if (storiesAbove > 3) {
        aaTotal = aaStory * Sa;
      } else {
        aaTotal = aaStory * storiesAbove;
      }
    }
  }

  // Basement compliance — compare totalBelow vs aaStory
  let basementComplies: boolean | null = null;
  if (aaStory !== null && totalBelow > 0) {
    if (aaStory === "UL") basementComplies = true;
    else if (aaStory === "NP") basementComplies = false;
    else if (typeof aaStory === "number") basementComplies = totalBelow <= aaStory;
  }

  const basementColor = basementComplies === null
    ? "#9ca3af"
    : basementComplies ? "#16a34a" : "#dc2626";

  // Story compliance
  const storyComplies: "complies" | "fails" | "unknown" =
    aaStory === null ? "unknown"
    : aaStory === "NP" ? "fails"
    : aaStory === "UL" ? "complies"
    : largest <= aaStory ? "complies" : "fails";

  // Total compliance
  const totalComplies: "complies" | "fails" | "unknown" =
    aaTotal === null ? "unknown"
    : aaTotal === "NP" ? "fails"
    : aaTotal === "UL" ? "complies"
    : totalAbove <= aaTotal ? "complies" : "fails";

  return {
    occRows,
    mostRestrictiveKey,
    mostRestrictiveAt,
    mostRestrictiveNs,
    If,
    Sa,
    storiesAbove,
    aaStory,
    aaTotal,
    largestStory: largest,
    totalAbove,
    totalBelow,
    basementComplies,
    storyComplies,
    totalComplies,
    basementColor,
  };
}

interface Accessory508Row {
  storyId: string;
  occupancy: string;
  occKey: OccupancyKey | null;
  sqft: number;
  storyArea: number;
  nsArea: LimitValue;
  pctStory: number | null;
  pctNS: number | null;
  storyComplies: boolean;
  nsComplies: boolean;
}

interface Nonseparated508Row {
  occKey: OccupancyKey | null;
  displayName: string;
  maxHeight: LimitValue;
  maxStories: LimitValue;
  at: LimitValue;
  isMostRestrictive: boolean;
}

interface Separated508StoryRow {
  storyId: string;
  type: "Separated" | "Nonseparated";
  occupancies: string;
  sqft: number;
  allowableArea: LimitValue;
  maxHeight: LimitValue;
  maxStories: LimitValue;
  ratio: number | null;
}

interface Separated508Story {
  storyId: string;
  rows: Separated508StoryRow[];
  totalRatio: number | null;
  complies: boolean | null;
}

interface Calc508Result {
  // Accessory
  accessoryRows: Accessory508Row[];
  accessoryMeets: boolean;

  // Nonseparated
  nonseparatedRows: Nonseparated508Row[];
  mostRestrictiveNonsep: Nonseparated508Row | null;
  nonsepHeightComplies: "complies" | "fails" | "unknown";
  nonsepStoriesComplies: "complies" | "fails" | "unknown";
  nonsepAreaComplies: "complies" | "fails" | "unknown";

  // Separated
  separatedStories: Separated508Story[];
  separatedMeets: boolean;
}

function compute508(project: ProjectState): Calc508Result {
  const ct = mapConstructionType(project.m1.constructionType);
  const storiesAbove = countAboveStories(project);
  const spk = mapSprinklerTag(project.m1.sprinklers, storiesAbove);
  const actualHeightFt = project.m1.buildingHeight.feet ?? 0;
  const actualStories = storiesAbove;

  // ── Table 1: Accessory Occupancies ──────────────────────────
  const accessoryRows: Accessory508Row[] = [];

  for (const story of project.stories) {
    const storyArea = sumStorySqftFiltered(story);
    const accessoryAreas = story.areas.filter(a => a.mixedUse === "Accessory Use" && a.occupancy);

    // Group by occupancy within this story
    const byOcc = new Map<string, number>();
    for (const a of accessoryAreas) {
      byOcc.set(a.occupancy, (byOcc.get(a.occupancy) ?? 0) + (a.sqft ?? 0));
    }

    for (const [occ, sqft] of byOcc.entries()) {
      const occKey = mapOccupancyKey(occ);
      const nsArea = occKey && ct ? getAreaFactor(occKey, ct, "NS") : null;
      const pctStory = storyArea > 0 ? (sqft / storyArea) * 100 : null;
      const pctNS = nsArea !== null && typeof nsArea === "number" && nsArea > 0
        ? (sqft / nsArea) * 100
        : nsArea === "UL" ? 0 : null;
      const storyComplies = pctStory !== null ? Math.round(pctStory * 10) / 10 <= 10 : true;
      const nsComplies = nsArea === "UL" ? true
        : nsArea === "NP" ? false
        : pctNS !== null ? pctNS <= 100 : true;

      accessoryRows.push({
        storyId: story.id,
        occupancy: occ.replace(/^Group\s+/i, ""),
        occKey,
        sqft,
        storyArea,
        nsArea,
        pctStory,
        pctNS,
        storyComplies,
        nsComplies,
      });
    }
  }

  const accessoryMeets = accessoryRows.every(r => r.storyComplies && r.nsComplies);

  // ── Table 2: Nonseparated Occupancies ───────────────────────
  const NONSEP_EXCLUDED = [...EXCLUDED_MIXED_USES, "Accessory Use", "Separated Use"];

  const uniqueOccKeys = Array.from(new Map(
    project.stories.flatMap(s => s.areas
      .filter(a => !NONSEP_EXCLUDED.includes(a.mixedUse) && a.occupancy)
      .map(a => {
        const key = a.occupancyCondition
          ? a.occupancyCondition as OccupancyKey
          : mapOccupancyKey(a.occupancy);
        return key ? [key, a.occupancy] as [OccupancyKey, string] : null;
      })
      .filter((x): x is [OccupancyKey, string] => x !== null)
    )
  ).entries());

  const nonseparatedRows: Nonseparated508Row[] = ct ? uniqueOccKeys.map(([key, rawOcc]) => ({
    occKey: key,
    displayName: rawOcc.replace(/^Group\s+/i, ""),
    maxHeight: getMaxHeightFt(key, ct, spk),
    maxStories: getMaxStories(key, ct, spk),
    at: getAreaFactor(key, ct, spk),
    isMostRestrictive: false,
  })) : [];

  // Sort most restrictive first
  nonseparatedRows.sort((a, b) => {
    if (a.at === "NP") return -1;
    if (b.at === "NP") return 1;
    if (a.at === "UL") return 1;
    if (b.at === "UL") return -1;
    if (typeof a.at === "number" && typeof b.at === "number") return a.at - b.at;
    return 0;
  });

  if (nonseparatedRows.length > 0) nonseparatedRows[0].isMostRestrictive = true;
  const mostRestrictiveNonsep = nonseparatedRows[0] ?? null;

  // Nonseparated compliance
  const nonsepHeightComplies = mostRestrictiveNonsep
    ? checkCompliance(actualHeightFt, mostRestrictiveNonsep.maxHeight)
    : "unknown";
  const nonsepStoriesComplies = mostRestrictiveNonsep
    ? checkCompliance(actualStories, mostRestrictiveNonsep.maxStories)
    : "unknown";
  const nonsepAreaComplies = mostRestrictiveNonsep
    ? checkCompliance(totalAboveGradeArea(project), mostRestrictiveNonsep.at)
    : "unknown";

  // ── Table 3: Separated Occupancies ──────────────────────────
  const separatedStories: Separated508Story[] = [];
  const mostRestrictiveAt = mostRestrictiveNonsep?.at ?? null;

  for (const story of project.stories) {
    const nonExcludedAreas = story.areas.filter(a =>
      !EXCLUDED_MIXED_USES.includes(a.mixedUse) && a.occupancy
    );
    if (nonExcludedAreas.length === 0) continue;

    // Separated areas
    const separatedAreas = nonExcludedAreas.filter(a => a.mixedUse === "Separated Use");
    // Nonseparated areas (everything else)
    const nonsepAreas = nonExcludedAreas.filter(a => a.mixedUse !== "Separated Use");

    const rows: Separated508StoryRow[] = [];

    // Separated row — group all separated areas
    if (separatedAreas.length > 0 && ct) {
      // Use each separated occupancy's own At
      // For simplicity group by occupancy, compute ratio per occupancy
      const bySepOcc = new Map<string, { sqft: number; key: OccupancyKey | null }>();
      for (const a of separatedAreas) {
        const key = a.occupancyCondition
          ? a.occupancyCondition as OccupancyKey
          : mapOccupancyKey(a.occupancy);
        const existing = bySepOcc.get(a.occupancy);
        bySepOcc.set(a.occupancy, {
          sqft: (existing?.sqft ?? 0) + (a.sqft ?? 0),
          key,
        });
      }

      for (const [occ, { sqft, key }] of bySepOcc.entries()) {
        const at = key ? getAreaFactor(key, ct, spk) : null;
        const maxH = key ? getMaxHeightFt(key, ct, spk) : null;
        const maxS = key ? getMaxStories(key, ct, spk) : null;
        const ratio = at !== null && typeof at === "number" && at > 0
          ? sqft / at : at === "UL" ? 0 : null;

        rows.push({
          storyId: story.id,
          type: "Separated",
          occupancies: occ.replace(/^Group\s+/i, ""),
          sqft,
          allowableArea: at,
          maxHeight: maxH,
          maxStories: maxS,
          ratio,
        });
      }
    }

    // Nonseparated row — group all nonsep areas, use most restrictive At
    if (nonsepAreas.length > 0) {
      const totalNonsepSqft = nonsepAreas.reduce((sum, a) => sum + (a.sqft ?? 0), 0);
      const occupancyNames = Array.from(new Set(
        nonsepAreas.map(a => a.occupancy.replace(/^Group\s+/i, ""))
      )).join(", ");

      const ratio = mostRestrictiveAt !== null && typeof mostRestrictiveAt === "number" && mostRestrictiveAt > 0
        ? totalNonsepSqft / mostRestrictiveAt
        : mostRestrictiveAt === "UL" ? 0 : null;

      rows.push({
        storyId: story.id,
        type: "Nonseparated",
        occupancies: occupancyNames,
        sqft: totalNonsepSqft,
        allowableArea: mostRestrictiveAt,
        maxHeight: mostRestrictiveNonsep?.maxHeight ?? null,
        maxStories: mostRestrictiveNonsep?.maxStories ?? null,
        ratio,
      });
    }

    const totalRatio = rows.every(r => r.ratio !== null)
      ? rows.reduce((sum, r) => sum + (r.ratio ?? 0), 0)
      : null;
    const complies = totalRatio !== null ? totalRatio <= 1.0 : null;

    separatedStories.push({ storyId: story.id, rows, totalRatio, complies });
  }

  const separatedMeets = separatedStories.length === 0
    ? true
    : separatedStories.every(s => s.complies !== false);

  return {
    accessoryRows,
    accessoryMeets,
    nonseparatedRows,
    mostRestrictiveNonsep,
    nonsepHeightComplies,
    nonsepStoriesComplies,
    nonsepAreaComplies,
    separatedStories,
    separatedMeets,
  };
}

function formatLimit(limit: LimitValue): string {
  if (limit === null) return "";
  if (limit === "UL") return "Unlimited";
  if (limit === "NP") return "Not Permitted";
  return limit.toLocaleString();
}

function limitColor(actual: number, limit: LimitValue): string {
  const result = checkCompliance(actual, limit);
  if (result === "complies") return "#16a34a";   // green
  if (result === "fails") return "#dc2626";       // red
  return "#9ca3af";                               // grey — unknown/insufficient inputs
}

function occupancyGroups(project: ProjectState): string {
  const set = new Set<string>();
  for (const story of project.stories) {
    const storyArea = sumStorySqftFiltered(story);
    // Group accessory areas by occupancy for this story
    const accessoryByOcc = new Map<string, number>();
    for (const area of story.areas) {
      if (area.mixedUse === "Accessory Use" && area.occupancy) {
        accessoryByOcc.set(area.occupancy, (accessoryByOcc.get(area.occupancy) ?? 0) + (area.sqft ?? 0));
      }
    }
    for (const area of story.areas) {
      const occ = (area.occupancy ?? "").trim();
      if (!occ) continue;
      if (area.mixedUse === "Accessory Use") {
        // Only exclude if it actually complies with ≤10% rule
        const accessorySqft = accessoryByOcc.get(area.occupancy) ?? 0;
        const pct = storyArea > 0 ? Math.round((accessorySqft / storyArea) * 1000) / 10 : 0;
        if (pct <= 10) continue; // truly accessory — exclude from list
      }
      set.add(occ);
    }
  }

  const arr = Array.from(set);
  arr.sort();
  if (arr.length === 0) return "—";

  return arr
    .map((val, idx) => {
      if (idx === 0) return val;
      return val.replace(/^Group\s+/i, "");
    })
    .join(", ");
}

function getConditionOptions(occupancy: string): { tag: string; label: string }[] {
  if (occupancy === "Group I-1") return [
    { tag: "I-1-C1", label: "Cond 1" },
    { tag: "I-1-C2", label: "Cond 2" },
  ];
  if (occupancy === "Group I-2") return [
    { tag: "I-2-C1", label: "Cond 1" },
    { tag: "I-2-C2", label: "Cond 2" },
  ];
  if (occupancy === "Group I-3") return [
    { tag: "I-3-C1", label: "Cond 1" },
    { tag: "I-3-C2", label: "Cond 2" },
    { tag: "I-3-C3", label: "Cond 3" },
    { tag: "I-3-C4", label: "Cond 4" },
    { tag: "I-3-C5", label: "Cond 5" },
  ];
  return [];
}

function formatAllowableHeight(limit: LimitValue): string {
  if (limit === null) return "—";
  if (limit === "UL") return "Unlimited";
  if (limit === "NP") return "Not Permitted";
  return `${limit}'-0"`;
}

/* ---- Small components ---- */

function Checkbox(props: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const { checked, onChange } = props;
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 15,
        height: 15,
        border: "1.5px solid #888",
        borderRadius: 3,
        background: checked ? "#111" : "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        cursor: "pointer",
      }}
    >
      {checked && (
        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
          <path
            d="M1 3.5L3.5 6L8 1"
            stroke="#fff"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
}

function Field(props: { 
  label: string; 
  placeholder: string; 
  muted?: boolean;
  hint?: { text: string; color: string };
}) {
  const { label, placeholder, muted, hint } = props;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>{label}</div>
        {hint && (
          <div style={{ fontSize: 11, fontWeight: 600, color: hint.color }}>
            {hint.text}
          </div>
        )}
      </div>
      <div style={{
        border: "1px solid #cfcfcf",
        borderRadius: 10,
        padding: "6px 10px",
        fontSize: 13,
        background: muted ? "#f6f6f6" : "#fff",
        color: muted ? "#666" : "#111",
      }}>
        {placeholder}
      </div>
    </div>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  options: string[];
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  const { label, value, options, placeholder, onChange } = props;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
            border: "1px solid #cfcfcf",
            borderRadius: 10,
            padding: "6px 10px",
            fontSize: 13,
            background: "#fff",
            color: "#111",
            fontWeight: 500,
            appearance: "auto",
        }}
      >
        <option value="">{placeholder ?? "Select…"}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function TableAction(props: { label: string; onClick: () => void; disabled?: boolean }) {
  const { label, onClick, disabled } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: "1px solid #cfcfcf",
        borderRadius: 10,
        padding: "2px 2px",
        background: disabled ? "#f7f7f7" : "#fafafa",
        color: disabled ? "#999999" : "#222",
        fontSize: 11,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        lineHeight: 1.1,
        whiteSpace: "nowrap",
        width: "100%",
      }}
    >
      {label}
    </button>
  );
}

function TableSelect(props: {
  value: string;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  const { value, options, placeholder, disabled, onChange } = props;

  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        border: "1px solid #cfcfcf",
        borderRadius: 8,
        padding: "4px 8px",
        background: disabled ? "#f6f6f6" : "#fff",
        color: disabled ? "#777" : "#111",
        fontWeight: 500,
      }}
    >
      <option value="">{placeholder ?? "Select…"}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

function TableTextInput(props: { value: string; placeholder?: string; onChange: (v: string) => void }) {
  const { value, placeholder, onChange } = props;

  return (
    <input
      value={value}
      placeholder={placeholder ?? ""}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        border: "1px solid #cfcfcf",
        borderRadius: 8,
        padding: "4px 8px",
        background: "#fff",
        color: "#111",
        fontWeight: 500,
      }}
    />
  );
}

function TableNumberInput(props: { value: number | null; placeholder?: string; onChange: (v: number | null) => void }) {
  const { value, placeholder, onChange } = props;

  const display = value === null ? "" : value.toLocaleString();

  return (
    <input
      inputMode="numeric"
      value={display}
      placeholder={placeholder ?? ""}
      onChange={(e) => {
        const raw = e.target.value.trim();
        if (raw === "") return onChange(null);

        const normalized = raw.replace(/,/g, "");
        const n = Number(normalized);
        if (!Number.isFinite(n)) return;

        onChange(Math.max(0, Math.floor(n)));
      }}
      style={{
        width: 84,
        textAlign: "right",
        border: "1px solid #cfcfcf",
        borderRadius: 8,
        padding: "4px 8px",
        background: "#fff",
        color: "#111",
        fontWeight: 500,
      }}
    />
  );
}

function FeetInchesInput(props: {
  label: string;
  value: { feet: number | null; inches: number | null };
  onChange: (v: { feet: number | null; inches: number | null }) => void;
  hint?: { text: string; color: string };
}) {
  const { label, value, onChange, hint } = props;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>{label}</div>
        {hint && (
          <div style={{ fontSize: 11, fontWeight: 600, color: hint.color }}>
            {hint.text}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <NumBox
          placeholder="ft"
          value={value.feet}
          onChange={(feet) => onChange({ ...value, feet })}
          min={0}
        />
        <span style={{ color: "#333" }}>ft</span>

        <NumBox
          placeholder="in"
          value={value.inches}
          onChange={(inches) => onChange({ ...value, inches })}
          min={0}
          max={11}
        />
        <span style={{ color: "#333" }}>in</span>

        <span style={{ color: "#666", fontSize: 12 }}>({formatFeetInches(value)})</span>
      </div>
    </div>
  );
}

function NumBox(props: {
  placeholder: string;
  value: number | null;
  onChange: (n: number | null) => void;
  min?: number;
  max?: number;
  subtle?: boolean;
}) {
  const { placeholder, value, onChange, min, max, subtle } = props;

  return (
    <input
      inputMode="numeric"
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(e) => {
        const raw = e.target.value.trim();
        if (raw === "") return onChange(null);
        const n = Number(raw);
        if (!Number.isFinite(n)) return;

        const bounded = typeof min === "number" ? Math.max(min, n) : n;
        const bounded2 = typeof max === "number" ? Math.min(max, bounded) : bounded;

        onChange(Math.floor(bounded2));
      }}
      style={{
        border: `1px solid ${subtle ? "#e5e7eb" : "#cfcfcf"}`,
        borderRadius: 8,
        padding: "6px 12px",
        width: 60,
        background: "#fff",
        color: "#111",
        fontWeight: 400,
        fontSize: 13,
      }}
    />
  );
}

function formatFeetInches(v: { feet: number | null; inches: number | null }): string {
  const ft = v.feet ?? 0;
  const inch = v.inches ?? 0;
  if (v.feet === null && v.inches === null) return "—";
  return `${ft}'-${inch}"`;
}

/* ---- Styles ---- */

const cardStyle: React.CSSProperties = {
  border: "1px solid #d6d6d6",
  borderRadius: 14,
  padding: 16,
  background: "#fff",
};

const navBtnStyle: React.CSSProperties = {
  border: "1px solid #cfcfcf",
  borderRadius: 10,
  padding: "8px 6px",
  fontSize: 11,
  fontWeight: 700,
  background: "#fafafa",
  color: "#333",
  cursor: "pointer",
  textAlign: "left",
};

const navBtnDisabledStyle: React.CSSProperties = {
  ...navBtnStyle,
  opacity: 0.45,
  cursor: "not-allowed",
};

const miniBtnStyle: React.CSSProperties = {
  border: "1px solid #cfcfcf",
  borderRadius: 10,
  padding: "4px 8px",
  fontSize: 10,
  fontWeight: 800,
  background: "#fafafa",
  color: "#333",
  cursor: "pointer",
  lineHeight: 1,
};

const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  marginBottom: 12,
};

const moduleTagStyle: React.CSSProperties = {
  display: "inline-block",
  fontSize: 10,
  letterSpacing: 0.8,
  fontWeight: 800,
  color: "#555",
  border: "1px solid #d6d6d6",
  borderRadius: 999,
  padding: "2px 8px",
  marginBottom: 6,
};

const cardTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 700,
  color: "#111",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 10,
};

const tableWrapStyle: React.CSSProperties = {
  border: "1px solid #d6d6d6",
  borderRadius: 12,
  overflowX: "auto",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 1200,
};

const tdRightStyle: React.CSSProperties = {
  fontSize: 12,
  padding: "4px 8px",
  borderBottom: "1px solid #efefef",
  verticalAlign: "middle",
  whiteSpace: "nowrap",
  textAlign: "right",
};

const thRightStyle: React.CSSProperties = {
  fontSize: 12,
  padding: "4px 8px",
  borderBottom: "1px solid #d0d0d0",
  background: "#fafafa",
  color: "#333",
  whiteSpace: "nowrap",
  textAlign: "right",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  fontSize: 12,
  padding: "4px 8px",
  borderBottom: "1px solid #d0d0d0",
  background: "#fafafa",
  color: "#333",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  fontSize: 12,
  padding: "4px 8px",
  borderBottom: "1px solid #efefef",
  verticalAlign: "middle",
  whiteSpace: "nowrap",
};

const storyCellStyle: React.CSSProperties = {
  ...tdStyle,
  background: "#f7f7f7",
};