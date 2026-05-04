function updateSimulation(){

  Object.values(STATE.nodes).forEach(n=>{

    // simulate load fluctuation
    const drop = Math.random() * 3;

    n.effectiveVoltage = 14 - drop;

  });
}
