export class ProductCreatedEvent {
  static readonly EVENT = 'product.created';

  constructor(
    public readonly productId: string,
    public readonly name: string,
    public readonly actorId?: string,
  ) {}
}

export class ProductUpdatedEvent {
  static readonly EVENT = 'product.updated';

  constructor(
    public readonly productId: string,
    public readonly name: string,
    public readonly actorId?: string,
  ) {}
}

export class ProductDeletedEvent {
  static readonly EVENT = 'product.deleted';

  constructor(
    public readonly productId: string,
    public readonly name: string,
    public readonly actorId?: string,
  ) {}
}
