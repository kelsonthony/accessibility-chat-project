import { DomainException } from '../../../@shared/domain/domain-exception.base';

export class WhatsappNotConfiguredException extends DomainException {
  readonly code = 'WHATSAPP_NOT_CONFIGURED';
  constructor() {
    super('WhatsApp não está configurado no servidor.');
  }
}

export class PhoneNumberInvalidException extends DomainException {
  readonly code = 'PHONE_NUMBER_INVALID';
  constructor() {
    super('Número de telefone inválido.');
  }
}
