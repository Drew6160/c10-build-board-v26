function updateSimulation(){

  Object.values(STATE.nodes).forEach(n=>{

    // simulate load (0–1)
    const loadFactor = Math.random();

    // base system voltage
    const baseVoltage = 14;

    // voltage drop increases with load
    const drop = loadFactor * 4; // up to 4V drop

    n.load = loadFactor;
    n.effectiveVoltage = baseVoltage - drop;

  });
}
