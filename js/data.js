const STATE = { nodes: {} };
let EDGES = [];

function initNodes(list){
  const map = {};
  list.forEach(n=>{
    map[n.id] = { ...n, load: Math.random()*20, active:true };
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
