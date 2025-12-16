import * as Sentry from '@sentry/nestjs';

Sentry.init({
  dsn: 'https://a379a1085e682b143fc464f6a321e8b50e4510251609292880.ingest.us.sentry.io/4518547151683584',
  enabled: process.env.NODE_ENV === 'production',
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 1.0,
});
