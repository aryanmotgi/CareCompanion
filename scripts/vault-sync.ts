/**
 * CareCompanion Vault Sync
 *
 * Reads the codebase (git history, changed files, key source files)
 * and writes a structured update to Obsidian.
 *
 * Usage:
 *   npx ts-node scripts/vault-sync.ts          → full sync
 *   npx ts-node scripts/vault-sync.ts --dry    → print what would be written, don't write
 *
 * Run this whenever you finish a session of work and want Obsidian to reflect reality.
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

const VAULT = path.join(process.env.HOME!, 'Downloads/CareCompanion/CareCompanion')
const REPO = path.join(process.env.HOME!, 'carecompanion')
const DRY = process.argv.includes('--dry')

// ── Helpers ──────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function run(cmd: string, cwd = REPO): string {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

function write(filePath: string, content: string): void {
  if (DRY) {
    console.log(`\n[DRY] Would write to: ${filePath}`)
    console.log(content.slice(0, 300) + '...')
    return
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf8')
  console.log(`✓ ${path.relative(VAULT, filePath)}`)
}

function appendNote(filePath: string, content: string): void {
  if (DRY) {
    console.log(`\n[DRY] Would append to: ${filePath}`)
    console.log(content.slice(0, 200))
    return
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : ''
  const sep = existing.endsWith('\n') ? '' : '\n'
  fs.writeFileSync(filePath, existing + sep + content + '\n', 'utf8')
  console.log(`✓ appended → ${path.relative(VAULT, filePath)}`)
}

// ── Data collectors ──────────────────────────────────────────────────────────

function getRecentCommits(n = 20): Array<{ hash: string; message: string; date: string }> {
  const raw = run(`git log --oneline --format="%h|||%s|||%ci" -${n}`)
  return raw.split('\n').filter(Boolean).map((line) => {
    const [hash, message, date] = line.split('|||')
    return { hash: hash.trim(), message: message.trim(), date: date.slice(0, 10) }
  })
}

function getChangedFiles(since = 'HEAD~10'): string[] {
  return run(`git diff ${since}..HEAD --name-only`)
    .split('\n')
    .filter((f) => f && !f.includes('node_modules') && !f.includes('.next'))
}

function getFileContent(relPath: string): string {
  const full = path.join(REPO, relPath)
  if (!fs.existsSync(full)) return ''
  return fs.readFileSync(full, 'utf8')
}

function getRoutes(): string[] {
  return run(`find src/app -name "route.ts" -o -name "page.tsx" | grep -v node_modules | sort`)
    .split('\n')
    .filter(Boolean)
}

function getComponents(): string[] {
  return run(`find src/components -name "*.tsx" | sort`)
    .split('\n')
    .filter(Boolean)
}

function getDBSchema(): string {
  // Find all migration files
  const migrations = run(`find supabase -name "*.sql" | sort`).split('\n').filter(Boolean)
  if (!migrations.length) return 'No migrations found'
  return migrations.join('\n')
}

function detectFeatureAreas(commits: Array<{ message: string }>): string[] {
  const areas = new Set<string>()
  for (const c of commits) {
    const msg = c.message.toLowerCase()
    if (msg.includes('1uphealth') || msg.includes('fhir') || msg.includes('connect')) areas.add('1upHealth / FHIR Integration')
    if (msg.includes('dashboard')) areas.add('Dashboard')
    if (msg.includes('auth') || msg.includes('login') || msg.includes('token')) areas.add('Auth / Token Management')
    if (msg.includes('chat')) areas.add('AI Chat')
    if (msg.includes('onboard')) areas.add('Onboarding')
    if (msg.includes('landing') || msg.includes('page.tsx')) areas.add('Landing Page')
    if (msg.includes('migration') || msg.includes('db') || msg.includes('supabase')) areas.add('Database')
    if (msg.includes('demo')) areas.add('Demo Mode')
    if (msg.includes('refill')) areas.add('Medication Refills')
  }
  return Array.from(areas)
}

// ── Sync tasks ────────────────────────────────────────────────────────────────

/** 02 - Product: what's been built, current features, API routes */
function syncProduct(commits: Array<{ hash: string; message: string; date: string }>, changedFiles: string[]): void {
  const routes = getRoutes()
  const components = getComponents()
  const featureAreas = detectFeatureAreas(commits)

  const recentWork = commits
    .slice(0, 15)
    .map((c) => `- \`${c.hash}\` ${c.date} — ${c.message}`)
    .join('\n')

  const routeList = routes
    .map((r) => `- \`${r}\``)
    .join('\n')

  const componentList = components
    .map((c) => `- \`${path.basename(c, '.tsx')}\``)
    .join('\n')

  const content = `# Product — CareCompanion

**Focus:** Cancer caregivers navigating treatment, medications, and the healthcare system.
**Core product:** AI chat that understands cancer care (chemo regimens, side effects, caregiving)
**Data sync:** 1upHealth / FHIR for health records (Phase 2)

## Active Feature Areas
${featureAreas.map((f) => `- ${f}`).join('\n')}

## Recent Commits (last 15)
${recentWork}

## Recently Changed Files
${changedFiles.slice(0, 20).map((f) => `- \`${f}\``).join('\n')}

