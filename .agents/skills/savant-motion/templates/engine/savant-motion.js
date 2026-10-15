/**
 * SavantMotion — read-only kinematics engine template.
 *
 * Derived from scroll-craft (MIT, Copyright (c) 2026 Nate Herk); worldflight
 * mechanics trace upstream to oso95/scroll-world. This is a native rewrite,
 * not a copy. THE ENGINE IS THE MECHANISM AND IS NEVER EDITED PER PROJECT:
 * theme it via the token block in savant-motion.css, drive it via data-sm-*
 * attributes in your markup, and code bespoke behavior as page-local JS that
 * reads the state published here (--sm-p per act, --sm-vy velocity,
 * sm:waypoint events, window.ScrollMotion.instances).
 *
 * Devices (all opt-in via attributes):
 *   data-sm-act="flow|pin|scrub|pan|dwell"  act stage; span via data-sm-span (vh)
 *   data-sm-scrub                           video scrubs its timeline under the wheel
 *   data-sm-seq / data-sm-seq-src / data-sm-seq-count   canvas image sequence
 *   data-sm-cue                             opacity reaches exactly 1 at viewport center
 *   data-sm-reveal="up|down|left|right|iris" one-shot entrance
 *   data-sm-parallax="0.2"                  translateY factor over act progress
 *   data-sm-pan-track                       horizontal track inside a pan act
 *   data-sm-count                           count-up when entering view
 *   data-sm-drift-from / data-sm-drift-to   ground tint interpolation per act
 *   data-sm-dwell="0.4"                     linger ease remap of local progress
 *   data-sm-magnet="0.3"                    pointer magnet (pointer devices only)
 *   data-sm-spotlight                       pointer-driven mask reveal
 *   data-sm-world="i" / root data-sm-worldflight         fixed-stage crossfade worlds
 */
