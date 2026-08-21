/**
 * Part A of the offline Code Universe browser app (state, document payload
 * decode, tooltips/status, audio cluster). See universe-app-script.ts for
 * the assembled payload.
 */
export const UNIVERSE_APP_SCRIPT_A = `
(function () {
  'use strict';
  var DATA = JSON.parse(document.getElementById('savant-graph-data').textContent);
  var AUDIO = JSON.parse(document.getElementById('savant-audio-data').textContent);
  var audioContext = null;
  var audioMaster = null;
  var audioUnlocked = false;
  var soundEnabled = false;
  var soundVolume = 0.4;
  var audioBuffers = {};
  var activeSources = [];
  var activeProcedural = [];
  var activePending = 0;
  var audioBootstrapping = true;
  var sigma = null;
  var graph = null;
  var state = 'universe';
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var selected = null;
  var selectedRegion = null;
  var motionFrame = 0;
  var planetCanvas = null;
  var brandLogo = null;
  var systemById = {};
  var objectById = {};
  var folderById = {};
  var browserFolderId = null;
  var browserDocumentId = null;
  var browserPage = 0;
  var searchIndex = (DATA.universe.searchIndex || []).slice();
  var searchActive = -1;
  var docWrapOff = false;
  var LARGE_DOCUMENT_LINE_THRESHOLD = 10000;
  DATA.universe.regions.forEach(function (r) { systemById[r.id] = r; objectById[r.id] = r; });    DATA.universe.files.forEach(function (f) { objectById[f.id] = f; });
  var folderByPath = {};
  (DATA.universe.folders || []).forEach(function (folder) { folderById[folder.id] = folder; folderByPath[folder.path] = folder; });
  var regionTrees = {};
  var navRowCounter = 0;
  var filesByRegion = {};
  DATA.universe.files.forEach(function (f) { (filesByRegion[f.regionId] = filesByRegion[f.regionId] || []).push(f); });

  // FID-2026-0807-020: documents ship in a separate gzip+base64 block and are
  // decompressed off the critical path. The graph (universe) boots first; the
  // docs promise resolves as soon as the payload is decoded. renderDocument
  // awaits it so a fast first frame is never blocked by the 10+ MB text block.
  var documentsData = {};
  var documentsReady = (function decodeDocuments() {
    try {
      var raw = document.getElementById('savant-docs-payload').textContent;
      var meta = JSON.parse(raw);
      if (!meta || meta.mode !== 'gzip') {
        documentsData = meta && typeof meta.payload === 'string' ? JSON.parse(meta.payload) : {};
        return Promise.resolve();
      }
      if (typeof Uint8Array.fromBase64 !== 'function' || typeof DecompressionStream !== 'function') {
        throw new Error('compression streams unsupported');
      }
      var compressed = Uint8Array.fromBase64(meta.payload);
      var stream = new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip')));
      return stream.json().then(function (docs) { documentsData = docs || {}; });
    } catch (error) {
      setStatus('Document payload decode unavailable · graph remains fully usable');
      documentsData = {};
      return Promise.resolve();
    }
  })();

  var tooltipNodeId = null;
  function setStatus(text) { var el = document.getElementById('graph-status'); if (el) el.textContent = text; }
  function hideUniverseTooltip() {
    tooltipNodeId = null;
    var tooltip = document.getElementById('universe-tooltip');
    if (tooltip) { tooltip.classList.remove('visible'); tooltip.setAttribute('aria-hidden', 'true'); }
  }
  function showUniverseTooltip(node, nodeId) {
    var tooltip = document.getElementById('universe-tooltip');
    if (!tooltip || !sigma || !node) return;
    tooltipNodeId = nodeId;
    var isSystem = node.fileCount !== undefined;
    var kind = tooltip.querySelector('.universe-tooltip-kind');
    var title = tooltip.querySelector('.universe-tooltip-title');
    var path = tooltip.querySelector('.universe-tooltip-path');
    var meta = tooltip.querySelector('.universe-tooltip-meta');
    if (kind) kind.textContent = isSystem ? 'SYSTEM / REGION' : 'FILE / NODE';
    if (title) title.textContent = node.label || node.path || 'Unnamed object';
    if (path) path.textContent = node.path || '';
    if (meta) meta.textContent = isSystem
      ? (node.fileCount || 0) + ' files · ' + (node.edgeCount || 0) + ' edges'
      : 'Click to inspect · ' + (regionFor(nodeId) ? regionFor(nodeId).label : 'Code Universe');
    tooltip.classList.add('visible');
    tooltip.setAttribute('aria-hidden', 'false');
    positionUniverseTooltip();
  }
  function positionUniverseTooltip() {
    if (!tooltipNodeId || !sigma || !graph || !graph.hasNode(tooltipNodeId)) return;
    var tooltip = document.getElementById('universe-tooltip');
    var viewport = document.querySelector('.viewport-wrap');
    if (!tooltip || !viewport || !tooltip.classList.contains('visible')) return;
    var point;
    try { point = sigma.graphToViewport(graph.getNodeAttributes(tooltipNodeId)); } catch (error) { hideUniverseTooltip(); return; }
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) { hideUniverseTooltip(); return; }
    var margin = 14;
    var width = viewport.clientWidth;
    var height = viewport.clientHeight;
    var tooltipWidth = tooltip.offsetWidth || 250;
    var tooltipHeight = tooltip.offsetHeight || 72;
    var left = Math.max(margin, Math.min(point.x - tooltipWidth / 2, width - tooltipWidth - margin));
    var above = point.y - tooltipHeight - 18;
    var top = above >= margin ? above : Math.min(height - tooltipHeight - margin, point.y + 18);
    top = Math.max(margin, top);
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  }
  function updateSoundUi() {
    var toggle = document.getElementById('sound-toggle');
    var status = document.getElementById('sound-status');
    if (toggle) { toggle.textContent = !audioUnlocked ? 'SFX LOCKED' : soundEnabled ? 'SFX ON' : 'SFX OFF'; toggle.setAttribute('aria-pressed', soundEnabled ? 'true' : 'false'); }
    if (status) status.textContent = !audioUnlocked ? 'Interact to unlock' : soundEnabled ? 'Online · volume ' + Math.round(soundVolume * 100) + '%' : 'Muted';
  }
  function stopActiveSounds() {
    activeSources.forEach(function (source) {
      try { source.stop(); } catch (error) { void error; }
      try { source.disconnect(); } catch (error) { void error; }
    });
    activeSources = [];
    activeProcedural.forEach(function (oscillator) {
      try { oscillator.stop(); } catch (error) { void error; }
      try { oscillator.disconnect(); } catch (error) { void error; }
    });
    activeProcedural = [];
    activePending = 0;
  }
  function getAudioCtor() { return window.AudioContext || window.webkitAudioContext; }
  function unlockAudio() {
    if (audioUnlocked && audioContext) return Promise.resolve(true);
    var AudioCtor = getAudioCtor();
    if (!AudioCtor) { updateSoundUi(); return Promise.resolve(false); }
    try {
      audioContext = audioContext || new AudioCtor();
      audioMaster = audioMaster || audioContext.createGain();
      audioMaster.gain.value = soundVolume;
      audioMaster.connect(audioContext.destination);
      var resumed = audioContext.state === 'running' ? Promise.resolve() : audioContext.resume();
      return resumed.then(function () { audioUnlocked = true; soundEnabled = true; updateSoundUi(); return true; }).catch(function () { updateSoundUi(); return false; });
    } catch (error) { updateSoundUi(); return Promise.resolve(false); }
  }
  function setSoundVolume(value) {
    soundVolume = Math.max(0, Math.min(1, Number(value) || 0));
    if (audioMaster) audioMaster.gain.value = soundVolume;
    updateSoundUi();
  }
  function toggleSoundPanel(event) {
    if (event) event.stopPropagation();
    var panel = document.getElementById('sound-panel'); var control = document.getElementById('sound-control');
    if (!panel) return;
    var open = panel.classList.toggle('hidden');
    if (control) control.setAttribute('aria-expanded', open ? 'false' : 'true');
    if (!audioUnlocked) void unlockAudio().then(function (ready) { if (ready) { soundEnabled = true; playSound('toggle'); updateSoundUi(); } });
    updateSoundUi();
  }
  function toggleSound(event) {
    if (event) event.stopPropagation();
    if (!audioUnlocked) { void unlockAudio().then(function (ready) { if (ready) { soundEnabled = true; playSound('toggle'); updateSoundUi(); } }); return; }
    soundEnabled = !soundEnabled;
    if (!soundEnabled) stopActiveSounds();
    updateSoundUi();
    if (soundEnabled) playProcedural('toggle');
  }
  function audioCue(cue) { return (AUDIO.cues || []).find(function (item) { return item.cue === cue; }); }
  function playProcedural(cue) {
    if (!audioContext || !audioMaster || !soundEnabled || activeSources.length + activeProcedural.length + activePending >= 4) return;
    var now = audioContext.currentTime;
    var oscillator = audioContext.createOscillator(); var gain = audioContext.createGain();
    var frequency = cue === 'warning' ? 180 : cue === 'confirm' ? 880 : cue === 'toggle' ? 520 : 620;
    oscillator.type = cue === 'warning' ? 'sawtooth' : 'sine'; oscillator.frequency.setValueAtTime(frequency, now);
    if (cue === 'confirm') oscillator.frequency.exponentialRampToValueAtTime(1320, now + 0.08);
    gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(0.16, now + 0.008); gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    oscillator.connect(gain); gain.connect(audioMaster); activeProcedural.push(oscillator); oscillator.start(now); oscillator.onended = function () { activeProcedural = activeProcedural.filter(function (item) { return item !== oscillator; }); try { oscillator.disconnect(); } catch (error) { void error; } }; oscillator.stop(now + 0.13);
  }
  function playSound(cue) {
    void unlockAudio().then(function (ready) {
      if (!ready || !soundEnabled || !audioContext || !audioMaster) return;
      var asset = audioCue(cue);
      if (!asset) { playProcedural(cue); return; }
      if (activeSources.length + activeProcedural.length + activePending >= 4) return;
      activePending += 1;
      var decoded = audioBuffers[cue];
      var decodePromise = decoded ? Promise.resolve(decoded) : Promise.resolve().then(function () {
        var separator = asset.dataUri.indexOf(',');
        if (separator < 0 || asset.dataUri.slice(0, separator) !== 'data:audio/ogg;base64') throw new Error('Invalid embedded audio data URI');
        var encoded = asset.dataUri.slice(separator + 1);
        var binary = window.atob(encoded);
        var bytes = new Uint8Array(binary.length);
        for (var index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
        return audioContext.decodeAudioData(bytes.buffer);
      }).then(function (result) { audioBuffers[cue] = result; return result; });
      decodePromise.then(function (buffer) {
        activePending = Math.max(0, activePending - 1);
        if (!soundEnabled || !audioContext || !audioMaster || activeSources.length + activeProcedural.length >= 4) return;
        var source = audioContext.createBufferSource(); source.buffer = buffer; source.connect(audioMaster); activeSources.push(source);
        source.onended = function () {
          activeSources = activeSources.filter(function (item) { return item !== source; });
          try { source.disconnect(); } catch (error) { void error; }
        };
        source.start();
      }).catch(function () {
        activePending = Math.max(0, activePending - 1);
        playProcedural(cue);
      });
    });
  }
  function setState(next) { state = next; var pill = document.getElementById('state-pill'); if (pill) pill.textContent = next.toUpperCase() + ' / ' + (next === 'universe' ? 'MACRO' : next === 'system' ? 'MESO' : 'MICRO'); }
  function colorFor(cluster, fallback) { return cluster === null || cluster === undefined ? fallback : ['#18faf9','#4fa8ff','#a78bfa','#f472b6','#f59e0b','#34d399','#fb7185'][Math.abs(cluster) % 7]; }
  function nodeData(id) { return objectById[id]; }
  function regionFor(id) { var n = nodeData(id); return n && n.regionId ? systemById[n.regionId] : n; }

  function hideGraphLoading() {
    var loading = document.getElementById('graph-loading')
    if (loading) loading.style.display = 'none'
  }
  function showGraphFailure(message) {
    hideGraphLoading()
    var fallback = document.getElementById('graph-fallback')
    if (fallback) {
      fallback.classList.remove('hidden')
      fallback.textContent = message
    }
    setStatus('Text fallback active · graph data remains available')
  }

`
