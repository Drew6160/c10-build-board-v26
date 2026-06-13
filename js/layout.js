console.log("layout.js LOADED");
// =============================
// Layout + Routing Engine v28.1
// Directional current flow layer
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
const ROUTE_COLORS = {
  POWER:  "#C4622D",
  SIGNAL: "#2D6C8C",
  CAN:    "#6C4A8B",
  GROUND: "#3E6B48"
};

let ACTIVE_LOOM  = null;
let ANIM_ENABLED = false;

// =============================
// LAYOUT_POS replacement block
// Drop into layout.js replacing
// the entire const LAYOUT_POS = { ... }
// =============================

const LAYOUT_POS = {

  // --- Zone A: Engine Bay ---
  alternator:           { x: 70,  y: 130 },
  coils:                { x: 100, y: 210 },
  throttle_body:        { x: 230, y: 210 },
  injectors:            { x: 100, y: 310 },
  wideband_o2:          { x: 230, y: 310 },
  cooling_fan:          { x: 150, y: 390 },
  battery:              { x: 60,  y: 430 },
  map_sensor:           { x: 280, y: 390 },
  ac_compressor:        { x: 70,  y: 490 },
  starter:              { x: 200, y: 490 },
  fuel_pressure_sensor: { x: 160, y: 170 },

  // --- Zone A: Accuair front height sensors ---
  accuair_sensor_lf:    { x: 80,  y: 560 },
  accuair_sensor_rf:    { x: 270, y: 560 },

  // --- Zone B: Cab ---
  ignition_sw:          { x: 420, y: 120 },
  ecm:                  { x: 680, y: 340 },
  dakota_hdx:           { x: 530, y: 120 },
  bim_efi1:             { x: 630, y: 340 },
  bim_04:               { x: 720, y: 120 },
  fuse_panel:           { x: 480, y: 240 },
  power_block:          { x: 390, y: 240 },
  ground_block:         { x: 390, y: 340 },
  t56_disconnect:       { x: 490, y: 340 },
  vintage_air:          { x: 420, y: 350 },
  radio:                { x: 540, y: 350 },
  power_windows:        { x: 410, y: 450 },
  heated_seats:         { x: 500, y: 450 },
  alarm:                { x: 590, y: 450 },
  backup_cam:           { x: 680, y: 450 },

  // --- Zone B: Under-seat panel nodes (new Lane 1) ---
  accuair_ctrl:         { x: 680, y: 240 }, // replaces accuair_touchpad
  estopp:               { x: 540, y: 520 }, // E-Stopp module — new
  estopp_pwr_disconnect: { x: 480, y: 520 }, // battery junction area
  estopp_mod_disconnect: { x: 640, y: 520 }, // panel edge, beside E-Stopp

  // --- Zone C: Rear Node — Fuel system ---
  fuel_relay:           { x: 790, y: 110 },
  fuel_sender:          { x: 940, y: 110 },
  c106_ctrl:            { x: 760, y: 260 },
  dw810_pump:           { x: 940, y: 190 },

  // --- Zone C: Rear Node — Accuair cluster ---
  accuair_ecu:          { x: 790, y: 290 }, // retained for legacy edges
  accuair_tank:         { x: 940, y: 290 },
  accuair_vu4:          { x: 790, y: 370 }, // retained for legacy edges
  accuair_pressure:     { x: 940, y: 370 },
  accuair_relay_1:      { x: 790, y: 450 },
  accuair_relay_2:      { x: 870, y: 450 },
  accuair_comp_1:       { x: 790, y: 530 }, // retained for legacy edges
  accuair_comp_2:       { x: 870, y: 530 },
  accuair_sensor_lr:    { x: 940, y: 450 },
  accuair_sensor_rr:    { x: 940, y: 530 },

  // --- Zone C: Rear Node — Accuair consolidated (Lane 1 node IDs) ---
  accuair_comp:         { x: 790, y: 530 }, // maps to accuair_comp_1 position
  accuair_valves:       { x: 790, y: 370 }, // maps to accuair_vu4 position

  // --- Zone C: Rear Node — Lighting ---
  tail_lights:          { x: 870, y: 110 }

};
const ZONES = [
  { label:"ENGINE BAY", x:30,  y:70, w:320, h:550, color:"#FFF8F0" },
  { label:"CAB",        x:360, y:70, w:390, h:550, color:"#F0F4FF" },
  { label:"REAR NODE",  x:760, y:70, w:220, h:550, color:"#F0FFF4" }
];

