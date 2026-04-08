import { IsArray, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

import type { Jurisdiction, SupportedLanguage } from '@accessibility-platform/contracts';

const supportedLanguages = ['pt', 'en', 'es'] as const;
const jurisdictions = ['GLOBAL', 'BR', 'US', 'EU'] as const;

export class AskQuestionDto {
  @IsString()
  @MinLength(10)
  question!: string;

  @IsOptional()
  @IsEnum(supportedLanguages)
  language?: SupportedLanguage;

  @IsOptional()
  @IsArray()
  @IsEnum(jurisdictions, { each: true })
  jurisdictions?: Jurisdiction[];
}

