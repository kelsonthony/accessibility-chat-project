import { Module } from '@nestjs/common';

import { EmailService } from './providers/email.provider';

/**
 * Standalone module — exports EmailService with no imports from other bounded contexts.
 * Both IdentityModule and MessagingModule can import this safely.
 */
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
