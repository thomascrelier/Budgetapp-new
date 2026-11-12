import { test, expect, beforeAll, describe } from 'vitest';
import { NextRequest } from 'next/server';
import { encode } from 'next-auth/jwt';

const SECRET = 'test-secret';
let proxy;

beforeAll(async () => {
  process.env.NEXTAUTH_SECRET = SECRET;
  proxy = (await import('@/proxy')).default;
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
