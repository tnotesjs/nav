import { join } from 'path'
import { getWorkspace } from './coreWorkspace'
import { nodeIdForFolder, nodeIdForNote } from './tocNodeId'
import type { KnowledgeBaseSnapshot } from '@tnotesjs/core/workspace'

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
      /** Index-free display title (core summary.title); used for rename pre-fill. */
      noteTitle: string
      noteDir: string
      noteIndex: string
      noteUuid: string
      noteRevision: string
      tocLineIndex: number
      nodeId: string
      completed: boolean
      children: TocNode[]
    }

type SnapshotTocNode = KnowledgeBaseSnapshot['toc'][number]

function toNavTocNodes(snapshot: KnowledgeBaseSnapshot): TocNode[] {
  const byIndex = new Map(snapshot.notes.map((note) => [note.index, note]))
  const build = (nodes: SnapshotTocNode[], folderPath: string[]): TocNode[] => {
    const result: TocNode[] = []
    for (const node of nodes) {
      if (node.kind === 'folder') {
        const path = [...folderPath, node.title]
        result.push({
          type: 'group',
          title: node.title,
          tocLineIndex: node.tocLineIndex,
          nodeId: nodeIdForFolder(path),
          folderPath: path,
          children: build(node.children, path)
        })
        continue
      }
      const note = byIndex.get(node.noteIndex)
      if (!note) continue
      result.push({
        type: 'note',
        title: note.dirName,
        noteTitle: note.title,
        noteDir: note.dirName,
        noteIndex: node.noteIndex,
        noteUuid: note.uuid,
        noteRevision: note.revision,
        tocLineIndex: node.tocLineIndex,
        nodeId: nodeIdForNote(node.noteIndex),
        completed: note.config.done,
        children: build(node.children, folderPath)
      })
    }
    return result
  }
  return build(snapshot.toc, [])
}

export interface TocReadResult {
  toc: TocNode[]
  /** Snapshot revision of the repo; required for subsequent mutations. */
  revision: string
}

export async function readToc(repoRoot: string): Promise<TocReadResult> {
  const snapshot = await getWorkspace(repoRoot).inspect()
  return { toc: toNavTocNodes(snapshot), revision: snapshot.revision }
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
