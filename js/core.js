function step(){
  updateSimulation();
  detectFailures();
  renderAll();   // ← THIS IS WHAT YOU’RE MISSING
}
