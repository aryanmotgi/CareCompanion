import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { embed, embedMany } from 'ai';

const EMBED_MODEL = 'gemini-embedding-001';
const DIMENSIONS = 768;

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

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
    model: google.textEmbeddingModel(EMBED_MODEL),
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
    model: google.textEmbeddingModel(EMBED_MODEL),
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
    model: google.textEmbeddingModel(EMBED_MODEL),
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
