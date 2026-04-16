/**
 * CareCompanion Obsidian Vault Manager
 * Writes directly to the vault on disk — no API needed.
 *
 * Usage:
 *   npx ts-node scripts/vault.ts daily              → create today's daily log
 *   npx ts-node scripts/vault.ts append "03 - Users & Research/Notes.md" "New finding"
 *   npx ts-node scripts/vault.ts interview "Jane Smith" "caregiver"
 *   npx ts-node scripts/vault.ts pivot "all chronic illnesses"  → update vault for new direction
 *   npx ts-node scripts/vault.ts status             → show vault summary
 */

import * as fs from 'fs'
import * as path from 'path'

const VAULT = path.join(process.env.HOME!, 'Downloads/CareCompanion/CareCompanion')

// ── Product direction config ─────────────────────────────────────────────────
// Update this when the product pivots. It flows into all templates.
const DIRECTION_FILE = path.join(VAULT, '01 - Company/product-direction.md')

function getDirection(): string {
  if (fs.existsSync(DIRECTION_FILE)) {
    const content = fs.readFileSync(DIRECTION_FILE, 'utf8')
    const match = content.match(/^focus:\s*(.+)$/m)
    if (match) return match[1].trim()
  }
  return 'cancer caregivers'
}

function saveDirection(direction: string): void {
  const content = `---
focus: ${direction}
updated: ${today()}
---

# Product Direction

**Current focus:** ${direction}

Updated automatically via \`npx ts-node scripts/vault.ts pivot "${direction}"\`
`
  write(DIRECTION_FILE, content)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10) // 2026-04-15
}

function now(): string {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function write(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf8')
}

function append(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, 'utf8')
    const sep = existing.endsWith('\n') ? '' : '\n'
    fs.appendFileSync(filePath, sep + content + '\n', 'utf8')
  } else {
    write(filePath, content + '\n')
  }
}

function resolve(notePath: string): string {
  // If it already looks like an absolute path, use it
  if (notePath.startsWith('/')) return notePath
  const withExt = notePath.endsWith('.md') ? notePath : `${notePath}.md`
  return path.join(VAULT, withExt)
}

// ── Commands ─────────────────────────────────────────────────────────────────

/** Create today's daily log with a template */
function cmdDaily(): void {
  const date = today()
  const direction = getDirection()
  const filePath = path.join(VAULT, `06 - Operations/Daily Logs/${date}.md`)

  if (fs.existsSync(filePath)) {
    console.log(`Daily log already exists: ${filePath}`)
    console.log('Use "append" to add to it.')
    return
  }

  const content = `# Daily Log — ${date}

**Focus:** ${direction}

## Top 3 Priorities Today
- [ ]
- [ ]
- [ ]

## Progress
_What moved forward today?_

## Blockers
_What's in the way?_

## User Insights
_Anything heard from users or caregivers?_

## Tomorrow
_What's the most important thing to do first?_

---
_Created ${now()}_
`
  write(filePath, content)
  console.log(`✓ Daily log created: ${filePath}`)
}

/** Append a timestamped update to any note */
function cmdAppend(notePath: string, update: string): void {
  const filePath = resolve(notePath)
  const entry = `\n### ${today()} ${now()}\n${update}`
  append(filePath, entry)
  console.log(`✓ Appended to: ${filePath}`)
}

/** Create a user interview note with a template */
function cmdInterview(name: string, role: string): void {
  const direction = getDirection()
  const slug = name.toLowerCase().replace(/\s+/g, '-')
  const filePath = path.join(VAULT, `03 - Users & Research/Interviews/${today()}-${slug}.md`)

  const content = `# User Interview — ${name}

**Date:** ${today()}
**Role:** ${role}
**Focus area:** ${direction}

## Background
- Age / situation:
- How they heard about CareCompanion:
- How long they've been a caregiver / patient:

## Current Workflow
_How do they manage care today? What tools? What breaks down?_

## Key Questions

### 1. Walk me through the last time you had to manage [a medical situation].
_Notes:_

### 2. What's the most stressful part of caregiving right now?
_Notes:_

### 3. What do you wish you had that doesn't exist?
_Notes:_

### 4. Have you tried any apps or tools? What happened?
_Notes:_

### 5. If this app disappeared tomorrow, what would you miss?
_Notes:_

## Quotes
>

## Key Insights
-

## Follow-up Actions
- [ ]

---
_Interviewed by: Aryan_
_Focus: ${direction}_
`
  write(filePath, content)
  console.log(`✓ Interview note created: ${filePath}`)
}

