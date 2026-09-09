import { existsSync, readdirSync, statSync } from 'fs'
import { basename, join } from 'path'

export type WorkspaceMode = 'multi' | 'single' | 'none'

export type DetectedWorkspace =
  | { mode: 'multi'; root: string }
  | { mode: 'single'; root: string; repoName: string; format: 'new' | 'legacy' }
  | { mode: 'none'; root: string | null }

const TOC_FILE = 'TOC.md'
const KB_CONFIG_FILE = 'tnotes.json'
const LEGACY_CONFIG_FILE = '.tnotes.json'

function hasTNotesSiblingDir(root: string): boolean {
  try {
    return readdirSync(root, { withFileTypes: true }).some(
      (entry) => entry.isDirectory() && entry.name.startsWith('TNotes.')
    )
  } catch {
    return false
  }
}

function isFile(root: string, name: string): boolean {
  try {
    return existsSync(join(root, name)) && statSync(join(root, name)).isFile()
  } catch {
    return false
  }
}

/**
 * Single-KB detection: TOC.md + tnotes.json (new single-file format).
 * Legacy repos (TOC.md + .tnotes.json) are still recognized so the panel can
 * show a migration hint instead of pretending there is no knowledge base.
 */
function singleKbFormat(root: string): 'new' | 'legacy' | null {
  if (!isFile(root, TOC_FILE)) return null
  if (isFile(root, KB_CONFIG_FILE)) return 'new'
  if (isFile(root, LEGACY_CONFIG_FILE)) return 'legacy'
  return null
}

/**
 * Detect multi / single / none from an opened folder root.
 * Priority: multi (any TNotes.* dir) → single (required files) → none.
 */
export function detectWorkspaceMode(root: string | undefined | null): DetectedWorkspace {
  if (!root || !existsSync(root)) {
    return { mode: 'none', root: root ?? null }
  }

  try {
    if (!statSync(root).isDirectory()) {
      return { mode: 'none', root }
    }
  } catch {
    return { mode: 'none', root }
  }

  if (hasTNotesSiblingDir(root)) {
    return { mode: 'multi', root }
  }

  const format = singleKbFormat(root)
  if (format) {
    return { mode: 'single', root, repoName: basename(root), format }
  }

  return { mode: 'none', root }
}
