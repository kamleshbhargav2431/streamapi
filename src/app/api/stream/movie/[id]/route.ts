import { NextRequest, NextResponse } from 'next/server';
import { fetchTMDB, fetchAndDecrypt } from '@/lib/api';

// GET /api/stream/movie/[id]?server=cdn&quality=1080p
// Returns a single streaming URL + subtitles for embedding
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const preferServer = searchParams.get('server'); // optional: specific server id
  const preferQuality = searchParams.get('quality'); // optional: e.g. "1080p"

  try {
    // 1. Fetch movie metadata from TMDB
    const movie = await fetchTMDB(`/movie/${id}`);
    const title = movie.title;
    const year = (movie.release_date || '').split('-')[0];
    const imdbId = movie.imdb_id || undefined;

    // 2. Fetch & decrypt from all servers
    const data = await fetchAndDecrypt({
      title,
      mediaType: 'movie',
      year,
      tmdbId: id,
      imdbId,
    });

    if (data.servers.length === 0) {
      return NextResponse.json(
        { error: 'No sources found', tmdbId: id, title },
        { status: 404 }
      );
    }

    // 3. Pick server (specific or first available with sources)
    let target = data.servers.find((s) => s.serverId === preferServer && s.sources.length > 0)
      || data.servers.find((s) => s.sources.length > 0);

    if (!target) {
      return NextResponse.json(
        { error: 'No working server found', tmdbId: id, title },
        { status: 404 }
      );
    }

    // 4. Sort sources by quality
    const qualityOrder: Record<string, number> = { '4K': 0, '1080p': 1, '1080': 2, '720p': 3, '720': 4, '480p': 5, '480': 6, '360p': 7, '360': 8 };
    target.sources.sort((a, b) => (qualityOrder[a.quality] ?? 99) - (qualityOrder[b.quality] ?? 99));

    // 5. Pick source (specific quality or best)
    const source = preferQuality
      ? target.sources.find((s) => s.quality.toLowerCase().includes(preferQuality.toLowerCase()))
      || target.sources[0]
      : target.sources[0];

    // Dedupe subtitles
    const seen = new Set<string>();
    const subs = target.subtitles.filter((s) => {
      if (seen.has(s.lang)) return false;
      seen.add(s.lang);
      return true;
    });

    return NextResponse.json({
      tmdbId: id,
      imdbId: imdbId || null,
      title,
      year,
      type: 'movie',
      server: {
        id: target.serverId,
        name: target.serverName,
      },
      source: {
        quality: source.quality,
        url: source.url,
      },
      sources: target.sources.map((s) => ({ quality: s.quality, url: s.url })),
      subtitles: subs,
      embedUrl: `/embed/movie/${id}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch stream';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
