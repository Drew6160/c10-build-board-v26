// =============================
// Core — State + Shared Utils
// =============================

// -----------------------------
// Loom context helpers
// Available globally so layout,
// BOM, and diagnostics all use
// the same source of truth
// -----------------------------
function isEdgeInActiveLoom(e){
  return !ACTIVE_LOOM || e.loom === ACTIVE_LOOM;
}

function isNodeInActiveLoom(nodeId){
  return EDGES.some(e =>
    (e.from === nodeId || e.to === nodeId) &&
    isEdgeInActiveLoom(e)
  );
}

// -----------------------------
// Full recursive upstream trace
// Handles multiple feeds +
// branching (real-world wiring)
// -----------------------------
function traceUpstream(nodeId){
  const visited = new Set();
  const result  = [];

  function walk(current){
    EDGES
      .filter(e => e.to === current)
      .forEach(e => {
        if(!visited.has(e.from)){
          visited.add(e.from);
          walk(e.from);
          result.push({ id: e.from, loom: e.loom, type: e.type });
        }
      });
  }

  walk(nodeId);
  return result;
}

// -----------------------------
// Diagnostics engine
// Returns ordered check list
// with live voltage + status
// -----------------------------
function buildDiagnostics(nodeId){
  const path = traceUpstream(nodeId);
  return path.map(item => {
    const n = STATE.nodes[item.id];
    const v = n ? (n.effectiveVoltage || 0) : 12;
    let status = "OK";
    if(!n || n.failed || v < 10)   status = "FAIL";
    else if(v < 12.0)              status = "LOW";
    return {
      id:      item.id,
      label:   n?.label || item.id,
      loom:    item.loom,
      voltage: v.toFixed(2),
      status
    };
  });
}

// -----------------------------
// Failure cascade propagation
// Called after simulation step
// -----------------------------
function propagateFailures(){
  // multiple passes to ensure full cascade
  for(let pass = 0; pass < 6; pass++){
    EDGES.forEach(e => {
      const from = STATE.nodes[e.from];
      const to   = STATE.nodes[e.to];
      if(!from || !to) return;
      const fromV = from.effectiveVoltage || 0;
      if(from.failed || fromV < 10){
        to.failed           = true;
        to.effectiveVoltage = Math.max(fromV - 1.5, 0);
      }
    });
  }
}

// -----------------------------
// Simulation step
// -----------------------------
function step(){
  updateSimulation();
  propagateFailures();
  detectFailures();
  renderAll();
}

// -----------------------------
// Optimization placeholder
// -----------------------------
function runOptimization(){
  console.log("runOptimization called");
}
