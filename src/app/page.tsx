"use client";

import React from "react";
import { ChapterChecklist } from "@/components/checklists/ChapterChecklist";
import { ch3Rows } from "@/content/checklists/ch3";
import { ch4Rows } from "@/content/checklists/ch4";
import { ch5Rows } from "@/content/checklists/ch5";
import { ch6Rows } from "@/content/checklists/ch6";
import type { ChecklistChapterResponses } from "@/lib/types";
import { ProjectState } from "@/lib/types";
import { syncStoriesFromCounts } from "@/lib/storyGeneration";
import { DropdownData, loadDropdownsXlsx } from "@/lib/dropdownsXlsx";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";

import {
  // ...existing...
  type OccupancyKey,
} from "@/lib/buildingLimits";

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
} from "@/lib/buildingLimits";

export default function Home() {
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
  
  const [project, setProject] = React.useState<ProjectState>(() => ({
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
      panel504Collapsed: false,
      panel505Collapsed: false,
      panel506Collapsed: false,
      panel507Collapsed: false,
      panel508Collapsed: false,
      panel509Collapsed: false,
      panel510Collapsed: false,
    },
  }));

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

  function scrollToId(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function updateArea(
    storyId: string,
    areaNo: 1 | 2 | 3 | 4,
    patch: Partial<{
      occupancy: string;
      use: string;
      description: string;
      sqft: number | null;
      mixedUse: string;
      occupancyCondition: string;
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
        if (s.areas.length >= 4) return s;

        const nextAreaNo = (s.areas.length + 1) as 2 | 3 | 4;
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
            },
          ],
        };
      }),
    }));
  }

  function deleteAreaRow(storyId: string, areaNo: 2 | 3 | 4) {
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
            areaNo: (idx + 1) as 1 | 2 | 3 | 4,
          }));

        return { ...s, areas: renumbered };
      }),
    }));
  }

  function removeStory(storyId: string) {
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

  function onOccupancyChange(storyId: string, areaNo: 1 | 2 | 3 | 4, occ: string) {
  updateArea(storyId, areaNo, { occupancy: occ, use: "", occupancyCondition: "" });
}

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

      <div style={{ minWidth: 1000, padding: "12px 120px", boxSizing: "border-box" }}>
        <header style={{ marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#989898" }}>2024 IBC Review Worksheet</h1>
          <p style={{ margin: "6px 0 0", color: "#989898" }}>
            This worksheet assists in evaluating buildings for compliance with the 2024 International Building Code, functioning as a dynamic, input-driven checklist and formal record.
          </p>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "250px 1fr", gap: 14 }}>
          {/* LEFT NAV (sticky jump menu) */}
          <nav
            style={{
              position: "sticky",
              top: 12,
              alignSelf: "start",

              // add these:
              maxHeight: "calc(100vh - 24px)",
              overflowY: "auto",
              height: "fit-content",

              border: "1px solid #d6d6d6",
              borderRadius: 14,
              padding: 8,
              background: "#fff",
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: 0.8,
                color: "#666",
                marginBottom: 10,
              }}
            >
              Information Modules
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button type="button" style={navBtnStyle} onClick={() => scrollToId("mod1")}>
                Building Summary
              </button>
              <button type="button" style={navBtnStyle} onClick={() => scrollToId("mod2")}>
                Building Heights & Areas
              </button>
              <button type="button" style={navBtnStyle} onClick={() => scrollToId("mod3")}>
                Other Building Information
              </button>
            </div>

            <div style={{ height: 14 }} />

            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: 0.8,
                color: "#666",
                marginBottom: 10,
              }}
            >
              CODE ANALYSIS
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button type="button" style={navBtnStyle} onClick={() => scrollToId("mod3")}>
                CH 5 Heights & Areas
              </button>
            </div>

            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: 0.8,
                color: "#666",
                marginBottom: 10,
              }}
            >
              Checklist Modules
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button type="button" style={navBtnStyle} onClick={() => scrollToId("ch3")}>
                CH 3 Occupancy & Use
              </button>
              <button type="button" style={navBtnStyle} onClick={() => scrollToId("ch4")}>
                CH 4 Special Occupancy & Use
              </button>
              <button type="button" style={navBtnStyle} onClick={() => scrollToId("ch5")}>
                CH 5 Heights & Areas
              </button>
              <button type="button" style={navBtnStyle} onClick={() => scrollToId("ch6")}>
                CH 6 Types of Construction
              </button>
              <button type="button" style={navBtnDisabledStyle} disabled>
                CH 7 Fire-rated Assemblies
              </button>
              <button type="button" style={navBtnDisabledStyle} disabled>
                CH 8 Interior Finishes
              </button>
              <button type="button" style={navBtnDisabledStyle} disabled>
                CH 9 Fire Protection Systems
              </button>
              <button type="button" style={navBtnDisabledStyle} disabled>
                CH 10 Means of Egress
              </button>
              <button type="button" style={navBtnDisabledStyle} disabled>
                CH 11 Accessibility
              </button>
              <button type="button" style={navBtnDisabledStyle} disabled>
                CH 12 Interior Environment
              </button>
              <button type="button" style={navBtnDisabledStyle} disabled>
                CH 13 Energy Efficiency
              </button>
              <button type="button" style={navBtnDisabledStyle} disabled>
                CH 14 Exterior Walls
              </button>
              <button type="button" style={navBtnDisabledStyle} disabled>
                CH 15 Roof Assemblies & Structures
              </button>
              <button type="button" style={navBtnDisabledStyle} disabled>
                CH 16 Structural Design
              </button>
              <button type="button" style={navBtnDisabledStyle} disabled>
                CH 17 Special Inspections
              </button>
              <button type="button" style={navBtnDisabledStyle} disabled>
                CH 18 Soils & Foundations
              </button>
              <button type="button" style={navBtnDisabledStyle} disabled>
                CH 19 Concrete
              </button>
              <button type="button" style={navBtnDisabledStyle} disabled>
                CH 20 Aluminum
              </button>
              <button type="button" style={navBtnDisabledStyle} disabled>
                CH 21 Masonry
              </button>
              <button type="button" style={navBtnDisabledStyle} disabled>
                CH 22 Steel
              </button>
              <button type="button" style={navBtnDisabledStyle} disabled>
                CH 23 Wood
              </button>
              <button type="button" style={navBtnDisabledStyle} disabled>
                CH 24 Glass & Glazing
              </button>
              <button type="button" style={navBtnDisabledStyle} disabled>
                CH 25 Gypsum Panels & Plaster
              </button>
              <button type="button" style={navBtnDisabledStyle} disabled>
                CH 26 Plastic
              </button>
              <button type="button" style={navBtnDisabledStyle} disabled>
                CH 27 Electrical
              </button>
              <button type="button" style={navBtnDisabledStyle} disabled>
                CH 28 Mechanical Systems
              </button>
              <button type="button" style={navBtnDisabledStyle} disabled>
                CH 29 Plumbing Systems
              </button>
              <button type="button" style={navBtnDisabledStyle} disabled>
                CH 30 Elevators & Conveyors
              </button>
              <button type="button" style={navBtnDisabledStyle} disabled>
                CH 31 Special Construction
              </button>
              <button type="button" style={navBtnDisabledStyle} disabled>
                CH 32 ROW Encroachments
              </button>
              <button type="button" style={navBtnDisabledStyle} disabled>
                CH 33 Construction Safeguards
              </button>
            </div>
          </nav>

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
                    hint={buildingLimits ? {
                      text: `(${formatLimit(buildingLimits.maxStories)} stories max.)`,
                      color: limitColor(countAboveStories(project), buildingLimits.maxStories),
                    } : undefined}
                  />
                  <Field
                    label="Total Above-Grade Area"
                    placeholder={totalAboveGradeArea(project).toLocaleString()}
                    muted
                    hint={buildingLimits ? {
                      text: `(${formatLimit(buildingLimits.maxAreaFactor)} max.)`,
                      color: limitColor(totalAboveGradeArea(project), buildingLimits.maxAreaFactor),
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
                    hint={buildingLimits && project.m1.buildingHeight.feet !== null ? {
                      text: `(${formatLimit(buildingLimits.maxHeightFt)}'-0" max.)`,
                      color: limitColor(project.m1.buildingHeight.feet, buildingLimits.maxHeightFt),
                    } : undefined}
                  />
                  <FeetInchesInput
                    label="Highest Floor"
                    value={project.m1.highestFloor}
                    onChange={(next) => setProject((p) => ({ ...p, m1: { ...p.m1, highestFloor: next } }))}
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

                <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    style={miniBtnStyle}
                    onClick={() => setProject((p) => ({ ...p, m1: { ...p.m1, storiesAbove: p.m1.storiesAbove + 1 } }))}
                  >
                    + Story (Above)
                  </button>

                  <button
                    type="button"
                    style={miniBtnStyle}
                    onClick={() => setProject((p) => ({ ...p, m1: { ...p.m1, storiesBelow: p.m1.storiesBelow + 1 } }))}
                  >
                    + Story (Below)
                  </button>
                </div>

                <div style={tableWrapStyle}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Story</th>
                        <th style={thStyle}>Area</th>
                        <th style={thStyle}>Occupancy</th>
                        {hasGroupI && <th style={thStyle}>Condition</th>}
                        <th style={thStyle}>Use</th>
                        <th style={thStyle}>Description</th>
                        <th style={thRightStyle}>Sq. Ft.</th>
                        <th style={thRightStyle}>%</th>
                        <th style={thStyle}>Mixed Use</th>
                        <th style={thStyle}>Row Controls</th>
                      </tr>
                    </thead>
                    <tbody>
                      {project.stories.length === 0 ? (
                        <tr>
                          <td style={tdStyle} colSpan={hasGroupI ? 10 : 9}>
                            <em style={{ color: "#555" }}>Increase stories Above or Below Grade using the Module 2 controls above.</em>
                          </td>
                        </tr>
                      ) : (
                        project.stories.map((story, storyIdx) => {
                          const isFirstBelowGrade =
                            story.kind === "below" &&
                            (storyIdx === 0 || project.stories[storyIdx - 1].kind === "above");

                          return (
                            <React.Fragment key={story.id}>
                              {story.areas.map((area) => {
                                const occOptions = dropdownData.lists["Occupancy"] ?? [];
                                const useOptions = dropdownData.usesByOccupancy[area.occupancy] ?? [];
                                const mixedUseOptions = dropdownData.lists["Mixed Use"] ?? [];

                                const isStoryRow = area.areaNo === 1;

                                const rowStyle: React.CSSProperties = {
                                  borderBottom: isStoryRow ? "1px solid #d0d0d0" : "1px solid #efefef",
                                  background: isStoryRow ? "#fafafa" : "#fff",
                                  borderTop: isStoryRow && isFirstBelowGrade ? "2px solid #a8a8a8" : undefined,
                                };

                                return (
                                  <tr key={`${story.id}-${area.areaNo}`} style={rowStyle}>
                                    <td style={area.areaNo === 1 ? storyCellStyle : tdStyle}>
                                      {area.areaNo === 1 ? <strong>{story.id}</strong> : ""}
                                    </td>

                                    <td style={tdStyle}>{area.areaNo}</td>

                                    <td style={{ ...tdStyle, minWidth: 140 }}>
                                      <TableSelect
                                        value={area.occupancy}
                                        options={occOptions}
                                        placeholder="Occupancy…"
                                        onChange={(v) => onOccupancyChange(story.id, area.areaNo, v)}
                                      />
                                    </td>
                                    {hasGroupI && (
                                      <td style={{ ...tdStyle, minWidth: 110 }}>
                                        {getConditionOptions(area.occupancy).length > 0 ? (
                                          <TableSelect
                                            value={getConditionOptions(area.occupancy).find(c => c.tag === area.occupancyCondition)?.label ?? ""}
                                            options={getConditionOptions(area.occupancy).map(c => c.label)}
                                            placeholder="Condition…"
                                            onChange={(v) => {
                                              const match = getConditionOptions(area.occupancy).find(c => c.label === v);
                                              updateArea(story.id, area.areaNo, { occupancyCondition: match?.tag ?? "" });
                                            }}
                                          />
                                        ) : (
                                          <span style={{ color: "#ccc" }}>—</span>
                                        )}
                                      </td>
                                    )}

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
                                        placeholder="Room/Area description..."
                                        onChange={(v) => updateArea(story.id, area.areaNo, { description: v })}
                                      />
                                    </td>

                                    <td style={tdRightStyle}>
                                      <TableNumberInput
                                        value={area.sqft}
                                        placeholder="Sq. Ft."
                                        onChange={(v) => updateArea(story.id, area.areaNo, { sqft: v })}
                                      />
                                    </td>

                                    <td style={tdRightStyle}>
                                      <span style={{ color: "#333", fontWeight: 600 }}>
                                        {areaPercent(story, area.sqft)}
                                      </span>
                                    </td>

                                    <td style={tdStyle}>
                                      {area.areaNo === 1 ? (
                                        <span style={{ color: "#666" }}>—</span>
                                      ) : (
                                        <TableSelect
                                          value={area.mixedUse}
                                          options={mixedUseOptions}
                                          placeholder="Mixed Use…"
                                          onChange={(v) => updateArea(story.id, area.areaNo, { mixedUse: v })}
                                        />
                                      )}
                                    </td>

                                    <td style={tdStyle}>
                                      <div
                                        style={{
                                          display: "grid",
                                          gridTemplateColumns: "1fr 1fr",
                                          gap: 6,
                                          width: 132,
                                        }}
                                      >
                                        {area.areaNo === 1 ? (
                                          <>
                                            <TableAction
                                              label="– Story"
                                              onClick={() => removeStory(story.id)}
                                              disabled={story.areas.length !== 1}
                                            />
                                            <TableAction
                                              label="+ Area"
                                              onClick={() => addArea(story.id)}
                                              disabled={story.areas.length >= 4}
                                            />
                                          </>
                                        ) : (
                                          <>
                                            <span />
                                            <TableAction
                                              label="– Area"
                                              onClick={() => deleteAreaRow(story.id, area.areaNo as 2 | 3 | 4)}
                                            />
                                          </>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            {/* Module 3 — Chapter 5 Analysis */}
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
                    {(() => {
                      const ct = mapConstructionType(project.m1.constructionType);
                      const storiesAbove = countAboveStories(project);
                      const spk = mapSprinklerTag(project.m1.sprinklers, storiesAbove);
                      const actualFt = project.m1.buildingHeight.feet;
                      const actualStories = countAboveStories(project);

                      // Unique occupancy keys from Module 2
                      const occEntries = Array.from(new Map(
                        project.stories.flatMap(s => s.areas.map(a => {
                          const key = a.occupancyCondition ? a.occupancyCondition as OccupancyKey : mapOccupancyKey(a.occupancy);
                          return key ? [key, a.occupancy] as [OccupancyKey, string] : null;
                        }).filter((x): x is [OccupancyKey, string] => x !== null))
                      ).entries());

                      // Occupied roof rows from Module 2
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

                      // Active height modifiers
            const activeModifiers: { label: string; noteKey: keyof typeof project.m3 }[] = [];
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

                      // Info bar values
                      const spkLabel = project.m1.sprinklers || "—";
                      const ctLabel = project.m1.constructionType || "—";
                      const heightLabel = actualFt !== null ? formatFeetInches(project.m1.buildingHeight) : "—";
                      const maxH = ct && occEntries.length > 0
                        ? getMostRestrictiveLimit(occEntries.map(([o]) => getMaxHeightFt(o, ct, spk))) : null;
                      const maxS = ct && occEntries.length > 0
                        ? getMostRestrictiveLimit(occEntries.map(([o]) => getMaxStories(o, ct, spk))) : null;
                      const heightColor = actualFt !== null && maxH !== null ? limitColor(actualFt, maxH) : "#9ca3af";
                      const storiesColor = maxS !== null ? limitColor(actualStories, maxS) : "#9ca3af";

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
  <div style={{ display: "flex", gap: 24 }}>
    {/* Left column — tables */}
    <div style={{ flex: 1, minWidth: 0 }}>
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

    {/* Right column — info bar (top) + modifiers (bottom) */}
    <div style={{ minWidth: 280, maxWidth: 700, display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Info bar — always visible */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        padding: "10px 12px",
        background: "#f7f7f7",
        borderRadius: 10,
        border: "1px solid #e9e9e9",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={mutedText}>Sprinkler:</span>
          <div style={infoBox(spkLabel)}>{spkLabel}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={mutedText}>Const. Type:</span>
          <div style={infoBox(ctLabel)}>{ctLabel}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={mutedText}>Height:</span>
          <div style={infoBox(heightLabel, heightColor)}>{heightLabel}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={mutedText}>Stories:</span>
          <div style={infoBox(String(actualStories), storiesColor)}>{actualStories}</div>
        </div>
      </div>

      {/* Modifiers — only if any are checked */}
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
  </div>
);
                    })()}
                  </CollapsiblePanel>
                </div>
              </section>
            </div>

            {/* Chapter 3 checklist panel */}
            <div id="ch3" style={{ scrollMarginTop: 12 }}>
              <section style={cardStyle}>
                <div style={cardHeaderStyle}>
                  <div>
                    <div style={moduleTagStyle}>CH 3</div>
                    <h2 style={cardTitleStyle}>Chapter 3: Occupancy Classification and Use</h2>
                    <p style={{ margin: "4px 0 0", fontSize: 14, color: "#555", fontWeight: 400 }}>
                      This chapter controls the classification of all buildings and structures as to occupancy and use.
                    </p>
                  </div>
                </div>
                <ChapterChecklist
                  rows={ch3Rows}
                  responses={ch3Responses}
                  setResponses={setCh3Responses}
                  externalCollapsed={ch3Collapsed}
                  setExternalCollapsed={setCh3Collapsed}
                />
              </section>
            </div>

            {/* Chapter 4 checklist panel */}
            <div id="ch4" style={{ scrollMarginTop: 12 }}>
              <section style={cardStyle}>
                <div style={cardHeaderStyle}>
                  <div>
                    <div style={moduleTagStyle}>CH 4</div>
                    <h2 style={cardTitleStyle}>Chapter 4: Special Detailed Requirements Based on Occupancy and Use</h2>
                    <p style={{ margin: "4px 0 0", fontSize: 14, color: "#555", fontWeight: 400 }}>
                      This chapter provides detailed criteria for special uses and occupancies.
                    </p>
                  </div>
                </div>
                <ChapterChecklist
                  rows={ch4Rows}
                  responses={ch4Responses}
                  setResponses={setCh4Responses}
                />
              </section>
            </div>

            {/* Chapter 5 checklist panel */}
            <div id="ch5" style={{ scrollMarginTop: 12 }}>
              <section style={cardStyle}>
                <div style={cardHeaderStyle}>
                  <div>
                    <div style={moduleTagStyle}>CH 5</div>
                    <h2 style={cardTitleStyle}>Chapter 5: General Building Heights and Areas</h2>
                    <p style={{ margin: "4px 0 0", fontSize: 14, color: "#555", fontWeight: 400 }}>
                      This chapter establishes the limits to which a building can be built.
                    </p>
                  </div>
                </div>            
                <ChapterChecklist
                  rows={ch5Rows}
                  responses={ch5Responses}
                  setResponses={setCh5Responses}
                />
              </section>
            </div>


            {/* Chapter 6 checklist panel */}
            <div id="ch6" style={{ scrollMarginTop: 12 }}>
              <section style={cardStyle}>
                <div style={cardHeaderStyle}>
                  <div>
                    <div style={moduleTagStyle}>CH 6</div>
                    <h2 style={cardTitleStyle}>Chapter 6: Types of Construction</h2>
                    <p style={{ margin: "4px 0 0", fontSize: 14, color: "#555", fontWeight: 400 }}>
                      This Chapter establishes five types of construction in which each building must be categorized.
                    </p>
                  </div>
                </div>
                <ChapterChecklist
                  rows={ch6Rows}
                  responses={ch6Responses}
                  setResponses={setCh6Responses}
                />

              </section>
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

function totalAboveGradeArea(project: ProjectState): number {
  return project.stories.filter((s) => s.kind === "above").reduce((acc, s) => acc + sumStorySqft(s), 0);
}

function totalBelowGradeArea(project: ProjectState): number {
  return project.stories.filter((s) => s.kind === "below").reduce((acc, s) => acc + sumStorySqft(s), 0);
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
    for (const area of story.areas) {
      const occ = (area.occupancy ?? "").trim();
      if (occ) set.add(occ);
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
}) {
  const { placeholder, value, onChange, min, max } = props;

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
        border: "1px solid #cfcfcf",
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
  padding: "10px 10px",
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