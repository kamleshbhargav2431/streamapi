'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Film, Tv, Play, TrendingUp, Star } from 'lucide-react';

const TMDB_IMG = 'https://image.tmdb.org/t/p';

interface TMDBItem {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  media_type: string;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  overview: string;
}

export default function Home() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TMDBItem[]>([]);
  const [trending, setTrending] = useState<TMDBItem[]>([]);
  const [popularMovies, setPopularMovies] = useState<TMDBItem[]>([]);
  const [popularTV, setPopularTV] = useState<TMDBItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'trending' | 'movies' | 'tv'>('trending');

  const fetchTrending = useCallback(async () => {
    try {
      const res = await fetch('/api/tmdb?action=trending&type=all&time=week');
      const data = await res.json();
      setTrending(data.results?.filter((r: TMDBItem) => r.media_type !== 'person') || []);
    } catch {
      // Silently fail
    }
  }, []);

  const fetchPopular = useCallback(async () => {
    try {
      const [moviesRes, tvRes] = await Promise.all([
        fetch('/api/tmdb?action=popular-movies'),
        fetch('/api/tmdb?action=popular-tv'),
      ]);
      const moviesData = await moviesRes.json();
      const tvData = await tvRes.json();
      setPopularMovies(moviesData.results || []);
      setPopularTV(tvData.results || []);
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrending();
    fetchPopular();
  }, [fetchTrending, fetchPopular]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/tmdb?action=search&q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.results?.filter((r: TMDBItem) => r.media_type !== 'person') || []);
    } catch {
      setResults([]);
    }
    setIsSearching(false);
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(handleSearch, 500);
    return () => clearTimeout(timer);
  }, [handleSearch]);

  const getYear = (item: TMDBItem) => {
    const date = item.release_date || item.first_air_date;
    return date ? new Date(date).getFullYear() : '';
  };

  const handleClick = (item: TMDBItem) => {
    if (item.media_type === 'movie') {
      router.push(`/movie/${item.id}`);
    } else if (item.media_type === 'tv') {
      router.push(`/tv/${item.id}`);
    }
  };

  const displayItems = isSearching
    ? results
    : activeTab === 'trending'
      ? trending
      : activeTab === 'movies'
        ? popularMovies
        : popularTV;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0a0f]/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => { setQuery(''); setActiveTab('trending'); }}
          >
            <div className="w-8 h-8 bg-[#e50914] rounded-lg flex items-center justify-center">
              <Play className="w-4 h-4 fill-white text-white ml-0.5" />
            </div>
            <span className="text-lg font-bold hidden sm:block">StreamBox</span>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-xl relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search movies & TV shows..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-white/10 border border-white/10 rounded-full pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-[#e50914]/50 focus:ring-1 focus:ring-[#e50914]/30 placeholder-gray-500 transition-all"
            />
          </div>
        </div>
      </header>

      {/* Hero */}
      {!query && !isSearching && trending.length > 0 && (
        <div className="relative h-[50vh] sm:h-[60vh] overflow-hidden">
          {trending.slice(0, 1).map((item) => (
            <div key={item.id} className="absolute inset-0">
              {item.backdrop_path ? (
                <img
                  src={`${TMDB_IMG}/original${item.backdrop_path}`}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/60 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0f]/80 to-transparent" />
              <div className="absolute bottom-16 sm:bottom-20 left-4 sm:left-12 max-w-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-[#e50914] px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Trending
                  </span>
                  <span className="text-gray-400 text-sm">{getYear(item)}</span>
                  {item.vote_average > 0 && (
                    <span className="text-yellow-500 text-sm flex items-center gap-1">
                      <Star className="w-3 h-3 fill-yellow-500" /> {item.vote_average.toFixed(1)}
                    </span>
                  )}
                </div>
                <h1 className="text-3xl sm:text-5xl font-bold mb-3">{item.title || item.name}</h1>
                <p className="text-gray-300 text-sm sm:text-base line-clamp-2 mb-5">{item.overview}</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleClick(item)}
                    className="bg-[#e50914] hover:bg-[#f6121d] text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-colors"
                  >
                    <Play className="w-5 h-5 fill-white" /> Watch Now
                  </button>
                  <span className="flex items-center gap-1 text-gray-400 text-sm border border-white/20 px-3 rounded-lg">
                    {item.media_type === 'movie' ? <Film className="w-4 h-4" /> : <Tv className="w-4 h-4" />}
                    {item.media_type === 'movie' ? 'Movie' : 'TV Series'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Tabs (only when not searching) */}
        {!query && !isSearching && (
          <div className="flex gap-2 mb-8">
            {[
              { key: 'trending', label: 'Trending', icon: TrendingUp },
              { key: 'movies', label: 'Movies', icon: Film },
              { key: 'tv', label: 'TV Shows', icon: Tv },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as 'trending' | 'movies' | 'tv')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === key
                    ? 'bg-[#e50914] text-white'
                    : 'bg-white/10 text-gray-300 hover:bg-white/15'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Section Title */}
        <h2 className="text-xl sm:text-2xl font-bold mb-5">
          {isSearching
            ? `Search results for "${query}"`
            : activeTab === 'trending'
              ? 'Trending This Week'
              : activeTab === 'movies'
                ? 'Popular Movies'
                : 'Popular TV Shows'}
        </h2>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[2/3] bg-white/10 rounded-lg" />
              </div>
            ))}
          </div>
        )}

        {/* Grid */}
        {!isLoading && displayItems.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {displayItems.map((item) => (
              <div
                key={item.id}
                onClick={() => handleClick(item)}
                className="group cursor-pointer"
              >
                <div className="relative aspect-[2/3] bg-white/5 rounded-lg overflow-hidden mb-2">
                  {item.poster_path ? (
                    <img
                      src={`${TMDB_IMG}/w500${item.poster_path}`}
                      alt={item.title || item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-white/5">
                      <Film className="w-8 h-8 text-gray-600" />
                    </div>
                  )}
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-12 h-12 bg-[#e50914] rounded-full flex items-center justify-center">
                        <Play className="w-5 h-5 fill-white text-white ml-0.5" />
                      </div>
                    </div>
                  </div>
                  {/* Rating Badge */}
                  {item.vote_average > 0 && (
                    <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1">
                      <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                      {item.vote_average.toFixed(1)}
                    </div>
                  )}
                  {/* Type Badge */}
                  <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded text-xs">
                    {item.media_type === 'movie' ? 'Movie' : 'TV'}
                  </div>
                </div>
                <h3 className="text-sm font-medium truncate">{item.title || item.name}</h3>
                <p className="text-xs text-gray-500">{getYear(item)}</p>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && displayItems.length === 0 && (
          <div className="text-center py-20">
            <Search className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No results found</p>
            {query && (
              <p className="text-gray-500 text-sm mt-1">Try a different search term</p>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-8 text-center text-gray-500 text-sm">
          <p>StreamBox - Powered by TMDB & Videasy</p>
          <p className="mt-1">All streaming sources are fetched from third-party APIs.</p>
        </div>
      </footer>
    </div>
  );
}
