# CareCompanion Engineering Conventions

> Last updated: 2026-04-20  
> Covers: auth patterns, DB queries, API routes, soft deletes, security gates

---

## 1. ID Types — Never Mix These

| Context | Type | Source |
|---|---|---|
| `session.user.id` | Cognito sub (`"us-east-1_abc123"`) | NextAuth JWT |
| `users.id` | PostgreSQL UUID | DB primary key |
| `users.cognitoSub` | Cognito sub (indexed FK) | Links the two |

**Rule:** Server components and API routes that query DB records by user must always resolve `dbUser.id` first:

```typescript
const [dbUser] = await db
  .select({ id: users.id })
  .from(users)
  .where(eq(users.cognitoSub, session.user.id))
  .limit(1);
if (!dbUser) redirect('/login');
```

Never pass `session.user.id` into a query that expects a UUID (e.g., `careProfiles.userId`, `medications.userId`).

---

## 2. Soft Deletes

All user-owned records use a soft-delete pattern: a `deletedAt` timestamp column.  
**Every query that returns records to the user must filter out soft-deleted rows.**

### Import
```typescript
import { isNull } from 'drizzle-orm';
```

### Usage in queries
```typescript
.where(and(eq(table.userId, dbUser.id), isNull(table.deletedAt)))
```

### Deleting records
Use the `softDelete` utility — never `db.delete()` on user records:
```typescript
import { softDelete } from '@/lib/soft-delete';
await softDelete('medications', id, dbUser.id, profile.id);
```

`softDelete` signature: `(table, recordId, userId, careProfileId?)`.  
It sets `deletedAt = now()` and verifies ownership before mutating.

### Tables with soft delete
- `medications` — filter by `careProfileId` + `isNull(medications.deletedAt)`
- `appointments` — filter by `careProfileId` + `isNull(appointments.deletedAt)`
- `doctors` — filter by `careProfileId` + `isNull(doctors.deletedAt)`
- `labResults` — filter by `userId` + `isNull(labResults.deletedAt)`
- `claims` — filter by `userId` + `isNull(claims.deletedAt)`

---

## 3. API Route Checklist

Every mutation endpoint (POST / PUT / PATCH / DELETE) must:

1. **CSRF check** — first line of the handler:
   ```typescript
   const { valid, error: csrfError } = await validateCsrf(request);
   if (!valid) return csrfError!;
   ```

2. **Rate limit** — before any DB work:
   ```typescript
   const limiter = rateLimit({ interval: 60_000, maxRequests: 20 });
   const ip = request.headers.get('x-forwarded-for') || 'unknown';
   const { success } = await limiter.check(ip);
   if (!success) return apiError('Too many requests', 429);
   ```

3. **Auth** — resolve authenticated user:
   ```typescript
   const { user, error: authError } = await getAuthenticatedUser();
   if (authError) return authError;
   ```

4. **Body validation** — use Zod + `validateBody`:
   ```typescript
   const { data: validated, error: valError } = validateBody(MySchema, body);
   if (valError) return valError;
   ```

5. **Ownership check** — always verify the record belongs to the authenticated user before reading or writing:
   ```typescript
   const [profile] = await db.select({ id: careProfiles.id })
     .from(careProfiles)
     .where(and(eq(careProfiles.id, careProfileId), eq(careProfiles.userId, user.id)))
     .limit(1);
   if (!profile) return apiError('Not found', 404);
   ```

6. **Audit log** — for any action that reads or mutates sensitive health data:
   ```typescript
   await logAudit({ user_id: user.id, action: 'action_name', ip_address: ip });
   ```

7. **Response helpers** — always use `apiSuccess()` / `apiError()`, never raw `Response.json()`:
   ```typescript
   return apiSuccess({ data });
   return apiError('Message', 400);
   ```

---

## 4. Auth Configuration

### Cognito ISSUER
The issuer URL is resolved in this order (see `src/lib/auth.ts`):
1. `COGNITO_ISSUER` env var (explicit override)
2. Constructed from `COGNITO_REGION` + `COGNITO_USER_POOL_ID`
3. Hardcoded fallback (dev only)