// -----------------------------
// STEP 1 — Route metrics helper
// -----------------------------
function getRouteMetrics(route){
  const spec = generateWiringSpec().find(s => s.id === route.id);
  if(!spec) return { current:1, drop:0, severity:"normal" };

  let severity = "normal";
  if(spec.warnings?.length > 0)     severity = "critical";
  else if(parseFloat(spec.drop) > 0.4) severity = "warning";

  // also check if either endpoint node is failed
  const fromFailed = STATE.nodes?.[route.from]?.failed;
  const toFailed   = STATE.nodes?.[route.to]?.failed;
  if(fromFailed || toFailed) severity = "critical";

  return {
    current:  spec.current || 1,
    drop:     parseFloat(spec.drop) || 0,
    severity
  };
}

function getHealthKey(node){
  if(!node) return "unknown";
  const v = node.effectiveVoltage || 0;
  if(node.failed || v < 10) return "failed";
  if(v < 12.0)              return "warn";
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
      points: [[from.x,from.y],[midX,from.y],[midX,to.y],[to.x,to.y]]
    };
  }).filter(Boolean);
}

function drawZones(){
  return ZONES.map(z=>`
    <rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}"
      fill="${z.color}" stroke="#D8D2C8" stroke-width="1" rx="6"/>
    <text x="${z.x+z.w/2}" y="${z.y+20}"
      text-anchor="middle" font-size="10" font-weight="bold"
      fill="#BBB" letter-spacing="2">${z.label}</text>
  `).join("");
}

// -----------------------------
// SVG defs — arrowhead marker
// + animation CSS injected here
// -----------------------------
function drawDefs(){
  return `
    <defs>
      <marker id="arrowPower"
        markerWidth="8" markerHeight="6"
        refX="7" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#C4622D" opacity="0.7"/>
      </marker>
      <marker id="arrowSignal"
        markerWidth="8" markerHeight="6"
        refX="7" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#2D6C8C" opacity="0.7"/>
      </marker>
      <marker id="arrowCAN"
        markerWidth="8" markerHeight="6"
        refX="7" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#6C4A8B" opacity="0.7"/>
      </marker>
      <marker id="arrowFault"
        markerWidth="8" markerHeight="6"
        refX="7" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#B00020" opacity="0.9"/>
      </marker>
    </defs>

    <style>
      /* Base animated route */
      .trace-line {
        stroke-dasharray: 12 6;
        animation: currentFlow var(--flow-speed, 1s) linear infinite;
      }
      @keyframes currentFlow {
        from { stroke-dashoffset: 0;   }
        to   { stroke-dashoffset: -36; }
      }

      /* Warning route — subtle amber glow */
      .trace-warning {
        filter: drop-shadow(0 0 2px #E09B2D);
      }

      /* Critical route — red pulse glow */
      .trace-critical {
        animation:
          currentFlow var(--flow-speed, 0.6s) linear infinite,
          criticalPulse 0.8s ease-in-out infinite;
      }
      @keyframes criticalPulse {
        0%   { filter: drop-shadow(0 0 2px #B00020); }
        50%  { filter: drop-shadow(0 0 10px #B00020); }
        100% { filter: drop-shadow(0 0 2px #B00020); }
      }

      /* Static route hover */
      .static-line:hover {
        opacity: 1 !important;
        stroke-width: 4px;
      }
    </style>
  `;
}

