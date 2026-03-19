import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LogEvent } from '@prisma/client';
import { LogsService } from '../logs.service';

// Auth events
import {
  UserLoginEvent,
  UserLogoutEvent,
  UserRegisteredEvent,
} from '../../events/auth.events';

// User events
import {
  UserBannedEvent,
  UserUnbannedEvent,
  UserRoleChangedEvent,
} from '../../events/user.events';

// Order events
import {
  OrderCreatedEvent,
  OrderStatusUpdatedEvent,
} from '../../events/order.events';

// Product events
import {
  ProductCreatedEvent,
  ProductUpdatedEvent,
  ProductDeletedEvent,
} from '../../events/product.events';

/**
 * Listener desacoplado que escucha domain events y los persiste como logs.
 * Los servicios de negocio solo emiten eventos — no saben nada de logs.
 */
@Injectable()
export class LogsListener {
  constructor(private readonly logsService: LogsService) {}

  // ─────────────────────────────────────────────
  // Auth
  // ─────────────────────────────────────────────

  @OnEvent(UserLoginEvent.EVENT)
  handleUserLogin(event: UserLoginEvent) {
    this.logsService.logEvent(
      LogEvent.USER_LOGIN,
      `Login exitoso: ${event.email}`,
      {
        userId: event.userId,
        userEmail: event.email,
        context: `role:${event.role}`,
      },
    );
  }

  @OnEvent(UserLogoutEvent.EVENT)
  handleUserLogout(event: UserLogoutEvent) {
    this.logsService.logEvent(
      LogEvent.USER_LOGOUT,
      `Logout: ${event.email}`,
      {
        userId: event.userId,
        userEmail: event.email,
      },
    );
  }

  @OnEvent(UserRegisteredEvent.EVENT)
  handleUserRegistered(event: UserRegisteredEvent) {
    this.logsService.logEvent(
      LogEvent.USER_REGISTERED,
      `Nuevo usuario registrado: ${event.email}`,
      {
        userId: event.userId,
        userEmail: event.email,
        context: `role:${event.role}`,
      },
    );
  }

  // ─────────────────────────────────────────────
  // Usuarios
  // ─────────────────────────────────────────────

  @OnEvent(UserBannedEvent.EVENT)
  handleUserBanned(event: UserBannedEvent) {
    this.logsService.logEvent(
      LogEvent.USER_BANNED,
      `Usuario baneado: ${event.targetEmail}`,
      {
        userId: event.actorId,
        context: `targetUserId:${event.targetUserId}`,
      },
    );
  }

  @OnEvent(UserUnbannedEvent.EVENT)
  handleUserUnbanned(event: UserUnbannedEvent) {
    this.logsService.logEvent(
      LogEvent.USER_UNBANNED,
      `Usuario desbaneado: ${event.targetEmail}`,
      {
        userId: event.actorId,
        context: `targetUserId:${event.targetUserId}`,
      },
    );
  }

  @OnEvent(UserRoleChangedEvent.EVENT)
  handleUserRoleChanged(event: UserRoleChangedEvent) {
    this.logsService.logEvent(
      LogEvent.USER_ROLE_CHANGED,
      `Rol cambiado: ${event.targetEmail} → ${event.newRole}`,
      {
        userId: event.actorId,
        context: `targetUserId:${event.targetUserId} | ${event.oldRole} → ${event.newRole}`,
      },
    );
  }

  // ─────────────────────────────────────────────
  // Órdenes
  // ─────────────────────────────────────────────

  @OnEvent(OrderCreatedEvent.EVENT)
  handleOrderCreated(event: OrderCreatedEvent) {
    this.logsService.logEvent(
      LogEvent.ORDER_CREATED,
      `Orden creada: ${event.orderId}`,
      {
        userId: event.userId,
        context: `orderId:${event.orderId} | total:${event.total}`,
      },
    );
  }

  @OnEvent(OrderStatusUpdatedEvent.EVENT)
  handleOrderStatusUpdated(event: OrderStatusUpdatedEvent) {
    const isCancelled = event.newStatus === 'CANCELADO';
    const isPaid = event.newStatus === 'PAGO_CONFIRMADO';

    const logEvent = isCancelled
      ? LogEvent.ORDER_CANCELLED
      : isPaid
        ? LogEvent.ORDER_PAYMENT_CONFIRMED
        : LogEvent.ORDER_STATUS_UPDATED;

    this.logsService.logEvent(
      logEvent,
      `Orden ${event.orderId}: ${event.oldStatus} → ${event.newStatus}`,
      {
        userId: event.actorId,
        context: `orderId:${event.orderId} | ${event.oldStatus} → ${event.newStatus}`,
      },
    );
  }

  // ─────────────────────────────────────────────
  // Productos
  // ─────────────────────────────────────────────

  @OnEvent(ProductCreatedEvent.EVENT)
  handleProductCreated(event: ProductCreatedEvent) {
    this.logsService.logEvent(
      LogEvent.PRODUCT_CREATED,
      `Producto creado: ${event.name}`,
      {
        userId: event.actorId,
        context: `productId:${event.productId}`,
      },
    );
  }

  @OnEvent(ProductUpdatedEvent.EVENT)
  handleProductUpdated(event: ProductUpdatedEvent) {
    this.logsService.logEvent(
      LogEvent.PRODUCT_UPDATED,
      `Producto actualizado: ${event.name}`,
      {
        userId: event.actorId,
        context: `productId:${event.productId}`,
      },
    );
  }

  @OnEvent(ProductDeletedEvent.EVENT)
  handleProductDeleted(event: ProductDeletedEvent) {
    this.logsService.logEvent(
      LogEvent.PRODUCT_DELETED,
      `Producto eliminado: ${event.name}`,
      {
        userId: event.actorId,
        context: `productId:${event.productId}`,
      },
    );
  }
}
