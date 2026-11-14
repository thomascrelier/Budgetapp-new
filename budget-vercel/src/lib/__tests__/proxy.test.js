import { test, expect, beforeAll, describe } from 'vitest';
import { NextRequest } from 'next/server';
import { encode } from 'next-auth/jwt';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';

const SECRET = 'test-secret';
let proxy;
let config;

beforeAll(async () => {
  process.env.NEXTAUTH_SECRET = SECRET;
  ({ default: proxy, config } = await import('@/proxy'));
});

const request = (path, cookie) => new NextRequest(`http://localhost:3000${path}`, {
  headers: cookie ? { cookie } : {},
});

describe('proxy: every page and API route needs a session', () => {
  test('an API route without a session is a 401 JSON error, not a redirect', async () => {
    const res = await proxy(request('/api/transactions'));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Not signed in' });
  });

  test('a write without a session is refused the same way', async () => {
    const res = await proxy(new NextRequest('http://localhost:3000/api/rental/tenants', { method: 'POST', body: '{}' }));
    expect(res.status).toBe(401);
  });

  test('a page without a session redirects to the sign-in page', async () => {
    const res = await proxy(request('/'));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get('location'));
    expect(location.pathname).toBe('/login');
  });

  test('a valid session token passes through to the page and the API', async () => {
    const token = await encode({ token: { email: 'owner@example.com', sub: '1' }, secret: SECRET });
    const cookie = `next-auth.session-token=${token}`;
    for (const path of ['/', '/api/transactions']) {
      const res = await proxy(request(path, cookie));
      expect(res.headers.get('x-middleware-next')).toBe('1');
    }
  });

  test('a token signed with another secret is not a session', async () => {
    const token = await encode({ token: { email: 'owner@example.com' }, secret: 'someone-else' });
    const res = await proxy(request('/api/transactions', `next-auth.session-token=${token}`));
    expect(res.status).toBe(401);
  });

  test('sign-in pages stay reachable', async () => {
    for (const path of ['/login', '/api/auth/providers']) {
      const res = await proxy(request(path));
      expect(res === undefined || res.headers.get('x-middleware-next') === '1').toBe(true);
    }
  });
});

// The matcher decides which requests reach the proxy at all, compiled the way Next compiles it.
describe('proxy matcher', () => {
  const runs = (path) => unstable_doesMiddlewareMatch({ config, url: `http://localhost:3000${path}` });

  test('every API path goes through the proxy, including ones that look like files', () => {
    // /api/transactions/5.png reaches app/api/transactions/[id]/route.js like /api/transactions/5 does.
    for (const path of ['/api/transactions/5', '/api/transactions/5.png', '/api/transactions/5.txt', '/api/transactions/5.xml', '/api/init', '/api/settings']) {
      expect(runs(path), path).toBe(true);
    }
  });

  test('pages go through the proxy', () => {
    for (const path of ['/', '/5.png', '/robots.txt']) expect(runs(path), path).toBe(true);
  });

  test('sign-in routes and Next static files skip it', () => {
    for (const path of ['/api/auth/session', '/api/auth/providers', '/api/auth/callback/google', '/login', '/_next/static/x.js', '/_next/image/x', '/favicon.ico']) {
      expect(runs(path), path).toBe(false);
    }
  });
});
