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

function buildRoutes(){
  return EDGES.map(e=>{
    const from = LAYOUT_POS[e.from];
    const to = LAYOUT_POS[e.to];
    if(!from || !to) return null;

    const midX = (from.x + to.x)/2;

    return {
      id: `${e.from}_${e.to}`,
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

function drawNodes(){
  return Object.entries(LAYOUT_POS).map(([id,p])=>`
    <circle cx="${p.x}" cy="${p.y}" r="8" fill="#2E2A26"/>
    <text x="${p.x+10}" y="${p.y+4}" font-size="12">${id}</text>
  `).join("");
}

function drawRoutes(){

function selectRoute(id){

  const route = buildRoutes().find(r => r.id === id);

  const spec = generateWiringSpec()
    .find(s => id.includes(s.circuit.split(" → ")[1]));

  document.getElementById("analysisPanel").innerHTML = `
    <h3>Route Detail</h3>
    <b>${id}</b><br>
    Type: ${route.type}<br>
    Wire: ${spec?.wire}<br>
    Fuse: ${spec?.fuse}
  `;
}
  return buildRoutes().map(r=>{
    const pts = r.points.map(p=>p.join(",")).join(" ");
    return `
      <polyline points="${pts}"
        stroke="${ROUTE_COLORS[r.type] || "#999"}"
        stroke-width="3"
        fill="none"/>
    `;
  }).join("");
}

function renderLayout(){
  const svg = document.getElementById("layoutSVG");

  svg.innerHTML = `
    <rect x="50" y="80" width="900" height="340"
      fill="none" stroke="#ccc"/>
    ${drawRoutes()}
    ${drawNodes()}
  `;
}
