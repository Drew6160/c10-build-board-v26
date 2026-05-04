function updateSimulation(){

  // --- STEP 1: initialize base voltage at source nodes
  Object.values(STATE.nodes).forEach(n=>{
    n.inputVoltage = 0;
    n.effectiveVoltage = 0;
  });

  // define base sources
  if (STATE.nodes.battery){
    // simulate alternator / battery variability
    STATE.nodes.battery.effectiveVoltage = 13.5 - (Math.random() * 2);
  }

  // --- STEP 2: propagate through graph
  const routes = buildRoutes();

  routes.forEach(r => {

    const fromNode = STATE.nodes[r.from];
    const toNode = STATE.nodes[r.to];

    if (!fromNode || !toNode) return;

    // simulate wire drop (basic for now)
    const wireDrop = 0.2 + Math.random() * 0.5;

    const deliveredVoltage = Math.max(
      fromNode.effectiveVoltage - wireDrop,
      0
    );

    // accumulate highest incoming voltage
    if (deliveredVoltage > toNode.inputVoltage){
      toNode.inputVoltage = deliveredVoltage;
    }

  });

  // --- STEP 3: finalize node voltage
  Object.values(STATE.nodes).forEach(n=>{
    if (n.id !== "battery"){
      n.effectiveVoltage = n.inputVoltage;
    }
  });
}
