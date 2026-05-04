function generateWiringSpec(){
  return EDGES.map(e=>{

    const load = 10; // placeholder per edge

    return {
      circuit: `${e.from} → ${e.to}`,
      wire: load > 15 ? "10 AWG" : "12 AWG",
      fuse: load > 15 ? "30A" : "20A"
    };
  });
}
