function buildBOM(){

  const spec = generateWiringSpec();

  const wireTotals = {};
  const fuseTotals = {};

  spec.forEach(s=>{

    wireTotals[s.wire] = (wireTotals[s.wire] || 0) + 10;

    fuseTotals[s.fuse] = (fuseTotals[s.fuse] || 0) + 1;
  });

  return {
    wire: Object.entries(wireTotals).map(([w,l])=>({
      item: `${w} TXL`,
      qty: `${l} ft`
    })),
    fuses: Object.entries(fuseTotals).map(([f,q])=>({
      item: `${f} fuse`,
      qty: q
    })),
    connectors: [
      {item:"Deutsch DT", qty: spec.length * 2}
    ]
  };
}
