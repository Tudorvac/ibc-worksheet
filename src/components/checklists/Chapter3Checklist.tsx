"use client";

import * as React from "react";
import { ch3Rows } from "@/content/checklists/ch3";
import type {
  ChecklistChapterResponses,
  ChecklistResponse,
  ChecklistState,
} from "@/components/checklists/ChapterChecklist";

function nextState(
  current: ChecklistState,
  clicked: Exclude<ChecklistState, "UNSET">
): ChecklistState {
  return current === clicked ? "UNSET" : clicked;
}

function dotLevel(code: string): number {
  if (!code) return 0;
  return (code.match(/\./g) ?? []).length;
}

function isDescendant(childCode: string, parentCode: string): boolean {
  return childCode.startsWith(parentCode + ".");
}

type ButtonPalette = {
  bg: string;
  border: string;
  text: string;
};

const BTN: Record<"RESOLVED" | "INDET" | "NA" | "OFF", ButtonPalette> = {
  RESOLVED: { bg: "#e6f4ea", border: "#34a853", text: "#1e7a35" },
  INDET: { bg: "#fde7e7", border: "#d93025", text: "#b3261e" },

  // N/A selected fill darkened ~25% vs prior (#e9ecef -> #d7dbe0-ish)
  NA: { bg: "#d7dbe0", border: "#8a8f98", text: "#4b5563" },

  OFF: { bg: "#fafafa", border: "#cfcfcf", text: "#222" },
};

const UNK_TEXT = "#6b7280";

