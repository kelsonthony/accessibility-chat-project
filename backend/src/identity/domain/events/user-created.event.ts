import { DomainEvent } from '../../../@shared/domain/domain-event.base';

export class UserCreatedEvent extends DomainEvent {
  constructor(
    readonly userId: string,
    readonly email: string,
  ) {
    super();
  }
}
