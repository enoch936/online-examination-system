import { ExecutionContext } from '@nestjs/common';
import { AppThrottlerGuard } from './app-throttler.guard';

type Handler = AppThrottlerGuard['handleRequest'];

/**
 * The guard is registered globally, so it runs for WebSocket handlers too.
 * There `res` is a Socket with no .header(), and the unguarded call threw
 * "res.header is not a function", which killed every realtime message handler
 * (monitor:join, exam:heartbeat, notifications:subscribe, ...) with a 500.
 */
function makeContext(type: 'http' | 'ws'): { context: ExecutionContext; res: Record<string, unknown> } {
  const headers: Record<string, unknown> = {};
  const res: Record<string, unknown> = {
    header: (name: string, value: unknown) => {
      headers[name] = value;
      return res;
    },
  };
  const context = {
    getType: () => type,
    switchToHttp: () => ({ getRequest: () => ({ headers: {}, ip: '127.0.0.1' }), getResponse: () => res }),
  } as unknown as ExecutionContext;
  return { context, res: headers };
}

function makeGuard(): AppThrottlerGuard {
  const storage = {
    increment: async () => ({ totalHits: 1, timeToExpire: 60000, isBlocked: false, timeToBlockExpire: 0 }),
  };
  const reflector = { getAllAndOverride: () => true };
  const guard = new AppThrottlerGuard(
    { throttlers: [{ ttl: 60000, limit: 100 }] } as never,
    storage as never,
    reflector as never,
  );
  // commonOptions is populated by onModuleInit(), which Nest calls at runtime;
  // set it directly so the guard can be exercised without a DI container.
  (guard as unknown as { commonOptions: Record<string, unknown> }).commonOptions = {
    ignoreUserAgents: [],
    setHeaders: true,
  };
  // Allow a test to swap the storage to simulate a blocked request.
  (guard as unknown as { storageService: unknown }).storageService = storage;
  return guard;
}

function props(context: ExecutionContext) {
  return {
    context,
    limit: 100,
    ttl: 60000,
    throttler: { name: 'default' },
    blockDuration: 0,
    getTracker: async () => 'tracker',
    generateKey: () => 'key',
  } as never;
}

describe('AppThrottlerGuard', () => {
  let guard: AppThrottlerGuard;
  let handleRequest: Handler;

  beforeEach(() => {
    guard = makeGuard();
    handleRequest = guard['handleRequest'].bind(guard) as Handler;
  });

  it('sets quota headers on an HTTP response', async () => {
    const { context, res } = makeContext('http');
    await expect(handleRequest(props(context))).resolves.toBe(true);
    expect(res['X-RateLimit-Limit']).toBe(100);
    expect(res['X-RateLimit-Remaining']).toBe(99);
  });

  it('does not touch res.header for a websocket context, which has none', async () => {
    const { context } = makeContext('ws');
    // A Socket exposes no .header(); calling it is what broke every realtime
    // handler. The guard must complete without touching it.
    await expect(handleRequest(props(context))).resolves.toBe(true);
  });

  it('still enforces the limit for a websocket context', async () => {
    (guard as unknown as { storageService: unknown }).storageService = {
      increment: async () => ({ totalHits: 999, timeToExpire: 60000, isBlocked: true, timeToBlockExpire: 30000 }),
    };
    const { context } = makeContext('ws');
    await expect(handleRequest(props(context))).rejects.toThrow();
  });
});
