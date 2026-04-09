import test from 'node:test';
import assert from 'node:assert/strict';

import { extractSectionsFromHtml } from '../src/ingestion/html-ingestion.util.ts';

test('extracts sections from basic HTML headings and paragraphs', () => {
  const sections = extractSectionsFromHtml(`
    <html>
      <body>
        <h1>WCAG 2.2</h1>
        <p>Accessibility guidance for web content.</p>
        <h2>1.4.3 Contrast (Minimum)</h2>
        <p>Text should have sufficient contrast.</p>
      </body>
    </html>
  `);

  assert.equal(sections.length >= 2, true);
  assert.equal(sections[0]?.section.includes('WCAG 2.2'), true);
  assert.equal(sections[1]?.section.includes('Contrast'), true);
});

test('removes obvious federal navigation boilerplate for ADA and Section 508 pages', () => {
  const sections = extractSectionsFromHtml(
    `
    <html>
      <body>
        <h1>Overview</h1>
        <p>Skip to main content. An official website of the United States government.</p>
        <p>Businesses must provide people with disabilities an equal opportunity to access the goods or services that they offer.</p>
        <h2>Our Mission</h2>
        <p>Training, Tools & Events What's New on Section508.gov? Find Your 508 Program Manager.</p>
        <p>Section 508 requires federal agencies to ensure ICT is accessible.</p>
      </body>
    </html>
  `,
    'section_508',
  );

  assert.equal(sections.length >= 1, true);
  assert.equal(sections.some((section) => section.content.includes('An official website of the United States government')), false);
  assert.equal(sections.some((section) => section.content.includes('Find Your 508 Program Manager')), false);
  assert.equal(sections.some((section) => section.content.includes('Section 508 requires federal agencies')), true);
});