export function Chapter3Checklist(props: {
  responses: ChecklistChapterResponses;
  setResponses: (next: ChecklistChapterResponses) => void;
}) {
  const { responses, setResponses } = props;

  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set());

  function toggleCollapsed(code: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function collapseAll() {
    const next = new Set<string>();
    for (const r of ch3Rows) {
      if (!r.code) continue;
      if (dotLevel(r.code) === 0) next.add(r.code); // collapse main sections only
    }
    setCollapsed(next);
  }

  function expandAll() {
    setCollapsed(new Set());
  }

  function setItemResponse(itemId: string, patch: Partial<ChecklistResponse>) {
    const prev = responses[itemId] ?? { state: "UNSET" as ChecklistState, note: "" };
    const next = { ...prev, ...patch };
    setResponses({ ...responses, [itemId]: next });
  }

  function setMany(patches: Record<string, Partial<ChecklistResponse>>) {
    const nextResponses: ChecklistChapterResponses = { ...responses };
    for (const [id, patch] of Object.entries(patches)) {
      const prev = nextResponses[id] ?? { state: "UNSET" as ChecklistState, note: "" };
      nextResponses[id] = { ...prev, ...patch };
    }
    setResponses(nextResponses);
  }

  function codesOfDescendants(parentCode: string): string[] {
    return ch3Rows
      .filter((r) => r.code && isDescendant(r.code, parentCode))
      .map((r) => r.code as string);
  }

  function descendantIdsOf(parentCode: string): string[] {
    return ch3Rows
      .filter((r) => r.code && isDescendant(r.code, parentCode))
      .map((r) => r.id);
  }

  // MAIN-SECTION AGGREGATION (301, 302, 303...)
  // Priority: any INDET → INDET; else any RESOLVED → RESOLVED; else all NA → NA; else UNSET
  function aggregateStateForMainSection(parentCode: string): ChecklistState {
    const ids = descendantIdsOf(parentCode);
    if (ids.length === 0) return "UNSET";

    let anyIndet = false;
    let anyResolved = false;
    let allNA = true;

    for (const id of ids) {
      const st = responses[id]?.state ?? "UNSET";
      if (st === "INDET") anyIndet = true;
      if (st === "RESOLVED") anyResolved = true;
      if (st !== "NA") allNA = false;
    }

    if (anyIndet) return "INDET";
    if (anyResolved) return "RESOLVED";
    if (allNA) return "NA";
    return "UNSET";
  }

  function summarizeDescendants(parentCode: string) {
    const ids = descendantIdsOf(parentCode);

    let resolved = 0;
    let indet = 0;
    let na = 0;
    let unk = 0;

    for (const id of ids) {
      const state = responses[id]?.state ?? "UNSET";
      if (state === "RESOLVED") resolved += 1;
      else if (state === "INDET") indet += 1;
      else if (state === "NA") na += 1;
      else unk += 1;
    }

    return { resolved, indet, na, unk, total: ids.length };
  }

  const hasChildrenByCode = React.useMemo(() => {
    const map: Record<string, boolean> = {};
    for (let i = 0; i < ch3Rows.length; i++) {
      const row = ch3Rows[i];
      if (!row.code) continue;

      for (let j = i + 1; j < ch3Rows.length; j++) {
        const next = ch3Rows[j];
        if (!next.code) continue;

        if (!isDescendant(next.code, row.code) && dotLevel(next.code) <= dotLevel(row.code)) break;

        if (isDescendant(next.code, row.code)) {
          map[row.code] = true;
          break;
        }
      }
      if (map[row.code] === undefined) map[row.code] = false;
    }
    return map;
  }, []);

  const visibleRows = React.useMemo(() => {
    const out: typeof ch3Rows = [];

    for (const row of ch3Rows) {
      if (!row.code) {
        out.push(row);
        continue;
      }

      const parts = row.code.split(".");
      let hidden = false;
      for (let k = 1; k < parts.length; k++) {
        const ancestor = parts.slice(0, k).join(".");
        if (collapsed.has(ancestor)) {
          hidden = true;
          break;
        }
      }
      if (!hidden) out.push(row);
    }

    return out;
  }, [collapsed]);

  const itemNumberById = React.useMemo(() => {
    const map: Record<string, number> = {};
    let n = 0;
    for (const row of ch3Rows) {
      if (!row.code) continue;
      if ((responses[row.id]?.state ?? "UNSET") === "INDET") {
        n += 1;
        map[row.id] = n;
      }
    }
    return map;
  }, [responses]);

  function handleNaClick(rowId: string, rowCode: string, hasKids: boolean) {
    const r = responses[rowId] ?? { state: "UNSET" as ChecklistState, note: "" };
    const next = nextState(r.state, "NA");

    const patch: Record<string, Partial<ChecklistResponse>> = {
      [rowId]: { state: next },
    };

    let collapseOps: { mode: "add" | "remove"; codes: string[] } | null = null;

    if (hasKids) {
      const descIds = ch3Rows
        .filter((rr) => rr.code && isDescendant(rr.code, rowCode))
        .map((rr) => rr.id);

      if (next === "NA") {
        for (const id of descIds) patch[id] = { state: "NA" };
        collapseOps = { mode: "add", codes: [rowCode] };
      } else {
        for (const id of descIds) {
          const cur = responses[id]?.state ?? "UNSET";
          if (cur === "NA") patch[id] = { state: "UNSET" };
        }
        collapseOps = { mode: "remove", codes: [rowCode, ...codesOfDescendants(rowCode)] };
      }
    }

    setMany(patch);

    if (collapseOps) {
      setCollapsed((prev) => {
        const nextSet = new Set(prev);
        for (const c of collapseOps.codes) {
          if (collapseOps.mode === "add") nextSet.add(c);
          else nextSet.delete(c);
        }
        return nextSet;
      });
    }
  }

  function handleResolvedClick(rowId: string) {
    const r = responses[rowId] ?? { state: "UNSET" as ChecklistState, note: "" };
    setItemResponse(rowId, { state: nextState(r.state, "RESOLVED") });
  }

  function handleIndetClick(rowId: string) {
    const r = responses[rowId] ?? { state: "UNSET" as ChecklistState, note: "" };
    setItemResponse(rowId, { state: nextState(r.state, "INDET") });
  }

  return (
    <div style={{ width: "100%" }}>
      {/* Controls only (title lives in parent layout) */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 8 }}>
        <button type="button" onClick={collapseAll} style={topActionBtnStyle}>
          Collapse all
        </button>
        <button type="button" onClick={expandAll} style={topActionBtnStyle}>
          Expand all
        </button>
      </div>

      <div
        style={{
          border: "1px solid #d6d6d6",
          borderRadius: 12,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "140px 1fr 280px 60px",
            gap: 10,
            alignItems: "center",
            padding: "6px 10px",
            borderBottom: "1px solid #d0d0d0",
            background: "#fafafa",
            fontSize: 12,
            fontWeight: 800,
            color: "#333",
          }}
        >
          <div>Resolved / Indet. / N/A</div>
          <div>Section / Title</div>
          <div>Notes</div>
          <div style={{ textAlign: "right" }}>Item</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {visibleRows.map((row) => {
            if (!row.code) {
              return (
                <div
                  key={row.id}
                  style={{
                    padding: "8px 10px",
                    fontWeight: 900,
                    color: "#111",
                    background: "#fff",
                    borderBottom: "1px solid #e9e9e9",
                  }}
                >
                  {row.title}
                </div>
              );
            }

            const r = responses[row.id] ?? { state: "UNSET" as ChecklistState, note: "" };
            const level = dotLevel(row.code);
            const indentPx = Math.min(level, 4) * 14;

            const hasKids = !!hasChildrenByCode[row.code];
            const isCollapsedHere = collapsed.has(row.code);

            const isMainSection = level === 0;

            // MAIN sections show derived indicator state (from descendants)
            const mainAggState = isMainSection ? aggregateStateForMainSection(row.code) : "UNSET";
            const effectiveState: ChecklistState = isMainSection ? mainAggState : r.state;

            const rowIsNA = effectiveState === "NA";

            // summary only when collapsed AND only for main sections (301, 302, 303...)
            const summary =
              isMainSection && isCollapsedHere && hasKids ? summarizeDescendants(row.code) : null;

            // Only dim section number + title (about 50% contrast)
            const mainTextColor = rowIsNA ? "rgba(17, 17, 17, 0.5)" : "#111";
            const codeTextColor = rowIsNA ? "rgba(51, 51, 51, 0.5)" : "#333";
            const chevronColor = hasKids
              ? rowIsNA
                ? "rgba(68, 68, 68, 0.5)"
                : "#444"
              : "transparent";

            return (
              <div
                key={row.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 1fr 280px 60px",
                  gap: 10,
                  alignItems: "center",
                  padding: "4px 10px",
                  borderBottom: "1px solid #e9e9e9",
                  background: "#fff", // no row shading for NA
                }}
              >
                {/* LEFT CONTROL CELL */}
                <div style={{ display: "flex", gap: 6 }}>
                  {isMainSection ? (
                    // Indicators (not clickable) derived from descendants
                    <>
                      <span style={indicatorStyle("RESOLVED", effectiveState === "RESOLVED")}>✓</span>
                      <span style={indicatorStyle("INDET", effectiveState === "INDET")}>?</span>
                      <span style={indicatorStyle("NA", effectiveState === "NA")}>N/A</span>
                    </>
                  ) : (
                    // Subsections are interactive
                    <>
                      <button
                        type="button"
                        title="Resolved"
                        onClick={() => handleResolvedClick(row.id)}
                        style={stateBtnStyle("RESOLVED", r.state === "RESOLVED")}
                      >
                        ✓
                      </button>

                      <button
                        type="button"
                        title="Indeterminate"
                        onClick={() => handleIndetClick(row.id)}
                        style={stateBtnStyle("INDET", r.state === "INDET")}
                      >
                        ?
                      </button>

                      <button
                        type="button"
                        title="Not Applicable"
                        onClick={() => handleNaClick(row.id, row.code, hasKids)}
                        style={stateBtnStyle("NA", r.state === "NA")}
                      >
                        N/A
                      </button>
                    </>
                  )}
                </div>

                {/* Outline cell + right-justified summary */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 10,
                    paddingLeft: indentPx,
                    minWidth: 0,
                  }}
                >
                  {/* Left: chevron + number + title */}
                  <div style={{ display: "flex", alignItems: "baseline", minWidth: 0 }}>
                    <button
                      type="button"
                      aria-label={hasKids ? (isCollapsedHere ? "Expand" : "Collapse") : "No subsections"}
                      disabled={!hasKids}
                      onClick={() => hasKids && toggleCollapsed(row.code)}
                      style={{
                        width: 18,
                        height: 18,
                        border: "none",
                        background: "transparent",
                        padding: 0,
                        cursor: hasKids ? "pointer" : "default",
                        color: chevronColor,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transform: hasKids && !isCollapsedHere ? "rotate(0deg)" : "rotate(-90deg)",
                        transition: "transform 120ms ease",
                        userSelect: "none",
                      }}
                      title={hasKids ? (isCollapsedHere ? "Expand" : "Collapse") : ""}
                    >
                      ▼
                    </button>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "60px 1fr",
                        columnGap: 10,
                        alignItems: "baseline",
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 800,
                          color: codeTextColor,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row.code}
                      </div>

                      <div
                        style={{
                          color: mainTextColor,
                          fontWeight: level === 0 ? 800 : 600,
                          lineHeight: 1.15,
                          minWidth: 0,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {row.title}
                      </div>
                    </div>
                  </div>

                  {/* Right: collapsed summary text */}
                  {summary && (
                    <CollapsedSummaryText
                      resolved={summary.resolved}
                      indet={summary.indet}
                      na={summary.na}
                      unk={summary.unk}
                      dim={rowIsNA}
                    />
                  )}
                </div>

                {/* Notes remain editable; dim only when effective state is NA */}
                <NotesField
                  value={r.note}
                  onChange={(v) => setItemResponse(row.id, { note: v })}
                  dim={rowIsNA}
                />

                <div
                  style={{
                    textAlign: "right",
                    fontWeight: 900,
                    color: rowIsNA ? "rgba(68, 68, 68, 0.5)" : "#444",
                  }}
                >
                  {r.state === "INDET" ? itemNumberById[row.id] ?? "" : ""}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CollapsedSummaryText(props: {
  resolved: number;
  indet: number;
  na: number;
  unk: number;
  dim?: boolean;
}) {
  const { resolved, indet, na, unk, dim } = props;

  return (
    <div
      style={{
        display: "inline-flex",
        gap: 10,
        alignItems: "baseline",
        whiteSpace: "nowrap",
        fontSize: 11,
        fontWeight: 500, // helper text
        opacity: dim ? 0.75 : 1,
      }}
      title="Counts of hidden (collapsed) descendant rows"
    >
      <span style={{ color: BTN.RESOLVED.text }}>✓:{resolved}</span>
      <span style={{ color: BTN.INDET.text }}>?:{indet}</span>
      <span style={{ color: BTN.NA.text }}>N/A:{na}</span>
      <span style={{ color: UNK_TEXT }}>Unk:{unk}</span>
    </div>
  );
}

function NotesField(props: { value: string; onChange: (v: string) => void; dim?: boolean }) {
  const { value, onChange, dim } = props;
  const [focused, setFocused] = React.useState(false);

  const baseStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid #cfcfcf",
    borderRadius: 10,
    fontSize: 12,
    background: dim ? "#f3f4f6" : "#fff",
    color: dim ? "#6b7280" : "#111",
  };

  if (!focused) {
    return (
      <input
        value={value}
        placeholder="Notes…"
        onFocus={() => setFocused(true)}
        onChange={(e) => onChange(e.target.value)}
        style={{
          ...baseStyle,
          padding: "4px 8px",
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
        ...baseStyle,
        padding: "6px 8px",
        resize: "vertical",
      }}
    />
  );
}

function stateBtnStyle(
  kind: "RESOLVED" | "INDET" | "NA",
  active: boolean
): React.CSSProperties {
  const c = active ? BTN[kind] : BTN.OFF;

  return {
    border: `1px solid ${c.border}`,
    borderRadius: 10,
    padding: "3px 6px",
    fontSize: 11,
    fontWeight: 900,
    lineHeight: 1.1,
    background: c.bg,
    color: c.text,
    cursor: "pointer",
    userSelect: "none",
    minWidth: 34,
  };
}

// Non-clickable “summary indicators” for main section rows
function indicatorStyle(
  kind: "RESOLVED" | "INDET" | "NA",
  active: boolean
): React.CSSProperties {
  const c = active ? BTN[kind] : BTN.OFF;

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: `1px solid ${c.border}`,
    borderRadius: 10,
    padding: "3px 6px",
    fontSize: 11,
    fontWeight: 800,
    lineHeight: 1.1,
    background: c.bg,
    color: c.text,
    userSelect: "none",
    minWidth: 34,
    cursor: "default",
    opacity: active ? 1 : 0.85,
  };
}

const topActionBtnStyle: React.CSSProperties = {
  border: "1px solid #cfcfcf",
  borderRadius: 10,
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 700,
  background: "#fafafa",
  color: "#333",
  cursor: "pointer",
  lineHeight: 1,
};