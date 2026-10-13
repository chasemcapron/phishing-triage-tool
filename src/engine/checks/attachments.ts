import {
  ARCHIVE_EXTS, DISK_IMAGE_EXTS, DOC_EXTS, EXEC_EXTS, HTML_EXTS, MACRO_EXTS, ONENOTE_EXTS,
} from '../data/lists'
import type { FindingSet } from '../findings'
import type { AttachmentInfo } from '../types'

export interface RawAttachment {
  filename: string | null
  mimeType: string
  disposition: string | null
  content: Uint8Array
}

const startsWith = (b: Uint8Array, sig: number[], offset = 0) => sig.every((v, i) => b[offset + i] === v)

/** Identifies a file by its leading "magic" bytes. */
export function detectFileType(b: Uint8Array): string | null {
  if (startsWith(b, [0x25, 0x50, 0x44, 0x46])) return 'pdf'
  if (startsWith(b, [0x50, 0x4b, 0x03, 0x04]) || startsWith(b, [0x50, 0x4b, 0x05, 0x06])) return 'zip'
  if (startsWith(b, [0x4d, 0x5a])) return 'exe'
  if (startsWith(b, [0x7f, 0x45, 0x4c, 0x46])) return 'elf'
  if (startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return 'ole'
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47])) return 'png'
  if (startsWith(b, [0xff, 0xd8, 0xff])) return 'jpeg'
  if (startsWith(b, [0x47, 0x49, 0x46, 0x38])) return 'gif'
  if (startsWith(b, [0x52, 0x61, 0x72, 0x21])) return 'rar'
  if (startsWith(b, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) return '7z'
  if (startsWith(b, [0x1f, 0x8b])) return 'gzip'
  if (b.length > 0x8005 && startsWith(b, [0x43, 0x44, 0x30, 0x30, 0x31], 0x8001)) return 'iso'
  const head = new TextDecoder().decode(b.slice(0, 512)).replace(/^﻿/, '').trimStart().toLowerCase()
  if (head.startsWith('<!doctype html') || head.startsWith('<html')) return 'html'
  return null
}

const FAMILY_BY_EXT: Record<string, string> = {
  pdf: 'pdf', docx: 'zip', xlsx: 'zip', pptx: 'zip', docm: 'zip', xlsm: 'zip', pptm: 'zip', zip: 'zip', jar: 'zip',
  odt: 'zip', ods: 'zip', doc: 'ole', xls: 'ole', ppt: 'ole', msg: 'ole', png: 'png', jpg: 'jpeg', jpeg: 'jpeg',
  gif: 'gif', exe: 'exe', dll: 'exe', scr: 'exe', rar: 'rar', '7z': '7z', gz: 'gzip', tgz: 'gzip', iso: 'iso',
  html: 'html', htm: 'html',
}
const FAMILY_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf', 'application/zip': 'zip', 'application/x-zip-compressed': 'zip',
  'application/msword': 'ole', 'application/vnd.ms-excel': 'ole', 'application/vnd.ms-powerpoint': 'ole',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'zip',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'zip',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'zip',
  'image/png': 'png', 'image/jpeg': 'jpeg', 'image/gif': 'gif', 'application/x-msdownload': 'exe',
  'application/vnd.rar': 'rar', 'application/x-rar-compressed': 'rar', 'application/x-7z-compressed': '7z',
  'application/gzip': 'gzip', 'application/x-iso9660-image': 'iso', 'text/html': 'html',
}

/** Lists filenames in a ZIP's central directory (stored uncompressed) without extracting anything. */
export function readZipEntries(b: Uint8Array): { names: string[]; encrypted: boolean } | null {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const minEocd = Math.max(0, b.length - 65557)
  let eocd = -1
  for (let i = b.length - 22; i >= minEocd; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) return null
  const count = view.getUint16(eocd + 10, true)
  let p = view.getUint32(eocd + 16, true)
  const names: string[] = []
  let encrypted = false
  const decoder = new TextDecoder()
  for (let n = 0; n < Math.min(count, 1000); n++) {
    if (p + 46 > b.length || view.getUint32(p, true) !== 0x02014b50) break
    if (view.getUint16(p + 8, true) & 0x1) encrypted = true
    const nameLen = view.getUint16(p + 28, true)
    const extraLen = view.getUint16(p + 30, true)
    const commentLen = view.getUint16(p + 32, true)
    names.push(decoder.decode(b.slice(p + 46, p + 46 + nameLen)))
    p += 46 + nameLen + extraLen + commentLen
  }
  return { names, encrypted }
}

