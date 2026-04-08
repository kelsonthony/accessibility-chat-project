import type { SourceDefinition } from './source-definitions';

export type ExtractedChunk = {
  chunkKey: string;
  section: string;
  content: string;
  metadata: Record<string, string | boolean | number>;
  embedding: number[];
};

type ExtractedDocument = {
  rawText: string;
  chunks: ExtractedChunk[];
  usedFallback: boolean;
};

const MAX_CHUNK_LENGTH = 520;

export async function fetchSourceDocument(source: SourceDefinition): Promise<ExtractedDocument> {
  try {
    const html = await fetchHtml(source.officialUrl);
    const sections = extractSectionsFromHtml(html, source.sourceKey);

    if (sections.length === 0) {
      return buildFallbackDocument(source);
    }

    const mergedSections = mergeSupplementalSections(source, sections);
    const chunks = sectionsToChunks(source, mergedSections);

    if (chunks.length === 0) {
      return buildFallbackDocument(source);
    }

    return {
      rawText: mergedSections.map((section) => `${section.section}\n${section.content}`).join('\n\n'),
      chunks,
      usedFallback: false,
    };
  } catch {
    return buildFallbackDocument(source);
  }
}

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'AccessChatBot/1.0 (+https://localhost)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

export function extractSectionsFromHtml(html: string, sourceKey?: string) {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  const marked = withoutScripts
    .replace(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi, (_, tag: string, content: string) =>
      `\n[[${tag.toUpperCase()}]] ${toPlainText(content)}\n`,
    )
    .replace(/<(p|li|dd|dt|blockquote|tr)[^>]*>([\s\S]*?)<\/\1>/gi, (_, _tag: string, content: string) =>
      `\n${toPlainText(content)}\n`,
    )
    .replace(/<br\s*\/?>/gi, '\n');

  const stripped = toPlainText(marked);
  const lines = stripped
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.startsWith('[[H') || line.length >= 20);

  const cleanedLines = lines.filter((line) => !isBoilerplateLine(line, sourceKey));

  const sections: Array<{ section: string; content: string }> = [];
  let currentSection = 'Overview';
  let buffer: string[] = [];

  for (const line of cleanedLines) {
    if (line.startsWith('[[H')) {
      if (buffer.length > 0) {
        sections.push({
          section: currentSection,
          content: cleanSectionContent(buffer.join(' '), sourceKey),
        });
      }

      currentSection = line.replace(/^\[\[H[1-6]\]\]\s*/, '').trim() || currentSection;
      buffer = [];
      continue;
    }

    buffer.push(line);
  }

  if (buffer.length > 0) {
    sections.push({
      section: currentSection,
      content: cleanSectionContent(buffer.join(' '), sourceKey),
    });
  }

  return sections
    .map((section) => ({
      section: section.section,
      content: collapseWhitespace(section.content),
    }))
    .filter((section) => section.content.length >= 24)
    .filter((section) => !isBoilerplateSection(section.section, section.content, sourceKey));
}

