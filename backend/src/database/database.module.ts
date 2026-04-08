import { Global, Module } from '@nestjs/common';

import { AppConfigService } from '../config/app-config.service';
import { DatabaseService } from './database.service';

@Global()
@Module({
  providers: [AppConfigService, DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}

