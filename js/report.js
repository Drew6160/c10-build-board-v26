// =============================
// Report / Export Engine
// Generates a printable HTML
// wiring spec in a new window
// =============================

function downloadReport(){
  const nodes   = Object.values(STATE.nodes);
  const spec    = generateWiringSpec({ loom: ACTIVE_LOOM });
  const bom     = buildBOM({ loom: ACTIVE_LOOM });
  const now     = new Date().toLocaleDateString("en-US",{
    year:"numeric", month:"long", day:"numeric"
  });
  const loomLabel = ACTIVE_LOOM
    ? ` — ${ACTIVE_LOOM.replace(/_/g," ").toUpperCase()}`
    : "";

  // --- build status summary
  const statusCounts = { planned:0, ordered:0, installed:0, tested:0 };
  nodes.forEach(n=>{
    const s = STATE.status?.[n.id]?.status || "planned";
    if(statusCounts[s]!==undefined) statusCounts[s]++;
  });
  const total     = nodes.length;
  const doneCount = statusCounts.installed + statusCounts.tested;
  const pct       = Math.round((doneCount/total)*100);

  // --- zone grouping
  const zones = { A:[], B:[], C:[] };
  nodes.forEach(n=>{ if(zones[n.zone]) zones[n.zone].push(n); });
  const zoneLabels = { A:"Engine Bay", B:"Cab", C:"Rear Node" };

  const statusColors = {
    planned:"#AAA", ordered:"#2D6C8C",
    installed:"#C4622D", tested:"#3E6B48"
  };

  // --- node table rows by zone
  const nodeTableRows = Object.entries(zones).map(([key, znodes])=>`
    <tr style="background:#F4F1EC">
      <td colspan="5" style="padding:6px 10px;font-weight:bold;
          font-size:11px;color:#888;letter-spacing:1px;
          text-transform:uppercase">${zoneLabels[key]}</td>
    </tr>
    ${znodes.map(n=>{
      const sKey  = STATE.status?.[n.id]?.status || "planned";
      const sColor = statusColors[sKey];
      const vFail  = n.failed;
      const vColor = vFail ? "#B00020" : "#2E2A26";
      return `
        <tr>
          <td style="padding:5px 10px;border-bottom:1px solid #F0EDE8">
            ${n.tier===2?'<span style="color:#AAA;font-size:10px">[T2] </span>':''}
            <b>${n.label||n.id}</b>
          </td>
          <td style="padding:5px 10px;border-bottom:1px solid #F0EDE8;
                     font-size:11px;color:#555">${n.partNumber||"—"}</td>
          <td style="padding:5px 10px;border-bottom:1px solid #F0EDE8;
                     font-size:11px;color:${sColor};font-weight:bold">
            ${sKey.toUpperCase()}
          </td>
          <td style="padding:5px 10px;border-bottom:1px solid #F0EDE8;
                     font-size:11px;color:${vColor}">
            ${(n.effectiveVoltage||12).toFixed(1)}V
            ${vFail?'<b style="color:#B00020"> FAULT</b>':''}
          </td>
          <td style="padding:5px 10px;border-bottom:1px solid #F0EDE8;
                     font-size:11px;color:#555;max-width:280px">
            ${n.notes||""}
          </td>
        </tr>`;
    }).join("")}
  `).join("");

  // --- wiring spec rows
  const wiringRows = spec.map(s=>{
    const hasFault = s.warnings.length > 0;
    return `
      <tr style="background:${hasFault?"#FFF8F0":"white"}">
        <td style="padding:5px 10px;border-bottom:1px solid #F0EDE8;
                   font-size:11px">${s.circuit}</td>
        <td style="padding:5px 10px;border-bottom:1px solid #F0EDE8;
                   font-size:11px;color:#555">${(s.loom||"—").replace(/_/g," ")}</td>
        <td style="padding:5px 10px;border-bottom:1px solid #F0EDE8;
                   font-size:11px;text-align:center">${s.current}A</td>
        <td style="padding:5px 10px;border-bottom:1px solid #F0EDE8;
                   font-size:11px;text-align:center">${s.adjustedCurrent.toFixed(1)}A</td>
        <td style="padding:5px 10px;border-bottom:1px solid #F0EDE8;
                   font-size:11px;text-align:center">${s.wire} TXL</td>
        <td style="padding:5px 10px;border-bottom:1px solid #F0EDE8;
                   font-size:11px;text-align:center">${s.fuse}</td>
        <td style="padding:5px 10px;border-bottom:1px solid #F0EDE8;
                   font-size:11px;text-align:center">${s.drop}V</td>
        <td style="padding:5px 10px;border-bottom:1px solid #F0EDE8;
                   font-size:11px;color:${hasFault?"#B00020":"#3E6B48"}">
          ${hasFault ? "⚠ "+s.warnings.join(", ") : "✓ OK"}
        </td>
      </tr>`;
  }).join("");

  // --- BOM rows
  const bomSection = (title, rows) => `
    <tr style="background:#F4F1EC">
      <td colspan="2" style="padding:5px 10px;font-weight:bold;
          font-size:11px;color:#C4622D;text-transform:uppercase;
          letter-spacing:0.5px">${title}</td>
    </tr>
    ${rows.map(r=>`
      <tr>
        <td style="padding:4px 10px;border-bottom:1px solid #F0EDE8;
                   font-size:11px">${r.item}</td>
        <td style="padding:4px 10px;border-bottom:1px solid #F0EDE8;
                   font-size:11px;text-align:right;font-weight:bold">
          ${r.qty}
        </td>
      </tr>`).join("")}
  `;

  // --- failures section
  const failedNodes = nodes.filter(n=>n.failed);
  const failureSection = failedNodes.length ? `
    <div style="margin:30px 0 15px;padding:12px 16px;
                background:#FFF0F0;border-left:4px solid #B00020;
                border-radius:0 6px 6px 0">
      <h3 style="margin:0 0 10px;color:#B00020;font-size:14px">
        ⚠ Active Faults — ${failedNodes.length} node${failedNodes.length>1?"s":""}
      </h3>
      ${failedNodes.map(n=>{
        const diag = buildDiagnostics(n.id);
        const firstFault = diag.find(d=>d.status==="FAIL");
        return `
          <div style="margin-bottom:8px;font-size:12px">
            <b>${n.label||n.id}</b> —
            ${(n.effectiveVoltage||0).toFixed(1)}V
            ${firstFault
              ? `<span style="color:#555"> → First upstream fault:
                 <b>${firstFault.label}</b> at ${firstFault.voltage}V</span>`
              : ""}
          </div>`;
      }).join("")}
    </div>` : "";

  // --- assemble full report HTML
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>C10 Build Board — Wiring Report${loomLabel}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: Inter, system-ui, sans-serif;
      color: #2E2A26;
      margin: 0;
      padding: 30px 40px;
      font-size: 13px;
    }
    h1 { color: #C4622D; margin: 0 0 4px; font-size: 22px; }
    h2 { color: #C4622D; margin: 30px 0 10px;
         font-size: 15px; border-bottom: 2px solid #F0EDE8;
         padding-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    th { background: #F4F1EC; padding: 6px 10px; text-align: left;
         font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;
         color: #888; }
    th.right, td.right { text-align: right; }
    .meta { color: #888; font-size: 12px; margin-bottom: 20px; }
    .progress-bar { background: #F0EDE8; border-radius: 4px;
                    height: 8px; margin: 6px 0 16px; }
    .progress-fill { background: #C4622D; height: 8px; border-radius: 4px; }
    .stat { display: inline-block; margin-right: 24px; }
    .stat b { font-size: 18px; }
    .stat span { font-size: 11px; color: #888; display: block; }
    @media print {
      body { padding: 15px 20px; }
      h2 { page-break-before: auto; }
      table { page-break-inside: avoid; }
    }
  </style>
</head>
<body>

  <h1>1967 C10 — Electrical Build Report${loomLabel}</h1>
  <div class="meta">Generated ${now}
    ${ACTIVE_LOOM
      ? ` · Filtered to: <b>${ACTIVE_LOOM.replace(/_/g," ")}</b>`
      : " · All systems"}
  </div>

  <!-- Build Progress -->
  <div style="margin-bottom:24px">
    <div class="stat"><b>${total}</b><span>Total Nodes</span></div>
    <div class="stat"><b>${doneCount}</b><span>Installed / Tested</span></div>
    <div class="stat"><b>${pct}%</b><span>Complete</span></div>
    <div class="stat" style="color:${statusCounts.planned>0?"#AAA":"#3E6B48"}">
      <b>${statusCounts.planned}</b><span>Planned</span></div>
    <div class="stat" style="color:#2D6C8C">
      <b>${statusCounts.ordered}</b><span>Ordered</span></div>
    <div class="stat" style="color:#C4622D">
      <b>${statusCounts.installed}</b><span>Installed</span></div>
    <div class="stat" style="color:#3E6B48">
      <b>${statusCounts.tested}</b><span>Tested</span></div>
    <div class="progress-bar">
      <div class="progress-fill" style="width:${pct}%"></div>
    </div>
  </div>

  ${failureSection}

  <!-- Component List -->
  <h2>Component List</h2>
  <table>
    <thead>
      <tr>
        <th>Component</th>
        <th>Part Number</th>
        <th>Status</th>
        <th>Voltage</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>${nodeTableRows}</tbody>
  </table>

  <!-- Wiring Specification -->
  <h2>Wiring Specification${loomLabel}</h2>
  <table>
    <thead>
      <tr>
        <th>Circuit</th>
        <th>Loom</th>
        <th class="right">Load</th>
        <th class="right">Design</th>
        <th>Wire</th>
        <th>Fuse</th>
        <th class="right">V Drop</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>${wiringRows}</tbody>
  </table>

  <!-- Bill of Materials -->
  <h2>Bill of Materials${loomLabel}</h2>
  <table style="max-width:400px">
    <thead>
      <tr>
        <th>Item</th>
        <th class="right">Quantity</th>
      </tr>
    </thead>
    <tbody>
      ${bomSection("Wire", bom.wire)}
      ${bomSection("Fuses", bom.fuses)}
      ${bomSection("Connectors", bom.connectors)}
    </tbody>
  </table>

  <div style="margin-top:40px;padding-top:16px;border-top:1px solid #F0EDE8;
              font-size:10px;color:#AAA">
    1967 C10 Electrical Build Board · Generated ${now}
    · Verify all wire sizing and fuse ratings against final installed loads
    before energizing any circuit.
  </div>

</body>
</html>`;

  // open in new window for print/save
  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();

  // slight delay then trigger print dialog
  setTimeout(()=>{ win.print(); }, 400);
}
