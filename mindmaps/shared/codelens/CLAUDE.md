# CodeLens — Codebase Intelligence Plugin

## Project Overview

An open-source multi-platform codebase intelligence tool that combines LLM analysis
with static analysis (tree-sitter) to produce interactive knowledge graph dashboards.
Runs as a native Claude Code plugin and is installable on Cursor, GitHub Copilot,
Gemini CLI, Codex, and OpenCode via a shell installer.

**Inspired by:** Understand Anything (MIT) — this is an independent implementation
with the same goals but a clean-room architecture.

---

## Prerequisites

- Node.js >= 22
- pnpm >= 10 (pinned via `packageManager` in root `package.json`)
- Python >= 3.10 (for merge/assembly scripts)

---

## Monorepo Architecture

```
codelens/
├── packages/
│   ├── core/               # Shared analysis engine (browser-safe subpath exports)
│   │   ├── src/
│   │   │   ├── types.ts          # KnowledgeGraph schema types
│   │   │   ├── schema.ts         # Zod validation + auto-fix aliases
│   │   │   ├── persistence/      # load/save knowledge-graph.json, meta.json
│   │   │   ├── search/           # Fuse.js fuzzy search over graph nodes
│   │   │   ├── languages/        # LanguageConfig registry (12 languages)
│   │   │   │   ├── types.ts
│   │   │   │   ├── registry.ts
│   │   │   │   └── configs/      # typescript.ts, python.ts, go.ts, ...
│   │   │   ├── plugins/          # AnalyzerPlugin interface + GenericTreeSitterPlugin
│   │   │   ├── ignore-filter.ts  # .understandignore / gitignore-syntax filter
│   │   │   └── ignore-generator.ts
│   │   └── package.json          # subpath exports: ./types, ./schema, ./search, ./languages
│   └── dashboard/          # React + TypeScript + Vite web dashboard
│       ├── src/
│       │   ├── App.tsx
│       │   ├── store.ts          # Zustand global store
│       │   ├── themes/           # Theme system (5 presets, 8 accent swatches each)
│       │   │   ├── types.ts
│       │   │   ├── presets.ts
│       │   │   ├── theme-engine.ts
│       │   │   └── ThemeContext.tsx
│       │   ├── components/
│       │   │   ├── GraphView.tsx          # Main React Flow canvas
│       │   │   ├── CustomNode.tsx         # Node rendering (file/fn/class/domain/...)
│       │   │   ├── ContainerNode.tsx      # Folder-group container boxes
│       │   │   ├── LayerClusterNode.tsx   # Overview layer clusters
│       │   │   ├── DomainGraphView.tsx    # Business domain horizontal flow
│       │   │   ├── KnowledgeGraphView.tsx # Force-directed knowledge base view
│       │   │   ├── Sidebar.tsx            # Info + Files tabs
│       │   │   ├── NodeInfo.tsx           # Per-node detail panel
│       │   │   ├── FileExplorer.tsx       # Files tab tree view
│       │   │   ├── SearchBar.tsx          # Fuzzy + semantic search
│       │   │   ├── ThemePicker.tsx        # Theme preset + accent selector
│       │   │   ├── PersonaSelector.tsx    # junior / pm / power-user
│       │   │   ├── TourPanel.tsx          # Guided tour controls
│       │   │   ├── FilterPanel.tsx        # Node type / layer filters
│       │   │   ├── CodeViewer.tsx         # prism-react-renderer slide-up panel
│       │   │   └── WarningBanner.tsx      # Schema validation issues
│       │   └── utils/
│       │       ├── layout.ts              # applyElkLayout (ELK), applyForceLayout
│       │       ├── elk-layout.ts          # runElk + repairElkInput + GraphIssue
│       │       ├── containers.ts          # deriveContainers (folder + Louvain fallback)
│       │       └── edgeAggregation.ts     # inter-container edge aggregation
│       └── package.json
├── plugin/                 # Plugin package (skills + agents + platform configs)
│   ├── skills/
│   │   ├── analyze/
│   │   │   ├── SKILL.md                        # /analyze orchestration (7 phases)
│   │   │   ├── project-scanner-prompt.md
│   │   │   ├── file-analyzer-prompt.md
│   │   │   ├── architecture-analyzer-prompt.md
│   │   │   ├── tour-builder-prompt.md
│   │   │   ├── graph-reviewer-prompt.md
│   │   │   ├── compute-batches.mjs             # Louvain semantic batching
│   │   │   ├── merge-batch-graphs.py           # Assembly + normalization
│   │   │   └── languages/                      # Per-language prompt addendums
│   │   │       ├── typescript.md
│   │   │       ├── python.md
│   │   │       ├── go.md  ... (12 total)
│   │   ├── analyze-dashboard/
│   │   │   └── SKILL.md                        # /analyze-dashboard
│   │   ├── analyze-chat/
│   │   │   └── SKILL.md                        # /analyze-chat
│   │   ├── analyze-diff/
│   │   │   └── SKILL.md                        # /analyze-diff
│   │   ├── analyze-explain/
│   │   │   └── SKILL.md                        # /analyze-explain
│   │   ├── analyze-onboard/
│   │   │   └── SKILL.md                        # /analyze-onboard
│   │   ├── analyze-domain/
│   │   │   ├── SKILL.md                        # /analyze-domain
│   │   │   └── extract-domain-context.py
│   │   └── analyze-knowledge/
│   │       ├── SKILL.md                        # /analyze-knowledge
│   │       └── formats/
│   │           ├── obsidian.md
│   │           ├── logseq.md
│   │           ├── karpathy.md
│   │           └── plain.md
│   ├── agents/
│   │   └── domain-analyzer.md
│   ├── .claude-plugin/
│   │   └── plugin.json
│   ├── .cursor-plugin/
│   │   └── plugin.json
│   ├── .copilot-plugin/
│   │   └── plugin.json
│   └── package.json
├── scripts/
│   └── generate-large-graph.mjs   # Performance testing fixture generator
├── install.sh                      # One-line installer for non-marketplace platforms
├── install.ps1                     # Windows PowerShell installer
├── pnpm-workspace.yaml
├── package.json                    # Root: packageManager, pnpm workspaces
├── tsconfig.json
└── vitest.config.ts
```

