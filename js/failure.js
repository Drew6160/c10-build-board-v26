function detectFailures(){

  Object.values(STATE.nodes).forEach(n=>{
    n.failed = n.effectiveVoltage < 12; // raise threshold
  });
}
