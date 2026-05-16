import { describe, it, expect } from 'vitest';
import * as MemoryBefore from '@/lib/memory';

describe('memory module shape', () => {
  it('exports expected functions', () => {
    expect(typeof MemoryBefore.loadMemories).toBe('function');
    expect(typeof MemoryBefore.loadRelevantMemories).toBe('function');
    expect(typeof MemoryBefore.loadConversationSummaries).toBe('function');
    expect(typeof MemoryBefore.extractAndSaveMemories).toBe('function');
    expect(typeof MemoryBefore.summarizeConversation).toBe('function');
    expect(typeof MemoryBefore.touchReferencedMemories).toBe('function');
  });
});
