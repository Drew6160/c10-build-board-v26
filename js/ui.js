// =============================
// UI v27.6 — Context-Aware
// + Live Status Editor
// =============================

// -----------------------------
// Node click — full detail panel
// -----------------------------
window.handleNodeClick = function(id){
  const node      = STATE.nodes?.[id];
  const statusKey = STATE.status?.[id]?.status || "planned";
  const v         = node ? (node.effectiveVoltage||0).toFixed(2) : "—";
  const healthKey = !node ? "unknown"
                  : node.failed || node.effectiveVoltage < 10 ? "failed"
                  : node.effectiveVoltage < 12.0 ? "warn"
                  : "ok";

  const healthColor = {
    ok:"#3E6B48", warn:"#E09B2D", failed:"#B00020", unknown:"#888"
  }[healthKey];

  const statusColors = {
    planned:"#AAA", ordered:"#2D6C8C",
    installed:"#C4622D", tested:"#3E6B48"
  };

  const diag         = buildDiagnostics(id);
  const filteredDiag = ACTIVE_LOOM
    ? diag.filter(d => EDGES.some(e =>
        e.loom === ACTIVE_LOOM &&
        (e.from === d.id || e.to === d.id)))
    : diag;

  const diagHTML = filteredDiag.length
    ? filteredDiag.map((d,i)=>{
        const color = d.status==="FAIL" ? "#B00020"
                    : d.status==="LOW"  ? "#E09B2D"
                    : "#3E6B48";
        const icon  = d.status==="FAIL" ? "✕"
                    : d.status==="LOW"  ? "⚠" : "✓";
        return `
          <div style="display:flex;align-items:center;gap:8px;
                      padding:4px 6px;margin:2px 0;border-radius:4px;
                      border-left:3px solid ${color};
                      background:${d.status==="FAIL"?"#FFF0F0":
                                   d.status==="LOW"?"#FFFBF0":"#F4FFF6"};
                      font-size:11px">
            <span style="color:#AAA;min-width:16px">${i+1}.</span>
            <span style="color:${color};font-weight:bold;min-width:14px">${icon}</span>
            <span style="flex:1">${d.label}</span>
            <span style="color:#AAA;font-size:9px;background:white;
                         padding:1px 5px;border-radius:8px;
                         border:1px solid #E0DBD4">
              ${d.loom ? d.loom.replace(/_/g," ") : ""}
            </span>
            <span style="font-weight:bold;color:${color};
                         min-width:42px;text-align:right">${d.voltage}V</span>
          </div>`;
      }).join("")
    : `<div style="font-size:11px;color:#AAA;padding:6px 0">
         ${ACTIVE_LOOM
           ? "No upstream nodes in this harness"
           : "No upstream dependencies — source node"}
       </div>`;

  const faultCount = filteredDiag.filter(d=>d.status==="FAIL").length;
  const lowCount   = filteredDiag.filter(d=>d.status==="LOW").length;
  let   narrative  = "";
  if(healthKey==="failed" || healthKey==="warn"){
    if(faultCount > 0){
      const firstFault = filteredDiag.find(d=>d.status==="FAIL");
      narrative = `
        <div style="margin-top:8px;padding:7px 10px;background:#FFF0F0;
                    border-left:3px solid #B00020;border-radius:0 4px 4px 0;
                    font-size:11px;color:#555;line-height:1.6">
          <b style="color:#B00020">⚠ Fault detected upstream</b><br>
          First failure: <b>${firstFault?.label}</b> at ${firstFault?.voltage}V.<br>
          Check nodes in order — fix first failure and re-run Step.
        </div>`;
    } else if(lowCount > 0){
      narrative = `
        <div style="margin-top:8px;padding:7px 10px;background:#FFFBF0;
                    border-left:3px solid #E09B2D;border-radius:0 4px 4px 0;
                    font-size:11px;color:#555;line-height:1.6">
          <b style="color:#E09B2D">⚠ Low voltage upstream</b><br>
          ${lowCount} node${lowCount>1?"s":""} reading below 12V.
          Check charging system and ground paths.
        </div>`;
    }
  }

  // inline status changer
  const statusBtns = ["planned","ordered","installed","tested"].map(s=>`
    <button onclick="updateNodeStatus('${id}','${s}')"
      style="background:${s===statusKey ? statusColors[s] : "#F4F1EC"};
             color:${s===statusKey ? "white" : "#555"};
             border:1px solid ${statusColors[s]};
             padding:3px 10px;border-radius:4px;
             font-size:10px;cursor:pointer;transition:all 0.15s">
      ${s}
    </button>`).join("");

  document.getElementById("analysisPanel").innerHTML = `
    <h3 style="margin:0 0 8px;color:#C4622D;font-size:13px">
      ${node?.label || id}
    </h3>

    <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
      <span style="font-size:10px;padding:2px 8px;border-radius:10px;
                   background:${healthColor};color:white;font-weight:bold">
        ${healthKey.toUpperCase()} ${v}V
      </span>
      <span style="font-size:10px;padding:2px 8px;border-radius:10px;
                   background:${statusColors[statusKey]};color:white">
        ${statusKey.toUpperCase()}
      </span>
      ${node?.tier===2?`
        <span style="font-size:10px;padding:2px 8px;border-radius:10px;
                     background:#F4F1EC;color:#888;border:1px solid #D8D2C8">
          TIER 2</span>`:""}
    </div>

    <div style="margin-bottom:8px;padding:6px 8px;background:#F4F1EC;
                border-radius:6px;font-size:11px">
      <span style="color:#AAA;font-size:10px;text-transform:uppercase;
                   letter-spacing:0.5px">Part Number</span><br>
      <span style="font-weight:bold">${node?.partNumber||"—"}</span>
    </div>

    ${node?.notes?`
    <div style="margin-bottom:10px;padding:6px 8px;background:#FFF8F0;
                border-left:3px solid #C4622D;border-radius:0 4px 4px 0;
                font-size:11px;color:#555;line-height:1.5">
      ${node.notes}
    </div>`:""}

    <!-- Quick status update -->
    <div style="margin-bottom:10px">
      <div style="font-size:10px;font-weight:bold;color:#AAA;
                  letter-spacing:1px;margin-bottom:5px">
        UPDATE STATUS
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        ${statusBtns}
      </div>
    </div>

    <div style="font-size:10px;font-weight:bold;color:#AAA;
                letter-spacing:1px;margin-bottom:5px">
      UPSTREAM DIAGNOSTIC CHAIN
      ${ACTIVE_LOOM?`<span style="color:#2D6C8C;font-weight:normal;
        text-transform:none;letter-spacing:0">
        — filtered to ${ACTIVE_LOOM.replace(/_/g," ")}
      </span>`:""}
    </div>
    ${diagHTML}
    ${narrative}
  `;
};

