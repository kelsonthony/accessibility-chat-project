import test from 'node:test';
import assert from 'node:assert/strict';

import { rankCandidates } from '../src/rag/rag-ranking.util.ts';

test('rankCandidates prioritizes relevant chunks by language and term overlap', () => {
  const ranked = rankCandidates(
    [
      {
        id: '1',
        title: 'WCAG 2.2',
        section: '2.1.1 Keyboard',
        source_key: 'wcag_2_2',
        language: 'en',
        jurisdiction: 'GLOBAL',
        official_url: 'https://www.w3.org/TR/WCAG22/',
        content: 'All functionality should be operable through a keyboard interface.',
      },
      {
        id: '2',
        title: 'Lei Brasileira de Inclusao',
        section: 'Art. 63',
        source_key: 'lbi',
        language: 'pt',
        jurisdiction: 'BR',
        official_url: 'https://www.planalto.gov.br/',
        content: 'É obrigatória a acessibilidade nos sítios da internet.',
      },
    ],
    ['keyboard', 'checkout'],
    'en',
    ['GLOBAL'],
  );

  assert.equal(ranked[0]?.id, '1');
});

test('rankCandidates prioritizes EU-specific sources for EN 301 549 style queries', () => {
  const ranked = rankCandidates(
    [
      {
        id: 'wcag',
        title: 'WCAG 2.2',
        section: 'Abstract',
        source_key: 'wcag_2_2',
        language: 'en',
        jurisdiction: 'GLOBAL',
        official_url: 'https://www.w3.org/TR/WCAG22/',
        content: 'These guidelines address accessibility of web content on any kind of device.',
      },
      {
        id: 'en301549',
        title: 'EN 301 549',
        section: 'Applicability',
        source_key: 'en_301_549',
        language: 'en',
        jurisdiction: 'EU',
        official_url: 'https://www.etsi.org/',
        content: 'The standard can be applied to ICT-based products and services, including self-service terminals.',
      },
    ],
    ['europe', '301', '549', 'terminal'],
    'pt',
    ['EU'],
  );

  assert.equal(ranked[0]?.id, 'en301549');
});

test('rankCandidates keeps source diversity when one source dominates many sections', () => {
  const ranked = rankCandidates(
    [
      {
        id: 'ada1',
        title: 'Americans with Disabilities Act',
        section: 'Overview',
        source_key: 'ada',
        language: 'en',
        jurisdiction: 'US',
        official_url: 'https://www.ada.gov/',
        content: 'ADA obligations for public accommodations and accessible services.',
      },
      {
        id: 'ada2',
        title: 'Americans with Disabilities Act',
        section: 'Specific Requirements',
        source_key: 'ada',
        language: 'en',
        jurisdiction: 'US',
        official_url: 'https://www.ada.gov/',
        content: 'ADA requires effective communication and reasonable modifications.',
      },
      {
        id: 'ada3',
        title: 'Americans with Disabilities Act',
        section: 'Barrier Removal',
        source_key: 'ada',
        language: 'en',
        jurisdiction: 'US',
        official_url: 'https://www.ada.gov/',
        content: 'ADA discusses barrier removal and access to goods and services.',
      },
      {
        id: '508',
        title: 'Section 508',
        section: 'Federal ICT accessibility',
        source_key: 'section_508',
        language: 'en',
        jurisdiction: 'US',
        official_url: 'https://www.section508.gov/',
        content: 'Section 508 requires federal ICT and procurement accessibility.',
      },
    ],
    ['ada', '508', 'federal', 'accessibility'],
    'pt',
    ['US'],
  );

  assert.equal(ranked.some((row) => row.source_key === 'section_508'), true);
  assert.equal(ranked.filter((row) => row.source_key === 'ada').length <= 2, true);
});

test('rankCandidates prioritizes Hand Talk institutional content for company questions', () => {
  const ranked = rankCandidates(
    [
      {
        id: 'wcag',
        title: 'WCAG 2.2',
        section: 'Abstract',
        source_key: 'wcag_2_2',
        language: 'en',
        jurisdiction: 'GLOBAL',
        official_url: 'https://www.w3.org/TR/WCAG22/',
        content: 'WCAG addresses accessibility of web content.',
      },
      {
        id: 'handtalk',
        title: 'Hand Talk',
        section: 'Reconhecimentos',
        source_key: 'hand_talk',
        language: 'pt',
        jurisdiction: 'GLOBAL',
        official_url: 'https://www.handtalk.me/br/',
        content:
          'A Hand Talk foi reconhecida como Solução mais Inovadora do Mundo pela Gifted Citizen e destacada pelo BID.',
      },
    ],
    ['hand', 'talk', 'sorenson', 'gifted', 'citizen'],
    'pt',
    ['GLOBAL'],
  );

  assert.equal(ranked[0]?.id, 'handtalk');
});