;(function () {
  'use strict'

  var instances = []

  function clamp01(value) {
    return value < 0 ? 0 : value > 1 ? 1 : value
  }

  function lerp(a, b, t) {
    return a + (b - a) * t
  }

  /** Linger ease: holds progress near the dwell point before releasing. */
  function lingerEase(p, amount) {
    var hold = clamp01(amount)
    if (hold <= 0) return p
    var shaped = p - (hold * Math.sin(p * Math.PI * 2)) / (Math.PI * 2)
    return clamp01(shaped)
  }

  function parseHex(color) {
    var raw = color.replace('#', '')
    if (raw.length === 3) {
      raw = raw[0] + raw[0] + raw[1] + raw[1] + raw[2] + raw[2]
    }
    var num = parseInt(raw, 16)
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
  }

  function mixColor(from, to, t) {
    var a = parseHex(from)
    var b = parseHex(to)
    return (
      'rgb(' +
      Math.round(lerp(a[0], b[0], t)) +
      ',' +
      Math.round(lerp(a[1], b[1], t)) +
      ',' +
      Math.round(lerp(a[2], b[2], t)) +
      ')'
    )
  }

  function localeCount(value) {
    try {
      return value.toLocaleString()
    } catch (error) {
      return String(value)
    }
  }

  function splitText(element) {
    if (element.getAttribute('data-sm-split') === 'done') return
    var text = element.textContent || ''
    element.setAttribute('aria-label', text.trim())
    element.textContent = ''
    var words = text.split(/(\s+)/)
    for (var i = 0; i < words.length; i += 1) {
      var word = words[i]
      if (/^\s+$/.test(word) || word === '') {
        element.appendChild(document.createTextNode(word))
        continue
      }
      var span = document.createElement('span')
      span.className = 'sm-w'
      span.setAttribute('aria-hidden', 'true')
      span.textContent = word
      element.appendChild(span)
    }
    element.setAttribute('data-sm-split', 'done')
  }

  function makeClip(video, state) {
    var src = video.getAttribute('data-sm-src') || video.getAttribute('src')
    if (!src || state.clips.has(video)) return
    state.clips.add(video)
    fetch(src)
      .then(function (response) {
        if (!response.ok) throw new Error('clip fetch ' + response.status)
        return response.blob()
      })
      .then(function (blob) {
        video.src = URL.createObjectURL(blob)
        video.load()
        video.addEventListener('loadedmetadata', function () {
          video.currentTime = 0.001
        })
      })
      .catch(function () {
        // Leave poster frame visible; verify harness reports decode skips.
      })
  }

  function makeSequence(canvas, state) {
    var pattern = canvas.getAttribute('data-sm-seq-src')
    var count = parseInt(canvas.getAttribute('data-sm-seq-count') || '0', 10)
    if (!pattern || !count || state.sequences.has(canvas)) return
    var frames = []
    var loaded = 0
    state.sequences.set(canvas, { frames: frames, ready: false })
    var context = canvas.getContext('2d')
    function draw(index) {
      var image = frames[index]
      if (!image || !context) return
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      context.drawImage(image, 0, 0)
    }
    for (var i = 0; i < count; i += 1) {
      ;(function (index) {
        var image = new Image()
        image.onload = function () {
          loaded += 1
          if (loaded === count) {
            state.sequences.get(canvas).ready = true
            draw(0)
          }
        }
        image.src = pattern.replace('{i}', String(index))
        frames.push(image)
      })(i)
    }
    state.sequences.get(canvas).draw = draw
  }

  function readActs(root) {
    var elements = root.querySelectorAll('[data-sm-act]')
    var acts = []
    for (var i = 0; i < elements.length; i += 1) {
      var element = elements[i]
      var type = element.getAttribute('data-sm-act') || 'flow'
      var span = parseFloat(element.getAttribute('data-sm-span') || '1.2')
      if (type !== 'flow') {
        element.style.height = span + 'vh'
      }
      var stage =
        type === 'pin' || type === 'scrub' || type === 'pan' || type === 'dwell'
          ? element.querySelector('.sm-stage') || element.firstElementChild
          : null
      if (stage) stage.classList.add('sm-stage-pinned')
      acts.push({ element: element, type: type, span: span, top: 0, height: 1 })
    }
    return acts
  }

  function layout(instance) {
    var doc = document.documentElement
    instance.docHeight = Math.max(doc.scrollHeight, window.innerHeight + 1)
    for (var i = 0; i < instance.acts.length; i += 1) {
      var act = instance.acts[i]
      var box = act.element.getBoundingClientRect()
      act.top = box.top + window.scrollY
      act.height = Math.max(box.height, window.innerHeight)
    }
  }

  function actProgress(act, scrollY, vh) {
    var total = act.height - vh
    if (total <= 0) return scrollY >= act.top + act.height ? 1 : 0
    return clamp01((scrollY - act.top) / total)
  }

  function applyDevices(instance, scrollY, vh) {
    var center = vh / 2
    for (var i = 0; i < instance.acts.length; i += 1) {
      var act = instance.acts[i]
      var p = actProgress(act, scrollY, vh)
      if (act.type === 'dwell') {
        p = lingerEase(
          p,
          parseFloat(act.element.getAttribute('data-sm-dwell') || '0.4'),
        )
      }
      act.element.style.setProperty('--sm-p', p.toFixed(4))
      var stage =
        act.type !== 'flow' ? act.element.querySelector('.sm-stage') : null
      if (stage && act.type === 'pan') {
        var track = stage.querySelector('[data-sm-pan-track]')
        if (track) {
          var distance = track.scrollWidth - window.innerWidth
          track.style.transform =
            'translateX(' + (-p * Math.max(distance, 0)).toFixed(2) + 'px)'
        }
      }
      var driftFrom = act.element.getAttribute('data-sm-drift-from')
      var driftTo = act.element.getAttribute('data-sm-drift-to')
      if (driftFrom && driftTo) {
        act.element.style.backgroundColor = mixColor(driftFrom, driftTo, p)
      }
      var scrubVideo = act.element.querySelector('[data-sm-scrub]')
      if (scrubVideo && scrubVideo.duration && scrubVideo.readyState >= 2) {
        var targetTime = p * Math.max(scrubVideo.duration - 0.05, 0)
        if (Math.abs(scrubVideo.currentTime - targetTime) > 0.03) {
          scrubVideo.currentTime = targetTime
        }
      }
      var sequenceCanvas = act.element.querySelector('[data-sm-seq]')
      if (sequenceCanvas) {
        var seqState = instance.sequences.get(sequenceCanvas)
        if (seqState && seqState.ready && seqState.draw) {
          seqState.draw(
            Math.min(
              seqState.frames.length - 1,
              Math.round(p * (seqState.frames.length - 1)),
            ),
          )
        }
      }
    }
    var cues = instance.cues
    for (var c = 0; c < cues.length; c += 1) {
      var cueBox = cues[c].getBoundingClientRect()
      var cueCenter = cueBox.top + cueBox.height / 2
      var opacity = 1
      if (cueCenter > center) {
        var ramp = (cueCenter - center) / (vh * 0.45)
        opacity = Math.max(0.15, 1 - ramp * 0.85)
      }
      cues[c].style.opacity = opacity.toFixed(3)
    }
    var parallax = instance.parallax
    for (var d = 0; d < parallax.length; d += 1) {
      var el = parallax[d]
      var factor = parseFloat(el.getAttribute('data-sm-parallax') || '0.2')
      var boxP = el.getBoundingClientRect()
      var delta = boxP.top + boxP.height / 2 - center
      el.style.transform = 'translateY(' + (-delta * factor).toFixed(2) + 'px)'
    }
  }

  function applyWorldflight(instance, scrollY, vh) {
    var root = instance.root
    var worlds = instance.worlds
    if (!root.hasAttribute('data-sm-worldflight') || worlds.length === 0) return
    var spacer = root.querySelector('[data-sm-spacer]')
    var total = spacer ? spacer.offsetHeight - vh : instance.docHeight - vh
    var head = total > 0 ? clamp01(scrollY / total) : 0
    var segment = 1 / worlds.length
    for (var w = 0; w < worlds.length; w += 1) {
      var start = w * segment
      var layer = worlds[w]
      var local = (head - start) / segment
      var opacity =
        local >= 0 && local <= 1 ? 1 : Math.max(0, 1 - Math.abs(local))
      layer.style.opacity = opacity.toFixed(3)
      layer.style.setProperty('--sm-seg', w.toFixed(0))
      layer.style.setProperty('--sm-segp', clamp01(local).toFixed(4))
      if (local >= 0 && local <= 1 && instance.currentWorld !== w) {
        instance.currentWorld = w
        root.dispatchEvent(
          new CustomEvent('sm:waypoint', {
            detail: { world: w, progress: clamp01(local) },
          }),
        )
      }
    }
  }

  function tick(instance) {
    if (instance.reduce.matches) return
    var vh = window.innerHeight
    var maxScroll = instance.docHeight - vh
    var targetScroll = Math.min(window.scrollY, Math.max(maxScroll, 0))
    var now = performance.now()
    var dt = Math.max(now - instance.lastTs, 1)
    instance.lastTs = now
    var rate = parseFloat(instance.root.getAttribute('data-sm-lerp') || '0.18')
    var next = lerp(
      instance.smoothed,
      targetScroll,
      clamp01(rate * (dt / 16.7)),
    )
    var velocity = (next - instance.smoothed) / dt
    instance.smoothed = next
    document.documentElement.style.setProperty('--sm-vy', velocity.toFixed(5))
    applyDevices(instance, instance.smoothed, vh)
    applyWorldflight(instance, instance.smoothed, vh)
    requestAnimationFrame(function () {
      tick(instance)
    })
  }

  function prepareStatic(root) {
    var cues = root.querySelectorAll('[data-sm-cue]')
    for (var i = 0; i < cues.length; i += 1) cues[i].style.opacity = '1'
  }

  function mount(root) {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    var instance = {
      root: root,
      reduce: reduce,
      acts: [],
      cues: [],
      parallax: [],
      magnets: [],
      worlds: [],
      clips: new Set(),
      sequences: new Map(),
      counters: [],
      smoothed: window.scrollY,
      lastTs: performance.now(),
      docHeight: document.documentElement.scrollHeight,
      currentWorld: -1,
    }
    var all = root.querySelectorAll(
      '[data-sm-cue], [data-sm-reveal], [data-sm-count]',
    )
    for (var i = 0; i < all.length; i += 1) {
      var el = all[i]
      if (el.hasAttribute('data-sm-cue')) instance.cues.push(el)
      if (el.hasAttribute('data-sm-reveal')) el.classList.add('sm-reveal')
      if (el.hasAttribute('data-sm-count')) instance.counters.push(el)
    }
    var parallaxEls = root.querySelectorAll('[data-sm-parallax]')
    for (var j = 0; j < parallaxEls.length; j += 1)
      instance.parallax.push(parallaxEls[j])
    var magnetEls = root.querySelectorAll('[data-sm-magnet]')
    for (var mg = 0; mg < magnetEls.length; mg += 1)
      instance.magnets.push(magnetEls[mg])
    initPointer(instance)
    var worldEls = root.querySelectorAll('[data-sm-world]')
    for (var k = 0; k < worldEls.length; k += 1)
      instance.worlds.push(worldEls[k])
    var kinetic = root.querySelectorAll('[data-sm-kinetic]')
    for (var m = 0; m < kinetic.length; m += 1) splitText(kinetic[m])
    var scrubVideos = root.querySelectorAll('[data-sm-scrub]')
    for (var v = 0; v < scrubVideos.length; v += 1)
      makeClip(scrubVideos[v], instance)
    var canvases = root.querySelectorAll('[data-sm-seq]')
    for (var s = 0; s < canvases.length; s += 1)
      makeSequence(canvases[s], instance)

    var observer = new IntersectionObserver(
      function (entries) {
        for (var e = 0; e < entries.length; e += 1) {
          var entry = entries[e]
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-in')
          if (entry.target.hasAttribute('data-sm-count')) {
            runCount(entry.target)
            observer.unobserve(entry.target)
          } else if (!entry.target.hasAttribute('data-sm-cue')) {
            observer.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.25 },
    )
    for (var r = 0; r < all.length; r += 1) observer.observe(all[r])

    function runCount(target) {
      var end = parseFloat(target.getAttribute('data-sm-count') || '0')
      var duration = 1200
      var startedAt = performance.now()
      function stepCount(now) {
        var t = clamp01((now - startedAt) / duration)
        target.textContent = localeCount(Math.round(end * t))
        if (t < 1) requestAnimationFrame(stepCount)
      }
      requestAnimationFrame(stepCount)
    }
    instance.runCount = runCount

    if (reduce.matches) {
      prepareStatic(root)
      instances.push(instance)
      return instance
    }
    instance.acts = readActs(root)
    layout(instance)
    window.addEventListener('resize', function () {
      layout(instance)
    })
    window.addEventListener('load', function () {
      layout(instance)
    })
    requestAnimationFrame(function () {
      tick(instance)
    })
    instances.push(instance)
    return instance
  }

  /**
   * Pointer devices publish --sm-mx/--sm-my (drives [data-sm-spotlight] masks)
   * and pull [data-sm-magnet] elements toward the pointer. Deliberately inert
   * on coarse pointers/touch and never scroll-hijacking.
   */
  function initPointer(instance) {
    var fine = window.matchMedia('(pointer: fine)')
    if (!fine.matches) return
    document.addEventListener(
      'pointermove',
      function (event) {
        document.documentElement.style.setProperty(
          '--sm-mx',
          event.clientX + 'px',
        )
        document.documentElement.style.setProperty(
          '--sm-my',
          event.clientY + 'px',
        )
        for (var i = 0; i < instance.magnets.length; i += 1) {
          var magnetEl = instance.magnets[i]
          var strength = parseFloat(
            magnetEl.getAttribute('data-sm-magnet') || '0.3',
          )
          var box = magnetEl.getBoundingClientRect()
          var dx = event.clientX - (box.left + box.width / 2)
          var dy = event.clientY - (box.top + box.height / 2)
          magnetEl.style.transform =
            'translate(' +
            (dx * strength).toFixed(2) +
            'px,' +
            (dy * strength).toFixed(2) +
            'px)'
        }
      },
      { passive: true },
    )
  }

  function autoMount() {
    var roots = document.querySelectorAll('[data-sm-root], body')
    if (roots.length === 0) return
    mount(roots.length > 0 ? roots[0] : document.body)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount)
  } else {
    autoMount()
  }

  window.ScrollMotion = {
    version: '1.0.0',
    instances: instances,
    mount: mount,
  }
})()
