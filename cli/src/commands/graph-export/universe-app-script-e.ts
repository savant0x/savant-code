/**
 * Part E of the offline Code Universe browser app (search cluster,
 * clipboard helpers, document wrap toggle). See universe-app-script.ts for
 * the assembled payload.
 */
export const UNIVERSE_APP_SCRIPT_E = `  function searchScore(entry, query) {
    var label = (entry.label || '').toLowerCase();
    var path = (entry.path || '').toLowerCase();
    var segments = path.split('/');
    if (label === query) return 100;
    if (label.indexOf(query) === 0) return 80;
    if (segments.indexOf(query) >= 0) return 60;
    if (label.indexOf(query) >= 0) return 45;
    if ((segments[segments.length - 1] || '').indexOf(query) >= 0) return 30;
    if (path.indexOf(query) >= 0) return 20;
    return 0;
  }
  function kindOrder(kind) { return kind === 'system' ? 0 : kind === 'folder' ? 1 : 2; }
  function kindGlyph(kind) { return kind === 'system' ? '◎' : kind === 'folder' ? '◈' : '✦'; }
  function renderSearchResults(query) {
    var panel = document.getElementById('search-results');
    if (!panel) return;
    panel.textContent = '';
    query = (query || '').trim().toLowerCase();
    if (!query) { closeSearchPanel(); return; }
    var scored = [];
    for (var i = 0; i < searchIndex.length; i += 1) {
      var score = searchScore(searchIndex[i], query);
      if (score > 0) scored.push({ entry: searchIndex[i], score: score });
    }
    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      var kindDiff = kindOrder(a.entry.kind) - kindOrder(b.entry.kind);
      if (kindDiff !== 0) return kindDiff;
      return (a.entry.label || '').length - (b.entry.label || '').length;
    });
    if (!scored.length) {
      var empty = document.createElement('div'); empty.className = 'search-empty'
      empty.textContent = 'NO MATCHES FOR “' + query + '”'
      panel.appendChild(empty); panel.classList.remove('hidden'); searchActive = -1; return
    }
    var inputEl = document.getElementById('universe-search-input')
    if (inputEl) inputEl.setAttribute('aria-expanded', 'true')
    var limit = 12
    scored.slice(0, limit).forEach(function (item, index) {
      var row = document.createElement('button')
      row.type = 'button'
      row.className = 'search-row'
      row.id = 'search-option-' + index
      row.setAttribute('role', 'option')
      row.dataset.searchId = item.entry.id
      var glyph = document.createElement('span'); glyph.className = 'search-glyph'; glyph.textContent = kindGlyph(item.entry.kind)
      var text = document.createElement('span'); text.className = 'search-text'
      text.appendChild(highlightMatch(item.entry.label || item.entry.path, query))
      var pathEl = document.createElement('small'); pathEl.className = 'search-path'; pathEl.textContent = item.entry.path || ''
      text.appendChild(pathEl)
      row.appendChild(glyph); row.appendChild(text)
      row.onclick = function () { selectSearchRow(index); }
      panel.appendChild(row)
    })
    if (scored.length > limit) {
      var more = document.createElement('div'); more.className = 'search-more'
      more.textContent = '+' + (scored.length - limit) + ' MORE'
      panel.appendChild(more)
    }
    panel.classList.remove('hidden')
    setSearchActive(0)
  }
  function highlightMatch(text, query) {
    var frag = document.createDocumentFragment()
    var lower = String(text || '').toLowerCase()
    var at = lower.indexOf(query)
    if (at < 0) { frag.appendChild(document.createTextNode(String(text || ''))); return frag }
    if (at > 0) frag.appendChild(document.createTextNode(String(text).slice(0, at)))
    var mark = document.createElement('mark'); mark.textContent = String(text).slice(at, at + query.length)
    frag.appendChild(mark)
    if (at + query.length < String(text).length) frag.appendChild(document.createTextNode(String(text).slice(at + query.length)))
    return frag
  }
  function setSearchActive(next) {
    var panel = document.getElementById('search-results')
    if (!panel) return
    var rows = panel.querySelectorAll('.search-row')
    if (!rows.length) { searchActive = -1; return }
    searchActive = Math.max(0, Math.min(next, rows.length - 1))
    rows.forEach(function (row, index) {
      var active = index === searchActive
      row.classList.toggle('active', active)
      row.setAttribute('aria-selected', String(active))
      if (active && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' })
    })
    var input = document.getElementById('universe-search-input')
    if (input) input.setAttribute('aria-activedescendant', activeRowId(searchActive))
  }
  function activeRowId(index) {
    var panel = document.getElementById('search-results')
    if (!panel) return ''
    var rows = panel.querySelectorAll('.search-row')
    return rows[index] ? rows[index].id : ''
  }
  function selectSearchRow(index) {
    var panel = document.getElementById('search-results')
    if (!panel) return
    var rows = panel.querySelectorAll('.search-row')
    var row = rows[index]
    if (!row) return
    var id = row.dataset.searchId
    if (!id) return
    closeSearchPanel()
    var folder = folderById[id]
    if (folder) {
      // Folders live in folderById, not objectById — route through the
      // center browser directly instead of the node navigator. Mirror the
      // detail state so the pill/zoom state stay consistent with the open
      // explorer.
      browserFolderId = folder.id
      browserDocumentId = null
      browserPage = 0
      setState('detail')
      playSound('open')
      renderCenterBrowser()
      refresh()
      setStatus('Exploring ' + (folder.path || folder.label))
      return
    }
    navigateToObjectWithCue(id, 'confirm')
    var n = nodeData(id)
    setStatus('Traveling to ' + ((n && (n.path || n.label)) || id))
  }
  function closeSearchPanel() {
    var panel = document.getElementById('search-results')
    if (panel) panel.classList.add('hidden')
    searchActive = -1
    var input = document.getElementById('universe-search-input')
    if (input) {
      input.removeAttribute('aria-activedescendant')
      input.setAttribute('aria-expanded', 'false')
    }
  }
  function handleSearchInput() {
    var input = document.getElementById('universe-search-input')
    var query = input && input.value || ''
    if (!query.trim()) { closeSearchPanel(); return }
    renderSearchResults(query)
  }
  function searchUniverse(event) {
    if (event) event.preventDefault();
    var input = document.getElementById('universe-search-input');
    var query = (input && input.value || '').trim().toLowerCase();
    if (!query) { closeSearchPanel(); return; }
    var panel = document.getElementById('search-results');
    if (panel && panel.classList.contains('hidden')) {
      renderSearchResults(query);
    }
    var rows = panel ? panel.querySelectorAll('.search-row') : [];
    if (searchActive >= 0 && rows[searchActive]) {
      selectSearchRow(searchActive);
      return;
    }
    if (rows.length > 0) { setSearchActive(0); selectSearchRow(0); return; }
    playSound('warning'); setStatus('No universe object matches “' + query + '”');
  }
  function copySelectedPath() {
    var path = selected && nodeData(selected) && nodeData(selected).path;
    if (!path) return;
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(path).then(function () { setStatus('Copied ' + path); });
    else setStatus(path);
  }
  function copyDocumentContent(file, doc) {
    if (!doc || doc.kind !== 'text' || !doc.text) { setStatus('Nothing to copy for this document'); return; }
    var done = function () { setStatus('Copied ' + (file.path || file.label) + ' (' + doc.text.length + ' chars)'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(doc.text).then(done).catch(function () { setStatus('Copy blocked by browser — select the text manually'); });
      return;
    }
    var textarea = document.createElement('textarea');
    textarea.value = doc.text;
    textarea.style.position = 'fixed'; textarea.style.opacity = '0';
    document.body.appendChild(textarea); textarea.select();
    try { document.execCommand('copy'); done(); } catch (error) { setStatus('Copy unavailable in this browser'); void error; }
    document.body.removeChild(textarea);
  }
  // Document readability toggle (FID-2026-0807-014 F8): wrap toggles pre-wrap
  // vs pre (horizontal scroll). Font-size buttons removed (FID-2026-0807-021).
  function toggleDocWrap(btn) {
    var surface = document.querySelector('.document-surface')
    if (!surface) return
    docWrapOff = surface.classList.toggle('wrap-off')
    if (btn) btn.textContent = docWrapOff ? '⤼ NO WRAP' : '⤺ WRAP'
    playSound('toggle')
    setStatus(docWrapOff ? 'Word wrap off · horizontal scroll enabled' : 'Word wrap on')
  }
`