---

## Knowledge Graph Schema (Single Source of Truth)

Defined in `packages/core/src/types.ts`. Must not diverge from this.

```typescript
type NodeType =
  // Code
  | "file" | "function" | "class" | "module" | "concept"
  // Non-code files
  | "config" | "document" | "service" | "table" | "endpoint"
  | "pipeline" | "schema" | "resource"
  // Business domain
  | "domain" | "flow" | "step"
  // Knowledge base
  | "article" | "entity" | "topic" | "claim" | "source";

type EdgeType =
  // Structural
  | "imports" | "exports" | "contains" | "inherits" | "implements"
  // Behavioral
  | "calls" | "subscribes" | "publishes" | "middleware"
  // Data flow
  | "reads_from" | "writes_to" | "transforms" | "validates"
  // Dependencies
  | "depends_on" | "tested_by" | "configures"
  // Semantic
  | "related" | "similar_to"
  // Infrastructure
  | "deploys" | "serves" | "migrates" | "documents"
  | "provisions" | "routes" | "defines_schema" | "triggers"
  // Domain
  | "contains_flow" | "flow_step" | "cross_domain"
  // Knowledge
  | "cites" | "contradicts" | "builds_on"
  | "exemplifies" | "categorized_under" | "authored_by";

interface KnowledgeGraph {
  version: string;
  kind: "codebase" | "domain" | "knowledge";
  project: ProjectMeta;
  nodes: GraphNode[];
  edges: GraphEdge[];
  layers: Layer[];
  tour: TourStep[];
}

interface GraphNode {
  id: string;             // e.g. "file:src/auth/login.ts"
  type: NodeType;
  name: string;
  filePath?: string;
  lineRange?: [number, number];
  summary: string;        // LLM-generated plain-English description
  tags: string[];
  complexity: "simple" | "moderate" | "complex";
  languageNotes?: string;
  domainMeta?: DomainMeta;
  knowledgeMeta?: KnowledgeMeta;
}

interface GraphEdge {
  source: string;
  target: string;
  type: EdgeType;
  direction: "forward" | "backward" | "bidirectional";
  description?: string;
  weight: number;         // 0-1 importance
}
```

