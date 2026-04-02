import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 30;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const formData = await req.formData();
  const imageFile = formData.get('image') as File | null;

  if (!imageFile) {
    return Response.json({ error: 'No image provided' }, { status: 400 });
  }

  const bytes = await imageFile.arrayBuffer();
  const base64 = Buffer.from(bytes).toString('base64');

  // Determine media type
  let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/png';
  if (imageFile.type === 'image/jpeg' || imageFile.type === 'image/jpg') {
    mediaType = 'image/jpeg';
  } else if (imageFile.type === 'image/webp') {
    mediaType = 'image/webp';
  }

  const anthropic = new Anthropic();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64,
            },
          },
          {
            type: 'text',
            text: `Extract all medications from this pharmacy screenshot. For each medication, provide:
- name: the medication name
- dose: the dosage (e.g., "500mg", "10mg/5ml")
- frequency: how often it's taken (e.g., "Once daily", "Twice daily", "As needed")

Return ONLY valid JSON in this exact format:
{"medications": [{"name": "...", "dose": "...", "frequency": "..."}]}

If you cannot find any medications, return: {"medications": []}`,
          },
        ],
      },
    ],
  });

  try {
    const textBlock = response.content.find((b) => b.type === 'text');
    const text = textBlock && 'text' in textBlock ? textBlock.text : '';
    // Extract JSON from the response (might be wrapped in markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ medications: [] });
    }
    const parsed = JSON.parse(jsonMatch[0]);
    return Response.json(parsed);
  } catch {
    return Response.json({ medications: [] });
  }
}
