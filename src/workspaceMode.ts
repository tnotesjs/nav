import { existsSync, readdirSync, statSync } from 'fs'
import { basename, join } from 'path'

export type WorkspaceMode = 'multi' | 'single' | 'none'

export type DetectedWorkspace =
  | { mode: 'multi'; root: string }
  | { mode: 'single'; root: string; repoName: string }
  | { mode: 'none'; root: string | null }

const SINGLE_REQUIRED_FILES = [
  '.tnotes.json',
  'TOC.md',
  'sidebar.json',
  'index.md'
] as const

function hasTNotesSiblingDir(root: string): boolean {
  try {
    return readdirSync(root, { withFileTypes: true }).some(
      (entry) => entry.isDirectory() && entry.name.startsWith('TNotes.')
    )
  } catch {
    return false
  }
}

function hasSingleKbFiles(root: string): boolean {
  return SINGLE_REQUIRED_FILES.every((name) => {
    const path = join(root, name)
    try {
      return existsSync(path) && statSync(path).isFile()
    } catch {
      return false
    }
  })
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

  if (hasSingleKbFiles(root)) {
    return { mode: 'single', root, repoName: basename(root) }
  }

  return { mode: 'none', root }
}
