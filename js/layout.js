function renderLayout(){
  const svg = document.getElementById("layoutSVG");
  if(!svg) return;

  svg.innerHTML = `
    <rect x="50" y="80" width="900" height="340"
      fill="none" stroke="#ccc"/>
  `;
}
