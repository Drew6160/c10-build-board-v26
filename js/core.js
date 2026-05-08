// =============================
// Core v28 — State + Utils
// + History recording for
//   fault playback
// =============================

// -----------------------------
// Loom context helpers
// -----------------------------
function isEdgeInActiveLoom(e){
  return !ACTIVE_LOOM || e.loom === ACTIVE_LOOM;
}
function isNodeInActiveLoom(nodeId){
  return EDGES.some(e =>
    (e.from === nodeId || e.to === nodeId) &&
    isEdgeInActiveLoom(e)
  );
}

// -----------------------------
// Full recursive upstream trace
// -----------------------------
function traceUpstream(nodeId){
  const visited = new Set();
  const result  = [];
  function walk(current){
    EDGES.filter(e => e.to === current).forEach(e => {
      if(!visited.has(e.from)){
        visited.add(e.from);
        walk(e.from);
        result.push({ id: e.from, loom: e.loom, type: e.type });
      }
    });
  }
  walk(nodeId);
  return result;
}

// -----------------------------
// Diagnostics engine
// -----------------------------
function buildDiagnostics(nodeId){
  return traceUpstream(nodeId).map(item => {
    const n = STATE.nodes[item.id];
    const v = n ? (n.effectiveVoltage || 0) : 12;
    let status = "OK";
    if(!n || n.failed || v < 10)  status = "FAIL";
    else if(v < 12.0)             status = "LOW";
    return {
      id:      item.id,
      label:   n?.label || item.id,
      loom:    item.loom,
      voltage: v.toFixed(2),
      status
    };
  });
}

// -----------------------------
// Failure cascade
// -----------------------------
function propagateFailures(){
  for(let pass = 0; pass < 6; pass++){
    EDGES.forEach(e => {
      const from = STATE.nodes[e.from];
      const to   = STATE.nodes[e.to];
      if(!from || !to) return;
      const fromV = from.effectiveVoltage || 0;
      if(from.failed || fromV < 10){
        to.failed           = true;
        to.effectiveVoltage = Math.max(fromV - 1.5, 0);
      }
    });
  }
}

// -----------------------------
// History — snapshot on each step
// Max 30 frames retained
// -----------------------------
const MAX_HISTORY = 30;

function snapshotState(){
  const snap = {};
  Object.entries(STATE.nodes).forEach(([id, n])=>{
    snap[id] = {
      effectiveVoltage: n.effectiveVoltage,
      inputVoltage:     n.inputVoltage,
      failed:           n.failed
    };
  });
  return snap;
}

function recordHistory(){
  if(!STATE.history) STATE.history = [];
  STATE.history.push(snapshotState());
  if(STATE.history.length > MAX_HISTORY){
    STATE.history.shift();
  }
  STATE.playbackFrame = null; // exit playback mode on new step
}

// Apply a historical snapshot to nodes
function applySnapshot(snap){
  Object.entries(snap).forEach(([id, data])=>{
    if(STATE.nodes[id]){
      STATE.nodes[id].effectiveVoltage = data.effectiveVoltage;
      STATE.nodes[id].inputVoltage     = data.inputVoltage;
      STATE.nodes[id].failed           = data.failed;
    }
  });
}

// -----------------------------
// Simulation step
// -----------------------------
function step(){
  // exit playback before running new step
  if(STATE.playbackFrame !== null && STATE.playbackFrame !== undefined){
    exitPlayback();
  }
  updateSimulation();
  propagateFailures();
  detectFailures();
  recordHistory();
  renderAll();
  renderPlaybackControls();
}

// -----------------------------
// Playback controls
// -----------------------------
let _playbackTimer = null;

