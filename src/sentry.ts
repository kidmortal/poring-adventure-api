import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

export function setupSentry() {
  Sentry.init({
    dsn: 'https://d313533768ee7fcdae023276ee6b7bd9@o1086666.ingest.us.sentry.io/4506963275481088',
    integrations: [nodeProfilingIntegration()],
    // Performance Monitoring
    tracesSampleRate: 1.0, //  Capture 100% of the transactions
    // Set sampling rate for profiling - this is relative to tracesSampleRate
    profilesSampleRate: 1.0,
  });
}
