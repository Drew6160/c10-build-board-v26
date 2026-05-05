// =============================
// Layout + Routing Engine v26.1
// =============================

const LAYOUT_POS = {
  battery: {x:120,y:300},
  ecm: {x:450,y:220},
  fuel_pump: {x:850,y:300}
};

const ROUTE_COLORS = {
  POWER: "#C4622D",
  SIGNAL: "#2D6C8C",
  CAN: "#6C4A8B",
  GROUND: "#3E6B48"
};

// -----------------------------
// Build route geometry
// -----------------------------
function buildRoutes(){
  return EDGES.map(e=>{
    const from = LAYOUT_POS[e.from];
    const to = LAYOUT_POS[e.to];
    if(!from || !to) return null;

    const midX = (from.x + to.x)/2;

    return {
      id: `${e.from}_${e.to}`,
      from: e.from,
      to: e.to,
      type: e.type,
      points: [
        [from.x, from.y],
        [midX, from.y],
        [midX, to.y],
        [to.x, to.y]
      ]
    };
  }).filter(Boolean);
}

// -----------------------------
// Draw nodes (with failure color)
// -----------------------------
function drawNodes(){
  return Object.entries(LAYOUT_POS).map(([id,p])=>{

    const node = STATE.nodes[id];
    const color = node?.failed ? "#B00020" : "#2E2A26";

    return `
      <circle cx="${p.x}" cy="${p.y}" r="8" fill="${color}"/>
      <text x="${p.x+10}" y="${p.y+4}" font-size="12">${id}</text>
    `;
  }).join("");
}

// -----------------------------
// Draw routes (clickable)
// -----------------------------
function drawRoutes(){

  return buildRoutes().map(r => {

    const pts = r.points.map(p => p.join(",")).join(" ");

    return `
      <polyline
        points="${pts}"
        stroke="${ROUTE_COLORS[r.type] || "#999"}"
        stroke-width="6"
        pointer-events="stroke"
        fill="none"
        stroke-dasharray="6,3"
        onclick="selectRoute('${r.id}')"
        style="cursor:pointer"
      />
    `;
  }).join("");
}

// -----------------------------
// Route selection handler
// -----------------------------

  <h3>Route Detail</h3>

  <b>${route.from} → ${route.to}</b><br>

  Current: ${spec.current} A<br>
  Wire: ${spec.wire}<br>
  Fuse: ${spec.fuse}<br>
  Voltage Drop: ${spec.drop} V<br>

  <br>
  ${spec.warnings.length
    ? `<b style="color:#B00020">⚠ ${spec.warnings.join(", ")}</b>`
    : `<span style="color:#3E6B48">OK</span>`
  }
`;
// -----------------------------
// Main render
// -----------------------------
function renderLayout(){

  const svg = document.getElementById("layoutSVG");

  svg.innerHTML = `
    <rect x="50" y="80" width="900" height="340"
      fill="none" stroke="#ccc"/>

    ${drawRoutes()}
    ${drawNodes()}
  `;
}
