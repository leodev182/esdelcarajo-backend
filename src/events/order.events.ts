import { OrderStatus } from '@prisma/client';

export class OrderCreatedEvent {
  static readonly EVENT = 'order.created';

  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly total: number,
  ) {}
}

export class OrderStatusUpdatedEvent {
  static readonly EVENT = 'order.status.updated';

  constructor(
    public readonly orderId: string,
    public readonly oldStatus: OrderStatus,
    public readonly newStatus: OrderStatus,
    public readonly actorId?: string,
  ) {}
}