// -----------------------------
// Live status update
// Updates memory + re-renders
// diagram and status panel
// -----------------------------
window.updateNodeStatus = function(id, newStatus){
  if(!STATE.status[id]) STATE.status[id] = {};
  STATE.status[id].status = newStatus;
  // re-render detail panel with updated state
  handleNodeClick(id);
  // re-render diagram ring + status list
  renderGraph();
  renderLayout();
};

// -----------------------------
// Status editor panel
// Full grid of all nodes
// grouped by zone
// -----------------------------
function renderStatusEditor(){
  const nodes  = Object.values(STATE.nodes);
  const zones  = { A:[], B:[], C:[] };
  nodes.forEach(n=>{ if(zones[n.zone]) zones[n.zone].push(n); });
  const zoneLabels = { A:"Engine Bay", B:"Cab", C:"Rear Node" };

  const statusColors = {
    planned:"#AAA", ordered:"#2D6C8C",
    installed:"#C4622D", tested:"#3E6B48"
  };
  const statusList = ["planned","ordered","installed","tested"];

  const zoneHTML = Object.entries(zones).map(([key, znodes])=>`
    <div style="margin-bottom:12px">
      <div style="font-size:10px;font-weight:bold;color:#AAA;
                  letter-spacing:1px;margin-bottom:5px">
        ${zoneLabels[key].toUpperCase()}
      </div>
      ${znodes.map(n=>{
        const current = STATE.status?.[n.id]?.status || "planned";
        const btns = statusList.map(s=>`
          <button onclick="updateNodeStatus('${n.id}','${s}')"
            title="${s}"
            style="background:${s===current?statusColors[s]:"#F4F1EC"};
                   color:${s===current?"white":"#999"};
                   border:1px solid ${s===current?statusColors[s]:"#E0DBD4"};
                   padding:2px 7px;border-radius:3px;
                   font-size:9px;cursor:pointer;transition:all 0.12s">
            ${s.charAt(0).toUpperCase()+s.slice(1)}
          </button>`).join("");

        return `
          <div style="display:flex;align-items:center;gap:6px;
                      padding:4px 4px;border-bottom:1px solid #F4F1EC;
                      ${n.tier===2?"opacity:0.7":""}">
            <span style="flex:1;font-size:11px;white-space:nowrap;
                         overflow:hidden;text-overflow:ellipsis">
              ${n.tier===2?'<span style="color:#CCC;font-size:9px">[T2]</span> ':''}
              ${n.label||n.id}
            </span>
            <div style="display:flex;gap:3px;flex-shrink:0">${btns}</div>
          </div>`;
      }).join("")}
    </div>
  `).join("");

  document.getElementById("statusEditorPanel").innerHTML = `
    <div style="display:flex;justify-content:space-between;
                align-items:center;margin-bottom:8px">
      <h3 style="margin:0;color:#C4622D;font-size:13px">Build Status</h3>
      <button onclick="exportStatusJSON()"
        style="background:#3E6B48;font-size:10px;padding:3px 10px">
        ⬇ Save status.json
      </button>
    </div>
    ${zoneHTML}
  `;
}

