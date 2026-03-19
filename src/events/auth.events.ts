export class UserLoginEvent {
  static readonly EVENT = 'auth.user.login';

  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly role: string,
  ) {}
}

export class UserLogoutEvent {
  static readonly EVENT = 'auth.user.logout';

  constructor(
    public readonly userId: string,
    public readonly email: string,
  ) {}
}

export class UserRegisteredEvent {
  static readonly EVENT = 'auth.user.registered';

  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly role: string,
  ) {}
}
