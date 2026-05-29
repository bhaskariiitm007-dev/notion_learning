# Phase B Prompt — Analysis Pipeline

Paste this after Phase A is confirmed complete.

---

Phase A is confirmed. Begin **Phase B — Analysis Pipeline**.
Read CLAUDE.md again before starting. Do tasks in order. Commit after each.

## Phase B tasks

### B1 — project-scanner-prompt.md

Write `plugin/skills/analyze/project-scanner-prompt.md`. This is the full
instruction prompt for the project-scanner subagent. It must cover:

**Input:** Project root path, file list (after IgnoreFilter applied).

**Steps the agent must perform:**
1. Walk the directory tree, apply ignore rules.
2. For each file: detect language by extension using LanguageRegistry.
3. Detect frameworks: look for `package.json` (React, Vue, Next, Express, etc.),
   `pyproject.toml` / `setup.py` (FastAPI, Django, Flask), `go.mod`,
   `Cargo.toml`, `pom.xml`, `build.gradle`, etc.
4. Parse import statements for each source file (language-specific patterns).
5. Resolve relative imports against the discovered file list (try `.ts`, `.tsx`,
   `.js`, `.jsx`, `/index.ts`, `/index.js` variants for extensionless imports).
6. Build `importMap: Record<string, string[]>` — project-relative paths only,
   external/unresolvable imports excluded.
7. Count lines per file.
8. Detect entry points (exported route handlers, `main()`, CLI entry, etc.).

**Output:** Write `$PROJECT_ROOT/.codelens/intermediate/scan-result.json`:
```json
{
  "files": [{ "path": "...", "language": "typescript", "sizeLines": 120,
              "fileCategory": "code" }],
  "importMap": { "src/index.ts": ["src/utils.ts"] },
  "languages": ["typescript", "react"],
  "frameworks": ["react", "vite"],
  "entryPoints": [{ "file": "...", "type": "http", "method": "POST",
                    "path": "/api/...", "handler": "..." }]
}
```

`fileCategory` values: `"code"` | `"config"` | `"docs"` | `"infra"` |
`"data"` | `"script"` | `"markup"`.

Commit: `feat(plugin): project-scanner-prompt.md`

---

### B2 — compute-batches.mjs

Write `plugin/skills/analyze/compute-batches.mjs`. This is a pure Node.js
script (no LLM). Dependencies: `graphology`, `graphology-communities-louvain`,
already in `plugin/package.json`.

**Invocation:**
```bash
node <SKILL_DIR>/compute-batches.mjs $PROJECT_ROOT [--changed-files=<path>]
```

**Algorithm (implement in this exact order):**

1. Load `scan-result.json`.
2. Partition: `codeFiles` (fileCategory === "code") vs `nonCodeFiles`.
3. Build undirected graphology graph from `codeFiles` + `importMap` edges.
4. Run Louvain → community assignment per node.
5. For communities > 35 files: split via weakly-connected-component partition
   until sub-communities ≤ 35. Emit warning per split.
6. Non-code grouping heuristics:
   - Group A: Per directory — `Dockerfile` + `docker-compose.*` + `.dockerignore`.
   - Group B: `.github/workflows/*.yml` → one batch.
   - Group C: `.gitlab-ci.yml` + `.circleci/` files → one batch.
   - Group D: SQL files under `migrations/` or `migration/` — one batch per dir.
   - Group E: All other non-code files by immediate parent dir, max 20 per batch.
7. Assign `batchIndex`: code batches first (1..N), non-code after (N+1..M).
8. Exports extraction: run `LanguageRegistry` + `GenericTreeSitterPlugin` on
   each code file → collect top-level export names. On per-file failure:
   `exports = []`, emit warning.
9. Build `neighborMap`:
   - For file F in batch B: collect all files G where G imports F or F imports G,
     AND G.batchIndex ≠ B.batchIndex.
   - Entry: `{ path: G.path, batchIndex: G.batchIndex, symbols: G.exports }`.
   - If > 50 neighbors: keep top 50 by in-degree, emit warning.
10. Build `batchImportData`: for each batch, slice `importMap` to only the
    files in that batch.
11. Write `batches.json`.

**Fallback:** If Louvain throws, catch → count-based chunking (12 files/batch),
set `algorithm: "count-fallback"`, emit warning to stderr.

**Warning format (exact):**
```
Warning: compute-batches: <what happened> — <why> — <impact>
```

