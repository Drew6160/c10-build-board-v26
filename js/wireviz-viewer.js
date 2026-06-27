// =============================
// WireViz Harness Viewer v2
// Adds pan + zoom to large WireViz
// HTML exports loaded into the
// iframe.
//
// v1 just set iframe.src to a blob
// URL of the raw uploaded file.
// That's fine for a small harness,
// but cab_harness-5.html's SVG is
// 25396pt x 2449pt (~10.4:1 aspect
// ratio) -- there is no single
// iframe size that shows that
// legibly, and the #viewer-container
// CSS rule in style.css can't reach
// it anyway since it lives in the
// PARENT document while the SVG is
// rendered inside the iframe's own,
// separate document.
//
// Fix: read the uploaded file as
// TEXT (not as an opaque blob),
// inject a small pan/zoom layer
// into its <head>/<body> before
// creating the blob, then load
// the now-enhanced document into
// the iframe. This works for any
// WireViz 0.4.1 HTML export with
// zero changes to the render
// pipeline on the NAS, because the
// injection targets WireViz's own
// fixed template structure
// (<div id="diagram"> wrapping the
// inline <svg>).
// =============================

const uploadedHarnesses = {}; // filename -> raw HTML text

// -----------------------------
// Injects a pan/zoom layer into a
// WireViz-exported HTML string.
// Pure string-in/string-out -- kept
// at module scope (rather than
// nested inside the DOMContentLoaded
// handler below) so it has no DOM
// dependency of its own and can be
// exercised directly in tests.
// -----------------------------
function injectPanZoom(html) {
  const styleBlock = `
<style id="panzoom-injected">
  html, body { margin:0; padding:0; }
  #panzoom-toolbar {
    position: sticky; top: 0; z-index: 100;
    display: flex; align-items: center; gap: 6px;
    padding: 6px 10px; background: #2E2A26; color: #fff;
    font-family: Inter, system-ui, sans-serif; font-size: 12px;
  }
  #panzoom-toolbar button {
    background: #444; color: #fff; border: 1px solid #666;
    border-radius: 4px; padding: 3px 9px; font-size: 12px; cursor: pointer;
  }
  #panzoom-toolbar button:hover { background: #555; }
  #panzoom-toolbar span { opacity: 0.8; }
  #panzoom-toolbar .pz-hint { margin-left: auto; opacity: 0.6; }
  #panzoom-viewport {
    width: 100%;
    height: calc(100vh - 34px);
    overflow: hidden;
    cursor: grab;
    background: #fafaf8;
    position: relative;
    user-select: none;
  }
  #panzoom-viewport.dragging { cursor: grabbing; }
  #diagram { transform-origin: 0 0; will-change: transform; }
  #diagram svg { display: block; }
</style>`;

  const scriptBlock = `
<script id="panzoom-injected-script">
(function(){
  function init(){
    var diagram = document.getElementById("diagram");
    if(!diagram) return; // not a recognizable WireViz export, leave page as-is

    var viewport = document.createElement("div");
    viewport.id = "panzoom-viewport";
    diagram.parentNode.insertBefore(viewport, diagram);
    viewport.appendChild(diagram);

    var toolbar = document.createElement("div");
    toolbar.id = "panzoom-toolbar";
    toolbar.innerHTML =
      '<button type="button" data-act="fit">Fit Width</button>' +
      '<button type="button" data-act="zoomout">\u2212</button>' +
      '<button type="button" data-act="zoomin">+</button>' +
      '<button type="button" data-act="reset">100%</button>' +
      '<span id="panzoom-pct">100%</span>' +
      '<span class="pz-hint">drag to pan &middot; scroll to zoom</span>';
    document.body.insertBefore(toolbar, document.body.firstChild);

    var scale = 1, originX = 0, originY = 0;
    var dragging = false, lastX = 0, lastY = 0;

    function naturalWidthPx(svg){
      var attr = svg.getAttribute("width") || "";
      var m = attr.match(/^([\\d.]+)\\s*(pt|px|in|cm|mm)?$/i);
      var pxPerUnit = { pt: 4/3, px: 1, in: 96, cm: 96/2.54, mm: 96/25.4 };
      if(m){
        var val = parseFloat(m[1]);
        var unit = (m[2] || "px").toLowerCase();
        return val * (pxPerUnit[unit] || 1);
      }
      if(svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width){
        return svg.viewBox.baseVal.width;
      }
      return svg.getBoundingClientRect().width || 1000;
    }

    function apply(){
      diagram.style.transform =
        "translate(" + originX + "px," + originY + "px) scale(" + scale + ")";
      var pct = document.getElementById("panzoom-pct");
      if(pct) pct.textContent = Math.round(scale * 100) + "%";
    }

    function fitWidth(){
      var svg = diagram.querySelector("svg");
      if(!svg) return;
      var w = naturalWidthPx(svg);
      var available = viewport.clientWidth - 24;
      scale = available > 0 && w > 0 ? available / w : 1;
      if(!isFinite(scale) || scale <= 0) scale = 1;
      originX = 12; originY = 12;
      apply();
    }

    toolbar.addEventListener("click", function(e){
      var act = e.target.getAttribute("data-act");
      if(!act) return;
      if(act === "fit") fitWidth();
      if(act === "reset"){ scale = 1; originX = 0; originY = 0; apply(); }
      if(act === "zoomin")  { scale = Math.min(scale * 1.25, 8); apply(); }
      if(act === "zoomout") { scale = Math.max(scale / 1.25, 0.02); apply(); }
    });

    viewport.addEventListener("mousedown", function(e){
      e.preventDefault();
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      viewport.classList.add("dragging");
    });
    window.addEventListener("mouseup", function(){
      dragging = false; viewport.classList.remove("dragging");
    });
    window.addEventListener("mousemove", function(e){
      if(!dragging) return;
      originX += (e.clientX - lastX);
      originY += (e.clientY - lastY);
      lastX = e.clientX; lastY = e.clientY;
      apply();
    });

    viewport.addEventListener("wheel", function(e){
      e.preventDefault();
      var rect = viewport.getBoundingClientRect();
      var mx = e.clientX - rect.left, my = e.clientY - rect.top;
      var prevScale = scale;
      var factor = e.deltaY < 0 ? 1.1 : 0.9;
      scale = Math.min(8, Math.max(0.02, scale * factor));
      originX = mx - ((mx - originX) / prevScale) * scale;
      originY = my - ((my - originY) / prevScale) * scale;
      apply();
    }, { passive: false });

    var touchLastX = 0, touchLastY = 0, touching = false;
    viewport.addEventListener("touchstart", function(e){
      if(e.touches.length !== 1) return;
      touching = true;
      touchLastX = e.touches[0].clientX;
      touchLastY = e.touches[0].clientY;
    });
    viewport.addEventListener("touchmove", function(e){
      if(!touching || e.touches.length !== 1) return;
      e.preventDefault();
      var t = e.touches[0];
      originX += (t.clientX - touchLastX);
      originY += (t.clientY - touchLastY);
      touchLastX = t.clientX; touchLastY = t.clientY;
      apply();
    }, { passive: false });
    viewport.addEventListener("touchend", function(){ touching = false; });

    fitWidth();
    window.addEventListener("resize", fitWidth);
  }
  if(document.readyState === "complete" || document.readyState === "interactive"){
    init();
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();
</script>`;

  let out = html;
  out = /<\/head>/i.test(out)
    ? out.replace(/<\/head>/i, styleBlock + "\n</head>")
    : styleBlock + out;
  out = /<\/body>/i.test(out)
    ? out.replace(/<\/body>/i, scriptBlock + "\n</body>")
    : out + scriptBlock;
  return out;
}

