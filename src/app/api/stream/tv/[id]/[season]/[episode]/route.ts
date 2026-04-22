import { NextRequest, NextResponse } from 'next/server';
import { fetchTMDB, fetchAndDecrypt } from '@/lib/api';

// GET /api/stream/tv/[id]/[season]/[episode]?server=cdn&quality=1080p
// Returns a single streaming URL + subtitles for embedding
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; season: string; episode: string }> }
) {
  const { id, season, episode } = await params;
  const { searchParams } = new URL(request.url);
  const preferServer = searchParams.get('server');
  const preferQuality = searchParams.get('quality');

  try {
    // 1. Fetch TV show metadata from TMDB
    const show = await fetchTMDB(`/tv/${id}`);
    const title = show.name;
    const year = (show.first_air_date || '').split('-')[0];
    const imdbId = show.imdb_id || undefined;

    // 2. Fetch episode name
    const seasonData = await fetchTMDB(`/tv/${id}/season/${season}`);
    const ep = (seasonData.episodes || []).find(
      (e: { episode_number: number }) => e.episode_number === parseInt(episode)
    );
    const episodeName = ep?.name || `Episode ${episode}`;

    // 3. Fetch & decrypt from all servers
    const data = await fetchAndDecrypt({
      title,
      mediaType: 'tv',
      year,
      tmdbId: id,
      imdbId,
      season,
      episode,
    });

    if (data.servers.length === 0) {
      return NextResponse.json(
        { error: 'No sources found', tmdbId: id, title, season, episode },
        { status: 404 }
      );
    }

    // 4. Pick server
    let target = data.servers.find((s) => s.serverId === preferServer && s.sources.length > 0)
      || data.servers.find((s) => s.sources.length > 0);

    if (!target) {
      return NextResponse.json(
        { error: 'No working server found', tmdbId: id, title },
        { status: 404 }
      );
    }

    // 5. Sort sources by quality
    const qualityOrder: Record<string, number> = { '4K': 0, '1080p': 1, '1080': 2, '720p': 3, '720': 4, '480p': 5, '480': 6, '360p': 7, '360': 8 };
    target.sources.sort((a, b) => (qualityOrder[a.quality] ?? 99) - (qualityOrder[b.quality] ?? 99));

    // 6. Pick source
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
      type: 'tv',
      season: parseInt(season),
      episode: parseInt(episode),
      episodeName,
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
      embedUrl: `/embed/tv/${id}/${season}/${episode}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch stream';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
