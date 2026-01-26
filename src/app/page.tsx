export default function Home() {
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
            <Field label="Construction Type" placeholder="(dropdown)" />
            <Field label="Sprinklers" placeholder="(dropdown)" />
            <Field label="Fire Alarm" placeholder="(dropdown)" />

            <Field label="Building Height" placeholder={`e.g., 75'-5"`} />
            <Field label="Highest Floor" placeholder={`e.g., 17'-11"`} />

            <Field label="Stories Above Grade" placeholder="(stepper)" />
            <Field label="Stories Below Grade" placeholder="(stepper)" />

            <Field label="Occupancy Groups" placeholder="(output from Module 2)" muted />
            <Field label="Total Above-Grade Area" placeholder="(output from Module 2)" muted />
            <Field label="Total Below-Grade Area" placeholder="(output from Module 2)" muted />
          </div>
        </section>

        {/* Module 2 */}
        <section style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div>
              <div style={moduleTagStyle}>MOD 2</div>
              <h2 style={cardTitleStyle}>Building Heights & Areas</h2>
              <p style={{ margin: "6px 0 0", color: "#444", maxWidth: 900 }}>
                Stories are generated from Module 1. Each story can contain up to 4 areas.
                Area controls will be story-scoped (Option 1).
              </p>
            </div>
          </div>

          {/* Controls placeholder (we will refine button placement next) */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <Chip>+ Story (Above)</Chip>
            <Chip>+ Story (Below)</Chip>
            <Chip>+ Area (Selected Story)</Chip>
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
                {/* Example story header row */}
                <tr>
                  <td style={storyCellStyle}><strong>2</strong></td>
                  <td style={tdStyle}>—</td>
                  <td style={tdStyle} colSpan={6}><em style={{ color: "#555" }}>Story 2 (placeholder)</em></td>
                  <td style={tdStyle}></td>
                  <td style={tdStyle}>
                    <small style={{ color: "#555" }}>[+ Area] [– Story]</small>
                  </td>
                </tr>

                {/* Example area rows */}
                <tr>
                  <td style={tdStyle}></td>
                  <td style={tdStyle}>1</td>
                  <td style={tdStyle}>(dropdown)</td>
                  <td style={tdStyle}>(dropdown)</td>
                  <td style={tdStyle}>(text)</td>
                  <td style={tdStyle}>(number)</td>
                  <td style={tdStyle}>(calc)</td>
                  <td style={tdStyle}>(blank for Area 1)</td>
                  <td style={tdStyle}></td>
                </tr>
                <tr>
                  <td style={tdStyle}></td>
                  <td style={tdStyle}>2</td>
                  <td style={tdStyle}>(dropdown)</td>
                  <td style={tdStyle}>(dropdown)</td>
                  <td style={tdStyle}>(text)</td>
                  <td style={tdStyle}>(number)</td>
                  <td style={tdStyle}>(calc)</td>
                  <td style={tdStyle}>(dropdown)</td>
                  <td style={tdStyle}>
                    <small style={{ color: "#555" }}>[– Area]</small>
                  </td>
                </tr>

                {/* Below grade example */}
                <tr>
                  <td style={storyCellStyle}><strong>B1</strong></td>
                  <td style={tdStyle}>—</td>
                  <td style={tdStyle} colSpan={6}><em style={{ color: "#555" }}>Story B1 (placeholder)</em></td>
                  <td style={tdStyle}></td>
                  <td style={tdStyle}>
                    <small style={{ color: "#555" }}>[+ Area] [– Story]</small>
                  </td>
                </tr>
                <tr>
                  <td style={tdStyle}></td>
                  <td style={tdStyle}>1</td>
                  <td style={tdStyle}>(dropdown)</td>
                  <td style={tdStyle}>(dropdown)</td>
                  <td style={tdStyle}>(text)</td>
                  <td style={tdStyle}>(number)</td>
                  <td style={tdStyle}>(calc)</td>
                  <td style={tdStyle}>(blank for Area 1)</td>
                  <td style={tdStyle}></td>
                </tr>
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

/** Styles */
const cardStyle: React.CSSProperties = {
  border: "1px solid #d6d6d6",
  borderRadius: 14,
  padding: 16,
  background: "#fff",
  marginBottom: 14,
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