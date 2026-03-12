import React from "react";
import { ch4Rows } from "@/content/checklists/ch4";
import {
  ChecklistChapterResponses,
  ChecklistResponse,
  ChecklistState,
} from "@/lib/types";

type Props = {
  responses: ChecklistChapterResponses;
  setResponses: React.Dispatch<React.SetStateAction<ChecklistChapterResponses>>;
  externalCollapsed?: Set<string>;
  setExternalCollapsed?: React.Dispatch<React.SetStateAction<Set<string>>>;
};

const BTN = {
  RESOLVED: { bg: "#dcfce7", border: "#86efac", text: "#166534" },
  INDET:    { bg: "#fef9c3", border: "#fde047", text: "#713f12" },
  NA:       { bg: "#f3f4f6", border: "#d1d5db", text: "#374151" },
  OFF:      { bg: "#fff",    border: "#e5e7eb", text: "#9ca3af" },
};

function stateBtnStyle(
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
    cursor: "pointer",
    userSelect: "none",
    minWidth: 34,
  };
}

function nextState(
  current: ChecklistState,
  clicked: Exclude<ChecklistState, "UNSET">
): ChecklistState {
  return current === clicked ? "UNSET" : clicked;
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

  const baseStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid #cfcfcf",
    borderRadius: 10,
    fontSize: 12,
    background: dim ? "#f3f4f6" : "#fff",
    color: isAuto ? "#9ca3af" : "#111",
    fontStyle: isAuto ? "italic" : "normal",
  };

  function handleChange(val: string) {
    if (val === "") {
      onChange("", false);
    } else {
      onChange(val, true);
    }
  }

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
      autoFocus
      rows={3}
      style={{ ...baseStyle, padding: "6px 8px", resize: "none" }}
    />
  );
}

