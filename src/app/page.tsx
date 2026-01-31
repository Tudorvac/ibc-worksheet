"use client";

import React from "react";
import { ProjectState } from "@/lib/types";
import { syncStoriesFromCounts } from "@/lib/storyGeneration";
import { DropdownData, loadDropdownsXlsx } from "@/lib/dropdownsXlsx";
export default function Home() {
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

  function updateArea(
    storyId: string,
    areaNo: 1 | 2 | 3 | 4,
    patch: Partial<{ occupancy: string; use: string; description: string; sqft: number | null; mixedUse: string }>
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

  function removeHighestArea(storyId: string) {
    setProject((prev) => ({
      ...prev,
      stories: prev.stories.map((s) => {
        if (s.id !== storyId) return s;
        if (s.areas.length <= 1) return s; // nothing to remove
        return { ...s, areas: s.areas.slice(0, -1) };
      }),
    }));
  }

  function removeStory(storyId: string) {
    setProject((prev) => ({
      ...prev,
      m1: {
        ...prev.m1,
        // keep counts in sync with deletions:
        storiesAbove: prev.stories.filter((s) => s.kind === "above" && s.id !== storyId).length,
        storiesBelow: prev.stories.filter((s) => s.kind === "below" && s.id !== storyId).length,
      },
      stories: prev.stories.filter((s) => s.id !== storyId),
    }));
  }
  function storyTotalSqft(story: { areas: { sqft: number | null }[] }): number {
    return story.areas.reduce((sum, a) => sum + (a.sqft ?? 0), 0);
  }

  function areaPercent(story: { areas: { sqft: number | null }[] }, areaSqft: number | null): string {
    const total = storyTotalSqft(story);
    if (!total || !areaSqft) return "—";
    return `${Math.round((areaSqft / total) * 100)}%`;
  }

  function onOccupancyChange(storyId: string, areaNo: 1 | 2 | 3 | 4, occ: string) {
    // If occupancy changes, clear use to prevent invalid combos
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

  // Whenever M1 counts change, sync M2 story containers
  React.useEffect(() => {
    setProject((prev) => ({
      ...prev,
      stories: syncStoriesFromCounts(prev.stories, prev.m1.storiesAbove, prev.m1.storiesBelow),
    }));
  }, [project.m1.storiesAbove, project.m1.storiesBelow]);
  return (
    <main style={{ padding: "24px", fontFamily: "system-ui, Arial, sans-serif" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <header style={{ marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
            IBC Review Worksheet
          </h1>
          <p style={{ margin: "6px 0 0", color: "#444" }}>
            Prototype (Modules 1–2). Layout-first, behavior next.
          </p>
        </header>

        {/* Module 1 */}
        <section style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div>
              <div style={moduleTagStyle}>MOD 1</div>
              <h2 style={cardTitleStyle}>General Building Information</h2>
            </div>
          </div>

          <div style={gridStyle}>
            <Field label="Occupancy Groups" placeholder={occupancyGroups(project)} muted />
            <Field
              label="Stories Above Grade"
              placeholder={String(countAboveStories(project))}
              muted
            />
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
            <Field
              label="Stories Below Grade"
              placeholder={String(countBelowStories(project))}
              muted
            />
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
              onChange={(next) =>
                setProject((p) => ({ ...p, m1: { ...p.m1, buildingHeight: next } }))
              }
            />
            <FeetInchesInput
              label="Highest Floor"
              value={project.m1.highestFloor}
              onChange={(next) =>
                setProject((p) => ({ ...p, m1: { ...p.m1, highestFloor: next } }))
              }
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

        {/* Module 2 */}
        <section style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div>
              <div style={moduleTagStyle}>MOD 2</div>
              <h2 style={cardTitleStyle}>Building Heights & Areas</h2>              
            </div>
          </div>

          {/* Controls placeholder (we will refine button placement next) */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              style={miniBtnStyle}
              onClick={() =>
                setProject((p) => ({
                  ...p,
                  m1: { ...p.m1, storiesAbove: p.m1.storiesAbove + 1 },
                }))
              }
            >
              + Story (Above)
            </button>

            <button
              type="button"
              style={miniBtnStyle}
              onClick={() =>
                setProject((p) => ({
                  ...p,
                  m1: { ...p.m1, storiesAbove: Math.max(0, p.m1.storiesAbove - 1) },
                }))
              }
            >
              – Story (Above)
            </button>

            <button
              type="button"
              style={miniBtnStyle}
              onClick={() =>
                setProject((p) => ({
                  ...p,
                  m1: { ...p.m1, storiesBelow: p.m1.storiesBelow + 1 },
                }))
              }
            >
              + Story (Below)
            </button>

            <button
              type="button"
              style={miniBtnStyle}
              onClick={() =>
                setProject((p) => ({
                  ...p,
                  m1: { ...p.m1, storiesBelow: Math.max(0, p.m1.storiesBelow - 1) },
                }))
              }
            >
              – Story (Below)
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
                  <th style={thStyle}>Sq. Ft.</th>
                  <th style={thStyle}>%</th>
                  <th style={thStyle}>Mixed Use</th>
                  <th style={thStyle}>Controls</th>
                </tr>
              </thead>
              <tbody>
                {project.stories.length === 0 ? (
                  <tr>
                    <td style={tdStyle} colSpan={9}>
                      <em style={{ color: "#555" }}>
                        Increase stories using the Module 2 controls above.
                      </em>
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
                            // darker separator under each story row (Area 1 row)
                            borderBottom: isStoryRow ? "1px solid #d0d0d0" : "1px solid #efefef",

                            // grade-line emphasis above first below-grade story
                            borderTop:
                              isStoryRow && isFirstBelowGrade ? "2px solid #a8a8a8" : undefined,
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
                                  onChange={(v) =>
                                    updateArea(story.id, area.areaNo, { description: v })
                                  }
                                />
                              </td>

                              <td style={tdStyle}>
                                <TableNumberInput
                                  value={area.sqft}
                                  placeholder="Sq. Ft."
                                  onChange={(v) => updateArea(story.id, area.areaNo, { sqft: v })}
                                />
                              </td>

                              <td style={tdStyle}>
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
                                    onChange={(v) =>
                                      updateArea(story.id, area.areaNo, { mixedUse: v })
                                    }
                                  />
                                )}
                              </td>

                              <td style={tdStyle}>
                                {area.areaNo === 1 ? (
                                  <div
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: 4,
                                      width: 92,
                                    }}
                                  >
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
                                  </div>
                                ) : (
                                  <div style={{ width: 92 }}>
                                    {story.areas.length > 1 &&
                                    area.areaNo === story.areas[story.areas.length - 1].areaNo ? (
                                      <TableAction
                                        label="– Area"
                                        onClick={() => removeHighestArea(story.id)}
                                      />
                                    ) : (
                                      <span style={{ color: "#888", fontSize: 12 }}>—</span>
                                    )}
                                  </div>
                                )}
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

        {/* Module 3 placeholder */}
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
    </main>
  );
}

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
  return project.stories
    .filter((s) => s.kind === "above")
    .reduce((acc, s) => acc + sumStorySqft(s), 0);
}

function totalBelowGradeArea(project: ProjectState): number {
  return project.stories
    .filter((s) => s.kind === "below")
    .reduce((acc, s) => acc + sumStorySqft(s), 0);
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

/** Small components (layout only) */

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
        padding: "2px 2px",          // smaller
        background: disabled ? "#f7f7f7" : "#fafafa",
        color: disabled ? "#999999" : "#222",
        fontSize: 11,                // smaller
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        lineHeight: 1.1,
        whiteSpace: "nowrap",
        width: "60%",               // makes stacking clean
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
        padding: "6px 8px",
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

function TableTextInput(props: {
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
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
        padding: "6px 8px",
        background: "#fff",
        color: "#111",
        fontWeight: 500,
      }}
    />
  );
}

function TableNumberInput(props: {
  value: number | null;
  placeholder?: string;
  onChange: (v: number | null) => void;
}) {
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

        // remove commas so we can parse
        const normalized = raw.replace(/,/g, "");
        const n = Number(normalized);
        if (!Number.isFinite(n)) return;

        onChange(Math.max(0, Math.floor(n))); // whole number, non-negative
      }}
      style={{
        width: "100%",
        border: "1px solid #cfcfcf",
        borderRadius: 8,
        padding: "6px 8px",
        background: "#fff",
        color: "#111",
        fontWeight: 500,
      }}
    />
  );
}

