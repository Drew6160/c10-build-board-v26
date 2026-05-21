// =============================
// Wiring Specification Engine
// Full heavy-gauge wire table
// =============================

const WIRE_TABLE = [
  { gauge: "16 AWG", maxAmp: 10  },
  { gauge: "14 AWG", maxAmp: 15  },
  { gauge: "12 AWG", maxAmp: 20  },
  { gauge: "10 AWG", maxAmp: 30  },
  { gauge: "8 AWG",  maxAmp: 50  },
  { gauge: "6 AWG",  maxAmp: 65  },
  { gauge: "4 AWG",  maxAmp: 85  },
  { gauge: "2 AWG",  maxAmp: 115 },
  { gauge: "1/0 AWG",maxAmp: 150 },
  { gauge: "2/0 AWG",maxAmp: 200 },
  { gauge: "4/0 AWG",maxAmp: 300 }
];

function selectWireSize(current){
  const designCurrent = current * 1.3;
  return WIRE_TABLE.find(w => designCurrent <= w.maxAmp) || {
    gauge: "4/0 AWG", maxAmp: 300
  };
}

function selectFuse(current){
  const target   = current * 1.25;
  const standard = [5,10,15,20,25,30,40,50,60,80,100,125,150,175,200,250,300];
  return standard.find(f => f >= target) || 300;
}

function generateWiringSpec({ loom } = {}){
  const edges = loom
    ? EDGES.filter(e => e.loom === loom)
    : EDGES;

  return edges.map(e => {
    const id      = `${e.from}_${e.to}`;
    const toNode  = STATE.nodes[e.to];
    const baseCurrent     = toNode?.load || 1;
    let   adjustedCurrent = baseCurrent;

    if(toNode?.type === "motor"){
      adjustedCurrent = baseCurrent <= 20
        ? baseCurrent * 1.5   // small motors: fans, pumps
        : baseCurrent * 1.25; // large motors: starter
    }

    const resistance  = e.resistance || 0.02;

    // wireOverride lets system.json specify exact gauge for known cable runs
    const wireOverride = e.wireOverride || null;
    const wireTable    = wireOverride
      ? { gauge: wireOverride, maxAmp: 9999 }
      : selectWireSize(adjustedCurrent);

    const fuse        = selectFuse(adjustedCurrent);
    const voltageDrop = (baseCurrent * resistance).toFixed(2);

    const warnings = [];
    if(!wireOverride && adjustedCurrent > wireTable.maxAmp)
      warnings.push("UNDERSIZED WIRE");
    if(fuse > wireTable.maxAmp * 1.5 && !wireOverride)
      warnings.push("FUSE TOO LARGE");
    if(parseFloat(voltageDrop) > 1.0)
      warnings.push("HIGH VOLTAGE DROP");

    return {
      id,
      circuit:         `${e.from} → ${e.to}`,
      loom:            e.loom || "—",
      current:         baseCurrent,
      adjustedCurrent,
      wire:            wireTable.gauge,
      fuse:            `${fuse}A`,
      drop:            voltageDrop,
      warnings
    };
  });
}
