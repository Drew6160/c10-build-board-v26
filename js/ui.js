// =============================
// UI v30 — Connector Group Editor + Edge Creation Upgrade
// Phase 1: system.json cleaned (done in JSON file)
// Phase 2: Hardened deleteNode with orphan cleanup + confirmation summary
// Phase 3: Import system.json — full state reload from file
// Phase 4: Edge Editor — add / edit / delete edges in UI
// Phase 5: Full connector-group editor — add/edit/remove connector groups
//          per node (designator/body/gender), add/remove pins per group
//          (label + type), backed by a working draft so in-progress edits
//          don't touch STATE until Save is clicked
// Phase 6: Edge creation upgraded everywhere an edge gets created —
//          type/color/pin selection, replacing the old hardcoded
//          POWER-only "Connect from" stub on Add New. Pin pickers are
//          connector-aware: when a node has documented connector pins,
//          you pick from a labeled list (capturing both the connector
//          designator and pin number) instead of typing a bare number.
// =============================

// -----------------------------
// Shared constants for pin types
// and wire colors, used by both
// the Component Editor's connector
// groups and the Edge Editor
// -----------------------------
const PIN_TYPES = ["POWER", "SIGNAL", "GROUND", "CAN"];
const WIRE_COLOR_OPTIONS = [
  ["BK","Black"],["BN","Brown"],["RD","Red"],["OG","Orange"],
  ["YE","Yellow"],["GN","Green"],["BU","Blue"],["VT","Violet"],
  ["GY","Grey"],["WH","White"],["PK","Pink"],["TQ","Turquoise"]
];

// Deep-clone helper for working drafts — keeps in-progress edits
// isolated from STATE until Save is clicked
function cloneDeep(obj){
  return obj === undefined ? obj : JSON.parse(JSON.stringify(obj));
}

// Flatten a node's connectors[] (groups of pins) into pickable options.
// value encodes both halves ("<designator>::<pin>") so an edge can store
// fromConnector/fromPin (or toConnector/toPin) together, not just a bare
// pin number that could collide across two different connector groups.
function pinOptionsFromConnectors(connectors){
  if(!Array.isArray(connectors)) return [];
  const out = [];
  connectors.forEach(grp=>{
    (grp.pins||[]).forEach(p=>{
      out.push({
        value: `${grp.designator}::${p.pin}`,
        label: `${grp.designator||"?"} · pin ${p.pin} — ${p.label||"?"} (${p.type||"?"})`,
        type:  p.type
      });
    });
  });
  return out;
}

// Renders a pin picker for the given connectors array. Falls back to a
// plain number input when nothing is documented yet, so the field is
// always usable even before connector data exists for that node.
// selectHandler/manualHandler are optional JS function-name strings
// invoked on change/input — used by the Add-Node form to keep a working
// draft in sync across re-renders; left blank by the Edge Editor, which
// reads the DOM directly at save time instead.
function renderPinField(fieldId, connectors, selectedConnector, selectedPin, selectHandler, manualHandler){
  const opts = pinOptionsFromConnectors(connectors);
  const selectedValue = (selectedConnector && selectedPin)
    ? `${selectedConnector}::${selectedPin}` : "";
  const isManualFallback = !selectedValue && selectedPin;

  if(opts.length){
    const onchangeParts = [`toggleManualPin('${fieldId}')`];
    if(selectHandler) onchangeParts.push(`${selectHandler}(this.value)`);
    const manualOninput = manualHandler ? ` oninput="${manualHandler}(this.value)"` : "";
    return `
      <select id="${fieldId}" onchange="${onchangeParts.join('; ')}">
        <option value="">— select pin —</option>
        ${opts.map(o=>`<option value="${o.value}"
          ${selectedValue===o.value?"selected":""}>${o.label}</option>`).join("")}
        <option value="__manual__" ${isManualFallback?"selected":""}>— manual / not documented —</option>
      </select>
      <input id="${fieldId}_manual" type="number" min="1" step="1"
        value="${isManualFallback?selectedPin:""}"
        placeholder="pin #"${manualOninput}
        style="display:${isManualFallback?"block":"none"};margin-top:4px;width:100%">
    `;
  }
  const plainOninput = manualHandler ? ` oninput="${manualHandler}(this.value)"` : "";
  return `<input id="${fieldId}" type="number" min="1" step="1"
    value="${selectedPin||""}" placeholder="pin # (no connectors documented)"${plainOninput}>`;
}

window.toggleManualPin = function(fieldId){
  const sel    = document.getElementById(fieldId);
  const manual = document.getElementById(`${fieldId}_manual`);
  if(!sel || !manual) return;
  manual.style.display = sel.value === "__manual__" ? "block" : "none";
};

// Reads back whatever renderPinField produced for a given field id —
// returns { connector, pin }, either of which may be undefined.
function readPinField(fieldId){
  const el = document.getElementById(fieldId);
  if(!el) return { connector: undefined, pin: undefined };
  if(el.tagName === "SELECT"){
    if(el.value === "__manual__"){
      const manual = document.getElementById(`${fieldId}_manual`);
      const n = manual?.value ? parseInt(manual.value) : undefined;
      return { connector: undefined, pin: n };
    }
    if(el.value){
      const [designator, pin] = el.value.split("::");
      return { connector: designator, pin: parseInt(pin) };
    }
    return { connector: undefined, pin: undefined };
  }
  // plain manual-only input (no documented connectors for that node)
  const n = el.value ? parseInt(el.value) : undefined;
  return { connector: undefined, pin: n };
}

// -----------------------------
// Tab switching
// -----------------------------
window.switchTab = function(tab, btn){
  document.querySelectorAll(".tab-content").forEach(el=>{
    el.style.display = "none";
  });
  document.querySelectorAll(".tab-btn").forEach(el=>{
    el.classList.remove("active");
  });
  document.getElementById(`tab-${tab}`).style.display = "block";
  const activeBtn = btn || (typeof event !== "undefined" ? event.target : null);
  if(activeBtn) activeBtn.classList.add("active");

  if(tab === "manage"){
    renderStatusEditor();
    renderComponentEditor();
    renderEdgeEditor();
    renderBOM();
    renderWiringSpec();
    renderExportPanel();
  }
};

// ==============================
// TAB 1 — DIAGRAM
// ==============================

