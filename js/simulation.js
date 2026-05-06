function updateSimulation(){
  // --- STEP 1: reset all nodes
  Object.values(STATE.nodes).forEach(n=>{
    n.inputVoltage    = 0;
    n.effectiveVoltage = 0;
  });

  // --- STEP 2: set source voltage (battery/alternator)
  if(STATE.nodes.battery){
    // realistic range: 13.8-14.4V running, never below 13V on a good step
    STATE.nodes.battery.effectiveVoltage = 13.8 + (Math.random() * 0.6);
  }
  if(STATE.nodes.alternator){
    STATE.nodes.alternator.effectiveVoltage =
      STATE.nodes.battery ? STATE.nodes.battery.effectiveVoltage : 14.0;
  }

  // --- STEP 3: multi-pass propagation
  // Single pass fails on multi-hop graphs because edge order is arbitrary.
  // 8 passes guarantees voltage reaches every node regardless of edge order.
  const routes = buildRoutes();
  for(let pass = 0; pass < 8; pass++){
    routes.forEach(r=>{
      const fromNode = STATE.nodes[r.from];
      const toNode   = STATE.nodes[r.to];
      if(!fromNode || !toNode) return;
      if(fromNode.effectiveVoltage <= 0) return;

      // realistic wire drop: 0.05-0.15V per segment
      const wireDrop       = 0.05 + Math.random() * 0.10;
      const deliveredVoltage = Math.max(fromNode.effectiveVoltage - wireDrop, 0);

      // keep highest incoming voltage (node may have multiple feeds)
      if(deliveredVoltage > toNode.inputVoltage){
        toNode.inputVoltage = deliveredVoltage;
      }
    });

    // commit input → effective after each pass
    Object.values(STATE.nodes).forEach(n=>{
      if(n.id !== "battery" && n.id !== "alternator"){
        n.effectiveVoltage = n.inputVoltage;
      }
    });
  }
}
