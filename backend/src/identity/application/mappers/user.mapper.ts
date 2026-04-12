import type { AuthUser } from '@accessibility-platform/contracts';

import type { User } from '../../domain/aggregates/user.aggregate';

export class UserMapper {
  static toAuthUser(user: User): AuthUser {
    return {
      id: user.id.value,
      email: user.email.value,
      displayName: user.displayName,
    };
  }
}
