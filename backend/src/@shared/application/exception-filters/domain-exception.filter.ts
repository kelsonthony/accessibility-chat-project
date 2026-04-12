import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';

import { DomainException } from '../../domain/domain-exception.base';

const HTTP_STATUS_MAP: Record<string, number> = {
  INVALID_EMAIL: HttpStatus.BAD_REQUEST,
  USER_NOT_FOUND: HttpStatus.NOT_FOUND,
  INVALID_CREDENTIALS: HttpStatus.UNAUTHORIZED,
  DUPLICATE_EMAIL: HttpStatus.CONFLICT,
  INVALID_VERIFICATION_CODE: HttpStatus.BAD_REQUEST,
  VERIFICATION_CODE_EXPIRED: HttpStatus.BAD_REQUEST,
  MAX_ATTEMPTS_EXCEEDED: HttpStatus.TOO_MANY_REQUESTS,
  CAPTCHA_INVALID: HttpStatus.BAD_REQUEST,
  CAPTCHA_EXPIRED: HttpStatus.BAD_REQUEST,
  PASSWORDS_DO_NOT_MATCH: HttpStatus.BAD_REQUEST,
  EMAILS_DO_NOT_MATCH: HttpStatus.BAD_REQUEST,
  GOOGLE_OAUTH_NOT_CONFIGURED: HttpStatus.SERVICE_UNAVAILABLE,
  GOOGLE_OAUTH_FAILED: HttpStatus.UNAUTHORIZED,
  EMAIL_NOT_VERIFIED: HttpStatus.UNPROCESSABLE_ENTITY,
  WHATSAPP_NOT_CONFIGURED: HttpStatus.SERVICE_UNAVAILABLE,
  PHONE_NUMBER_INVALID: HttpStatus.BAD_REQUEST,
};

@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: DomainException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<{ status: (code: number) => { json: (body: unknown) => void } }>();
    const status = HTTP_STATUS_MAP[exception.code] ?? HttpStatus.UNPROCESSABLE_ENTITY;

    this.logger.warn(`[${exception.code}] ${exception.message}`);

    response.status(status).json({
      statusCode: status,
      error: exception.code,
      message: exception.message,
    });
  }
}
