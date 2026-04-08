import type { AskQuestionInput, AskQuestionResponse, SupportedLanguage } from '@accessibility-platform/contracts';

export function buildFallbackAnswer(input: AskQuestionInput): AskQuestionResponse {
  const language = input.language || detectLanguage(input.question);
  const references = resolveSources(input.question, input.jurisdictions);

  const answerByLanguage: Record<SupportedLanguage, string> = {
    pt: `Modo fallback ativo. A pergunta foi recebida e o fluxo de RAG foi preservado para evolução futura. Priorize ${references
      .map((source) => `${source.title} ${source.section}`)
      .join(', ')} ao implementar a recuperação oficial.`,
    en: `Fallback mode is active. The question was accepted and the RAG flow remains ready for future retrieval. Prioritize ${references
      .map((source) => `${source.title} ${source.section}`)
      .join(', ')} when wiring official search.`,
    es: `El modo fallback está activo. La pregunta fue recibida y el flujo RAG sigue preparado para la recuperación futura. Prioriza ${references
      .map((source) => `${source.title} ${source.section}`)
      .join(', ')} al conectar la búsqueda oficial.`,
  };

  return {
    answer: answerByLanguage[language],
    confidence: 0.51,
    language,
    mode: 'fallback',
    sources: references,
  };
}

export function detectLanguage(question: string): SupportedLanguage {
  if (/[¿¡]/.test(question) || /\b(el|la|que|para)\b/i.test(question)) {
    return 'es';
  }

  if (/\b(the|for|with|should)\b/i.test(question)) {
    return 'en';
  }

  return 'pt';
}

export function resolveSources(question: string, jurisdictions: AskQuestionInput['jurisdictions']) {
  const lowerQuestion = question.toLowerCase();
  const isBrazil = jurisdictions?.includes('BR') || /\bbrasil|lbi\b/i.test(lowerQuestion);
  const isUs = jurisdictions?.includes('US') || /\bada|508|section 508\b/i.test(lowerQuestion);
  const isEu = jurisdictions?.includes('EU') || /\beu|europe|en 301 549\b/i.test(lowerQuestion);

  if (isBrazil) {
    return [
      {
        id: 'lbi_artigo_63',
        title: 'Lei Brasileira de Inclusao',
        section: 'Art. 63',
        source: 'LBI' as const,
        language: 'pt' as const,
        officialUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm',
      },
    ];
  }

  if (isUs) {
    return [
      {
        id: 'section_508_intro',
        title: 'Section 508',
        section: 'Overview',
        source: 'SECTION_508' as const,
        language: 'en' as const,
        officialUrl: 'https://www.section508.gov/',
      },
    ];
  }

  if (isEu) {
    return [
      {
        id: 'en_301_549_scope',
        title: 'EN 301 549',
        section: 'Scope',
        source: 'EN_301_549' as const,
        language: 'en' as const,
        officialUrl: 'https://www.etsi.org/standards',
      },
    ];
  }

  return [
    {
      id: 'wcag_2_2_1_4_3',
      title: 'WCAG 2.2',
      section: '1.4.3 Contrast (Minimum)',
      source: 'WCAG' as const,
      language: 'en' as const,
      officialUrl: 'https://www.w3.org/TR/WCAG22/#contrast-minimum',
    },
  ];
}

