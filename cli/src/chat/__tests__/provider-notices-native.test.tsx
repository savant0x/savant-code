import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createTestRenderer } from '@opentui/core/testing'
import { createRoot } from '@opentui/react'
import { expect, test } from 'bun:test'
import { useEffect, useState } from 'react'

import { ProviderInbox } from '../../components/provider-inbox'
import { initializeThemeStore } from '../../hooks/use-theme'
import { useToastStore } from '../../hooks/use-toast'
import { useChatStore } from '../../state/chat-store'
import { useProviderInboxStore } from '../../state/provider-inbox-store'
import { ProviderNoticeStorage } from '../../utils/provider-notice-storage'
import { ProviderNotificationCoordinator } from '../../utils/provider-notifications'
import { mountProviderNotifications } from '../provider-notification-lifecycle'

initializeThemeStore()

test('restored chat and early message changes preserve the mounted native inbox and independent delivery', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'provider-native-'))
  const service = new ProviderNotificationCoordinator(
    new ProviderNoticeStorage(dir),
  )
  const setup = await createTestRenderer({
    width: 90,
    height: 26,
    footerHeight: 0,
  })
  let root = createRoot(setup.renderer)
  const transcript = useChatStore.getState().messages
  let changeMessages = () => {}
  let starts = 0,
    stops = 0
  function Harness() {
    const [count, setCount] = useState(3)
    changeMessages = () => setCount((v) => v + 1)
    useEffect(
      () =>
        mountProviderNotifications(
          service,
          () => {
            starts++
            return () => {
              stops++
            }
          },
          async () => {},
        ),
      [],
    )
    return (
      <box>
        <text>{count} restored chat messages</text>
        <ProviderInbox height={26} coordinator={service} />
      </box>
    )
  }
  const flush = async () => {
    await setup.renderOnce()
    await Bun.sleep(40)
    await setup.renderOnce()
  }
  try {
    useProviderInboxStore.getState().setOpen(true)
    root.render(<Harness />)
    await flush()
    changeMessages()
    service.observe('health', [
      {
        key: 'p',
        value: 'down',
        providerId: 'p',
        kind: 'health-down',
        severity: 'warning',
        selected: true,
        message: 'Native selected provider unavailable',
      },
    ])
    await service.deliver()
    await Bun.sleep(1050)
    await flush()
    expect(setup.captureCharFrame()).toContain(
      'Native selected provider unavailable',
    )
    expect(starts).toBe(1)
    expect(useChatStore.getState().messages).toBe(transcript)
    for (let i = 0; i < 8; i++)
      useToastStore
        .getState()
        .addToast({ message: `ordinary ${i}`, duration: 0 })
    expect(useToastStore.getState().toasts).toHaveLength(5)
    expect(
      useToastStore
        .getState()
        .toasts.some((t) => t.retainedKey === 'provider-route-warning'),
    ).toBe(true)
    setup.mockInput.pressArrow('down')
    await flush()
    setup.mockInput.pressEnter()
    await flush()
    expect(
      service
        .snapshot()
        .notices.find(
          (n) => n.message === 'Native selected provider unavailable',
        )?.unread,
    ).toBe(false)
    await setup.mockInput.pressKey('d')
    await flush()
    expect(
      service
        .snapshot()
        .notices.find(
          (n) => n.message === 'Native selected provider unavailable',
        )?.dismissed,
    ).toBe(true)
    setup.mockInput.pressEscape()
    await Bun.sleep(250)
    await flush()
    expect(useProviderInboxStore.getState().open).toBe(false)
    root.unmount()
    await flush()
    expect(stops).toBe(1)
    root = createRoot(setup.renderer)
    root.render(<Harness />)
    await flush()
    expect(starts).toBe(2)
    await service.deliver()
    expect(
      service.snapshot().notices.filter((n) => n.kind === 'health-down'),
    ).toHaveLength(1)
  } finally {
    root.unmount()
    setup.renderer.destroy()
    useProviderInboxStore.getState().setOpen(false)
    useToastStore.setState({ toasts: [] })
    rmSync(dir, { recursive: true, force: true })
  }
}, 10_000)
