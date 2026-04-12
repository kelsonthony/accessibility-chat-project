import { DomainEvent } from '../../../@shared/domain/domain-event.base';

export class UserAuthenticatedEvent extends DomainEvent {
  constructor(readonly userId: string) {
    super();
  }
}