**Output schema:**
```json
{
  "schemaVersion": 1,
  "algorithm": "louvain",
  "totalFiles": 100,
  "totalBatches": 7,
  "batches": [{
    "batchIndex": 1,
    "files": [{ "path": "...", "language": "typescript",
                "sizeLines": 120, "fileCategory": "code" }],
    "batchImportData": { "src/auth/login.ts": ["src/auth/session.ts"] },
    "neighborMap": {
      "src/auth/login.ts": [{
        "path": "src/db/users.ts",
        "batchIndex": 3,
        "symbols": ["User", "findById"]
      }]
    }
  }]
}
```

Write unit tests in `plugin/skills/analyze/test_compute_batches.test.mjs`
covering all cases in CLAUDE.md testing section, including exact warning string
assertions on stderr.

Commit: `feat(plugin): compute-batches.mjs (Louvain semantic batching)`

---

### B3 — file-analyzer-prompt.md

Write `plugin/skills/analyze/file-analyzer-prompt.md`. Full instruction prompt
for file-analyzer subagents.

**Input (provided per-batch in dispatch prompt):**
- `projectRoot`, `batchFiles[]`, `batchImportData`, `neighborMap`
- No `allProjectFiles` list — import data is pre-resolved.

**Extraction steps:**
1. For each file: run GenericTreeSitterPlugin (structural) + LLM analysis (semantic).
2. LLM produces: `summary` (plain English), `tags[]`, `complexity`, `languageNotes?`.
3. For each function/class: create child nodes with `id = "function:<path>:<name>"`.
4. Edges from `batchImportData`: create `imports` edges (type: "imports",
   direction: "forward").
5. Cross-batch edges via `neighborMap`: if code references a `neighbor.symbols`
   entry, emit `calls`/`inherits`/`implements` edge to
   `function:<neighbor.path>:<symbol>` or `class:<neighbor.path>:<symbol>`.

**Language + framework hints section** (compact inline table, replaces per-batch
addendum injection — addendums are only injected in Phase 3 architecture-analyzer):
```
| Signal | Tag(s) | Note |
| File in hooks/, exports fn starting with `use` | hook, service | React custom hook |
| File in contexts/, exports Provider | service, state | React context |
| File in store/, slices/, reducers/ | state | State management |
...
```

**Output size check + chunking (Steps A–F from CLAUDE.md):**
- ≤ 60 nodes AND ≤ 120 edges → single `batch-<N>.json`.
- Otherwise: `parts = ceil(max(nodeCount/60, edgeCount/120))`. Partition
  files sequentially into parts. Write `batch-<N>-part-<K>.json`.
- Self-validate each part before responding.
- Respond with text summary only — NO JSON in response body.

Commit: `feat(plugin): file-analyzer-prompt.md`

---

### B4 — merge-batch-graphs.py

Write `plugin/skills/analyze/merge-batch-graphs.py`.

**Invocation:**
```bash
python <SKILL_DIR>/merge-batch-graphs.py $PROJECT_ROOT
```

**Steps:**
1. Glob `.codelens/intermediate/batch-*.json`. Sort by (batchIndex, partIndex).
2. Detect multi-part batches; report `N logical batches, M multi-part` to stderr.
3. Detect gaps in part numbering → emit warning per CLAUDE.md spec.
4. Load all parts. Merge `nodes` (dedup by `id`, last-write-wins) and `edges`.
5. Apply Zod-equivalent aliases in Python (e.g. `container → service`).
6. `recover_imports_from_scan`: load `scan-result.json` importMap, for every
   import relationship that should exist, ensure an `imports` edge exists in
   the merged graph. Add missing ones with `weight: 0.5`.
7. Referential integrity: collect all node IDs, scan all edges — drop any edge
   where source or target is not in node ID set. Log count of dropped edges.
8. Write `.codelens/intermediate/assembled-graph.json`.
9. Print summary to stderr: node count, edge count, dropped edges, missing-part
   warnings.

Write unit tests in `plugin/skills/analyze/test_merge_batch_graphs.py` covering
all cases in CLAUDE.md testing section.

Commit: `feat(plugin): merge-batch-graphs.py`

---

### B5 — architecture-analyzer-prompt.md + tour-builder-prompt.md

Write both prompt files.

**architecture-analyzer-prompt.md:**
- Input: file nodes only — slim format `{id, filePath, summary, tags}`.
- Inject relevant language addendum from `skills/analyze/languages/<lang>.md`.
- Identify architectural layers: API, Service, Data, UI, Utility, Test, Config.
- Output: layer assignments per node. Update `assembled-graph.json` with
  `layers[]` array.

**tour-builder-prompt.md:**
- Input: file nodes only, `imports` + `calls` edges ONLY, layers without nodeIds.
- Use BFS on import graph to find a pedagogically logical traversal order.
  Start from entry points (main files, API routes, index files).
