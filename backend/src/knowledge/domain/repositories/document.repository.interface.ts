export const DOCUMENT_CHUNK_REPOSITORY = Symbol('IDocumentChunkRepository');

export interface DocumentChunkRow {
  id: string;
  title: string;
  section: string;
  source_key: string;
  language: string;
  jurisdiction: string;
  official_url: string;
  content: string;
}

export interface IDocumentChunkRepository {
  findByTerms(terms: string[], jurisdictions: string[]): Promise<DocumentChunkRow[]>;
  upsertChunk(params: {
    id: string;
    documentId: string;
    chunkKey: string;
    content: string;
    section: string;
    metadata: Record<string, unknown>;
    embedding: unknown;
  }): Promise<void>;
  deleteByDocumentId(documentId: string): Promise<void>;
}
