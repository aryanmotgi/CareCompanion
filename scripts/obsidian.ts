/**
 * Obsidian Local REST API client
 *
 * Usage:
 *   npx ts-node scripts/obsidian.ts create "Journal/2026-04-15.md" "# April 15\n\nToday..."
 *   npx ts-node scripts/obsidian.ts append "Daily Log.md" "- Finished the chat gateway"
 *   npx ts-node scripts/obsidian.ts update "Weekly Priorities.md" "$(cat priorities.md)"
 *   npx ts-node scripts/obsidian.ts read "Weekly Priorities.md"
 *
 * Setup:
 *   1. Install Obsidian Local REST API plugin
 *   2. Copy the API key from plugin settings
 *   3. Set OBSIDIAN_API_KEY env var (or paste it below as fallback)
 *   4. Optionally set OBSIDIAN_PORT if not using default 27123
 */

// Allow self-signed cert from Obsidian Local REST API
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const API_KEY = process.env.OBSIDIAN_API_KEY ?? 'YOUR_API_KEY_HERE'
const PORT = process.env.OBSIDIAN_PORT ?? '27124'
const BASE = `https://127.0.0.1:${PORT}`

const HEADERS = {
  Authorization: `Bearer ${API_KEY}`,
  'Content-Type': 'text/markdown',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function encodePath(notePath: string): string {
  // Ensure .md extension, then encode each path segment (not the slashes)
  const withExt = notePath.endsWith('.md') ? notePath : `${notePath}.md`
  return withExt
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/')
}

async function request(method: string, notePath: string, body?: string): Promise<{ status: number; text: string }> {
  const url = `${BASE}/vault/${encodePath(notePath)}`
  const res = await fetch(url, {
    method,
    headers: HEADERS,
    body,
  })
  const text = await res.text()
  return { status: res.status, text }
}

// ── Operations ────────────────────────────────────────────────────────────────

/** Create a new note (or overwrite if it exists). */
async function create(notePath: string, content: string): Promise<void> {
  const { status } = await request('PUT', notePath, content)
  if (status === 200 || status === 204) {
    console.log(`✓ Created: ${notePath}`)
  } else {
    throw new Error(`Create failed (${status})`)
  }
}

/** Append content to an existing note. Creates the note if it doesn't exist. */
async function append(notePath: string, content: string): Promise<void> {
  // First check if note exists
  const { status: readStatus, text: existing } = await request('GET', notePath)

  if (readStatus === 404) {
    // Create it
    await create(notePath, content)
    return
  }

  if (readStatus !== 200) {
    throw new Error(`Read failed before append (${readStatus})`)
  }

  // Append with a newline separator
  const separator = existing.endsWith('\n') ? '' : '\n'
  const updated = existing + separator + content
  const { status } = await request('PUT', notePath, updated)

  if (status === 200 || status === 204) {
    console.log(`✓ Appended to: ${notePath}`)
  } else {
    throw new Error(`Append (write) failed (${status})`)
  }
}

/** Overwrite a note with new content (same as create, named for clarity). */
async function update(notePath: string, content: string): Promise<void> {
  await create(notePath, content)
  console.log(`✓ Updated: ${notePath}`)
}

/** Read and print a note's content. */
async function read(notePath: string): Promise<void> {
  const { status, text } = await request('GET', notePath)
  if (status === 200) {
    console.log(text)
  } else if (status === 404) {
    console.error(`Note not found: ${notePath}`)
    process.exit(1)
  } else {
    throw new Error(`Read failed (${status})`)
  }
}

/** Append a timestamped entry to your Daily Log note. */
async function dailyLog(entry: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10) // 2026-04-15
  const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  const line = `- ${time} ${entry}`
  await append(`Daily Log/${today}.md`, line)
}

/** Update the Weekly Priorities note, replacing the priorities section. */
async function weeklyPriorities(priorities: string[]): Promise<void> {
  const week = getISOWeek()
  const lines = [
    `# Week ${week} Priorities`,
    '',
    ...priorities.map((p, i) => `${i + 1}. ${p}`),
    '',
    `_Updated: ${new Date().toLocaleString()}_`,
  ].join('\n')
  await update('Weekly Priorities.md', lines)
}

function getISOWeek(): string {
  const d = new Date()
  const day = d.getDay() || 7
  d.setDate(d.getDate() + 4 - day)
  const yearStart = new Date(d.getFullYear(), 0, 1)
  return `${d.getFullYear()}-W${String(Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)).padStart(2, '0')}`
}

// ── CLI ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const [, , cmd, ...args] = process.argv

  if (!cmd) {
    console.log(`Commands:
  create  <path> <content>   Create or overwrite a note
  append  <path> <content>   Append content to a note (creates if missing)
  update  <path> <content>   Overwrite a note (alias for create)
  read    <path>             Print a note's content
  daily-log <entry>          Append a timestamped entry to today's Daily Log
  weekly  <p1> <p2> ...      Update Weekly Priorities.md`)
    process.exit(0)
  }

  if (API_KEY === 'YOUR_API_KEY_HERE') {
    console.error('Set OBSIDIAN_API_KEY env var or paste your key into the script.')
    process.exit(1)
  }

  switch (cmd) {
    case 'create':
      await create(args[0], args.slice(1).join(' ').replace(/\\n/g, '\n'))
      break
    case 'append':
      await append(args[0], args.slice(1).join(' ').replace(/\\n/g, '\n'))
      break
    case 'update':
      await update(args[0], args.slice(1).join(' ').replace(/\\n/g, '\n'))
      break
    case 'read':
      await read(args[0])
      break
    case 'daily-log':
      await dailyLog(args.join(' '))
      break
    case 'weekly':
      await weeklyPriorities(args)
      break
    default:
      console.error(`Unknown command: ${cmd}`)
      process.exit(1)
  }
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
