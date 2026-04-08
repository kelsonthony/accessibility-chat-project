import { Controller, Post, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../common/guards/auth.guard';
import { IngestionService } from './ingestion.service';

@Controller()
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @UseGuards(AuthGuard)
  @Post('sources/sync')
  syncSources() {
    return this.ingestionService.syncSources();
  }

  @UseGuards(AuthGuard)
  @Post('ingest')
  ingest() {
    return this.ingestionService.ingestDocuments();
  }
}

