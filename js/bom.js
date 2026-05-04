function buildBOM(){

  const spec = generateWiringSpec();

  const wireTotals = {};

  spec.forEach(s=>{
    wireTotals[s.wire] = (wireTotals[s.wire] || 0) + 10;
  });

  return {
    wire: Object.entries(wireTotals).map(([w,l])=>({
      item: `${w} TXL`,
      qty: `${l} ft`
    })),
    connectors: [{item:"Deutsch DT", qty: spec.length * 2}]
  };
}
