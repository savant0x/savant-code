#!/usr/bin/env bun
// Generates the Windows shell icon required by tauri-build's resource step
// (`src-tauri/icons/icon.ico`) as a deterministic 1x1 32-bit BGRA image
// tinted with the Savant cyan. Real branded icon assets arrive with
// FID-2026-0820-010; this exists so the Phase-2 scaffold compiles on Windows
// without a hand-vendored binary blob.

import fs from 'node:fs'
import path from 'node:path'

const ICON_PATH = path.resolve(
  import.meta.dir,
  '..',
  'src-tauri',
  'icons',
  'icon.ico',
)

function u16(value: number): Buffer {
  const buffer = Buffer.alloc(2)
  buffer.writeUInt16LE(value)
  return buffer
}

function u32(value: number): Buffer {
  const buffer = Buffer.alloc(4)
  buffer.writeUInt32LE(value)
  return buffer
}

type BgraPixel = readonly [number, number, number, number]

const ICONDIR_LENGTH = 6
const DIRENTRY_LENGTH = 16

/**
 * Builds a minimal structurally-valid single-image ICO:
 * 6-byte ICONDIR + 16-byte ICONDIRENTRY + 40-byte BITMAPINFOHEADER +
 * one 32-bit XOR pixel + one 32-bit AND-mask row (70 bytes total).
 */
export function buildMinimalIco(pixel: BgraPixel): Buffer {
  const bitmapInfoHeaderSize = 40
  const xorLength = 4
  const andMaskLength = 4
  const imageDataLength = bitmapInfoHeaderSize + xorLength + andMaskLength

  const iconDirectory = Buffer.concat([
    u16(0), // reserved
    u16(1), // type: icon
    u16(1), // image count
  ])

  const directoryEntry = Buffer.concat([
    Buffer.from([1, 1, 0, 0]), // width, height, palette colors, reserved
    u16(1), // color planes
    u16(32), // bits per pixel
    u32(imageDataLength),
    u32(ICONDIR_LENGTH + DIRENTRY_LENGTH), // data offset
  ])

  const bitmap = Buffer.concat([
    u32(bitmapInfoHeaderSize),
    u32(1), // width
    u32(2), // height = XOR row + AND row
    u16(1), // planes
    u16(32), // bits per pixel
    u32(0), // compression: BI_RGB
    u32(xorLength + andMaskLength), // image size
    u32(0), // x pixels per meter
    u32(0), // y pixels per meter
    u32(0), // colors used
    u32(0), // colors important
    Buffer.from([pixel[0], pixel[1], pixel[2], pixel[3]]), // XOR pixel
    u32(0), // AND-mask row
  ])

  return Buffer.concat([iconDirectory, directoryEntry, bitmap])
}

function main(): number {
  // #18faf9 Savant cyan, fully opaque (BGRA byte order).
  const ico = buildMinimalIco([0xf9, 0xfa, 0x18, 0xff])
  fs.mkdirSync(path.dirname(ICON_PATH), { recursive: true })
  fs.writeFileSync(ICON_PATH, ico)
  console.log(`generate-icon: wrote ${ICON_PATH} (${ico.length} bytes)`)
  return 0
}

if (import.meta.main) {
  process.exitCode = main()
}
