'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Play, Star, Calendar, Clock, Info, Server, ChevronDown, Film, Monitor, Loader2 } from 'lucide-react';
import VideoPlayer from '@/components/player/VideoPlayer';

const TMDB_IMG = 'https://image.tmdb.org/t/p';

interface Source { quality: string; url: string; }
interface Subtitle { lang: string; language: string; url: string; }
interface ServerData { serverId: string; serverName: string; sources: Source[]; subtitles: Subtitle[]; }

interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  runtime: number;
  vote_average: number;
  genres: { id: number; name: string }[];
  imdb_id?: string;
  tagline?: string;
  credits?: { cast: { id: number; name: string; character: string; profile_path: string | null }[] };
  similar?: { results: { id: number; title: string; poster_path: string | null; release_date: string; vote_average: number; media_type?: string }[] };
}

export default function MoviePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [movie, setMovie] = useState<TMDBMovie | null>(null);
  const [servers, setServers] = useState<ServerData[]>([]);
  const [selectedServer, setSelectedServer] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [error, setError] = useState('');
  const [showServerDropdown, setShowServerDropdown] = useState(false);

  const currentSources = servers[selectedServer]?.sources || [];
  const currentSubtitles = servers[selectedServer]?.subtitles || [];

  // Fetch TMDB movie details
  useEffect(() => {
    if (!id) return;
    const fetchMovie = async () => {
      try {
        const res = await fetch(`/api/tmdb?action=movie&id=${id}`);
        if (!res.ok) throw new Error('Movie not found');
        const data = await res.json();
        setMovie(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load movie');
      }
    };
    fetchMovie();
  }, [id]);

  // Fetch & decrypt sources
  const fetchSources = useCallback(async () => {
    if (!movie) return;
    setSourcesLoading(true);
    try {
      const res = await fetch(
        `/api/sources?title=${encodeURIComponent(movie.title)}&mediaType=movie&year=${movie.release_date?.split('-')[0] || ''}&tmdbId=${id}${movie.imdb_id ? `&imdbId=${movie.imdb_id}` : ''}`
      );
      if (!res.ok) throw new Error('Failed to fetch sources');
      const data = await res.json();

      const serverResults: ServerData[] = (data.servers || []).map((s: ServerData) => ({
        serverId: s.serverId,
        serverName: s.serverName,
        sources: (s.sources || []).map((src: Source) => ({
          quality: src.quality,
          url: src.url,
        })),
        subtitles: (s.subtitles || []).map((sub: Subtitle) => ({
          lang: sub.lang,
          language: sub.language,
          url: sub.url,
        })),
      }));

      // Sort each server's sources by quality
      const qualityOrder: Record<string, number> = { '4K': 0, '1080p': 1, '1080': 2, '720p': 3, '720': 4, '480p': 5, '480': 6, '360p': 7, '360': 8 };
      for (const server of serverResults) {
        server.sources.sort((a: Source, b: Source) => (qualityOrder[a.quality] ?? 99) - (qualityOrder[b.quality] ?? 99));
      }

      setServers(serverResults);
      if (serverResults.length > 0) setSelectedServer(0);
    } catch {
      setError('Failed to load streaming sources. Please try again.');
    }
    setSourcesLoading(false);
  }, [movie, id]);

  useEffect(() => {
    if (movie) fetchSources();
  }, [movie, fetchSources]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = () => setShowServerDropdown(false);
    if (showServerDropdown) {
      setTimeout(() => document.addEventListener('click', handler), 0);
      return () => document.removeEventListener('click', handler);
    }
  }, [showServerDropdown]);

  if (loading && !movie) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/20 border-t-[#e50914] rounded-full animate-spin" />
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-lg mb-4">{error || 'Movie not found'}</p>
          <button onClick={() => router.back()} className="text-[#e50914] hover:underline">Go back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Backdrop */}
      {movie.backdrop_path && (
        <div className="fixed inset-0 -z-10">
          <img src={`${TMDB_IMG}/original${movie.backdrop_path}`} alt="" className="w-full h-full object-cover opacity-20 blur-2xl" />
          <div className="absolute inset-0 bg-[#0a0a0f]/70" />
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0a0f]/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm hidden sm:block">Back</span>
          </button>
          <div className="flex-1">
            <h1 className="text-sm sm:text-base font-medium truncate">{movie.title}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Player Section */}
          <div className="flex-1 min-w-0">
            {/* Server Selector */}
            {servers.length > 1 && (
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Server className="w-3.5 h-3.5" /> Server:
                </span>
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowServerDropdown(!showServerDropdown); }}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white text-sm px-3 py-1.5 rounded-lg transition-colors border border-white/10"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>{servers[selectedServer]?.serverName || 'Select Server'}</span>
                    <span className="bg-white/10 text-xs px-1.5 py-0.5 rounded">
                      {servers[selectedServer]?.sources?.length || 0} Q
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                  {showServerDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-[#1a1a2e]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[220px] z-50">
                      {servers.map((server, i) => (
                        <button
                          key={server.serverId}
                          onClick={(e) => { e.stopPropagation(); setSelectedServer(i); setShowServerDropdown(false); }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors ${
                            selectedServer === i
                              ? 'text-[#e50914] bg-[#e50914]/10'
                              : 'text-gray-300 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            {selectedServer === i && (
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
                            )}
                            <Server className="w-3.5 h-3.5" />
                            {server.serverName}
                          </span>
                          <span className="text-xs text-gray-500">{server.sources.length} sources</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {servers.length > 1 && (
                  <button
                    onClick={() => setSelectedServer((prev) => (prev + 1) % servers.length)}
                    className="text-xs text-gray-500 hover:text-[#e50914] transition-colors"
                    title="Next server"
                  >
                    Next →
                  </button>
                )}
              </div>
            )}

            {/* Server tabs (alternative view for mobile) */}
            {servers.length > 1 && (
              <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none sm:hidden">
                {servers.map((server, i) => (
                  <button
                    key={server.serverId}
                    onClick={() => setSelectedServer(i)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                      selectedServer === i
                        ? 'bg-[#e50914] text-white shadow-lg shadow-[#e50914]/20'
                        : 'bg-white/10 text-gray-300 hover:bg-white/15'
                    }`}
                  >
                    <Server className="w-3 h-3" />
                    {server.serverName}
                    <span className="opacity-60">({server.sources.length})</span>
                  </button>
                ))}
              </div>
            )}

            {/* Video Player */}
            {sourcesLoading ? (
              <div className="aspect-video bg-white/5 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="w-10 h-10 text-[#e50914] animate-spin mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">Finding sources...</p>
                  <p className="text-gray-600 text-xs mt-1">Trying multiple servers</p>
                </div>
              </div>
            ) : currentSources.length > 0 ? (
              <VideoPlayer
                sources={currentSources}
                subtitles={currentSubtitles}
                poster={movie.backdrop_path ? `${TMDB_IMG}/w1280${movie.backdrop_path}` : undefined}
                title={movie.title}
              />
            ) : (
              <div className="aspect-video bg-white/5 rounded-lg flex items-center justify-center">
                <div className="text-center p-8">
                  <Info className="w-10 h-10 text-gray-500 mx-auto mb-3" />
                  <p className="text-gray-300 mb-2">
                    {servers.length > 0 && currentSources.length === 0
                      ? 'No sources from this server'
                      : 'No sources available'}
                  </p>
                  <p className="text-gray-500 text-sm mb-4">{error}</p>
                  <div className="flex gap-2 justify-center">
                    {servers.length > 1 && (
                      <button
                        onClick={() => {
                          // Find next server with sources
                          const nextIdx = servers.findIndex((s, i) => i > selectedServer && s.sources.length > 0);
                          if (nextIdx >= 0) setSelectedServer(nextIdx);
                          else {
                            const first = servers.findIndex((s) => s.sources.length > 0);
                            if (first >= 0) setSelectedServer(first);
                          }
                        }}
                        className="bg-white/10 hover:bg-white/15 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        Try Another Server
                      </button>
                    )}
                    <button
                      onClick={fetchSources}
                      className="bg-[#e50914] hover:bg-[#f6121d] text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      Reload All
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Quality & Subtitle Info */}
            {currentSources.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-400">
                <span className="flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5" />
                  {currentSources.map((s) => s.quality).join(', ')}
                </span>
                {currentSubtitles.length > 0 && (
                  <>
                    <span className="text-gray-600">|</span>
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM6 10h2v2H6zm0 4h8v2H6zm10 0h2v2h-2zm-6-4h8v2h-8z" />
                      </svg>
                      {currentSubtitles.length} subtitle(s)
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Info Sidebar */}
          <div className="lg:w-80 shrink-0">
            {/* Poster + Info */}
            <div className="flex flex-col sm:flex-row lg:flex-col gap-4 mb-6">
              {movie.poster_path && (
                <img
                  src={`${TMDB_IMG}/w342${movie.poster_path}`}
                  alt={movie.title}
                  className="w-40 sm:w-32 lg:w-full rounded-lg shadow-lg mx-auto lg:mx-0"
                />
              )}
              <div className="flex-1">
                <h1 className="text-xl sm:text-2xl font-bold mb-1">{movie.title}</h1>
                {movie.tagline && (
                  <p className="text-gray-400 italic text-sm mb-3">&ldquo;{movie.tagline}&rdquo;</p>
                )}
                <div className="flex flex-wrap gap-2 mb-3">
                  {movie.genres?.map((g) => (
                    <span key={g.id} className="bg-white/10 px-2.5 py-1 rounded text-xs">{g.name}</span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-gray-400">
                  {movie.vote_average > 0 && (
                    <span className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                      {movie.vote_average.toFixed(1)}
                    </span>
                  )}
                  {movie.release_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(movie.release_date).getFullYear()}
                    </span>
                  )}
                  {movie.runtime > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Overview */}
            <div className="bg-white/5 rounded-lg p-4 mb-6">
              <h3 className="font-semibold mb-2">Overview</h3>
              <p className="text-gray-300 text-sm leading-relaxed">{movie.overview || 'No overview available.'}</p>
            </div>

            {/* Server Sources Summary */}
            {servers.length > 1 && (
              <div className="bg-white/5 rounded-lg p-4 mb-6">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Server className="w-4 h-4 text-[#e50914]" />
                  Available Servers
                </h3>
                <div className="space-y-1.5">
                  {servers.map((server, i) => (
                    <div
                      key={server.serverId}
                      onClick={() => setSelectedServer(i)}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                        selectedServer === i
                          ? 'bg-[#e50914]/15 border border-[#e50914]/30 text-[#e50914]'
                          : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Server className="w-3.5 h-3.5" />
                        <span className="text-sm">{server.serverName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs">
                          {server.sources.map((s) => s.quality).join(', ')}
                        </span>
                        <span className="text-xs opacity-60">({server.subtitles.length} subs)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TMDB Link */}
            <a
              href={`https://www.themoviedb.org/movie/${id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-sm text-[#e50914] hover:underline mb-6"
            >
              View on TMDB →
            </a>

            {/* Cast */}
            {movie.credits?.cast && movie.credits.cast.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Cast</h3>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {movie.credits.cast.slice(0, 20).map((person) => (
                    <div key={person.id} className="flex items-center gap-3 bg-white/5 rounded-lg p-2">
                      {person.profile_path ? (
                        <img src={`${TMDB_IMG}/w92${person.profile_path}`} alt={person.name} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-xs">{person.name.charAt(0)}</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{person.name}</p>
                        <p className="text-xs text-gray-500 truncate">{person.character}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Similar */}
            {movie.similar?.results && movie.similar.results.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Similar Movies</h3>
                <div className="grid grid-cols-3 gap-2">
                  {movie.similar.results.slice(0, 6).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => router.push(`/movie/${item.id}`)}
                      className="cursor-pointer group"
                    >
                      <div className="aspect-[2/3] bg-white/5 rounded overflow-hidden mb-1">
                        {item.poster_path ? (
                          <img src={`${TMDB_IMG}/w185${item.poster_path}`} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Film className="w-6 h-6 text-gray-600" /></div>
                        )}
                      </div>
                      <p className="text-xs truncate">{item.title}</p>
                      {item.vote_average > 0 && (
                        <p className="text-xs text-gray-500 flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5 fill-yellow-500 text-yellow-500" />
                          {item.vote_average.toFixed(1)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
