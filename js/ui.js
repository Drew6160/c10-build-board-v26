// -----------------------------
// Upstream graph traversal
// Finds all upstream dependencies
// of a given node via EDGES
// -----------------------------
function traceUpstream(nodeId){
  const visited = new Set();
  const path    = [];
  let   current = nodeId;

  while(true){
    // find all edges feeding into current node
    const inbound = EDGES.filter(e => e.to === current);
    if(!inbound.length) break;

    // take first unvisited inbound edge
    const edge = inbound.find(e => !visited.has(e.from));
    if(!edge) break;

    visited.add(edge.from);
    path.unshift({ id: edge.from, type: edge.type });
    current = edge.from;
  }
  return path;
}

// -----------------------------
// Node click handler
// Shows health + build status +
// upstream diagnostic path
// -----------------------------
window.selectNode = function(id){
  const node      = STATE.nodes?.[id];
  const statusKey = STATE.status?.[id]?.status || "planned";
  const v         = node ? (node.effectiveVoltage || 0).toFixed(1) : "—";
  const health    = node?.failed ? "FAILED"
                  : (node?.effectiveVoltage < 12.0) ? "LOW VOLTAGE"
                  : "OK";
  const healthColor = node?.failed ? "#B00020"
                    : (node?.effectiveVoltage < 12.0) ? "#E09B2D"
                    : "#3E6B48";

  const upstream = traceUpstream(id);
  const upstreamHTML = upstream.length
    ? upstream.map((u, i)=>{
        const uNode = STATE.nodes?.[u.id];
        const uV    = uNode ? `${(uNode.effectiveVoltage||0).toFixed(1)}V` : "—";
        const uOK   = uNode && !uNode.failed && uNode.effectiveVoltage >= 12.0;
        return `
          <div style="display:flex;align-items:center;gap:8px;
                      padding:3px 0;font-size:11px">
            <span style="color:#AAA">${i+1}.</span>
            <span style="color:${uOK?"#3E6B48":"#B00020"}">●</span>
            <span>${uNode?.label || u.id}</span>
            <span style="color:#AAA;margin-left:auto">${uV}</span>
          </div>`;
      }).join("")
    : `<div style="font-size:11px;color:#AAA">No upstream dependencies</div>`;

  document.getElementById("analysisPanel").innerHTML = `
    <h3 style="margin:0 0 8px;color:#C4622D">
      ${node?.label || id}
    </h3>
    <div style="display:flex;gap:10px;margin-bottom:10px;flex-wrap:wrap">
      <span style="font-size:11px;padding:2px 8px;border-radius:10px;
                   background:${healthColor};color:white">
        ${health} — ${v}V
      </span>
      <span style="font-size:11px;padding:2px 8px;border-radius:10px;
                   background:#F4F1EC;color:#555;border:1px solid #D8D2C8">
        ${statusKey.toUpperCase()}
      </span>
    </div>
    <div style="font-size:10px;font-weight:bold;color:#AAA;
                letter-spacing:1px;margin-bottom:4px">
      UPSTREAM DEPENDENCIES
    </div>
    ${upstreamHTML}
    ${node?.failed || node?.effectiveVoltage < 12.0 ? `
      <div style="margin-top:10px;padding:6px 8px;background:#FFF8F0;
                  border-left:3px solid #E09B2D;font-size:11px">
        ⚠ Start diagnosis from the top of the upstream chain —
        check each node in order until you find the fault.
      </div>` : ""}
  `;
};

// -----------------------------
// Route click handler
// -----------------------------
window.selectRoute = function(id){
  const route = buildRoutes().find(r => r.id === id);
  if(!route) return;
  const spec  = generateWiringSpec().find(s => s.id === id);
  if(!spec){
    document.getElementById("analysisPanel").innerHTML =
      `<b>No data for route ${id}</b>`;
    return;
  }
  document.getElementById("analysisPanel").innerHTML = `
    <h3 style="margin:0 0 8px;color:#C4622D">Route Detail</h3>
    <table style="width:100%;font-size:12px;border-collapse:collapse">
      <tr><td style="color:#888;padding:2px 6px">Circuit</td>
          <td style="padding:2px 6px"><b>${route.from} → ${route.to}</b></td></tr>
      <tr><td style="color:#888;padding:2px 6px">Type</td>
          <td style="padding:2px 6px">${route.type}</td></tr>
      <tr><td style="color:#888;padding:2px 6px">Base Load</td>
          <td style="padding:2px 6px">${spec.current} A</td></tr>
      <tr><td style="color:#888;padding:2px 6px">Design Load</td>
          <td style="padding:2px 6px">${spec.adjustedCurrent.toFixed(1)} A</td></tr>
      <tr><td style="color:#888;padding:2px 6px">Wire</td>
          <td style="padding:2px 6px">${spec.wire} TXL</td></tr>
      <tr><td style="color:#888;padding:2px 6px">Fuse</td>
          <td style="padding:2px 6px">${spec.fuse}</td></tr>
      <tr><td style="color:#888;padding:2px 6px">Voltage Drop</td>
          <td style="padding:2px 6px">${spec.drop} V</td></tr>
      <tr><td colspan="2" style="padding:6px 6px 2px">
        ${spec.warnings.length
          ? `<span style="color:#B00020">⚠ ${spec.warnings.join(", ")}</span>`
          : `<span style="color:#3E6B48">✓ OK</span>`}
      </td></tr>
    </table>
  `;
};