---

## Agent Pipeline (Phase-by-Phase)

The `/analyze` skill orchestrates 7 phases. All intermediate results go to
`.codelens/intermediate/`. Intermediate files are cleaned up after final assembly.

### Phase 0 — Pre-flight
- Verify Node >= 22, pnpm, git available.
- Check `.codelens/knowledge-graph.json` exists for incremental mode.

### Phase 0.5 — Ignore setup
- Check for `.codelens/.codelensignore`.
- If missing: run `ignore-generator.ts` → write commented-out starter file.
- Pause and ask user to review before continuing.
- Merge hardcoded defaults + user patterns via `ignore-filter.ts`.

### Phase 1 — project-scanner (agent)
- Discover all files respecting `.codelensignore`.
- Detect languages (by extension), frameworks (by config files).
- Parse import statements deterministically → `importMap`.
- Write `scan-result.json`: `{ files, importMap, languages, frameworks }`.

### Phase 1.5 — compute-batches.mjs (script, no LLM)
- Load `scan-result.json`.
- Separate code files from non-code files.
- Build undirected import graph on code files → run Louvain community detection.
- Split oversized communities (> 35 files) via edge-betweenness.
- Extract top-level exports per file via TreeSitterPlugin (for neighborMap).
- Build `neighborMap`: cross-batch 1-hop neighbors with their exported symbols.
- Apply non-code grouping heuristics (Dockerfile groups, CI groups, SQL migrations, etc.).
- Write `batches.json`: `{ batches: [{ batchIndex, files, batchImportData, neighborMap }] }`.
- On Louvain failure: fall back to count-based (12 files/batch) + emit warning.

### Phase 2 — file-analyzer agents (parallel, ≤ 5 concurrent)
- Read `batches.json`. Dispatch one subagent per batch.
- Each agent receives: `batchFiles`, `batchImportData`, `neighborMap`.
- Agent extracts: nodes (file + functions + classes) + edges.
- Output size check: if > 60 nodes OR > 120 edges → split into `batch-N-part-K.json`.
- Write `batch-<N>.json` or `batch-<N>-part-<K>.json`.
- Run `merge-batch-graphs.py` after all batches complete.

**merge-batch-graphs.py responsibilities:**
- Glob all `batch-*.json`, sort by index then part.
- Merge nodes + edges, deduplicate by ID.
- `recover_imports_from_scan`: restore any `imports` edges dropped by batch boundaries.
- Apply schema aliases (e.g. `container` → `service`).
- Validate referential integrity; drop dangling edges.
- Write `assembled-graph.json`.

### Phase 3 — architecture-analyzer (agent)
- Input: file nodes only from assembled graph (slim format: `{id, filePath, summary, tags}`).
- Inject relevant language/framework addendum files.
- Output: layer assignments → write to assembled graph.

### Phase 4 — tour-builder (agent)
- Input: file nodes only (slim), `imports` + `calls` edges only, layers (no nodeIds).
- BFS traversal to determine pedagogically optimal node order.
- Output: `TourStep[]` → write to assembled graph.

### Phase 5 — graph-reviewer
- **Default (no flag):** Run deterministic inline script:
  - Referential integrity (all edge source/target IDs exist).
  - Every file node in exactly one layer.
  - All tour step nodeIds exist.
  - No duplicate node IDs.
  - Required fields present.
  - Auto-fix: remove dangling edges, fill defaults.
- **`--review` flag:** Full LLM reviewer subagent (quality review: orphan nodes,
  generic summaries, tour coherence).