// -----------------------------
// STEPS 2-9 — draw routes
// -----------------------------
function drawRoutes(){
  const routes = buildRoutes();

  return routes.map(r=>{
    const inLoom  = isEdgeInActiveLoom({ loom: r.loom });
    const opacity = inLoom ? 0.9 : 0.15;
    const pts     = r.points.map(p=>p.join(",")).join(" ");

    // STEP 1 — get metrics
    const metrics = getRouteMetrics(r);

    // STEP 4 — severity-based color
    let stroke = ACTIVE_LOOM
      ? (inLoom ? (LOOM_COLORS[r.loom]||"#999") : "#E0DBD4")
      : ROUTE_COLORS[r.type] || "#999";

    if(!ACTIVE_LOOM || inLoom){
      if(metrics.severity === "warning")  stroke = "#E09B2D";
      if(metrics.severity === "critical") stroke = "#B00020";
    }

    if(!ANIM_ENABLED){
      // static mode — simple dashed line, no animation
      return `
        <polyline points="${pts}"
          stroke="${stroke}"
          stroke-width="${inLoom ? 2.5 : 1.5}"
          fill="none"
          stroke-dasharray="5,3"
          pointer-events="stroke"
          class="static-line"
          onclick="selectRoute('${r.id}')"
          style="cursor:pointer;opacity:${opacity};transition:stroke 0.3s"/>`;
    }

    // STEP 2 — dynamic width: min 2, max 12
    const width = inLoom
      ? Math.min(12, 2 + metrics.current / 3)
      : 1.5;

    // STEP 3 — dynamic speed: high current = faster
    const speed = `${Math.max(0.3, 2 - (metrics.current / 20))}s`;

    // STEP 8 — CSS class based on severity
    let className = inLoom ? "trace-line" : "";
    if(inLoom && metrics.severity === "warning")  className += " trace-warning";
    if(inLoom && metrics.severity === "critical") className += " trace-critical";

    // STEP 9 — arrowhead marker
    const arrowId = metrics.severity === "critical" ? "arrowFault"
                  : r.type === "SIGNAL"             ? "arrowSignal"
                  : r.type === "CAN"                ? "arrowCAN"
                  : "arrowPower";
    const markerEnd = inLoom ? `marker-end="url(#${arrowId})"` : "";

    // ghost track underneath for visual depth
    const ghost = inLoom ? `
      <polyline points="${pts}"
        stroke="${stroke}" stroke-width="${width + 2}"
        fill="none" stroke-dasharray="none"
        opacity="0.08" style="pointer-events:none"/>` : "";

    return `
      ${ghost}
      <polyline points="${pts}"
        stroke="${stroke}"
        stroke-width="${width}"
        fill="none"
        opacity="${opacity}"
        class="${className}"
        ${markerEnd}
        pointer-events="stroke"
        onclick="selectRoute('${r.id}')"
        style="--flow-speed:${speed};cursor:pointer;
               transition:stroke 0.3s,stroke-width 0.3s"/>`;
  }).join("");
}

function drawNodes(){
  return Object.entries(LAYOUT_POS).map(([id,p])=>{
    const node      = STATE.nodes?.[id];
    const healthKey = getHealthKey(node);
    const fill      = HEALTH_FILL[healthKey];
    const statusKey = STATE.status?.[id]?.status || "planned";
    const ringColor = STATUS_RING[statusKey];
    const label     = node?.label || id;
    const volts     = node ? `${(node.effectiveVoltage||0).toFixed(1)}V` : "";
    const isTier2   = node?.tier === 2;
    let   opacity   = 1;
    if(ACTIVE_LOOM && !isNodeInActiveLoom(id)) opacity = 0.15;

    // STEP 7 — glow on failed nodes
    const glowStyle = healthKey==="failed"
      ? "filter:drop-shadow(0 0 5px #B00020)"
      : healthKey==="warn"
      ? "filter:drop-shadow(0 0 3px #E09B2D)"
      : "filter:drop-shadow(0 1px 2px rgba(0,0,0,0.15))";

    return `
      <g onclick="handleNodeClick('${id}')"
         style="cursor:pointer;opacity:${opacity};transition:opacity 0.2s">
        <circle cx="${p.x}" cy="${p.y}" r="13"
          fill="none" stroke="${ringColor}" stroke-width="3"
          stroke-dasharray="${isTier2?"4,3":"none"}" opacity="0.9"/>
        <circle cx="${p.x}" cy="${p.y}" r="8"
          fill="${fill}" stroke="white" stroke-width="1.5"
          style="${glowStyle}"/>
        <text x="${p.x}" y="${p.y-18}"
          text-anchor="middle" font-size="8.5" font-weight="bold"
          fill="${healthKey==="failed"?"#B00020":"#2E2A26"}">${label}</text>
        <text x="${p.x}" y="${p.y+26}"
          text-anchor="middle" font-size="7.5"
          fill="${healthKey==="warn"?"#E09B2D":
                 healthKey==="failed"?"#B00020":"#999"}">${volts}</text>
      </g>`;
  }).join("");
}

