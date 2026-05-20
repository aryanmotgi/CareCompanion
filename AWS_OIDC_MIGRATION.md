# AWS OIDC Migration

Tracks the migration from static AWS access keys to OIDC-based credential exchange in GitHub Actions workflows (CLAUDE.md rule 9).

## Workflows changed

| Workflow | File | Status |
|---|---|---|
| Canary monitor | `.github/workflows/canary-monitor.yml` | Migrated |

## Workflows pending migration

None. `grep -r 'AWS_SECRET_ACCESS_KEY' .github/workflows/` returned only `canary-monitor.yml`.

---

## What Aryan must do before merging

### 1. Create the IAM role in AWS

Create an IAM role (e.g. `github-actions-carecompanion-canary`) with the following trust policy. Replace `ACCOUNT_ID` with your AWS account ID.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:aryanmotgi/CareCompanion:*"
        }
      }
    }
  ]
}
```

Attach an inline or managed policy granting the permissions the canary monitor actually needs (e.g. `rds-data:ExecuteStatement`, `secretsmanager:GetSecretValue` scoped to `AWS_RESOURCE_ARN` and `AWS_SECRET_ARN`).

If the GitHub OIDC provider (`token.actions.githubusercontent.com`) is not yet registered in your AWS account, add it first:

```
Provider URL: https://token.actions.githubusercontent.com
Audience:     sts.amazonaws.com
```

### 2. Add the GitHub secret

In the `aryanmotgi/CareCompanion` repository settings → Secrets and variables → Actions, add:

| Secret name | Value |
|---|---|
| `AWS_OIDC_ROLE_ARN` | `arn:aws:iam::ACCOUNT_ID:role/github-actions-carecompanion-canary` |

### 3. Delete the now-unused secrets

Once the workflow runs successfully with OIDC, remove these secrets from the repository:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

---

## How OIDC works (summary)

GitHub mints a short-lived JWT for each workflow run. The `aws-actions/configure-aws-credentials@v4` action exchanges that JWT for temporary STS credentials via `sts:AssumeRoleWithWebIdentity`. No long-lived keys are stored anywhere.
