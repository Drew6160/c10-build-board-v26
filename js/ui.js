function renderControls(){
  document.getElementById("controlsPanel").innerHTML = `
    <button onclick="step()">Step</button>
    <button onclick="runOptimization()">Optimize</button>
    <button onclick="downloadReport()">Export</button>
  `;
}

function renderGraph(){
  document.getElementById("graphPanel").innerHTML =
    "<b>Graph running</b>";
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
