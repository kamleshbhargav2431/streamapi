'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Play, Star, Calendar, Info, ChevronLeft, ChevronRight, Tv, Server, Monitor, ChevronDown, Loader2 } from 'lucide-react';
import VideoPlayer from '@/components/player/VideoPlayer';

const TMDB_IMG = 'https://image.tmdb.org/t/p';

interface Source { quality: string; url: string; }
interface Subtitle { lang: string; language: string; url: string; }
interface ServerData { serverId: string; serverName: string; sources: Source[]; subtitles: Subtitle[]; }

interface TVEpisode {
  id: number;
  name: string;
  overview: string;
  episode_number: number;
  season_number: number;
  still_path: string | null;
  air_date: string | null;
  runtime: number | null;
  vote_average: number;
}

interface TVShow {
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  genres: { id: number; name: string }[];
}

export default function TVEpisodePage() {
  const params = useParams();
  const router = useRouter();
  const showId = params.id as string;
  const seasonNum = params.season as string;
  const episodeNum = params.episode as string;

  const [showInfo, setShowInfo] = useState<TVShow | null>(null);
  const [episode, setEpisode] = useState<TVEpisode | null>(null);
  const [episodes, setEpisodes] = useState<TVEpisode[]>([]);
  const [servers, setServers] = useState<ServerData[]>([]);
  const [selectedServer, setSelectedServer] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [error, setError] = useState('');
  const [showServerDropdown, setShowServerDropdown] = useState(false);

  const currentSources = servers[selectedServer]?.sources || [];
  const currentSubtitles = servers[selectedServer]?.subtitles || [];

  // Fetch show info and episode details
  useEffect(() => {
    if (!showId || !seasonNum || !episodeNum) return;
    const fetchAll = async () => {
      try {
        const [showRes, seasonRes] = await Promise.all([
          fetch(`/api/tmdb?action=tv&id=${showId}`),
          fetch(`/api/tmdb?action=tv-season&id=${showId}&season=${seasonNum}`),
        ]);
        if (!showRes.ok) throw new Error('TV show not found');
        if (!seasonRes.ok) throw new Error('Season not found');
        const showData = await showRes.json();
        const seasonData = await seasonRes.json();
        setShowInfo(showData);
        setEpisodes(seasonData.episodes || []);
        const ep = (seasonData.episodes || []).find(
          (e: TVEpisode) => e.episode_number === parseInt(episodeNum)
        );
        setEpisode(ep || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      }
      setLoading(false);
    };
    fetchAll();
  }, [showId, seasonNum, episodeNum]);

  // Fetch & decrypt sources
  const fetchSources = useCallback(async () => {
    if (!showInfo || !episode) return;
    setSourcesLoading(true);
    try {
      const res = await fetch(
        `/api/sources?title=${encodeURIComponent(showInfo.name)}&mediaType=tv&year=${showInfo.first_air_date?.split('-')[0] || ''}&tmdbId=${showId}&season=${seasonNum}&episode=${episodeNum}`
      );
      if (!res.ok) throw new Error('Failed to fetch sources');
      const data = await res.json();

      const serverResults: ServerData[] = (data.servers || []).map((s: ServerData) => ({
        serverId: s.serverId,
        serverName: s.serverName,
        sources: (s.sources || []).map((src: Source) => ({ quality: src.quality, url: src.url })),
        subtitles: (s.subtitles || []).map((sub: Subtitle) => ({ lang: sub.lang, language: sub.language, url: sub.url })),
      }));

      const qualityOrder: Record<string, number> = { '4K': 0, '1080p': 1, '1080': 2, '720p': 3, '720': 4, '480p': 5, '480': 6, '360p': 7, '360': 8 };
      for (const server of serverResults) {
        server.sources.sort((a: Source, b: Source) => (qualityOrder[a.quality] ?? 99) - (qualityOrder[b.quality] ?? 99));
      }

      setServers(serverResults);
      if (serverResults.length > 0) setSelectedServer(0);
    } catch {
      setError('Failed to load streaming sources.');
    }
    setSourcesLoading(false);
  }, [showInfo, episode, showId, seasonNum, episodeNum]);

  useEffect(() => {
    if (showInfo && episode) fetchSources();
  }, [showInfo, episode, fetchSources]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = () => setShowServerDropdown(false);
    if (showServerDropdown) {
      setTimeout(() => document.addEventListener('click', handler), 0);
      return () => document.removeEventListener('click', handler);
    }
  }, [showServerDropdown]);

  const goToEpisode = (sNum: number, eNum: number) => {
    router.push(`/tv/${showId}/${sNum}/${eNum}`);
  };

  const prevEpisode = episode ? episodes.find((e) => e.episode_number === episode.episode_number - 1) : null;
  const nextEpisode = episode ? episodes.find((e) => e.episode_number === episode.episode_number + 1) : null;

  const epTitle = episode
    ? `S${seasonNum}E${episodeNum} - ${episode.name}`
    : `S${seasonNum}E${episodeNum}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/20 border-t-[#e50914] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Backdrop */}
      {showInfo?.backdrop_path && (
        <div className="fixed inset-0 -z-10">
          <img src={`${TMDB_IMG}/original${showInfo.backdrop_path}`} alt="" className="w-full h-full object-cover opacity-20 blur-2xl" />
          <div className="absolute inset-0 bg-[#0a0a0f]/70" />
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0a0f]/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => router.push(`/tv/${showId}`)}
            className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm hidden sm:block">Episodes</span>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 truncate">{showInfo?.name}</p>
            <h1 className="text-sm font-medium truncate">{epTitle}</h1>
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
                  >
                    Next →
                  </button>
                )}
              </div>
            )}

            {/* Mobile server tabs */}
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
                poster={episode?.still_path ? `${TMDB_IMG}/w1280${episode.still_path}` : showInfo?.backdrop_path ? `${TMDB_IMG}/w1280${showInfo.backdrop_path}` : undefined}
                title={epTitle}
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
                  <div className="flex gap-2 justify-center flex-wrap">
                    {servers.length > 1 && (
                      <button
                        onClick={() => {
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
                    <button onClick={fetchSources} className="bg-[#e50914] hover:bg-[#f6121d] text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
                      Reload All
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Quality Info */}
            {currentSources.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-400">
                <span className="flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5" />
                  {currentSources.map((s) => s.quality).join(', ')}
                </span>
                {currentSubtitles.length > 0 && (
                  <>
                    <span className="text-gray-600">|</span>
                    <span>{currentSubtitles.length} subtitle(s)</span>
                  </>
                )}
              </div>
            )}

            {/* Episode Navigation */}
            <div className="mt-4 flex items-center justify-between bg-white/5 rounded-lg p-3">
              <button
                onClick={() => prevEpisode && goToEpisode(seasonNum, prevEpisode.episode_number)}
                disabled={!prevEpisode}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  prevEpisode ? 'bg-white/10 hover:bg-white/15 text-white' : 'bg-white/5 text-gray-600 cursor-not-allowed'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Previous</span>
              </button>
              <span className="text-sm text-gray-400">
                E{episodeNum} of {episodes.length}
              </span>
              <button
                onClick={() => nextEpisode && goToEpisode(seasonNum, nextEpisode.episode_number)}
                disabled={!nextEpisode}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  nextEpisode ? 'bg-[#e50914] hover:bg-[#f6121d] text-white' : 'bg-white/5 text-gray-600 cursor-not-allowed'
                }`}
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:w-80 shrink-0">
            {/* Current Episode Info */}
            {episode && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Tv className="w-5 h-5 text-[#e50914]" />
                  <h3 className="font-semibold">Now Playing</h3>
                </div>
                <h4 className="font-medium mb-1">
                  S{seasonNum}E{episode.episode_number}. {episode.name}
                </h4>
                <div className="flex gap-3 text-xs text-gray-500 mb-2">
                  {episode.air_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(episode.air_date).toLocaleDateString()}
                    </span>
                  )}
                  {episode.runtime && <span>{episode.runtime}m</span>}
                  {episode.vote_average > 0 && (
                    <span className="flex items-center gap-1 text-yellow-500">
                      <Star className="w-3 h-3 fill-yellow-500" /> {episode.vote_average.toFixed(1)}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">
                  {episode.overview || 'No description available.'}
                </p>
              </div>
            )}

            {/* Server Sources Summary */}
            {servers.length > 1 && (
              <div className="bg-white/5 rounded-lg p-4 mb-6">
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                  <Server className="w-4 h-4 text-[#e50914]" />
                  Servers
                </h3>
                <div className="space-y-1">
                  {servers.map((server, i) => (
                    <div
                      key={server.serverId}
                      onClick={() => setSelectedServer(i)}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors text-xs ${
                        selectedServer === i
                          ? 'bg-[#e50914]/15 border border-[#e50914]/30 text-[#e50914]'
                          : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      <span>{server.serverName}</span>
                      <span className="opacity-60">{server.sources.length} Q</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Episode List */}
            <div>
              <h3 className="font-semibold mb-3">Season {seasonNum} Episodes</h3>
              <div className="max-h-[50vh] overflow-y-auto space-y-1.5 pr-1">
                {episodes.map((ep) => (
                  <div
                    key={ep.id}
                    onClick={() => {
                      if (ep.episode_number !== parseInt(episodeNum)) {
                        goToEpisode(seasonNum, ep.episode_number);
                      }
                    }}
                    className={`flex gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                      ep.episode_number === parseInt(episodeNum)
                        ? 'bg-[#e50914]/20 border border-[#e50914]/30'
                        : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="relative w-24 shrink-0 aspect-video bg-white/5 rounded overflow-hidden">
                      {ep.still_path ? (
                        <img src={`${TMDB_IMG}/w185${ep.still_path}`} alt={ep.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Tv className="w-4 h-4 text-gray-600" />
                        </div>
                      )}
                      {ep.episode_number === parseInt(episodeNum) && (
                        <div className="absolute inset-0 bg-[#e50914]/30 flex items-center justify-center">
                          <Play className="w-4 h-4 fill-white text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 py-0.5">
                      <p className={`text-xs font-medium truncate ${ep.episode_number === parseInt(episodeNum) ? 'text-[#e50914]' : ''}`}>
                        E{ep.episode_number}. {ep.name}
                      </p>
                      {ep.runtime && <p className="text-xs text-gray-500 mt-0.5">{ep.runtime}m</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
