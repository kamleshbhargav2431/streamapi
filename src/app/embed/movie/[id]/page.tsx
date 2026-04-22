'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import VideoPlayer from '@/components/player/VideoPlayer';
import { Server, Monitor, ChevronDown, Loader2, Info } from 'lucide-react';

interface Source { quality: string; url: string; }
interface Subtitle { lang: string; language: string; url: string; }
interface ServerData { serverId: string; serverName: string; sources: Source[]; subtitles: Subtitle[]; }

export default function EmbedMovie() {
  const params = useParams();
  const id = params.id as string;

  const [servers, setServers] = useState<ServerData[]>([]);
  const [selectedServer, setSelectedServer] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showServerMenu, setShowServerMenu] = useState(false);

  const currentSources = servers[selectedServer]?.sources || [];
  const currentSubs = servers[selectedServer]?.subtitles || [];

  const fetchSources = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/sources?mediaType=movie&tmdbId=${id}`);
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();

      const qualityOrder: Record<string, number> = { '4K': 0, '1080p': 1, '1080': 2, '720p': 3, '720': 4, '480p': 5, '480': 6, '360p': 7, '360': 8 };
      const results: ServerData[] = (data.servers || []).map((s: ServerData) => {
        const sorted = [...(s.sources || [])].sort((a: Source, b: Source) => (qualityOrder[a.quality] ?? 99) - (qualityOrder[b.quality] ?? 99));
        const seen = new Set<string>();
        const uniqueSubs = (s.subtitles || []).filter((sub: Subtitle) => {
          if (seen.has(sub.lang)) return false;
          seen.add(sub.lang);
          return true;
        });
        return { serverId: s.serverId, serverName: s.serverName, sources: sorted, subtitles: uniqueSubs };
      }).filter((s: ServerData) => s.sources.length > 0);

      setServers(results);
      if (results.length > 0) setSelectedServer(0);
    } catch {
      setError('Failed to load sources');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  useEffect(() => {
    if (!showServerMenu) return;
    const handler = () => setShowServerMenu(false);
    setTimeout(() => document.addEventListener('click', handler), 0);
    return () => document.removeEventListener('click', handler);
  }, [showServerMenu]);

  return (
    <div className="bg-black min-h-screen flex flex-col">
      {/* Server Bar */}
      {servers.length > 1 && (
        <div className="bg-[#0d0d1a] px-3 py-2 flex items-center gap-2 border-b border-white/5 relative z-50">
          <span className="text-xs text-gray-500 flex items-center gap-1"><Server className="w-3 h-3" />Server:</span>
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowServerMenu(!showServerMenu); }}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white text-xs px-2.5 py-1 rounded-md transition-colors"
            >
              <Monitor className="w-3 h-3" />
              {servers[selectedServer]?.serverName}
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>
            {showServerMenu && (
              <div className="absolute top-full left-0 mt-1 bg-[#1a1a2e]/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden min-w-[180px] z-50">
                {servers.map((s, i) => (
                  <button
                    key={s.serverId}
                    onClick={(e) => { e.stopPropagation(); setSelectedServer(i); setShowServerMenu(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors ${
                      selectedServer === i ? 'text-[#e50914] bg-[#e50914]/10' : 'text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {selectedServer === i && <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>}
                      {s.serverName}
                    </span>
                    <span className="text-gray-600">{s.sources.length}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setSelectedServer((p) => (p + 1) % servers.length)}
            className="text-xs text-gray-500 hover:text-[#e50914] transition-colors"
          >
            Switch →
          </button>
        </div>
      )}

      {/* Player */}
      <div className="flex-1 flex items-center justify-center p-0">
        {loading ? (
          <div className="aspect-video w-full max-w-[1280px] bg-white/5 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-10 h-10 text-[#e50914] animate-spin mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Loading stream...</p>
            </div>
          </div>
        ) : currentSources.length > 0 ? (
          <div className="w-full max-w-[1280px]">
            <VideoPlayer sources={currentSources} subtitles={currentSubs} />
          </div>
        ) : (
          <div className="aspect-video w-full max-w-[1280px] bg-white/5 flex items-center justify-center">
            <div className="text-center">
              <Info className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 mb-2">{error || 'No sources available'}</p>
              <button onClick={fetchSources} className="bg-[#e50914] hover:bg-[#f6121d] text-white px-4 py-2 rounded-lg text-sm transition-colors">Retry</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
