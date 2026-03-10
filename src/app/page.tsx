"use client";

import React from "react";
import { Chapter3Checklist } from "@/components/checklists/Chapter3Checklist";
import type { ChecklistChapterResponses } from "@/lib/types";
import { ProjectState } from "@/lib/types";
import { syncStoriesFromCounts } from "@/lib/storyGeneration";
import { DropdownData, loadDropdownsXlsx } from "@/lib/dropdownsXlsx";
import {
  computeNaRowIds,
  findConflicts,
  getCodeForId,
  applyNaUpdates,
  computeCollapsedFromNa,
} from "@/lib/applicability";

export default function Home() {
  const [ch3Responses, setCh3Responses] = React.useState<ChecklistChapterResponses>({});
  const [ch3Collapsed, setCh3Collapsed] = React.useState<Set<string>>(new Set());
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
    },
    stories: [],
  }));

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
    updateArea(storyId, areaNo, { occupancy: occ, use: "" });
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
    <main style={{ padding: "24px", fontFamily: "system-ui, Arial, sans-serif" }}>

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

      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <header style={{ marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#989898" }}>2024 IBC Review Worksheet</h1>
          <p style={{ margin: "6px 0 0", color: "#989898" }}>
            This review worksheet assists in evaluating buildings for compliance with the 2024 International Building Code. It functions primarily as a dynamic checklist system driven by project inputs, while also serving as a formal record of the plan review.
          </p>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 14 }}>
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
              padding: 12,
              background: "#fff",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 0.8,
                color: "#666",
                marginBottom: 10,
              }}
            >
              MODULES
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button type="button" style={navBtnStyle} onClick={() => scrollToId("mod1")}>
                MOD 1
              </button>
              <button type="button" style={navBtnStyle} onClick={() => scrollToId("mod2")}>
                MOD 2
              </button>
              <button type="button" style={navBtnStyle} onClick={() => scrollToId("mod3")}>
                MOD 3
              </button>
            </div>

            <div style={{ height: 14 }} />

            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 0.8,
                color: "#666",
                marginBottom: 10,
              }}
            >
              CODE CHECKLISTS
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button type="button" style={navBtnStyle} onClick={() => scrollToId("ch3")}>
                CH 3
              </button>
              <button type="button" style={navBtnDisabledStyle} disabled>
                CH 4
              </button>
              <button type="button" style={navBtnDisabledStyle} disabled>
                CH 5
              </button>
              <button type="button" style={navBtnDisabledStyle} disabled>
                CH 6
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
                    <h2 style={cardTitleStyle}>General Building Information</h2>
                  </div>
                </div>

                <div style={gridStyle}>
                  <Field label="Occupancy Groups" placeholder={occupancyGroups(project)} muted />
                  <Field label="Stories Above Grade" placeholder={String(countAboveStories(project))} muted />
                  <Field
                    label="Total Above-Grade Area"
                    placeholder={totalAboveGradeArea(project).toLocaleString()}
                    muted
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
                </div>
              </section>
            </div>

            {/* Module 2 */}
            <div id="mod2" style={{ scrollMarginTop: 12 }}>
              <section style={cardStyle}>
                <div style={cardHeaderStyle}>
                  <div>
                    <div style={moduleTagStyle}>MOD 2</div>
                    <h2 style={cardTitleStyle}>General Building Heights & Areas</h2>
                    <div>This module establishes building heights, areas, occupancies, and uses including mezzanines, accessory and mixed occupancies.</div>
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
                          <td style={tdStyle} colSpan={9}>
                            <em style={{ color: "#555" }}>Increase stories using the Module 2 controls above.</em>
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

                                    <td style={tdStyle}>
                                      <TableSelect
                                        value={area.occupancy}
                                        options={occOptions}
                                        placeholder="Occupancy…"
                                        onChange={(v) => onOccupancyChange(story.id, area.areaNo, v)}
                                      />
                                    </td>

                                    <td style={tdStyle}>
                                      <TableSelect
                                        value={area.use}
                                        options={useOptions}
                                        placeholder={area.occupancy ? "Use…" : "Select occupancy first"}
                                        disabled={!area.occupancy}
                                        onChange={(v) => updateArea(story.id, area.areaNo, { use: v })}
                                      />
                                    </td>

                                    <td style={tdStyle}>
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

            {/* Module 3 placeholder */}
            <div id="mod3" style={{ scrollMarginTop: 12 }}>
              <section style={cardStyle}>
                <div style={cardHeaderStyle}>
                  <div>
                    <div style={moduleTagStyle}>MOD 3</div>
                    <h2 style={cardTitleStyle}>Other Building Information</h2>
                    <p style={{ margin: "6px 0 0", color: "#444" }}>
                      Placeholder — Module 3 will be designed after Modules 1–2 are stable.
                    </p>
                  </div>
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
                    <p style={{ margin: "6px 0 0", color: "#444" }}>
                      This chapter controls the classification of all buildings and structures as to occupancy and use. 
                    </p>
                  </div>
                </div>

                <Chapter3Checklist
                  responses={ch3Responses}
                  setResponses={setCh3Responses}
                  externalCollapsed={ch3Collapsed}
                  setExternalCollapsed={setCh3Collapsed}
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

/* ---- Small components ---- */

function Field(props: { label: string; placeholder: string; muted?: boolean }) {
  const { label, placeholder, muted } = props;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>{label}</div>
      <div
        style={{
          border: "1px solid #cfcfcf",
          borderRadius: 8,
          padding: "10px 12px",
          background: muted ? "#f6f6f6" : "#fff",
          color: muted ? "#666" : "#111",
        }}
      >
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
      <div style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          border: "1px solid #cfcfcf",
          borderRadius: 8,
          padding: "10px 12px",
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
}) {
  const { label, value, onChange } = props;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>{label}</div>

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
        padding: "10px 12px",
        width: 70,
        background: "#fff",
        color: "#111",
        fontWeight: 500,
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
  fontSize: 13,
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
  padding: "6px 8px",
  fontSize: 14,
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
  fontSize: 11,
  letterSpacing: 0.8,
  fontWeight: 700,
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
  color: "#555",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
};

const tableWrapStyle: React.CSSProperties = {
  border: "1px solid #d6d6d6",
  borderRadius: 12,
  overflowX: "auto",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 980,
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