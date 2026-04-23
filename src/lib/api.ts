import { proxyFetch } from './proxy';

// TMDB & Videasy API configuration
export const TMDB_API_KEY = process.env.TMDB_API_KEY || '';
export const TMDB_BASE = 'https://api.themoviedb.org/3';
export const TMDB_IMG = 'https://image.tmdb.org/t/p';

// Videasy servers for fetching encrypted sources
export const VIDEASY_SERVERS = [
  { id: 'cdn', name: 'CDN Server ', url: 'https://api.videasy.net/cdn', movieOnly: false },
//  { id: 'myflixerzupcloud', name: 'MyFlixer', url: 'https://api.videasy.net/myflixerzupcloud', movieOnly: false },
  { id: '1movies', name: '1Movies', url: 'https://api.videasy.net/1movies', movieOnly: false },
  { id: 'moviebox', name: 'MovieBox', url: 'https://api.videasy.net/moviebox', movieOnly: false },
  { id: 'hdmovie', name: 'HDMovie', url: 'https://api.videasy.net/hdmovie', movieOnly: false },
  { id: 'primesrcme', name: 'PrimeSrc', url: 'https://api.videasy.net/primesrcme', movieOnly: false },
  { id: 'm4uhd', name: 'Breach', url: 'https://api.videasy.net/m4uhd', movieOnly: false },
];

// Decrypt API endpoint
const DECRYPT_API = 'https://enc-dec.app/api/dec-videasy';

const HEADERS = {
  'Accept': '*/*',
  'Origin': 'https://cineby.gd',
  'Referer': 'https://cineby.gd/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
};

function doubleEncode(str: string): string {
  return encodeURIComponent(encodeURIComponent(str));
}

export interface SourceResult {
  quality: string;
  url: string;
}

export interface SubtitleResult {
  lang: string;
  language: string;
  url: string;
}

export interface ServerResult {
  serverId: string;
  serverName: string;
  sources: SourceResult[];
  subtitles: SubtitleResult[];
}

export interface DecryptedAll {
  servers: ServerResult[];
}

/**
 * Fetch encrypted sources from a single videasy server and decrypt
 */
async function fetchSingleServer(server: typeof VIDEASY_SERVERS[0], params: {
  encTitle: string;
  mediaType: 'movie' | 'tv';
  year: string;
  tmdbId: string;
  imdbId?: string;
  season?: string;
  episode?: string;
}): Promise<ServerResult | null> {
  try {
    let url = `${server.url}/sources-with-title?title=${params.encTitle}&mediaType=${params.mediaType}&year=${params.year}&tmdbId=${params.tmdbId}`;
    if (params.imdbId) url += `&imdbId=${params.imdbId}`;
    if (params.mediaType === 'tv' && params.season && params.episode) {
      url += `&episodeId=${params.episode}&seasonId=${params.season}`;
    }

    const response = await proxyFetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
    if (!response.ok) return null;
    const encryptedText = await response.text();

    // Decrypt
    const decResponse = await proxyFetch(DECRYPT_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: encryptedText, id: params.tmdbId }),
      signal: AbortSignal.timeout(10000),
    });

    if (!decResponse.ok) return null;
    const decData = await decResponse.json();

    if (decData?.result) {
      const result = decData.result;
      const rawSources = result.sources || result.source || [];
      const rawSubtitles = result.subtitles || [];

      const sources: SourceResult[] = Array.isArray(rawSources)
        ? rawSources.map((s: { quality?: string; url?: string; file?: string; label?: string }) => ({
            quality: s.quality || s.label || 'Auto',
            url: s.url || s.file || '',
          }))
        : [];

      const subtitles: SubtitleResult[] = Array.isArray(rawSubtitles)
        ? rawSubtitles.map((s: { lang?: string; language?: string; url?: string }) => ({
            lang: s.lang || s.language || 'Unknown',
            language: s.language || s.lang || 'Unknown',
            url: s.url || '',
          }))
        : [];

      if (sources.length > 0 || subtitles.length > 0) {
        return { serverId: server.id, serverName: server.name, sources, subtitles };
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Fetch from all servers in parallel and return per-server results
 */
export async function fetchAndDecrypt(params: {
  title: string;
  mediaType: 'movie' | 'tv';
  year: string;
  tmdbId: string;
  imdbId?: string;
  season?: string;
  episode?: string;
}): Promise<DecryptedAll> {
  const { title, mediaType, year, tmdbId, imdbId, season, episode } = params;
  const encTitle = doubleEncode(title);

  // Filter servers - CDN only works for movies
  const servers = VIDEASY_SERVERS.filter(
    (s) => !s.movieOnly || mediaType === 'movie'
  );

  // Fetch all servers in parallel
  const promises = servers.map((server) =>
    fetchSingleServer(server, { encTitle, mediaType, year, tmdbId, imdbId, season, episode })
  );

  const settled = await Promise.allSettled(promises);
  const serverResults: ServerResult[] = [];

  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value) {
      serverResults.push(r.value);
    }
  }

  return { servers: serverResults };
}

/**
 * Fetch movie/TV show details from TMDB
 */
export async function fetchTMDB(endpoint: string, params: Record<string, string> = {}) {
  const searchParams = new URLSearchParams({
    api_key: TMDB_API_KEY,
    ...params,
  });
  const url = `${TMDB_BASE}${endpoint}?${searchParams}`;
  const res = await proxyFetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`TMDB API error: ${res.status}`);
  return res.json();
}

/**
 * Search TMDB for movies and TV shows
 */
export async function searchTMDB(query: string, page = 1) {
  const searchParams = new URLSearchParams({
    api_key: TMDB_API_KEY,
    query,
    page: String(page),
  });
  const url = `${TMDB_BASE}/search/multi?${searchParams}`;
  const res = await proxyFetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`TMDB search error: ${res.status}`);
  return res.json();
}
