import { drizzle } from 'drizzle-orm/aws-data-api/pg'
import { RDSDataClient } from '@aws-sdk/client-rds-data'
import * as schema from './schema'

// No explicit credentials block — SDK default chain resolves in priority:
// env vars (Vercel prod) → AWS_PROFILE / shared config → SSO → EC2/ECS/Lambda
// IAM role. Avoids stale .env.local overriding `aws sso login` session locally.
const client = new RDSDataClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
})

export const db = drizzle(client, {
  database: 'carecompanion',
  secretArn: process.env.AWS_SECRET_ARN!,
  resourceArn: process.env.AWS_RESOURCE_ARN!,
  schema,
})