### Phase 6 — Save + cleanup
- Write `.codelens/knowledge-graph.json`.
- Write `.codelens/meta.json`: `{ lastAnalyzedAt, gitCommitHash, version, analyzedFiles, theme? }`.
- Delete all `intermediate/` files.
- Auto-trigger `/analyze-dashboard`.

---

## Dashboard Architecture

### Tech Stack
- React 18 + TypeScript + Vite
- React Flow — graph canvas
- ELK (elkjs ^0.9) — layout engine (replaces dagre)
- Louvain (graphology + graphology-communities-louvain) — container derivation
- Zustand — state management
- TailwindCSS v4 — styling
- prism-react-renderer — code viewer syntax highlighting
- Fuse.js — fuzzy search

### Layout Strategy
Three distinct layout modes:

1. **Overview (layer clusters):** ELK layered, layer clusters as opaque nodes.
2. **Layer-detail (structural):** Two-stage lazy ELK.
   - Stage 1: ELK on containers (folder groups or Louvain communities).
   - Stage 2: ELK per container, triggered on click / zoom > 1.0 / search hit.
   - Edge aggregation: inter-container edges collapsed to thick annotated lines.
3. **Domain view:** ELK with `rankdir: LR`. Domains → flows → steps left-to-right.
4. **Knowledge view:** Force-directed (d3-force). Topic clusters → articles → entities.

### Graph Data Flow (in the dashboard)
```
load knowledge-graph.json
  → schema validate → WarningBanner if issues
  → Zustand store: { graph, viewMode, activeLayer, expandedContainers,
                     selectedNodeId, searchQuery, persona, diffMode,
                     tourStep, themeConfig }
  → GraphView: derive containers → Stage 1 ELK → React Flow render
  → user interaction → store update → selective re-render
```

### Sidebar
Two tabs: **Info** and **Files**.
- **Info tab:** ProjectOverview (default) → NodeInfo (node selected) → LearnPanel (Learn persona).
- **Files tab:** FileExplorer tree built from structural graph `file` nodes.

### Code Viewer
- Triggered by clicking a `file` node.
- Slides up from bottom; expand button promotes to full-screen modal.
- Fetches source from `/file-content.json` endpoint (dev server).
- Gated by access token + graph-derived path allowlist.

### Theme System
- 5 presets: Dark Gold (default), Dark Ocean, Dark Forest, Dark Rose, Light Minimal.
- 8 accent swatches per preset (curated, no free picker).
- Zero-reload switching via CSS variable injection.
- Persistence: `localStorage` > `meta.json.theme` > hard default (`dark-gold`).
- CSS variable naming: `--color-accent` (not `--color-gold`).

---

## Multi-Platform Support

### Plugin manifest files (keep versions in sync)
- `plugin/package.json` → `"version"`
- `plugin/.claude-plugin/plugin.json` → `"version"`
- `plugin/.cursor-plugin/plugin.json` → `"version"`
- `plugin/.copilot-plugin/plugin.json` → `"version"`
- Root `package.json` → `"version"`

Do NOT add a `version` field to marketplace.json — it breaks schema validation.

### Platform compatibility matrix
| Platform | Install method |
|----------|---------------|
| Claude Code | `/plugin marketplace add <owner>/codelens` |
| Cursor | Auto-discovery via `.cursor-plugin/plugin.json` |
| VS Code + Copilot | Auto-discovery via `.copilot-plugin/plugin.json` |
| Codex / OpenCode / Gemini CLI / Trae / Cline | `install.sh <platform>` |
| Windows | `install.ps1` |

### Agent model field
**Never set `model: inherit` in agent frontmatter.** Omit the field entirely.
`inherit` is Claude Code-only; other platforms (opencode, Trae, etc.) treat it as a
literal model ID and throw `ProviderModelNotFoundError`.

---

## Skill Commands

