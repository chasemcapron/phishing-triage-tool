import { describe, expect, it } from 'vitest'
import { analyzeAttachments, detectFileType, readZipEntries, sha256Hex, type RawAttachment } from '../src/engine/checks/attachments'
import { FindingSet } from '../src/engine/findings'

/** Builds a minimal stored (uncompressed) ZIP with the given entry names. */
function makeZip(names: string[], encrypted = false): Uint8Array {
  const enc = new TextEncoder()
  const local: number[] = []
  const central: number[] = []
  const u16 = (n: number) => [n & 0xff, (n >> 8) & 0xff]
  const u32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff]
  const flags = encrypted ? 1 : 0
  for (const name of names) {
    const nb = [...enc.encode(name)]
    const offset = local.length
    local.push(...u32(0x04034b50), ...u16(20), ...u16(flags), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(0), ...u32(0), ...u16(nb.length), ...u16(0), ...nb)
    central.push(...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(flags), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(0), ...u32(0),
      ...u16(nb.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...nb)
  }
  const eocd = [...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(names.length), ...u16(names.length), ...u32(central.length), ...u32(local.length), ...u16(0)]
  return new Uint8Array([...local, ...central, ...eocd])
}

const att = (filename: string, mimeType: string, content: Uint8Array | string): RawAttachment => ({
  filename, mimeType, disposition: 'attachment', content: typeof content === 'string' ? new TextEncoder().encode(content) : content,
})

async function kindsFor(a: RawAttachment) {
  const findings = new FindingSet()
  const [info] = await analyzeAttachments([a], findings)
  return { kinds: findings.list().map((f) => f.kind), info: info! }
}

describe('detectFileType', () => {
  it.each([
    [[0x25, 0x50, 0x44, 0x46, 0x2d], 'pdf'],
    [[0x4d, 0x5a, 0x90, 0x00], 'exe'],
    [[0x50, 0x4b, 0x03, 0x04], 'zip'],
    [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], 'ole'],
    [[0x89, 0x50, 0x4e, 0x47], 'png'],
  ])('%j → %s', (bytes, type) => {
    expect(detectFileType(new Uint8Array(bytes))).toBe(type)
  })
})

describe('readZipEntries', () => {
  it('lists names and the encryption flag without extracting', () => {
    expect(readZipEntries(makeZip(['a.txt', 'b/run.js'], true))).toEqual({ names: ['a.txt', 'b/run.js'], encrypted: true })
    expect(readZipEntries(new Uint8Array([1, 2, 3]))).toBeNull()
  })
})

describe('analyzeAttachments', () => {
  it('computes SHA-256 in the browser crypto API', async () => {
    expect(await sha256Hex(new TextEncoder().encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('flags an executable inside a ZIP and password protection', async () => {
    const { kinds, info } = await kindsFor(att('docs.zip', 'application/zip', makeZip(['invoice.pdf.lnk'], true)))
    expect(kinds).toEqual(expect.arrayContaining(['att-archive-exec', 'att-archive-encrypted']))
    expect(info.archiveEntries).toEqual(['invoice.pdf.lnk'])
  })

  it.each([
    ['report.iso', 'application/octet-stream', 'att-disk-image'],
    ['notes.one', 'application/octet-stream', 'att-onenote'],
    ['budget.xlsm', 'application/vnd.ms-excel.sheet.macroEnabled.12', 'att-macro'],
    ['run.vbs', 'text/plain', 'att-executable'],
    ['page.htm', 'text/html', 'att-html'],
    ['files.rar', 'application/vnd.rar', 'att-archive-unchecked'],
  ])('%s → %s', async (name, mime, kind) => {
    expect((await kindsFor(att(name, mime, 'x'))).kinds).toContain(kind)
  })

  it('flags right-to-left override filename tricks', async () => {
    expect((await kindsFor(att('invoice‮fdp.exe', 'application/pdf', 'x'))).kinds).toContain('att-filename-trick')
  })

  it('flags a declared type that does not match the file signature', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0])
    expect((await kindsFor(att('scan.pdf', 'application/pdf', png))).kinds).toContain('att-signature-mismatch')
  })

  it('raises nothing for an ordinary PDF', async () => {
    expect((await kindsFor(att('statement.pdf', 'application/pdf', '%PDF-1.7 ...'))).kinds).toEqual([])
  })
})