function drawLegend(){
  const routeItems  = Object.entries(ROUTE_COLORS);
  const healthItems = Object.entries(HEALTH_FILL);
  const statusItems = Object.entries(STATUS_RING);

  const routes = routeItems.map(([type,color],i)=>`
    <line x1="${20+i*110}" y1="578" x2="${50+i*110}" y2="578"
      stroke="${color}" stroke-width="2.5" stroke-dasharray="5,3"/>
    <text x="${56+i*110}" y="582" font-size="9" fill="#555">${type}</text>
  `).join("");
  const health = healthItems.map(([key,color],i)=>`
    <circle cx="${22+i*85}" cy="596" r="6" fill="${color}"/>
    <text x="${32+i*85}" y="600" font-size="9" fill="#555">${key}</text>
  `).join("");
  const statuses = statusItems.map(([key,color],i)=>`
    <circle cx="${380+i*115}" cy="596" r="8"
      fill="none" stroke="${color}" stroke-width="3"/>
    <text x="${393+i*115}" y="600" font-size="9" fill="#555">${key}</text>
  `).join("");
  return routes + health + statuses;
}

// -----------------------------
// Loom filter + animation toggle
// -----------------------------
window.setLoomFilter = function(loom){
  ACTIVE_LOOM = (ACTIVE_LOOM===loom) ? null : loom;
  renderAll();
};

window.toggleAnimation = function(){
  ANIM_ENABLED = !ANIM_ENABLED;
  renderLayout();
  renderLoomButtons();
};

