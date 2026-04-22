import { NextRequest, NextResponse } from 'next/server';

// Allow iframing from any site + add CORS headers for the stream API
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle all requests
  const response = NextResponse.next();

  // Allow embedding from any site (for /embed/* and the API)
  response.headers.set('X-Frame-Options', 'ALLOWALL');
  response.headers.delete('Content-Security-Policy');

  // CORS headers for API routes (so other sites can fetch JSON directly)
  if (pathname.startsWith('/api/')) {
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', '*');

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/embed/:path*',
    '/api/stream/:path*',
    '/api/sources/:path*',
  ],
};
