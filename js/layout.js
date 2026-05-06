console.log("layout.js LOADED");
// =============================
// Layout + Routing Engine v26.5
// =============================

const STATUS_RING = {
  planned:   "#AAAAAA",
  ordered:   "#2D6C8C",
  installed: "#C4622D",
  tested:    "#3E6B48"
};

const HEALTH_FILL = {
  ok:      "#3E6B48",
  warn:    "#E09B2D",
  failed:  "#B00020",
  unknown: "#888888"
};

const LOOM_COLORS = {
  charge_system:  "#C4622D",
  engine_harness: "#2D6C8C",
  cab_harness:    "#6C4A8B",
  can_bus:        "#1A8C6E",
  rear_trunk:     "#8C6A1A",
  fuel_system:    "#B00020",
  accuair_system: "#3E6B48",
  t56_harness:    "#555555"
};

// Active loom filter — null means show all
let ACTIVE_LOOM = null;

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

  // === ZONE B: CAB — TIER 1 ===
  ignition_sw:   { x: 420, y: 120 },
  dakota_hdx:    { x: 530, y: 120 },
  bim_04:        { x: 640, y: 120 },
  fuse_panel:    { x: 480, y: 260 },
  accuair_ctrl:  { x: 620, y: 260 },
  vintage_air:   { x: 430, y: 370 },
  radio:         { x: 560, y: 370 },

  // === ZONE B: CAB — TIER 2 (accessories) ===
  power_windows: { x: 420, y: 460 },
  heated_seats:  { x: 510, y: 460 },
  alarm:         { x: 600, y: 460 },
  backup_cam:    { x: 690, y: 460 },

  // === ZONE C: REAR NODE ===
  fuel_relay:    { x: 740, y: 140 },
  fuel_sender:   { x: 920, y: 140 },
  c102_ctrl:     { x: 740, y: 260 },
  dw440_pump:    { x: 900, y: 260 },
  accuair_valves:{ x: 740, y: 370 },
  accuair_comp:  { x: 900, y: 370 },
  tail_lights:   { x: 820, y: 460 }
};

const ROUTE_COLORS = {
  POWER:  "#C4622D",
  SIGNAL: "#2D6C8C",
  CAN:    "#6C4A8B",
  GROUND: "#3E6B48"
};

const ZONES = [
  { label: "ENGINE BAY", x: 30,  y: 70,  w: 320, h: 490, color: "#FFF8F0" },
  { label: "CAB",        x: 370, y: 70,  w: 360, h: 490, color: "#F0F4FF" },
  { label: "REAR NODE",  x: 750, y: 70,  w: 220, h: 490, color: "#F0FFF4" }
];

function getHealthKey(node){
  if(!node) return "unknown";
  const v = node.effectiveVoltage || 0;
  if(node.failed || v < 11.0) return "failed";
  if(v < 12.0)                return "warn";
  return "ok";
}

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
      loom:   e.loom || "unknown",
      points: [
        [from.x, from.y],
        [midX,   from.y],
        [midX,   to.y],
        [to.x,   to.y]
      ]
    };
  }).filter(Boolean);
}

function drawZones(){
  return ZONES.map(z=>`
    <rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}"
      fill="${z.color}" stroke="#D8D2C8" stroke-width="1" rx="6"/>
    <text x="${z.x + z.w/2}" y="${z.y + 20}"
      text-anchor="middle" font-size="10" font-weight="bold"
      fill="#BBB" letter-spacing="2">${z.label}</text>
  `).join("");
}

function drawNodes(){
  return Object.entries(LAYOUT_POS).map(([id, p])=>{
    const node      = STATE.nodes?.[id];
    const healthKey = getHealthKey(node);
    const fill      = HEALTH_FILL[healthKey];
    const statusKey = STATE.status?.[id]?.status || "planned";
    const ringColor = STATUS_RING[statusKey];
    const label     = node?.label || id;
    const volts     = node ? `${(node.effectiveVoltage||0).toFixed(1)}V` : "";
    const isTier2   = node?.tier === 2;

    // dim tier-2 nodes slightly; dim all when loom filter active
    // and this node has no edges in active loom
    let nodeOpacity = 1;
    if(ACTIVE_LOOM){
      const inLoom = EDGES.some(e =>
        e.loom === ACTIVE_LOOM && (e.from === id || e.to === id)
      );
      if(!inLoom) nodeOpacity = 0.2;
    }

    return `
      <g onclick="selectNode('${id}')"
         style="cursor:pointer;opacity:${nodeOpacity};transition:opacity 0.2s">
        <circle cx="${p.x}" cy="${p.y}" r="13"
          fill="none" stroke="${ringColor}" stroke-width="3"
          stroke-dasharray="${isTier2 ? "4,3" : "none"}"
          opacity="0.85"/>
        <circle cx="${p.x}" cy="${p.y}" r="8"
          fill="${fill}" stroke="white" stroke-width="1.5"
          style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.15))"/>
        <text x="${p.x}" y="${p.y - 18}"
          text-anchor="middle" font-size="8.5" font-weight="bold"
          fill="#2E2A26">${label}</text>
        <text x="${p.x}" y="${p.y + 26}"
          text-anchor="middle" font-size="7.5" fill="#999">${volts}</text>
      </g>
    `;
  }).join("");
}

