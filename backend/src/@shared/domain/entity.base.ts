export abstract class Entity<TId> {
  constructor(readonly id: TId) {}

  equals(other: Entity<TId>): boolean {
    return this.id === other.id;
  }
}
