import { describe, expect, test } from 'bun:test'

import { buildMinimalIco } from './generate-icon'

describe('buildMinimalIco', () => {
  test('emits a structurally valid single-image ICO', () => {
    const ico = buildMinimalIco([0xf9, 0xfa, 0x18, 0xff])
    expect(ico.length).toBe(70)
    expect(ico.readUInt16LE(0)).toBe(0) // reserved
    expect(ico.readUInt16LE(2)).toBe(1) // type: icon
    expect(ico.readUInt16LE(4)).toBe(1) // exactly one image
    expect(ico[6]).toBe(1) // width
    expect(ico[7]).toBe(1) // height
    expect(ico.readUInt16LE(10)).toBe(1) // color planes
    expect(ico.readUInt16LE(12)).toBe(32) // bits per pixel
    expect(ico.readUInt32LE(14)).toBe(48) // image data length
    expect(ico.readUInt32LE(18)).toBe(22) // pixel data offset
  })

  test('embeds the requested BGRA pixel and a clear AND mask', () => {
    const ico = buildMinimalIco([0xf9, 0xfa, 0x18, 0xff])
    expect([...ico.subarray(62, 66)]).toEqual([0xf9, 0xfa, 0x18, 0xff])
    expect(ico.readUInt32LE(66)).toBe(0) // AND-mask row
  })

  test('honors arbitrary pixel input', () => {
    const ico = buildMinimalIco([0x00, 0x00, 0x00, 0x80])
    expect([...ico.subarray(62, 66)]).toEqual([0x00, 0x00, 0x00, 0x80])
  })
})
