/**
 * Part H of the offline Code Universe browser app (global wiring, boot
 * listeners, staged Escape dismissal, boot). See universe-app-script.ts for
 * the assembled payload.
 */
export const UNIVERSE_APP_SCRIPT_H = `  window.resetUniverse = resetUniverse; window.fitUniverse = fitUniverse; window.closeSidebar = closeSidebar; window.toggleMotion = toggleMotion; window.searchUniverse = searchUniverse; window.copySelectedPath = copySelectedPath; window.playSound = playSound; window.toggleSoundPanel = toggleSoundPanel; window.toggleSound = toggleSound; window.setSoundVolume = setSoundVolume; window.collapseAllRegions = collapseAllRegions; window.expandAllRegions = expandAllRegions; window.windowMinimize = windowMinimize; window.windowMaximize = windowMaximize; window.windowClose = windowClose; window.windowRestore = windowRestore; window.windowTitleBarClick = windowTitleBarClick; window.windowDragStart = windowDragStart; window.windowDragMove = windowDragMove; window.windowDragEnd = windowDragEnd;
  updateSoundUi();
  var searchInput = document.getElementById('universe-search-input');
  if (searchInput) {
    var searchTimer = 0;
    searchInput.addEventListener('input', function () {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { searchTimer = 0; handleSearchInput(); }, 120);
    });
    searchInput.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        var panel = document.getElementById('search-results');
        var count = panel ? panel.querySelectorAll('.search-row').length : 0;
        if (!count) return;
        event.preventDefault();
        var delta = event.key === 'ArrowDown' ? 1 : -1;
        setSearchActive(searchActive < 0 ? (delta === 1 ? 0 : count - 1) : searchActive + delta);
      } else if (event.key === 'Escape') {
        closeSearchPanel();
        if (document.activeElement === searchInput) searchInput.blur();
        event.stopPropagation();
      } else if (event.key === 'Enter') {
        var panelEl = document.getElementById('search-results');
        var visible = panelEl && !panelEl.classList.contains('hidden') ? panelEl.querySelectorAll('.search-row').length : 0;
        if (visible > 0) { event.preventDefault(); searchUniverse(event); }
      }
    });
  }
  var regionList = document.getElementById('region-list');
  if (regionList) {
    regionList.addEventListener('click', function (event) {
      var row = event.target.closest ? event.target.closest('.region-row, .region-tree-folder, .region-file') : null
      if (row) navKeyFocusRow(row)
    })
    regionList.addEventListener('keydown', function (event) {
      var key = event.key
      if (key !== 'ArrowDown' && key !== 'ArrowUp' && key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'Home' && key !== 'End') return
      var rows = regionNavRows()
      if (!rows.length) return
      event.preventDefault()
      var active = rows.indexOf(document.querySelector('.region-nav .nav-key-focus'))
      if (key === 'Home') { navKeyFocusRow(rows[0]); return }
      if (key === 'End') { navKeyFocusRow(rows[rows.length - 1]); return }
      if (key === 'ArrowDown') { navKeyFocusRow(rows[active < 0 ? 0 : Math.min(active + 1, rows.length - 1)]); return }
      if (key === 'ArrowUp') { navKeyFocusRow(rows[active < 0 ? rows.length - 1 : Math.max(0, active - 1)]); return }
      if (active < 0) { navKeyFocusRow(rows[0]); return }
      var row = rows[active]
      if (key === 'ArrowRight') {
        if (row.classList.contains('region-tree-folder')) {
          var list = nextRegionList(row)
          var node = treeNodeForFolderRow(row)
          if (list && node && list.classList.contains('hidden')) toggleFolderRow(row, node)
        } else if (row.classList.contains('region-row')) {
          var item = row.closest('.region-item')
          var region = systemById[row.dataset.regionId]
          var regionListEl = item ? item.querySelector('.region-files') : null
          if (regionListEl && region && regionListEl.classList.contains('hidden')) toggleRegionFiles(item, region)
        }
      } else if (key === 'ArrowLeft') {
        if (row.classList.contains('region-tree-folder')) {
          var list2 = nextRegionList(row)
          var node2 = treeNodeForFolderRow(row)
          if (list2 && node2 && !list2.classList.contains('hidden')) {
            toggleFolderRow(row, node2)
          } else {
            var upRow = row.parentElement ? row.parentElement.previousElementSibling : null
            if (upRow && (upRow.classList.contains('region-row') || upRow.classList.contains('region-tree-folder'))) navKeyFocusRow(upRow)
          }
        } else if (row.classList.contains('region-file')) {
          var fileParent = row.parentElement ? row.parentElement.previousElementSibling : null
          if (fileParent && (fileParent.classList.contains('region-row') || fileParent.classList.contains('region-tree-folder'))) navKeyFocusRow(fileParent)
        } else if (row.classList.contains('region-row')) {
          var item3 = row.closest('.region-item')
          var region3 = systemById[row.dataset.regionId]
          var regionListEl3 = item3 ? item3.querySelector('.region-files') : null
          if (regionListEl3 && region3 && !regionListEl3.classList.contains('hidden')) toggleRegionFiles(item3, region3)
        }
      }
    })
  }
  function escDismiss() {
    // Staged dismissal (FID-2026-0807-014 F1): the first Escape only removes
    // the visible overlay layer — restores a minimized taskbar, otherwise
    // hides the sidebar AND the center focus — while preserving the selection
    // and zoom state (STATE_PILL stays DETAIL). Only a second Escape (nothing
    // left open) restores the universe to MACRO.
    var minimized = document.querySelectorAll('.center-focus.window-minimized, .graph-sidebar.window-minimized')
    if (minimized.length) {
      minimized.forEach(function (panel) { panel.classList.remove('window-minimized', 'window-maximized') })
      syncDockedTaskbars()
      playSound('open')
      setStatus('Panel restored')
      return
    }
    var sidebar = document.getElementById('graph-sidebar')
    var focus = document.getElementById('center-focus')
    var anyVisible = (sidebar && !sidebar.classList.contains('hidden')) || (focus && !focus.classList.contains('hidden'))
    if (anyVisible) {
      if (sidebar && !sidebar.classList.contains('hidden')) {
        sidebar.classList.add('hidden')
        sidebar.classList.remove('window-minimized', 'window-maximized')
      }
      if (focus && !focus.classList.contains('hidden')) {
        clearFocusView()
        focus.classList.remove('window-minimized', 'window-maximized')
      }
      playSound('close')
      setStatus('Panels dismissed · selection preserved')
      return
    }
    resetUniverse()
  }
  document.addEventListener('keydown', function (event) {
    var target = event.target
    var typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
    // Search shortcut (FID-2026-0807-014 F10): '/' or Ctrl/Cmd+K focuses the
    // universe search. Skipped while the user is typing so '/' typed into any
    // input never hijacks it.
    if (!typing && (event.key === '/' || ((event.ctrlKey || event.metaKey) && (event.key === 'k' || event.key === 'K')))) {
      event.preventDefault()
      var searchInputEl = document.getElementById('universe-search-input')
      if (searchInputEl) { searchInputEl.focus(); searchInputEl.select() }
      playSound('toggle')
      return
    }
    if (event.key !== 'Escape') return
    var results = document.getElementById('search-results')
    if (results && !results.classList.contains('hidden')) {
      closeSearchPanel()
      event.stopPropagation()
      return
    }
    escDismiss()
  });
  try { buildGraph(); } catch (error) { showGraphFailure('WebGL unavailable. ' + DATA.meta.files + ' files, ' + DATA.meta.edges + ' relationships indexed. Use the systems list to inspect regions and full paths.'); }
})();
`
