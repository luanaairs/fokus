import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  // If no AUTH_PASSWORD is configured, skip auth entirely (local dev)
  if (!process.env.AUTH_PASSWORD) {
    return NextResponse.next();
  }

  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === '/login';
  const isAuthApi = req.nextUrl.pathname.startsWith('/api/auth');
  const isSetupApi = req.nextUrl.pathname.startsWith('/api/setup');

  if (isAuthApi || isSetupApi) return NextResponse.next();

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
