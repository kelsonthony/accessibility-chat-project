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
  const normalized = question.toLowerCase();

  // Portuguese indicators (weighted scoring)
  let ptScore = 0;
  let enScore = 0;
  let esScore = 0;

  // Strong Portuguese indicators
  if (/\b(acessibilidade|como|qual|quais|onde|porque|voce|você|esta|está|tem|são|preciso|gostaria|poderia)\b/i.test(normalized)) {
    ptScore += 3;
  }
  if (/\b(ção|ões|mente|izar)\b/i.test(normalized)) {
    ptScore += 2;
  }
  if (/\b(hand talk|lbi|brasil|sorenson|banco interamericano)\b/i.test(normalized)) {
    ptScore += 2;
  }

  // Strong Spanish indicators
  if (/[¿¡]/.test(question)) {
    esScore += 5;
  }
  if (/\b(accesibilidad|cómo|cuál|cuáles|dónde|por qué|porqué|está|están|necesito|quisiera|podría)\b/i.test(normalized)) {
    esScore += 3;
  }
  if (/\b(ción|mente|izar|para|con|desde)\b/i.test(normalized)) {
    esScore += 1;
  }

  // Strong English indicators
  if (/\b(accessibility|how|what|where|why|should|would|could|need|want|can)\b/i.test(normalized)) {
    enScore += 3;
  }
  if (/\b(the|with|from|this|that|these|those)\b/i.test(normalized)) {
    enScore += 1;
  }
  if (/\b(wcag|ada|section 508|aria)\b/i.test(normalized)) {
    enScore += 2;
  }

  // Return the language with highest score
  if (esScore > ptScore && esScore > enScore) {
    return 'es';
  }
  if (enScore > ptScore && enScore > esScore) {
    return 'en';
  }

  // Default to Portuguese (Brazilian market)
  return 'pt';
}

export function resolveSources(question: string, jurisdictions: AskQuestionInput['jurisdictions']) {
  const lowerQuestion = question.toLowerCase();
  const isHandTalk = /\bhand talk|sorenson|gifted citizen|banco interamericano|bid\b/i.test(lowerQuestion);
  const isBrazil = jurisdictions?.includes('BR') || /\bbrasil|lbi\b/i.test(lowerQuestion);
  const isUs = jurisdictions?.includes('US') || /\bada|508|section 508\b/i.test(lowerQuestion);
  const isEu = jurisdictions?.includes('EU') || /\beu|europe|en 301 549|eaa|directive 2019\/882\b/i.test(lowerQuestion);

  if (isHandTalk) {
    return [
      {
        id: 'hand_talk_accessibility',
        title: 'Hand Talk',
        section: 'Atuacao em acessibilidade',
        source: 'HAND_TALK' as const,
        language: 'pt' as const,
        officialUrl: 'https://www.handtalk.me/br/',
      },
      {
        id: 'hand_talk_sorenson',
        title: 'Hand Talk',
        section: 'Aquisicao pela Sorenson Communications',
        source: 'HAND_TALK' as const,
        language: 'pt' as const,
        officialUrl: 'https://www.handtalk.me/br/',
      },
    ];
  }

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
        id: 'ada_title_iii',
        title: 'Americans with Disabilities Act',
        section: 'General Requirement',
        source: 'ADA' as const,
        language: 'en' as const,
        officialUrl: 'https://www.ada.gov/topics/title-iii/',
      },
      {
        id: 'section_508_intro',
        title: 'Section 508',
        section: 'Federal ICT accessibility',
        source: 'SECTION_508' as const,
        language: 'en' as const,
        officialUrl: 'https://www.section508.gov/',
      },
    ];
  }

  if (isEu) {
    return [
      {
        id: 'eaa_scope',
        title: 'European Accessibility Act',
        section: 'Scope',
        source: 'EAA' as const,
        language: 'en' as const,
        officialUrl:
          'https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/european-accessibility-act-eaa_en',
      },
      {
        id: 'en_301_549_scope',
        title: 'EN 301 549',
        section: 'Applicability',
        source: 'EN_301_549' as const,
        language: 'en' as const,
        officialUrl:
          'https://www.etsi.org/human-factors-accessibility/en-301-549-v3-the-harmonized-european-standard-for-ict-accessibility',
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
    {
      id: 'un_crpd_accessibility',
      title: 'UN Convention on the Rights of Persons with Disabilities',
      section: 'Accessibility',
      source: 'UN_CRPD' as const,
      language: 'en' as const,
      officialUrl:
        'https://www.un.org/development/desa/disabilities/convention-on-the-rights-of-persons-with-disabilities-html',
    },
  ];
}
