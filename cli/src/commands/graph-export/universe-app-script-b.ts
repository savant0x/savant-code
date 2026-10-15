/**
 * Part B of the offline Code Universe browser app (graph construction and
 * planet effects). See universe-app-script.ts for the assembled payload.
 */
export const UNIVERSE_APP_SCRIPT_B = `  function buildGraph() {
    // Multiple source relationships can share a file pair (for example an
    // import plus a call); preserve each relationship instead of throwing on
    // a duplicate non-multigraph edge.
    graph = new Graphology({ multi: true, type: 'mixed' });
    DATA.universe.regions.forEach(function (r, index) {
      graph.addNode(r.id, { x: r.position.x, y: r.position.y, size: r.size, label: r.label, color: cyberColor(index), kind: 'region', path: r.path, fileCount: r.fileCount, edgeCount: r.edgeCount });
    });
    DATA.universe.files.forEach(function (f) {
      graph.addNode(f.id, { x: f.position.x, y: f.position.y, size: f.size, label: f.label, color: colorFor(f.cluster, '#a7b4d8'), kind: 'file', path: f.path, regionId: f.regionId, importance: f.importance, cluster: f.cluster });
    });
    DATA.universe.corridors.forEach(function (c) {
      if (graph.hasNode(c.source) && graph.hasNode(c.target)) graph.addEdge(c.source, c.target, { size: Math.min(8, 1 + Math.log1p(c.totalWeight)), color: '#4c9aa8', kind: 'corridor', label: c.edgeCount + ' relationships', weight: c.totalWeight });
    });
    DATA.universe.edges.forEach(function (e) {
      if (graph.hasNode(e.source) && graph.hasNode(e.target)) graph.addEdge(e.source, e.target, { size: Math.min(3, 0.5 + e.weight), color: '#6c82a8', kind: 'exact', label: e.type, weight: e.weight });
    });
    // Build navigation before renderer construction so region/path access still
    // works if WebGL context creation fails.
    buildRegionNav();
    sigma = new Sigma(graph, document.getElementById('sigma-container'), {
      renderLabels: true,
      labelColor: { color: '#dbeafe' },
      labelSize: 12,
      labelDensity: 0.08,
      labelGridCellSize: 80,
      labelRenderedSizeThreshold: 18,
      defaultDrawNodeHover: function () {},
      zIndex: true,
      nodeReducer: function (id, attrs) { return reduceNode(id, attrs); },
      edgeReducer: function (id, attrs) { return reduceEdge(id, attrs); },
    });
    sigma.on('clickNode', function (event) { navigateToObject(event.node); });
    sigma.on('clickEdge', function (event) { selectEdge(event.edge); });
    sigma.on('clickStage', function () {
      hideUniverseTooltip();
      setStatus(selected ? 'Selection preserved · choose another object or use Universe to reset' : 'Drag through the universe · select a system to enter its orbit')
    });
    sigma.on('enterNode', function (event) {
      var n = nodeData(event.node);
      if (n) { setStatus((n.label || n.path) + ' · click to enter'); showUniverseTooltip(n, event.node); }
    });
    sigma.on('leaveNode', function () { hideUniverseTooltip(); setStatus('Drag through the universe · select a system to enter its orbit'); });
    sigma.getCamera().on('updated', function () { updateZoomState(); drawPlanetEffects(); positionUniverseTooltip(); });
    hideGraphLoading();
    initializePlanetEffects();
    fitUniverseSilently();
    audioBootstrapping = false;
  }

  function cyberColor(index) { return ['#00f0ff', '#ff2bd6', '#7c5cff', '#00ff9d', '#ff5c8a', '#ffd166', '#39a0ff'][index % 7]; }
  function colorWithAlpha(hex, alpha) {
    var value = String(hex || '#18faf9').replace('#', '');
    if (value.length === 3) value = value.split('').map(function (c) { return c + c; }).join('');
    var number = parseInt(value, 16);
    return 'rgba(' + ((number >> 16) & 255) + ',' + ((number >> 8) & 255) + ',' + (number & 255) + ',' + alpha + ')';
  }
  function resizePlanetCanvas() {
    planetCanvas = planetCanvas || document.getElementById('planet-effects');
    if (!planetCanvas) return;
    var width = planetCanvas.clientWidth;
    var height = planetCanvas.clientHeight;
    var ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (planetCanvas.width !== Math.round(width * ratio) || planetCanvas.height !== Math.round(height * ratio)) {
      planetCanvas.width = Math.round(width * ratio);
      planetCanvas.height = Math.round(height * ratio);
    }
  }
  function drawPlanetBody(ctx, point, radius, color, pulse) {
    ctx.fillStyle = '#020611';
    ctx.beginPath(); ctx.arc(point.x, point.y, radius * 0.54, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 1.5 + pulse;
    ctx.strokeStyle = colorWithAlpha(color, 0.9);
    ctx.stroke();
    ctx.fillStyle = colorWithAlpha(color, 0.9);
    ctx.beginPath(); ctx.arc(point.x, point.y, 2.4 + pulse * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 14 + pulse * 12; ctx.shadowColor = color;
    ctx.beginPath(); ctx.arc(point.x, point.y, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
  function drawPlanetEffects() {
    if (!sigma) return;
    planetCanvas = planetCanvas || document.getElementById('planet-effects');
    if (!planetCanvas || typeof sigma.graphToViewport !== 'function') return;
    resizePlanetCanvas();
    var width = planetCanvas.clientWidth;
    var height = planetCanvas.clientHeight;
    var ratio = Math.min(window.devicePixelRatio || 1, 2);
    var ctx = planetCanvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    var pulse = reducedMotion ? 0.5 : (Math.sin(performance.now() / 900) + 1) / 2;
    DATA.universe.regions.forEach(function (region, index) {
      if (!graph.hasNode(region.id)) return;
      var attrs = graph.getNodeAttributes(region.id);
      var point = sigma.graphToViewport({ x: attrs.x, y: attrs.y });
      if (!point || point.x < -180 || point.x > width + 180 || point.y < -180 || point.y > height + 180) return;
      var radius = Math.max(25, Math.min(112, Math.sqrt(attrs.size || 20) * 10));
      var color = attrs.color || cyberColor(index);
      var halo = ctx.createRadialGradient(point.x, point.y, radius * 0.12, point.x, point.y, radius * 1.65);
      halo.addColorStop(0, colorWithAlpha(color, 0.22));
      halo.addColorStop(0.45, colorWithAlpha(color, 0.06));
      halo.addColorStop(1, colorWithAlpha(color, 0));
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(point.x, point.y, radius * 1.65, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.rotate((index * 0.71) + pulse * 0.08);
      ctx.setLineDash([radius * 0.22, radius * 0.11, radius * 0.06, radius * 0.18]);
      ctx.lineWidth = 1 + (index % 3) * 0.65;
      ctx.strokeStyle = colorWithAlpha(color, 0.65);
      ctx.beginPath(); ctx.arc(0, 0, radius * (1.18 + pulse * 0.04), 0.1, Math.PI * 1.75); ctx.stroke();
      ctx.setLineDash([radius * 0.08, radius * 0.24]);
      ctx.lineWidth = 0.7 + (index % 4) * 0.35;
      ctx.strokeStyle = colorWithAlpha(index % 2 ? '#ff2bd6' : '#00f0ff', 0.5);
      ctx.beginPath(); ctx.arc(0, 0, radius * 1.38, -1.7, 0.9); ctx.stroke();
      ctx.restore();
      // FID-2026-0807-008 F2: the ROOT region is the universe's brand
      // backdrop — render the Savant logo at the planet's core (inside the
      // ambient halo + orbit rings) instead of a generic planet body. Other
      // regions keep the procedural planet so the mark stays a single focal
      // point. Falls back to the procedural body while the image decodes.
      if (region.path === 'root') {
        if (!brandLogo) {
          // Reuse the header logo's data URI (the base64 constant is a
          // multi-line template literal; re-reading it from the DOM keeps the
          // app script a single-line-safe JS string and avoids a second
          // ~250 KB copy of the payload in the artifact).
          var headerLogo = document.querySelector('.logo');
          brandLogo = new Image();
          brandLogo.src = headerLogo ? headerLogo.getAttribute('src') : '';
        }
        if (brandLogo.complete && brandLogo.naturalWidth > 0) {
          var logoSize = radius * 1.32;
          ctx.save();
          if (ctx.filter !== undefined) ctx.filter = 'brightness(1.35) saturate(1.15)';
          ctx.shadowBlur = 24 + pulse * 12; ctx.shadowColor = color;
          ctx.drawImage(brandLogo, point.x - logoSize / 2, point.y - logoSize / 2, logoSize, logoSize);
          if (ctx.filter !== undefined) ctx.filter = 'none';
          ctx.lineWidth = 2 + pulse; ctx.strokeStyle = colorWithAlpha(color, 0.85);
          ctx.beginPath(); ctx.arc(point.x, point.y, logoSize / 2 + 2, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        } else {
          drawPlanetBody(ctx, point, radius, color, pulse);
        }
      } else {
        drawPlanetBody(ctx, point, radius, color, pulse);
      }
    });
  }
  function animatePlanetEffects() {
    if (document.hidden || reducedMotion) { motionFrame = 0; return; }
    drawPlanetEffects();
    motionFrame = requestAnimationFrame(animatePlanetEffects);
  }
  function initializePlanetEffects() {
    planetCanvas = document.getElementById('planet-effects');
    if (!planetCanvas) return;
    document.querySelector('.universe-shell').classList.toggle('motion-off', reducedMotion);
    window.addEventListener('resize', drawPlanetEffects);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (motionFrame) cancelAnimationFrame(motionFrame);
        motionFrame = 0;
      } else if (!reducedMotion && !motionFrame) {
        motionFrame = requestAnimationFrame(animatePlanetEffects);
      }
      drawPlanetEffects();
    });
    if (!reducedMotion && !motionFrame) motionFrame = requestAnimationFrame(animatePlanetEffects);
  }

`
