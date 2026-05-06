console.log("layout.js LOADED");
// =============================
// Layout + Routing Engine v26.4
// Visual channels separated:
//   fill  = electrical health
//   ring  = build status
// =============================

const STATUS_RING = {
  planned:   "#AAAAAA",
  ordered:   "#2D6C8C",
  installed: "#C4622D",
  tested:    "#3E6B48"
};

const HEALTH_FILL = {
  ok:      "#3E6B48",   // green  — voltage OK
  warn:    "#E09B2D",   // amber  — voltage low but not failed
  failed:  "#B00020",   // red    — failed
  unknown: "#888888"    // grey   — no data yet
};

const LAYOUT_POS = {
  // === ZONE A: ENGINE BAY ===
  alternator:    { x: 70,  y: 130 },
  ecm:           { x: 220, y: 110 },
  coils:         { x: 100, y: 210 },
  throttle_body: { x: 230, y: 210 },
  injectors:     { x: 100, y: 310 },
  wideband_o2:   { x: 230, y: 310 },
  cooling_fan:   { x: 150, y: 390 },
  battery:       { x: 60,  y: 430 },
  map_sensor:    { x: 280, y: 390 },
  ac_compressor: { x: 70,  y: 490 },
  starter:       { x: 200, y: 490 },

  // === ZONE B: CAB ===
  ignition_sw:   { x: 420, y: 120 },
  dakota_hdx:    { x: 530, y: 120 },
  bim_04:        { x: 640, y: 120 },
  fuse_panel:    { x: 480, y: 260 },
  accuair_ctrl:  { x: 620, y: 260 },
  vintage_air:   { x: 430, y: 400 },
  radio:         { x: 580, y: 400 },

  // === ZONE C: REAR NODE ===
  fuel_relay:    { x: 740, y: 140 },
  fuel_sender:   { x: 920, y: 140 },
  c102_ctrl:     { x: 740, y: 260 },
  dw440_pump:    { x: 900, y: 260 },
  accuair_valves:{ x: 740, y: 390 },
  accuair_comp:  { x: 900, y: 390 },
  tail_lights:   { x: 820, y: 490 }
};

const ROUTE_COLORS = {
  POWER:  "#C4622D",
  SIGNAL: "#2D6C8C",
  CAN:    "#6C4A8B",
  GROUND: "#3E6B48"
};

const ZONES = [
  { label: "ENGINE BAY", x: 30,  y: 70,  w: 320, h: 470, color: "#FFF8F0" },
  { label: "CAB",        x: 370, y: 70,  w: 310, h: 470, color: "#F0F4FF" },
  { label: "REAR NODE",  x: 700, y: 70,  w: 270, h: 470, color: "#F0FFF4" }
];

// -----------------------------
// Determine electrical health
// -----------------------------
function getHealthKey(node){
  if(!node) return "unknown";
  const v = node.effectiveVoltage || 0;
  if(node.failed || v < 11.0) return "failed";
  if(v < 12.0)                return "warn";
  if(v >= 12.0)               return "ok";
  return "unknown";
}

// -----------------------------
// Build route geometry
// -----------------------------
function buildRoutes(){
  return EDGES.map(e=>{
    const from = LAYOUT_POS[e.from];
    const to   = LAYOUT_POS[e.to];
    if(!from || !to) return null;
    const midX = (from.x + to.x) / 2;
    return {
      id:     `${e.from}_${e.to}`,
      from:   e.from,
      to:     e.to,
      type:   e.type,
      points: [
        [from.x, from.y],
        [midX,   from.y],
        [midX,   to.y],
        [to.x,   to.y]
      ]
    };
  }).filter(Boolean);
}

// -----------------------------
// Zone backgrounds
// -----------------------------
function drawZones(){
  return ZONES.map(z=>`
    <rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}"
      fill="${z.color}" stroke="#D8D2C8" stroke-width="1" rx="6"/>
    <text x="${z.x + z.w/2}" y="${z.y + 20}"
      text-anchor="middle" font-size="10" font-weight="bold"
      fill="#BBB" letter-spacing="2">${z.label}</text>
  `).join("");
}