function drawRoutes(){
  return buildRoutes().map(r=>{
    const isActive  = !ACTIVE_LOOM || r.loom === ACTIVE_LOOM;
    const color     = ACTIVE_LOOM
      ? (isActive ? (LOOM_COLORS[r.loom] || "#999") : "#E0DBD4")
      : (ROUTE_COLORS[r.type] || "#999");
    const width     = isActive ? 3 : 1.5;
    const opacity   = isActive ? 0.9 : 0.2;
    const pts = r.points.map(p=>p.join(",")).join(" ");
    return `
      <polyline points="${pts}"
        stroke="${color}" stroke-width="${width}"
        fill="none" stroke-dasharray="5,3"
        pointer-events="stroke"
        onclick="selectRoute('${r.id}')"
        style="cursor:pointer;opacity:${opacity};transition:opacity 0.2s"/>
    `;
  }).join("");
}

function drawLegend(){
  const routeItems  = Object.entries(ROUTE_COLORS);
  const healthItems = Object.entries(HEALTH_FILL);
  const statusItems = Object.entries(STATUS_RING);

  const routes = routeItems.map(([type, color], i)=>`
    <line x1="${20+i*110}" y1="576" x2="${50+i*110}" y2="576"
      stroke="${color}" stroke-width="2.5" stroke-dasharray="5,3"/>
    <text x="${56+i*110}" y="580" font-size="9" fill="#555">${type}</text>
  `).join("");

  const health = healthItems.map(([key, color], i)=>`
    <circle cx="${22+i*85}" cy="594" r="6" fill="${color}"/>
    <text x="${32+i*85}" y="598" font-size="9" fill="#555">${key}</text>
  `).join("");

  const statuses = statusItems.map(([key, color], i)=>`
    <circle cx="${380+i*110}" cy="594" r="8"
      fill="none" stroke="${color}" stroke-width="3"/>
    <text x="${393+i*110}" y="598" font-size="9" fill="#555">${key}</text>
  `).join("");

  return routes + health + statuses;
}

// Called from loom filter buttons in ui.js
window.setLoomFilter = function(loom){
  ACTIVE_LOOM = (ACTIVE_LOOM === loom) ? null : loom;
  renderLayout();
  renderLoomButtons();
};

function renderLoomButtons(){
  const panel = document.getElementById("loomPanel");
  if(!panel) return;
  const looms = [...new Set(EDGES.map(e=>e.loom).filter(Boolean))];
  panel.innerHTML = `
    <div style="font-size:10px;font-weight:bold;color:#AAA;
                letter-spacing:1px;margin-bottom:6px">HARNESS FILTER</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px">
      ${looms.map(loom=>{
        const active  = ACTIVE_LOOM === loom;
        const color   = LOOM_COLORS[loom] || "#888";
        const edges   = EDGES.filter(e=>e.loom===loom);
        const load    = edges.reduce((sum,e)=>{
          const n = STATE.nodes?.[e.to];
          return sum + (n?.load||0);
        },0);
        return `
          <button onclick="setLoomFilter('${loom}')"
            style="background:${active ? color : "#F4F1EC"};
                   color:${active ? "white" : "#555"};
                   border:1px solid ${color};
                   padding:3px 8px;border-radius:4px;
                   font-size:10px;cursor:pointer;
                   transition:all 0.15s">
            ${loom.replace(/_/g," ")}
            <span style="opacity:0.7;font-size:9px">
              ${edges.length}ckts ${load.toFixed(0)}A
            </span>
          </button>`;
      }).join("")}
      ${ACTIVE_LOOM ? `
        <button onclick="setLoomFilter(null)"
          style="background:#555;color:white;border:none;
                 padding:3px 8px;border-radius:4px;
                 font-size:10px;cursor:pointer">
          ✕ Clear
        </button>` : ""}
    </div>
  `;
}

function renderLayout(){
  const svg = document.getElementById("layoutSVG");
  if(!svg) return;
  svg.setAttribute("viewBox","0 0 990 610");
  svg.innerHTML = `
    ${drawZones()}
    ${drawRoutes()}
    ${drawNodes()}
    ${drawLegend()}
  `;
  renderLoomButtons();
}
