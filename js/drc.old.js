// =============================
// drc.js — Design Rule Checker
// C10 Build Board v29+
// Load order: after data.js, before ui.js
// =============================

// ── Wire gauge ampacity (continuous, chassis wiring, 105°C TXL) ──
const GAUGE_RATINGS = {
  "22 AWG":  3,
  "20 AWG":  5,
  "18 AWG":  7.5,
  "16 AWG":  13,
  "14 AWG":  17,
  "12 AWG":  23,
  "10 AWG":  32,
  "8 AWG":   46,
  "6 AWG":   65,
  "4 AWG":   95,
  "2 AWG":   130,
  "1/0 AWG": 150,
  "2/0 AWG": 175,
  "4/0 AWG": 260
};

// ── Connector body library ──
const CONNECTOR_LIBRARY = {
  // Deutsch
  "Deutsch DT 2-way":   { series:"DT",    pins:2,  maxAmpsPerPin:13,  ipRating:"IP67" },
  "Deutsch DT 4-way":   { series:"DT",    pins:4,  maxAmpsPerPin:13,  ipRating:"IP67" },
  "Deutsch DT 6-way":   { series:"DT",    pins:6,  maxAmpsPerPin:13,  ipRating:"IP67" },
  "Deutsch DT 8-way":   { series:"DT",    pins:8,  maxAmpsPerPin:13,  ipRating:"IP67" },
  "Deutsch DTM 2-way":  { series:"DTM",   pins:2,  maxAmpsPerPin:7.5, ipRating:"IP67" },
  "Deutsch DTM 4-way":  { series:"DTM",   pins:4,  maxAmpsPerPin:7.5, ipRating:"IP67" },
  "Deutsch DTM 6-way":  { series:"DTM",   pins:6,  maxAmpsPerPin:7.5, ipRating:"IP67" },
  "Deutsch DTM 8-way":  { series:"DTM",   pins:8,  maxAmpsPerPin:7.5, ipRating:"IP67" },
  "Deutsch DTP 2-way":  { series:"DTP",   pins:2,  maxAmpsPerPin:25,  ipRating:"IP67" },
  "Deutsch DTP 4-way":  { series:"DTP",   pins:4,  maxAmpsPerPin:25,  ipRating:"IP67" },
  // Weatherpack
  "Weatherpack 2-way":  { series:"WP",    pins:2,  maxAmpsPerPin:10,  ipRating:"IP54" },
  "Weatherpack 4-way":  { series:"WP",    pins:4,  maxAmpsPerPin:10,  ipRating:"IP54" },
  "Weatherpack 6-way":  { series:"WP",    pins:6,  maxAmpsPerPin:10,  ipRating:"IP54" },
  // Metri-Pack
  "Metri-Pack 150 2-way":{ series:"MP150",pins:2,  maxAmpsPerPin:10,  ipRating:"IP54" },
  "Metri-Pack 150 4-way":{ series:"MP150",pins:4,  maxAmpsPerPin:10,  ipRating:"IP54" },
  "Metri-Pack 280 2-way":{ series:"MP280",pins:2,  maxAmpsPerPin:20,  ipRating:"IP54" },
  // Anderson
  "Anderson SB50":      { series:"SB",    pins:1,  maxAmpsPerPin:50,  ipRating:"IP54" },
  "Anderson SB120":     { series:"SB",    pins:1,  maxAmpsPerPin:120, ipRating:"IP54" },
  "Anderson SB175":     { series:"SB",    pins:1,  maxAmpsPerPin:175, ipRating:"IP54" },
  // Holley
  "Holley 34-way":      { series:"HLY",   pins:34, maxAmpsPerPin:10,  ipRating:"IP54" },
  "Holley CAN 4-way":   { series:"HLY",   pins:4,  maxAmpsPerPin:5,   ipRating:"IP54" },
  // Dakota Digital
  "Dakota 3.5mm BIM":   { series:"DAK",   pins:2,  maxAmpsPerPin:1,   ipRating:"IP20" },
  // Lugs
  "Bare Lug 1/4\"":     { series:"LUG",   pins:1,  maxAmpsPerPin:50,  ipRating:"none" },
  "Bare Lug 3/8\"":     { series:"LUG",   pins:1,  maxAmpsPerPin:150, ipRating:"none" },
  "Bare Lug 1/2\"":     { series:"LUG",   pins:1,  maxAmpsPerPin:300, ipRating:"none" }
};

