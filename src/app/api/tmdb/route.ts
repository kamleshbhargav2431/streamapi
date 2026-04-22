import { NextRequest, NextResponse } from 'next/server';
import { searchTMDB, fetchTMDB } from '@/lib/api';

// TMDB proxy - supports: /api/tmdb?action=search&q=... | /api/tmdb?action=movie&id=... | /api/tmdb?action=tv&id=... | /api/tmdb?action=tv-details&id=...&season=...
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (!action) {
    return NextResponse.json({ error: 'Missing action parameter' }, { status: 400 });
  }

  try {
    switch (action) {
      case 'search': {
        const q = searchParams.get('q');
        const page = searchParams.get('page') || '1';
        if (!q) return NextResponse.json({ error: 'Missing query' }, { status: 400 });
        const data = await searchTMDB(q, parseInt(page));
        return NextResponse.json(data);
      }

      case 'movie': {
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Missing movie id' }, { status: 400 });
        const data = await fetchTMDB(`/movie/${id}`, {
          append_to_response: 'credits,videos,similar,recommendations',
        });
        return NextResponse.json(data);
      }

      case 'tv': {
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Missing tv id' }, { status: 400 });
        const data = await fetchTMDB(`/tv/${id}`, {
          append_to_response: 'credits,videos,similar,recommendations',
        });
        return NextResponse.json(data);
      }

      case 'tv-season': {
        const id = searchParams.get('id');
        const season = searchParams.get('season');
        if (!id || !season) return NextResponse.json({ error: 'Missing id or season' }, { status: 400 });
        const data = await fetchTMDB(`/tv/${id}/season/${season}`);
        return NextResponse.json(data);
      }

      case 'trending': {
        const type = searchParams.get('type') || 'all';
        const time = searchParams.get('time') || 'week';
        const page = searchParams.get('page') || '1';
        const data = await fetchTMDB(`/trending/${type}/${time}`, { page });
        return NextResponse.json(data);
      }

      case 'popular-movies': {
        const page = searchParams.get('page') || '1';
        const data = await fetchTMDB('/movie/popular', { page });
        return NextResponse.json(data);
      }

      case 'popular-tv': {
        const page = searchParams.get('page') || '1';
        const data = await fetchTMDB('/tv/popular', { page });
        return NextResponse.json(data);
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
