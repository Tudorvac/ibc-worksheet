"use client";

import * as React from "react";
import type {
  ChecklistRowDef,
  ApplicabilityRule,
  ChecklistChapterResponses,
  ChecklistResponse,
  ChecklistState,
} from "@/lib/types";

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
  NA: { bg: "#d7dbe0", border: "#8a8f98", text: "#4b5563" },
  OFF: { bg: "#fafafa", border: "#cfcfcf", text: "#222" },
};

const UNK_TEXT = "#6b7280";

export type ChapterChecklistProps = {
  // Data
  rows: ChecklistRowDef[];
  applicabilityRules?: ApplicabilityRule[];
  // State
  responses: ChecklistChapterResponses;
  setResponses: (next: ChecklistChapterResponses) => void;
  // Collapse sync (for applicability engine)
  externalCollapsed?: Set<string>;
  setExternalCollapsed?: (s: Set<string>) => void;
};

export function ChapterChecklist(props: ChapterChecklistProps) {
  const { rows, responses, setResponses, externalCollapsed, setExternalCollapsed } = props;

  const [collapsedInternal, setCollapsedInternal] = React.useState<Set<string>>(() => new Set());

  const collapsed = React.useMemo(() => {
    const merged = new Set(collapsedInternal);
    if (externalCollapsed) {
      for (const c of externalCollapsed) merged.add(c);
    }
    return merged;
  }, [collapsedInternal, externalCollapsed]);

  function setCollapsed(updater: (prev: Set<string>) => Set<string>) {
    setCollapsedInternal(updater);
  }

  React.useEffect(() => {
    if (!setExternalCollapsed || !externalCollapsed) return;
    const nextExternal = new Set(externalCollapsed);
    let changed = false;
    for (const c of externalCollapsed) {
      if (!collapsedInternal.has(c)) {
        nextExternal.delete(c);
        changed = true;
      }
    }
    if (changed) setExternalCollapsed(nextExternal);
  }, [collapsedInternal]);

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
    for (const r of rows) {
      if (!r.code) continue;
      if (dotLevel(r.code) === 0) next.add(r.code);
    }
    setCollapsed(() => next);
  }

  function expandAll() {
    setCollapsed(() => new Set());
  }

  function setItemResponse(itemId: string, patch: Partial<ChecklistResponse>) {
    const prev = responses[itemId] ?? { state: "UNSET" as ChecklistState, autoNote: "", userNote: "", noteEdited: false };
    const next = { ...prev, ...patch };
    setResponses({ ...responses, [itemId]: next });
  }

  function setMany(patches: Record<string, Partial<ChecklistResponse>>) {
    const nextResponses: ChecklistChapterResponses = { ...responses };
    for (const [id, patch] of Object.entries(patches)) {
      const prev = nextResponses[id] ?? { state: "UNSET" as ChecklistState, autoNote: "", userNote: "", noteEdited: false };
      nextResponses[id] = { ...prev, ...patch };
    }
    setResponses(nextResponses);
  }

  function codesOfDescendants(parentCode: string): string[] {
    return rows
      .filter((r) => r.code && isDescendant(r.code, parentCode))
      .map((r) => r.code as string);
  }

  function descendantIdsOf(parentCode: string): string[] {
    return rows
      .filter((r) => r.code && isDescendant(r.code, parentCode))
      .map((r) => r.id);
  }

  function summarizeDescendants(parentCode: string) {
    const ids = descendantIdsOf(parentCode);
    let resolved = 0, indet = 0, na = 0, unk = 0;
    for (const id of ids) {
      const state = responses[id]?.state ?? "UNSET";
      if (state === "RESOLVED") resolved++;
      else if (state === "INDET") indet++;
      else if (state === "NA") na++;
      else unk++;
    }
    return { resolved, indet, na, unk, total: ids.length };
  }

