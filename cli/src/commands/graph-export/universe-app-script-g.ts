/**
 * Part G of the offline Code Universe browser app (motion toggle, OS-style
 * window controls, draggable panels). See universe-app-script.ts for the
 * assembled payload.
 */
export const UNIVERSE_APP_SCRIPT_G = `  function toggleMotion() {
    reducedMotion = !reducedMotion;
    var shell = document.querySelector('.universe-shell');
    if (shell) shell.classList.toggle('motion-off', reducedMotion);
    if (reducedMotion) { if (motionFrame) cancelAnimationFrame(motionFrame); motionFrame = 0; drawPlanetEffects(); }
    else if (!motionFrame) motionFrame = requestAnimationFrame(animatePlanetEffects);
    playSound('click')
    setStatus(reducedMotion ? 'Reduced motion enabled · topology and depth preserved' : 'Full motion enabled · selected paths flow through the universe');
  }
  // OS-style window controls (FID-2026-0807-012 + FID-2026-0807-014). Minimize
  // docks the panel to the viewport bottom as a taskbar bar WITHOUT closing
  // the open document; maximize expands near-fullscreen; close follows
  // per-window semantics — each panel's × closes ONLY that panel, so the
  // sidebar × keeps an open center document and the center × keeps the
  // sidebar. resetUniverse() remains the only close-everything path.
  function windowPanel(btn) { return btn && btn.closest ? btn.closest('.center-focus, .graph-sidebar') : null }
  function updateWindowTitle(panel) {
    var bar = panel.querySelector('.window-title-bar')
    if (!bar) return
    var heading = panel.querySelector('.document-header h2, .browser-heading h2, #sidebar-title')
    // The file-name h2 carries a bracketed meta badge ([711 lines · …]); keep
    // it out of the title-bar text so the bar stays a clean file label.
    var label = ''
    if (heading) {
      var badge = heading.querySelector('.document-file-meta')
      label = heading.textContent.replace(badge ? badge.textContent : '', '').trim()
    }
    bar.textContent = label || 'CODE UNIVERSE'
  }
  function syncDockedTaskbars() {
    var panels = []
    var center = document.getElementById('center-focus')
    var side = document.getElementById('graph-sidebar')
    if (center && center.classList.contains('window-minimized')) panels.push(center)
    if (side && side.classList.contains('window-minimized')) panels.push(side)
    panels.forEach(function (panel, index) { panel.classList.toggle('docked-sibling', index > 0) })
  }
  function windowMinimize(btn) {
    var panel = windowPanel(btn)
    if (!panel) return
    var minimized = panel.classList.toggle('window-minimized')
    if (minimized) {
      panel.classList.remove('window-maximized')
      updateWindowTitle(panel)
    }
    syncDockedTaskbars()
    playSound(minimized ? 'close' : 'open')
    setStatus(minimized ? 'Panel minimized · click the taskbar bar to restore' : 'Panel restored')
  }
  function windowMaximize(btn) {
    var panel = windowPanel(btn)
    if (!panel) return
    var maximized = panel.classList.toggle('window-maximized')
    if (maximized) panel.classList.remove('window-minimized')
    syncDockedTaskbars()
    playSound('click')
    setStatus(maximized ? 'Panel maximized' : 'Panel restored to size')
  }
  function windowClose(btn) {
    var panel = windowPanel(btn)
    if (!panel) return
    panel.classList.remove('window-minimized', 'window-maximized')
    if (panel.classList.contains('graph-sidebar')) {
      panel.classList.add('hidden')
    } else {
      clearFocusView()
    }
    syncDockedTaskbars()
    playSound('close')
    setStatus('Panel closed')
  }
  function windowRestore(btn) {
    var panel = windowPanel(btn)
    if (!panel) return
    panel.classList.remove('window-minimized', 'window-maximized')
    syncDockedTaskbars()
    playSound('open')
    setStatus('Panel restored')
  }
  // Clicking the title bar restores ONLY a minimized taskbar; a click on an
  // open panel's bar is a no-op (the bar is a drag handle, FID-2026-0807-015).
  function windowTitleBarClick(bar) {
    var panel = windowPanel(bar)
    if (panel && panel.classList.contains('window-minimized')) windowRestore(bar)
  }
  // Draggable windows (FID-2026-0807-015 F2): the always-visible title bar is
  // a grab handle. Pointer-based so mouse + touch both work; positions are
  // session-only inline styles (export stays deterministic).
  var dragPanel = null
  var dragStartX = 0
  var dragStartY = 0
  var dragOriginLeft = 0
  var dragOriginTop = 0
  var dragParentLeft = 0
  var dragParentTop = 0
  var dragParentWidth = 0
  var dragParentHeight = 0
  var dragMoved = false
  var dragBar = null
  var dragWasMaximized = false
  function windowDragStart(bar, event) {
    if (!event || (event.button !== undefined && event.button !== 0)) return
    var panel = windowPanel(bar)
    if (!panel) return
    var wasMinimized = panel.classList.contains('window-minimized')
    dragWasMaximized = panel.classList.contains('window-maximized')
    if (wasMinimized) windowRestore(bar)
    if (dragWasMaximized) panel.classList.remove('window-maximized')
    dragPanel = panel
    dragBar = bar
    dragMoved = false
    dragStartX = event.clientX
    dragStartY = event.clientY
    var rect = panel.getBoundingClientRect()
    var parent = panel.offsetParent || panel.parentElement
    var parentRect = parent ? parent.getBoundingClientRect() : { left: 0, top: 0 }
    dragParentLeft = parentRect.left
    dragParentTop = parentRect.top
    dragParentWidth = parent && parent.clientWidth ? parent.clientWidth : window.innerWidth
    dragParentHeight = parent && parent.clientHeight ? parent.clientHeight : window.innerHeight
    // Keep the origin in the panel's containing-block coordinate system. Do
    // not write styles yet: a title-bar click without movement must not break
    // the centered/right-anchored responsive layout.
    dragOriginLeft = rect.left - dragParentLeft
    dragOriginTop = rect.top - dragParentTop
    if (bar.setPointerCapture) {
      try { bar.setPointerCapture(event.pointerId) } catch (error) { void error }
    }
    if (event.preventDefault) event.preventDefault()
  }
  function windowDragMove(event) {
    if (!dragPanel) return
    var dx = event.clientX - dragStartX
    var dy = event.clientY - dragStartY
    if (!dragMoved && Math.abs(dx) + Math.abs(dy) < 4) return
    if (!dragMoved) {
      dragMoved = true
      dragPanel.classList.add('window-dragging')
      // Movement crossed the threshold, so now switch from CSS anchoring to
      // explicit containing-block coordinates.
      dragPanel.style.left = Math.round(dragOriginLeft) + 'px'
      dragPanel.style.top = Math.round(dragOriginTop) + 'px'
      dragPanel.style.right = 'auto'
      dragPanel.style.transform = 'none'
    }
    var width = dragPanel.offsetWidth
    var height = dragPanel.offsetHeight
    // Keep at least 48px of the panel inside its containing block. The panel
    // rect and these coordinates are both viewport-relative through the
    // containing-block origin, avoiding header/footer coordinate jumps.
    var nextLeft = Math.max(48 - width, Math.min(dragOriginLeft + dx, dragParentWidth - 48))
    var nextTop = Math.max(48 - height, Math.min(dragOriginTop + dy, dragParentHeight - 48))
    dragPanel.style.left = Math.round(nextLeft) + 'px'
    dragPanel.style.top = Math.round(nextTop) + 'px'
  }
  function windowDragEnd(event) {
    if (!dragPanel) return
    dragPanel.classList.remove('window-dragging')
    if (!dragMoved && dragWasMaximized) {
      dragPanel.classList.add('window-maximized')
    }
    var bar = dragBar || (event && event.currentTarget)
    if (bar && bar.releasePointerCapture && event && event.pointerId !== undefined) {
      try { bar.releasePointerCapture(event.pointerId) } catch (error) { void error }
    }
    dragPanel = null
    dragBar = null
    dragWasMaximized = false
  }
`
