console.log("layout.js LOADED");
// =============================
// Layout + Routing Engine v26.2
// =============================

// Node positions across three zones
// Zone A: Engine Bay (left)
// Zone B: Cab (center)
// Zone C: Rear Node (right)
const LAYOUT_POS = {

  // === ZONE A: ENGINE BAY ===
  battery:       { x: 60,  y: 380 },
  alternator:    { x: 60,  y: 200 },
  starter:       { x: 160, y: 440 },
  ecm:           { x: 240, y: 120 },
  coils:         { x: 150, y: 200 },
  injectors:     { x: 150, y: 290 },
  throttle_body: { x: 240, y: 240 },
  cooling_fan:   { x: 200, y: 380 },
  ac_compressor: { x: 90,  y: 460 },
  wideband_o2:   { x: 300, y: 340 },
  map_sensor:    { x: 300, y: 420 },

  // === ZONE B: CAB ===
  fuse_panel:    { x: 460, y: 240 },
  ignition_sw:   { x: 400, y: 120 },
  dakota_hdx:    { x: 520, y: 100 },
  bim_04:        { x: 620, y: 100 },
  accuair_ctrl:  { x: 560, y: 220 },
  vintage_air:   { x: 430, y: 360 },
  radio:         { x: 540, y: 360 },

  // === ZONE C: REAR NODE ===
  fuel_relay:    { x: 720, y: 160 },
  c102_ctrl:     { x: 720, y: 260 },
  dw440_pump:    { x: 840, y: 260 },
  fuel_sender:   { x: 940, y: 160 },
  accuair_comp:  { x: 840, y: 380 },
  accuair_valves:{ x: 720, y: 380 },
  tail_lights:   { x: 940, y: 420 }
};

const ROUTE_COLORS = {
  POWER:  "#C4622D",
  SIGNAL: "#2D6C8C",
  CAN:    "#6C4A8B",
  GROUND: "#3E6B48"
};

// Zone background regions
const ZONES = [
  { label: "ENGINE BAY",  x: 30,  y: 60,  w: 320, h: 440, color: "#FFF8F0" },
  { label: "CAB",         x: 370, y: 60,  w: 290, h: 440, color: "#F0F4FF" },
  { label: "REAR NODE",   x: 680, y: 60,  w: 300, h: 440, color: "#F0FFF4" }
];

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
// Draw zone backgrounds
// -----------------------------
function drawZones(){
  return ZONES.map(z=>`
    <rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}"
      fill="${z.color}" stroke="#D8D2C8" stroke-width="1" rx="6"/>
    <text x="${z.x + z.w/2}" y="${z.y + 22}"
      text-anchor="middle"
      font-size="11"
      font-weight="bold"
      fill="#888"
      letter-spacing="1">${z.label}</text>
  `).join("");
}

// -----------------------------
// Draw nodes
// -----------------------------
function drawNodes(){
  return Object.entries(LAYOUT_POS).map(([id, p])=>{
    const node  = STATE.nodes?.[id];
    const failed = node?.failed;
    const fill  = failed ? "#B00020" : "#2E2A26";
    const label = node?.label || id;
    const volts = node ? `${(node.effectiveVoltage||0).toFixed(1)}V` : "";
    return `
      <circle cx="${p.x}" cy="${p.y}" r="7"
        fill="${fill}" stroke="white" stroke-width="1.5"/>
      <text x="${p.x}" y="${p.y - 12}"
        text-anchor="middle"
        font-size="9"
        font-weight="bold"
        fill="${failed ? "#B00020" : "#2E2A26"}">${label}</text>
      <text x="${p.x}" y="${p.y + 20}"
        text-anchor="middle"
        font-size="8"
        fill="#888">${volts}</text>
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
      <polyline
        points="${pts}"
        stroke="${ROUTE_COLORS[r.type] || "#999"}"
        stroke-width="3"
        fill="none"
        stroke-dasharray="5,3"
        pointer-events="stroke"
        onclick="selectRoute('${r.id}')"
        style="cursor:pointer; opacity:0.8"
      />
    `;
  }).join("");
}

// -----------------------------
// Draw legend
// -----------------------------
function drawLegend(){
  const items = Object.entries(ROUTE_COLORS);
  return items.map(([type, color], i)=>`
    <line x1="${20 + i*120}" y1="520" x2="${60 + i*120}" y2="520"
      stroke="${color}" stroke-width="3" stroke-dasharray="5,3"/>
    <text x="${68 + i*120}" y="524"
      font-size="10" fill="#555">${type}</text>
  `).join("");
}

// -----------------------------
// Main render
// -----------------------------
function renderLayout(){
  console.log("renderLayout fired");
  const svg = document.getElementById("layoutSVG");
  if (!svg) return;
  svg.setAttribute("viewBox", "0 0 1000 540");
  svg.innerHTML = `
    ${drawZones()}
    ${drawRoutes()}
    ${drawNodes()}
    ${drawLegend()}
  `;
}