function ancestorCodesOf(code: string): string[] {
  const parts = code.split(".");
  const ancestors: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    ancestors.push(parts.slice(0, i).join("."));
  }
  return ancestors;
}

  const hasChildrenByCode = React.useMemo(() => {
    const map: Record<string, boolean> = {};
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.code) continue;
      for (let j = i + 1; j < rows.length; j++) {
        const next = rows[j];
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
  }, [rows]);

  const visibleRows = React.useMemo(() => {
    const out: typeof rows = [];
    for (const row of rows) {
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
  }, [collapsed, rows]);

  const itemNumberById = React.useMemo(() => {
    const map: Record<string, number> = {};
    let n = 0;
    for (const row of rows) {
      if (!row.code) continue;
      if ((responses[row.id]?.state ?? "UNSET") === "INDET") {
        n++;
        map[row.id] = n;
      }
    }
    return map;
  }, [responses, rows]);

  function handleNaClick(rowId: string, rowCode: string, hasKids: boolean) {
  const r = responses[rowId] ?? { state: "UNSET" as ChecklistState, autoNote: "", userNote: "", noteEdited: false };
  const next = nextState(r.state, "NA");
  const patch: Record<string, Partial<ChecklistResponse>> = {
    [rowId]: { 
      state: next,
      autoNote: next === "NA" ? "Not Applicable." : "",
    },
  };

  let collapseOps: { mode: "add" | "remove"; codes: string[] } | null = null;

  if (hasKids) {
    const descIds = rows
      .filter((rr) => rr.code && isDescendant(rr.code, rowCode))
      .map((rr) => rr.id);

    if (next === "NA") {
      for (const id of descIds) patch[id] = { state: "NA", autoNote: "Not Applicable." };
      collapseOps = { mode: "add", codes: [rowCode] };
    } else {
      for (const id of descIds) {
        const cur = responses[id]?.state ?? "UNSET";
        if (cur === "NA") patch[id] = { state: "UNSET", autoNote: "" };
      }
      collapseOps = { mode: "remove", codes: [rowCode, ...codesOfDescendants(rowCode)] };
    }
  }

  // If un-N/A-ing, clear any N/A ancestors
  if (next !== "NA") {
    for (const ancestorCode of ancestorCodesOf(rowCode)) {
      const ancestorRow = rows.find((r) => r.code === ancestorCode);
      if (!ancestorRow) continue;
      const ancestorState = responses[ancestorRow.id]?.state ?? "UNSET";
      if (ancestorState === "NA") {
        patch[ancestorRow.id] = { state: "UNSET", autoNote: "" };
      }
    }
  }

  setMany(patch);

  if (collapseOps) {
    setCollapsed((prev) => {
      const nextSet = new Set(prev);
      for (const c of collapseOps!.codes) {
        if (collapseOps!.mode === "add") nextSet.add(c);
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

  function handleMainSectionClick(
  rowId: string,
  rowCode: string,
  clicked: Exclude<ChecklistState, "UNSET">
) {
  const r = responses[rowId] ?? { state: "UNSET" as ChecklistState, note: "" };
  const next = nextState(r.state, clicked);

  if (clicked !== "NA") {
    setItemResponse(rowId, { state: next });
    return;
  }

  // N/A cascades to all descendants with autoNote
  const descIds = descendantIdsOf(rowCode);
  const patch: Record<string, Partial<ChecklistResponse>> = {
    [rowId]: { state: next, autoNote: next === "NA" ? "Not Applicable." : "" },
  };
  for (const id of descIds) {
    patch[id] = { state: next, autoNote: next === "NA" ? "Not Applicable." : "" };
  }

  setMany(patch);

  setCollapsed((prev) => {
    const nextSet = new Set(prev);
    if (next === "NA") nextSet.add(rowCode);
    else {
      nextSet.delete(rowCode);
      for (const c of codesOfDescendants(rowCode)) nextSet.delete(c);
    }
    return nextSet;
  });
}

  return (
    <div style={{ width: "100%" }}>
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
            padding: "4px 8px",
            borderBottom: "1px solid #d0d0d0",
            background: "#fafafa",
            fontSize: 10,
            fontWeight: 800,
            color: "#333",
          }}
        >
          <div>Resolv. / Indet. / N/A</div>
          <div>Code Section</div>
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
                    fontWeight: 800,
                    color: "#444",
                    background: "#fff",
                    borderBottom: "1px solid #e9e9e9",
                  }}
                >
                  {row.title}
                </div>
              );
            }

            const r = responses[row.id] ?? { state: "UNSET" as ChecklistState, autoNote: "", userNote: "", noteEdited: false };
            const level = dotLevel(row.code);
            const indentPx = Math.min(level, 4) * 14;
            const hasKids = !!hasChildrenByCode[row.code];
            const isCollapsedHere = collapsed.has(row.code);
            const isMainSection = level === 0;
            const effectiveState: ChecklistState = r.state;
            const rowIsNA = effectiveState === "NA";

            const summary =
              isMainSection && isCollapsedHere && hasKids ? summarizeDescendants(row.code) : null;

            const mainTextColor = rowIsNA ? "rgba(17, 17, 17, 0.5)" : "#111";
            const codeTextColor = rowIsNA ? "rgba(51, 51, 51, 0.5)" : "#333";
            const chevronColor = hasKids
              ? rowIsNA ? "rgba(68, 68, 68, 0.5)" : "#444"
              : "transparent";

            return (
              <div
                key={row.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "120px 1fr 280px 60px",
                  gap: 6,
                  alignItems: "center",
                  padding: isMainSection ? "2px 10px" : "2px 10px",
                  borderBottom: `1px solid ${isMainSection ? "#d0d0d0" : "#e9e9e9"}`,
                  background: rowIsNA ? "#f9fafb" : isMainSection ? "#f0f4ff" : "#fff",
                }}
              >
                {/* LEFT CONTROL CELL */}
                <div style={{ display: "flex", gap: 4 }}>
                  {isMainSection ? (
                    <>
                      <button
                        type="button"
                        title="Resolved"
                        onClick={() => handleMainSectionClick(row.id, row.code, "RESOLVED")}
                        style={stateBtnStyle("RESOLVED", r.state === "RESOLVED")}
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        title="Indeterminate"
                        onClick={() => handleMainSectionClick(row.id, row.code, "INDET")}
                        style={stateBtnStyle("INDET", r.state === "INDET")}
                      >
                        ?
                      </button>
                      <button
                        type="button"
                        title="Not Applicable"
                        onClick={() => handleMainSectionClick(row.id, row.code, "NA")}
                        style={stateBtnStyle("NA", r.state === "NA")}
                      >
                        N/A
                      </button>
                    </>
                  ) : (
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

                {/* Section / Title cell */}
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
                  <div style={{ display: "flex", alignItems: "baseline", minWidth: 0 }}>
                    <button
                      type="button"
                      aria-label={hasKids ? (isCollapsedHere ? "Expand" : "Collapse") : "No subsections"}
                      disabled={!hasKids}
                      onClick={() => hasKids && toggleCollapsed(row.code)}
                      style={{
                        width: 16,
                        height: 14,
                        border: "none",
                        background: "transparent",
                        padding: 8,
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
                        gridTemplateColumns: isMainSection ? "30px 1fr" : "55px 1fr",
                        columnGap: isMainSection ? 6 : 10,
                        alignItems: "baseline",
                        minWidth: 0,
                      }}
                    >
                      <div 
                        style={{ 
                          fontWeight: level === 0 ? 700 : 500,
                          color: rowIsNA ? "rgba(51,51,51,0.5)" : isMainSection ? "#1e3a8a" : "#333",
                          whiteSpace: "nowrap",
                          fontSize: isMainSection ? 13 : 13,
                        }}
                      >
                        {row.code}
                      </div>
                      <div
                        style={{
                          color: rowIsNA ? "rgba(17,17,17,0.5)" : isMainSection ? "#1e3a8a" : "#111",
                          fontWeight: level === 0 ? 700 : 500,
                          fontSize: isMainSection ? 13 : 13,
                          lineHeight: 1.15,
                          minWidth: 0,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {row.title}
                      </div>
                    </div>
                  </div>

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

                {/* Notes */}
                <NotesField
                  autoNote={r.autoNote ?? ""}
                  userNote={r.userNote ?? ""}
                  noteEdited={r.noteEdited ?? false}
                  onChange={(newUserNote, newNoteEdited) =>
                    setItemResponse(row.id, { userNote: newUserNote, noteEdited: newNoteEdited })
                  }
                  dim={rowIsNA}
                />

                {/* Item number */}
                <div
                  style={{
                    textAlign: "right",
                    fontWeight: 800,
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
        fontWeight: 600,
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

function NotesField(props: {
  autoNote: string;
  userNote: string;
  noteEdited: boolean;
  onChange: (userNote: string, noteEdited: boolean) => void;
  dim?: boolean;
}) {
  const { autoNote, userNote, noteEdited, onChange, dim } = props;
  const [focused, setFocused] = React.useState(false);

  const displayValue = noteEdited ? userNote : autoNote;
  const isAuto = !noteEdited && !!autoNote;

  function handleChange(val: string) {
    if (val === "") {
      onChange("", false);
    } else {
      onChange(val, true);
    }
  }

  const baseStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid #cfcfcf",
    borderRadius: 10,
    fontSize: 11,
    background: dim ? "#f3f4f6" : "#fff",
    color: isAuto ? "#9ca3af" : "#111",
    fontStyle: isAuto ? "italic" : "normal",
  };

  if (!focused) {
    return (
      <input
        value={displayValue}
        placeholder={autoNote ? "" : "Notes…"}
        onFocus={() => setFocused(true)}
        onChange={(e) => handleChange(e.target.value)}
        style={{ ...baseStyle, padding: "4px 8px" }}
      />
    );
  }

  return (
    <textarea
      value={displayValue}
      placeholder={autoNote ? "" : "Notes…"}
      onBlur={() => setFocused(false)}
      onChange={(e) => handleChange(e.target.value)}
      rows={3}
      autoFocus
      style={{ ...baseStyle, padding: "6px 8px", resize: "none" }}
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
    fontWeight: 800,
    lineHeight: 1.1,
    background: c.bg,
    color: c.text,
    cursor: "pointer",
    userSelect: "none",
    minWidth: 34,
  };
}

const topActionBtnStyle: React.CSSProperties = {
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