// -----------------------------
// Export updated status.json
// User downloads and pushes
// (until backend exists)
// -----------------------------
window.exportStatusJSON = function(){
  const output = { nodes: {} };
  Object.keys(STATE.status).forEach(id=>{
    output.nodes[id] = { status: STATE.status[id].status };
  });
  const blob = new Blob(
    [JSON.stringify(output, null, 2)],
    { type: "application/json" }
  );
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "status.json";
  a.click();
  URL.revokeObjectURL(url);
};

// -----------------------------
// Route click
// -----------------------------
window.selectRoute = function(id){
  const route = buildRoutes().find(r=>r.id===id);
  if(!route) return;
  const spec  = generateWiringSpec().find(s=>s.id===id);
  if(!spec){
    document.getElementById("analysisPanel").innerHTML =
      `<b>No data for route ${id}</b>`;
    return;
  }
  document.getElementById("analysisPanel").innerHTML = `
    <h3 style="margin:0 0 8px;color:#C4622D;font-size:13px">Route Detail</h3>
    <table style="width:100%;font-size:11px;border-collapse:collapse">
      <tr><td style="color:#AAA;padding:3px 6px;width:110px">Circuit</td>
          <td style="padding:3px 6px"><b>${route.from} → ${route.to}</b></td></tr>
      <tr><td style="color:#AAA;padding:3px 6px">Loom</td>
          <td style="padding:3px 6px">${(route.loom||"—").replace(/_/g," ")}</td></tr>
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
          ?`<span style="color:#B00020">⚠ ${spec.warnings.join(", ")}</span>`
          :`<span style="color:#3E6B48">✓ OK</span>`}
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
      <button onclick="downloadReport()">⬇ Export Report</button>
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
  propagateFailures();
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
    if(statusCounts[s]!==undefined) statusCounts[s]++;
  });
  const doneCount = statusCounts.installed + statusCounts.tested;
  const pct       = Math.round((doneCount/total)*100);

  document.getElementById("graphPanel").innerHTML = `
    <h3 style="margin:0 0 6px;color:#C4622D">System Status</h3>
    <div style="display:flex;gap:12px;font-size:12px;margin-bottom:6px">
      <span><b>${total}</b> nodes</span>
      <span style="color:${failed>0?"#B00020":"#3E6B48"}">
        <b>${failed}</b> failure${failed!==1?"s":""}
      </span>
      <span><b>${avgV}V</b> avg</span>
    </div>
    <div>
      <div style="display:flex;justify-content:space-between;
                  font-size:10px;color:#888;margin-bottom:3px">
        <span>Build Progress</span>
        <span>${doneCount}/${total} — ${pct}%</span>
      </div>
      <div style="background:#F0EDE8;border-radius:4px;height:6px">
        <div style="background:#C4622D;width:${pct}%;height:6px;
                    border-radius:4px;transition:width 0.3s"></div>
      </div>
    </div>
  `;
}

// -----------------------------
// BOM panel
// -----------------------------
function renderBOM(){
  const b = buildBOM({ loom: ACTIVE_LOOM });
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
  const heading = ACTIVE_LOOM
    ? `BOM — <span style="color:#2D6C8C">${ACTIVE_LOOM.replace(/_/g," ")}</span>`
    : "Bill of Materials";

  document.getElementById("bomPanel").innerHTML = `
    <h3 style="margin:0 0 6px;color:#C4622D;font-size:13px">${heading}</h3>
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead><tr>
        <th style="text-align:left;padding:3px 6px;background:#F4F1EC;
                   color:#888;font-size:10px;text-transform:uppercase;
                   letter-spacing:0.5px">Item</th>
        <th style="text-align:right;padding:3px 6px;background:#F4F1EC;
                   color:#888;font-size:10px;text-transform:uppercase;
                   letter-spacing:0.5px">Qty</th>
      </tr></thead>
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
  renderStatusEditor();
  renderLayout();
}