window.handleNodeClick = function(id){
  const node      = STATE.nodes?.[id];
  const statusKey = STATE.status?.[id]?.status || "planned";
  const v         = node ? (node.effectiveVoltage||0).toFixed(2) : "—";
  const healthKey = !node                                        ? "unknown"
                  : node.failed || node.effectiveVoltage < 10   ? "failed"
                  : node.effectiveVoltage < 12.0                 ? "warn"
                  : "ok";

  const healthColor = {
    ok:"#3E6B48", warn:"#E09B2D", failed:"#B00020", unknown:"#888"
  }[healthKey];
  const statusColors = {
    planned:"#AAA", ordered:"#2D6C8C",
    installed:"#C4622D", tested:"#3E6B48"
  };

  const diag         = buildDiagnostics(id);
  const filteredDiag = ACTIVE_LOOM
    ? diag.filter(d=>EDGES.some(e=>
        e.loom===ACTIVE_LOOM&&(e.from===d.id||e.to===d.id)))
    : diag;

  const diagHTML = filteredDiag.length
    ? filteredDiag.map((d,i)=>{
        const color = d.status==="FAIL"?"#B00020"
                    : d.status==="LOW"?"#E09B2D":"#3E6B48";
        const icon  = d.status==="FAIL"?"✕":d.status==="LOW"?"⚠":"✓";
        return `
          <div style="display:flex;align-items:center;gap:8px;
                      padding:4px 6px;margin:2px 0;border-radius:4px;
                      border-left:3px solid ${color};
                      background:${d.status==="FAIL"?"#FFF0F0":
                                   d.status==="LOW"?"#FFFBF0":"#F4FFF6"};
                      font-size:11px">
            <span style="color:#AAA;min-width:16px">${i+1}.</span>
            <span style="color:${color};font-weight:bold;min-width:14px">${icon}</span>
            <span style="flex:1">${d.label}</span>
            <span style="color:#AAA;font-size:9px;background:white;
                         padding:1px 5px;border-radius:8px;
                         border:1px solid #E0DBD4">
              ${d.loom?d.loom.replace(/_/g," "):""}
            </span>
            <span style="font-weight:bold;color:${color};
                         min-width:42px;text-align:right">${d.voltage}V</span>
          </div>`;
      }).join("")
    : `<div style="font-size:11px;color:#AAA;padding:6px 0">
         ${ACTIVE_LOOM?"No upstream nodes in this harness"
           :"No upstream dependencies — source node"}
       </div>`;

  const faultCount = filteredDiag.filter(d=>d.status==="FAIL").length;
  const lowCount   = filteredDiag.filter(d=>d.status==="LOW").length;
  let narrative    = "";
  if(healthKey==="failed"||healthKey==="warn"){
    if(faultCount>0){
      const ff = filteredDiag.find(d=>d.status==="FAIL");
      narrative=`<div style="margin-top:8px;padding:7px 10px;background:#FFF0F0;
        border-left:3px solid #B00020;border-radius:0 4px 4px 0;
        font-size:11px;color:#555;line-height:1.6">
        <b style="color:#B00020">⚠ Fault detected upstream</b><br>
        First failure: <b>${ff?.label}</b> at ${ff?.voltage}V.<br>
        Check nodes in order — fix first failure and re-run Step.
      </div>`;
    } else if(lowCount>0){
      narrative=`<div style="margin-top:8px;padding:7px 10px;background:#FFFBF0;
        border-left:3px solid #E09B2D;border-radius:0 4px 4px 0;
        font-size:11px;color:#555;line-height:1.6">
        <b style="color:#E09B2D">⚠ Low voltage upstream</b><br>
        ${lowCount} node${lowCount>1?"s":""} below 12V. Check charging system.
      </div>`;
    }
  }

  document.getElementById("analysisPanel").innerHTML = `
    <h3 style="margin:0 0 8px;color:#C4622D;font-size:13px">
      ${node?.label||id}
    </h3>
    <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
      <span style="font-size:10px;padding:2px 8px;border-radius:10px;
                   background:${healthColor};color:white;font-weight:bold">
        ${healthKey.toUpperCase()} ${v}V
      </span>
      <span style="font-size:10px;padding:2px 8px;border-radius:10px;
                   background:${statusColors[statusKey]};color:white">
        ${statusKey.toUpperCase()}
      </span>
      ${node?.tier===2?`<span style="font-size:10px;padding:2px 8px;
        border-radius:10px;background:#F4F1EC;color:#888;
        border:1px solid #D8D2C8">TIER 2</span>`:""}
    </div>
    <div style="margin-bottom:8px;padding:6px 8px;background:#F4F1EC;
                border-radius:6px;font-size:11px">
      <span style="color:#AAA;font-size:10px;text-transform:uppercase;
                   letter-spacing:0.5px">Part Number</span><br>
      <span style="font-weight:bold">${node?.partNumber||"—"}</span>
    </div>
    ${node?.notes?`<div style="margin-bottom:10px;padding:6px 8px;
      background:#FFF8F0;border-left:3px solid #C4622D;
      border-radius:0 4px 4px 0;font-size:11px;color:#555;line-height:1.5">
      ${node.notes}</div>`:""}
    <div style="margin-bottom:6px;display:flex;justify-content:space-between;
                align-items:center">
      <span style="font-size:10px;font-weight:bold;color:#AAA;letter-spacing:1px">
        UPSTREAM DIAGNOSTIC CHAIN
      </span>
      <button onclick="switchTab('manage',null);setTimeout(()=>scrollToNode('${id}'),200)"
        style="font-size:9px;padding:2px 8px;background:#F4F1EC;
               color:#555;border:1px solid #D8D2C8">
        Edit in Manage →
      </button>
    </div>
    ${diagHTML}
    ${narrative}
  `;
};

window.selectRoute = function(id){
  const route = buildRoutes().find(r=>r.id===id);
  if(!route) return;
  const spec  = generateWiringSpec().find(s=>s.id===id);
  if(!spec){
    document.getElementById("analysisPanel").innerHTML=`<b>No data for ${id}</b>`;
    return;
  }
  document.getElementById("analysisPanel").innerHTML=`
    <h3 style="margin:0 0 8px;color:#C4622D;font-size:13px">Route Detail</h3>
    <table style="width:100%;font-size:11px;border-collapse:collapse">
      <tr><td style="color:#AAA;padding:3px 6px;width:110px">Circuit</td>
          <td style="padding:3px 6px"><b>${route.from} → ${route.to}</b></td></tr>
      <tr><td style="color:#AAA;padding:3px 6px">Loom</td>
          <td style="padding:3px 6px">${(route.loom||"—").replace(/_/g," ")}</td></tr>
      <tr><td style="color:#AAA;padding:3px 6px">Type</td>
          <td style="padding:3px 6px">${route.type}</td></tr>
      <tr><td style="color:#AAA;padding:3px 6px">Base Load</td>
          <td style="padding:3px 6px">${spec.current} A</td></tr>
      <tr><td style="color:#AAA;padding:3px 6px">Design Load</td>
          <td style="padding:3px 6px">${spec.adjustedCurrent.toFixed(1)} A</td></tr>
      <tr><td style="color:#AAA;padding:3px 6px">Wire</td>
          <td style="padding:3px 6px">${spec.wire} TXL</td></tr>
      <tr><td style="color:#AAA;padding:3px 6px">Fuse</td>
          <td style="padding:3px 6px">${spec.fuse}</td></tr>
      <tr><td style="color:#AAA;padding:3px 6px">V Drop</td>
          <td style="padding:3px 6px">${spec.drop} V</td></tr>
      <tr><td colspan="2" style="padding:6px 6px 2px">
        ${spec.warnings.length
          ?`<span style="color:#B00020">⚠ ${spec.warnings.join(", ")}</span>`
          :`<span style="color:#3E6B48">✓ OK</span>`}
      </td></tr>
    </table>`;
};

// -----------------------------
// Controls
// -----------------------------
function renderControls(){
  document.getElementById("controlsPanel").innerHTML=`
    <div style="display:flex;flex-wrap:wrap;gap:4px">
      <button onclick="step()" title="Run one simulation step and record to history">
        ▶ Step
      </button>
      <button onclick="runOptimization()">⚡ Optimize</button>
      <button onclick="forceFailure()"
        style="background:#B00020"
        title="Drop battery to 9V and trigger cascade failure">
        ⚠ Battery Low
      </button>
      <button onclick="resetSim()"
        style="background:#555"
        title="Restore all nodes to 12V and clear history">
        ↺ Reset
      </button>
    </div>`;
}

function forceFailure(){
  if(STATE.playbackFrame !== null && STATE.playbackFrame !== undefined){
    stopPlaybackTimer();
    STATE.playbackFrame = null;
  }
  STATE.nodes.battery.effectiveVoltage = 9;
  STATE.nodes.battery.failed = true;
  propagateFailures();
  detectFailures();
  recordHistory();
  renderAll();
  renderPlaybackControls();
}

function resetSim(){
  stopPlaybackTimer();
  STATE.playbackFrame = null;
  STATE.history = [];
  Object.values(STATE.nodes).forEach(n=>{
    n.effectiveVoltage = 12;
    n.inputVoltage     = 0;
    n.failed           = false;
  });
  renderAll();
  renderPlaybackControls();
}

// -----------------------------
// System status panel (Tab 1)
// -----------------------------
function renderGraph(){
  const nodes  = Object.values(STATE.nodes);
  const total  = nodes.length;
  const failed = nodes.filter(n=>n.failed).length;
  const avgV   = (nodes.reduce((s,n)=>s+(n.effectiveVoltage||12),0)/total).toFixed(2);
  const statusCounts={planned:0,ordered:0,installed:0,tested:0};
  nodes.forEach(n=>{
    const s=STATE.status?.[n.id]?.status||"planned";
    if(statusCounts[s]!==undefined) statusCounts[s]++;
  });
  const done=statusCounts.installed+statusCounts.tested;
  const pct=Math.round((done/total)*100);

  const chips = [
    { label:"Nodes",    val:total,          color:"#2E2A26" },
    { label:"Failures", val:failed,         color:failed>0?"#B00020":"#3E6B48" },
    { label:"Avg V",    val:avgV+"V",       color:"#2E2A26" },
    { label:"Done",     val:done+"/"+total, color:"#C4622D" },
    { label:"Progress", val:pct+"%",        color:"#3E6B48" }
  ].map(c=>`
    <div style="background:#F4F1EC;border-radius:6px;padding:6px 10px;
                text-align:center;flex:1">
      <div style="font-size:16px;font-weight:bold;color:${c.color}">${c.val}</div>
      <div style="font-size:9px;color:#AAA;text-transform:uppercase;
                  letter-spacing:0.5px">${c.label}</div>
    </div>`).join("");

  const progressBar=`
    <div style="margin:8px 0 4px">
      <div style="display:flex;justify-content:space-between;
                  font-size:10px;color:#888;margin-bottom:3px">
        <span>Build Progress</span><span>${done}/${total} — ${pct}%</span>
      </div>
      <div style="background:#F0EDE8;border-radius:4px;height:8px">
        <div style="background:linear-gradient(90deg,#C4622D,#E09B2D);
                    width:${pct}%;height:8px;border-radius:4px;
                    transition:width 0.4s"></div>
      </div>
    </div>`;

  const sColors2={planned:"#AAA",ordered:"#2D6C8C",
                  installed:"#C4622D",tested:"#3E6B48"};
  const breakdown=Object.entries(statusCounts).map(([s,count])=>`
    <div style="display:flex;align-items:center;gap:6px;font-size:11px;
                padding:2px 0">
      <span style="width:8px;height:8px;border-radius:50%;
                   background:${sColors2[s]};display:inline-block"></span>
      <span style="flex:1;color:#555">${s.charAt(0).toUpperCase()+s.slice(1)}</span>
      <span style="font-weight:bold;color:#2E2A26">${count}</span>
    </div>`).join("");

  const faultNodes = nodes.filter(n=>n.failed);
  const faultHTML = faultNodes.length ? `
    <hr style="border:none;border-top:1px solid #D8D2C8;margin:8px 0 6px">
    <div style="font-size:10px;font-weight:bold;color:#B00020;
                letter-spacing:1px;margin-bottom:4px">ACTIVE FAULTS</div>
    ${faultNodes.map(n=>`
      <div style="display:flex;align-items:center;gap:6px;
                  padding:3px 6px;margin:2px 0;border-radius:4px;
                  background:#FFF0F0;border-left:3px solid #B00020;
                  font-size:11px;cursor:pointer"
           onclick="handleNodeClick('${n.id}')">
        <span style="flex:1;color:#B00020">${n.label||n.id}</span>
        <span style="color:#B00020;font-size:10px">
          ${(n.effectiveVoltage||0).toFixed(1)}V ✕
        </span>
      </div>`).join("")}` : "";

  const manageLink=`
    <div style="margin-top:8px;text-align:right">
      <button onclick="switchTab('manage',null)"
        style="background:#F4F1EC;color:#555;border:1px solid #D8D2C8;
               font-size:10px;padding:3px 10px">
        Full Status & BOM →
      </button>
    </div>`;

  document.getElementById("graphPanel").innerHTML=`
    <h3 style="margin:0 0 8px;color:#C4622D">System Status</h3>
    <div style="display:flex;gap:6px;margin-bottom:8px">${chips}</div>
    ${progressBar}
    <hr style="border:none;border-top:1px solid #D8D2C8;margin:8px 0 6px">
    <div style="font-size:10px;font-weight:bold;color:#AAA;
                letter-spacing:1px;margin-bottom:4px">BUILD STATUS</div>
    ${breakdown}
    ${faultHTML}
    ${manageLink}`;
}

// ==============================
// TAB 2 — BUILD MANAGEMENT
// ==============================

let EDITOR_MODE  = "edit"; // "edit" | "add"
let EDITOR_NODE  = null;
let EDITOR_DRAFT = null;   // working copy of the node being added/edited,
                           // including its connectors[] groups + pins.
                           // Nothing touches STATE until Save is clicked.

function freshDraft(){
  return {
    id: "", zone: "A", tier: 1, type: "accessory",
    label: "", partNumber: "", load: 0, notes: "",
    status: "planned", connectors: []
  };
}

// -------------------------------------------------------
// PHASE 2 — Hardened deleteNode
// Shows exactly what will be removed before confirming,
// then auto-cleans all orphaned edges
// -------------------------------------------------------
window.deleteNode = function(id){
  const node = STATE.nodes[id];
  if(!node) return;

  // Find all edges that will be orphaned
  const affectedEdges = EDGES.filter(e => e.from === id || e.to === id);

  // Build a human-readable summary for the confirm dialog
  const edgeSummary = affectedEdges.length
    ? affectedEdges.map(e=>`  • ${e.from} → ${e.to} [${e.loom||e.type}]`).join("\n")
    : "  (none)";

  const message =
    `Delete "${node.label||id}"?\n\n` +
    `This will also remove ${affectedEdges.length} connected edge(s):\n` +
    `${edgeSummary}\n\n` +
    `This cannot be undone.`;

  if(!confirm(message)) return;

  // Remove node
  delete STATE.nodes[id];
  delete STATE.status[id];

  // Remove all orphaned edges
  EDGES = EDGES.filter(e => e.from !== id && e.to !== id);

  EDITOR_NODE  = null;
  EDITOR_DRAFT = null;
  renderAll();
  renderComponentEditor();
  renderEdgeEditor();
  renderStatusEditor();
};

// -------------------------------------------------------
// PHASE 5 — Component Editor (draft-backed)
// -------------------------------------------------------
function renderComponentEditor(){
  const nodes = Object.values(STATE.nodes);
  const zones = ["A","B","C","D","E"];
  const tiers = [1,2];
  const types = ["source","motor","control","sensor","display","relay",
                 "distribution","ignition","fuel","lighting","accessory","connector"];
  const looms = [...new Set(EDGES.map(e=>e.loom).filter(Boolean))];

  const nodeOptions = nodes.map(n=>
    `<option value="${n.id}" ${EDITOR_NODE===n.id?"selected":""}>
      ${n.label||n.id} (Zone ${n.zone})
    </option>`
  ).join("");

  const draft = EDITOR_DRAFT;
  const sel   = (EDITOR_MODE === "edit") ? STATE.nodes[EDITOR_NODE] : null;

  // Keep visually-defaulted selects (loom/type) in sync with the draft so
  // Save never disagrees with what's on screen even if the user never
  // touched those particular controls.
  if(draft){
    if(!draft._edgeLoom) draft._edgeLoom = looms[0] || "cab_harness";
    if(!draft._edgeType) draft._edgeType = "POWER";
  }

  // For edit mode, show connected edges as a mini-summary
  const connectedEdges = sel
    ? EDGES.filter(e=>e.from===sel.id||e.to===sel.id)
    : [];
  const edgeSummaryHTML = sel && connectedEdges.length ? `
    <div style="margin:8px 0;padding:6px 8px;background:#F4F1EC;
                border-radius:6px;font-size:10px">
      <span style="color:#AAA;text-transform:uppercase;letter-spacing:0.5px">
        Connected edges (${connectedEdges.length})
      </span>
      ${connectedEdges.map(e=>`
        <div style="margin-top:3px;color:#555">
          ${e.from===sel.id?`→ <b>${e.to}</b>`:`← <b>${e.from}</b>`}
          <span style="color:#AAA;margin-left:4px">${e.loom||e.type}</span>
        </div>`).join("")}
      <div style="margin-top:4px;font-size:9px;color:#AAA">
        Use Edge Editor to add or remove connections
      </div>
    </div>` : "";

  // "From" choices for the inline edge-creation block exclude the node
  // currently being edited (no self-loops from this shortcut)
  const fromNodeChoices = nodes.filter(n => n.id !== EDITOR_NODE);

  const connectHTML = draft ? `
    <div style="margin-top:10px;border-top:1px solid #D8D2C8;padding-top:8px">
      <div style="font-size:10px;font-weight:bold;color:#2D6C8C;
                  letter-spacing:0.5px;text-transform:uppercase;margin-bottom:6px">
        🔗 Connect To Another Node (optional)
      </div>
      <div class="form-row">
        <div>
          <label>From Node</label>
          <select id="ef_from" onchange="updateAddEdgeFrom(this.value)">
            <option value="">— none / wire up later in Edge Editor —</option>
            ${fromNodeChoices.map(n=>`<option value="${n.id}"
              ${draft._edgeFrom===n.id?"selected":""}>${n.label||n.id}</option>`).join("")}
          </select>
        </div>
        <div>
          <label>Loom</label>
          <select id="ef_loom" onchange="updateDraftField('_edgeLoom', this.value)">
            ${looms.map(l=>`<option value="${l}"
              ${draft._edgeLoom===l?"selected":""}>${l.replace(/_/g," ")}</option>`).join("")}
            ${!looms.includes("cab_harness")?`<option value="cab_harness"
              ${draft._edgeLoom==="cab_harness"?"selected":""}>cab harness</option>`:""}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div>
          <label>Edge Type</label>
          <select id="ef_edge_type"
            onchange="updateDraftField('_edgeType', this.value); suggestAddEdgeColor(this.value)">
            ${PIN_TYPES.map(t=>`<option value="${t}"
              ${draft._edgeType===t?"selected":""}>${t}</option>`).join("")}
          </select>
        </div>
        <div>
          <label>Wire Color</label>
          <select id="ef_edge_color" onchange="updateDraftField('_edgeColor', this.value)">
            <option value="">— unspecified —</option>
            ${WIRE_COLOR_OPTIONS.map(([code,name])=>`<option value="${code}"
              ${draft._edgeColor===code?"selected":""}>${code} — ${name}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div>
          <label>From Pin ${draft._edgeFrom?`(on ${STATE.nodes[draft._edgeFrom]?.label||draft._edgeFrom})`:""}</label>
          ${renderPinField("ef_from_pin", STATE.nodes[draft._edgeFrom]?.connectors,
              draft._edgeFromConnector, draft._edgeFromPin,
              "syncAddEdgeFromPinSelect", "syncAddEdgeFromPinManual")}
        </div>
        <div>
          <label>To Pin (on this component)</label>
          ${renderPinField("ef_to_pin", draft.connectors,
              draft._edgeToConnector, draft._edgeToPin,
              "syncAddEdgeToPinSelect", "syncAddEdgeToPinManual")}
        </div>
      </div>
      <div style="font-size:9px;color:#AAA;margin-top:2px">
        To Pin options come from the Connector Groups above — add a group
        and its pins first if you want to pick a specific one here,
        otherwise enter it manually. Leave "From Node" blank to skip
        creating an edge — you can always wire it up later in the Edge Editor.
      </div>
    </div>` : "";

  document.getElementById("componentEditorPanel").innerHTML=`
    <div style="display:flex;justify-content:space-between;
                align-items:center;margin-bottom:10px">
      <h3 style="margin:0;color:#C4622D;font-size:13px">Component Editor</h3>
      <div style="display:flex;gap:4px">
        <button onclick="setEditorMode('edit')"
          style="background:${EDITOR_MODE==="edit"?"#C4622D":"#F4F1EC"};
                 color:${EDITOR_MODE==="edit"?"white":"#555"};
                 border:1px solid #D8D2C8;font-size:10px;padding:3px 10px">
          Edit Existing
        </button>
        <button onclick="setEditorMode('add')"
          style="background:${EDITOR_MODE==="add"?"#3E6B48":"#F4F1EC"};
                 color:${EDITOR_MODE==="add"?"white":"#555"};
                 border:1px solid #D8D2C8;font-size:10px;padding:3px 10px">
          + Add New
        </button>
      </div>
    </div>

    ${EDITOR_MODE==="edit" ? `
    <div style="margin-bottom:12px">
      <label>Select Component</label>
      <select onchange="selectEditorNode(this.value)">
        <option value="">— choose a component —</option>
        ${nodeOptions}
      </select>
    </div>` : ""}

    ${draft ? `
    <div id="editorForm">

      ${EDITOR_MODE==="add" ? `
      <div class="form-row">
        <div>
          <label>Node ID (no spaces)</label>
          <input id="ef_id" type="text" placeholder="e.g. horn_relay"
            value="${draft.id||""}"
            oninput="updateDraftField('id', this.value)">
        </div>
        <div>
          <label>Zone</label>
          <select id="ef_zone" onchange="updateDraftField('zone', this.value)">
            ${zones.map(z=>`<option value="${z}" ${draft.zone===z?"selected":""}>Zone ${z}${
              z==="A"?" — Engine Bay":z==="B"?" — Cab":
              z==="C"?" — Trans Mid":z==="D"?" — Trans Rear":
              z==="E"?" — Rear Node":""}</option>`).join("")}
          </select>
        </div>
      </div>` : ""}

      <div class="form-row">
        <div>
          <label>Label / Display Name</label>
          <input id="ef_label" type="text" value="${draft.label||""}"
            placeholder="e.g. Horn Relay"
            oninput="updateDraftField('label', this.value)">
        </div>
        <div>
          <label>Part Number</label>
          <input id="ef_part" type="text" value="${draft.partNumber||""}"
            placeholder="e.g. Bosch 0332"
            oninput="updateDraftField('partNumber', this.value)">
        </div>
      </div>

      <div class="form-row-3">
        <div>
          <label>Type</label>
          <select id="ef_type" onchange="updateDraftField('type', this.value)">
            ${types.map(t=>`<option value="${t}"
              ${draft.type===t?"selected":""}>${t}</option>`).join("")}
          </select>
        </div>
        <div>
          <label>Tier</label>
          <select id="ef_tier" onchange="updateDraftField('tier', parseInt(this.value))">
            ${tiers.map(t=>`<option value="${t}"
              ${draft.tier===t?"selected":""}>${t===1?"1 — Core":"2 — Accessory"}</option>`).join("")}
          </select>
        </div>
        <div>
          <label>Load (amps)</label>
          <input id="ef_load" type="number" min="0" step="0.1"
            value="${draft.load||0}" placeholder="0"
            oninput="updateDraftField('load', parseFloat(this.value)||0)">
        </div>
      </div>

      <!-- Connector Groups Editor -->
      <div style="margin-top:10px;border-top:1px solid #D8D2C8;padding-top:8px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:10px;font-weight:bold;color:#2D6C8C;
                       letter-spacing:0.5px;text-transform:uppercase">
            🔌 Connector Groups (${draft.connectors.length})
          </span>
          <button onclick="addConnectorGroup()"
            style="font-size:9px;padding:2px 8px;background:#3E6B48;color:white;border:none;border-radius:3px">
            + Add Group
          </button>
        </div>
        ${draft.connectors.length === 0 ? `
          <div style="font-size:10px;color:#AAA;padding:8px 0">
            No connector groups defined yet. Click "+ Add Group" to document
            a physical connector (e.g. J1A, ES_PWR) and its pins.
          </div>` : draft.connectors.map((grp,gi)=>renderConnectorGroup(grp,gi)).join("")}
      </div>

      ${connectHTML}

      <div style="margin-top:10px">
        <label>Build Status</label>
        <select id="ef_status" onchange="updateDraftField('status', this.value)">
          ${["planned","ordered","installed","tested"].map(s=>
            `<option value="${s}"
              ${draft.status===s?"selected":""}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
          ).join("")}
        </select>
      </div>

      <div>
        <label>Notes</label>
        <textarea id="ef_notes" rows="3"
          placeholder="Part notes, install tips, cross-references..."
          oninput="updateDraftField('notes', this.value)">${draft.notes||""}</textarea>
      </div>

      ${edgeSummaryHTML}

      <div style="display:flex;gap:6px;margin-top:10px">
        <button onclick="saveEditorForm()"
          style="background:#3E6B48;flex:1">
          ${EDITOR_MODE==="add"?"＋ Add Component":"✓ Save Changes"}
        </button>
        ${EDITOR_MODE==="edit" && sel ? `
        <button onclick="deleteNode('${EDITOR_NODE}')"
          style="background:#B00020;padding:6px 14px"
          title="Delete component and all connected edges">
          ✕ Delete
        </button>` : ""}
      </div>

    </div>` : `
    <div style="text-align:center;padding:40px 20px;color:#AAA;font-size:12px">
      Select a component above to edit its details
    </div>`}

    <div id="editorMsg" style="margin-top:8px;font-size:11px"></div>
  `;
}

// -----------------------------
// Connector group rendering
// -----------------------------
function renderConnectorGroup(grp, gi){
  const bodyOptions = Object.keys(CONNECTOR_LIBRARY||{});
  const pins = grp.pins || [];
  return `
    <div style="margin:8px 0;padding:8px;background:#FAFAF8;
                border:1px solid #E0DBD4;border-radius:6px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:10px;font-weight:bold;color:#C4622D">
          Group ${gi+1}${grp.designator?` — ${grp.designator}`:""}
        </span>
        <button onclick="removeConnectorGroup(${gi})"
          style="font-size:9px;padding:1px 6px;background:#B00020;color:white;border:none;border-radius:3px">
          ✕ Remove Group
        </button>
      </div>

      <div class="form-row-3">
        <div>
          <label style="font-size:9px">Designator</label>
          <input type="text" value="${grp.designator||""}" placeholder="e.g. J1A"
            oninput="updateConnectorGroupField(${gi},'designator',this.value)">
        </div>
        <div>
          <label style="font-size:9px">Body</label>
          <input type="text" list="connectorBodyOptions_${gi}" value="${grp.body||""}"
            placeholder="e.g. Deutsch DT 4-way"
            oninput="updateConnectorGroupField(${gi},'body',this.value)">
          <datalist id="connectorBodyOptions_${gi}">
            ${bodyOptions.map(b=>`<option value="${b}">`).join("")}
          </datalist>
        </div>
        <div>
          <label style="font-size:9px">Gender</label>
          <select onchange="updateConnectorGroupField(${gi},'gender',this.value)">
            ${["male","female","n/a"].map(g=>`<option value="${g}"
              ${grp.gender===g?"selected":""}>${g}</option>`).join("")}
          </select>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:8px;margin:6px 0 4px">
        <label style="font-size:9px;margin:0">Pin Count</label>
        <input type="number" min="0" step="1" value="${grp.pinCount||0}"
          style="width:60px"
          oninput="updateConnectorGroupField(${gi},'pinCount',parseInt(this.value)||0)">
        <span style="font-size:9px;color:#AAA">
          (${pins.length} pin${pins.length===1?"":"s"} documented below)
        </span>
        <button onclick="addConnectorPin(${gi})"
          style="margin-left:auto;font-size:9px;padding:2px 8px;background:#2D6C8C;color:white;border:none;border-radius:3px">
          + Add Pin
        </button>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:10px">
        <thead>
          <tr style="color:#AAA">
            <th style="text-align:left;padding:2px 4px;width:50px">Pin#</th>
            <th style="text-align:left;padding:2px 4px">Label</th>
            <th style="text-align:left;padding:2px 4px;width:90px">Type</th>
            <th style="width:24px"></th>
          </tr>
        </thead>
        <tbody>
          ${pins.map((p,pi)=>`
            <tr>
              <td style="padding:2px 4px">
                <input type="number" min="1" step="1" value="${p.pin}"
                  style="width:46px"
                  onchange="updateConnectorPinField(${gi},${pi},'pin',parseInt(this.value)||0,true)">
              </td>
              <td style="padding:2px 4px">
                <input type="text" value="${p.label||""}" placeholder="e.g. TACH"
                  style="width:100%"
                  oninput="updateConnectorPinField(${gi},${pi},'label',this.value,false)">
              </td>
              <td style="padding:2px 4px">
                <select onchange="updateConnectorPinField(${gi},${pi},'type',this.value,true)">
                  ${PIN_TYPES.map(t=>`<option value="${t}"
                    ${p.type===t?"selected":""}>${t}</option>`).join("")}
                </select>
              </td>
              <td style="padding:2px 4px;text-align:center">
                <button onclick="removeConnectorPin(${gi},${pi})"
                  style="font-size:9px;padding:0 5px;background:#F4F1EC;color:#B00020;border:1px solid #D8D2C8">
                  ✕
                </button>
              </td>
            </tr>`).join("")}
        </tbody>
      </table>
      ${pins.length===0?`<div style="font-size:9px;color:#AAA;padding:4px 0">No pins yet</div>`:""}
    </div>
  `;
}

// -----------------------------
// Connector group / pin CRUD —
// all operate on EDITOR_DRAFT.connectors
// -----------------------------
window.addConnectorGroup = function(){
  if(!EDITOR_DRAFT) return;
  EDITOR_DRAFT.connectors.push({ designator:"", body:"", gender:"female", pinCount:0, pins:[] });
  renderComponentEditor();
};

window.removeConnectorGroup = function(gi){
  if(!EDITOR_DRAFT) return;
  const grp = EDITOR_DRAFT.connectors[gi];
  if(!confirm(`Remove connector group "${grp.designator||"(unnamed)"}" and its ${(grp.pins||[]).length} pin(s)?`)) return;
  EDITOR_DRAFT.connectors.splice(gi,1);
  renderComponentEditor();
};

window.updateConnectorGroupField = function(gi, field, value){
  if(!EDITOR_DRAFT) return;
  EDITOR_DRAFT.connectors[gi][field] = value;
  // text/number/select fields here don't affect any other part of the
  // form, so no re-render needed — keeps typing smooth
};

window.addConnectorPin = function(gi){
  if(!EDITOR_DRAFT) return;
  const grp = EDITOR_DRAFT.connectors[gi];
  grp.pins = grp.pins || [];
  const nextPin = grp.pins.length
    ? Math.max(...grp.pins.map(p=>p.pin)) + 1
    : 1;
  grp.pins.push({ pin: nextPin, label:"", type:"SIGNAL" });
  grp.pinCount = Math.max(grp.pinCount||0, grp.pins.length);
  renderComponentEditor();
};

window.removeConnectorPin = function(gi, pi){
  if(!EDITOR_DRAFT) return;
  EDITOR_DRAFT.connectors[gi].pins.splice(pi,1);
  renderComponentEditor();
};

window.updateConnectorPinField = function(gi, pi, field, value, rerender){
  if(!EDITOR_DRAFT) return;
  EDITOR_DRAFT.connectors[gi].pins[pi][field] = value;
  // Pin number / type changes affect the From/To pin pickers elsewhere
  // in the form, so refresh; label is free-typed and left alone to avoid
  // disrupting the cursor on every keystroke.
  if(rerender) renderComponentEditor();
};

// -----------------------------
// Generic draft field updater —
// used for plain text/number/select
// inputs that don't need a re-render
// -----------------------------
window.updateDraftField = function(field, value){
  if(!EDITOR_DRAFT) return;
  EDITOR_DRAFT[field] = value;
};

// -----------------------------
// Inline edge-creation helpers
// (Component Editor "Connect To
// Another Node" block)
// -----------------------------
window.updateAddEdgeFrom = function(value){
  if(!EDITOR_DRAFT) return;
  EDITOR_DRAFT._edgeFrom            = value || undefined;
  EDITOR_DRAFT._edgeFromConnector   = undefined;
  EDITOR_DRAFT._edgeFromPin         = undefined;
  renderComponentEditor(); // From Pin options depend on the chosen node
};

window.suggestAddEdgeColor = function(type){
  if(!EDITOR_DRAFT || EDITOR_DRAFT._edgeColor) return; // don't override a choice
  const allowed = (COLOR_RULES||{})[type];
  if(allowed && allowed.length){
    EDITOR_DRAFT._edgeColor = allowed[0];
    const colorSel = document.getElementById("ef_edge_color");
    if(colorSel) colorSel.value = allowed[0];
  }
};

window.syncAddEdgeFromPinSelect = function(value){
  if(!EDITOR_DRAFT) return;
  if(value === "__manual__" || value === ""){
    EDITOR_DRAFT._edgeFromConnector = undefined;
    if(value === "") EDITOR_DRAFT._edgeFromPin = undefined;
    return;
  }
  const [d,p] = value.split("::");
  EDITOR_DRAFT._edgeFromConnector = d;
  EDITOR_DRAFT._edgeFromPin = parseInt(p);
};
window.syncAddEdgeFromPinManual = function(value){
  if(!EDITOR_DRAFT) return;
  EDITOR_DRAFT._edgeFromConnector = undefined;
  EDITOR_DRAFT._edgeFromPin = value ? parseInt(value) : undefined;
};
window.syncAddEdgeToPinSelect = function(value){
  if(!EDITOR_DRAFT) return;
  if(value === "__manual__" || value === ""){
    EDITOR_DRAFT._edgeToConnector = undefined;
    if(value === "") EDITOR_DRAFT._edgeToPin = undefined;
    return;
  }
  const [d,p] = value.split("::");
  EDITOR_DRAFT._edgeToConnector = d;
  EDITOR_DRAFT._edgeToPin = parseInt(p);
};
window.syncAddEdgeToPinManual = function(value){
  if(!EDITOR_DRAFT) return;
  EDITOR_DRAFT._edgeToConnector = undefined;
  EDITOR_DRAFT._edgeToPin = value ? parseInt(value) : undefined;
};

// -----------------------------
// Mode / selection handlers
// -----------------------------
window.setEditorMode = function(mode){
  EDITOR_MODE  = mode;
  EDITOR_NODE  = null;
  EDITOR_DRAFT = (mode === "add") ? freshDraft() : null;
  renderComponentEditor();
};

window.selectEditorNode = function(id){
  EDITOR_NODE = id || null;
  if(id && STATE.nodes[id]){
    const n = STATE.nodes[id];
    EDITOR_DRAFT = cloneDeep({
      id: n.id, zone: n.zone, tier: n.tier, type: n.type,
      label: n.label, partNumber: n.partNumber, load: n.load,
      notes: n.notes, connectors: n.connectors || []
    });
    EDITOR_DRAFT.status = STATE.status?.[id]?.status || "planned";
  } else {
    EDITOR_DRAFT = null;
  }
  renderComponentEditor();
};

window.scrollToNode = function(id){
  EDITOR_MODE = "edit";
  selectEditorNode(id);
  renderStatusEditor();
};

// -----------------------------
// Save — commits EDITOR_DRAFT to
// STATE, including connectors[],
// and creates the optional edge
// (now type/color/pin aware
// instead of a hardcoded POWER
// stub)
// -----------------------------
function commitOptionalEdge(toId, zoneForEdge){
  if(!EDITOR_DRAFT || !EDITOR_DRAFT._edgeFrom) return;
  const edge = {
    from: EDITOR_DRAFT._edgeFrom,
    to: toId,
    type: EDITOR_DRAFT._edgeType || "POWER",
    zone: zoneForEdge,
    loom: EDITOR_DRAFT._edgeLoom || "cab_harness",
    resistance: 0.03
  };
  if(EDITOR_DRAFT._edgeColor)          edge.color         = EDITOR_DRAFT._edgeColor;
  if(EDITOR_DRAFT._edgeFromConnector)  edge.fromConnector = EDITOR_DRAFT._edgeFromConnector;
  if(EDITOR_DRAFT._edgeFromPin)        edge.fromPin       = EDITOR_DRAFT._edgeFromPin;
  if(EDITOR_DRAFT._edgeToConnector)    edge.toConnector   = EDITOR_DRAFT._edgeToConnector;
  if(EDITOR_DRAFT._edgeToPin)          edge.toPin         = EDITOR_DRAFT._edgeToPin;
  EDGES.push(edge);

  // clear transient edge-creation fields so a second Save doesn't duplicate it
  EDITOR_DRAFT._edgeFrom          = undefined;
  EDITOR_DRAFT._edgeFromConnector = undefined;
  EDITOR_DRAFT._edgeFromPin       = undefined;
  EDITOR_DRAFT._edgeToConnector   = undefined;
  EDITOR_DRAFT._edgeToPin         = undefined;
}

window.saveEditorForm = function(){
  const msg = document.getElementById("editorMsg");
  if(!EDITOR_DRAFT){
    if(msg) msg.innerHTML = `<span style="color:#B00020">Nothing to save</span>`;
    return;
  }

  for(const grp of EDITOR_DRAFT.connectors){
    if(!grp.designator){
      msg.innerHTML = `<span style="color:#B00020">Every connector group needs a designator (e.g. J1A)</span>`;
      return;
    }
  }

  let successMsg = "";

  if(EDITOR_MODE === "add"){
    const id = (EDITOR_DRAFT.id||"").trim().replace(/\s+/g,"_");
    if(!id){
      msg.innerHTML = `<span style="color:#B00020">Node ID is required</span>`;
      return;
    }
    if(STATE.nodes[id]){
      msg.innerHTML = `<span style="color:#B00020">ID already exists — choose a unique ID</span>`;
      return;
    }

    STATE.nodes[id] = {
      id,
      zone: EDITOR_DRAFT.zone,
      tier: EDITOR_DRAFT.tier,
      type: EDITOR_DRAFT.type,
      label: (EDITOR_DRAFT.label||"").trim() || id,
      partNumber: (EDITOR_DRAFT.partNumber||"").trim() || "—",
      load: EDITOR_DRAFT.load || 0,
      notes: (EDITOR_DRAFT.notes||"").trim(),
      connectors: cloneDeep(EDITOR_DRAFT.connectors || []),
      effectiveVoltage: 12, inputVoltage: 0, failed: false
    };
    STATE.status[id] = { status: EDITOR_DRAFT.status || "planned" };

    commitOptionalEdge(id, EDITOR_DRAFT.zone);

    EDITOR_NODE = id;
    EDITOR_MODE = "edit";
    successMsg = `✓ ${STATE.nodes[id].label} added`;

  } else if(EDITOR_NODE){
    const n = STATE.nodes[EDITOR_NODE];
    if(!n){
      msg.innerHTML = `<span style="color:#B00020">Node not found</span>`;
      return;
    }
    n.label       = (EDITOR_DRAFT.label||"").trim() || n.label;
    n.partNumber  = (EDITOR_DRAFT.partNumber||"").trim() || n.partNumber;
    n.type        = EDITOR_DRAFT.type;
    n.tier        = EDITOR_DRAFT.tier;
    n.load        = EDITOR_DRAFT.load;
    n.notes       = (EDITOR_DRAFT.notes||"").trim();
    n.connectors  = cloneDeep(EDITOR_DRAFT.connectors || []);

    if(!STATE.status[EDITOR_NODE]) STATE.status[EDITOR_NODE] = {};
    STATE.status[EDITOR_NODE].status = EDITOR_DRAFT.status || "planned";

    commitOptionalEdge(EDITOR_NODE, n.zone);

    successMsg = `✓ ${n.label} saved`;
  } else {
    if(msg) msg.innerHTML = `<span style="color:#B00020">Nothing selected to save</span>`;
    return;
  }

  // Refresh the draft from the now-committed state so the form reflects
  // exactly what was saved (and clears any stale transient edge fields)
  if(EDITOR_NODE) selectEditorNode(EDITOR_NODE);

  renderAll();
  renderStatusEditor();
  renderEdgeEditor();
  renderWiringSpec();

  const msgEl = document.getElementById("editorMsg");
  if(msgEl) msgEl.innerHTML = `<span style="color:#3E6B48">${successMsg}</span>`;
};

// -------------------------------------------------------
// UI helpers — collapsible sections and drain row toggle
// -------------------------------------------------------
window.toggleSection = function(id){
  const el     = document.getElementById(id);
  const toggle = document.getElementById(id + "Toggle");
  if(!el) return;
  const visible = el.style.display !== "none";
  el.style.display    = visible ? "none" : "block";
  if(toggle) toggle.textContent = visible ? "▶" : "▼";
};

window.toggleDrainRow = function(){
  const shieldCb = document.getElementById("ee_shield");
  const drainRow = document.getElementById("ee_drain_row");
  if(drainRow) drainRow.style.display = shieldCb?.checked ? "block" : "none";
};

// -------------------------------------------------------
// PHASE 4 — Edge Editor
// Full add / edit / delete for edges
// -------------------------------------------------------
let EDGE_EDITOR_MODE = "list"; // "list" | "add" | "edit"
let EDGE_EDITOR_IDX  = null;   // index into EDGES array

function renderEdgeEditor(){
  const panel = document.getElementById("edgeEditorPanel");
  if(!panel) return;

  const nodes    = Object.values(STATE.nodes);
  const nodeOpts = nodes.map(n=>
    `<option value="${n.id}">${n.label||n.id} (${n.zone})</option>`
  ).join("");

  const looms    = [...new Set(EDGES.map(e=>e.loom).filter(Boolean))];
  const loomOpts = looms.map(l=>
    `<option value="${l}">${l.replace(/_/g," ")}</option>`
  ).join("");

  const edgeTypes = ["POWER","SIGNAL","CAN","GROUND"];
  const zones     = ["A","B","C","D","E"];

  const sel = (EDGE_EDITOR_IDX !== null) ? EDGES[EDGE_EDITOR_IDX] : null;

  // --- List view
  const listHTML = `
    <div style="max-height:220px;overflow-y:auto;margin-bottom:8px">
      <table style="width:100%;border-collapse:collapse;font-size:10px">
        <thead>
          <tr style="background:#F4F1EC;position:sticky;top:0">
            <th style="padding:4px 6px;text-align:left;color:#888">From</th>
            <th style="padding:4px 6px;text-align:left;color:#888">To</th>
            <th style="padding:4px 6px;text-align:left;color:#888">Loom</th>
            <th style="padding:4px 6px;text-align:left;color:#888">Type</th>
            <th style="padding:4px 6px;width:60px"></th>
          </tr>
        </thead>
        <tbody>
          ${EDGES.map((e,i)=>{
            const fromNode = STATE.nodes[e.from];
            const toNode   = STATE.nodes[e.to];
            const orphaned = !fromNode || !toNode;
            return `
              <tr style="background:${orphaned?"#FFF0F0":i%2===0?"white":"#FAFAF8"};
                          border-bottom:1px solid #F0EDE8">
                <td style="padding:3px 6px;color:${!fromNode?"#B00020":"#2E2A26"}">
                  ${fromNode?.label||e.from}${!fromNode?' ⚠':''}
                </td>
                <td style="padding:3px 6px;color:${!toNode?"#B00020":"#2E2A26"}">
                  ${toNode?.label||e.to}${!toNode?' ⚠':''}
                </td>
                <td style="padding:3px 6px;color:#888">
                  ${(e.loom||"—").replace(/_/g," ")}
                </td>
                <td style="padding:3px 6px;color:#888">${e.type||"—"}</td>
                <td style="padding:3px 6px;display:flex;gap:3px">
                  <button onclick="editEdge(${i})"
                    style="font-size:9px;padding:1px 6px;background:#F4F1EC;
                           color:#555;border:1px solid #D8D2C8">
                    Edit
                  </button>
                  <button onclick="deleteEdge(${i})"
                    style="font-size:9px;padding:1px 6px;background:#B00020;
                           color:white;border:none">
                    ✕
                  </button>
                </td>
              </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>`;

  // Orphan warning
  const orphanedEdges = EDGES.filter(e=>!STATE.nodes[e.from]||!STATE.nodes[e.to]);
  const orphanWarning = orphanedEdges.length ? `
    <div style="margin-bottom:8px;padding:6px 10px;background:#FFF0F0;
                border-left:3px solid #B00020;border-radius:0 4px 4px 0;
                font-size:10px;color:#555">
      <b style="color:#B00020">⚠ ${orphanedEdges.length} orphaned edge(s)</b>
      — one or both nodes no longer exist.
      <button onclick="pruneOrphanedEdges()"
        style="margin-left:8px;font-size:9px;padding:1px 8px;
               background:#B00020;color:white;border:none;border-radius:3px">
        Remove All Orphans
      </button>
    </div>` : "";

  // --- Add / Edit form
  const formHTML = (EDGE_EDITOR_MODE === "add" || EDGE_EDITOR_MODE === "edit") ? `
    <div style="padding:10px;background:#F4F1EC;border-radius:6px;margin-bottom:8px">
      <div style="font-size:11px;font-weight:bold;color:#C4622D;margin-bottom:8px">
        ${EDGE_EDITOR_MODE==="add"?"Add New Edge":"Edit Edge"}
      </div>

      <div class="form-row">
        <div>
          <label>From Node</label>
          <select id="ee_from" onchange="refreshEdgePinField('from')">
            ${nodes.map(n=>`<option value="${n.id}"
              ${sel?.from===n.id?"selected":""}>${n.label||n.id}</option>`).join("")}
          </select>
        </div>
        <div>
          <label>To Node</label>
          <select id="ee_to" onchange="refreshEdgePinField('to')">
            ${nodes.map(n=>`<option value="${n.id}"
              ${sel?.to===n.id?"selected":""}>${n.label||n.id}</option>`).join("")}
          </select>
        </div>
      </div>

      <div class="form-row">
        <div>
          <label>Type</label>
          <select id="ee_type" onchange="updateEdgeTypeColorSuggestion(this.value)">
            ${edgeTypes.map(t=>`<option value="${t}"
              ${sel?.type===t?"selected":""}>${t}</option>`).join("")}
          </select>
        </div>
        <div>
          <label>Zone</label>
          <select id="ee_zone">
            ${zones.map(z=>`<option value="${z}"
              ${sel?.zone===z?"selected":""}>${z}</option>`).join("")}
          </select>
        </div>
      </div>

      <div class="form-row">
        <div>
          <label>Loom</label>
          <select id="ee_loom">
            ${loomOpts}
            <option value="__custom__">+ Custom loom name…</option>
          </select>
        </div>
        <div>
          <label>Resistance (Ω)</label>
          <input id="ee_resistance" type="number" min="0" step="0.001"
            value="${sel?.resistance||0.02}" placeholder="0.02">
        </div>
      </div>

      <div>
        <label>Wire Override (optional — e.g. "4/0 AWG")</label>
        <input id="ee_wire" type="text"
          value="${sel?.wireOverride||""}" placeholder="leave blank for auto-sizing">
      </div>

      <div id="ee_custom_loom_row" style="display:none;margin-top:6px">
        <label>Custom Loom Name</label>
        <input id="ee_custom_loom" type="text" placeholder="e.g. hvac_harness">
      </div>

      <!-- Wire Detail Section -->
      <div style="margin-top:10px;border-top:1px solid #D8D2C8;padding-top:8px">
        <div style="display:flex;align-items:center;justify-content:space-between;
                    margin-bottom:6px;cursor:pointer"
             onclick="toggleSection('wireDetail')">
          <span style="font-size:10px;font-weight:bold;color:#2D6C8C;
                       letter-spacing:0.5px;text-transform:uppercase">
            🔗 Wire Detail — WireViz
          </span>
          <span id="wireDetailToggle" style="font-size:10px;color:#AAA">▼</span>
        </div>
        <div id="wireDetail" style="display:${sel?.color?'block':'none'}">
          <div class="form-row">
            <div>
              <label>Wire Color (IEC 60757)</label>
              <select id="ee_color">
                <option value="">— unspecified —</option>
                ${[
                  ["BK","Black"],["BN","Brown"],["RD","Red"],["OG","Orange"],
                  ["YE","Yellow"],["GN","Green"],["BU","Blue"],["VT","Violet"],
                  ["GY","Grey"],["WH","White"],["PK","Pink"],["TQ","Turquoise"]
                ].map(([code,name])=>
                  `<option value="${code}" ${sel?.color===code?"selected":""}>${code} — ${name}</option>`
                ).join("")}
              </select>
            </div>
            <div>
              <label>Stripe Color (optional)</label>
              <select id="ee_color_stripe">
                <option value="">— none —</option>
                ${[
                  ["BK","Black"],["BN","Brown"],["RD","Red"],["OG","Orange"],
                  ["YE","Yellow"],["GN","Green"],["BU","Blue"],["VT","Violet"],
                  ["GY","Grey"],["WH","White"],["PK","Pink"],["TQ","Turquoise"]
                ].map(([code,name])=>
                  `<option value="${code}" ${sel?.colorStripe===code?"selected":""}>${code} — ${name}</option>`
                ).join("")}
              </select>
            </div>
          </div>
          <div class="form-row">
            <div>
              <label>From Pin</label>
              <div id="ee_from_pin_wrap">
                ${renderPinField("ee_from_pin", STATE.nodes[sel?.from]?.connectors, sel?.fromConnector, sel?.fromPin)}
              </div>
            </div>
            <div>
              <label>To Pin</label>
              <div id="ee_to_pin_wrap">
                ${renderPinField("ee_to_pin", STATE.nodes[sel?.to]?.connectors, sel?.toConnector, sel?.toPin)}
              </div>
            </div>
          </div>
          <div class="form-row">
            <div>
              <label>Length (inches)</label>
              <input id="ee_length" type="number" min="0" step="1"
                value="${sel?.length||""}" placeholder="e.g. 48">
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;justify-content:flex-end;padding-bottom:2px">
              <label style="display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer">
                <input type="checkbox" id="ee_twisted"
                  ${sel?.twisted?"checked":""} style="margin:0">
                Twisted Pair
              </label>
              <label style="display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer">
                <input type="checkbox" id="ee_shield"
                  ${sel?.shield?"checked":""} style="margin:0"
                  onchange="toggleDrainRow()">
                Shielded
              </label>
            </div>
          </div>
          <div id="ee_drain_row" style="display:${sel?.shield?'block':'none'}">
            <label>Shield Drain Ground End</label>
            <select id="ee_drain">
              <option value="">— unspecified —</option>
              <option value="source" ${sel?.drainGround==="source"?"selected":""}>Source end</option>
              <option value="dest"   ${sel?.drainGround==="dest"  ?"selected":""}>Destination end</option>
            </select>
          </div>
          <div style="font-size:9px;color:#AAA;margin-top:4px">
            These fields populate WireViz YAML export — leave blank for circuits not yet fully spec'd
          </div>
        </div>
      </div>

      <div style="margin-top:8px">
        <label>Notes</label>
        <textarea id="ee_notes" rows="2"
          placeholder="Install notes, cross-references...">${sel?.notes||""}</textarea>
      </div>

      <div style="display:flex;gap:6px;margin-top:10px">
        <button onclick="saveEdge()"
          style="background:#3E6B48;flex:1">
          ${EDGE_EDITOR_MODE==="add"?"＋ Add Edge":"✓ Save Edge"}
        </button>
        <button onclick="cancelEdgeEdit()"
          style="background:#888;padding:6px 14px">
          Cancel
        </button>
      </div>
      <div id="edgeMsg" style="margin-top:6px;font-size:11px"></div>
    </div>` : "";

  panel.innerHTML=`
    <div style="display:flex;justify-content:space-between;
                align-items:center;margin-bottom:8px">
      <h3 style="margin:0;color:#C4622D;font-size:13px">
        Edge Editor
        <span style="font-size:10px;font-weight:normal;color:#AAA;margin-left:6px">
          ${EDGES.length} connections
        </span>
      </h3>
      <div style="display:flex;gap:4px">
        <button onclick="pruneOrphanedEdges()"
          style="background:#F4F1EC;color:#888;border:1px solid #D8D2C8;
                 font-size:10px;padding:3px 8px"
          title="Remove any edges pointing to deleted nodes">
          🧹 Prune Orphans
        </button>
        <button onclick="startAddEdge()"
          style="background:#3E6B48;font-size:10px;padding:3px 10px">
          + Add Edge
        </button>
      </div>
    </div>
    ${orphanWarning}
    ${formHTML}
    ${EDGE_EDITOR_MODE==="list" ? listHTML : ""}
  `;

  // Wire up the custom loom toggle
  const loomSel = document.getElementById("ee_loom");
  if(loomSel){
    // Set to current value if editing
    if(sel?.loom && looms.includes(sel.loom)){
      loomSel.value = sel.loom;
    }
    loomSel.addEventListener("change", ()=>{
      const row = document.getElementById("ee_custom_loom_row");
      if(row) row.style.display = loomSel.value==="__custom__" ? "block" : "none";
    });
  }
}

// Re-renders just the from/to pin picker (not the whole form) when the
// From Node or To Node select changes, so other in-progress field values
// in the Edge Editor form are left untouched.
window.refreshEdgePinField = function(which){
  const nodeSel = document.getElementById(which === "from" ? "ee_from" : "ee_to");
  const wrap    = document.getElementById(which === "from" ? "ee_from_pin_wrap" : "ee_to_pin_wrap");
  if(!nodeSel || !wrap) return;
  const node    = STATE.nodes[nodeSel.value];
  const fieldId = which === "from" ? "ee_from_pin" : "ee_to_pin";
  wrap.innerHTML = renderPinField(fieldId, node?.connectors, undefined, undefined);
};

window.updateEdgeTypeColorSuggestion = function(type){
  const colorSel = document.getElementById("ee_color");
  if(!colorSel || colorSel.value) return; // don't override an existing choice
  const allowed = (COLOR_RULES||{})[type];
  if(allowed && allowed.length) colorSel.value = allowed[0];
};

window.startAddEdge = function(){
  EDGE_EDITOR_MODE = "add";
  EDGE_EDITOR_IDX  = null;
  renderEdgeEditor();
};

window.editEdge = function(idx){
  EDGE_EDITOR_MODE = "edit";
  EDGE_EDITOR_IDX  = idx;
  renderEdgeEditor();
};

window.cancelEdgeEdit = function(){
  EDGE_EDITOR_MODE = "list";
  EDGE_EDITOR_IDX  = null;
  renderEdgeEditor();
};

window.deleteEdge = function(idx){
  const e = EDGES[idx];
  if(!confirm(`Remove edge:\n${e.from} → ${e.to} [${e.loom||e.type}]?`)) return;
  EDGES.splice(idx, 1);
  renderAll();
  renderEdgeEditor();
  renderWiringSpec();
};

window.pruneOrphanedEdges = function(){
  const before = EDGES.length;
  EDGES = EDGES.filter(e => STATE.nodes[e.from] && STATE.nodes[e.to]);
  const removed = before - EDGES.length;
  renderAll();
  renderEdgeEditor();
  renderWiringSpec();
  if(removed > 0){
    const panel = document.getElementById("edgeEditorPanel");
    const note  = document.createElement("div");
    note.style.cssText = "margin-top:6px;padding:5px 8px;background:#F4FFF6;"+
                         "border-left:3px solid #3E6B48;font-size:11px;color:#3E6B48";
    note.textContent = `✓ Removed ${removed} orphaned edge(s)`;
    panel.appendChild(note);
    setTimeout(()=>note.remove(), 3000);
  }
};

window.saveEdge = function(){
  const msg  = document.getElementById("edgeMsg");
  const from = document.getElementById("ee_from")?.value;
  const to   = document.getElementById("ee_to")?.value;
  const type = document.getElementById("ee_type")?.value||"POWER";
  const zone = document.getElementById("ee_zone")?.value||"A";
  const res  = parseFloat(document.getElementById("ee_resistance")?.value||0.02);
  const wire = document.getElementById("ee_wire")?.value.trim()||undefined;

  const loomSel    = document.getElementById("ee_loom");
  const customLoom = document.getElementById("ee_custom_loom")?.value.trim();
  const loom       = loomSel?.value === "__custom__"
    ? (customLoom || "custom_loom")
    : (loomSel?.value || "cab_harness");

  if(!from || !to){
    msg.innerHTML=`<span style="color:#B00020">Both From and To nodes are required</span>`;
    return;
  }
  if(from === to){
    msg.innerHTML=`<span style="color:#B00020">From and To cannot be the same node</span>`;
    return;
  }

  const edge = { from, to, type, zone, loom, resistance:res };
  if(wire) edge.wireOverride = wire;

  // Wire detail fields for WireViz
  const color      = document.getElementById("ee_color")?.value;
  const stripe     = document.getElementById("ee_color_stripe")?.value;
  const fromPinInfo = readPinField("ee_from_pin");
  const toPinInfo    = readPinField("ee_to_pin");
  const length     = document.getElementById("ee_length")?.value;
  const twisted    = document.getElementById("ee_twisted")?.checked;
  const shield     = document.getElementById("ee_shield")?.checked;
  const drain      = document.getElementById("ee_drain")?.value;
  const notes      = document.getElementById("ee_notes")?.value.trim();

  if(color)   edge.color        = color;
  if(stripe)  edge.colorStripe  = stripe;
  if(fromPinInfo.connector) edge.fromConnector = fromPinInfo.connector;
  if(fromPinInfo.pin)       edge.fromPin       = fromPinInfo.pin;
  if(toPinInfo.connector)   edge.toConnector   = toPinInfo.connector;
  if(toPinInfo.pin)         edge.toPin         = toPinInfo.pin;
  if(length)  edge.length       = parseInt(length);
  if(twisted) edge.twisted      = true;
  if(shield)  edge.shield       = true;
  if(shield && drain) edge.drainGround = drain;
  if(notes)   edge.notes        = notes;

  if(EDGE_EDITOR_MODE === "add"){
    EDGES.push(edge);
    msg.innerHTML=`<span style="color:#3E6B48">✓ Edge added: ${from} → ${to}</span>`;
  } else if(EDGE_EDITOR_MODE === "edit" && EDGE_EDITOR_IDX !== null){
    EDGES[EDGE_EDITOR_IDX] = edge;
    msg.innerHTML=`<span style="color:#3E6B48">✓ Edge updated</span>`;
  }

  EDGE_EDITOR_MODE = "list";
  EDGE_EDITOR_IDX  = null;
  renderAll();
  renderEdgeEditor();
  renderWiringSpec();
};

// -----------------------------
// Status editor (Tab 2)
// -----------------------------
window.updateNodeStatus = function(id, newStatus){
  if(!STATE.status[id]) STATE.status[id]={};
  STATE.status[id].status = newStatus;
  renderGraph();
  renderLayout();
  renderStatusEditor();
};

function renderStatusEditor(){
  const nodes  = Object.values(STATE.nodes);
  const zones  = {};
  nodes.forEach(n=>{
    if(!zones[n.zone]) zones[n.zone]=[];
    zones[n.zone].push(n);
  });
  const zoneLabels={A:"Engine Bay",B:"Cab",C:"Trans Mid",D:"Trans Rear",E:"Rear Node"};
  const sColors={planned:"#AAA",ordered:"#2D6C8C",
                 installed:"#C4622D",tested:"#3E6B48"};
  const sList=["planned","ordered","installed","tested"];

  const zoneHTML=Object.entries(zones).sort(([a],[b])=>a.localeCompare(b))
    .map(([key,znodes])=>`
    <div style="margin-bottom:10px">
      <div style="font-size:10px;font-weight:bold;color:#AAA;
                  letter-spacing:1px;margin-bottom:4px">
        ZONE ${key} — ${(zoneLabels[key]||key).toUpperCase()}
      </div>
      ${znodes.map(n=>{
        const cur=STATE.status?.[n.id]?.status||"planned";
        const btns=sList.map(s=>`
          <button onclick="updateNodeStatus('${n.id}','${s}')"
            style="background:${s===cur?sColors[s]:"#F4F1EC"};
                   color:${s===cur?"white":"#999"};
                   border:1px solid ${s===cur?sColors[s]:"#E0DBD4"};
                   padding:2px 6px;border-radius:3px;
                   font-size:9px;cursor:pointer;transition:all 0.12s;margin:1px">
            ${s.charAt(0).toUpperCase()+s.slice(1)}
          </button>`).join("");
        return `
          <div id="status-row-${n.id}"
               style="display:flex;align-items:center;gap:6px;
                      padding:3px 4px;border-bottom:1px solid #F4F1EC;
                      ${n.tier===2?"opacity:0.7":""}">
            <span style="flex:1;font-size:11px">${n.label||n.id}</span>
            <div style="display:flex;gap:2px;flex-shrink:0">${btns}</div>
          </div>`;
      }).join("")}
    </div>
  `).join("");

  const panel=document.getElementById("statusEditorPanel");
  if(!panel) return;
  panel.innerHTML=`
    <div style="display:flex;justify-content:space-between;
                align-items:center;margin-bottom:8px">
      <h3 style="margin:0;color:#C4622D;font-size:13px">Build Status</h3>
      <button onclick="exportStatusJSON()"
        style="background:#3E6B48;font-size:10px;padding:3px 10px">
        ⬇ Save status.json
      </button>
    </div>
    ${zoneHTML}`;
}

window.exportStatusJSON = function(){
  const out={nodes:{}};
  Object.keys(STATE.status).forEach(id=>{
    out.nodes[id]={status:STATE.status[id].status};
  });
  const blob=new Blob([JSON.stringify(out,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download="status.json"; a.click();
  URL.revokeObjectURL(url);
};

// -----------------------------
// Wiring Spec table (Tab 2)
// -----------------------------
function renderWiringSpec(){
  const spec = generateWiringSpec({ loom: ACTIVE_LOOM });
  const panel = document.getElementById("wiringSpecPanel");
  if(!panel) return;

  const heading = ACTIVE_LOOM
    ? `Wiring Spec — <span style="color:#2D6C8C">
        ${ACTIVE_LOOM.replace(/_/g," ")}</span>`
    : "Wiring Specification";

  const rows = spec.map(s=>`
    <tr style="background:${s.warnings.length?"#FFF8F0":"white"}">
      <td style="padding:3px 8px;border-bottom:1px solid #F0EDE8;
                 font-size:10px">${s.circuit}</td>
      <td style="padding:3px 8px;border-bottom:1px solid #F0EDE8;
                 font-size:10px;color:#888">
        ${(s.loom||"—").replace(/_/g," ")}</td>
      <td style="padding:3px 8px;border-bottom:1px solid #F0EDE8;
                 font-size:10px;text-align:center">${s.current}A</td>
      <td style="padding:3px 8px;border-bottom:1px solid #F0EDE8;
                 font-size:10px;text-align:center">${s.wire}</td>
      <td style="padding:3px 8px;border-bottom:1px solid #F0EDE8;
                 font-size:10px;text-align:center">${s.fuse}</td>
      <td style="padding:3px 8px;border-bottom:1px solid #F0EDE8;
                 font-size:10px;text-align:center">${s.drop}V</td>
      <td style="padding:3px 8px;border-bottom:1px solid #F0EDE8;
                 font-size:10px;color:${s.warnings.length?"#B00020":"#3E6B48"}">
        ${s.warnings.length?"⚠ "+s.warnings[0]:"✓"}</td>
    </tr>`).join("");

  panel.innerHTML=`
    <h3 style="margin:0 0 8px;color:#C4622D;font-size:13px">${heading}</h3>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#F4F1EC">
          <th style="padding:4px 8px;text-align:left;font-size:9px;
                     color:#888;text-transform:uppercase">Circuit</th>
          <th style="padding:4px 8px;text-align:left;font-size:9px;
                     color:#888;text-transform:uppercase">Loom</th>
          <th style="padding:4px 8px;text-align:center;font-size:9px;
                     color:#888;text-transform:uppercase">Load</th>
          <th style="padding:4px 8px;text-align:center;font-size:9px;
                     color:#888;text-transform:uppercase">Wire</th>
          <th style="padding:4px 8px;text-align:center;font-size:9px;
                     color:#888;text-transform:uppercase">Fuse</th>
          <th style="padding:4px 8px;text-align:center;font-size:9px;
                     color:#888;text-transform:uppercase">Drop</th>
          <th style="padding:4px 8px;font-size:9px;
                     color:#888;text-transform:uppercase">Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// -----------------------------
// BOM panel (Tab 2)
// -----------------------------
function renderBOM(){
  const b=buildBOM({loom:ACTIVE_LOOM});
  const section=(title,rows)=>`
    <tr><td colspan="2" style="padding:5px 6px 2px;font-weight:bold;
        font-size:10px;color:#C4622D;text-transform:uppercase;
        letter-spacing:0.5px">${title}</td></tr>
    ${rows.map(r=>`<tr>
      <td style="padding:2px 6px;border-bottom:1px solid #F0EDE8">${r.item}</td>
      <td style="padding:2px 6px;border-bottom:1px solid #F0EDE8;
                 text-align:right">${r.qty}</td>
    </tr>`).join("")}`;

  const heading=ACTIVE_LOOM
    ?`BOM — <span style="color:#2D6C8C">${ACTIVE_LOOM.replace(/_/g," ")}</span>`
    :"Bill of Materials";

  const panel=document.getElementById("bomPanel");
  if(!panel) return;
  panel.innerHTML=`
    <h3 style="margin:0 0 6px;color:#C4622D;font-size:13px">${heading}</h3>
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead><tr>
        <th style="text-align:left;padding:3px 6px;background:#F4F1EC;
                   color:#888;font-size:10px;text-transform:uppercase;
                   letter-spacing:0.5px">Item</th>
        <th style="text-align:right;padding:3px 6px;background:#F4F1EC;
                   color:#888;font-size:10px;text-transform:uppercase;
                   letter-spacing:0.5px">Qty</th>
      </tr></thead>
      <tbody>
        ${section("Wire",b.wire)}
        ${section("Fuses",b.fuses)}
        ${section("Connectors",b.connectors)}
      </tbody>
    </table>`;
}

// -------------------------------------------------------
// PHASE 3 — Export panel with Import system.json
// -------------------------------------------------------
function renderExportPanel(){
  const panel=document.getElementById("exportPanel");
  if(!panel) return;
  panel.innerHTML=`
    <h3 style="margin:0 0 8px;color:#C4622D;font-size:13px">Export / Import</h3>
    <div style="display:flex;flex-direction:column;gap:6px">

      <button onclick="downloadReport()" style="text-align:left;padding:8px 12px">
        ⬇ Export Wiring Report (PDF)
        <span style="display:block;font-size:10px;opacity:0.8;font-weight:normal">
          Full report — component list, wiring spec, BOM
        </span>
      </button>

      <button onclick="exportStatusJSON()"
        style="background:#3E6B48;text-align:left;padding:8px 12px">
        ⬇ Save status.json
        <span style="display:block;font-size:10px;opacity:0.8;font-weight:normal">
          Download updated build status file — push to GitHub
        </span>
      </button>

      <button onclick="exportSystemJSON()"
        style="background:#2D6C8C;text-align:left;padding:8px 12px">
        ⬇ Save system.json
        <span style="display:block;font-size:10px;opacity:0.8;font-weight:normal">
          Download full system — nodes, edges, all component data
        </span>
      </button>

      <div style="border:1px solid #2D6C8C;border-radius:6px;padding:8px 12px;
                  background:#F0F4FF">
        <div style="font-size:11px;font-weight:bold;color:#2D6C8C;margin-bottom:4px">
          📐 Export WireViz YAML
        </div>
        <div style="font-size:10px;color:#555;margin-bottom:8px">
          Generates a harness diagram file for the active harness filter.
          Select a harness on the Diagram tab first, then export here.
          Run through WireViz on your NAS to produce SVG/PNG connector diagrams.
        </div>
        ${ACTIVE_LOOM ? `
          <button onclick="downloadWireVizYAML('${ACTIVE_LOOM}')"
            style="background:#2D6C8C;width:100%;text-align:left;padding:6px 10px">
            ⬇ Export ${ACTIVE_LOOM.replace(/_/g," ")} → WireViz YAML
          </button>` : `
          <div style="font-size:10px;color:#888;padding:4px 0;font-style:italic">
            ← Select a harness filter on the Diagram tab to enable export
          </div>`}
        <div style="margin-top:6px;font-size:9px;color:#888">
          Note: For accurate pin diagrams, populate Wire Detail fields
          (color, pin numbers, length) in the Edge Editor first.
        </div>
      </div>

      <div style="border:2px dashed #D8D2C8;border-radius:6px;padding:8px 12px;
                  background:#FAFAF8">
        <div style="font-size:11px;font-weight:bold;color:#555;margin-bottom:4px">
          ⬆ Import system.json
        </div>
        <div style="font-size:10px;color:#888;margin-bottom:6px">
          Load a saved system file — replaces all nodes and edges with the file contents.
          Status data is preserved if node IDs match.
        </div>
        <input type="file" id="importSystemFile" accept=".json"
          style="font-size:11px;width:100%"
          onchange="importSystemJSON(this)">
        <div id="importMsg" style="margin-top:6px;font-size:11px"></div>
      </div>

    </div>
    <div style="margin-top:10px;padding:8px 10px;background:#F4F1EC;
                border-radius:6px;font-size:10px;color:#888;line-height:1.6">
      After saving JSON files, push them to your GitHub repo under
      <code>data/system.json</code> and <code>data/status.json</code>.<br>
      The board reloads from those files on every page load.
    </div>`;
}

window.exportSystemJSON = function(){
  // Prune any remaining orphaned edges before export
  const cleanEdges = EDGES.filter(e=>STATE.nodes[e.from]&&STATE.nodes[e.to]);
  const out={
    nodes: Object.values(STATE.nodes).map(n=>{
      const node = {
        id:n.id, type:n.type, tier:n.tier, zone:n.zone,
        label:n.label, load:n.load,
        partNumber:n.partNumber||"—",
        notes:n.notes||""
      };
      // Connector groups — only include if at least one group is defined
      if(n.connectors?.length) node.connectors = n.connectors;
      return node;
    }),
    edges: cleanEdges.map(e=>{
      const edge = {
        from:e.from, to:e.to, type:e.type,
        zone:e.zone, loom:e.loom, resistance:e.resistance
      };
      // Wire override
      if(e.wireOverride) edge.wireOverride = e.wireOverride;
      // Wire detail — only include if populated
      if(e.color)        edge.color        = e.color;
      if(e.colorStripe)  edge.colorStripe  = e.colorStripe;
      if(e.fromConnector) edge.fromConnector = e.fromConnector;
      if(e.fromPin)       edge.fromPin       = e.fromPin;
      if(e.toConnector)   edge.toConnector    = e.toConnector;
      if(e.toPin)         edge.toPin          = e.toPin;
      if(e.length)        edge.length         = e.length;
      if(e.twisted)        edge.twisted        = e.twisted;
      if(e.shield)         edge.shield         = e.shield;
      if(e.drainGround)    edge.drainGround    = e.drainGround;
      if(e.notes)          edge.notes          = e.notes;
      return edge;
    })
  };
  const blob=new Blob([JSON.stringify(out,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download="system.json"; a.click();
  URL.revokeObjectURL(url);
};

// Phase 3 — Import system.json
window.importSystemJSON = function(input){
  const msg  = document.getElementById("importMsg");
  const file = input.files[0];
  if(!file){
    msg.innerHTML=`<span style="color:#B00020">No file selected</span>`;
    return;
  }
  if(!file.name.endsWith(".json")){
    msg.innerHTML=`<span style="color:#B00020">File must be a .json file</span>`;
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e){
    try {
      const data = JSON.parse(e.target.result);

      // Validate structure
      if(!data.nodes || !Array.isArray(data.nodes)){
        msg.innerHTML=`<span style="color:#B00020">Invalid file — missing nodes array</span>`;
        return;
      }
      if(!data.edges || !Array.isArray(data.edges)){
        msg.innerHTML=`<span style="color:#B00020">Invalid file — missing edges array</span>`;
        return;
      }

      // Snapshot existing status so we can preserve it for matching IDs
      const prevStatus = { ...STATE.status };

      // Replace STATE with imported data
      STATE.nodes  = {};
      data.nodes.forEach(n=>{
        STATE.nodes[n.id] = {
          ...n,
          effectiveVoltage: 12,
          inputVoltage:     0,
          failed:           false
        };
        // Preserve status if node ID existed before, else default to planned
        if(!STATE.status[n.id]){
          STATE.status[n.id] = prevStatus[n.id] || { status: "planned" };
        }
      });

      // Remove status entries for nodes that no longer exist
      Object.keys(STATE.status).forEach(id=>{
        if(!STATE.nodes[id]) delete STATE.status[id];
      });

      EDGES = data.edges;

      // Check for orphaned edges and warn
      const orphaned = EDGES.filter(e=>!STATE.nodes[e.from]||!STATE.nodes[e.to]);

      renderAll();
      renderComponentEditor();
      renderEdgeEditor();
      renderStatusEditor();
      renderWiringSpec();
      renderExportPanel();

      const nodeCount = data.nodes.length;
      const edgeCount = data.edges.length;
      const orphanNote = orphaned.length
        ? ` <span style="color:#E09B2D">⚠ ${orphaned.length} orphaned edge(s) detected — use Edge Editor → Prune Orphans to clean up.</span>`
        : "";

      document.getElementById("importMsg").innerHTML=
        `<span style="color:#3E6B48">✓ Loaded ${nodeCount} nodes, ${edgeCount} edges from ${file.name}</span>${orphanNote}`;

    } catch(err){
      msg.innerHTML=`<span style="color:#B00020">Parse error: ${err.message}</span>`;
    }
  };
  reader.onerror = function(){
    msg.innerHTML=`<span style="color:#B00020">Failed to read file</span>`;
  };
  reader.readAsText(file);

  // Reset file input so the same file can be re-imported if needed
  input.value = "";
};

// -----------------------------
// Master render
// -----------------------------
function renderAll(){
  renderGraph();
  renderControls();
  renderPlaybackControls();
  renderLayout();
  if(document.getElementById("tab-manage").style.display!=="none"){
    renderStatusEditor();
    renderComponentEditor();
    renderEdgeEditor();
    renderBOM();
    renderWiringSpec();
    renderExportPanel();
  }
}
