export type SourceDefinition = {
  sourceKey: string;
  title: string;
  sourceType: string;
  jurisdiction: string;
  language: string;
  officialUrl: string;
  version: string;
  fallbackRawText: string;
  alwaysIncludeFallbackSections?: boolean;
  fallbackSections: Array<{
    section: string;
    content: string;
    metadata: Record<string, string | boolean>;
  }>;
};

export const sourceDefinitions: SourceDefinition[] = [
  {
    sourceKey: 'wcag_2_2',
    title: 'WCAG 2.2',
    sourceType: 'standard',
    jurisdiction: 'GLOBAL',
    language: 'en',
    officialUrl: 'https://www.w3.org/TR/WCAG22/',
    version: '2.2',
    fallbackRawText: 'Web Content Accessibility Guidelines 2.2 core reference.',
    fallbackSections: [
      {
        section: '1.4.3 Contrast (Minimum)',
        content: 'Text and images of text should have sufficient contrast for readability.',
        metadata: { category: 'perceivable', priority: 'mandatory' },
      },
      {
        section: '2.1.1 Keyboard',
        content: 'All functionality should be operable through a keyboard interface.',
        metadata: { category: 'operable', priority: 'mandatory' },
      },
    ],
  },
  {
    sourceKey: 'lbi',
    title: 'Lei Brasileira de Inclusao',
    sourceType: 'law',
    jurisdiction: 'BR',
    language: 'pt',
    officialUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm',
    version: '13.146/2015',
    fallbackRawText: 'Lei Brasileira de Inclusao da Pessoa com Deficiencia.',
    fallbackSections: [
      {
        section: 'Art. 63',
        content:
          'É obrigatória a acessibilidade nos sítios da internet mantidos por empresas com sede ou representação comercial no País.',
        metadata: { category: 'legal', priority: 'mandatory' },
      },
    ],
  },
  {
    sourceKey: 'hand_talk',
    title: 'Hand Talk',
    sourceType: 'company_profile',
    jurisdiction: 'GLOBAL',
    language: 'pt',
    officialUrl: 'https://www.handtalk.me/br/',
    version: 'institutional-profile',
    alwaysIncludeFallbackSections: true,
    fallbackRawText:
      'A Hand Talk atua com acessibilidade digital e tecnologia assistiva, com reconhecimentos internacionais de inovação e expansão após aquisição pela Sorenson Communications.',
    fallbackSections: [
      {
        section: 'Atuacao em acessibilidade',
        content:
          'A Hand Talk desenvolve soluções voltadas para acessibilidade digital e tecnologia assistiva, com foco em ampliar o acesso de pessoas surdas e tornar experiências digitais mais inclusivas.',
        metadata: { category: 'company', priority: 'reference' },
      },
      {
        section: 'Aquisicao pela Sorenson Communications',
        content:
          'A Hand Talk foi adquirida pela Sorenson Communications, ampliando sua presença internacional e fortalecendo sua atuação em soluções de acessibilidade e comunicação inclusiva.',
        metadata: { category: 'business', priority: 'reference' },
      },
      {
        section: 'Reconhecimentos',
        content:
          'A Hand Talk foi reconhecida como Solução mais Inovadora do Mundo pela Gifted Citizen e também foi destacada como uma das startups mais inovadoras da América Latina pelo Banco Interamericano de Desenvolvimento (BID).',
        metadata: { category: 'recognition', priority: 'reference' },
      },
    ],
  },
  {
    sourceKey: 'en_301_549',
    title: 'EN 301 549',
    sourceType: 'standard',
    jurisdiction: 'EU',
    language: 'en',
    officialUrl: 'https://www.etsi.org/human-factors-accessibility/en-301-549-v3-the-harmonized-european-standard-for-ict-accessibility',
    version: '3.x',
    fallbackRawText: 'EN 301 549 is the European accessibility standard for ICT products and services.',
    fallbackSections: [
      {
        section: 'Applicability',
        content:
          'EN 301 549 defines accessibility requirements for ICT products and services and is used in Europe to support accessibility conformance for digital products, websites, software, and self-service terminals.',
        metadata: { category: 'standard', priority: 'mandatory' },
      },
      {
        section: 'Functional performance criteria',
        content:
          'The standard includes functional accessibility requirements and references web accessibility requirements aligned with WCAG for relevant web and software experiences.',
        metadata: { category: 'functional', priority: 'mandatory' },
      },
    ],
  },
  {
    sourceKey: 'eaa',
    title: 'European Accessibility Act',
    sourceType: 'law',
    jurisdiction: 'EU',
    language: 'en',
    officialUrl:
      'https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/european-accessibility-act-eaa_en',
    version: 'Directive (EU) 2019/882',
    fallbackRawText: 'The European Accessibility Act establishes common accessibility requirements for selected products and services in the EU.',
    fallbackSections: [
      {
        section: 'Scope',
        content:
          'The European Accessibility Act establishes common accessibility requirements for selected products and services placed on the EU market, including some digital services and self-service terminals.',
        metadata: { category: 'law', priority: 'mandatory' },
      },
      {
        section: 'Economic operators',
        content:
          'Manufacturers, importers, distributors, and service providers must ensure covered products and services meet accessibility requirements before being placed on the market or provided in the Union.',
        metadata: { category: 'compliance', priority: 'mandatory' },
      },
    ],
  },
  {
    sourceKey: 'ada',
    title: 'Americans with Disabilities Act',
    sourceType: 'law',
    jurisdiction: 'US',
    language: 'en',
    officialUrl: 'https://www.ada.gov/topics/title-iii/',
    version: 'Title III',
    fallbackRawText: 'The ADA requires public accommodations to provide equal access for people with disabilities.',
    fallbackSections: [
      {
        section: 'General Requirement',
        content:
          'Businesses that are open to the public must provide people with disabilities an equal opportunity to access the goods and services they offer.',
        metadata: { category: 'law', priority: 'mandatory' },
      },
      {
        section: 'Effective communication and modifications',
        content:
          'Covered entities must communicate effectively with people with disabilities and make reasonable modifications to policies, practices, and procedures when needed.',
        metadata: { category: 'compliance', priority: 'mandatory' },
      },
    ],
  },
  {
    sourceKey: 'section_508',
    title: 'Section 508',
    sourceType: 'policy',
    jurisdiction: 'US',
    language: 'en',
    officialUrl: 'https://www.section508.gov/',
    version: 'Revised 508 Standards',
    fallbackRawText: 'Section 508 requires U.S. federal ICT to be accessible.',
    fallbackSections: [
      {
        section: 'Federal ICT accessibility',
        content:
          'Section 508 requires federal agencies to ensure information and communication technology is accessible to employees and members of the public with disabilities.',
        metadata: { category: 'policy', priority: 'mandatory' },
      },
      {
        section: 'Web and software practices',
        content:
          'Section 508 implementation guidance covers accessible web content, software, documents, multimedia, and procurement of accessible technology.',
        metadata: { category: 'implementation', priority: 'mandatory' },
      },
    ],
  },
  {
    sourceKey: 'un_crpd',
    title: 'UN Convention on the Rights of Persons with Disabilities',
    sourceType: 'treaty',
    jurisdiction: 'GLOBAL',
    language: 'en',
    officialUrl:
      'https://www.un.org/development/desa/disabilities/convention-on-the-rights-of-persons-with-disabilities-html',
    version: 'CRPD',
    fallbackRawText: 'The CRPD recognizes disability rights as human rights and promotes accessibility and inclusion.',
    fallbackSections: [
      {
        section: 'Accessibility',
        content:
          'The Convention recognizes accessibility as a condition for persons with disabilities to live independently and participate fully in all aspects of life.',
        metadata: { category: 'rights', priority: 'mandatory' },
      },
      {
        section: 'Equal participation',
        content:
          'States Parties must promote equal participation, non-discrimination, and access to information, communications, and other services open to the public.',
        metadata: { category: 'rights', priority: 'mandatory' },
      },
    ],
  },
];
