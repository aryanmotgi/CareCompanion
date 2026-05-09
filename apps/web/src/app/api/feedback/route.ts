import { auth } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'

const limiter = rateLimit({ interval: 60_000, maxRequests: 10 })

export async function POST(req: Request) {
  // Rate limit by IP
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const { success } = await limiter.check(ip)
  if (!success) {
    return Response.json({ ok: false, error: 'Too many requests' }, { status: 429 })
  }

  // Optional auth — works without a session too
  const session = await auth()
  const reporterEmail = session?.user?.email ?? null

  let body: { description?: string; pageUrl?: string; deviceInfo?: string; userAgent?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { description, pageUrl, deviceInfo, userAgent } = body

  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    return Response.json({ ok: false, error: 'Description is required' }, { status: 400 })
  }

  const token = process.env.GITHUB_FEEDBACK_TOKEN
  const repo = process.env.GITHUB_FEEDBACK_REPO

  if (!token || !repo) {
    console.error('[feedback] Missing GITHUB_FEEDBACK_TOKEN or GITHUB_FEEDBACK_REPO')
    return Response.json({ ok: false, error: 'Bug reporting is not configured' }, { status: 503 })
  }

  const title = `[Bug] ${description.slice(0, 80)}${description.length > 80 ? '…' : ''}`

  const issueBody = [
    `## Reporter`,
    reporterEmail ? `**Email:** ${reporterEmail}` : '_Not logged in_',
    ``,
    `## Page`,
    pageUrl ? pageUrl : '_Not provided_',
    ``,
    `## Device`,
    deviceInfo ? deviceInfo : '_Not provided_',
    ``,
    `## User Agent`,
    userAgent ? `\`${userAgent}\`` : '_Not provided_',
    ``,
    `## Time`,
    new Date().toISOString(),
    ``,
    `## Description`,
    description.trim(),
  ].join('\n')

  const ghRes = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title,
      body: issueBody,
      labels: ['bug', 'qa'],
    }),
  })

  if (!ghRes.ok) {
    const text = await ghRes.text()
    console.error('[feedback] GitHub API error:', ghRes.status, text)
    return Response.json({ ok: false, error: 'Failed to create issue' }, { status: 502 })
  }

  const issue = await ghRes.json() as { html_url: string }

  return Response.json({ ok: true, issueUrl: issue.html_url })
}
