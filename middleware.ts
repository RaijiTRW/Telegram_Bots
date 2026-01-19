import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const userId = request.cookies.get('user_id')?.value;
  const { pathname } = request.nextUrl;

  // Публичные роуты (доступны без авторизации)
  const publicRoutes = ['/auth/login'];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // Если пользователь не авторизован и пытается попасть на защищенную страницу
  if (!userId && !isPublicRoute) {
    const url = new URL('/auth/login', request.url);
    return NextResponse.redirect(url);
  }

  // Если пользователь авторизован и пытается попасть на страницу логина
  if (userId && pathname.startsWith('/auth/login')) {
    const url = new URL('/dashboard', request.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
