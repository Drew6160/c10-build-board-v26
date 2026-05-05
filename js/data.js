const STATE = { nodes: {}, status: {} };
let EDGES = [];

function initNodes(list){
  const map = {};
  list.forEach(n=>{
    map[n.id] = {
      ...n,
      id: n.id,
      effectiveVoltage: 12,
      inputVoltage: 0,
      failed: false
    };
  });
  return map;
}

// Load system.json and status.json in parallel
Promise.all([
  fetch("data/system.json").then(r => r.json()),
  fetch("data/status.json").then(r => r.json())
])
.then(([system, status]) => {
  STATE.nodes  = initNodes(system.nodes);
  EDGES        = system.edges;
  STATE.status = status.nodes || {};
  renderAll();
})
.catch(err => {
  console.error("Failed to load data:", err);
});
