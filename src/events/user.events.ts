export class UserBannedEvent {
  static readonly EVENT = 'user.banned';

  constructor(
    public readonly targetUserId: string,
    public readonly targetEmail: string,
    public readonly actorId?: string,
  ) {}
}

export class UserUnbannedEvent {
  static readonly EVENT = 'user.unbanned';

  constructor(
    public readonly targetUserId: string,
    public readonly targetEmail: string,
    public readonly actorId?: string,
  ) {}
}

export class UserRoleChangedEvent {
  static readonly EVENT = 'user.role.changed';

  constructor(
    public readonly targetUserId: string,
    public readonly targetEmail: string,
    public readonly oldRole: string,
    public readonly newRole: string,
    public readonly actorId?: string,
  ) {}
}
