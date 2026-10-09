import { createTestRenderer } from '@opentui/core/testing'
import { createRoot } from '@opentui/react'
import { describe, expect, test } from 'bun:test'
import React from 'react'

import { createSidebarFocusController } from '../../components/right-sidebar-focus'
import { SidebarActivityAccent } from '../../components/right-sidebar-motion'
import { useFoldCollapse } from '../use-fold-collapse'

describe('sidebar finite motion', () => {
  test('disabled folds settle immediately; active accents release on unmount', async () => {
    const setup = await createTestRenderer({
      width: 40,
      height: 5,
      footerHeight: 0,
    })
    const root = createRoot(setup.renderer)
    let unmounted = false
    let toggle = () => {}
    let change = () => {}
    function Harness() {
      const fold = useFoldCollapse(true, true)
      const [kind, setKind] = React.useState('idle')
      toggle = fold.toggle
      change = () => setKind('thinking')
      return React.createElement(
        'box',
        { flexDirection: 'column' },
        fold.mounted &&
          React.createElement(
            'box',
            { ref: fold.bodyRef, height: fold.height },
            React.createElement('text', null, 'BODY'),
          ),
        React.createElement(SidebarActivityAccent, {
          kind,
          disabled: false,
          children: (active) =>
            React.createElement('text', null, active ? 'PULSE' : 'SETTLED'),
        }),
      )
    }
    root.render(React.createElement(Harness))
    const flush = async () => {
      await Bun.sleep(30)
      await setup.renderOnce()
    }
    try {
      await flush()
      await flush()
      const baseline = setup.renderer.liveRequestCount
      const listeners = setup.renderer.listenerCount('blur')
      toggle()
      await flush()
      expect(setup.captureCharFrame()).not.toContain('BODY')
      expect(setup.renderer.liveRequestCount).toBe(baseline)
      expect(setup.renderer.listenerCount('blur')).toBe(listeners)
      change()
      await flush()
      expect(setup.captureCharFrame()).toContain('PULSE')
      root.unmount()
      unmounted = true
      await flush()
      expect(setup.renderer.liveRequestCount).toBe(baseline)
      expect(setup.renderer.listenerCount('blur')).toBe(listeners)
    } finally {
      if (!unmounted) root.unmount()
      setup.renderer.destroy()
    }
  })
  test('opt-out resolves once and accepts 1/true without case sensitivity', () => {
    const original = process.env.SAVANT_CODE_REDUCED_MOTION
    try {
      for (const value of ['1', 'true', 'TRUE']) {
        process.env.SAVANT_CODE_REDUCED_MOTION = value
        const controller = createSidebarFocusController()
        expect(controller.reducedMotion).toBe(true)
        process.env.SAVANT_CODE_REDUCED_MOTION = '0'
        expect(controller.reducedMotion).toBe(true)
      }
      expect(createSidebarFocusController().reducedMotion).toBe(false)
    } finally {
      if (original === undefined) delete process.env.SAVANT_CODE_REDUCED_MOTION
      else process.env.SAVANT_CODE_REDUCED_MOTION = original
    }
  })
  test('activity changes complete, repeated kinds stay still, blur cancels', async () => {
    const setup = await createTestRenderer({
      width: 40,
      height: 5,
      footerHeight: 0,
    })
    const root = createRoot(setup.renderer)
    const flush = async () => {
      await Bun.sleep(30)
      await setup.renderOnce()
      await Bun.sleep(20)
      await setup.renderOnce()
    }
    let render: (kind: string, disabled?: boolean) => void = () => {}
    function Harness() {
      const [state, setState] = React.useState({
        kind: 'idle',
        disabled: false,
      })
      render = (kind, disabled = false) => setState({ kind, disabled })
      return React.createElement(SidebarActivityAccent, {
        ...state,
        children: (emphasized) =>
          React.createElement('text', null, emphasized ? 'PULSE' : 'SETTLED'),
      })
    }
    root.render(React.createElement(Harness))
    try {
      await flush()
      const baseline = setup.renderer.liveRequestCount
      render('thinking')
      await flush()
      expect(setup.captureCharFrame()).toContain('PULSE')
      await Bun.sleep(260)
      await flush()
      expect(setup.captureCharFrame()).toContain('SETTLED')
      expect(setup.renderer.liveRequestCount).toBe(baseline)
      render('thinking')
      await flush()
      expect(setup.captureCharFrame()).toContain('SETTLED')
      render('tool')
      await flush()
      setup.renderer.emit('blur')
      await flush()
      expect(setup.captureCharFrame()).toContain('SETTLED')
      expect(setup.renderer.liveRequestCount).toBe(baseline)
      render('researching', true)
      await flush()
      expect(setup.captureCharFrame()).toContain('SETTLED')
      expect(setup.renderer.liveRequestCount).toBe(baseline)
    } finally {
      root.unmount()
      setup.renderer.destroy()
    }
  })
  test('fold blur settles the target and removes its temporary listener', async () => {
    const setup = await createTestRenderer({
      width: 40,
      height: 5,
      footerHeight: 0,
    })
    const root = createRoot(setup.renderer)
    let toggle = () => {}
    function Fold() {
      const fold = useFoldCollapse(true)
      toggle = fold.toggle
      return React.createElement(
        'box',
        { flexDirection: 'column' },
        React.createElement('text', null, fold.expanded ? 'OPEN' : 'CLOSED'),
        fold.mounted &&
          React.createElement(
            'box',
            { ref: fold.bodyRef, height: fold.height },
            React.createElement('text', null, 'BODY'),
          ),
      )
    }
    root.render(React.createElement(Fold))
    const flush = async () => {
      await Bun.sleep(30)
      await setup.renderOnce()
    }
    try {
      await flush()
      await flush()
      const listeners = setup.renderer.listenerCount('blur')
      const baseline = setup.renderer.liveRequestCount
      toggle()
      await flush()
      expect(setup.renderer.listenerCount('blur')).toBe(listeners + 1)
      setup.renderer.emit('blur')
      await flush()
      expect(setup.captureCharFrame()).toContain('CLOSED')
      expect(setup.captureCharFrame()).not.toContain('BODY')
      expect(setup.renderer.listenerCount('blur')).toBe(listeners)
      expect(setup.renderer.liveRequestCount).toBe(baseline)
      toggle()
      await Bun.sleep(240)
      await flush()
      expect(setup.captureCharFrame()).toContain('BODY')
      expect(setup.renderer.listenerCount('blur')).toBe(listeners)
      expect(setup.renderer.liveRequestCount).toBe(baseline)
    } finally {
      root.unmount()
      setup.renderer.destroy()
    }
  })
})
