function updateSimulation(){
  Object.values(STATE.nodes).forEach(n=>{
    n.effectiveVoltage = 12 + Math.random()*2;
  });
}
