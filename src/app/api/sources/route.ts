import { NextRequest, NextResponse } from 'next/server';
import { fetchAndDecrypt } from '@/lib/api';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const title = searchParams.get('title');
  const mediaType = searchParams.get('mediaType') as 'movie' | 'tv';
  const year = searchParams.get('year');
  const tmdbId = searchParams.get('tmdbId');
  const imdbId = searchParams.get('imdbId');
  const season = searchParams.get('season');
  const episode = searchParams.get('episode');

  if (!title || !mediaType || !year || !tmdbId) {
    return NextResponse.json(
      { error: 'Missing required params: title, mediaType, year, tmdbId' },
      { status: 400 }
    );
  }

  try {
    const data = await fetchAndDecrypt({
      title,
      mediaType,
      year,
      tmdbId,
      imdbId: imdbId || undefined,
      season: season || undefined,
      episode: episode || undefined,
    });

    if (data.servers.length === 0) {
      return NextResponse.json({ error: 'No sources found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch sources';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
