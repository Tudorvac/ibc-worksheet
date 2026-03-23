"use client";

import React from "react";

type Props = {
  title: string;
  description: string;
  summarySlot?: React.ReactNode;
  children: React.ReactNode;
  collapsed: boolean;
  onToggle: () => void;
};

export function CollapsiblePanel({
  title,
  description,
  summarySlot,
  children,
  collapsed,
  onToggle,
}: Props) {
  return (
    <div
      style={{
        border: "1px solid #d6d6d6",
        borderRadius: 14,
        background: "#fff",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          padding: "12px 16px",
          background: "#f7f7f7",
          borderBottom: collapsed ? "none" : "1px solid #d6d6d6",
          cursor: "pointer",
          userSelect: "none",
          gap: 16,
        }}
        onClick={onToggle}
      >
        {/* Left: chevron + title + description */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0 }}>
          <div
            style={{
              marginTop: 2,
              color: "#666",
              fontSize: 12,
              transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
              transition: "transform 120ms ease",
              flexShrink: 0,
            }}
          >
            ▼
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>
              {title}
            </div>
            <div style={{ fontSize: 13, color: "#555", marginTop: 2 }}>
              {description}
            </div>
          </div>
        </div>

        {/* Right: summary slot */}
        {summarySlot && (
          <div
            style={{ flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {summarySlot}
          </div>
        )}
      </div>

      {/* Body */}
      {!collapsed && (
        <div style={{ padding: 16 }}>
          {children}
        </div>
      )}
    </div>
  );
}