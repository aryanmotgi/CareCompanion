import { drizzle } from 'drizzle-orm/aws-data-api/pg'
import { RDSDataClient } from '@aws-sdk/client-rds-data'
import * as schema from './schema'

const client = new RDSDataClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

// Aurora Serverless v1 auto-pauses after inactivity. The first Data API
// request after wakeup returns HTTP 400 with "auto-paused" in the message.
// Retry up to 3 times with a 3-second delay to let the cluster resume.
const _send = client.send.bind(client)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
client.send = async function (command: any, options?: any) {
  const MAX_RETRIES = 3
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await _send(command, options)
    } catch (err) {
      const msg = String(err instanceof Error ? err.message : err)
      if (msg.toLowerCase().includes('auto-paused') && attempt < MAX_RETRIES) {
        console.warn(`[db] Aurora auto-pause detected — retrying in 3s (attempt ${attempt + 1}/${MAX_RETRIES})`)
        await new Promise(r => setTimeout(r, 3000))
        continue
      }
      throw err
    }
  }
} as typeof client.send

export const db = drizzle(client, {
  database: 'carecompanion',
  secretArn: process.env.AWS_SECRET_ARN!,
  resourceArn: process.env.AWS_RESOURCE_ARN!,
  schema,
})
