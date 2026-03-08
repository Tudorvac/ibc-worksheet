"use client";

import * as React from "react";
import type { ChecklistSectionDef } from "@/content/checklists/ch3";

export type ChecklistState = "UNSET" | "RESOLVED" | "INDET" | "NA";

export type ChecklistResponse = {
  state: ChecklistState;
  note: string;
};

export type ChecklistChapterResponses = Record<string, ChecklistResponse>;

function nextState(current: ChecklistState, clicked: Exclude<ChecklistState, "UNSET">): ChecklistState {
  // clicking active state clears to UNSET
  return current === clicked ? "UNSET" : clicked;
}

function StateButton(props: {
  label: string;
  title: string;
  active: boolean;
  onClick: () => void;
}) {
  const { label, title, active, onClick } = props;

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        border: "1px solid #cfcfcf",
        borderRadius: 10,
        padding: "4px 6px",
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1.1,
        background: active ? "#e9e9e9" : "#fafafa",
        color: "#222",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      {label}
    </button>
  );
}

function NoteField(props: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { value, onChange } = props;
  const [focused, setFocused] = React.useState(false);

  // Single-line appearance; expands on focus (textarea)
  if (!focused) {
    return (
      <input
        value={value}
        placeholder="Notes…"
        onFocus={() => setFocused(true)}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          border: "1px solid #cfcfcf",
          borderRadius: 10,
          padding: "6px 10px",
          fontSize: 12,
          color: "#111",
          background: "#fff",
        }}
      />
    );
  }

  return (
    <textarea
      value={value}
      placeholder="Notes…"
      onBlur={() => setFocused(false)}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
      style={{
        width: "100%",
        border: "1px solid #cfcfcf",
        borderRadius: 10,
        padding: "8px 10px",
        fontSize: 12,
        color: "#111",
        background: "#fff",
        resize: "vertical",
      }}
    />
  );
}

export function ChapterChecklist(props: {
  sections: ChecklistSectionDef[];
  responses: ChecklistChapterResponses;
  setResponses: (next: ChecklistChapterResponses) => void;
  collapsedSectionIds: Set<string>;
  toggleSection: (id: string) => void;
  itemNumberById: Record<string, number | undefined>;
}) {
  const { sections, responses, setResponses, collapsedSectionIds, toggleSection, itemNumberById } = props;

  function setItemResponse(itemId: string, patch: Partial<ChecklistResponse>) {
    const prev = responses[itemId] ?? { state: "UNSET" as ChecklistState, note: "" };
    const next = { ...prev, ...patch };
    setResponses({ ...responses, [itemId]: next });
  }

  function sectionCounts(section: ChecklistSectionDef) {
    let resolved = 0, indet = 0, na = 0, unset = 0;
    for (const item of section.items) {
      const st = (responses[item.id]?.state ?? "UNSET") as ChecklistState;
      if (st === "RESOLVED") resolved++;
      else if (st === "INDET") indet++;
      else if (st === "NA") na++;
      else unset++;
    }
    return { resolved, indet, na, unset };
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {sections.map((section) => {
        const collapsed = collapsedSectionIds.has(section.id);
        const c = sectionCounts(section);

        return (
          <div key={section.id} style={{ border: "1px solid #e5e5e5", borderRadius: 14, background: "#fff" }}>
            {/* Section header */}
            <button
              type="button"
              onClick={() => toggleSection(section.id)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                border: "none",
                background: "#fafafa",
                borderTopLeftRadius: 14,
                borderTopRightRadius: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ fontWeight: 800, color: "#222" }}>
                {collapsed ? "▸ " : "▾ "}
                {section.title}
              </div>

              <div style={{ display: "flex", gap: 8, fontSize: 12, color: "#333" }}>
                <span title="Resolved">R: {c.resolved}</span>
                <span title="Indeterminate">I: {c.indet}</span>
                <span title="Not Applicable">N/A: {c.na}</span>
                <span title="Unset">—: {c.unset}</span>
              </div>
            </button>

            {/* Items */}
            {!collapsed && (
              <div style={{ padding: "10px 12px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {section.items.map((item) => {
                    const r = responses[item.id] ?? { state: "UNSET" as ChecklistState, note: "" };
                    const itemNo = itemNumberById[item.id];

                    return (
                      <div
                        key={item.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "140px 1fr 60px 2fr",
                          gap: 10,
                          alignItems: "center",
                          padding: "8px 10px",
                          border: "1px solid #efefef",
                          borderRadius: 12,
                          background: r.state === "NA" ? "#f7f7f7" : "#fff",
                          opacity: r.state === "NA" ? 0.85 : 1,
                        }}
                      >
                        {/* State control */}
                        <div style={{ display: "flex", gap: 6 }}>
                          <StateButton
                            label="R"
                            title="Resolved"
                            active={r.state === "RESOLVED"}
                            onClick={() => setItemResponse(item.id, { state: nextState(r.state, "RESOLVED") })}
                          />
                          <StateButton
                            label="I"
                            title="Indeterminate"
                            active={r.state === "INDET"}
                            onClick={() => setItemResponse(item.id, { state: nextState(r.state, "INDET") })}
                          />
                          <StateButton
                            label="N/A"
                            title="Not Applicable"
                            active={r.state === "NA"}
                            onClick={() => setItemResponse(item.id, { state: nextState(r.state, "NA") })}
                          />
                        </div>

                        {/* Notes */}
                        <NoteField
                          value={r.note}
                          onChange={(v) => setItemResponse(item.id, { note: v })}
                        />

                        {/* Item number (only for Indeterminate) */}
                        <div style={{ textAlign: "right", fontWeight: 800, color: "#444" }}>
                          {r.state === "INDET" ? itemNo ?? "" : ""}
                        </div>

                        {/* Your checklist text */}
                        <div style={{ color: "#111", fontWeight: 600, lineHeight: 1.25 }}>
                          {item.text}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}