// -----------------------------
// Controls panel
// -----------------------------
function renderControls(){
  document.getElementById("controlsPanel").innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:4px">
      <button onclick="step()">▶ Step</button>
      <button onclick="runOptimization()">⚡ Optimize</button>
      <button onclick="downloadReport()">⬇ Export</button>
      <button onclick="forceFailure()"
        style="background:#B00020">⚠ Battery Low</button>
      <button onclick="resetSim()"
        style="background:#555">↺ Reset</button>
    </div>
  `;
}

// -----------------------------
// Simulation controls
// -----------------------------
function forceFailure(){
  STATE.nodes.battery.effectiveVoltage = 9;
  STATE.nodes.battery.failed = true;
  renderAll();
}

function resetSim(){
  Object.values(STATE.nodes).forEach(n=>{
    n.effectiveVoltage = 12;
    n.inputVoltage     = 0;
    n.failed           = false;
  });
  renderAll();
}

// -----------------------------
// System status panel
// Grouped by zone, shows both
// health indicator and build ring
// -----------------------------
function renderGraph(){
  const nodes  = Object.values(STATE.nodes);
  const total  = nodes.length;
  const failed = nodes.filter(n=>n.failed).length;
  const avgV   = (nodes.reduce((s,n)=>s+(n.effectiveVoltage||12),0)/total).toFixed(2);

  // build progress counts
  const statusCounts = { planned:0, ordered:0, installed:0, tested:0 };
  nodes.forEach(n=>{
    const s = STATE.status?.[n.id]?.status || "planned";
    if(statusCounts[s] !== undefined) statusCounts[s]++;
  });
  const doneCount = statusCounts.installed + statusCounts.tested;
  const pct       = Math.round((doneCount / total) * 100);

  const zones = { A:[], B:[], C:[] };
  nodes.forEach(n=>{ if(zones[n.zone]) zones[n.zone].push(n); });
  const zoneLabels = { A:"Engine Bay", B:"Cab", C:"Rear Node" };

  const zoneHTML = Object.entries(zones).map(([key, znodes])=>`
    <div style="margin:6px 0 2px;font-size:10px;font-weight:bold;
                color:#AAA;letter-spacing:1px">
      ${zoneLabels[key].toUpperCase()}
    </div>
    ${znodes.map(n=>{
      const v      = (n.effectiveVoltage||12).toFixed(1);
      const health = n.failed ? "red"
                   : n.effectiveVoltage < 12.0 ? "#E09B2D"
                   : "#3E6B48";
      const sKey   = STATE.status?.[n.id]?.status || "planned";
      const sColors= {planned:"#AAA",ordered:"#2D6C8C",
                      installed:"#C4622D",tested:"#3E6B48"};
      return `
        <div style="display:flex;align-items:center;gap:6px;
                    padding:3px 4px;margin:1px 0;font-size:11px;
                    cursor:pointer;border-radius:4px"
             onclick="selectNode('${n.id}')"
             onmouseover="this.style.background='#F4F1EC'"
             onmouseout="this.style.background='none'">
          <span style="color:${health};font-size:10px">●</span>
          <span style="flex:1">${n.label||n.id}</span>
          <span style="width:6px;height:6px;border-radius:50%;
                       border:2px solid ${sColors[sKey]};
                       display:inline-block"></span>
          <span style="color:#AAA;font-size:10px;min-width:36px;
                       text-align:right">${v}V</span>
        </div>`;
    }).join("")}
  `).join("");

  document.getElementById("graphPanel").innerHTML = `
    <h3 style="margin:0 0 6px;color:#C4622D">System Status</h3>
    <div style="display:flex;gap:12px;font-size:12px;margin-bottom:6px">
      <span><b>${total}</b> nodes</span>
      <span style="color:${failed>0?"#B00020":"#3E6B48"}">
        <b>${failed}</b> failure${failed!==1?"s":""}
      </span>
      <span><b>${avgV}V</b> avg</span>
    </div>
    <div style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;
                  font-size:10px;color:#888;margin-bottom:2px">
        <span>Build Progress</span>
        <span>${doneCount}/${total} — ${pct}%</span>
      </div>
      <div style="background:#F0EDE8;border-radius:4px;height:6px">
        <div style="background:#C4622D;width:${pct}%;
                    height:6px;border-radius:4px;
                    transition:width 0.3s"></div>
      </div>
    </div>
    <hr style="border:none;border-top:1px solid #D8D2C8;margin:0 0 4px">
    ${zoneHTML}
  `;
}

// -----------------------------
// BOM panel
// -----------------------------
function renderBOM(){
  const b = buildBOM();
  const section = (title, rows) => `
    <tr><td colspan="2" style="padding:5px 6px 2px;font-weight:bold;
        font-size:10px;color:#C4622D;text-transform:uppercase;
        letter-spacing:0.5px">${title}</td></tr>
    ${rows.map(r=>`
      <tr>
        <td style="padding:2px 6px;border-bottom:1px solid #F0EDE8">${r.item}</td>
        <td style="padding:2px 6px;border-bottom:1px solid #F0EDE8;
                   text-align:right">${r.qty}</td>
      </tr>`).join("")}
  `;
  document.getElementById("bomPanel").innerHTML = `
    <h3 style="margin:0 0 6px;color:#C4622D">Bill of Materials</h3>
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead>
        <tr>
          <th style="text-align:left;padding:3px 6px;background:#F4F1EC;
                     color:#888;font-size:10px;text-transform:uppercase;
                     letter-spacing:0.5px">Item</th>
          <th style="text-align:right;padding:3px 6px;background:#F4F1EC;
                     color:#888;font-size:10px;text-transform:uppercase;
                     letter-spacing:0.5px">Qty</th>
        </tr>
      </thead>
      <tbody>
        ${section("Wire", b.wire)}
        ${section("Fuses", b.fuses)}
        ${section("Connectors", b.connectors)}
      </tbody>
    </table>
  `;
}

// -----------------------------
// Master render
// -----------------------------
function renderAll(){
  renderGraph();
  renderControls();
  renderBOM();
  renderLayout();
}