function renderLoomButtons(){
  const panel = document.getElementById("loomPanel");
  if(!panel) return;
  const looms = [...new Set(EDGES.map(e=>e.loom).filter(Boolean))];

  panel.innerHTML=`
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <span style="font-size:10px;font-weight:bold;color:#AAA;
                   letter-spacing:1px;white-space:nowrap">
        HARNESS FILTER
      </span>
      <div style="display:flex;flex-wrap:wrap;gap:4px;flex:1">
        ${looms.map(loom=>{
          const active = ACTIVE_LOOM===loom;
          const color  = LOOM_COLORS[loom]||"#888";
          const edges  = EDGES.filter(e=>e.loom===loom);
          const load   = edges.reduce((s,e)=>{
            const n=STATE.nodes?.[e.to]; return s+(n?.load||0);
          },0);
          return `
            <button onclick="setLoomFilter('${loom}')"
              style="background:${active?color:"#F4F1EC"};
                     color:${active?"white":"#555"};
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
        ${ACTIVE_LOOM?`
          <button onclick="setLoomFilter(null)"
            style="background:#555;color:white;border:none;
                   padding:3px 8px;border-radius:4px;
                   font-size:10px;cursor:pointer">
            ✕ Clear
          </button>`:""}
      </div>

      <!-- Flow animation toggle -->
      <button onclick="toggleAnimation()"
        style="background:${ANIM_ENABLED?"#1A8C6E":"#F4F1EC"};
               color:${ANIM_ENABLED?"white":"#555"};
               border:1px solid ${ANIM_ENABLED?"#1A8C6E":"#D8D2C8"};
               padding:3px 12px;border-radius:4px;
               font-size:10px;cursor:pointer;
               transition:all 0.2s;white-space:nowrap">
        ⚡ Flow ${ANIM_ENABLED?"ON ●":"OFF ○"}
      </button>
    </div>
    ${ACTIVE_LOOM?`
      <div style="margin-top:5px;font-size:10px;color:#888">
        Showing: <b style="color:#2E2A26">
          ${ACTIVE_LOOM.replace(/_/g," ")}
        </b> — BOM and diagnostics filtered to this harness
        ${ANIM_ENABLED?"· Width = current load · Speed = amps · Glow = stress":""}
      </div>`
    : ANIM_ENABLED ? `
      <div style="margin-top:5px;font-size:10px;color:#888">
        ⚡ Flow active — line width = current · speed = amps ·
        <span style="color:#E09B2D">amber = voltage stress</span> ·
        <span style="color:#B00020">red pulse = fault/critical</span>
      </div>` : ""}
  `;
}

// -----------------------------
// Main render
// Two modes:
// 1. Full redraw (animation OFF or first render)
//    — replaces innerHTML, animation starts fresh
// 2. Targeted update (animation ON)
//    — only updates node colors/voltages in place
//    — preserves running CSS animations on routes
// -----------------------------
function renderLayout(){
  const svg = document.getElementById("layoutSVG");
  if(!svg) return;
  svg.setAttribute("viewBox","0 0 1000 680");

  if(!ANIM_ENABLED || !svg.querySelector(".trace-line")){
    // Full redraw — safe when animation is off or first load
    svg.innerHTML=`
      ${drawDefs()}
      ${drawZones()}
      <g id="routeLayer">${drawRoutes()}</g>
      <g id="nodeLayer">${drawNodes()}</g>
      ${drawLegend()}
    `;
    _lastFaultState = JSON.stringify(
      Object.values(STATE.nodes).map(n=>n.failed)
    );
  } else {
    // Targeted update — preserve route animation elements
    // Only patch node visuals (fill, glow, voltage text)
    patchNodes(svg);
    // Re-draw routes only if loom filter or fault state changed
    // (routes change color/width on fault — need redraw for those)
    const faultChanged = _lastFaultState !==
      JSON.stringify(Object.values(STATE.nodes).map(n=>n.failed));
    if(faultChanged){
      _lastFaultState = JSON.stringify(
        Object.values(STATE.nodes).map(n=>n.failed)
      );
      // replace just the route layer — find and replace route group
      let routeGroup = svg.querySelector("#routeLayer");
      if(!routeGroup){
        // first time — full redraw
        svg.innerHTML=`
          ${drawDefs()}
          ${drawZones()}
          <g id="routeLayer">${drawRoutes()}</g>
          <g id="nodeLayer">${drawNodes()}</g>
          ${drawLegend()}
        `;
        return;
      }
      routeGroup.innerHTML = drawRoutes();
    }
  }
  renderLoomButtons();
}

// Track last fault state to detect changes
let _lastFaultState = "";

// Patch only node visual properties in-place
// preserves position, click handlers, and avoids animation interruption
function patchNodes(svg){
  Object.entries(LAYOUT_POS).forEach(([id, p])=>{
    const node      = STATE.nodes?.[id];
    const healthKey = getHealthKey(node);
    const fill      = HEALTH_FILL[healthKey];
    const volts     = node ? `${(node.effectiveVoltage||0).toFixed(1)}V` : "";

    const glowStyle = healthKey==="failed"
      ? "filter:drop-shadow(0 0 5px #B00020)"
      : healthKey==="warn"
      ? "filter:drop-shadow(0 0 3px #E09B2D)"
      : "filter:drop-shadow(0 1px 2px rgba(0,0,0,0.15))";

    // find existing node group by searching for circle near this position
    // nodes are grouped as <g> elements — find by text content matching label
    const groups = svg.querySelectorAll("g[onclick]");
    groups.forEach(g=>{
      if(g.getAttribute("onclick") === `handleNodeClick('${id}')`){
        // update inner circle fill
        const circles = g.querySelectorAll("circle");
        if(circles[1]){
          circles[1].setAttribute("fill", fill);
          circles[1].setAttribute("style", glowStyle);
        }
        // update voltage text (second text element)
        const texts = g.querySelectorAll("text");
        if(texts[1]) texts[1].textContent = volts;
        // update label color on fault
        if(texts[0]){
          texts[0].setAttribute("fill",
            healthKey==="failed" ? "#B00020" : "#2E2A26");
        }
      }
    });
  });
}