**When adding a new environment:** set `COGNITO_REGION` and `COGNITO_USER_POOL_ID` — do not rely on the hardcoded fallback in production.

### Provider validation (`/api/auth/start`)
Valid provider values: `null`, `'google'`, `'email'`.  
Any other value returns 400. If you add a new OAuth provider, update this allowlist in `src/app/api/auth/start/route.ts`.

---

## 5. E2E Authentication Endpoint (`/api/e2e/signin`)

This endpoint mints a valid session cookie for automated monitoring. It is protected by:
- Rate limit: 5 requests/minute per IP
- `E2E_SECRET` header check: caller must send `x-e2e-secret: $E2E_SECRET`
- DB lookup gate: the email must exist in the `users` table

**Never remove the `E2E_SECRET` check.** Without it, any caller who knows a valid email address can mint a session.

For new deployments: set `E2E_SECRET` in env before enabling the monitor.

The endpoint also handles Aurora Serverless cold starts — it retries DB calls up to 4 times with a 10s delay.

---

## 6. Route Guards (Server Components)

Standard page-level auth guard pattern:

```typescript
const session = await auth();
if (!session?.user?.id) redirect('/login');

const [dbUser] = await db.select({ id: users.id }).from(users)
  .where(eq(users.cognitoSub, session.user.id)).limit(1);
if (!dbUser) redirect('/login');

const [profile] = await db.select({ id: careProfiles.id }).from(careProfiles)
  .where(eq(careProfiles.userId, dbUser.id)).limit(1);
if (!profile) redirect('/onboarding');  // NOT /setup, NOT /connect
```

**Redirect targets:**
- No session → `/login`
- No DB user → `/login`
- No care profile → `/onboarding` (not `/setup`, not `/connect` — those don't exist)

---

## 7. Notification Query (Layout)

The app layout fetches unread notification count from the DB with the `isRead = false` filter applied at the query level — not in memory:

```typescript
.where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
```

Do not add an in-memory `.filter(n => !n.isRead)` on top — it's redundant and masks the DB filter being missing.

---

## 8. Share Links (`/api/share`)

`buildShareData()` must always apply `isNull(X.deletedAt)` when fetching records. Current types and their filters:

| Type | Tables queried | Soft-delete filter required |
|---|---|---|
| `medications` | `medications` | `isNull(medications.deletedAt)` |
| `lab_results` | `labResults` | `isNull(labResults.deletedAt)` |
| `health_summary` / `care_plan` | `medications`, `appointments`, `doctors` | all three |

---

## 9. Adding a New Data Table

Checklist when adding a new table that stores user health records:

- [ ] Add `deletedAt timestamp` column (nullable)
- [ ] Add `userId` or `careProfileId` FK for ownership
- [ ] All SELECT queries include `isNull(table.deletedAt)`
- [ ] DELETE handler calls `softDelete()` — not `db.delete()`
- [ ] POST/PUT/DELETE handlers have CSRF + rate limit + auth + ownership check
- [ ] Share route updated if the new data should appear in health summaries
- [ ] Page-level server component uses `dbUser.id` (UUID), not `session.user.id` (Cognito sub)

---

## 10. Key File Map

| What | Where |
|---|---|
| Auth config & session | `src/lib/auth.ts` |
| DB schema | `src/lib/db/schema.ts` |
| Soft delete utility | `src/lib/soft-delete.ts` |
| CSRF validation | `src/lib/csrf.ts` |
| Rate limiter | `src/lib/rate-limit.ts` |
| Auth + user resolver helper | `src/lib/api-helpers.ts` |
| Response helpers | `src/lib/api-response.ts` |
| Audit log | `src/lib/audit.ts` |
| App layout (notifications, nav) | `src/app/(app)/layout.tsx` |
| E2E signin bypass | `src/app/api/e2e/signin/route.ts` |
| Share link builder | `src/app/api/share/route.ts` |
