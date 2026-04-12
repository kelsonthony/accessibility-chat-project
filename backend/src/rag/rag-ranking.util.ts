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

  // Base scoring for term matches
  for (const term of terms) {
    // Skip common question words that don't add value
    if (['what', 'how', 'why', 'when', 'where', 'tell', 'about', 'the', 'is', 'are'].includes(term)) {
      continue;
    }

    if (title.includes(term)) score += 7;
    if (section.includes(term)) score += 5;
    if (content.includes(term)) score += 3;
  }

  // Language preference
  if (row.language === language) {
    score += 4;
  }

  // Jurisdiction preference
  if (jurisdictions.includes(row.jurisdiction)) {
    score += row.jurisdiction === 'GLOBAL' ? 1 : 5;
  }

  // Penalize GLOBAL sources when specific jurisdiction is requested
  if (row.jurisdiction === 'GLOBAL' && jurisdictions.some((jurisdiction) => jurisdiction !== 'GLOBAL')) {
    score -= 6;
  }

  // Source-specific boosts (IMPROVED - more aggressive matching)
  if (row.source_key === 'lbi') {
    if (terms.some((term) => ['lbi', 'brasil', 'brasileira'].includes(term))) {
      score += 20; // Strong boost for direct LBI mention
    }
    if (terms.some((term) => ['lei', 'acessibilidade', 'inclusao'].includes(term))) {
      score += 8;
    }
  }

  if (row.source_key === 'hand_talk') {
    if (terms.some((term) => ['hand', 'talk'].includes(term))) {
      score += 20;
    }
    if (terms.some((term) => ['sorenson', 'gifted', 'citizen', 'banco', 'interamericano', 'bid', 'startup'].includes(term))) {
      score += 12;
    }
  }

  if (row.source_key === 'ada') {
    if (terms.some((term) => ['ada', 'americans', 'disabilities'].includes(term))) {
      score += 20; // Strong boost for direct ADA mention
    }
    if (terms.some((term) => ['public', 'business', 'accommodation', 'checkout', 'title'].includes(term))) {
      score += 8;
    }
  }

  if (row.source_key === 'section_508') {
    if (terms.some((term) => ['508', 'section'].includes(term))) {
      score += 20; // Strong boost for direct Section 508 mention
    }
    if (terms.some((term) => ['federal', 'procurement', 'agency', 'software', 'government'].includes(term))) {
      score += 8;
    }
  }

  if (row.source_key === 'wcag_2_2') {
    if (terms.some((term) => ['wcag', 'w3c'].includes(term))) {
      score += 15;
    }
    if (terms.some((term) => ['guideline', 'keyboard', 'contrast', 'aria', 'perceivable', 'operable'].includes(term))) {
      score += 6;
    }
  }

  if (row.source_key === 'en_301_549') {
    if (terms.some((term) => ['301', '549', 'en'].includes(term))) {
      score += 20;
    }
    if (terms.some((term) => ['europa', 'europe', 'european', 'kiosk', 'terminal', 'etsi'].includes(term))) {
      score += 8;
    }
  }

  if (row.source_key === 'eaa') {
    if (terms.some((term) => ['eaa', 'european', 'accessibility', 'act'].includes(term))) {
      score += 18;
    }
    if (terms.some((term) => ['directive', 'service', 'terminal', 'market', 'product'].includes(term))) {
      score += 6;
    }
  }

  if (row.source_key === 'un_crpd') {
    if (terms.some((term) => ['crpd', 'un', 'convention'].includes(term))) {
      score += 18;
    }
    if (terms.some((term) => ['rights', 'united', 'nations', 'inclusion', 'disability'].includes(term))) {
      score += 6;
    }
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
