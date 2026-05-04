function detectFailures(){

  Object.values(STATE.nodes).forEach(n=>{

    if (n.effectiveVoltage < 11.5){
      n.failed = true;
    } else {
      n.failed = false;
    }

  });
}