| Command | Description |
|---------|-------------|
| `/analyze` | Full or incremental analysis + auto-open dashboard |
| `/analyze-dashboard` | Open dashboard for existing graph |
| `/analyze-chat <query>` | Terminal Q&A using the knowledge graph |
| `/analyze-diff` | Impact analysis of current uncommitted changes |
| `/analyze-explain <path>` | Deep-dive on a specific file or function |
| `/analyze-onboard` | Generate onboarding guide for new team members |
| `/analyze-domain` | Extract business domain knowledge → domain-graph.json |
| `/analyze-knowledge [path]` | Analyze markdown knowledge base (Obsidian, Karpathy, etc.) |

### Flags
- `--full` — force full rescan even if graph exists
- `--review` — run full LLM graph-reviewer (default: deterministic inline)
- `--language <code>` — output language for summaries (en, zh, ja, ko, ru)
- `--auto-update` — install post-commit hook for incremental updates
- `--changed-files <path>` — internal flag for incremental mode

---

## Key Commands (Development)

```bash
pnpm install                                       # Install all dependencies
pnpm --filter @codelens/core build                 # Build core package
pnpm --filter @codelens/core test                  # Run core tests
pnpm --filter @codelens/dashboard build            # Build dashboard
pnpm dev:dashboard                                 # Start dashboard dev server
pnpm test                                          # Run all tests (root vitest.config.ts)
pnpm lint                                          # ESLint across all packages
```

---

## Conventions

- TypeScript strict mode everywhere.
- Vitest for all tests. Tests live in `packages/*/src/__tests__/` and `tests/skill/`.
- ESM modules (`"type": "module"` in all package.json files).
- Knowledge graph JSON lives in `.codelens/` directory of analyzed projects.
- Dashboard must ONLY import from core's browser-safe subpath exports
  (`./types`, `./schema`, `./search`, `./languages`). Never the main entry point
  (it pulls in Node.js modules that break the browser bundle).

---

## Gotchas

### tree-sitter (WASM, not native)
Use `web-tree-sitter` (WASM) instead of native `tree-sitter`. Native bindings
fail on darwin/arm64 + Node 24. WASM grammars load lazily and are cached per-session.

### Dashboard color variables
All gold/amber references in the original should use `--color-accent`,
`--color-accent-dim`, `--color-accent-bright`. Never hardcode `rgba(212,165,116,...)`.
Hardcoded colors won't respond to theme switching.

### ELK async + stale layout
ELK is Promise-based. Always use a `cancelled` flag in `useEffect` to discard
stale layout results when dependencies change:
```typescript
useEffect(() => {
  let cancelled = false;
  applyElkLayout(input).then(result => {
    if (!cancelled) setLayout(result);
  });
  return () => { cancelled = true; };
}, [graph, activeLayerId, persona, nodeTypeFilters]);
```

### Container size memory (Stage 2 layout)
After Stage 2 completes, store the actual container dimensions in
`containerSizeMemory`. On Stage 1 re-run, use stored sizes instead of
`sqrt(childCount)` estimate. If actual size differs > 20% from estimate,
trigger a Stage 1 re-layout.

### Louvain community naming
Louvain communities get placeholder names (`Cluster A`, `Cluster B`, ...) since
no semantic name is derivable. The UI shows "Grouped by edge density" when
Louvain is used, vs "Grouped by folder" for folder-based grouping.

### Output chunking thresholds
`60 nodes / 120 edges` per file-analyzer output part. These are calibrated for
Bedrock OPUS (4096–8192 max_tokens default). First-party Anthropic is more
permissive but use conservative thresholds until adaptive tuning is implemented.

### .codelensignore (two locations)
The filter merges patterns from:
1. Hardcoded defaults (node_modules/, dist/, build/, *.lock, etc.)
2. `.codelens/.codelensignore` (project-level)
3. `.codelensignore` (project root, alternative location)
`!` negation in user files overrides hardcoded defaults.