/** Update vault when product direction changes */
function cmdPivot(newDirection: string): void {
  const oldDirection = getDirection()
  console.log(`Pivoting from "${oldDirection}" → "${newDirection}"`)

  // 1. Save new direction
  saveDirection(newDirection)

  // 2. Update the product README
  const readmePath = path.join(VAULT, '02 - Product/README.md')
  const readme = `# Product — CareCompanion

**Current focus:** ${newDirection}

## What we're building
An AI care companion for ${newDirection}. The core product is an AI chat
that understands treatment, side effects, and the emotional burden of caregiving.

## The wedge
AI chat that works without any signup. Open the app, describe your situation,
get specific answers from an AI that understands ${newDirection}.

## Phases
1. **Phase 1 (now):** Anonymous chat — no signup, no data import
2. **Phase 2:** Health data import via FHIR / 1upHealth
3. **Phase 3:** Proactive care management agent

## Key files (codebase)
- \`src/lib/system-prompt.ts\` — AI system prompt (update for new focus)
- \`src/app/api/chat/guest/route.ts\` — guest chat endpoint
- \`src/components/ChatInterface.tsx\` — chat UI

---
_Last updated: ${today()} | Previous focus: ${oldDirection}_
`
  write(readmePath, readme)
  console.log(`✓ Updated: 02 - Product/README.md`)

  // 3. Log the pivot in company history
  const historyPath = path.join(VAULT, '01 - Company/pivot-history.md')
  const entry = `\n## ${today()} — Pivot: ${oldDirection} → ${newDirection}\n_Recorded automatically_\n`
  append(historyPath, entry)
  console.log(`✓ Logged pivot in: 01 - Company/pivot-history.md`)

  // 4. Update the research README to reflect new focus
  const researchPath = path.join(VAULT, '03 - Users & Research/README.md')
  const research = `# Users & Research

**Current focus:** ${newDirection}

## Who we're talking to
People managing ${newDirection} — patients, family caregivers, and care coordinators.

## Interview tracker
See \`Interviews/\` folder for individual notes.

## Key questions we're exploring
- What's the most painful part of managing ${newDirection}?
- What tools do they use today and why do they fail?
- What would make them recommend this to another caregiver?

---
_Last updated: ${today()}_
`
  write(researchPath, research)
  console.log(`✓ Updated: 03 - Users & Research/README.md`)

  console.log(`\nDone. Vault updated for: "${newDirection}"`)
  console.log(`Next: update src/lib/system-prompt.ts in the codebase to match.`)
}

/** Show vault summary */
function cmdStatus(): void {
  const direction = getDirection()
  console.log(`\nCareCompanion Vault`)
  console.log(`Path:      ${VAULT}`)
  console.log(`Direction: ${direction}`)
  console.log(`\nFolders:`)
  fs.readdirSync(VAULT)
    .filter((f) => !f.startsWith('.'))
    .forEach((f) => {
      const full = path.join(VAULT, f)
      if (fs.statSync(full).isDirectory()) {
        const files = fs.readdirSync(full).filter((x) => !x.startsWith('.')).length
        console.log(`  ${f}/ (${files} items)`)
      }
    })
}

// ── CLI ───────────────────────────────────────────────────────────────────────

const [, , cmd, ...args] = process.argv

switch (cmd) {
  case 'daily':
    cmdDaily()
    break
  case 'append':
    if (!args[0] || !args[1]) {
      console.error('Usage: vault.ts append "<note path>" "<update text>"')
      process.exit(1)
    }
    cmdAppend(args[0], args.slice(1).join(' '))
    break
  case 'interview':
    if (!args[0]) {
      console.error('Usage: vault.ts interview "<name>" "<role>"')
      process.exit(1)
    }
    cmdInterview(args[0], args[1] ?? 'caregiver')
    break
  case 'pivot':
    if (!args[0]) {
      console.error('Usage: vault.ts pivot "<new direction>"')
      process.exit(1)
    }
    cmdPivot(args.join(' '))
    break
  case 'status':
    cmdStatus()
    break
  default:
    console.log(`Commands:
  daily                          Create today's daily log
  append "<path>" "<text>"       Append update to any note
  interview "<name>" "<role>"    Create user interview note
  pivot "<new direction>"        Update vault for a product pivot
  status                         Show vault summary`)
}
