import { NextResponse } from 'next/server';
import { withAuth } from 'next-auth/middleware';

// Every page and API route needs a signed-in session. Sign-in itself only lets the allowed email through
// (the signIn callback in app/api/auth/[...nextauth]/route.js), so any valid session token is the owner.
// Pages without a session go to /login; API routes answer 401 so fetch callers see an error, not a page.
export default withAuth(
  function proxy(req) {
    if (!req.nextauth?.token) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      // Let API requests reach the function above, which answers 401 instead of redirecting.
      authorized: ({ req, token }) => Boolean(token) || req.nextUrl.pathname.startsWith('/api/'),
    },
    pages: { signIn: '/login', error: '/login' },
  },
);

export const config = {
  // Everything except sign-in (NextAuth's own routes and /login) and static files.
  matcher: [
    '/((?!api/auth(?:/|$)|login$|_next/static/|_next/image/|favicon\\.ico$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)',
  ],
};
