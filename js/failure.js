function detectFailures(){
  Object.values(STATE.nodes).forEach(n=>{
    n.failed = n.effectiveVoltage < 11;
  });
}
