import test from 'node:test';
import assert from 'node:assert/strict';

import { buildFallbackAnswer } from '../src/rag/rag-response.ts';

test('buildFallbackAnswer returns fallback mode with sources', () => {
  const response = buildFallbackAnswer({
    question: 'Quais requisitos da LBI devo observar no Brasil?',
  });

  assert.equal(response.mode, 'fallback');
  assert.equal(response.language, 'pt');
  assert.ok(response.sources.length > 0);
});
