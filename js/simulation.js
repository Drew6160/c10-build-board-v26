function updateSimulation(){
  // --- STEP 1: reset voltages but NOT failed flags
  Object.values(STATE.nodes).forEach(n=>{
    n.inputVoltage    = 0;
    n.effectiveVoltage = 0;
  });

  // --- STEP 2: set source voltage
  // Only restore battery if it hasn't been manually failed
  if(STATE.nodes.battery){
    if(!STATE.nodes.battery.failed){
      // normal running voltage: 13.8-14.4V
      STATE.nodes.battery.effectiveVoltage = 13.8 + (Math.random() * 0.6);
    } else {
      // keep it degraded — simulate a dying battery
      const current = STATE.nodes.battery.effectiveVoltage || 9;
      // slowly drain further if already failed
      STATE.nodes.battery.effectiveVoltage = Math.max(
        current - (Math.random() * 0.3), 6
      );
    }
  }
  if(STATE.nodes.alternator){
    STATE.nodes.alternator.effectiveVoltage =
      STATE.nodes.battery?.effectiveVoltage || 0;
  }

  // --- STEP 3: multi-pass propagation (8 passes for full graph coverage)
  const routes = buildRoutes();
  for(let pass = 0; pass < 8; pass++){
    routes.forEach(r=>{
      const fromNode = STATE.nodes[r.from];
      const toNode   = STATE.nodes[r.to];
      if(!fromNode || !toNode) return;
      if(fromNode.effectiveVoltage <= 0) return;

      // realistic wire drop per segment
      const wireDrop       = 0.05 + Math.random() * 0.10;
      const deliveredVoltage = Math.max(
        fromNode.effectiveVoltage - wireDrop, 0
      );

      if(deliveredVoltage > toNode.inputVoltage){
        toNode.inputVoltage = deliveredVoltage;
      }
    });

    // commit after each pass
    Object.values(STATE.nodes).forEach(n=>{
      if(n.id !== "battery" && n.id !== "alternator"){
        n.effectiveVoltage = n.inputVoltage;
      }
    });
  }
}