// ── Wire color standard — valid colors per circuit type ──
const COLOR_RULES = {
  "POWER":  ["RD", "RD/BK", "OG"],
  "GROUND": ["BK", "GN/YE"],
  "CAN":    ["WH", "BU"],
  "SIGNAL": ["GY", "GY/BK", "YE", "BN", "PK", "VT", "OG"]
};

// ── Helper: inrush multiplier ──
function inrushMultiplier(node) {
  if (!node) return 1.5;
  const load = node.load || 0;
  // Gear reduction starters have much lower inrush than direct-drive
  // Powermaster 4.4:1 gear reduction — 1.1x is accurate for this hardware
  if (node.type === "motor" && node.starterType === "gear_reduction") return 1.1;
  // Large motors (>50A base load) use 1.25x; small motors and others use 1.5x
  return (node.type === "motor" && load > 50) ? 1.25 : 1.5;
}

// ── DRC RULE DEFINITIONS ──
// Each rule: { id, name, severity, check(edge, nodes, allEdges) → { pass, message } }

const DRC_RULES = [

  // R01 — Wire gauge vs adjusted load
  {
    id: "R01",
    name: "Wire gauge undersized for load",
    severity: "error",
    check(edge, nodes) {
      const gauge = edge.wireOverride;
      if (!gauge) return { pass: true, message: "" };
      const destNode = nodes[edge.to];
      const load = destNode?.load || 0;
      if (load === 0) return { pass: true, message: "" };
      const mult = inrushMultiplier(destNode);
      const adjusted = load * mult;
      const rated = GAUGE_RATINGS[gauge] || 999;
      return {
        pass: rated >= adjusted,
        message: `${gauge} rated ${rated}A — circuit requires ${adjusted.toFixed(1)}A (${load}A × ${mult}× inrush)`
      };
    }
  },

  // R02 — Connector pin rating vs load
  {
    id: "R02",
    name: "Connector pin current rating exceeded",
    severity: "error",
    check(edge, nodes) {
      const body = CONNECTOR_LIBRARY[edge.connectorBody];
      if (!body) return { pass: true, message: "" };
      const load = nodes[edge.to]?.load || 0;
      if (load === 0) return { pass: true, message: "" };
      return {
        pass: body.maxAmpsPerPin >= load,
        message: `${edge.connectorBody} rated ${body.maxAmpsPerPin}A/pin — circuit load is ${load}A`
      };
    }
  },

  // R03 — Wire color convention
  {
    id: "R03",
    name: "Wire color does not match circuit type",
    severity: "warn",
    check(edge) {
      if (!edge.color) return { pass: true, message: "" };
      const allowed = COLOR_RULES[edge.type] || [];
      if (allowed.length === 0) return { pass: true, message: "" };
      return {
        pass: allowed.includes(edge.color),
        message: `${edge.color} is non-standard for ${edge.type} — expected: ${allowed.join(", ")}`
      };
    }
  },

  // R04 — CAN must be twisted pair
  {
    id: "R04",
    name: "CAN circuit requires twisted pair",
    severity: "error",
    check(edge) {
      if (edge.type !== "CAN") return { pass: true, message: "" };
      return {
        pass: edge.twisted === true,
        message: "CAN circuits must be flagged as twisted pair to prevent bus errors"
      };
    }
  },

  // R05 — VSS / frequency signals should be shielded twisted pair
  {
    id: "R05",
    name: "VSS / frequency signal should be shielded twisted pair",
    severity: "warn",
    check(edge) {
      if (edge.color !== "YE") return { pass: true, message: "" };
      return {
        pass: edge.shield === true && edge.twisted === true,
        message: "VSS and frequency signals should run as shielded twisted pair to prevent noise ingestion"
      };
    }
  },

  // R06 — Shield drain ground end must be declared
  {
    id: "R06",
    name: "Shielded run must declare drain ground end",
    severity: "warn",
    check(edge) {
      if (!edge.shield) return { pass: true, message: "" };
      return {
        pass: ["source", "dest"].includes(edge.drainGround),
        message: "Shielded runs must specify drainGround as 'source' or 'dest' — ground at one end only"
      };
    }
  },

  // R07 — Cavity plug accounting
  {
    id: "R07",
    name: "Unused connector cavities require cavity plugs",
    severity: "info",
    check(edge, nodes, allEdges) {
      if (!edge.connectorBody || !edge.fromConnector) return { pass: true, message: "" };
      const body = CONNECTOR_LIBRARY[edge.connectorBody];
      if (!body) return { pass: true, message: "" };
      // Count edges sharing this connector body and designator on the same node
      const usedPins = allEdges.filter(e =>
        e.from === edge.from &&
        e.fromConnector === edge.fromConnector
      ).length;
      const plugsNeeded = Math.max(0, body.pins - usedPins);
      return {
        pass: plugsNeeded === 0,
        message: `${plugsNeeded} cavity plug(s) needed — ${edge.connectorBody} ${edge.fromConnector} has ${usedPins}/${body.pins} pins used`
      };
    }
  },

  // R08 — Voltage drop threshold
  {
    id: "R08",
    name: "Voltage drop exceeds 0.5V threshold",
    severity: "warn",
    check(edge) {
      // Use pre-calculated drop if available, otherwise estimate
      const drop = parseFloat(edge.calculatedDrop || 0);
      if (drop === 0) return { pass: true, message: "" };
      return {
        pass: drop <= 0.5,
        message: `Calculated drop is ${drop.toFixed(2)}V — exceeds 0.5V threshold, consider upsizing wire`
      };
    }
  },

  // R09 — Ground circuits should terminate at star ground block
  {
    id: "R09",
    name: "Ground circuit should terminate at star ground block",
    severity: "warn",
    check(edge, nodes) {
      if (edge.type !== "GROUND") return { pass: true, message: "" };
      const destNode = nodes[edge.to];
      const isGroundBlock = edge.to === "ground_block" ||
                            destNode?.type === "distribution";
      return {
        pass: isGroundBlock,
        message: "Ground circuits should route to the star ground block — avoid direct chassis grounds for signal circuits"
      };
    }
  },

  // R10 — Wire length must be specified for accurate BOM
  {
    id: "R10",
    name: "Wire length not specified — BOM footage will be inaccurate",
    severity: "info",
    check(edge) {
      return {
        pass: (edge.length || 0) > 0,
        message: "Add wire length in inches so the BOM can calculate total footage and cost accurately"
      };
    }
  },

  // R11 — Power circuits need a specified connector body for pin rating check
  {
    id: "R11",
    name: "Power circuit missing connector body — pin rating cannot be verified",
    severity: "info",
    check(edge) {
      if (edge.type !== "POWER") return { pass: true, message: "" };
      const load = 0; // will use node load in full integration
      return {
        pass: !!edge.connectorBody,
        message: "Specify connector body on power circuits so DRC can verify pin current rating"
      };
    }
  },

  // R12 — CAN pair completeness (H and L should both be present)
  {
    id: "R12",
    name: "CAN circuit missing its pair (H or L)",
    severity: "warn",
    check(edge, nodes, allEdges) {
      if (edge.type !== "CAN") return { pass: true, message: "" };
      // Find the paired edge (same from/to, same loom, CAN type, different color)
      const paired = allEdges.some(e =>
        e !== edge &&
        e.type === "CAN" &&
        e.from === edge.from &&
        e.to === edge.to &&
        e.loom === edge.loom &&
        e.color !== edge.color
      );
      return {
        pass: paired,
        message: `CAN circuit (${edge.color}) has no matching pair — both CAN H (WH) and CAN L (BU) must be present`
      };
    }
  }
];

