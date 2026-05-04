const WIRE_TABLE = [
  { gauge: "16 AWG", maxAmp: 10 },
  { gauge: "14 AWG", maxAmp: 15 },
  { gauge: "12 AWG", maxAmp: 20 },
  { gauge: "10 AWG", maxAmp: 30 },
  { gauge: "8 AWG",  maxAmp: 50 }
];
function selectWireSize(current){

  return WIRE_TABLE.find(w => current <= w.maxAmp) || {
    gauge: "4 AWG",
    maxAmp: 100
  };
}

function selectFuse(current){

  // typical rule: 125–150% of load
  const target = current * 1.25;

  const standard = [5,10,15,20,25,30,40,50,60,80,100];

  return standard.find(f => f >= target) || 100;
}
function generateWiringSpec(){

  return EDGES.map(e=>{

    const load = 10; // placeholder

    return {
      id: `${e.from}_${e.to}`,   // ← THIS IS CRITICAL
      circuit: `${e.from} → ${e.to}`,
      wire: load > 15 ? "10 AWG" : "12 AWG",
      fuse: load > 15 ? "30A" : "20A"
    };
  });
}
