/**
 * Read-only TOC.md parse helpers (adapted from desk tocHelpers).
 */

import type { NoteConfig, NoteInfo } from './types'

export const TOC_INDENT_SPACES = 2

export type TocLineKind = 'folder' | 'note' | 'unknown'

export interface ParsedTocLine {
  kind: TocLineKind
  isMatch: boolean
  indentLevel: number
  noteIndex: string | null
  folderTitle: string | null
  completed: boolean
  rawLine: string
}

export interface TocFolderNode {
  kind: 'folder'
  title: string
  indent: number
  tocLineIndex: number
  children: TocTreeNode[]
}

export interface TocNoteNode {
  kind: 'note'
  noteIndex: string
  indent: number
  tocLineIndex: number
  children: TocTreeNode[]
}

export type TocTreeNode = TocFolderNode | TocNoteNode

const TOC_LEGACY_FULL_REGEX =
  /^( *)(-\s+\[(x| )\])\s+\[(\d{4}\.[^\]]+)\]\(([^)]+)\)/

const TOC_NOTE_LINE_REGEX =
  /^( *)(-\s+\[(x| )\])\s+(\d{4})(?:\.\s*(.*))?\s*$/

const TOC_FOLDER_LINE_REGEX = /^( *)(-\s+(?!\[(?:x| )\]).+?)\s*$/

function extractNoteIndexFromTitle(text: string): string | null {
  const match = text.match(/^(\d{4})\./)
  return match ? match[1] : null
}

function parseIndent(spaces: string | undefined): number {
  return Math.floor((spaces?.length ?? 0) / TOC_INDENT_SPACES)
}

export function parseTocLine(line: string | undefined | null): ParsedTocLine {
  const rawLine = line ?? ''
  const empty: ParsedTocLine = {
    kind: 'unknown',
    isMatch: false,
    indentLevel: 0,
    noteIndex: null,
    folderTitle: null,
    completed: false,
    rawLine
  }

  if (line == null) return empty

  const legacyMatch = line.match(TOC_LEGACY_FULL_REGEX)
  if (legacyMatch) {
    const [, spaces, , statusChar, titleText] = legacyMatch
    const noteIndex = extractNoteIndexFromTitle(titleText)
    if (!noteIndex) return empty
    return {
      kind: 'note',
      isMatch: true,
      indentLevel: parseIndent(spaces),
      noteIndex,
      folderTitle: null,
      completed: statusChar === 'x',
      rawLine
    }
  }

  const noteMatch = line.match(TOC_NOTE_LINE_REGEX)
  if (noteMatch) {
    const [, spaces, , statusChar, noteIndex] = noteMatch
    return {
      kind: 'note',
      isMatch: true,
      indentLevel: parseIndent(spaces),
      noteIndex,
      folderTitle: null,
      completed: statusChar === 'x',
      rawLine
    }
  }

  const folderMatch = line.match(TOC_FOLDER_LINE_REGEX)
  if (folderMatch) {
    const [, spaces, titlePart] = folderMatch
    const title = titlePart.replace(/^-\s+/, '').trim()
    if (!title) return empty
    return {
      kind: 'folder',
      isMatch: true,
      indentLevel: parseIndent(spaces),
      noteIndex: null,
      folderTitle: title,
      completed: false,
      rawLine
    }
  }

  return empty
}

export function resolveNoteFromIndex(
  index: string,
  notes: NoteInfo[]
): NoteInfo | undefined {
  return notes.find((n) => n.index === index)
}

export function getTocLineCompleted(
  note: NoteInfo,
  configOverride?: Partial<NoteConfig>
): boolean {
  const config = configOverride
    ? { ...note.config, ...configOverride }
    : note.config
  return config?.done ?? false
}

interface MutableTreeNode {
  kind: 'folder' | 'note'
  title?: string
  noteIndex?: string
  indent: number
  tocLineIndex: number
  children: MutableTreeNode[]
}

function mutableToTreeNode(node: MutableTreeNode): TocTreeNode {
  if (node.kind === 'folder') {
    return {
      kind: 'folder',
      title: node.title!,
      indent: node.indent,
      tocLineIndex: node.tocLineIndex,
      children: node.children.map(mutableToTreeNode)
    }
  }
  return {
    kind: 'note',
    noteIndex: node.noteIndex!,
    indent: node.indent,
    tocLineIndex: node.tocLineIndex,
    children: node.children.map(mutableToTreeNode)
  }
}

function buildMutableTreeFromFlat(
  flatNodes: Array<{
    kind: 'folder' | 'note'
    title?: string
    noteIndex?: string
    indent: number
    tocLineIndex: number
  }>
): MutableTreeNode[] {
  const roots: MutableTreeNode[] = []
  const stack: MutableTreeNode[] = []

  for (const item of flatNodes) {
    while (stack.length > 0 && stack[stack.length - 1].indent >= item.indent) {
      stack.pop()
    }

    const node: MutableTreeNode = {
      kind: item.kind,
      title: item.title,
      noteIndex: item.noteIndex,
      indent: item.indent,
      tocLineIndex: item.tocLineIndex,
      children: []
    }

    if (stack.length === 0) {
      roots.push(node)
    } else {
      stack[stack.length - 1].children.push(node)
    }

    stack.push(node)
  }

  return roots
}

export function parseTocToMutableTree(
  lines: string[],
  notes: NoteInfo[]
): MutableTreeNode[] {
  const flatNodes: Array<{
    kind: 'folder' | 'note'
    title?: string
    noteIndex?: string
    indent: number
    tocLineIndex: number
  }> = []

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]
    const parsed = parseTocLine(line)
    if (!parsed.isMatch) continue

    if (parsed.kind === 'folder') {
      flatNodes.push({
        kind: 'folder',
        title: parsed.folderTitle!,
        indent: parsed.indentLevel,
        tocLineIndex: lineIndex
      })
      continue
    }

    if (!parsed.noteIndex) continue
    if (!resolveNoteFromIndex(parsed.noteIndex, notes)) continue

    flatNodes.push({
      kind: 'note',
      noteIndex: parsed.noteIndex,
      indent: parsed.indentLevel,
      tocLineIndex: lineIndex
    })
  }

  return buildMutableTreeFromFlat(flatNodes)
}

export function parseTocToTree(lines: string[], notes: NoteInfo[]): TocTreeNode[] {
  return parseTocToMutableTree(lines, notes).map(mutableToTreeNode)
}
