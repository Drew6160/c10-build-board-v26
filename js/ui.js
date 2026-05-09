// =============================
// UI v28 — Two-Tab Architecture
// Tab 1: Diagram + Diagnostics
// Tab 2: Build Management
// =============================

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
    renderBOM();
    renderWiringSpec();
    renderExportPanel();
  }
};

// ==============================
// TAB 1 — DIAGRAM
// ==============================

// -----------------------------
// Node click — diagnostics
// -----------------------------
window.handleNodeClick = function(id){
  const node      = STATE.nodes?.[id];
  const statusKey = STATE.status?.[id]?.status || "planned";
  const v         = node ? (node.effectiveVoltage||0).toFixed(2) : "—";
  const healthKey = !node                              ? "unknown"
                  : node.failed || node.effectiveVoltage < 10 ? "failed"
                  : node.effectiveVoltage < 12.0       ? "warn"
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

// -----------------------------
// Route click
// -----------------------------
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
  // exit playback first
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
// Compact — just summary +
// progress bar
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

  // compact stat chips
  const chips = [
    { label:"Nodes",    val:total,             color:"#2E2A26" },
    { label:"Failures", val:failed,            color:failed>0?"#B00020":"#3E6B48" },
    { label:"Avg V",    val:avgV+"V",          color:"#2E2A26" },
    { label:"Done",     val:done+"/"+total,    color:"#C4622D" },
    { label:"Progress", val:pct+"%",           color:"#3E6B48" }
  ].map(c=>`
    <div style="background:#F4F1EC;border-radius:6px;padding:6px 10px;
                text-align:center;flex:1">
      <div style="font-size:16px;font-weight:bold;color:${c.color}">${c.val}</div>
      <div style="font-size:9px;color:#AAA;text-transform:uppercase;
                  letter-spacing:0.5px">${c.label}</div>
    </div>`).join("");

  // progress bar
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

  // status breakdown mini-bar
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

  // faults section — only shown when failures exist
  const faultNodes = nodes.filter(n=>n.failed);
  const faultHTML = faultNodes.length ? `
    <hr style="border:none;border-top:1px solid #D8D2C8;margin:8px 0 6px">
    <div style="font-size:10px;font-weight:bold;color:#B00020;
                letter-spacing:1px;margin-bottom:4px">
      ACTIVE FAULTS
    </div>
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

  // manage tab link
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

// -----------------------------
// Component Editor
// Add new nodes or edit existing
// -----------------------------
let EDITOR_MODE = "edit"; // "edit" | "add"
let EDITOR_NODE = null;

function renderComponentEditor(){
  const nodes = Object.values(STATE.nodes);
  const zones = ["A","B","C"];
  const tiers = [1,2];
  const types = ["source","motor","control","sensor","display","relay",
                 "distribution","ignition","fuel","lighting","accessory"];
  const looms = [...new Set(EDGES.map(e=>e.loom).filter(Boolean))];

  const nodeOptions = nodes.map(n=>
    `<option value="${n.id}" ${EDITOR_NODE===n.id?"selected":""}>
      ${n.label||n.id} (${n.zone})
    </option>`
  ).join("");

  const sel = EDITOR_NODE ? STATE.nodes[EDITOR_NODE] : null;

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

    ${EDITOR_MODE==="add" || sel ? `
    <div id="editorForm">

      ${EDITOR_MODE==="add" ? `
      <div class="form-row">
        <div>
          <label>Node ID (no spaces)</label>
          <input id="ef_id" type="text" placeholder="e.g. horn_relay"
            value="">
        </div>
        <div>
          <label>Zone</label>
          <select id="ef_zone">
            ${zones.map(z=>`<option value="${z}">${z==="A"?"Engine Bay":z==="B"?"Cab":"Rear Node"}</option>`).join("")}
          </select>
        </div>
      </div>` : ""}

      <div class="form-row">
        <div>
          <label>Label / Display Name</label>
          <input id="ef_label" type="text"
            value="${sel?.label||""}" placeholder="e.g. Horn Relay">
        </div>
        <div>
          <label>Part Number</label>
          <input id="ef_part" type="text"
            value="${sel?.partNumber||""}" placeholder="e.g. Bosch 0332">
        </div>
      </div>

      <div class="form-row-3">
        <div>
          <label>Type</label>
          <select id="ef_type">
            ${types.map(t=>`<option value="${t}"
              ${sel?.type===t?"selected":""}>${t}</option>`).join("")}
          </select>
        </div>
        <div>
          <label>Tier</label>
          <select id="ef_tier">
            ${tiers.map(t=>`<option value="${t}"
              ${sel?.tier===t?"selected":""}>${t===1?"1 — Core":"2 — Accessory"}</option>`).join("")}
          </select>
        </div>
        <div>
          <label>Load (amps)</label>
          <input id="ef_load" type="number" min="0" step="0.1"
            value="${sel?.load||0}" placeholder="0">
        </div>
      </div>

      ${EDITOR_MODE==="add" ? `
      <div class="form-row">
        <div>
          <label>Connect from (node ID)</label>
          <select id="ef_from">
            <option value="">— select source node —</option>
            ${nodes.map(n=>`<option value="${n.id}">${n.label||n.id}</option>`).join("")}
          </select>
        </div>
        <div>
          <label>Loom</label>
          <select id="ef_loom">
            ${looms.map(l=>`<option value="${l}">${l.replace(/_/g," ")}</option>`).join("")}
            <option value="cab_harness">cab harness</option>
          </select>
        </div>
      </div>` : ""}

      <div>
        <label>Build Status</label>
        <select id="ef_status">
          ${["planned","ordered","installed","tested"].map(s=>
            `<option value="${s}"
              ${(STATE.status?.[EDITOR_NODE]?.status||"planned")===s?"selected":""}
              >${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
          ).join("")}
        </select>
      </div>

      <div>
        <label>Notes</label>
        <textarea id="ef_notes" rows="3"
          placeholder="Part notes, install tips, cross-references..."
          >${sel?.notes||""}</textarea>
      </div>

      <div style="display:flex;gap:6px;margin-top:4px">
        <button onclick="saveEditorForm()"
          style="background:#3E6B48;flex:1">
          ${EDITOR_MODE==="add"?"＋ Add Component":"✓ Save Changes"}
        </button>
        ${EDITOR_MODE==="edit" && sel ? `
        <button onclick="deleteNode('${EDITOR_NODE}')"
          style="background:#B00020;padding:6px 14px">
          ✕
        </button>` : ""}
      </div>

    </div>` : `
    <div style="text-align:center;padding:40px 20px;color:#AAA;font-size:12px">
      Select a component above to edit its details
    </div>`}

    <div id="editorMsg" style="margin-top:8px;font-size:11px"></div>
  `;
}

window.setEditorMode = function(mode){
  EDITOR_MODE = mode;
  EDITOR_NODE = null;
  renderComponentEditor();
};

window.selectEditorNode = function(id){
  EDITOR_NODE = id || null;
  renderComponentEditor();
};

window.scrollToNode = function(id){
  EDITOR_MODE = "edit";
  EDITOR_NODE = id;
  renderComponentEditor();
  renderStatusEditor();
};

window.saveEditorForm = function(){
  const msg = document.getElementById("editorMsg");

  if(EDITOR_MODE === "add"){
    const id    = document.getElementById("ef_id")?.value.trim().replace(/\s+/g,"_");
    const zone  = document.getElementById("ef_zone")?.value;
    const from  = document.getElementById("ef_from")?.value;
    const loom  = document.getElementById("ef_loom")?.value;

    if(!id){ msg.innerHTML=`<span style="color:#B00020">Node ID is required</span>`; return; }
    if(STATE.nodes[id]){ msg.innerHTML=`<span style="color:#B00020">ID already exists</span>`; return; }

    // add node
    STATE.nodes[id] = {
      id,
      zone,
      tier:        parseInt(document.getElementById("ef_tier")?.value||1),
      type:        document.getElementById("ef_type")?.value||"accessory",
      label:       document.getElementById("ef_label")?.value.trim()||id,
      partNumber:  document.getElementById("ef_part")?.value.trim()||"—",
      load:        parseFloat(document.getElementById("ef_load")?.value||0),
      notes:       document.getElementById("ef_notes")?.value.trim()||"",
      effectiveVoltage:12, inputVoltage:0, failed:false
    };

    // add status
    STATE.status[id] = {
      status: document.getElementById("ef_status")?.value||"planned"
    };

    // add edge if from node selected
    if(from){
      EDGES.push({
        from, to:id,
        type:"POWER", zone,
        loom: loom||"cab_harness",
        resistance:0.03
      });
    }

    EDITOR_NODE = id;
    EDITOR_MODE = "edit";
    msg.innerHTML=`<span style="color:#3E6B48">✓ ${STATE.nodes[id].label} added</span>`;

  } else if(EDITOR_NODE){
    const n = STATE.nodes[EDITOR_NODE];
    if(!n){ msg.innerHTML=`<span style="color:#B00020">Node not found</span>`; return; }

    n.label       = document.getElementById("ef_label")?.value.trim()||n.label;
    n.partNumber  = document.getElementById("ef_part")?.value.trim()||n.partNumber;
    n.type        = document.getElementById("ef_type")?.value||n.type;
    n.tier        = parseInt(document.getElementById("ef_tier")?.value||n.tier);
    n.load        = parseFloat(document.getElementById("ef_load")?.value||n.load);
    n.notes       = document.getElementById("ef_notes")?.value.trim()||"";

    if(!STATE.status[EDITOR_NODE]) STATE.status[EDITOR_NODE]={};
    STATE.status[EDITOR_NODE].status =
      document.getElementById("ef_status")?.value||"planned";

    msg.innerHTML=`<span style="color:#3E6B48">✓ ${n.label} saved</span>`;
  }

  renderAll();
  renderStatusEditor();
  renderWiringSpec();
};

window.deleteNode = function(id){
  if(!confirm(`Delete ${STATE.nodes[id]?.label||id}? This cannot be undone.`)) return;
  delete STATE.nodes[id];
  delete STATE.status[id];
  // remove edges connected to this node
  EDGES = EDGES.filter(e=>e.from!==id && e.to!==id);
  EDITOR_NODE = null;
  renderAll();
  renderComponentEditor();
  renderStatusEditor();
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
  const zones  = {A:[],B:[],C:[]};
  nodes.forEach(n=>{if(zones[n.zone])zones[n.zone].push(n);});
  const zoneLabels={A:"Engine Bay",B:"Cab",C:"Rear Node"};
  const sColors={planned:"#AAA",ordered:"#2D6C8C",
                 installed:"#C4622D",tested:"#3E6B48"};
  const sList=["planned","ordered","installed","tested"];

  const zoneHTML=Object.entries(zones).map(([key,znodes])=>`
    <div style="margin-bottom:10px">
      <div style="font-size:10px;font-weight:bold;color:#AAA;
                  letter-spacing:1px;margin-bottom:4px">
        ${zoneLabels[key].toUpperCase()}
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

// -----------------------------
// Export panel (Tab 2)
// -----------------------------
function renderExportPanel(){
  const panel=document.getElementById("exportPanel");
  if(!panel) return;
  panel.innerHTML=`
    <h3 style="margin:0 0 8px;color:#C4622D;font-size:13px">Export</h3>
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
          Download updated build status file to push to GitHub
        </span>
      </button>
      <button onclick="exportSystemJSON()"
        style="background:#2D6C8C;text-align:left;padding:8px 12px">
        ⬇ Save system.json
        <span style="display:block;font-size:10px;opacity:0.8;font-weight:normal">
          Download updated system file including any added components
        </span>
      </button>
    </div>
    <div style="margin-top:10px;padding:8px 10px;background:#F4F1EC;
                border-radius:6px;font-size:10px;color:#888;line-height:1.6">
      After saving JSON files, push them to your GitHub repo.<br>
      Once a backend is connected, changes will save automatically.
    </div>`;
}

window.exportSystemJSON = function(){
  const out={
    nodes: Object.values(STATE.nodes).map(n=>({
      id:n.id, type:n.type, tier:n.tier, zone:n.zone,
      label:n.label, load:n.load,
      partNumber:n.partNumber||"—",
      notes:n.notes||""
    })),
    edges: EDGES
  };
  const blob=new Blob([JSON.stringify(out,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download="system.json"; a.click();
  URL.revokeObjectURL(url);
};

// -----------------------------
// Master render
// -----------------------------
function renderAll(){
  renderGraph();
  renderControls();
  renderPlaybackControls();
  renderLayout();
  // only render tab 2 panels if visible
  if(document.getElementById("tab-manage").style.display!=="none"){
    renderStatusEditor();
    renderComponentEditor();
    renderBOM();
    renderWiringSpec();
    renderExportPanel();
  }
}