function Chip(props: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid #cfcfcf",
        borderRadius: 999,
        padding: "6px 10px",
        fontSize: 12,
        color: "#333",
        background: "#fafafa",
      }}
    >
      {props.children}
    </div>
  );
}

function Stepper(props: { label: string; value: number; onChange: (v: number) => void }) {
  const { label, value, onChange } = props;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          style={miniBtnStyle}
          aria-label={`Decrease ${label}`}
        >
          –
        </button>
        <div
          style={{
            border: "1px solid #cfcfcf",
            borderRadius: 8,
            padding: "10px 12px",
            minWidth: 56,
            textAlign: "center",
            background: "#fff",
          }}
        >
          {value}
        </div>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          style={miniBtnStyle}
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
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

        <span style={{ color: "#666", fontSize: 12 }}>
          ({formatFeetInches(value)})
        </span>
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

        const bounded =
          typeof min === "number" ? Math.max(min, n) : n;

        const bounded2 =
          typeof max === "number" ? Math.min(max, bounded) : bounded;

        onChange(Math.floor(bounded2));
      }}
      style={{
        border: "1px solid #cfcfcf",
        borderRadius: 8,
        padding: "10px 12px",
        width: 70,
        background: "#fff",
        color: "#111",       // ← fixes contrast
        fontWeight: 500,     // ← improves legibility
      }}
    />
  );
}

function formatFeetInches(v: { feet: number | null; inches: number | null }): string {
  const ft = v.feet ?? 0;
  const inch = v.inches ?? 0;
  // Display only if at least one field is entered
  if (v.feet === null && v.inches === null) return "—";
  return `${ft}'-${inch}"`;
}

/** Styles */
const cardStyle: React.CSSProperties = {
  border: "1px solid #d6d6d6",
  borderRadius: 14,
  padding: 16,
  background: "#fff",
  marginBottom: 14,
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

const thStyle: React.CSSProperties = {
  textAlign: "left",
  fontSize: 12,
  padding: "7px 8px",                 // was 10px 10px
  borderBottom: "1px solid #d0d0d0",   // slightly darker header line
  background: "#fafafa",
  color: "#333",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  fontSize: 12,
  padding: "6px 8px",                 // was 10px 10px
  borderBottom: "1px solid #efefef",   // lighter area-row lines
  verticalAlign: "top",
  whiteSpace: "nowrap",
};

const storyCellStyle: React.CSSProperties = {
  ...tdStyle,
  background: "#f7f7f7",
};

const CONSTRUCTION_TYPES = ["I-A", "I-B", "II-A", "II-B", "III-A", "III-B", "IV", "V-A", "V-B"];
const YES_NO = ["Yes", "No"];