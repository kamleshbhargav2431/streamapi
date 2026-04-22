'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import Hls from 'hls.js';

// ── Types ──
interface Source {
  quality: string;
  url: string;
}

interface Subtitle {
  lang: string;
  language: string;
  url: string;
}

interface VideoPlayerProps {
  sources: Source[];
  subtitles: Subtitle[];
  poster?: string;
  title?: string;
}

type MenuPanel = 'none' | 'quality' | 'subtitles' | 'speed' | 'settings';

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export default function VideoPlayer({ sources, subtitles, poster, title }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── State ──
  const [selectedQuality, setSelectedQuality] = useState(0);
  const [selectedSubtitle, setSelectedSubtitle] = useState(-1);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [buffered, setBuffered] = useState(0);
  const [activeMenu, setActiveMenu] = useState<MenuPanel>('none');
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);
  const [isPiP, setIsPiP] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const currentSource = sources[selectedQuality];

  // ── Unique subtitles (dedupe by lang) ──
  const uniqueSubtitles = useMemo(() => {
    const seen = new Set<string>();
    return subtitles.filter((s) => {
      if (seen.has(s.lang)) return false;
      seen.add(s.lang);
      return true;
    });
  }, [subtitles]);

  // ── HLS subtitle tracks state ──
  const [hlsSubTracks, setHlsSubTracks] = useState<{ id: number; lang: string; name: string; url?: string }[]>([]);

  // ── Initialize HLS player ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentSource?.url) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const url = currentSource.url;

    if (Hls.isSupported() && (url.includes('.m3u8') || url.includes('type=hls'))) {
      const hls = new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        startLevel: -1,
        capLevelToPlayerSize: true,
      });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        setIsLoading(false);
        // Collect HLS subtitle tracks
        const subTracks = (data.subtitleTracks || []).map((t, i) => ({
          id: i,
          lang: t.lang || 'und',
          name: t.name || t.lang || 'Unknown',
          url: t.url,
        }));
        setHlsSubTracks(subTracks);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          }
        }
      });

      // Listen for subtitle track changes
      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => {
        const tracks = hls.subtitleTracks || [];
        const subTracks = tracks.map((t, i) => ({
          id: i,
          lang: t.lang || 'und',
          name: t.name || t.lang || 'Unknown',
          url: t.url,
        }));
        setHlsSubTracks(subTracks);
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.addEventListener('loadedmetadata', () => setIsLoading(false), { once: true });
    } else {
      video.src = url;
      video.addEventListener('loadedmetadata', () => setIsLoading(false), { once: true });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentSource]);

  // ── Subtitle handling: external VTT via HLS.js ──
  useEffect(() => {
    const hls = hlsRef.current;
    if (!hls || !Hls.isSupported()) return;

    if (selectedSubtitle >= 0 && uniqueSubtitles[selectedSubtitle]) {
      const sub = uniqueSubtitles[selectedSubtitle];
      // Check if HLS already has this track
      const existingIdx = (hls.subtitleTracks || []).findIndex(
        (t) => t.lang === sub.lang || t.name === sub.language
      );

      if (existingIdx >= 0) {
        hls.subtitleTrack = existingIdx;
      } else if (sub.url) {
        // Add external subtitle track dynamically
        try {
          // For VTT subtitles, add as a new subtitle track
          if (sub.url.endsWith('.vtt') || sub.url.includes('.vtt')) {
            hls.addSubtitleTrack(sub.language, sub.url, false);
            const newTracks = hls.subtitleTracks || [];
            hls.subtitleTrack = newTracks.length - 1;
          }
        } catch {
          // Fallback: use track element
          const vid2 = videoRef.current;
          if (vid2) {
            vid2.querySelectorAll('track[data-dynamic]').forEach((t) => t.remove());
            const track = document.createElement('track');
            track.setAttribute('kind', 'subtitles');
            track.setAttribute('src', sub.url);
            track.setAttribute('srclang', sub.lang);
            track.setAttribute('label', sub.language);
            track.setAttribute('data-dynamic', 'true');
            track.default = true;
            vid2.appendChild(track);
            track.addEventListener('load', () => {
              const idx = Array.from(vid2.textTracks).findIndex(
                (t) => t.label === sub.language || t.language === sub.lang
              );
              if (idx >= 0) vid2.textTracks[idx].mode = 'showing';
            });
          }
        }
      }
    } else {
      // Disable subtitles
      hls.subtitleTrack = -1;
      // Remove any track elements we added
      const video = videoRef.current;
      if (video) {
        const existingTracks = video.querySelectorAll('track[data-dynamic]');
        existingTracks.forEach((t) => t.remove());
        video.textTracks.forEach((track) => {
          if (track.mode !== 'disabled') track.mode = 'disabled';
        });
      }
    }
  }, [selectedSubtitle, uniqueSubtitles]);



  // ── Video event handlers ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlers: Record<string, () => void> = {};
    handlers.timeupdate = () => setCurrentTime(video.currentTime);
    handlers.durationchange = () => setDuration(video.duration || 0);
    handlers.play = () => setIsPlaying(true);
    handlers.pause = () => setIsPlaying(false);
    handlers.waiting = () => setIsLoading(true);
    handlers.canplay = () => setIsLoading(false);
    handlers.progress = () => {
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };

    for (const [event, handler] of Object.entries(handlers)) {
      video.addEventListener(event, handler);
    }
    return () => {
      for (const [event, handler] of Object.entries(handlers)) {
        video.removeEventListener(event, handler);
      }
    };
  }, []);

  // ── Fullscreen change listener ──
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ── Auto-hide controls ──
  const resetHideTimer = useCallback(() => {
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    setShowControls(true);
    if (isPlaying) {
      controlsTimer.current = setTimeout(() => {
        if (activeMenu === 'none') setShowControls(false);
      }, 3000);
    }
  }, [isPlaying, activeMenu]);

  useEffect(() => {
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    if (isPlaying && activeMenu === 'none') {
      controlsTimer.current = setTimeout(() => setShowControls(false), 3000);
    }
    return () => {
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
    };
  }, [isPlaying, activeMenu]);

  // ── Menu auto-close timer ──
  const resetMenuTimer = useCallback(() => {
    if (menuTimer.current) clearTimeout(menuTimer.current);
    menuTimer.current = setTimeout(() => setActiveMenu('none'), 5000);
  }, []);

  // ── Player controls ──
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const val = parseFloat(e.target.value);
    video.volume = val;
    setVolume(val);
    if (val === 0) {
      video.muted = true;
      setIsMuted(true);
    } else if (video.muted) {
      video.muted = false;
      setIsMuted(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const time = parseFloat(e.target.value);
    video.currentTime = time;
    setCurrentTime(time);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiP(false);
      } else {
        await video.requestPictureInPicture();
        setIsPiP(true);
      }
    } catch {
      // PiP not supported
    }
  };

  const takeScreenshot = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const link = document.createElement('a');
    link.download = `${title || 'screenshot'}-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const skip = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
  };

  const changeQuality = (idx: number) => {
    const video = videoRef.current;
    if (!video) return;
    const curTime = video.currentTime;
    const wasPlaying = !video.paused;
    setSelectedQuality(idx);
    setActiveMenu('none');
    setTimeout(() => {
      if (video) {
        video.currentTime = curTime;
        if (wasPlaying) video.play();
      }
    }, 500);
  };

  const changeSpeed = (speed: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    setPlaybackSpeed(speed);
    setActiveMenu('none');
  };

  const handleProgressHover = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    setHoverTime(pct * (duration || 0));
    setHoverX(x);
  };

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const video = videoRef.current;
      if (!video) return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skip(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          skip(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          setVolume(video.volume);
          break;
        case 'ArrowDown':
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          setVolume(video.volume);
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'p':
          e.preventDefault();
          togglePiP();
          break;
        case 's':
          if (e.shiftKey) {
            e.preventDefault();
            takeScreenshot();
          }
          break;
        case '?':
          e.preventDefault();
          setShowShortcuts((v) => !v);
          break;
        case 'Escape':
          setActiveMenu('none');
          setShowShortcuts(false);
          break;
        case '<':
        case ',': {
          e.preventDefault();
          const speeds = SPEED_OPTIONS;
          const curIdx = speeds.indexOf(playbackSpeed);
          if (curIdx > 0) changeSpeed(speeds[curIdx - 1]);
          break;
        }
        case '>':
        case '.': {
          e.preventDefault();
          const speeds = SPEED_OPTIONS;
          const curIdx = speeds.indexOf(playbackSpeed);
          if (curIdx < speeds.length - 1) changeSpeed(speeds[curIdx + 1]);
          break;
        }
        case 'c': {
          e.preventDefault();
          // Cycle subtitles
          const newSub = selectedSubtitle + 1;
          if (newSub > uniqueSubtitles.length) setSelectedSubtitle(-1);
          else setSelectedSubtitle(newSub);
          break;
        }
      }
      resetHideTimer();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [playbackSpeed, selectedSubtitle, uniqueSubtitles, isPiP]);

  // ── Format time ──
  const formatTime = (s: number) => {
    if (!isFinite(s) || isNaN(s)) return '0:00';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  // ── SVG Icons ──
  const Icons = {
    play: <path d="M8 5v14l11-7z" />,
    pause: <><path d="M6 4h4v16H6z" /><path d="M14 4h4v16h-4z" /></>,
    skipBack: <><path d="M1 4v6h6M23 20v-6h-6" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" /></>,
    skipFwd: <><path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></>,
    volumeHigh: <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />,
    volumeMute: <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />,
    fullscreen: <path d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />,
    exitFullscreen: <><path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" /></>,
    pip: <><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><rect x="11" y="9" width="9" height="6" rx="1" ry="1" fill="currentColor" opacity="0.3" /></>,
    settings: <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />,
    quality: <><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-8 12H9.5v-2h-2v2H6V9h1.5v2.5h2V9H11v6zm7-1c0 .55-.45 1-1 1h-.75v1.5h-1.5V15H14c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v4zm-3.5-.5h2v-3h-2v3z" /></>,
    subtitles: <><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM6 10h2v2H6zm0 4h8v2H6zm10 0h2v2h-2zm-6-4h8v2h-8z" /></>,
    speed: <><path d="M20.38 8.57l-1.23 1.85c-.11.16-.04.38.14.46l1.07.43c.19.08.4-.05.4-.25v-1.57c0-.17-.13-.31-.3-.31-.02 0-.05 0-.08.01zM10.5 7c-3.03 0-5.5 2.47-5.5 5.5s2.47 5.5 5.5 5.5c.59 0 1.17-.1 1.7-.27C11.35 16.75 10.5 14.73 10.5 12.5c0-2.06.7-3.95 1.87-5.47-.28-.02-.57-.03-.87-.03z" /><path d="M12.5 7c-3.03 0-5.5 2.47-5.5 5.5s2.47 5.5 5.5 5.5S18 15.53 18 12.5 15.53 7 12.5 7z" opacity=".3" /></>,
    camera: <path d="M12 15.2l-3.2-3.2 1.1-1.1 1.5 1.5V8h1.6v4.4l1.5-1.5 1.1 1.1z" />,
    close: <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />,
  };

  // ── Menu panel component ──
  const renderMenu = (type: MenuPanel) => {
    if (type === 'none') return null;

    const baseClass = 'absolute bottom-full right-0 mb-2 bg-[#1a1a2e]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[200px]';

    switch (type) {
      case 'quality':
        return (
          <div className={baseClass} onMouseEnter={resetMenuTimer}>
            <div className="px-3 py-2 border-b border-white/10">
              <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Quality</h4>
            </div>
            <div className="py-1 max-h-60 overflow-y-auto">
              {sources.map((s, i) => (
                <button
                  key={i}
                  onClick={() => changeQuality(i)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                    selectedQuality === i
                      ? 'text-[#e50914] bg-[#e50914]/10'
                      : 'text-gray-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {selectedQuality === i && (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
                    )}
                    {s.quality}
                  </span>
                  {i === 0 && <span className="text-xs text-gray-500">Auto</span>}
                </button>
              ))}
            </div>
          </div>
        );

      case 'subtitles':
        return (
          <div className={baseClass} onMouseEnter={resetMenuTimer}>
            <div className="px-3 py-2 border-b border-white/10">
              <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Subtitles</h4>
            </div>
            <div className="py-1 max-h-60 overflow-y-auto">
              <button
                onClick={() => { setSelectedSubtitle(-1); setActiveMenu('none'); }}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                  selectedSubtitle === -1
                    ? 'text-[#e50914] bg-[#e50914]/10'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  {selectedSubtitle === -1 && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
                  )}
                  Off
                </span>
              </button>
              {uniqueSubtitles.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { setSelectedSubtitle(i); setActiveMenu('none'); }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                    selectedSubtitle === i
                      ? 'text-[#e50914] bg-[#e50914]/10'
                      : 'text-gray-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {selectedSubtitle === i && (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
                    )}
                    {s.language}
                  </span>
                  <span className="text-xs text-gray-500 uppercase">{s.lang}</span>
                </button>
              ))}
            </div>
          </div>
        );

      case 'speed':
        return (
          <div className={baseClass} onMouseEnter={resetMenuTimer}>
            <div className="px-3 py-2 border-b border-white/10">
              <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Playback Speed</h4>
            </div>
            <div className="py-1 max-h-60 overflow-y-auto">
              {SPEED_OPTIONS.map((speed) => (
                <button
                  key={speed}
                  onClick={() => changeSpeed(speed)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                    playbackSpeed === speed
                      ? 'text-[#e50914] bg-[#e50914]/10'
                      : 'text-gray-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {playbackSpeed === speed && (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
                    )}
                    {speed === 1 ? 'Normal' : `${speed}x`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );

      case 'settings':
        return (
          <div className={baseClass} onMouseEnter={resetMenuTimer}>
            <div className="px-3 py-2 border-b border-white/10">
              <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Settings</h4>
            </div>
            <div className="py-1">
              <button
                onClick={() => { setActiveMenu('quality'); resetMenuTimer(); }}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">{Icons.quality}</svg>
                  Quality
                </span>
                <span className="text-xs text-gray-500">{sources[selectedQuality]?.quality}</span>
              </button>
              <button
                onClick={() => { setActiveMenu('subtitles'); resetMenuTimer(); }}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">{Icons.subtitles}</svg>
                  Subtitles
                </span>
                <span className="text-xs text-gray-500">{selectedSubtitle >= 0 ? uniqueSubtitles[selectedSubtitle]?.language : 'Off'}</span>
              </button>
              <button
                onClick={() => { setActiveMenu('speed'); resetMenuTimer(); }}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">{Icons.speed}</svg>
                  Speed
                </span>
                <span className="text-xs text-gray-500">{playbackSpeed === 1 ? 'Normal' : `${playbackSpeed}x`}</span>
              </button>
              <div className="border-t border-white/10 my-1" />
              <button
                onClick={() => { takeScreenshot(); setActiveMenu('none'); }}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">{Icons.camera}</svg>
                  Screenshot
                </span>
                <span className="text-xs text-gray-500">Shift+S</span>
              </button>
              <button
                onClick={() => { setShowShortcuts(true); setActiveMenu('none'); }}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10" /></svg>
                  Keyboard Shortcuts
                </span>
                <span className="text-xs text-gray-500">?</span>
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black rounded-lg overflow-hidden group select-none"
      style={{ aspectRatio: '16/9' }}
      onMouseMove={() => { resetHideTimer(); }}
      onMouseLeave={() => { if (isPlaying && activeMenu === 'none') setShowControls(false); }}
      tabIndex={0}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full cursor-pointer"
        poster={poster}
        playsInline
        crossOrigin="anonymous"
        onClick={togglePlay}
        onDoubleClick={() => toggleFullscreen()}
      />

      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none z-10">
          <div className="relative">
            <div className="w-14 h-14 border-4 border-white/20 border-t-[#e50914] rounded-full animate-spin" />
          </div>
        </div>
      )}

      {/* Big Play Button (centered, when paused) */}
      {!isPlaying && !isLoading && (
        <div
          className="absolute inset-0 flex items-center justify-center cursor-pointer z-10"
          onClick={togglePlay}
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/15 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white/25 hover:scale-105 transition-all duration-200 shadow-2xl">
            <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              {Icons.play}
            </svg>
          </div>
        </div>
      )}

      {/* Skip feedback overlay */}
      {/* Gradient Overlays */}
      <div className={`absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-black/70 to-transparent pointer-events-none z-20 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`} />
      <div className={`absolute bottom-0 left-0 right-0 h-36 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-20 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`} />

      {/* ── TOP BAR ── */}
      <div className={`absolute top-0 left-0 right-0 px-4 pt-3 pb-2 z-30 transition-all duration-300 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {title && (
              <h3 className="text-white text-sm sm:text-base font-medium truncate max-w-[60vw]">{title}</h3>
            )}
            {selectedSubtitle >= 0 && uniqueSubtitles[selectedSubtitle] && (
              <span className="hidden sm:inline-flex items-center gap-1 bg-white/15 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded-full">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">{Icons.subtitles}</svg>
                {uniqueSubtitles[selectedSubtitle].language}
              </span>
            )}
            {playbackSpeed !== 1 && (
              <span className="hidden sm:inline-flex items-center bg-white/15 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded-full">
                {playbackSpeed}x
              </span>
            )}
          </div>
          {isPiP && (
            <span className="bg-[#e50914]/80 text-white text-xs px-2 py-0.5 rounded-full">PiP</span>
          )}
        </div>
      </div>

      {/* ── BOTTOM CONTROLS ── */}
      <div className={`absolute bottom-0 left-0 right-0 z-30 transition-all duration-300 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
        {/* Progress Bar */}
        <div className="px-3 sm:px-4 mb-1 relative group/progress">
          <div
            className="relative w-full h-1 group-hover/progress:h-2 transition-all duration-150 cursor-pointer rounded-full"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = (e.clientX - rect.left) / rect.width;
              const video = videoRef.current;
              if (video) {
                video.currentTime = pct * video.duration;
                setCurrentTime(video.currentTime);
              }
            }}
            onMouseMove={handleProgressHover}
            onMouseLeave={() => setHoverTime(null)}
          >
            {/* Buffered */}
            <div
              className="absolute inset-y-0 left-0 bg-white/20 rounded-full"
              style={{ width: `${bufferedPct}%` }}
            />
            {/* Progress */}
            <div
              className="absolute inset-y-0 left-0 bg-[#e50914] rounded-full"
              style={{ width: `${progress}%` }}
            />
            {/* Thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-[#e50914] rounded-full shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity scale-0 group-hover/progress:scale-100"
              style={{ left: `calc(${progress}% - 7px)` }}
            />
          </div>
          {/* Hover Time Tooltip */}
          {hoverTime !== null && (
            <div
              className="absolute bottom-full mb-2 bg-black/90 text-white text-xs px-2 py-1 rounded pointer-events-none transform -translate-x-1/2"
              style={{ left: `${hoverX}px` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>

        {/* Control Buttons */}
        <div className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 pb-3 sm:pb-4">
          {/* Play/Pause */}
          <button onClick={togglePlay} className="p-1.5 text-white hover:text-[#e50914] transition-colors rounded-lg hover:bg-white/10" title="Play/Pause (Space/K)">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              {isPlaying ? Icons.pause : Icons.play}
            </svg>
          </button>

          {/* Skip buttons */}
          <button onClick={() => skip(-10)} className="p-1.5 text-white/80 hover:text-white transition-colors rounded-lg hover:bg-white/10 hidden sm:block" title="Rewind 10s (←)">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>{Icons.skipBack}</svg>
          </button>
          <button onClick={() => skip(10)} className="p-1.5 text-white/80 hover:text-white transition-colors rounded-lg hover:bg-white/10 hidden sm:block" title="Forward 10s (→)">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>{Icons.skipFwd}</svg>
          </button>

          {/* Volume */}
          <div className="flex items-center gap-1 group/vol">
            <button onClick={toggleMute} className="p-1.5 text-white/80 hover:text-white transition-colors rounded-lg hover:bg-white/10" title="Mute (M)">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                {isMuted || volume === 0 ? Icons.volumeMute : Icons.volumeHigh}
              </svg>
            </button>
            <div className="w-0 group-hover/vol:w-14 sm:w-16 transition-all duration-200 overflow-hidden">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-full h-1 appearance-none bg-white/30 rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:hover:bg-[#e50914]"
              />
            </div>
          </div>

          {/* Time */}
          <span className="text-white/80 text-xs sm:text-sm font-mono ml-1 whitespace-nowrap">
            {formatTime(currentTime)} <span className="text-white/40">/</span> {formatTime(duration)}
          </span>

          <div className="flex-1" />

          {/* Subtitles shortcut button */}
          {uniqueSubtitles.length > 0 && (
            <button
              onClick={() => { setActiveMenu(activeMenu === 'subtitles' ? 'none' : 'subtitles'); resetMenuTimer(); }}
              className={`p-1.5 transition-colors rounded-lg hover:bg-white/10 ${selectedSubtitle >= 0 ? 'text-[#e50914]' : 'text-white/80 hover:text-white'}`}
              title="Subtitles (C)"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">{Icons.subtitles}</svg>
            </button>
          )}

          {/* PiP */}
          <button
            onClick={togglePiP}
            className={`p-1.5 transition-colors rounded-lg hover:bg-white/10 ${isPiP ? 'text-[#e50914]' : 'text-white/80 hover:text-white'}`}
            title="Picture-in-Picture (P)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">{Icons.pip}</svg>
          </button>

          {/* Settings */}
          <div className="relative">
            <button
              onClick={() => {
                if (activeMenu === 'settings' || activeMenu === 'quality' || activeMenu === 'subtitles' || activeMenu === 'speed') {
                  setActiveMenu('none');
                } else {
                  setActiveMenu('settings');
                  resetMenuTimer();
                }
              }}
              className={`p-1.5 transition-colors rounded-lg hover:bg-white/10 ${activeMenu !== 'none' ? 'text-[#e50914]' : 'text-white/80 hover:text-white'}`}
              title="Settings"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">{Icons.settings}</svg>
            </button>
            {/* Back button for submenus */}
            {['quality', 'subtitles', 'speed'].includes(activeMenu) && (
              <button
                onClick={() => { setActiveMenu('settings'); resetMenuTimer(); }}
                className="absolute -top-8 right-0 text-xs text-gray-400 hover:text-white bg-[#1a1a2e]/80 backdrop-blur-sm px-2 py-1 rounded transition-colors"
              >
                ← Back
              </button>
            )}
            {/* Menu Panel */}
            {renderMenu(activeMenu)}
          </div>

          {/* Fullscreen */}
          <button onClick={toggleFullscreen} className="p-1.5 text-white/80 hover:text-white transition-colors rounded-lg hover:bg-white/10" title="Fullscreen (F)">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              {isFullscreen ? Icons.exitFullscreen : Icons.fullscreen}
            </svg>
          </button>
        </div>
      </div>

      {/* Click catcher for play/pause when controls hidden */}
      {isPlaying && (
        <div
          className="absolute inset-0 cursor-pointer z-5"
          onClick={togglePlay}
          onDoubleClick={() => toggleFullscreen()}
        />
      )}

      {/* ── Keyboard Shortcuts Overlay ── */}
      {showShortcuts && (
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center p-4"
          onClick={() => setShowShortcuts(false)}
        >
          <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-5 sm:p-6 max-w-sm w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Keyboard Shortcuts</h3>
              <button onClick={() => setShowShortcuts(false)} className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">{Icons.close}</svg>
              </button>
            </div>
            <div className="space-y-2">
              {[
                ['Space / K', 'Play / Pause'],
                ['←', 'Rewind 10 seconds'],
                ['→', 'Forward 10 seconds'],
                ['↑', 'Volume up'],
                ['↓', 'Volume down'],
                ['M', 'Toggle mute'],
                ['F', 'Toggle fullscreen'],
                ['P', 'Picture-in-Picture'],
                ['C', 'Cycle subtitles'],
                [', / .', 'Decrease / Increase speed'],
                ['Shift + S', 'Take screenshot'],
                ['?', 'Show shortcuts'],
                ['Esc', 'Close menus'],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between py-1.5">
                  <span className="text-gray-400 text-sm">{desc}</span>
                  <kbd className="bg-white/10 text-white text-xs px-2 py-0.5 rounded font-mono">{key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