export async function sha256Hex(b: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', b as Uint8Array<ArrayBuffer>)
  return [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, '0')).join('')
}

const extOf = (name: string) => /\.([a-z0-9]{1,12})$/i.exec(name.trim().replace(/[.\s]+$/, ''))?.[1]?.toLowerCase() ?? ''

export async function analyzeAttachments(raw: RawAttachment[], findings: FindingSet): Promise<AttachmentInfo[]> {
  const out: AttachmentInfo[] = []
  for (const a of raw) {
    const filename = a.filename ?? '(unnamed)'
    const info: AttachmentInfo = {
      filename, mimeType: a.mimeType, size: a.content.byteLength, sha256: await sha256Hex(a.content),
      disposition: a.disposition, detectedType: detectFileType(a.content), archiveEntries: null,
      encryptedArchive: false, flags: [],
    }
    const add = (kind: Parameters<FindingSet['add']>[0], explanation: string, evidence: string) => {
      findings.add(kind, explanation, evidence)
      if (!info.flags.includes(kind)) info.flags.push(kind)
    }
    const ext = extOf(filename)
    const parts = filename.toLowerCase().trim().split('.')

    if (/[‪-‮⁦-⁩‎‏]/.test(filename) || /\s{4,}\.[a-z0-9]+$/i.test(filename)) {
      add('att-filename-trick', `The attachment name "${filename}" uses hidden characters or padding to disguise its real file type.`, filename)
    }
    const doubleExt = parts.length >= 3 && EXEC_EXTS.has(ext) && DOC_EXTS.has(parts.at(-2)!)
    if (doubleExt) {
      add('att-double-ext', `"${filename}" pretends to be a .${parts.at(-2)} file but is really a .${ext} program.`, filename)
    }
    // A double extension already says "this is a program"; don't count the same file twice.
    if (EXEC_EXTS.has(ext)) {
      if (!doubleExt) add('att-executable', `"${filename}" is a program or script that can run code on your computer if opened.`, `${filename} (${a.mimeType})`)
    } else if (DISK_IMAGE_EXTS.has(ext)) add('att-disk-image', `"${filename}" is a disk image, often used to smuggle malware past email filters.`, filename)
    else if (ONENOTE_EXTS.has(ext)) add('att-onenote', `"${filename}" is a OneNote file, a format abused to hide malicious scripts.`, filename)
    else if (MACRO_EXTS.has(ext)) add('att-macro', `"${filename}" is an Office file that can contain macros (embedded programs).`, filename)
    else if (HTML_EXTS.has(ext) || a.mimeType === 'text/html') {
      add('att-html', `"${filename}" is a web page sent as an attachment, a common way to show a fake sign-in page offline.`, `${filename} (${a.mimeType})`)
    }

    if (ext === 'zip' || info.detectedType === 'zip') {
      const zip = ext === 'zip' || ARCHIVE_EXTS.has(ext) ? readZipEntries(a.content) : null
      if (zip) {
        info.archiveEntries = zip.names
        info.encryptedArchive = zip.encrypted
        const bad = zip.names.filter((n) => {
          const e = extOf(n)
          return EXEC_EXTS.has(e) || DISK_IMAGE_EXTS.has(e) || ONENOTE_EXTS.has(e)
        })
        if (bad.length) add('att-archive-exec', `The archive "${filename}" contains a program or script (${bad[0]}).`, `${filename}: ${bad.join(', ')}`)
        if (zip.encrypted) add('att-archive-encrypted', `"${filename}" is password-protected, which stops security scanners from looking inside.`, filename)
      }
    } else if (ARCHIVE_EXTS.has(ext)) {
      add('att-archive-unchecked', `"${filename}" is an archive whose contents this tool cannot inspect.`, filename)
    }

    const expected = FAMILY_BY_MIME[a.mimeType.toLowerCase()] ?? FAMILY_BY_EXT[ext]
    const actual = info.detectedType
    if (expected && actual && expected !== actual) {
      if (actual === 'exe' || actual === 'elf') {
        add('att-signature-exec', `"${filename}" claims to be ${expected.toUpperCase()} but its contents are actually a Windows/Linux program.`, `declared ${a.mimeType}, file signature: ${actual}`)
      } else {
        add('att-signature-mismatch', `"${filename}" claims to be ${expected.toUpperCase()} but its contents are ${actual.toUpperCase()}.`, `declared ${a.mimeType}, file signature: ${actual}`)
      }
    }
    out.push(info)
  }
  return out
}
