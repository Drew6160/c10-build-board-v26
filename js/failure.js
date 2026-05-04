function detectFailures(){

  Object.values(STATE.nodes).forEach(n=>{

    // failure zones
    if (n.effectiveVoltage < 11.5){
      n.failed = true;
    } else {
      n.failed = false;
    }

  });
}
