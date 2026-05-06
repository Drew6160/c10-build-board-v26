// -----------------------------
// Upstream graph traversal
// -----------------------------
function traceUpstream(nodeId){
  const visited = new Set();
  const path    = [];
  let   current = nodeId;

  while(true){
    const inbound = EDGES.filter(e => e.to === current);
    if(!inbound.length) break;
    const edge = inbound.find(e => !visited.has(e.from));
    if(!edge) break;
    visited.add(edge.from);
    path.unshift({ id: edge.from, type: edge.type, loom: edge.loom });
    current = edge.from;
  }
  return path;
}

// -----------------------------
// Node click — full detail panel
// Part number, notes, health,
// build status, upstream chain
// -----------------------------
window.selectNode = function(id){
  const node      = STATE.nodes?.[id];
  const statusKey = STATE.status?.[id]?.status || "planned";
  const v         = node ? (node.effectiveVoltage||0).toFixed(1) : "—";
  const health    = node?.failed          ? "FAILED"
                  : node?.effectiveVoltage < 12.0 ? "LOW VOLTAGE"
                  : "OK";
  const healthColor = node?.failed        ? "#B00020"
                    : node?.effectiveVoltage < 12.0 ? "#E09B2D"
                    : "#3E6B48";

  const statusColors = {
    planned:"#AAA", ordered:"#2D6C8C",
    installed:"#C4622D", tested:"#3E6B48"
  };

  const upstream = traceUpstream(id);
  const upstreamHTML = upstream.length
    ? upstream.map((u, i)=>{
        const uNode = STATE.nodes?.[u.id];
        const uV    = uNode ? `${(uNode.effectiveVoltage||0).toFixed(1)}V` : "—";
        const uOK   = uNode && !uNode.failed && uNode.effectiveVoltage >= 12.0;
        return `
          <div style="display:flex;align-items:center;gap:8px;
                      padding:3px 0;font-size:11px;border-bottom:1px solid #F4F1EC">
            <span style="color:#CCC;min-width:14px">${i+1}.</span>
            <span style="color:${uOK?"#3E6B48":"#B00020"}">●</span>
            <span style="flex:1">${uNode?.label || u.id}</span>
            <span style="color:#AAA;font-size:10px;
                         background:#F4F1EC;padding:1px 5px;border-radius:8px">
              ${u.loom ? u.loom.replace(/_/g," ") : ""}
            </span>
            <span style="color:#AAA;min-width:36px;text-align:right;
                         font-size:10px">${uV}</span>
          </div>`;
      }).join("")
    : `<div style="font-size:11px;color:#AAA;padding:4px 0">
         No upstream dependencies — this is a source node
       </div>`;

  const partNum = node?.partNumber || "—";
  const notes   = node?.notes      || "";
  const tier    = node?.tier === 2 ? "Tier 2 — Accessory" : "Tier 1 — Core System";

  document.getElementById("analysisPanel").innerHTML = `
    <h3 style="margin:0 0 8px;color:#C4622D;font-size:13px">
      ${node?.label || id}
    </h3>

    <!-- Status badges -->
    <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
      <span style="font-size:10px;padding:2px 8px;border-radius:10px;
                   background:${healthColor};color:white;font-weight:bold">
        ${health} ${v}V
      </span>
      <span style="font-size:10px;padding:2px 8px;border-radius:10px;
                   background:${statusColors[statusKey]};color:white">
        ${statusKey.toUpperCase()}
      </span>
      <span style="font-size:10px;padding:2px 8px;border-radius:10px;
                   background:#F4F1EC;color:#888;border:1px solid #D8D2C8">
        ${tier}
      </span>
    </div>

    <!-- Part number -->
    <div style="margin-bottom:8px;padding:6px 8px;background:#F4F1EC;
                border-radius:6px;font-size:11px">
      <span style="color:#AAA;font-size:10px;text-transform:uppercase;
                   letter-spacing:0.5px">Part Number</span><br>
      <span style="font-weight:bold;color:#2E2A26">${partNum}</span>
    </div>

    <!-- Notes -->
    ${notes ? `
    <div style="margin-bottom:10px;padding:6px 8px;background:#FFF8F0;
                border-left:3px solid #C4622D;border-radius:0 4px 4px 0;
                font-size:11px;color:#555;line-height:1.5">
      ${notes}
    </div>` : ""}

    <!-- Upstream chain -->
    <div style="font-size:10px;font-weight:bold;color:#AAA;
                letter-spacing:1px;margin-bottom:4px">
      UPSTREAM DEPENDENCIES
    </div>
    ${upstreamHTML}

    ${node?.failed || (node?.effectiveVoltage < 12.0) ? `
    <div style="margin-top:10px;padding:6px 8px;background:#FFF0F0;
                border-left:3px solid #B00020;font-size:11px;color:#555">
      ⚠ Fault detected — check upstream nodes in order from top of chain.
      Click each upstream node for its part number and diagnostic notes.
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
  const loomLabel = route.loom
    ? route.loom.replace(/_/g," ")
    : "—";
  document.getElementById("analysisPanel").innerHTML = `
    <h3 style="margin:0 0 8px;color:#C4622D;font-size:13px">Route Detail</h3>
    <table style="width:100%;font-size:11px;border-collapse:collapse">
      <tr><td style="color:#AAA;padding:3px 6px;width:110px">Circuit</td>
          <td style="padding:3px 6px"><b>${route.from} → ${route.to}</b></td></tr>
      <tr><td style="color:#AAA;padding:3px 6px">Loom</td>
          <td style="padding:3px 6px">${loomLabel}</td></tr>
      <tr><td style="color:#AAA;padding:3px 6px">Type</td>
          <td style="padding:3px 6px">${route.type}</td></tr>
      <tr><td style="color:#AAA;padding:3px 6px">Base Load</td>
          <td style="padding:3px 6px">${spec.current} A</td></tr>
      <tr><td style="color:#AAA;padding:3px 6px">Design Load</td>
          <td style="padding:3px 6px">${spec.adjustedCurrent.toFixed(1)} A</td></tr>
      <tr><td style="color:#AAA;padding:3px 6px">Wire</td>
          <td style="padding:3px 6px">${spec.wire} TXL</td></tr>
      <tr><td style="color:#AAA;padding:3px 6px">Fuse</td>
          <td style="padding:3px 6px">${spec.fuse}</td></tr>
      <tr><td style="color:#AAA;padding:3px 6px">Voltage Drop</td>
          <td style="padding:3px 6px">${spec.drop} V</td></tr>
      <tr><td colspan="2" style="padding:6px 6px 2px">
        ${spec.warnings.length
          ? `<span style="color:#B00020">⚠ ${spec.warnings.join(", ")}</span>`
          : `<span style="color:#3E6B48">✓ OK</span>`}
      </td></tr>
    </table>
  `;
};

