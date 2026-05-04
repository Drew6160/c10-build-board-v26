const STATE = { nodes: {} };
let EDGES = [];

function initNodes(list){
  const map = {};
  list.forEach(n=>{
    map[n.id] = {
      ...n,
      id: n.id,           // ← REQUIRED
      effectiveVoltage: 12,
      inputVoltage: 0,
      failed: false
    };
  });
  return map;
}

fetch("data/system.json")
.then(r=>r.json())
.then(d=>{
  STATE.nodes = initNodes(d.nodes);
  EDGES = d.edges;
  renderAll();
});