function wireUpUploader() {
  const upload = document.getElementById("wirevizUpload");
  const select = document.getElementById("wirevizSelect");
  const frame  = document.getElementById("wirevizFrame");

  if (!upload) return;

  upload.addEventListener("change", (event) => {
    [...event.target.files].forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        uploadedHarnesses[file.name] = e.target.result;

        const alreadyListed = [...select.options].some(o => o.value === file.name);
        if (!alreadyListed) {
          const option = document.createElement("option");
          option.value = file.name;
          option.textContent = file.name;
          select.appendChild(option);
        }

        // Auto-show the first file of a fresh session; later uploads
        // just get added to the dropdown without stealing focus from
        // whatever the person is currently looking at.
        if (!select.value) {
          select.value = file.name;
          loadHarness(file.name);
        }
      };
      reader.onerror = () => console.error(`Failed to read ${file.name}`);
      reader.readAsText(file);
    });
    // allow re-selecting the same file later (e.g. after re-rendering it)
    upload.value = "";
  });

  select.addEventListener("change", () => {
    if (select.value) loadHarness(select.value);
  });

  function loadHarness(filename) {
    const rawHTML = uploadedHarnesses[filename];
    if (!rawHTML) return;
    const enhanced = injectPanZoom(rawHTML);
    const blob = new Blob([enhanced], { type: "text/html" });
    frame.src = URL.createObjectURL(blob);
  }
}

if (typeof module !== "undefined") {
  module.exports = { injectPanZoom, wireUpUploader };
}

// Browser entry point -- no-op under Node, where `document` doesn't exist.
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", wireUpUploader);
}
