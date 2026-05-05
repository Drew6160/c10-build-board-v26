console.log("layout.js LOADED");
// =============================
// Layout + Routing Engine v26.3
// =============================

const STATUS_COLORS = {
  planned:   "#AAAAAA",
  ordered:   "#2D6C8C",
  installed: "#C4622D",
  tested:    "#3E6B48"
};

const LAYOUT_POS = {
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
  ignition_sw:   { x: 420, y: 120 },
  dakota_hdx:    { x: 530, y: 120 },
  bim_04:        { x: 640, y: 120 },
  fuse_panel:    { x: 480, y: 260 },
  accuair_ctrl:  { x: 620, y: 260 },
  vintage_air:   { x: 430, y: 400 },
  radio:         { x: 580, y: 400 },
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

function drawZones(){
  return ZONES.map(z=>`
    <rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}"
      fill="${z.color}" stroke="#D8D2C8" stroke-width="1" rx="6"/>
    <text x="${z.x + z.w/2}" y="${z.y + 20}"
      text-anchor="middle" font-size="10" font-weight="bold"
      fill="#AAA" letter-spacing="2">${z.label}</text>
  `).join("");
}

function drawNodes(){
  return Object.entries(LAYOUT_POS).map(([id, p])=>{
    const node      = STATE.nodes?.[id];
    const failed    = node?.failed;
    const statusKey = STATE.status?.[id]?.status || "planned";
    const fill      = failed ? "#B00020" : (STATUS_COLORS[statusKey] || STATUS_COLORS.planned);
    const label     = node?.label || id;
    const volts     = node ? `${(node.effectiveVoltage||0).toFixed(1)}V` : "";
    return `
      <circle cx="${p.x}" cy="${p.y}" r="8"
        fill="${fill}" stroke="white" stroke-width="1.5"
        style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.2))"/>
      <text x="${p.x}" y="${p.y-13}"
        text-anchor="middle" font-size="8.5" font-weight="bold"
        fill="${failed ? "#B00020" : "#2E2A26"}">${label}</text>
      <text x="${p.x}" y="${p.y+21}"
        text-anchor="middle" font-size="7.5" fill="#999">${volts}</text>
    `;
  }).join("");
}

function drawRoutes(){
  return buildRoutes().map(r=>{
    const pts = r.points.map(p=>p.join(",")).join(" ");
    return `
      <polyline points="${pts}"
        stroke="${ROUTE_COLORS[r.type]||"#999"}"
        stroke-width="2.5" fill="none" stroke-dasharray="5,3"
        pointer-events="stroke" onclick="selectRoute('${r.id}')"
        style="cursor:pointer;opacity:0.75"/>
    `;
  }).join("");
}

function drawLegend(){
  const routeItems  = Object.entries(ROUTE_COLORS);
  const statusItems = Object.entries(STATUS_COLORS);
  const routes = routeItems.map(([type,color],i)=>`
    <line x1="${20+i*110}" y1="556" x2="${52+i*110}" y2="556"
      stroke="${color}" stroke-width="2.5" stroke-dasharray="5,3"/>
    <text x="${58+i*110}" y="560" font-size="9" fill="#555">${type}</text>
  `).join("");
  const statuses = statusItems.map(([key,color],i)=>`
    <circle cx="${490+i*115}" cy="556" r="5" fill="${color}"/>
    <text x="${500+i*115}" y="560" font-size="9" fill="#555">${key}</text>
  `).join("");
  return routes + statuses;
}

function renderLayout(){
  const svg = document.getElementById("layoutSVG");
  if(!svg) return;
  svg.setAttribute("viewBox","0 0 990 575");
  svg.innerHTML = `
    ${drawZones()}
    ${drawRoutes()}
    ${drawNodes()}
    ${drawLegend()}
  `;
}