function toPlainText(value: string) {
  return decodeEntities(value.replace(/<[^>]+>/g, ' '));
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&atilde;/gi, 'ã')
    .replace(/&aacute;/gi, 'á')
    .replace(/&acirc;/gi, 'â')
    .replace(/&eacute;/gi, 'é')
    .replace(/&ecirc;/gi, 'ê')
    .replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&otilde;/gi, 'õ')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&ccedil;/gi, 'ç')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function cleanSectionContent(value: string, sourceKey?: string) {
  return collapseWhitespace(
    value
      .replace(/skip to (page navigation|main content)/gi, ' ')
      .replace(/an official website of the united states government/gi, ' ')
      .replace(/official websites use \.gov/gi, ' ')
      .replace(/secure \.gov websites use https/gi, ' ')
      .replace(/you are now leaving a department of justice website/gi, ' ')
      .replace(/the department of justice does not endorse[\s\S]*$/gi, ' ')
      .replace(/department of justice civil rights division/gi, ' ')
      .replace(/office of inspector general/gi, ' ')
      .replace(/budget and performance/gi, ' ')
      .replace(/legal policies and disclaimers/gi, ' ')
      .replace(/sign up for e-mail updates/gi, ' ')
      .replace(/community outreach coordinator/gi, ' ')
      .replace(/you will be automatically redirected to a:?/gi, ' ')
      .replace(/talk to us at [^.!?]+/gi, ' ')
      .replace(/guidance & resource materials/gi, ' ')
      .replace(/law, regulations & standards/gi, ' ')
      .replace(/a \.gov website belongs to an official government organization in the united states/gi, ' ')
      .replace(/\)\s+or https:\/\/ means you['’]ve safely connected to/gi, ' ')
      .replace(/disability rights section washington, d\.c\.[^.!?]+/gi, ' ')
      .replace(/training, tools & events/gi, ' ')
      .replace(/what's new on section508\.gov\?/gi, ' ')
      .replace(/section508\.gov content library/gi, ' ')
      .replace(/government-wide initiatives/gi, ' ')
      .replace(/micro-purchases and section 508 requirements/gi, ' ')
      .replace(/accessibility requirements tool \(art\)/gi, ' ')
      .replace(/andi \(accessible name & description inspector\)/gi, ' ')
      .replace(/color contrast analyzer\s*\(\s*windows\s*\|\s*macos\s*\)/gi, ' ')
      .replace(/find your 508 program manager/gi, ' ')
      .replace(/accessibility playbooks/gi, ' ')
      .replace(/acronyms & abbreviations/gi, ' ')
      .replace(/web design system/gi, ' ')
      .replace(/cio council accessibility community of practice/gi, ' ')
      .replace(/join the community \(listserv\)/gi, ' ')
      .replace(/home \| section508\.gov/gi, ' '),
  );
}

function isBoilerplateLine(value: string, sourceKey?: string) {
  const line = normalizeForFilter(value);

  const genericPatterns = [
    'skip to page navigation',
    'skip to main content',
    'an official website of the united states government',
    'official websites use .gov',
    'secure .gov websites use https',
    'share sensitive information only on official',
    'office of inspector general',
    'budget and performance',
    'legal policies and disclaimers',
    'sign up for e-mail updates',
    'a .gov website belongs to an official government organization',
    "you've safely connected to",
  ];

  if (genericPatterns.some((pattern) => line.includes(pattern))) {
    return true;
  }

  if (sourceKey === 'ada') {
    const adaPatterns = [
      'you are now leaving a department of justice website',
      'department of justice civil rights division',
      'community outreach coordinator',
      'ada information line',
      '950 pennsylvania avenue',
      'takes no responsibility',
      'you will be automatically redirected to a',
      'guidance & resource materials',
      'law, regulations & standards',
      'talk to us at',
      'disability rights section washington, d.c.',
    ];

    if (adaPatterns.some((pattern) => line.includes(pattern))) {
      return true;
    }
  }

  if (sourceKey === 'section_508') {
    const section508Patterns = [
      "what's new on section508.gov",
      'find your 508 program manager',
      'accessibility playbooks',
      'web design system',
      'cio council accessibility community of practice',
      'join the community listserv',
      'home | section508.gov',
      'section508.gov content library',
      'government-wide initiatives',
      'micro-purchases and section 508 requirements',
      'accessibility requirements tool art',
      'andi accessible name & description inspector',
      'color contrast analyzer',
    ];

    if (section508Patterns.some((pattern) => line.includes(pattern))) {
      return true;
    }
  }

  return false;
}

function isBoilerplateSection(section: string, content: string, sourceKey?: string) {
  const normalizedSection = normalizeForFilter(section);
  const combined = normalizeForFilter(`${section} ${content}`);

  if (combined.length < 40) {
    return true;
  }

  if (sourceKey === 'section_508') {
    if (
      combined.includes('find your 508 program manager') ||
      combined.includes('community of practice') ||
      combined.includes('youve safely connected to') ||
      (normalizeForFilter(section) === 'overview' && combined.includes('.gov website belongs'))
    ) {
      return true;
    }
  }

  if (sourceKey === 'ada') {
    if (
      combined.includes('you are now leaving a department of justice website') ||
      combined.includes('guidance & resource materials') ||
      combined.includes('law, regulations & standards') ||
      combined.includes('talk to us at') ||
      [
        'overview',
        'learn more about these and other requirements',
        'tax season is here',
        'businesses that are open to the public',
      ].includes(normalizedSection)
    ) {
      return true;
    }
  }

  return false;
}

function normalizeForFilter(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sectionsToChunks(
  source: SourceDefinition,
  sections: Array<{ section: string; content: string }>,
): ExtractedChunk[] {
  const chunks: ExtractedChunk[] = [];

  for (const section of sections) {
    const paragraphs = section.content.split(/(?<=[.!?])\s+/).filter(Boolean);
    let current = '';
    let sequence = 1;

    for (const paragraph of paragraphs) {
      if ((current + ' ' + paragraph).trim().length > MAX_CHUNK_LENGTH && current) {
        chunks.push(buildChunk(source, section.section, current, sequence));
        current = paragraph;
        sequence += 1;
      } else {
        current = `${current} ${paragraph}`.trim();
      }
    }

    if (current) {
      chunks.push(buildChunk(source, section.section, current, sequence));
    }
  }

  return chunks;
}

function mergeSupplementalSections(
  source: SourceDefinition,
  sections: Array<{ section: string; content: string }>,
) {
  if (!source.alwaysIncludeFallbackSections) {
    return sections;
  }

  const existingSections = new Set(sections.map((section) => slugify(section.section)));
  const supplemental = source.fallbackSections
    .filter((section) => !existingSections.has(slugify(section.section)))
    .map((section) => ({
      section: section.section,
      content: section.content,
    }));

  return [...sections, ...supplemental];
}

function buildChunk(source: SourceDefinition, section: string, content: string, sequence: number): ExtractedChunk {
  return {
    chunkKey: `${source.sourceKey}_${slugify(section)}_${sequence}`,
    section,
    content,
    metadata: {
      sourceType: source.sourceType,
      jurisdiction: source.jurisdiction,
      sequence,
      fetchedFromOfficialSource: true,
    },
    embedding: deterministicEmbedding(content),
  };
}

function buildFallbackDocument(source: SourceDefinition): ExtractedDocument {
  return {
    rawText: source.fallbackRawText,
    usedFallback: true,
    chunks: source.fallbackSections.map((section, index) => ({
      chunkKey: `${source.sourceKey}_${slugify(section.section)}_${index + 1}`,
      section: section.section,
      content: section.content,
      metadata: {
        ...section.metadata,
        fetchedFromOfficialSource: false,
      },
      embedding: deterministicEmbedding(section.content),
    })),
  };
}

function deterministicEmbedding(content: string) {
  const vector = Array.from({ length: 8 }, () => 0);

  for (let index = 0; index < content.length; index += 1) {
    vector[index % vector.length] += content.charCodeAt(index);
  }

  const max = Math.max(...vector, 1);
  return vector.map((value) => Number((value / max).toFixed(6)));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}