// -----------------------------
// Controls
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
// -----------------------------
function renderGraph(){
  const nodes  = Object.values(STATE.nodes);
  const total  = nodes.length;
  const failed = nodes.filter(n=>n.failed).length;
  const avgV   = (nodes.reduce((s,n)=>s+(n.effectiveVoltage||12),0)/total).toFixed(2);

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
    <div style="margin:8px 0 3px;font-size:10px;font-weight:bold;
                color:#AAA;letter-spacing:1px">
      ${zoneLabels[key].toUpperCase()}
    </div>
    ${znodes.map(n=>{
      const v      = (n.effectiveVoltage||12).toFixed(1);
      const health = n.failed ? "#B00020"
                   : n.effectiveVoltage < 12.0 ? "#E09B2D"
                   : "#3E6B48";
      const sKey   = STATE.status?.[n.id]?.status || "planned";
      const sColors= { planned:"#AAA", ordered:"#2D6C8C",
                       installed:"#C4622D", tested:"#3E6B48" };
      const isTier2 = n.tier === 2;
      return `
        <div style="display:flex;align-items:center;gap:6px;
                    padding:3px 4px;margin:1px 0;font-size:11px;
                    cursor:pointer;border-radius:4px;
                    opacity:${isTier2 ? 0.7 : 1}"
             onclick="selectNode('${n.id}')"
             onmouseover="this.style.background='#F4F1EC'"
             onmouseout="this.style.background='none'">
          <span style="color:${health};font-size:10px">●</span>
          <span style="flex:1">${n.label||n.id}${isTier2?
            ' <span style="color:#CCC;font-size:9px">(T2)</span>':''}</span>
          <span style="width:7px;height:7px;border-radius:50%;
                       border:2px solid ${sColors[sKey]};
                       display:inline-block;flex-shrink:0"></span>
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
                  font-size:10px;color:#888;margin-bottom:3px">
        <span>Build Progress</span>
        <span>${doneCount}/${total} installed/tested — ${pct}%</span>
      </div>
      <div style="background:#F0EDE8;border-radius:4px;height:6px">
        <div style="background:#C4622D;width:${pct}%;height:6px;
                    border-radius:4px;transition:width 0.3s"></div>
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
