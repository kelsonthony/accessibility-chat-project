import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';

import { AppConfigService } from '../config/app-config.service';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  readonly pool: Pool;

  constructor(private readonly config: AppConfigService) {
    this.pool = new Pool({
      connectionString: this.config.databaseUrl,
      options: '-c search_path=accesschat,public',
    });
  }

  async onModuleInit() {
    await this.pool.query('select 1');
    await this.pool.query('create schema if not exists accesschat');
    await this.pool.query(`
      create table if not exists accesschat.users (
        id uuid primary key,
        email text not null unique,
        display_name text not null,
        password_hash text not null,
        created_at timestamptz not null default now(),
        email_verified_at timestamptz
      );

      alter table accesschat.users add column if not exists email_verified_at timestamptz;
      update accesschat.users
      set email_verified_at = created_at
      where email_verified_at is null;

      create table if not exists accesschat.telemetry_events (
        id uuid primary key,
        user_id uuid references accesschat.users(id) on delete set null,
        session_id text not null,
        event_type text not null,
        timestamp timestamptz not null,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );

      create index if not exists telemetry_events_user_id_idx on accesschat.telemetry_events(user_id);
      create index if not exists telemetry_events_event_type_idx on accesschat.telemetry_events(event_type);
      create index if not exists telemetry_events_timestamp_idx on accesschat.telemetry_events(timestamp desc);

      create table if not exists accesschat.documents (
        id uuid primary key,
        source_key text not null unique,
        title text not null,
        source_type text not null,
        jurisdiction text not null,
        language text not null,
        official_url text not null,
        version text,
        synced_at timestamptz not null default now(),
        raw_text text not null
      );

      create table if not exists accesschat.document_chunks (
        id uuid primary key,
        document_id uuid not null references accesschat.documents(id) on delete cascade,
        chunk_key text not null unique,
        content text not null,
        section text not null,
        metadata jsonb not null default '{}'::jsonb,
        embedding jsonb,
        created_at timestamptz not null default now()
      );

      create index if not exists document_chunks_document_id_idx on accesschat.document_chunks(document_id);

      create table if not exists accesschat.ingestion_jobs (
        id uuid primary key,
        job_type text not null,
        status text not null,
        detail jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );

      create table if not exists accesschat.rag_query_runs (
        id uuid primary key,
        user_id uuid references accesschat.users(id) on delete set null,
        question_hash text not null,
        language text not null,
        jurisdictions jsonb not null default '[]'::jsonb,
        mode text not null,
        response_origin text not null,
        provider_model text,
        retrieved_chunks integer not null default 0,
        latency_ms integer not null,
        sources jsonb not null default '[]'::jsonb,
        created_at timestamptz not null default now()
      );

      create index if not exists rag_query_runs_created_at_idx on accesschat.rag_query_runs(created_at desc);
      create index if not exists rag_query_runs_mode_idx on accesschat.rag_query_runs(mode);

      create table if not exists accesschat.captcha_challenges (
        id uuid primary key,
        prompt text not null,
        answer_hash text not null,
        expires_at timestamptz not null,
        consumed_at timestamptz,
        created_at timestamptz not null default now()
      );

      create index if not exists captcha_challenges_expires_at_idx on accesschat.captcha_challenges(expires_at desc);

      create table if not exists accesschat.email_verification_requests (
        id uuid primary key,
        email text not null,
        display_name text not null,
        password_hash text not null,
        code_hash text not null,
        expires_at timestamptz not null,
        attempts integer not null default 0,
        consumed_at timestamptz,
        created_at timestamptz not null default now()
      );

      create index if not exists email_verification_requests_email_idx
      on accesschat.email_verification_requests(email, created_at desc);

      create table if not exists accesschat.password_reset_requests (
        id uuid primary key,
        user_id uuid not null references accesschat.users(id) on delete cascade,
        email text not null,
        code_hash text not null,
        expires_at timestamptz not null,
        attempts integer not null default 0,
        consumed_at timestamptz,
        created_at timestamptz not null default now()
      );

      create index if not exists password_reset_requests_email_idx
      on accesschat.password_reset_requests(email, created_at desc);
    `);
    this.logger.log('Database schema is ready.');
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