// -----------------------------
// Draw nodes
// Two visual channels:
//   inner circle fill = electrical health
//   outer ring stroke = build status
// -----------------------------
function drawNodes(){
  return Object.entries(LAYOUT_POS).map(([id, p])=>{
    const node       = STATE.nodes?.[id];
    const healthKey  = getHealthKey(node);
    const fill       = HEALTH_FILL[healthKey];
    const statusKey  = STATE.status?.[id]?.status || "planned";
    const ringColor  = STATUS_RING[statusKey];
    const label      = node?.label || id;
    const volts      = node
      ? `${(node.effectiveVoltage || 0).toFixed(1)}V`
      : "";

    return `
      <g onclick="selectNode('${id}')" style="cursor:pointer">
        <!-- build status ring -->
        <circle cx="${p.x}" cy="${p.y}" r="13"
          fill="none"
          stroke="${ringColor}"
          stroke-width="3"
          opacity="0.85"/>
        <!-- electrical health fill -->
        <circle cx="${p.x}" cy="${p.y}" r="8"
          fill="${fill}"
          stroke="white"
          stroke-width="1.5"
          style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.2))"/>
        <!-- label -->
        <text x="${p.x}" y="${p.y - 18}"
          text-anchor="middle" font-size="8.5" font-weight="bold"
          fill="#2E2A26">${label}</text>
        <!-- voltage -->
        <text x="${p.x}" y="${p.y + 26}"
          text-anchor="middle" font-size="7.5"
          fill="#999">${volts}</text>
      </g>
    `;
  }).join("");
}

// -----------------------------
// Draw routes
// -----------------------------
function drawRoutes(){
  return buildRoutes().map(r=>{
    const pts = r.points.map(p=>p.join(",")).join(" ");
    return `
      <polyline points="${pts}"
        stroke="${ROUTE_COLORS[r.type] || "#999"}"
        stroke-width="2.5" fill="none" stroke-dasharray="5,3"
        pointer-events="stroke"
        onclick="selectRoute('${r.id}')"
        style="cursor:pointer;opacity:0.75"/>
    `;
  }).join("");
}

// -----------------------------
// Legend — two rows
// Row 1: route types
// Row 2: electrical health | build status
// -----------------------------
function drawLegend(){
  // Row 1 — route types
  const routeItems = Object.entries(ROUTE_COLORS);
  const routes = routeItems.map(([type, color], i)=>`
    <line x1="${20+i*110}" y1="552" x2="${50+i*110}" y2="552"
      stroke="${color}" stroke-width="2.5" stroke-dasharray="5,3"/>
    <text x="${56+i*110}" y="556" font-size="9" fill="#555">${type}</text>
  `).join("");

  // Row 2 left — electrical health
  const healthItems = Object.entries(HEALTH_FILL);
  const health = healthItems.map(([key, color], i)=>`
    <circle cx="${22+i*90}" cy="572" r="6" fill="${color}"/>
    <text x="${32+i*90}" y="576" font-size="9" fill="#555">${key}</text>
  `).join("");

  // Row 2 right — build status (ring)
  const statusItems = Object.entries(STATUS_RING);
  const statuses = statusItems.map(([key, color], i)=>`
    <circle cx="${430+i*110}" cy="572" r="8"
      fill="none" stroke="${color}" stroke-width="3"/>
    <text x="${443+i*110}" y="576" font-size="9" fill="#555">${key}</text>
  `).join("");

  return routes + health + statuses;
}

// -----------------------------
// Main render
// -----------------------------
function renderLayout(){
  const svg = document.getElementById("layoutSVG");
  if(!svg) return;
  svg.setAttribute("viewBox","0 0 990 590");
  svg.innerHTML = `
    ${drawZones()}
    ${drawRoutes()}
    ${drawNodes()}
    ${drawLegend()}
  `;
}
