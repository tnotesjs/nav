import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { scanNotes } from './notes'
import {
  getTocLineCompleted,
  parseTocToTree,
  resolveNoteFromIndex,
  type TocTreeNode
} from './tocHelpers'
import { nodeIdForFolder, nodeIdForNote } from './tocNodeId'
import type { NoteInfo } from './types'

export type TocNode =
  | {
      type: 'group'
      title: string
      tocLineIndex: number
      nodeId: string
      folderPath: string[]
      children: TocNode[]
    }
  | {
      type: 'note'
      title: string
      noteDir: string
      noteIndex: string
      tocLineIndex: number
      nodeId: string
      completed: boolean
      children: TocNode[]
    }

function tocPath(repoRoot: string): string {
  return join(repoRoot, 'TOC.md')
}

function toTocNodes(
  tree: TocTreeNode[],
  notes: NoteInfo[],
  folderPath: string[] = []
): TocNode[] {
  const result: TocNode[] = []
  for (const node of tree) {
    if (node.kind === 'folder') {
      const path = [...folderPath, node.title]
      result.push({
        type: 'group',
        title: node.title,
        tocLineIndex: node.tocLineIndex,
        nodeId: nodeIdForFolder(path),
        folderPath: path,
        children: toTocNodes(node.children, notes, path)
      })
      continue
    }
    const note = resolveNoteFromIndex(node.noteIndex, notes)
    if (!note) continue
    result.push({
      type: 'note',
      title: note.dirName,
      noteDir: note.dirName,
      noteIndex: node.noteIndex,
      tocLineIndex: node.tocLineIndex,
      nodeId: nodeIdForNote(node.noteIndex),
      completed: getTocLineCompleted(note),
      children: toTocNodes(node.children, notes, folderPath)
    })
  }
  return result
}

export function readToc(repoRoot: string): TocNode[] {
  const file = tocPath(repoRoot)
  if (!existsSync(file)) {
    throw new Error('TOC.md 不存在')
  }
  const notes = scanNotes(repoRoot)
  const lines = readFileSync(file, 'utf-8').split('\n')
  const tree = parseTocToTree(lines, notes)
  return toTocNodes(tree, notes)
}

export function noteReadmePath(repoRoot: string, noteDir: string): string {
  return join(repoRoot, 'notes', noteDir, 'README.md')
}

export function repoReadmePath(repoRoot: string): string {
  return join(repoRoot, 'README.md')
}

/** Snapshot used by the TOC pinned shortcuts section. */
export type TocPinnedNode = {
  type: 'group' | 'note'
  nodeId: string
  title: string
  noteDir?: string
  completed?: boolean
}

export function findTocNode(
  nodes: TocNode[],
  nodeId: string,
  ancestors: string[] = []
): { node: TocNode; ancestorIds: string[] } | null {
  for (const node of nodes) {
    if (node.nodeId === nodeId) {
      return { node, ancestorIds: ancestors }
    }
    if (node.children.length) {
      const found = findTocNode(node.children, nodeId, [...ancestors, node.nodeId])
      if (found) return found
    }
  }
  return null
}

export function collectTocNodeIds(nodes: TocNode[]): Set<string> {
  const ids = new Set<string>()
  const walk = (list: TocNode[]) => {
    for (const node of list) {
      ids.add(node.nodeId)
      if (node.children.length) walk(node.children)
    }
  }
  walk(nodes)
  return ids
}

export function filterPinnedTocIds(pinnedIds: string[], toc: TocNode[]): string[] {
  const existing = collectTocNodeIds(toc)
  return pinnedIds.filter((id) => existing.has(id))
}

export function flattenPinnedNodes(toc: TocNode[], pinnedIds: string[]): TocPinnedNode[] {
  const result: TocPinnedNode[] = []
  for (const id of pinnedIds) {
    const found = findTocNode(toc, id)
    if (!found) continue
    const { node } = found
    if (node.type === 'group') {
      result.push({ type: 'group', nodeId: node.nodeId, title: node.title })
    } else {
      result.push({
        type: 'note',
        nodeId: node.nodeId,
        title: node.title,
        noteDir: node.noteDir,
        completed: node.completed
      })
    }
  }
  return result
}
