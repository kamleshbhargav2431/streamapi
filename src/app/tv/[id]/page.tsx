'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Play, Star, Calendar, Info, ChevronDown, ChevronRight, Tv } from 'lucide-react';

const TMDB_IMG = 'https://image.tmdb.org/t/p';

interface TVEpisode {
  id: number;
  name: string;
  overview: string;
  episode_number: number;
  still_path: string | null;
  air_date: string | null;
  runtime: number | null;
  vote_average: number;
}

interface TVSeason {
  id: number;
  name: string;
  season_number: number;
  episode_count: number;
  air_date: string | null;
  poster_path: string | null;
  episodes: TVEpisode[];
}

interface TVShow {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  number_of_seasons: number;
  vote_average: number;
  genres: { id: number; name: string }[];
  tagline?: string;
  imdb_id?: string;
  credits?: { cast: { id: number; name: string; character: string; profile_path: string | null }[] };
  similar?: { results: { id: number; name: string; poster_path: string | null; first_air_date: string; vote_average: number }[] };
  seasons: { id: number; season_number: number; name: string; episode_count: number }[];
}

export default function TVPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [show, setShow] = useState<TVShow | null>(null);
  const [seasons, setSeasons] = useState<TVSeason[]>([]);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [loading, setLoading] = useState(true);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch TV show details
  useEffect(() => {
    if (!id) return;
    const fetchShow = async () => {
      try {
        const res = await fetch(`/api/tmdb?action=tv&id=${id}`);
        if (!res.ok) throw new Error('TV show not found');
        const data = await res.json();
        setShow(data);
        // Set initial season number
        if (data.seasons?.length > 0) {
          const firstSeason = data.seasons.find((s: { season_number: number }) => s.season_number > 0);
          if (firstSeason) setSelectedSeason(firstSeason.season_number);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load TV show');
      }
      setLoading(false);
    };
    fetchShow();
  }, [id]);

  // Fetch season episodes
  useEffect(() => {
    if (!selectedSeason) return;
    const fetchSeason = async () => {
      setSeasonLoading(true);
      try {
        const res = await fetch(`/api/tmdb?action=tv-season&id=${id}&season=${selectedSeason}`);
        if (!res.ok) throw new Error('Failed to load season');
        const data = await res.json();
        setSeasons((prev) => {
          const existing = prev.findIndex((s) => s.season_number === selectedSeason);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = data;
            return updated;
          }
          return [...prev, data];
        });
      } catch {
        // Silently fail
      }
      setSeasonLoading(false);
    };
    fetchSeason();
  }, [id, selectedSeason]);

  const currentEpisodes = seasons.find((s) => s.season_number === selectedSeason)?.episodes || [];
  const validSeasons = show?.seasons?.filter((s) => s.season_number > 0) || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/20 border-t-[#e50914] rounded-full animate-spin" />
      </div>
    );
  }

  if (!show) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-lg mb-4">{error || 'TV show not found'}</p>
          <button onClick={() => router.back()} className="text-[#e50914] hover:underline">
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Backdrop */}
      {show.backdrop_path && (
        <div className="fixed inset-0 -z-10">
          <img
            src={`${TMDB_IMG}/original${show.backdrop_path}`}
            alt=""
            className="w-full h-full object-cover opacity-20 blur-2xl"
          />
          <div className="absolute inset-0 bg-[#0a0a0f]/70" />
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0a0f]/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm hidden sm:block">Back</span>
          </button>
          <div className="flex-1">
            <h1 className="text-sm sm:text-base font-medium truncate">{show.name}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Episodes Section */}
          <div className="flex-1">
            {/* Season Selector */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <Tv className="w-5 h-5 text-[#e50914]" />
                <h2 className="text-xl font-bold">Episodes</h2>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {validSeasons.map((season) => (
                  <button
                    key={season.id}
                    onClick={() => setSelectedSeason(season.season_number)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      selectedSeason === season.season_number
                        ? 'bg-[#e50914] text-white'
                        : 'bg-white/10 text-gray-300 hover:bg-white/15'
                    }`}
                  >
                    {season.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Episode List */}
            {seasonLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="bg-white/5 rounded-lg p-4 animate-pulse">
                    <div className="flex gap-4">
                      <div className="w-40 sm:w-56 aspect-video bg-white/10 rounded" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-white/10 rounded w-24" />
                        <div className="h-3 bg-white/10 rounded w-48" />
                        <div className="h-3 bg-white/10 rounded w-32" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : currentEpisodes.length > 0 ? (
              <div className="space-y-3">
                {currentEpisodes.map((ep) => (
                  <div
                    key={ep.id}
                    onClick={() => router.push(`/tv/${id}/${selectedSeason}/${ep.episode_number}`)}
                    className="bg-white/5 hover:bg-white/10 rounded-lg p-3 sm:p-4 cursor-pointer transition-colors group"
                  >
                    <div className="flex gap-3 sm:gap-4">
                      {/* Thumbnail */}
                      <div className="relative w-36 sm:w-56 shrink-0 aspect-video bg-white/5 rounded overflow-hidden">
                        {ep.still_path ? (
                          <img
                            src={`${TMDB_IMG}/w400${ep.still_path}`}
                            alt={ep.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-white/5">
                            <Tv className="w-6 h-6 text-gray-600" />
                          </div>
                        )}
                        {/* Play Overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                          <div className="w-10 h-10 bg-[#e50914] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                          </div>
                        </div>
                        <div className="absolute bottom-1 right-1 bg-black/70 text-xs px-1.5 py-0.5 rounded">
                          E{ep.episode_number}
                        </div>
                      </div>

                      {/* Episode Info */}
                      <div className="flex-1 min-w-0 py-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-medium text-sm sm:text-base truncate">
                            E{ep.episode_number}. {ep.name}
                          </h3>
                          {ep.vote_average > 0 && (
                            <span className="text-xs text-yellow-500 flex items-center gap-0.5 shrink-0">
                              <Star className="w-3 h-3 fill-yellow-500" />
                              {ep.vote_average.toFixed(1)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                          {ep.air_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(ep.air_date).toLocaleDateString()}
                            </span>
                          )}
                          {ep.runtime && (
                            <span>{ep.runtime}m</span>
                          )}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-400 mt-2 line-clamp-2 sm:line-clamp-3">
                          {ep.overview || 'No description available.'}
                        </p>
                      </div>

                      {/* Arrow */}
                      <div className="flex items-center shrink-0 text-gray-500 group-hover:text-white transition-colors">
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Info className="w-10 h-10 text-gray-500 mx-auto mb-3" />
                <p className="text-gray-400">No episodes available for this season.</p>
              </div>
            )}
          </div>

          {/* Info Sidebar */}
          <div className="lg:w-80 shrink-0">
            <div className="flex flex-col sm:flex-row lg:flex-col gap-4 mb-6">
              {show.poster_path && (
                <img
                  src={`${TMDB_IMG}/w342${show.poster_path}`}
                  alt={show.name}
                  className="w-40 sm:w-32 lg:w-full rounded-lg shadow-lg mx-auto lg:mx-0"
                />
              )}
              <div className="flex-1">
                <h1 className="text-xl sm:text-2xl font-bold mb-1">{show.name}</h1>
                {show.tagline && (
                  <p className="text-gray-400 italic text-sm mb-3">&ldquo;{show.tagline}&rdquo;</p>
                )}
                <div className="flex flex-wrap gap-2 mb-3">
                  {show.genres?.map((g) => (
                    <span key={g.id} className="bg-white/10 px-2.5 py-1 rounded text-xs">{g.name}</span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-gray-400">
                  {show.vote_average > 0 && (
                    <span className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                      {show.vote_average.toFixed(1)}
                    </span>
                  )}
                  {show.first_air_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(show.first_air_date).getFullYear()}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Tv className="w-4 h-4" />
                    {show.number_of_seasons} Season{show.number_of_seasons > 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white/5 rounded-lg p-4 mb-6">
              <h3 className="font-semibold mb-2">Overview</h3>
              <p className="text-gray-300 text-sm leading-relaxed">{show.overview || 'No overview available.'}</p>
            </div>

            <a
              href={`https://www.themoviedb.org/tv/${id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-sm text-[#e50914] hover:underline mb-6"
            >
              View on TMDB &rarr;
            </a>

            {/* Cast */}
            {show.credits?.cast && show.credits.cast.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Cast</h3>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {show.credits.cast.slice(0, 15).map((person) => (
                    <div key={person.id} className="flex items-center gap-3 bg-white/5 rounded-lg p-2">
                      {person.profile_path ? (
                        <img
                          src={`${TMDB_IMG}/w92${person.profile_path}`}
                          alt={person.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-xs">
                          {person.name.charAt(0)}
                        </div>
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
            {show.similar?.results && show.similar.results.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Similar Shows</h3>
                <div className="grid grid-cols-3 gap-2">
                  {show.similar.results.slice(0, 6).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => router.push(`/tv/${item.id}`)}
                      className="cursor-pointer group"
                    >
                      <div className="aspect-[2/3] bg-white/5 rounded overflow-hidden mb-1">
                        {item.poster_path ? (
                          <img
                            src={`${TMDB_IMG}/w185${item.poster_path}`}
                            alt={item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Tv className="w-6 h-6 text-gray-600" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs truncate">{item.name}</p>
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
