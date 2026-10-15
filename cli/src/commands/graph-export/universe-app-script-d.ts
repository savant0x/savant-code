/**
 * Part D of the offline Code Universe browser app (document and folder
 * browser rendering, focus views, navigation). See universe-app-script.ts
 * for the assembled payload.
 */
export const UNIVERSE_APP_SCRIPT_D = `  function renderDocument(file) {
    var root = document.getElementById('center-browser')
    if (!root) return
    var doc = documentsData && documentsData[file.id]
    if (
      doc === undefined &&
      DATA.universe.documentPolicy.enabled &&
      documentsData &&
      !Object.keys(documentsData).length
    ) {
      // Documents are enabled but the lazy payload has not finished decoding
      // yet — await it once, then render with the resolved body.
      void documentsReady.then(function () {
        var current = documentsData && documentsData[file.id]
        renderDocumentBody(file, current)
      })
      return
    }
    renderDocumentBody(file, doc)
  }
  function renderDocumentBody(file, doc) {
    var root = document.getElementById('center-browser')
    if (!root) return
    root.textContent = ''
    var header = document.createElement('div'); header.className = 'document-header'
    var toolbar = document.createElement('div'); toolbar.className = 'document-toolbar'
    var navigation = document.createElement('div'); navigation.className = 'document-navigation'; navigation.setAttribute('role', 'group'); navigation.setAttribute('aria-label', 'Document navigation')
    var back = browserButton('← BACK TO FOLDER', 'browser-back', 'document-back', '')
    back.onclick = function () { browserDocumentId = null; playSound('close'); renderCenterBrowser() }
    navigation.appendChild(back)
    toolbar.appendChild(navigation)
    var actionsSlot = document.getElementById('center-focus-actions')
    if (actionsSlot) actionsSlot.textContent = ''
    if (doc && doc.kind === 'text') {
      var copy = document.createElement('button'); copy.type = 'button'; copy.className = 'document-copy'
      copy.textContent = '⧉ COPY CONTENT'
      copy.onclick = function () { copyDocumentContent(file, doc) }
      if (actionsSlot) actionsSlot.appendChild(copy)
      var wrap = document.createElement('button'); wrap.type = 'button'; wrap.className = 'document-wrap-btn'; wrap.id = 'document-wrap-toggle'
      wrap.textContent = docWrapOff ? '⤼ NO WRAP' : '⤺ WRAP'; wrap.title = 'Toggle line wrapping'
      wrap.onclick = function () { toggleDocWrap(wrap) }
      toolbar.appendChild(wrap)
    }
    var sibs = siblingFiles()
    var sibIndex = sibs.indexOf(file)
    if (sibs.length > 1) {
      var prev = browserButton('← PREV FILE', 'browser-back', 'doc-prev', '')
      prev.disabled = sibIndex <= 0
      prev.onclick = function () { browserDocumentId = sibs[sibIndex - 1].id; playSound('open'); renderDocument(nodeData(browserDocumentId)) }
      var next = browserButton('NEXT FILE →', 'browser-back', 'doc-next', '')
      next.disabled = sibIndex < 0 || sibIndex >= sibs.length - 1
      next.onclick = function () { browserDocumentId = sibs[sibIndex + 1].id; playSound('open'); renderDocument(nodeData(browserDocumentId)) }
      navigation.appendChild(prev); navigation.appendChild(next)
    }
    header.appendChild(toolbar)
    var title = document.createElement('h2'); title.textContent = file.label
    var metaBadge = document.createElement('span'); metaBadge.className = 'document-file-meta'
    if (doc && doc.kind === 'text') {
      metaBadge.textContent = '[' + doc.lineCount + ' lines' + (doc.truncated ? ' · truncated' : '') + ' · ' + doc.byteCount + ' bytes' + (doc.explicitlyCapped ? ' · explicit cap' : '') + ']'
    } else if (doc && doc.kind === 'image') {
      metaBadge.textContent = '[' + doc.mime + ' · ' + doc.byteCount + ' bytes]'
    } else {
      metaBadge.textContent = '[' + (DATA.universe.documentPolicy.enabled ? 'content unavailable' : 'documents disabled') + ']'
    }
    title.appendChild(metaBadge)
    header.appendChild(title)
    var pathEl = document.createElement('code'); pathEl.textContent = file.path; header.appendChild(pathEl)
    var crumbs = document.createElement('nav'); crumbs.className = 'document-breadcrumb'; crumbs.setAttribute('aria-label', 'File path')
    var segments = String(file.path || '').split('/').filter(Boolean)
    var acc = ''
    segments.forEach(function (segment, index) {
      var isLast = index === segments.length - 1
      if (index > 0) {
        var sep = document.createElement('span'); sep.className = 'document-breadcrumb-sep'; sep.textContent = '/'
        crumbs.appendChild(sep)
      }
      if (isLast) {
        var leaf = document.createElement('span'); leaf.className = 'document-breadcrumb-leaf'; leaf.textContent = segment
        crumbs.appendChild(leaf)
      } else {
        acc = acc ? acc + '/' + segment : segment
        var folder = folderByPath[acc]
        var crumb = document.createElement('button'); crumb.type = 'button'; crumb.className = 'document-breadcrumb-folder'
        crumb.textContent = segment
        crumb.onclick = function () {
          if (folder) navigateToFolder(folder)
          else setStatus('Folder not exported in this universe')
        }
        crumbs.appendChild(crumb)
      }
    })
    header.appendChild(crumbs)
    root.appendChild(header)
    updateWindowTitle(document.getElementById('center-focus'))
    if (doc && doc.kind === 'text' && doc.explicitlyCapped && doc.truncated) {
      var banner = document.createElement('div'); banner.className = 'document-preview-banner'
      banner.setAttribute('role', 'note')
      var glyph = document.createElement('span'); glyph.className = 'document-preview-glyph'; glyph.textContent = 'i'
      banner.appendChild(glyph)
      banner.appendChild(document.createTextNode(' TEXT CAPPED BY EXPLICIT EXPORT LIMIT — showing ' + doc.lineCount + ' lines from ' + formatBytes(doc.byteCount) + '.'))
      root.appendChild(banner)
    }
    var surface = document.createElement('div'); surface.className = 'document-surface'
    if (docWrapOff) surface.classList.add('wrap-off')
    if (doc && doc.kind === 'text') {
      if (doc.lineCount > LARGE_DOCUMENT_LINE_THRESHOLD) {
        var largeNote = document.createElement('div'); largeNote.className = 'large-document-note'; largeNote.textContent = 'LINE NUMBERS HIDDEN FOR LARGE FILE · ' + doc.lineCount + ' LINES'
        surface.appendChild(largeNote)
        var pre = document.createElement('pre'); pre.className = 'document-compact-text'; pre.textContent = doc.text
        surface.appendChild(pre)
      } else {
        doc.text.split(String.fromCharCode(10)).forEach(function (line, index) {
          var row = document.createElement('div'); row.className = 'document-line'
          var number = document.createElement('span'); number.className = 'document-line-number'; number.textContent = String(index + 1)
          var content = document.createElement('code'); content.textContent = line
          row.appendChild(number); row.appendChild(content); surface.appendChild(row)
        })
      }
    } else if (doc && doc.kind === 'image') {
      var image = document.createElement('img')
      image.className = 'document-image'
      image.src = doc.dataUri
      image.alt = file.path
      image.loading = 'eager'
      image.onerror = function () {
        playSound('warning')
        image.remove()
        var failedImage = document.createElement('div')
        failedImage.className = 'document-unavailable'
        var glyph = document.createElement('span'); glyph.className = 'document-unavailable-glyph'; glyph.textContent = '⚠'
        var strong = document.createElement('strong'); strong.textContent = 'DOCUMENT UNAVAILABLE'
        var hint = document.createElement('small'); hint.textContent = 'The embedded image could not be decoded by this browser.'
        failedImage.appendChild(glyph); failedImage.appendChild(strong); failedImage.appendChild(hint)
        surface.appendChild(failedImage)
      }
      surface.appendChild(image)
    } else {
      var reason = doc && doc.kind === 'unavailable' ? doc.unavailableReason : 'disabled'
      var unavailable = document.createElement('div'); unavailable.className = 'document-unavailable'
      var glyph = document.createElement('span'); glyph.className = 'document-unavailable-glyph'
      glyph.textContent = reason === 'binary' ? '◇' : '◌'
      var strong = document.createElement('strong')
      strong.textContent = reason === 'binary' ? 'BINARY CONTENT NOT EXPORTED' : reason === 'disabled' ? 'DOCUMENT NOT EXPORTED' : 'DOCUMENT UNAVAILABLE'
      var hint = document.createElement('small')
      hint.textContent = reason === 'binary'
        ? 'This file is binary or uses an unsupported format. Text documents are unlimited by default; binary media remains protected.'
        : reason === 'disabled'
          ? 'Document content is disabled for this export. Enable documents when exporting to read it here.'
          : 'The document could not be read safely from the project root.'
      unavailable.appendChild(glyph); unavailable.appendChild(strong); unavailable.appendChild(hint)
      if (doc && doc.byteCount) {
        var size = document.createElement('small'); size.className = 'document-size-note'
        size.textContent = 'Source file: ' + formatBytes(doc.byteCount)
        unavailable.appendChild(size)
      }
      surface.appendChild(unavailable)
    }
    root.appendChild(surface)
  }
  function renderCenterBrowser() {
    var focus = document.getElementById('center-focus'); var root = document.getElementById('center-browser')
    if (!focus || !root) return
    focus.classList.remove('hidden'); root.textContent = ''
    var actionsSlot = document.getElementById('center-focus-actions')
    if (actionsSlot) actionsSlot.textContent = ''
    if (browserDocumentId) { renderDocument(nodeData(browserDocumentId)); return }
    var folder = folderById[browserFolderId || DATA.universe.rootFolderId]
    if (!folder) return
    var heading = document.createElement('div'); heading.className = 'browser-heading'
    var eyebrow = document.createElement('div'); eyebrow.className = 'eyebrow'; eyebrow.textContent = 'CODE EXPLORER / FOLDER'; heading.appendChild(eyebrow)
    var title = document.createElement('h2'); title.textContent = folder.label; heading.appendChild(title)
    var pathEl = document.createElement('code'); pathEl.textContent = folder.path || '/'; heading.appendChild(pathEl); root.appendChild(heading)
    updateWindowTitle(focus)
    var children = folderChildren(folder); var pageSize = folder.parentId ? 118 : 119
    var start = browserPage * pageSize; var visible = children.slice(start, start + pageSize)
    var grid = document.createElement('div'); grid.className = children.length === 1 ? 'browser-grid single' : 'browser-grid'
    if (folder.parentId) {
      var up = browserButton('↑ UP / BACK', 'browser-card browser-up', 'up', '')
      up.onclick = function () { browserFolderId = folder.parentId; browserPage = 0; playSound('close'); renderCenterBrowser() }; grid.appendChild(up)
    }
    visible.forEach(function (child) {
      var isFolder = !!child.childIds
      var card = browserButton((isFolder ? '◈ ' : '✦ ') + (child.label || child.path), 'browser-card ' + (isFolder ? 'folder-card' : 'file-card'), isFolder ? 'folder' : 'file', child.id)
      var detail = document.createElement('small'); detail.textContent = isFolder ? ((child.childIds || []).length + ' items') : (child.path || '')
      card.appendChild(detail)
      card.onclick = function () { if (isFolder) { browserFolderId = child.id; browserPage = 0; playSound('open'); renderCenterBrowser() } else { browserDocumentId = child.id; playSound('open'); renderCenterBrowser() } }
      grid.appendChild(card)
    })
    if (!visible.length) { var empty = document.createElement('div'); empty.className = 'browser-empty'; empty.textContent = 'EMPTY ORBIT · NO CHILDREN EXPORTED'; grid.appendChild(empty) }
    if (start + pageSize < children.length) {
      var next = browserButton('MORE / NEXT →', 'browser-card browser-next', 'next', '')
      next.onclick = function () { browserPage += 1; renderCenterBrowser() }; grid.appendChild(next)
    }
    root.appendChild(grid)
  }
  function renderFocusView(n, kind) {
    var isSystem = n.fileCount !== undefined
    browserFolderId = isSystem ? (DATA.universe.folders || []).find(function (folder) { return folder.path === n.path })?.id : folderForFile(n.id)?.id
    browserFolderId = browserFolderId || DATA.universe.rootFolderId
    browserDocumentId = isSystem ? null : n.id
    browserPage = 0
    renderCenterBrowser()
  }
  function clearFocusView() {
    var focus = document.getElementById('center-focus')
    if (focus) focus.classList.add('hidden')
  }
  function fitUniverse() {
    fitUniverseInternal(false)
  }
  function fitUniverseSilently() {
    fitUniverseInternal(true)
  }
  function fitUniverseInternal(silent) {
    if (sigma) sigma.getCamera().animatedReset({ duration: reducedMotion ? 0 : 700 })
    setState('universe')
    selected = null
    selectedRegion = null
    document.querySelectorAll('.region-row').forEach(function (row) { row.classList.remove('active') })
    document.querySelectorAll('.region-nav [data-nav-id]').forEach(function (el) { el.classList.remove('nav-active') })
    refresh()
    drawPlanetEffects()
    hideUniverseTooltip()
    closeSidebar(silent)
    clearFocusView()
  }
  function resetUniverse() {
    fitUniverse()
    setStatus('Universe restored · select a system to enter its orbit')
  }
  function updateZoomState() {
    if (!sigma) return
    var ratio = sigma.getCamera().getState().ratio
    if (state === 'universe' && ratio < 0.62) {
      setState('system')
      refresh()
    } else if (state === 'system' && ratio > 0.86 && !selected) {
      setState('universe')
      refresh()
    } else if (state === 'system' && ratio < 0.32) {
      setState('neighborhood')
      refresh()
    } else if (state === 'neighborhood' && ratio > 0.48) {
      setState('system')
      refresh()
    }
  }
  function navigateToObject(id) {
    navigateToObjectWithCue(id, 'open')
  }
  function navigateToObjectWithCue(id, cue) {
    var n = nodeData(id)
    if (!n) {
      setStatus('That universe object is no longer available')
      return
    }
    selected = id
    var region = regionFor(id)
    selectedRegion = region && region.id
    document.querySelectorAll('.region-row').forEach(function (row) {
      row.classList.toggle('active', row.dataset.regionId === String(region && region.id))
    })
    highlightNav(id)
    playSound(cue || 'open')
    if (n.fileCount !== undefined) {
      setState('system')
      openSidebar(n, 'SYSTEM')
      renderFocusView(n, 'SYSTEM ORBIT')
      setStatus('Entering orbit of ' + n.label)
      fitSelection(id)
    } else {
      setState('detail')
      openSidebar(n, 'FILE')
      renderFocusView(n, 'FILE NODE')
      setStatus('Inspecting ' + n.path)
      fitSelection(id)
    }
    if (n.fileCount === undefined) revealInNav(id)
    refresh()
    drawPlanetEffects()
  }
  function selectEdge(id) {
    if (!graph || !graph.hasEdge(id)) return;
    var ext = graph.extremities(id);
    var attrs = graph.getEdgeAttributes(id);
    navigateToObject(ext[0]);
    setStatus((attrs.label || 'Relationship') + ' · connected path selected');
  }
`
