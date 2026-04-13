"use client";

import React from "react";

export type PanelInfoCell = {
  label: string;
  value: string;
  color?: string;
};

export function PanelInfoTable({ cells }: { cells: PanelInfoCell[] }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${cells.length}, 1fr)`,
      borderBottom: "1px solid #e9e9e9",
      marginLeft: -20,
      marginRight: -20,
      marginTop: -20,
      marginBottom: 16,
    }}>
      {/* Header row */}
      {cells.map((cell, i) => (
        <div
          key={`h-${i}`}
          style={{
            padding: "3px 10px",
            fontSize: 10,
            fontWeight: 600,
            color: "#aaa",
            borderRight: i < cells.length - 1 ? "1px solid #e9e9e9" : "none",
            borderBottom: "1px solid #e9e9e9",
            background: "#fff",
            whiteSpace: "nowrap",
            textAlign: "center",
          }}
        >
          {cell.label}
        </div>
      ))}
      {/* Value row */}
      {cells.map((cell, i) => (
        <div
          key={`v-${i}`}
          style={{
            padding: "4px 10px",
            fontSize: 12,
            fontWeight: cell.color ? 700 : 500,
            color: cell.color ?? "#9ca3af",
            borderRight: i < cells.length - 1 ? "1px solid #e9e9e9" : "none",
            background: "#fff",
            whiteSpace: "nowrap",
            textAlign: "center",
            outline: cell.color ? `1px solid ${cell.color}` : "none",
            outlineOffset: -1,
          }}
        >
          {cell.value}
        </div>
      ))}
    </div>
  );
}