function renderControls(){
  document.getElementById("controlsPanel").innerHTML = `
    <button onclick="step()">Step</button>
    <button onclick="runOptimization()">Optimize</button>
    <button onclick="downloadReport()">Export</button>
  `;
}

function renderGraph(){

  const nodes = Object.values(STATE.nodes);

  const total = nodes.length;
  const failed = nodes.filter(n => n.failed).length;

  const avgVoltage = (
    nodes.reduce((sum,n)=>sum + (n.effectiveVoltage || 12),0) / total
  ).toFixed(2);

  document.getElementById("graphPanel").innerHTML = `
    <h3>System Status</h3>

    <div><b>Nodes:</b> ${total}</div>
    <div><b>Failures:</b> ${failed}</div>
    <div><b>Avg Voltage:</b> ${avgVoltage}V</div>

    <hr>

    ${nodes.map(n=>`
      <div style="
        padding:4px;
        border-left:4px solid ${n.failed ? "#B00020" : "#3E6B48"};
        margin:4px 0;
      ">
        ${n.id || "node"} — 
        ${n.failed ? "FAILED" : "OK"} 
        (${(n.effectiveVoltage || 12).toFixed(1)}V)
      </div>
    `).join("")}
  `;
}



function renderBOM(){
  const b = buildBOM();
  document.getElementById("bomPanel").innerHTML =
    "<pre>"+JSON.stringify(b,null,2)+"</pre>";
}

function renderAll(){
  renderGraph();
  renderControls();
  renderBOM();
  renderLayout();
}
