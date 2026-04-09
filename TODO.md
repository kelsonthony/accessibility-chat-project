• Não. Neste momento o “RAG” está só parcialmente implementado.

  Hoje ele funciona assim:

  - há um seed manual em backend/src/ingestion/ingestion.service.ts
  - esse seed cria documentos e chunks pré-definidos de exemplo para WCAG 2.2 e LBI
  - os dados são persistidos no PostgreSQL Oracle em:
      - accesschat.documents
      - accesschat.document_chunks
  - o endpoint /ask consulta esses chunks já persistidos e monta uma resposta grounded simples em backend/src/rag/rag.service.ts

  Então, objetivamente:

  O que existe:

  - persistência real no Postgres
  - chunks reais seedados no banco
  - busca simples por termos da pergunta
  - resposta em modo rag quando encontra chunks compatíveis
  - fallback quando não encontra

  O que não existe ainda:

  - download automático de HTML/PDF
  - Docling
  - parser de fonte oficial
  - chunking automático de documentos grandes
  - embeddings reais
  - busca vetorial com pgvector

  Onde os dados entram no Postgres:

  - tabela accesschat.documents
      - metadados do documento, URL oficial, idioma, jurisdição, texto bruto
  - tabela accesschat.document_chunks
      - chunk_key
      - content
      - section
      - metadata
      - embedding atualmente em jsonb

  Importante:

  - essa instância Oracle não tem pgvector
  - por isso embedding está em jsonb, não em coluna vetorial
  - hoje o retrieval é textual/heurístico, não vetorial

  Fluxo atual do /ask:

  1. recebe pergunta
  2. detecta idioma se necessário
  3. tokeniza a pergunta
  4. faz query SQL nos chunks em accesschat.document_chunks
  5. prioriza documentos por jurisdição
  6. se achar resultado, responde com mode: "rag"
  7. se não achar, cai no fallback

  Se quiser, eu posso agora implementar a próxima etapa real:

  - ingestão de HTML oficial
  - chunking automático
  - gravação em documents/document_chunks
  - e um “RAG semântico” inicial mesmo sem pgvector, usando ranking híbrido textual antes de migrar para vetor de verdade