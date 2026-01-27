"use client";

import React from "react";
import { ProjectState } from "@/lib/types";
import { syncStoriesFromCounts } from "@/lib/storyGeneration";
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
              <h2 style={cardTitleStyle}>Building Information</h2>
            </div>
          </div>

          <div style={gridStyle}>
            <Field label="Occupancy Groups" placeholder="(output from Module 2)" muted />
            <Field
              label="Stories Above Grade"
              placeholder={String(countAboveStories(project))}
              muted
            />
            <Field label="Total Above-Grade Area" placeholder="(output from Module 2)" muted />
            
            <Field label="Construction Type" placeholder="(dropdown)" />
            <Field
              label="Stories Below Grade"
              placeholder={String(countBelowStories(project))}
              muted
            />
            <Field label="Total Below-Grade Area" placeholder="(output from Module 2)" muted />
            
            <Field label="Sprinklers" placeholder="(dropdown)" />
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

            <Field label="Fire Alarm" placeholder="(dropdown)" />         
          </div>
        </section>

        {/* Module 2 */}
        <section style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div>
              <div style={moduleTagStyle}>MOD 2</div>
              <h2 style={cardTitleStyle}>Building Heights & Areas</h2>
              <p style={{ margin: "6px 0 0", color: "#444", maxWidth: 900 }}>
                Is this user friendly?
              </p>
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
                        Increase Stories Above Grade or Stories Below Grade in Module 1 to begin.
                      </em>
                    </td>
                  </tr>
                ) : (
                  project.stories.map((story) => (
                    <tr key={story.id}>
                      <td style={storyCellStyle}><strong>{story.id}</strong></td>
                      <td style={tdStyle}>—</td>
                      <td style={tdStyle} colSpan={6}>
                        <em style={{ color: "#555" }}>Story {story.id} (areas: {story.areas.length})</em>
                      </td>
                      <td style={tdStyle}>
                        <small style={{ color: "#555" }}>[+ Area] [{story.areas.length === 1 ? "– Story" : "– Area"}]</small>
                      </td>
                    </tr>
                  ))
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
  padding: "8px 10px",
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
  fontSize: 16,
  fontWeight: 700,
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
  padding: "10px 10px",
  borderBottom: "1px solid #d6d6d6",
  background: "#fafafa",
  color: "#333",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  fontSize: 12,
  padding: "10px 10px",
  borderBottom: "1px solid #eee",
  verticalAlign: "top",
  whiteSpace: "nowrap",
};

const storyCellStyle: React.CSSProperties = {
  ...tdStyle,
  background: "#f7f7f7",
};