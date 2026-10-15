/**
 * Part C of the offline Code Universe browser app (node/edge reducers,
 * selection and camera helpers, browser data helpers). See
 * universe-app-script.ts for the assembled payload.
 */
export const UNIVERSE_APP_SCRIPT_C = `  function reduceNode(id, attrs) {
    var data = nodeData(id);
    var result = Object.assign({}, attrs);
    if (!data) return result;
    result.hidden = false;
    if (data.kind === 'region' || data.fileCount !== undefined) {
      result.color = attrs.color || '#00f0ff'; result.size = attrs.size || 20; result.label = attrs.label; result.zIndex = selected === id ? 12 : 2;
      if (selected && selected !== id && !isContextNode(id)) result.alpha = 0.28;
      // FID-2026-0807-009 F9: the ROOT region's ambient emblem (logo planet)
      // is the backdrop — shrink its sigma node to a dim dot so the node
      // circle + label never cover the mark. Still clickable via dot + nav.
      if (data.kind === 'region' && data.path === 'root' && selected !== id && state !== 'detail') {
        result.size = 4; result.label = ''; result.alpha = 0.32; result.zIndex = 1;
      }
    } else {
      result.color = attrs.color || '#a7b4d8'; result.size = attrs.size || 4; result.label = state === 'neighborhood' || state === 'detail' ? attrs.label : '';
      if (selected && id !== selected && !isContextNode(id)) { result.color = '#182540'; result.alpha = 0.2; }
    }
    if (selected === id) { result.color = '#ffffff'; result.size = (attrs.size || 5) * 1.8; result.zIndex = 10; result.alpha = 1; }
    return result;
  }
  function reduceEdge(id, attrs) {
    var result = Object.assign({}, attrs);
    var ext = graph.extremities(id); var corridor = attrs.kind === 'corridor';
    result.hidden = false;
    if (state === 'universe') { result.hidden = !corridor; result.size = corridor ? attrs.size : 0; result.color = corridor ? '#00dbe8' : '#314463'; result.alpha = corridor ? 0.82 : 0; }
    else if (state === 'system') { result.alpha = isContextEdge(ext) ? (corridor ? 0.72 : 0.78) : 0.12; result.color = isContextEdge(ext) ? (corridor ? '#00e5f5' : '#5898bd') : '#17243b'; }
    else { result.alpha = isRelevantEdge(ext) ? 0.98 : 0.1; result.color = isRelevantEdge(ext) ? '#8eeeff' : '#25344f'; }
    return result;
  }
  function isNeighbor(id, root) { return graph.hasNode(root) && graph.hasEdge(root, id); }
  function isContextNode(id) {
    if (!selected) return true;
    if (id === selected) return true;
    var data = nodeData(id);
    var region = regionFor(selected);
    if (!data || !region) return false;
    if (data.kind === 'region' || data.fileCount !== undefined) return true;
    return data.regionId === region.id || (state === 'detail' && isNeighbor(id, selected));
  }
  function isInSelectedSystem(ext) { var r = selected && regionFor(selected); return !!r && ext.some(function (id) { return id === r.id || (nodeData(id) && nodeData(id).regionId === r.id); }); }
  function isContextEdge(ext) { return isInSelectedSystem(ext) || (selected && ext.indexOf(selected) >= 0); }
  function isRelevantEdge(ext) { return selected ? ext.indexOf(selected) >= 0 || isInSelectedSystem(ext) : true; }
  function refresh() { if (sigma) sigma.refresh(); }
  function animateTo(id, ratio) {
    if (!sigma || !graph || !graph.hasNode(id)) return
    var attrs = graph.getNodeAttributes(id)
    sigma.getCamera().animate(
      { x: attrs.x, y: attrs.y, ratio: ratio },
      { duration: reducedMotion ? 0 : 850 },
    )
  }
  function selectionNodes(id) {
    // FID-2026-0807-020: callback iteration instead of graph.nodes().filter()
    // so selection framing never allocates a full node-key array per call.
    if (!graph || !graph.hasNode(id)) return []
    var target = nodeData(id)
    if (!target) return []
    var ids = []
    if (target.kind === 'region' || target.fileCount !== undefined) {
      graph.forEachNode(function (nodeId) {
        var data = nodeData(nodeId)
        if (nodeId === id || (data && data.regionId === id)) ids.push(nodeId)
      })
    } else {
      ids = [id]
      graph.forEachNeighbor(id, function (nodeId) {
        var data = nodeData(nodeId)
        if (!!data && (data.kind === 'region' || data.regionId === target.regionId)) ids.push(nodeId)
      })
    }
    return ids.filter(function (nodeId) {
      var attrs = graph.getNodeAttributes(nodeId)
      return attrs && Number.isFinite(attrs.x) && Number.isFinite(attrs.y)
    })
  }
  function fitSelection(id) {
    if (!sigma || !graph || !graph.hasNode(id)) return
    var ids = selectionNodes(id)
    if (!ids.length) { animateTo(id, 0.5); return }
    var bounds = ids.reduce(function (result, nodeId) {
      var attrs = graph.getNodeAttributes(nodeId)
      return {
        minX: Math.min(result.minX, attrs.x), maxX: Math.max(result.maxX, attrs.x),
        minY: Math.min(result.minY, attrs.y), maxY: Math.max(result.maxY, attrs.y),
      }
    }, { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity })
    var spanX = Math.max(bounds.maxX - bounds.minX, 120)
    var spanY = Math.max(bounds.maxY - bounds.minY, 120)
    var viewport = document.getElementById('sigma-container')
    var width = Math.max(viewport ? viewport.clientWidth : 0, 480)
    var height = Math.max(viewport ? viewport.clientHeight : 0, 360)
    var camera = sigma.getCamera()
    var current = camera.getState()
    var ratio = current.ratio
    try {
      var a = sigma.graphToViewport({ x: bounds.minX, y: bounds.minY })
      var b = sigma.graphToViewport({ x: bounds.maxX, y: bounds.maxY })
      var scaleX = Math.abs(b.x - a.x) / spanX
      var scaleY = Math.abs(b.y - a.y) / spanY
      var projected = Math.max(spanX * (scaleX || 0), spanY * (scaleY || 0))
      var available = Math.max(Math.min(width, height) - 96, 240)
      ratio = current.ratio * Math.max(projected / available, 0.08) * 1.18
    } catch (error) {
      ratio = ids.length === 1 ? 0.3 : 0.5
      setStatus('Selection framing fallback · orbit remains available')
      void error
    }
    ratio = Math.max(0.06, Math.min(1.15, ratio))
    camera.animate(
      { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2, ratio: ratio },
      { duration: reducedMotion ? 0 : 850 },
    )
  }
  function browserButton(label, className, action, text) {
    var button = document.createElement('button')
    button.type = 'button'
    button.className = className
    button.dataset.browserAction = action || ''
    if (action === 'folder') button.dataset.folderId = text
    if (action === 'file') button.dataset.fileId = text
    button.textContent = label
    return button
  }
  function folderChildren(folder) {
    return (folder.childIds || []).map(function (id) {
      return folderById[id] || nodeData(id)
    }).filter(Boolean)
  }
  function folderForFile(fileId) {
    if (!nodeData(fileId)) return folderById[DATA.universe.rootFolderId]
    return (DATA.universe.folders || []).find(function (folder) {
      return (folder.childIds || []).indexOf(fileId) >= 0
    }) || folderById[DATA.universe.rootFolderId]
  }
  function formatBytes(n) {
    if (!n) return ''
    return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n >= 1024 ? Math.round(n / 1024) + ' KB' : n + ' B'
  }
  function siblingFiles() {
    var folder = folderById[browserFolderId || DATA.universe.rootFolderId]
    if (!folder || !folder.childIds) return []
    var out = []
    folder.childIds.forEach(function (id) {
      var child = nodeData(id)
      if (child && !child.childIds) out.push(child)
    })
    return out
  }
`