- Output: `TourStep[]` ordered by dependency. Each step: title, description
  (Markdown), nodeIds to highlight, optional languageLesson.
- Update `assembled-graph.json` with `tour[]` array.

Also create the 12 language addendum files under
`plugin/skills/analyze/languages/`:
Each file format:
```markdown
# <Language>
## Key concepts
- <concept1>, <concept2>, ...
## Import patterns
- <pattern description>
## Notable file patterns
- <filename> — <purpose>
## Example summary style
> "<example LLM summary for a typical file in this language>"
```

Commit: `feat(plugin): architecture-analyzer + tour-builder prompts + 12 language addendums`

---

### B6 — graph-reviewer-prompt.md + inline reviewer

Write `plugin/skills/analyze/graph-reviewer-prompt.md` (used only with `--review`).

Also write the inline deterministic reviewer as an embedded Node.js script
in `skills/analyze/SKILL.md` Phase 5:
```javascript
// Inline reviewer (no LLM, runs by default)
const graph = JSON.parse(fs.readFileSync(assembledPath));
const nodeIds = new Set(graph.nodes.map(n => n.id));
const issues = [];
// 1. Dangling edges
graph.edges = graph.edges.filter(e => {
  if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) {
    issues.push(`Dropped dangling edge: ${e.source} → ${e.target}`);
    return false;
  }
  return true;
});
// 2. Nodes without required fields
graph.nodes.forEach(n => {
  if (!n.summary) { n.summary = `${n.type}: ${n.name}`; }
  if (!n.tags) { n.tags = []; }
  if (!n.complexity) { n.complexity = "simple"; }
});
// 3. Duplicate node IDs (keep first)
const seen = new Set();
graph.nodes = graph.nodes.filter(n => {
  if (seen.has(n.id)) { issues.push(`Dropped duplicate node: ${n.id}`); return false; }
  seen.add(n.id); return true;
});
// 4. Tour step nodeId validity
if (graph.tour) {
  graph.tour.forEach(step => {
    step.nodeIds = step.nodeIds.filter(id => nodeIds.has(id));
  });
}
fs.writeFileSync(assembledPath, JSON.stringify(graph, null, 2));
console.log(`Inline review: ${issues.length} issues auto-fixed`);
issues.forEach(i => console.log(' -', i));
```

Commit: `feat(plugin): graph-reviewer prompts + inline validator`

---

### B7 — Wire SKILL.md (full /analyze orchestration)

Replace the stub in `plugin/skills/analyze/SKILL.md` with the complete
7-phase orchestration. Follow CLAUDE.md Phase-by-Phase section exactly.

Key requirements:
- Phase 0.5: generate + show `.codelensignore`, pause for confirmation.
- Phase 1: dispatch project-scanner subagent.
- Phase 1.5: `node <SKILL_DIR>/compute-batches.mjs $PROJECT_ROOT`.
  On non-zero exit: relay full stderr to user, stop. Do NOT attempt recovery.
- Phase 2: load `batches.json`, dispatch ≤5 concurrent file-analyzer subagents.
  After all complete, run `python <SKILL_DIR>/merge-batch-graphs.py $PROJECT_ROOT`.
- Phase 3+4: run architecture-analyzer and tour-builder (can run sequentially
  or parallel depending on context budget).
- Phase 5: inline reviewer by default; `--review` flag → LLM reviewer subagent.
- Phase 6: save `knowledge-graph.json` + `meta.json`, clean `intermediate/`,
  auto-trigger `/analyze-dashboard`.
- Collect all `Warning:` lines from subprocess stderr into `$PHASE_WARNINGS`.
  Print them all in Phase 6 final report.

Also write `/analyze-dashboard/SKILL.md`:
- Start Vite dev server in `packages/dashboard/`.
- Print the localhost URL.
- Do not block — detach the server process.

Commit: `feat(plugin): complete /analyze and /analyze-dashboard skills`

---

### B8 — End-to-end test

Run `/analyze` on this repo (codelens analyzes itself). Verify:
- `batches.json` generated with community distribution logged.
- All batch files generated.
- `assembled-graph.json` and `knowledge-graph.json` created.
- Schema validates (run Zod validation).
- Dashboard starts at localhost.
- At least one node visible in the graph.

Fix any issues found. Commit: `test: end-to-end Phase B validation`

---

## After all B tasks

Run:
```bash
pnpm test
pnpm lint
```

Report back with:
- Test count and pass/fail.
- `knowledge-graph.json` node count + edge count from the self-analysis run.
- Any warnings emitted during the analysis run.

Do not start Phase C until I confirm.
