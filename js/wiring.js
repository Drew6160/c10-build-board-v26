const WIRE_TABLE = [
  { gauge: "16 AWG", maxAmp: 10 },
  { gauge: "14 AWG", maxAmp: 15 },
  { gauge: "12 AWG", maxAmp: 20 },
  { gauge: "10 AWG", maxAmp: 30 },
  { gauge: "8 AWG",  maxAmp: 50 }
];

function selectWireSize(current){
  const designCurrent = current * 1.3;
  return WIRE_TABLE.find(w => designCurrent <= w.maxAmp) || {
    gauge: "4 AWG", maxAmp: 100
  };
}

function selectFuse(current){
  const target   = current * 1.25;
  const standard = [5,10,15,20,25,30,40,50,60,80,100];
  return standard.find(f => f >= target) || 100;
}

// -----------------------------
// loom-aware wiring spec
// -----------------------------
function generateWiringSpec({ loom } = {}){
  const edges = loom
    ? EDGES.filter(e => e.loom === loom)
    : EDGES;

  return edges.map(e => {
    const id       = `${e.from}_${e.to}`;
    const toNode   = STATE.nodes[e.to];
    const baseCurrent      = toNode?.load || 1;
    let   adjustedCurrent  = baseCurrent;

    if(toNode?.type === "motor") adjustedCurrent *= 1.5;

    const resistance   = e.resistance || 0.02;
    const wire         = selectWireSize(adjustedCurrent);
    const fuse         = selectFuse(adjustedCurrent);
    const voltageDrop  = (baseCurrent * resistance).toFixed(2);

    const warnings = [];
    if(adjustedCurrent > wire.maxAmp)   warnings.push("UNDERSIZED WIRE");
    if(fuse > wire.maxAmp * 1.5)        warnings.push("FUSE TOO LARGE");
    if(parseFloat(voltageDrop) > 1.0)   warnings.push("HIGH VOLTAGE DROP");

    return {
      id,
      circuit:         `${e.from} → ${e.to}`,
      loom:            e.loom || "—",
      current:         baseCurrent,
      adjustedCurrent,
      wire:            wire.gauge,
      fuse:            `${fuse}A`,
      drop:            voltageDrop,
      warnings
    };
  });
}