export default function Chapter4Checklist({ responses, setResponses, externalCollapsed, setExternalCollapsed }: Props) {
  const [collapsedInternal, setCollapsedInternal] = React.useState<Set<string>>(new Set());

  const collapsed = React.useMemo(() => {
    const merged = new Set(collapsedInternal);
    if (externalCollapsed) {
      for (const c of externalCollapsed) merged.add(c);
    }
    return merged;
  }, [collapsedInternal, externalCollapsed]);

  React.useEffect(() => {
    if (setExternalCollapsed) {
      setExternalCollapsed((prev) => {
        const next = new Set(prev);
        let changed = false;
        for (const c of collapsedInternal) {
          if (!next.has(c)) { next.add(c); changed = true; }
        }
        return changed ? next : prev;
      });
    }
  }, [collapsedInternal, setExternalCollapsed]);

  const setCollapsed = React.useCallback(
    (updater: (prev: Set<string>) => Set<string>) => {
      setCollapsedInternal((prev) => updater(prev));
      if (setExternalCollapsed) {
        setExternalCollapsed((prev) => updater(prev));
      }
    },
    [setExternalCollapsed]
  );

  // Indeterminate item counter (per main section)
  const indetCounters = React.useRef<Record<string, number>>({ });

  function getR(id: string): ChecklistResponse {
    return responses[id] ?? { state: "UNSET", autoNote: "", userNote: "", noteEdited: false };
  }

  function setItemResponse(id: string, patch: Partial<ChecklistResponse>) {
    setResponses((prev) => ({
      ...prev,
      [id]: { ...getR(id), ...patch },
    }));
  }

  function setMany(patches: Record<string, Partial<ChecklistResponse>>) {
    setResponses((prev) => {
      const next = { ...prev };
      for (const [id, patch] of Object.entries(patches)) {
        next[id] = { ...(next[id] ?? { state: "UNSET", autoNote: "", userNote: "", noteEdited: false }), ...patch };
      }
      return next;
    });
  }

  // Get all descendant row ids for a main section code
  function descendantIdsOf(sectionCode: string): string[] {
    const ids: string[] = [];
    let inside = false;
    for (const row of ch4Rows) {
      if (row.isMainSection) {
        if (inside) break;
        if (row.code === sectionCode) { inside = true; continue; }
      }
      if (inside) ids.push(row.id);
    }
    return ids;
  }

  function handleMainSectionClick(
    rowId: string,
    rowCode: string,
    clicked: Exclude<ChecklistState, "UNSET">
  ) {
    const r = getR(rowId);
    const next = nextState(r.state, clicked);
    const descIds = descendantIdsOf(rowCode);
    const patch: Record<string, Partial<ChecklistResponse>> = { [rowId]: { state: next } };
    for (const id of descIds) patch[id] = { state: next };
    setMany(patch);

    if (clicked === "NA") {
      setCollapsed((prev) => {
        const nextSet = new Set(prev);
        if (next === "NA") nextSet.add(rowCode);
        else nextSet.delete(rowCode);
        return nextSet;
      });
    }
  }

  function handleIndetClick(rowId: string, sectionCode: string) {
    const r = getR(rowId);
    if (r.state === "INDET") {
      setItemResponse(rowId, { state: "UNSET" });
    } else {
      const counter = (indetCounters.current[sectionCode] ?? 0) + 1;
      indetCounters.current[sectionCode] = counter;
      setItemResponse(rowId, { state: "INDET" });
    }
  }

  // Collapse / expand controls
  const allSectionCodes = ch4Rows.filter((r) => r.isMainSection).map((r) => r.code);

  function collapseAll() {
    setCollapsed(() => new Set(allSectionCodes));
  }

  function expandAll() {
    setCollapsed(() => new Set());
  }

  // Count collapsed summary
  function collapsedSummary(sectionCode: string): string {
    const ids = descendantIdsOf(sectionCode);
    let r = 0, i = 0, na = 0;
    for (const id of ids) {
      const s = responses[id]?.state ?? "UNSET";
      if (s === "RESOLVED") r++;
      else if (s === "INDET") i++;
      else if (s === "NA") na++;
    }
    const parts: string[] = [];
    if (r > 0) parts.push(`${r}✓`);
    if (i > 0) parts.push(`${i}?`);
    if (na > 0) parts.push(`${na} N/A`);
    const total = ids.length;
    const done = r + na;
    return parts.length > 0 ? `${done}/${total} — ${parts.join(" · ")}` : `0/${total}`;
  }

  // Render
  let currentSection = "";
  let indetIndex = 0;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
        padding: "0 4px",
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#111" }}>Chapter 4 — Special Detailed Requirements</div>
          <div style={{ fontSize: 14, color: "#555", fontWeight: 400, margin: "4px 0 0" }}>
            This chapter provides detailed requirements for buildings and structures based on specific occupancies and uses beyond the general provisions of other chapters.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={collapseAll} style={{ fontSize: 12, padding: "4px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "#f9fafb", cursor: "pointer", fontWeight: 600 }}>
            Collapse All
          </button>
          <button type="button" onClick={expandAll} style={{ fontSize: 12, padding: "4px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "#f9fafb", cursor: "pointer", fontWeight: 600 }}>
            Expand All
          </button>
        </div>
      </div>

      {/* Column Header */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "140px 1fr 280px 60px",
        gap: 10,
        alignItems: "center",
        padding: "4px 8px",
        borderBottom: "1px solid #d0d0d0",
        background: "#fafafa",
        fontSize: 12,
        fontWeight: 800,
        color: "#333",
      }}>
        <div>Status</div>
        <div>Section</div>
        <div>Notes</div>
        <div style={{ textAlign: "center" }}>Item #</div>
      </div>

      {/* Rows */}
      {ch4Rows.map((row) => {
        if (!row.isMainSection && row.code !== "") {
          // track current section for indet numbering
        }
        if (row.isMainSection) {
          currentSection = row.code;
          indetIndex = 0;
        }

        const r = getR(row.id);
        const isMainSection = row.isMainSection;
        const rowIsNA = r.state === "NA";
        const isCollapsed = isMainSection && collapsed.has(row.code);
        const isHidden = !isMainSection && (() => {
          // find parent main section
          let parentCode = "";
          for (const candidate of ch4Rows) {
            if (candidate.isMainSection) parentCode = candidate.code;
            if (candidate.id === row.id) break;
          }
          return collapsed.has(parentCode);
        })();

        if (isHidden) return null;

        // Indeterminate numbering
        let itemNumber: number | null = null;
        if (!isMainSection && r.state === "INDET") {
          indetIndex++;
          itemNumber = indetIndex;
        }

        // Depth-based indentation
        const depth = isMainSection ? 0 : (row.code.split(".").length - 1);
        const indentPx = isMainSection ? 0 : depth * 14;

        const rowBg = rowIsNA ? "#f9fafb" : isMainSection ? "#f0f4ff" : "#fff";

        return (
          <div
            key={row.id}
            style={{
              display: "grid",
              gridTemplateColumns: "140px 1fr 280px 60px",
              gap: 10,
              alignItems: "center",
              padding: isMainSection ? "6px 10px" : "4px 10px",
              borderBottom: `1px solid ${isMainSection ? "#d0d0d0" : "#e9e9e9"}`,
              background: rowBg,
            }}
          >
            {/* Status buttons */}
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {isMainSection ? (
                <>
                  <button type="button" title="Resolved"
                    onClick={() => handleMainSectionClick(row.id, row.code, "RESOLVED")}
                    style={stateBtnStyle("RESOLVED", r.state === "RESOLVED")}
                  >✓</button>
                  <button type="button" title="Indeterminate"
                    onClick={() => handleMainSectionClick(row.id, row.code, "INDET")}
                    style={stateBtnStyle("INDET", r.state === "INDET")}
                  >?</button>
                  <button type="button" title="Not Applicable"
                    onClick={() => handleMainSectionClick(row.id, row.code, "NA")}
                    style={stateBtnStyle("NA", r.state === "NA")}
                  >N/A</button>
                </>
              ) : (
                <>
                  <button type="button" title="Resolved"
                    onClick={() => setItemResponse(row.id, { state: nextState(r.state, "RESOLVED") })}
                    style={stateBtnStyle("RESOLVED", r.state === "RESOLVED")}
                  >✓</button>
                  <button type="button" title="Indeterminate"
                    onClick={() => handleIndetClick(row.id, currentSection)}
                    style={stateBtnStyle("INDET", r.state === "INDET")}
                  >?</button>
                  <button type="button" title="Not Applicable"
                    onClick={() => setItemResponse(row.id, { state: nextState(r.state, "NA") })}
                    style={stateBtnStyle("NA", r.state === "NA")}
                  >N/A</button>
                </>
              )}
            </div>

            {/* Section code + title */}
            <div style={{ paddingLeft: indentPx, display: "flex", alignItems: "center", gap: 6 }}>
              {isMainSection && (
                <button
                  type="button"
                  onClick={() => setCollapsedInternal((prev) => {
                    const next = new Set(prev);
                    if (next.has(row.code)) next.delete(row.code);
                    else next.add(row.code);
                    return next;
                  })}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 11, color: "#6b7280", padding: "0 2px", lineHeight: 1,
                    width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {collapsed.has(row.code) ? "▶" : "▼"}
                </button>
              )}
              <span style={{
                fontSize: isMainSection ? 13 : 12,
                fontWeight: isMainSection ? 700 : 400,
                color: rowIsNA ? "#9ca3af" : isMainSection ? "#1e3a8a" : "#111",
                minWidth: isMainSection ? 36 : 24,
                flexShrink: 0,
              }}>
                {row.code}
              </span>
              <span style={{
                fontSize: isMainSection ? 13 : 12,
                fontWeight: isMainSection ? 600 : 400,
                color: rowIsNA ? "#9ca3af" : isMainSection ? "#1e3a8a" : "#333",
              }}>
                {isCollapsed ? (
                  <span>
                    {row.title}
                    <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 400, marginLeft: 8 }}>
                      {collapsedSummary(row.code)}
                    </span>
                  </span>
                ) : row.title}
              </span>
            </div>

            {/* Notes */}
            <NotesField
              autoNote={r.autoNote ?? ""}
              userNote={r.userNote ?? ""}
              noteEdited={r.noteEdited ?? false}
              onChange={(userNote, noteEdited) => setItemResponse(row.id, { userNote, noteEdited })}
              dim={rowIsNA}
            />

            {/* Item number */}
            <div style={{ textAlign: "center", fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>
              {itemNumber ?? ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}
