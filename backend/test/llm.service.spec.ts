import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPrompt } from '../src/rag/llm-prompt.util.ts';

test('buildPrompt includes strict grounding instructions and source excerpts', () => {
  const messages = buildPrompt('Como aplicar contraste minimo?', 'pt', [
    {
      id: '1',
      title: 'WCAG 2.2',
      section: '1.4.3 Contrast (Minimum)',
      source_key: 'wcag_2_2',
      language: 'en',
      jurisdiction: 'GLOBAL',
      official_url: 'https://www.w3.org/TR/WCAG22/#contrast-minimum',
      content: 'Text and images of text should have sufficient contrast for readability.',
    },
  ], 'v1-grounded-sources');

  assert.equal(messages.length, 2);
  assert.equal(messages[0]?.content.includes('Use only the supplied sources.'), true);
  assert.equal(messages[0]?.content.includes('Prompt version: v1-grounded-sources.'), true);
  assert.equal(messages[1]?.content.includes('[Source 1] WCAG 2.2 | 1.4.3 Contrast (Minimum)'), true);
});
