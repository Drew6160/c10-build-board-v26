function generateWiringSpec(){
  return EDGES.map(e=>({
    circuit: `${e.from} → ${e.to}`,
    wire: "12 AWG",
    fuse: "20A"
  }));
}
