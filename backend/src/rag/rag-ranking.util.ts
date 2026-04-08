import type { SupportedLanguage } from '@accessibility-platform/contracts';

export type RagCandidate = {
  id: string;
  title: string;
  section: string;
  source_key: string;
  language: string;
  jurisdiction: string;
  official_url: string;
  content: string;
};

export function rankCandidates(
  rows: RagCandidate[],
  terms: string[],
  language: SupportedLanguage,
  jurisdictions: string[],
) {
  const unique = new Set<string>();
  const perSource = new Map<string, number>();
  const preferredSource = resolvePreferredSource(terms);

  return rows
    .map((row) => ({
      row,
      score: scoreRow(row, terms, language, jurisdictions),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.row.section.localeCompare(right.row.section))
    .filter((entry) => {
      const dedupeKey = `${entry.row.source_key}:${entry.row.section}`;
      if (unique.has(dedupeKey)) {
        return false;
      }

      const currentCount = perSource.get(entry.row.source_key) || 0;
      const maxPerSource = preferredSource === entry.row.source_key ? 3 : 2;
      if (currentCount >= maxPerSource) {
        return false;
      }

      unique.add(dedupeKey);
      perSource.set(entry.row.source_key, currentCount + 1);
      return true;
    })
    .slice(0, 3)
    .map((entry) => entry.row);
}

function scoreRow(
  row: RagCandidate,
  terms: string[],
  language: SupportedLanguage,
  jurisdictions: string[],
) {
  const title = normalize(row.title);
  const section = normalize(row.section);
  const content = normalize(row.content);

  let score = 0;

  for (const term of terms) {
    if (title.includes(term)) score += 7;
    if (section.includes(term)) score += 5;
    if (content.includes(term)) score += 3;
  }

  if (row.language === language) {
    score += 4;
  }

  if (jurisdictions.includes(row.jurisdiction)) {
    score += row.jurisdiction === 'GLOBAL' ? 1 : 5;
  }

  if (row.jurisdiction === 'GLOBAL' && jurisdictions.some((jurisdiction) => jurisdiction !== 'GLOBAL')) {
    score -= 6;
  }

  if (row.source_key === 'lbi' && terms.some((term) => ['brasil', 'lbi', 'lei', 'acessibilidade'].includes(term))) {
    score += 4;
  }

  if (
    row.source_key === 'hand_talk' &&
    terms.some((term) =>
      ['hand', 'talk', 'sorenson', 'gifted', 'citizen', 'banco', 'interamericano', 'bid', 'startup', 'inovadora'].includes(term),
    )
  ) {
    score += 12;
  }

  if (row.source_key === 'wcag_2_2' && terms.some((term) => ['wcag', 'keyboard', 'contrast'].includes(term))) {
    score += 4;
  }

  if (
    row.source_key === 'en_301_549' &&
    terms.some((term) => ['europa', 'europe', 'european', 'en', '301', '549', 'kiosk', 'terminal'].includes(term))
  ) {
    score += 6;
  }

  if (row.source_key === 'eaa' && terms.some((term) => ['eaa', 'directive', 'service', 'terminal', 'market'].includes(term))) {
    score += 6;
  }

  if (row.source_key === 'ada' && terms.some((term) => ['ada', 'public', 'business', 'accommodation', 'checkout'].includes(term))) {
    score += 6;
  }

  if (
    row.source_key === 'section_508' &&
    terms.some((term) => ['508', 'federal', 'procurement', 'agency', 'software'].includes(term))
  ) {
    score += 12;
  }

  if (row.source_key === 'un_crpd' && terms.some((term) => ['crpd', 'rights', 'un', 'convention', 'inclusion'].includes(term))) {
    score += 4;
  }

  return score;
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function resolvePreferredSource(terms: string[]) {
  if (terms.some((term) => ['hand', 'talk', 'sorenson', 'gifted', 'citizen', 'bid'].includes(term))) {
    return 'hand_talk';
  }

  if (terms.some((term) => ['ada', '508', 'section'].includes(term))) {
    return 'section_508';
  }

  if (terms.some((term) => ['en', '301', '549', 'eaa'].includes(term))) {
    return 'en_301_549';
  }

  return null;
}
