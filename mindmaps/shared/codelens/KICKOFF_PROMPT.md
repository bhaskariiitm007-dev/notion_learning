# Claude Code Kickoff Prompt

Paste this entire message as your first prompt in a new Claude Code session
after placing CLAUDE.md in the root of your new empty repo.

---

Read CLAUDE.md thoroughly before doing anything else.

We are building **CodeLens** — a multi-platform codebase intelligence plugin
described in CLAUDE.md. Start with **Phase A — Foundation** only. Do not
proceed to Phase B until I confirm Phase A is complete and tests pass.

## Phase A tasks (do these in order, commit after each numbered item)

1. **Monorepo scaffold**
   - Root `package.json` with `"type": "module"`, `packageManager: "pnpm@10.x"`,
     workspaces pointing to `packages/*` and `plugin`.
   - `pnpm-workspace.yaml`.
   - Root `tsconfig.json` (strict, ESM, composite).
   - Root `vitest.config.ts` (picks up all `**/__tests__/*.test.ts` and
     `tests/skill/*.test.*`).
   - `.eslintrc.json` (TypeScript + import rules).
   - `.gitignore` (node_modules, dist, .codelens/intermediate, coverage).
   - Commit: `chore: monorepo scaffold`

2. **packages/core — types + schema**
   - All types from CLAUDE.md schema section: `NodeType`, `EdgeType`,
     `KnowledgeGraph`, `GraphNode`, `GraphEdge`, `Layer`, `TourStep`,
     `ProjectMeta`, `DomainMeta`, `KnowledgeMeta`, `AnalysisMeta`.
   - Zod schemas for `GraphNode` and `GraphEdge` with auto-fix aliases
     (full alias list from the original spec: `container → service`,
     `migration → table`, `workflow → flow`, `action → step`,
     `described → documents`, `creates → provisions`, etc.).
   - `validateGraph(graph): { valid: boolean; issues: GraphIssue[] }` that
     runs schema check + referential integrity.
   - Subpath exports in `package.json`: `./types`, `./schema`.
   - Unit tests: alias normalization, validation happy path, dangling edge detection.
   - Commit: `feat(core): types, schema, Zod validation`

3. **packages/core — persistence**
   - `loadGraph(projectRoot): Promise<KnowledgeGraph | null>`
   - `saveGraph(projectRoot, graph): Promise<void>`
   - `loadMeta(projectRoot): Promise<AnalysisMeta | null>`
   - `saveMeta(projectRoot, meta): Promise<void>`
   - `isGraphStale(projectRoot): Promise<boolean>` — compares stored
     `gitCommitHash` with `git rev-parse HEAD`.
   - Subpath export: `./persistence`.
   - Unit tests: round-trip save/load, staleness detection.
   - Commit: `feat(core): persistence layer`

4. **packages/core — language registry**
   - `LanguageConfig` interface and `LanguageRegistry` class.
   - Configs for all 12 languages: TypeScript, JavaScript, Python, Go, Java,
     Rust, C/C++, C#, Ruby, PHP, Swift, Kotlin.
     Each config must have: `id`, `displayName`, `extensions[]`,
     `treeSitter.nodeTypes` (function, class, import, export, typeAnnotation),
     `concepts[]`.
   - Auto-register all configs on import.
   - Subpath export: `./languages`.
   - Unit tests: lookup by extension, lookup by id, all 12 configs have
     required fields, no duplicate extensions.
   - Commit: `feat(core): language registry (12 languages)`

5. **packages/core — GenericTreeSitterPlugin**
   - Uses `web-tree-sitter` (WASM). DO NOT use native `tree-sitter` bindings.
   - `canAnalyze(filePath): boolean` — checks LanguageRegistry.
   - `analyzeFile(filePath, content): Promise<StructuralAnalysis>` — extracts
     functions, classes, imports, exports driven by `LanguageConfig.treeSitter.nodeTypes`.
   - `customAnalyzer` escape hatch: if `config.customAnalyzer` exists, delegate.
   - Unknown language: return null (LLM analysis still runs; tree-sitter is
     an enhancement, not a gate).
   - Missing WASM grammar: log warning, return null.
   - Subpath export: `./plugins`.
   - Unit tests: one small fixture file per language (TypeScript, Python, Go
     minimum); verify function/class/import counts match expected.
   - Commit: `feat(core): GenericTreeSitterPlugin (web-tree-sitter, WASM)`

6. **packages/core — IgnoreFilter + IgnoreGenerator**
   - `createIgnoreFilter(projectRoot): IgnoreFilter` — merges hardcoded defaults
     + `.codelens/.codelensignore` + `.codelensignore` at project root.
   - Hardcoded defaults: node_modules/, .git/, dist/, build/, out/, coverage/,
     .next/, .cache/, .turbo/, target/, bin/, obj/, vendor/, venv/, .venv/,
     __pycache__/, *.lock, package-lock.json, yarn.lock, pnpm-lock.yaml,
     *.png, *.jpg, *.jpeg, *.gif, *.svg, *.ico, *.woff*, *.ttf, *.eot,
     *.mp3, *.mp4, *.pdf, *.zip, *.tar, *.gz, *.min.js, *.min.css, *.map,
     *.generated.*, .idea/, .vscode/, LICENSE, .gitignore, .editorconfig,
     .prettierrc, .eslintrc*, *.log.
   - `!` negation in user files overrides hardcoded defaults.
   - `generateStarterIgnoreFile(projectRoot): string` — scan for common dirs
     (tests/, fixtures/, docs/, examples/, etc.) and emit commented-out
     suggestions with a header explaining the file.
   - Use the `ignore` npm package for gitignore-compatible matching.
   - Subpath export: `./ignore`.
   - Unit tests per CLAUDE.md testing section (pattern matching, negation,
     directory detection, all suggestions commented out).
   - Commit: `feat(core): IgnoreFilter + IgnoreGenerator`

7. **Plugin skeleton**
   - `plugin/package.json` with name `@codelens/plugin`, version `0.1.0`.
   - `plugin/.claude-plugin/plugin.json`:
     ```json
     {
       "name": "codelens",
       "version": "0.1.0",
       "description": "Codebase intelligence plugin",
       "skills": ["skills/analyze/SKILL.md", "skills/analyze-dashboard/SKILL.md"]
     }
     ```
   - `plugin/.cursor-plugin/plugin.json` (same shape).
   - `plugin/.copilot-plugin/plugin.json` (same shape).
   - `plugin/skills/analyze/SKILL.md` — stub only for now:
     ```
     # /analyze
     Not yet implemented. Coming in Phase B.
     ```
   - `plugin/skills/analyze-dashboard/SKILL.md` — stub only.
   - Commit: `chore(plugin): skeleton manifests and skill stubs`

## After all 7 items are committed

Run:
```bash
pnpm install
pnpm --filter @codelens/core build
pnpm test
pnpm lint
```

All tests must pass. Then report back with:
- Test count and pass/fail status
- Any build errors
- The directory tree of `packages/core/src/`

Do not start Phase B until I confirm.
