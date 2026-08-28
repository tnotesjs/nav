import type { TNotesWorkspace } from '@tnotesjs/core/workspace'

// Require the CJS entry of @tnotesjs/core/workspace (dist/workspace/index.cjs).
// A static ESM `import` would make esbuild follow the ESM chain and bundle
// prettier's ESM build, which crashes in a CJS bundle (import.meta.url ->
// createRequire(undefined)). Requiring keeps the whole chain CommonJS, so
// prettier's index.cjs is bundled instead and the extension activates cleanly.
// coreWorkspace is the CJS module object; types still come from the same package.
const coreWorkspace = require('@tnotesjs/core/workspace') as typeof import(
  '@tnotesjs/core/workspace'
)
const createWorkspace = coreWorkspace.createWorkspace

const instances = new Map<string, TNotesWorkspace>()

/**
 * Get (or lazily create) the cached Core Workspace for a knowledge-base repo root.
 * One instance per repo, kept alive for the extension session so repeat reads
 * reuse the same object (TOC changes just call `refresh()` on it).
 */
export function getWorkspace(repoRoot: string): TNotesWorkspace {
  let workspace = instances.get(repoRoot)
  if (!workspace) {
    workspace = createWorkspace({ rootPath: repoRoot })
    instances.set(repoRoot, workspace)
  }
  return workspace
}

/** Dispose all cached workspaces (call on extension deactivate). */
export async function disposeWorkspaces(): Promise<void> {
  const all = [...instances.values()]
  instances.clear()
  await Promise.all(all.map((workspace) => workspace.dispose()))
}
