import { createVertex } from '@ai-sdk/google-vertex';
import { ExternalAccountClient, GoogleAuth, type AuthClient } from 'google-auth-library';
import { getVercelOidcToken } from '@vercel/functions/oidc';
import { embed, embedMany } from 'ai';

const EMBED_MODEL = 'gemini-embedding-001';
const DIMENSIONS = 768;

// Vertex AI (BAA-covered under GCP HIPAA contract) — NOT the direct
// generativelanguage.googleapis.com endpoint which has no BAA.
//
// Auth: Workload Identity Federation between Vercel OIDC and GCP.
// Zero long-lived secrets — Vercel functions present an OIDC token to GCP
// STS, which mints a 1h impersonation token for the Vertex service account.
// Org policy iam.disableServiceAccountKeyCreation is fully respected.
//
// Local dev: GoogleAuth() falls back to ADC discovery
// (`gcloud auth application-default login`).

function buildAuthClient(): AuthClient | GoogleAuth {
  const onVercel = !!process.env.VERCEL;
  const audience = process.env.GCP_WORKLOAD_AUDIENCE;
  const saEmail = process.env.GCP_SERVICE_ACCOUNT;

  if (onVercel && audience && saEmail) {
    return ExternalAccountClient.fromJSON({
      type: 'external_account',
      audience,
      subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
      token_url: 'https://sts.googleapis.com/v1/token',
      service_account_impersonation_url:
        `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${saEmail}:generateAccessToken`,
      subject_token_supplier: {
        getSubjectToken: async () => await getVercelOidcToken(),
      },
    }) as AuthClient;
  }

  // Local dev / non-Vercel runtime — standard ADC chain.
  return new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
}

let _vertex: ReturnType<typeof createVertex> | null = null;
function getVertex(): ReturnType<typeof createVertex> {
  if (_vertex) return _vertex;
  _vertex = createVertex({
    project: process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.GOOGLE_VERTEX_LOCATION ?? 'us-central1',
    googleAuthOptions: { authClient: buildAuthClient() as never },
  });
  return _vertex;
}

function assertFiniteVector(v: number[]): void {
  if (v.length !== DIMENSIONS) {
    throw new Error(`embedding length ${v.length} != ${DIMENSIONS}`);
  }
  for (const x of v) {
    if (!Number.isFinite(x)) throw new Error('embedding contains NaN/Infinity');
  }
}

export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: getVertex().textEmbeddingModel(EMBED_MODEL),
    value: text,
    providerOptions: {
      google: { outputDimensionality: DIMENSIONS, taskType: 'RETRIEVAL_DOCUMENT' },
    },
  });
  assertFiniteVector(embedding);
  return embedding;
}

export async function embedQuery(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: getVertex().textEmbeddingModel(EMBED_MODEL),
    value: text,
    providerOptions: {
      google: { outputDimensionality: DIMENSIONS, taskType: 'RETRIEVAL_QUERY' },
    },
  });
  assertFiniteVector(embedding);
  return embedding;
}

export async function embedTextBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const { embeddings } = await embedMany({
    model: getVertex().textEmbeddingModel(EMBED_MODEL),
    values: texts,
    providerOptions: {
      google: { outputDimensionality: DIMENSIONS, taskType: 'RETRIEVAL_DOCUMENT' },
    },
  });
  embeddings.forEach(assertFiniteVector);
  return embeddings;
}

export function toHalfvecLiteral(vec: number[]): string {
  assertFiniteVector(vec);
  return `[${vec.join(',')}]`;
}