## API Routes
${routeList}

## UI Components
${componentList}

---
_Auto-synced: ${today()} by vault-sync.ts_
`
  write(path.join(VAULT, '02 - Product/product-status.md'), content)
}

/** 06 - Operations: append to today's daily log */
function syncDailyLog(commits: Array<{ hash: string; message: string; date: string }>, changedFiles: string[]): void {
  const logPath = path.join(VAULT, `06 - Operations/Daily Logs/${today()}.md`)

  // Create if doesn't exist
  if (!fs.existsSync(logPath)) {
    const template = `# Daily Log — ${today()}

**Focus:** Cancer caregivers

## Top 3 Priorities Today
- [ ]
- [ ]
- [ ]

## Progress

## Blockers

## Tomorrow
`
    if (!DRY) {
      fs.mkdirSync(path.dirname(logPath), { recursive: true })
      fs.writeFileSync(logPath, template, 'utf8')
    }
  }

  const todayCommits = commits
    .filter((c) => c.date === today())
    .map((c) => `  - \`${c.hash}\` ${c.message}`)
    .join('\n')

  if (!todayCommits) return

  const entry = `
## Code Changes (auto-synced)
${todayCommits}

**Files touched:** ${changedFiles.slice(0, 8).join(', ')}
`
  appendNote(logPath, entry)
}

/** 02 - Product: architecture snapshot */
function syncArchitecture(changedFiles: string[]): void {
  const systemPrompt = getFileContent('src/lib/system-prompt.ts')
  const rateLimitInfo = getFileContent('src/lib/rate-limit.ts')
  const migrations = getDBSchema()

  // Detect tech stack from package.json
  const pkg = JSON.parse(getFileContent('package.json') || '{}')
  const deps = Object.keys(pkg.dependencies || {}).slice(0, 20)

  const content = `# Architecture — CareCompanion

## Stack
- **Framework:** Next.js (App Router)
- **Auth + DB:** Supabase
- **AI:** Anthropic Claude via AI SDK
- **Health data:** 1upHealth (FHIR R4)
- **Hosting:** Vercel

## Key Dependencies
${deps.map((d) => `- \`${d}\``).join('\n')}

## App Structure
\`\`\`
src/
  app/
    page.tsx              ← Landing page
    (app)/
      dashboard/          ← Main dashboard
      care/               ← Care view
      connect/            ← Connect health accounts
    api/
      chat/               ← AI chat (authenticated + guest)
      fhir/               ← 1upHealth OAuth + FHIR sync
      demo/               ← Demo mode
  components/             ← UI components
  lib/                    ← Shared utilities
supabase/
  migrations/             ← DB schema changes
\`\`\`

## Database Migrations
\`\`\`
${migrations}
\`\`\`

## AI System Prompt (src/lib/system-prompt.ts)
\`\`\`
${systemPrompt.slice(0, 1000)}${systemPrompt.length > 1000 ? '\n... (truncated)' : ''}
\`\`\`

## Recently Changed Files
${changedFiles.map((f) => `- \`${f}\``).join('\n')}

---
_Auto-synced: ${today()} by vault-sync.ts_
`
  write(path.join(VAULT, '02 - Product/architecture.md'), content)
}

/** 06 - Operations: running changelog */
function syncChangelog(commits: Array<{ hash: string; message: string; date: string }>): void {
  // Group commits by date
  const byDate = new Map<string, typeof commits>()
  for (const c of commits) {
    if (!byDate.has(c.date)) byDate.set(c.date, [])
    byDate.get(c.date)!.push(c)
  }

  let content = `# Changelog\n\n_Auto-generated from git history_\n\n`
  for (const [date, cs] of Array.from(byDate.entries()).sort((a, b) => b[0].localeCompare(a[0]))) {
    content += `## ${date}\n`
    for (const c of cs) {
      content += `- ${c.message} (\`${c.hash}\`)\n`
    }
    content += '\n'
  }
  content += `---\n_Last synced: ${today()}_\n`

  write(path.join(VAULT, '06 - Operations/changelog.md'), content)
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\nCareCompanion Vault Sync ${DRY ? '(DRY RUN)' : ''}`)
  console.log(`Repo:  ${REPO}`)
  console.log(`Vault: ${VAULT}\n`)

  const commits = getRecentCommits(30)
  const changedFiles = getChangedFiles('HEAD~10')

  console.log(`Found ${commits.length} commits, ${changedFiles.length} changed files\n`)

  syncProduct(commits, changedFiles)
  syncArchitecture(changedFiles)
  syncDailyLog(commits, changedFiles)
  syncChangelog(commits)

  console.log('\nSync complete. Open Obsidian to see updates.')
  console.log('\nUpdated notes:')
  console.log('  02 - Product/product-status.md')
  console.log('  02 - Product/architecture.md')
  console.log('  06 - Operations/Daily Logs/' + today() + '.md')
  console.log('  06 - Operations/changelog.md')
}

main()