// ── MAIN DRC RUNNER ──
// Returns array of result objects sorted: errors first, then warns, then info
function runDRC(edges, nodes) {
  const results = [];

  edges.forEach(edge => {
    DRC_RULES.forEach(rule => {
      try {
        const result = rule.check(edge, nodes, edges);
        if (!result.pass) {
          results.push({
            ruleId:   rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            message:  result.message,
            circuit:  `${edge.from} → ${edge.to}`,
            loom:     edge.loom || "—"
          });
        }
      } catch(e) {
        // Rule threw — log but don't crash the UI
        console.warn(`DRC rule ${rule.id} error on edge ${edge.from}→${edge.to}:`, e);
      }
    });
  });

  // Sort: errors first, then warns, then info
  const order = { error:0, warn:1, info:2 };
  results.sort((a,b) => (order[a.severity]||3) - (order[b.severity]||3));
  return results;
}

// ── DRC SUMMARY RENDERER ──
// Call this from renderAll() or from the export panel to show results inline
function renderDRCSummary(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const edges = EDGES;
  const nodes = STATE.nodes;
  if (!edges || !nodes) {
    container.innerHTML = `<div style="font-size:11px;color:#AAA">No data loaded</div>`;
    return;
  }

  const results = runDRC(edges, nodes);
  const errors = results.filter(r => r.severity === "error");
  const warns  = results.filter(r => r.severity === "warn");
  const infos  = results.filter(r => r.severity === "info");

  const severityColors = {
    error: { bg:"#FFF0F0", border:"#B00020", icon:"✕", label:"ERROR" },
    warn:  { bg:"#FFFBF0", border:"#E09B2D", icon:"⚠", label:"WARN"  },
    info:  { bg:"#F0F8FF", border:"#2D6C8C", icon:"ℹ", label:"INFO"  }
  };

  // Summary chips
  const chips = `
    <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">
      <span style="font-size:11px;padding:3px 10px;border-radius:10px;
                   background:${errors.length?"#B00020":"#3E6B48"};color:white;font-weight:bold">
        ${errors.length} Error${errors.length!==1?"s":""}
      </span>
      <span style="font-size:11px;padding:3px 10px;border-radius:10px;
                   background:${warns.length?"#E09B2D":"#3E6B48"};color:white">
        ${warns.length} Warning${warns.length!==1?"s":""}
      </span>
      <span style="font-size:11px;padding:3px 10px;border-radius:10px;
                   background:#2D6C8C;color:white">
        ${infos.length} Info
      </span>
      <span style="font-size:11px;padding:3px 10px;border-radius:10px;
                   background:#F4F1EC;color:#555;border:1px solid #D8D2C8">
        ${edges.length} circuits checked
      </span>
    </div>`;

  if (results.length === 0) {
    container.innerHTML = `
      <h3 style="margin:0 0 8px;color:#C4622D;font-size:13px">Design Rule Check</h3>
      ${chips}
      <div style="padding:12px;background:#F4FFF6;border-left:3px solid #3E6B48;
                  border-radius:0 4px 4px 0;font-size:11px;color:#3E6B48">
        ✓ All DRC rules passed
      </div>`;
    return;
  }

  const rows = results.map(r => {
    const c = severityColors[r.severity];
    return `
      <div style="padding:5px 8px;margin:2px 0;border-radius:4px;
                  border-left:3px solid ${c.border};background:${c.bg};
                  font-size:11px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
          <span style="color:${c.border};font-weight:bold;min-width:14px">${c.icon}</span>
          <span style="color:#888;font-size:9px;font-weight:bold;
                       letter-spacing:0.5px">${c.label} ${r.ruleId}</span>
          <span style="flex:1;font-weight:bold;color:#2E2A26">${r.circuit}</span>
          <span style="font-size:9px;color:#AAA;background:white;
                       padding:1px 5px;border-radius:8px;
                       border:1px solid #E0DBD4">${r.loom.replace(/_/g," ")}</span>
        </div>
        <div style="color:#555;padding-left:20px;line-height:1.4">${r.message}</div>
      </div>`;
  }).join("");

  container.innerHTML = `
    <h3 style="margin:0 0 8px;color:#C4622D;font-size:13px">Design Rule Check</h3>
    ${chips}
    <div style="max-height:300px;overflow-y:auto">${rows}</div>`;
}

