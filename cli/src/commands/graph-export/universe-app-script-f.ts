/**
 * Part F of the offline Code Universe browser app (sidebar, region tree,
 * keyboard navigation). See universe-app-script.ts for the assembled
 * payload.
 */
export const UNIVERSE_APP_SCRIPT_F = `  function openSidebar(n, kind) {
    var side = document.getElementById('graph-sidebar'); side.classList.remove('hidden');
    document.getElementById('sidebar-kind').textContent = kind || 'SELECTED OBJECT';
    document.getElementById('sidebar-title').textContent = n.label || n.path;
    document.getElementById('sidebar-path').textContent = n.path || '';
    var metrics = document.getElementById('sidebar-metrics'); metrics.textContent = '';
    var values = n.fileCount !== undefined ? [['FILES', n.fileCount], ['EDGES', n.edgeCount], ['STATUS', n.disconnected ? 'ISOLATED' : 'CONNECTED']] : [['REGION', (regionFor(n.id) || {}).label || '—'], ['IMPORTANCE', Math.round((n.importance || 0) * 100) + '%'], ['CLUSTER', n.cluster === null || n.cluster === undefined ? '—' : n.cluster]];
    values.forEach(function (pair) { var item = document.createElement('span'); item.textContent = pair[0] + ' ' + pair[1]; metrics.appendChild(item); });
    var list = document.getElementById('sidebar-connections'); list.textContent = '';
    var neighbors = graph && graph.hasNode(n.id) ? graph.neighbors(n.id).slice(0, 12) : [];
    if (!neighbors.length) { var empty = document.createElement('li'); empty.textContent = 'No direct connections'; list.appendChild(empty); }
    updateSoundUi();
    neighbors.forEach(function (id) { var li = document.createElement('li'); var other = nodeData(id); li.textContent = other ? (other.path || other.label) : id; list.appendChild(li); });
    document.getElementById('sidebar-preview').textContent = n.preview || 'No preview (previews are opt-in at export time).';
    updateWindowTitle(side);
  }
  function closeSidebar(silent) {
    document.getElementById('graph-sidebar').classList.add('hidden')
    clearFocusView()
    if (!silent && !audioBootstrapping) playSound('close')
  }
  function buildRegionNav() {
    var root = document.getElementById('region-list'); root.textContent = '';
    DATA.universe.regions.forEach(function (r, index) {
      var item = document.createElement('div'); item.className = 'region-item'
      var row = document.createElement('button'); row.type = 'button'; row.className = 'region-row'; row.dataset.regionId = r.id; row.id = 'region-row-' + index
      var tree = regionRootTree(r)
      var hasChildren = Object.keys(tree.folders).length > 0 || tree.files.length > 0
      var chevron = document.createElement('span'); chevron.className = 'region-chevron'; chevron.textContent = hasChildren ? '▸' : ''
      var label = document.createElement('span'); label.className = 'region-label'; label.textContent = r.label
      var count = document.createElement('span'); count.className = 'region-count'; count.textContent = String(r.fileCount)
      row.appendChild(chevron); row.appendChild(label); row.appendChild(count)
      row.onclick = function () { navigateToObject(r.id); toggleRegionFiles(item, r); navKeyFocusRow(row) }
      item.appendChild(row)
      var list = document.createElement('div'); list.className = 'region-files hidden'; list.id = 'region-files-' + index
      if (hasChildren) { row.setAttribute('aria-expanded', 'false'); row.setAttribute('aria-controls', list.id); }
      item.appendChild(list)
      root.appendChild(item)
    })
  }
  // Trees are folded once per region and rendered level-by-level on expand
  // so a repo with many large regions never pays DOM cost up front.
  function regionSkipSegments(region) {
    if (region.path === 'root') return 0
    return String(region.path || '').split('/').filter(Boolean).length
  }
  function regionRootTree(region) {
    if (!regionTrees[region.id]) {
      regionTrees[region.id] = buildRegionTree(filesByRegion[region.id] || [], regionSkipSegments(region))
    }
    return regionTrees[region.id]
  }
  function buildRegionTree(files, skipSegments) {
    var root = { name: '', path: '', relPath: '', folders: {}, files: [] }
    files.forEach(function (f) {
      var parts = f.path.split('/').filter(Boolean)
      var relParts = parts.slice(skipSegments)
      var node = root
      var full = ''
      var rel = ''
      for (var i = skipSegments; i < parts.length - 1; i++) {
        full = full ? full + '/' + parts[i] : parts[i]
        var relKey = relParts[i - skipSegments]
        rel = rel ? rel + '/' + relKey : relKey
        var child = node.folders[relKey] || (node.folders[relKey] = { name: relKey, path: full, relPath: rel, folders: {}, files: [] })
        node = child
      }
      node.files.push(f)
    })
    return root
  }
  var LEVEL_CAP = 60
  function toggleRegionFiles(item, region) {
    var list = item.querySelector('.region-files')
    var row = item.querySelector('.region-row')
    if (!list) return
    var tree = regionRootTree(region)
    if (Object.keys(tree.folders).length === 0 && tree.files.length === 0) return
    if (!list.children.length) renderTreeLevel(list, tree)
    var open = list.classList.toggle('hidden')
    var chevron = item.querySelector('.region-chevron')
    if (chevron) chevron.textContent = open ? '▸' : '▾'
    if (row) row.setAttribute('aria-expanded', open ? 'false' : 'true')
    playSound(open ? 'close' : 'open')
  }
  function renderTreeLevel(container, node) {
    var folderKeys = Object.keys(node.folders || {}).sort()
    var files = (node.files || []).slice().sort(function (a, b) { return a.label.localeCompare(b.label) })
    var shown = 0
    folderKeys.forEach(function (key) {
      if (shown >= LEVEL_CAP) return
      shown += 1
      renderFolderRow(container, node.folders[key])
    })
    files.forEach(function (f) {
      if (shown >= LEVEL_CAP) return
      shown += 1
      renderFileRow(container, f)
    })
    if (folderKeys.length + files.length > LEVEL_CAP) {
      var more = document.createElement('div'); more.className = 'region-more'
      more.textContent = '+' + (folderKeys.length + files.length - LEVEL_CAP) + ' more in explorer'
      container.appendChild(more)
    }
  }
  function renderFolderRow(container, node) {
    var row = document.createElement('button'); row.type = 'button'; row.className = 'region-tree-folder'
    var folder = folderByPath[node.path]
    row.dataset.treePath = node.relPath
    if (folder) row.dataset.navId = folder.id
    var chevron = document.createElement('span'); chevron.className = 'region-chevron'; chevron.textContent = '▸'
    var name = document.createElement('span'); name.className = 'region-tree-name'; name.textContent = node.name
    var count = document.createElement('span'); count.className = 'region-count'
    count.textContent = String(Object.keys(node.folders).length + node.files.length)
    row.appendChild(chevron); row.appendChild(name); row.appendChild(count)
    var rowSeq = (navRowCounter += 1)
    row.id = 'region-tree-' + rowSeq + '-row'
    var list = document.createElement('div'); list.className = 'region-files hidden'; list.id = 'region-tree-' + rowSeq
    row.setAttribute('aria-expanded', 'false'); row.setAttribute('aria-controls', list.id)
    row.onclick = function () {
      if (folder) navigateToFolder(folder)
      toggleFolderRow(row, node)
      navKeyFocusRow(row)
    }
    container.appendChild(row); container.appendChild(list)
  }
  function renderFileRow(container, file) {
    var button = document.createElement('button'); button.type = 'button'; button.className = 'region-file'
    button.dataset.navId = file.id
    button.id = 'region-file-' + (navRowCounter += 1)
    var name = document.createElement('span'); name.className = 'region-file-name'; name.textContent = file.label
    button.appendChild(name)
    button.onclick = function () { navigateToObjectWithCue(file.id, 'open'); navKeyFocusRow(button) }
    container.appendChild(button)
  }
  function toggleFolderRow(row, node) {
    var list = row.parentElement ? row.parentElement.querySelector('.region-files') : null
    if (!list) return
    if (!list.children.length) renderTreeLevel(list, node)
    var open = list.classList.toggle('hidden')
    var chevron = row.querySelector('.region-chevron')
    if (chevron) chevron.textContent = open ? '▸' : '▾'
    row.setAttribute('aria-expanded', open ? 'false' : 'true')
    playSound(open ? 'close' : 'open')
  }
  // Keyboard navigation over the visible tree rows (FID-2026-0807-014 F5):
  // ArrowUp/Down move focus across region/folder/file rows in DOM order,
  // ArrowRight expands the focused collapsible, ArrowLeft collapses or moves
  // up to its parent row. Rows hidden by a collapsed ancestor are skipped.
  function regionNavRows() {
    return Array.prototype.slice.call(document.querySelectorAll('.region-nav .region-row, .region-nav .region-tree-folder, .region-nav .region-file')).filter(function (row) {
      return row.offsetParent !== null
    })
  }
  function nextRegionList(row) {
    var next = row.nextElementSibling
    return next && next.classList.contains('region-files') ? next : null
  }
  function treeNodeForFolderRow(row) {
    var item = row.closest ? row.closest('.region-item') : null
    var regionRow = item ? item.querySelector('.region-row') : null
    var region = regionRow && systemById[regionRow.dataset.regionId]
    var tree = region ? regionRootTree(region) : null
    if (!tree) return null
    var node = tree
    String(row.dataset.treePath || '').split('/').filter(Boolean).forEach(function (part) {
      if (node) node = node.folders[part]
    })
    return node || null
  }
  function navKeyFocusRow(row) {
    var rows = regionNavRows()
    rows.forEach(function (r) { r.classList.toggle('nav-key-focus', r === row) })
    if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' })
    var list = document.getElementById('region-list')
    if (list) list.setAttribute('aria-activedescendant', row && row.id ? row.id : '')
  }
  // Collapse-all / expand-all (FID-2026-0807-014 F6). Expand-all walks each
  // region tree to depth 2 (capped at the existing LEVEL_CAP per level);
  // collapse-all re-hides every region-files container and resets chevrons.
  function expandAllRegions() {
    document.querySelectorAll('.region-item').forEach(function (item) {
      var row = item.querySelector('.region-row')
      var list = item.querySelector('.region-files')
      if (!row || !list) return
      var region = systemById[row.dataset.regionId]
      if (!region) return
      if (!list.children.length) renderTreeLevel(list, regionRootTree(region))
      list.classList.remove('hidden')
      var chevron = item.querySelector('.region-chevron')
      if (chevron && chevron.textContent === '▸') chevron.textContent = '▾'
      row.setAttribute('aria-expanded', 'true')
      expandTreeFolders(list, 2)
    })
    playSound('open')
    setStatus('All systems expanded')
  }
  function expandTreeFolders(container, depth) {
    if (depth <= 0) return
    Array.prototype.slice.call(container.children).forEach(function (row) {
      if (!row.classList.contains('region-tree-folder')) return
      var list = row.nextElementSibling
      var node = treeNodeForFolderRow(row)
      if (!list || !list.classList.contains('region-files') || !node) return
      if (!list.children.length) renderTreeLevel(list, node)
      list.classList.remove('hidden')
      var chevron = row.querySelector('.region-chevron')
      if (chevron && chevron.textContent === '▸') chevron.textContent = '▾'
      row.setAttribute('aria-expanded', 'true')
      expandTreeFolders(list, depth - 1)
    })
  }
  function collapseAllRegions() {
    document.querySelectorAll('.region-files').forEach(function (list) { list.classList.add('hidden') })
    document.querySelectorAll('.region-chevron').forEach(function (chevron) {
      if (chevron.textContent === '▾') chevron.textContent = '▸'
    })
    document.querySelectorAll('.region-row, .region-tree-folder').forEach(function (row) {
      row.setAttribute('aria-expanded', 'false')
    })
    // Drop the keyboard focus marker too — its row just became invisible, so
    // the next ArrowDown/Up restarts from the top instead of jumping stale.
    document.querySelectorAll('.region-nav .nav-key-focus').forEach(function (row) {
      row.classList.remove('nav-key-focus')
    })
    playSound('close')
    setStatus('All systems collapsed')
  }
  function navigateToFolder(folder) {
    browserFolderId = folder.id
    browserDocumentId = null
    browserPage = 0
    setState('detail')
    playSound('open')
    selected = folder.id
    highlightNav(folder.id)
    renderCenterBrowser()
    refresh()
    setStatus('Exploring ' + (folder.path || folder.label))
  }
  function highlightNav(id) {
    var target = String(id)
    document.querySelectorAll('.region-nav [data-nav-id]').forEach(function (el) {
      el.classList.toggle('nav-active', el.dataset.navId === target)
    })
  }
  function revealInNav(id) {
    var n = nodeData(id)
    if (!n || n.fileCount !== undefined) return
    var region = regionFor(id)
    if (!region) return
    var item = null
    var items = document.querySelectorAll('.region-item')
    for (var i = 0; i < items.length; i++) {
      var regionRow = items[i].querySelector('.region-row')
      if (regionRow && regionRow.dataset.regionId === String(region.id)) { item = items[i]; break }
    }
    if (!item) return
    var row = item.querySelector('.region-row')
    if (row && row.getAttribute('aria-expanded') === 'false') toggleRegionFiles(item, region)
    var parts = String(n.path || '').split('/').filter(Boolean).slice(regionSkipSegments(region))
    var acc = ''
    var node = regionTrees[region.id]
    for (var j = 0; j < parts.length - 1; j++) {
      acc = acc ? acc + '/' + parts[j] : parts[j]
      node = node && node.folders[parts[j]]
      var folderRow = item.querySelector('.region-tree-folder[data-tree-path=\"' + acc + '\"]')
      if (!folderRow || !node) return
      if (folderRow.getAttribute('aria-expanded') === 'false') toggleFolderRow(folderRow, node)
    }
    var target = item.querySelector('[data-nav-id=\"' + id + '\"]')
    if (target && target.scrollIntoView) target.scrollIntoView({ block: 'nearest' })
  }
`
