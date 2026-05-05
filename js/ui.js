// -----------------------------
// Route selection handler
// -----------------------------
window.selectRoute = function(id){
  const route = buildRoutes().find(r => r.id === id);
  if (!route) return;
  const spec = generateWiringSpec().find(s => s.id === id);
  if (!spec){
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
          : `<span style="color:#3E6B48">✓ OK</span>`
        }
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
      <button onclick="forceFailure()" style="background:#B00020">⚠ Battery Low</button>
      <button onclick="killBattery()" style="background:#555">✕ Kill Battery</button>
    </div>
  `;
}

// -----------------------------
// Failure simulation
// -----------------------------
function forceFailure(){
  STATE.nodes.battery.effectiveVoltage = 9;
  STATE.nodes.battery.failed = true;
  renderAll();
}

function killBattery(){
  STATE.nodes.battery.effectiveVoltage = 9;
  renderAll();
}

// -----------------------------
// Graph / system status panel
// -----------------------------
function renderGraph(){
  const nodes  = Object.values(STATE.nodes);
  const total  = nodes.length;
  const failed = nodes.filter(n => n.failed).length;
  const avgV   = (nodes.reduce((s,n)=>s+(n.effectiveVoltage||12),0)/total).toFixed(2);

  const zones = { A: [], B: [], C: [] };
  nodes.forEach(n => {
    const z = n.zone || "A";
    if (zones[z]) zones[z].push(n);
  });

  const zoneLabels = { A: "Engine Bay", B: "Cab", C: "Rear Node" };

  const zoneHTML = Object.entries(zones).map(([key, znodes])=>`
    <div style="margin:6px 0 2px;font-size:10px;font-weight:bold;
                color:#888;letter-spacing:1px">
      ${zoneLabels[key].toUpperCase()}
    </div>
    ${znodes.map(n=>`
      <div style="padding:3px 6px;
                  border-left:3px solid ${n.failed ? "#B00020" : "#3E6B48"};
                  margin:2px 0;font-size:11px;
                  display:flex;justify-content:space-between">
        <span>${n.label || n.id}</span>
        <span style="color:${n.failed ? "#B00020" : "#555"}">
          ${n.failed ? "FAIL" : "OK"}&nbsp;${(n.effectiveVoltage||12).toFixed(1)}V
        </span>
      </div>
    `).join("")}
  `).join("");

  document.getElementById("graphPanel").innerHTML = `
    <h3 style="margin:0 0 6px;color:#C4622D">System Status</h3>
    <div style="display:flex;gap:16px;font-size:12px;margin-bottom:8px">
      <span><b>${total}</b> nodes</span>
      <span style="color:${failed>0?'#B00020':'#3E6B48'}">
        <b>${failed}</b> failure${failed!==1?"s":""}
      </span>
      <span><b>${avgV}V</b> avg</span>
    </div>
    <hr style="border:none;border-top:1px solid #D8D2C8;margin:0 0 6px">
    ${zoneHTML}
  `;
}

// -----------------------------
// BOM panel — proper table
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