function renderPlaybackControls(){
  const panel = document.getElementById("playbackPanel");
  if(!panel) return;
  const hist    = STATE.history || [];
  const total   = hist.length;
  const current = STATE.playbackFrame;
  const inPlay  = current !== null && current !== undefined;

  if(total === 0){
    panel.innerHTML=`
      <div style="font-size:10px;color:#AAA;padding:4px 0">
        Hit <b>Step</b> or <b>Battery Low</b> to record history
      </div>`;
    return;
  }

  const frameLabel = inPlay
    ? `Frame ${current + 1} of ${total}`
    : `Live — ${total} frame${total!==1?"s":""} recorded`;

  panel.innerHTML=`
    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
      <span style="font-size:10px;font-weight:bold;color:#AAA;
                   letter-spacing:1px;white-space:nowrap">PLAYBACK</span>
      <button onclick="playbackFirst()"
        title="First frame"
        style="padding:3px 8px;font-size:11px;background:#2D6C8C">
        ⏮
      </button>
      <button onclick="playbackPrev()"
        title="Previous frame"
        style="padding:3px 8px;font-size:11px;background:#2D6C8C">
        ◀
      </button>
      <button onclick="togglePlaybackPlay()"
        id="playPauseBtn"
        style="padding:3px 10px;font-size:11px;
               background:${_playbackTimer?"#E09B2D":"#3E6B48"}">
        ${_playbackTimer ? "⏸ Pause" : "▶ Play"}
      </button>
      <button onclick="playbackNext()"
        title="Next frame"
        style="padding:3px 8px;font-size:11px;background:#2D6C8C">
        ▶
      </button>
      <button onclick="playbackLast()"
        title="Last frame"
        style="padding:3px 8px;font-size:11px;background:#2D6C8C">
        ⏭
      </button>
      <button onclick="exitPlayback()"
        title="Return to live"
        style="padding:3px 8px;font-size:11px;background:#555">
        ✕ Live
      </button>
      <span style="font-size:10px;color:${inPlay?"#C4622D":"#888"};
                   margin-left:4px">${frameLabel}</span>
    </div>
    ${inPlay && total > 1 ? `
    <input type="range" min="0" max="${total-1}" value="${current}"
      oninput="scrubPlayback(parseInt(this.value))"
      style="width:100%;margin-top:6px;accent-color:#C4622D">` : ""}
  `;
}

function goToFrame(i){
  const hist = STATE.history || [];
  if(!hist.length) return;
  const idx = Math.max(0, Math.min(hist.length - 1, i));
  STATE.playbackFrame = idx;
  applySnapshot(hist[idx]);
  renderLayout();
  renderPlaybackControls();
}

window.playbackFirst = ()=>{ stopPlaybackTimer(); goToFrame(0); };
window.playbackLast  = ()=>{ stopPlaybackTimer(); goToFrame((STATE.history||[]).length-1); };
window.playbackPrev  = ()=>{ stopPlaybackTimer(); goToFrame((STATE.playbackFrame??((STATE.history||[]).length))-1); };
window.playbackNext  = ()=>{ stopPlaybackTimer(); goToFrame((STATE.playbackFrame??-1)+1); };
window.scrubPlayback = (i)=>{ stopPlaybackTimer(); goToFrame(i); };

window.togglePlaybackPlay = function(){
  if(_playbackTimer){
    stopPlaybackTimer();
    renderPlaybackControls();
  } else {
    startPlaybackTimer();
  }
};

function startPlaybackTimer(){
  const hist = STATE.history || [];
  if(!hist.length) return;
  // start from beginning if at end or no frame selected
  const start = STATE.playbackFrame ?? 0;
  if(start >= hist.length - 1) STATE.playbackFrame = 0;
  _playbackTimer = setInterval(()=>{
    const next = (STATE.playbackFrame ?? 0) + 1;
    if(next >= hist.length){
      stopPlaybackTimer();
      renderPlaybackControls();
      return;
    }
    goToFrame(next);
  }, 600);
  renderPlaybackControls();
}

function stopPlaybackTimer(){
  if(_playbackTimer){ clearInterval(_playbackTimer); _playbackTimer=null; }
}

window.exitPlayback = function(){
  stopPlaybackTimer();
  STATE.playbackFrame = null;
  // restore live state
  updateSimulation();
  propagateFailures();
  detectFailures();
  renderAll();
  renderPlaybackControls();
};

// -----------------------------
// Optimization placeholder
// -----------------------------
function runOptimization(){
  console.log("runOptimization called");
}