### graph JSON output path
All intermediate files → `.codelens/intermediate/` (cleaned up after assembly).
Final outputs → `.codelens/knowledge-graph.json` and `.codelens/meta.json`.
`domain-graph.json` and a second `knowledge-graph.json` (kind: "knowledge") also
live in `.codelens/`.

---

## Build Phases (Implementation Order)

Implement in this order. Each phase is independently testable before proceeding.

### Phase A — Foundation (Weeks 1–3)
1. Monorepo scaffolding: pnpm workspaces, TypeScript strict, Vitest, ESLint.
2. `packages/core`: KnowledgeGraph types + Zod schema + aliases + subpath exports.
3. `packages/core`: Persistence (read/write JSON, staleness detection via git hash).
4. `packages/core`: LanguageConfig + LanguageRegistry (12 language configs).
5. `packages/core`: GenericTreeSitterPlugin (WASM, config-driven extraction).
6. `packages/core`: IgnoreFilter + IgnoreGenerator.
7. Plugin skeleton: `.claude-plugin/plugin.json`, `/analyze` skill stub.

### Phase B — Analysis Pipeline (Weeks 4–7)
8. `project-scanner-prompt.md` + scan result schema.
9. `compute-batches.mjs`: Louvain batching + neighborMap + non-code heuristics + fallback.
10. `file-analyzer-prompt.md`: extraction protocol + neighborMap context + output chunking.
11. `merge-batch-graphs.py`: merge + normalize + recover_imports + validate.
12. `architecture-analyzer-prompt.md`.
13. `tour-builder-prompt.md`.
14. `graph-reviewer-prompt.md` + deterministic inline reviewer.
15. Wire all phases in `skills/analyze/SKILL.md`.
16. Test end-to-end on this repo (codelens analyzes itself).

### Phase C — Dashboard Core (Weeks 8–11)
17. React + Vite scaffold, Zustand store, TailwindCSS v4.
18. Schema validation + WarningBanner.
19. ELK integration: `elk-layout.ts`, `repairElkInput`, loading state.
20. `deriveContainers` (folder strategy + Louvain fallback).
21. Edge aggregation + ContainerNode component.
22. CustomNode, LayerClusterNode, GraphView (overview + layer-detail).
23. Two-stage lazy layout with `expandedContainers`, `containerLayoutCache`.
24. Sidebar: Info tab (ProjectOverview + NodeInfo) + Files tab (FileExplorer).
25. Search bar: fuzzy (Fuse.js) + semantic keyword matching.
26. Code viewer: prism-react-renderer slide-up panel + full-screen modal.
27. `/analyze-dashboard` skill: starts Vite dev server, opens browser.

### Phase D — Theme + Persona (Week 12)
28. Theme system: 5 presets, 8 accent swatches, CSS variable injection.
29. ThemePicker component in header.
30. Persona selector (junior / pm / power-user) → node-type filter changes.
31. Light Minimal theme: inverted contrast, adjusted node colors.

### Phase E — Advanced Skills (Weeks 13–16)
32. `/analyze-chat`: terminal Q&A with graph as context.
33. `/analyze-diff`: git diff → impacted nodes highlighted in dashboard.
34. `/analyze-explain <path>`: deep-dive single file/function.
35. `/analyze-onboard`: structured markdown onboarding guide.
36. Language-agnostic prompt addendums (12 language files in `skills/analyze/languages/`).
37. Non-code file support: 26 file types, 8 new node types, 8 new edge types.

### Phase F — Domain + Knowledge (Weeks 17–20)
38. `/analyze-domain`: domain-analyzer agent, horizontal flow layout (DomainGraphView).
39. Domain sidebar (domain/flow/step node panels), drill-down to structural view.
40. `/analyze-knowledge`: knowledge-scanner + format-detector + article-analyzer
    + relationship-builder. Format guides: Obsidian, Logseq, Karpathy, plain.
41. KnowledgeGraphView: force-directed layout, reading mode panel.
42. Knowledge sidebar (article/entity/topic/claim/source panels).

