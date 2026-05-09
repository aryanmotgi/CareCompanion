# CareCompanion Self-Healing Production Monitor

## What It Does

Our production app is monitored 24/7 by an automated system that detects bugs, alerts us, and automatically opens fix PRs — without any human intervention. It runs entirely on GitHub's servers. No one's laptop needs to be on.

## How It Works

### Two Layers of Monitoring

**Layer 1: API Health Ping (every 30 minutes)**

A fast check that answers three questions:
- Is the site alive?
- Can users sign in?
- Is the database responding?

If any check fails, we get an email alert within 30 minutes.

**Layer 2: Full Browser Test Suite (every 4 hours)**

A real browser opens carecompanionai.org and acts like a user:
- Signs in with a test account
- Navigates every major page (dashboard, care, chat, connect)
- Verifies medications and notifications actually render with real data
- Types a message in the AI chat and verifies a response comes back
- Measures page load times (fails if any page takes more than 8 seconds)
- Checks for JavaScript errors
- Confirms cron jobs are running (notification system, weekly summaries)

### What Happens When Something Breaks

```
1. A test fails
        ↓
2. We get an email alert immediately
        ↓
3. A GitHub issue is auto-created with the error details
        ↓
4. Claude AI reads the issue, investigates the codebase,
   and figures out what broke
        ↓
5. Claude opens a Pull Request with the fix
        ↓
6. Vercel auto-deploys a preview of the fix
        ↓
7. The tests run again against the preview to verify
   Claude's fix actually works
        ↓
8. We get notified: "fix verified, ready to merge"
   or "needs human review"
        ↓
9. We merge from phone — one tap, fix goes live
```

### Real Example: AI Chat Goes Down

- **Hour 0:** Anthropic API key expires. Users type messages but get no response.
- **Within 4 hours:** The browser test types "hello" in the chat, waits for a response, gets nothing. Test fails.
- **Seconds later:** Email alert sent. GitHub issue created. Claude AI starts investigating.
- **Minutes later:** Claude reads the error, finds the issue, opens a PR with the fix.
- **The PR is auto-tested** against a preview deployment to verify it works.
- **We merge from our phones.** Fix goes live.

### What It Costs

Nothing. The entire system runs on:
- **GitHub Actions free tier** (2,000 minutes/month, we use ~1,855)
- **Our existing Anthropic API key** (same one the app already uses)
- **Vercel free preview deployments**

No new services, no new subscriptions.

### What It Monitors

| Check | Frequency | What it catches |
|-------|-----------|-----------------|
| Site liveness | Every 30 min | Site down, deploy failed |
| Auth + database | Every 30 min | Auth broken, DB frozen |
| Dashboard renders | Every 4h | Page crash, layout bug |
| Care page + medications | Every 4h | Data not loading |
| AI chat works | Every 4h | API key expired, streaming broken |
| Page load speed | Every 4h | Performance regression |
| JavaScript errors | Every 4h | Uncaught exceptions |
| Notifications exist | Every 4h | Cron jobs stopped |

### Key Points

- Runs 24/7 on GitHub's servers — no one's computer needs to be on
- Catches issues before users report them
- Claude AI fixes most bugs automatically
- We just review and merge — one tap from a phone
- Zero additional cost