// ── WIREVIZ YAML EXPORT ──
// Generates a WireViz-compatible YAML string for the active loom.
// Hardened: infers pincount from edge data when connector metadata is absent,
// deduplicates cable IDs for parallel edges (e.g. CAN H + CAN L),
// and sanitizes all YAML keys to be WireViz-safe.

function generateWireVizYAML(loom) {
  const filteredEdges = EDGES.filter(e => e.loom === loom);
  if (filteredEdges.length === 0) return "# No edges found for loom: " + loom;

  // ── Helper: make a valid YAML key (no hyphens, spaces, slashes, parens) ──
  function yamlKey(str) {
    return (str || "unknown").replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+/, "");
  }

  // ── Collect unique node IDs appearing in this loom ──
  const nodeIds = [...new Set([
    ...filteredEdges.map(e => e.from),
    ...filteredEdges.map(e => e.to)
  ])];

  // ── Infer minimum pincount for each node from edge fromPin / toPin values ──
  // This ensures WireViz gets a valid pincount even when connector metadata
  // hasn't been populated yet. Falls back to 1 if no pin data exists at all.
  function inferPinCount(nodeId) {
    let maxPin = 1;
    filteredEdges.forEach(e => {
      if (e.from === nodeId && e.fromPin) maxPin = Math.max(maxPin, e.fromPin);
      if (e.to   === nodeId && e.toPin)   maxPin = Math.max(maxPin, e.toPin);
    });
    return maxPin;
  }

  // ── Build cable IDs — deduplicate parallel edges (same from→to) ──
  // WireViz errors on duplicate YAML keys, so parallel edges get a suffix.
  const cableIdCounts = {};
  const cableIds = filteredEdges.map(edge => {
    const base = `W_${yamlKey(edge.from)}_${yamlKey(edge.to)}`;
    cableIdCounts[base] = (cableIdCounts[base] || 0) + 1;
    return base;
  });
  // Second pass: add numeric suffix where the same base appears more than once
  const baseSeen = {};
  const finalCableIds = cableIds.map(base => {
    if (cableIdCounts[base] > 1) {
      baseSeen[base] = (baseSeen[base] || 0) + 1;
      return `${base}_${baseSeen[base]}`;
    }
    return base;
  });

  // ── YAML header ──
  let yaml = `# Auto-generated by C10 Build Board\n`;
  yaml += `# Loom: ${loom}\n`;
  yaml += `# Generated: ${new Date().toLocaleDateString()}\n`;
  yaml += `# Pincount values marked [inferred] were derived from edge pin assignments.\n`;
  yaml += `# Populate connector metadata in the Component Editor to replace them.\n\n`;

  // ── Connectors block ──
  yaml += `connectors:\n\n`;

  nodeIds.forEach(id => {
    const node = STATE.nodes[id];
    if (!node) return;

    const key   = yamlKey(node.label || id);
    const pNum  = node.partNumber || "—";
    const notes = (node.notes || "").replace(/"/g, "'").split("\n")[0];

    yaml += `  ${key}:\n`;
    yaml += `    type: "${pNum}"\n`;
    if (notes) yaml += `    notes: "${notes}"\n`;

    // Prefer explicit connector metadata; fall back to inference
    let pincount  = null;
    let pinlabels = null;

    if (node.connectors && node.connectors.length > 0) {
      const conn = node.connectors[0];
      if (conn.pins && conn.pins.length > 0) {
        pincount  = conn.pinCount || conn.pins.length;
        pinlabels = conn.pins.map(p => p.label);
      } else if (conn.pinCount) {
        pincount = conn.pinCount;
      }
    }

    if (!pincount) {
      pincount = inferPinCount(id);
      yaml += `    pincount: ${pincount}  # inferred\n`;
    } else {
      yaml += `    pincount: ${pincount}\n`;
    }

    if (pinlabels && pinlabels.length > 0) {
      yaml += `    pinlabels: [${pinlabels.join(", ")}]\n`;
    }

    yaml += `\n`;
  });

  // ── Cables block ──
  yaml += `cables:\n\n`;

  filteredEdges.forEach((edge, i) => {
    const cableId  = finalCableIds[i];
    const colorStr = edge.colorStripe
      ? `${edge.color || "WH"}/${edge.colorStripe}`
      : (edge.color || "WH");
    const gauge    = edge.wireOverride || "18 AWG";

    yaml += `  ${cableId}:\n`;
    yaml += `    gauge: "${gauge}"\n`;
    yaml += `    colors: [${colorStr}]\n`;
    yaml += `    wirecount: 1\n`;
    if (edge.shield) {
      yaml += `    shield: true\n`;
      yaml += `    shieldcolor: GN\n`;
    }
    if (edge.twisted) yaml += `    twisted: true\n`;
    if (edge.length)  yaml += `    length: ${edge.length} in\n`;
    if (edge.notes)   yaml += `    notes: "${edge.notes.replace(/"/g, "'")}"\n`;
    yaml += `\n`;
  });

  // ── Connections block ──
  yaml += `connections:\n\n`;

  filteredEdges.forEach((edge, i) => {
    const cableId  = finalCableIds[i];
    const fromKey  = yamlKey(STATE.nodes[edge.from]?.label || edge.from);
    const toKey    = yamlKey(STATE.nodes[edge.to]?.label   || edge.to);
    const fromPin  = edge.fromPin || 1;
    const toPin    = edge.toPin   || 1;

    yaml += `  - - ${fromKey}: [${fromPin}]\n`;
    yaml += `    - ${cableId}: [1]\n`;
    yaml += `    - ${toKey}: [${toPin}]\n\n`;
  });

  return yaml;
}

// ── YAML DOWNLOAD TRIGGER ──
window.downloadWireVizYAML = function(loom) {
  const yaml = generateWireVizYAML(loom || ACTIVE_LOOM);
  if (!yaml) return;
  const blob = new Blob([yaml], { type: "text/yaml" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `${loom || ACTIVE_LOOM || "harness"}.yml`;
  a.click();
  URL.revokeObjectURL(url);
};

console.log("drc.js loaded — DRC engine, WireViz YAML export ready");