### Phase G — Multi-Platform + Polish (Weeks 21–24)
43. `.cursor-plugin/plugin.json` + `.copilot-plugin/plugin.json`.
44. `install.sh` + `install.ps1` for Codex, OpenCode, Gemini CLI, Trae, Cline, etc.
45. `--language` flag: localized summaries + dashboard UI (en, zh, ja, ko, ru).
46. `--auto-update`: post-commit hook for incremental updates.
47. `scripts/generate-large-graph.mjs`: performance testing fixture (3000+ nodes).
48. Performance: Stage 1 ELK < 100ms at 500 nodes, Stage 2 < 100ms per container.
49. README, platform compatibility table, live demo setup.
50. Version bump all 5 manifest files, tag v1.0.0.

---

## Testing Strategy

### Unit tests (Vitest)
- `packages/core/src/__tests__/schema.test.ts` — Zod validation + alias normalization
- `packages/core/src/__tests__/language-registry.test.ts` — all 12 configs valid, lookup by extension
- `packages/core/src/__tests__/generic-tree-sitter-plugin.test.ts` — per-language fixture files
- `packages/core/src/__tests__/ignore-filter.test.ts` — pattern matching, negation, merge
- `packages/core/src/__tests__/ignore-generator.test.ts` — detection heuristics, output format
- `packages/dashboard/src/utils/containers.test.ts` — folder strategy, Louvain fallback, edge cases
- `packages/dashboard/src/utils/edgeAggregation.test.ts` — inter/intra split, count/types
- `packages/dashboard/src/utils/elk-layout.test.ts` — repair functions, issue level, async cancel
- `plugin/skills/analyze/test_compute_batches.test.mjs` — Louvain batching, neighborMap,
  fallback path, warning text assertions (exact strings)
- `plugin/skills/analyze/test_merge_batch_graphs.test.py` — multi-part merge, missing parts,
  recover_imports, dangling edge handling

### Integration tests
- End-to-end: run `/analyze` on this repo → verify `knowledge-graph.json` schema valid.
- Incremental: modify one file → re-analyze → verify only that file's nodes updated.
- Multi-part: fixture batch with 70 nodes → verify split into two parts → merge correct.
- Multi-language: TS + Python fixture → nodes from both languages in assembled graph.

### Performance benchmarks
- Use `scripts/generate-large-graph.mjs` at 500 / 1000 / 3000 nodes.
- Stage 1 ELK: < 200ms at 500 nodes, < 500ms at 3000 nodes.
- Stage 2 ELK (per container): < 100ms first expand, < 5ms cache hit.

---

## Versioning

When pushing to remote, bump the version in ALL FIVE of these files (keep in sync):
- `plugin/package.json` → `"version"` field
- `plugin/.claude-plugin/plugin.json` → `"version"` field
- `plugin/.cursor-plugin/plugin.json` → `"version"` field
- `plugin/.copilot-plugin/plugin.json` → `"version"` field
- Root `package.json` → `"version"` field

The `marketplace.json` entry only supports `name` and `source` fields.
Adding any other fields (including `version`) causes marketplace schema validation failures.

---

## Testing Local Plugin Changes

Claude Code caches plugins at `~/.claude/plugins/cache/<owner>/<repo>/<version>/`.
Symlinks are not followed by Claude's Search/Glob tools.

```bash
# 1. Build packages
pnpm --filter @codelens/core build
pnpm --filter @codelens/plugin build

# 2. Find installed version
ls ~/.claude/plugins/cache/<owner>/codelens/

# 3. Copy into cache (replace <VERSION>)
rm -rf ~/.claude/plugins/cache/<owner>/codelens/<VERSION>
cp -R ./plugin ~/.claude/plugins/cache/<owner>/codelens/<VERSION>

# 4. Start fresh Claude Code session
# 5. Run /analyze --full on a test project
```

Re-sync after further changes:
```bash
pnpm --filter @codelens/core build && \
cp -R ./plugin/* ~/.claude/plugins/cache/<owner>/codelens/<VERSION>/
```
