# StreamBox

A modern, responsive movie and TV series streaming web application built with **Next.js 16**, **React 19**, **Tailwind CSS 4**, and **HLS.js**. StreamBox fetches metadata from TMDB, retrieves encrypted streaming sources from multiple Videasy servers, decrypts them via the enc-dec.app API, and plays them in a fully-featured custom video player.

---

## Features

### Streaming
- **Multi-server support** — 6 Videasy servers queried in parallel (CDN, MyFlixer, 1Movies, MovieBox, HDMovie, PrimeSrc)
- **Manual server switching** — dropdown selector (desktop), horizontal tabs (mobile), sidebar summary panel
- **Smart fallback** — "Try Another Server" button when the active server has no sources
- **Auto quality sorting** — sources sorted from highest (4K) to lowest (360p) per server

### Video Player
- **Custom HLS.js player** with adaptive bitrate streaming
- **Settings gear menu** with navigable submenus:
  - **Quality** — switch between all available qualities for the active server
  - **Subtitles** — enable/disable, select from all available languages
  - **Speed** — 0.25x, 0.5x, 0.75x, Normal, 1.25x, 1.5x, 1.75x, 2x
  - **Screenshot** — capture the current frame as a PNG
  - **Keyboard Shortcuts** — full reference overlay
- **Picture-in-Picture (PiP)** mode
- **Progress bar** with buffered indicator and hover time tooltip
- **HLS subtitle track management** with VTT external track fallback
- **Auto-hiding controls** with menu-awareness (controls stay visible while menus are open)
- **Touch-friendly** — fully responsive for mobile and tablet

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` / `K` | Play / Pause |
| `←` | Rewind 10 seconds |
| `→` | Forward 10 seconds |
| `↑` | Volume up |
| `↓` | Volume down |
| `M` | Toggle mute |
| `F` | Toggle fullscreen |
| `P` | Toggle Picture-in-Picture |
| `C` | Cycle subtitles |
| `,` / `.` | Decrease / Increase speed |
| `Shift + S` | Take screenshot |
| `?` | Show keyboard shortcuts |
| `Esc` | Close menus / overlay |

### Content
- **Home page** — trending content hero banner, search with debounce, tabbed browsing (Trending / Movies / TV Shows)
- **Movie pages** — backdrop blur, player with server selector, genres, cast, similar movies
- **TV series pages** — season selector, episode grid with thumbnails, show metadata
- **Episode player** — prev/next navigation, sidebar episode list, server switching

---

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| [Next.js 16](https://nextjs.org/) | React framework (App Router, API Routes) |
| [React 19](https://react.dev/) | UI library |
| [TypeScript 5](https://www.typescriptlang.org/) | Type safety |
| [Tailwind CSS 4](https://tailwindcss.com/) | Utility-first CSS |
| [HLS.js 1.6](https://github.com/video-dev/hls.js/) | Adaptive bitrate HLS streaming |
| [Lucide React](https://lucide.dev/) | Icon library |
| [TMDB API](https://developer.themoviedb.org/) | Movie/TV metadata |
| [Videasy API](https://api.videasy.net/) | Encrypted streaming sources |
| [enc-dec.app](https://enc-dec.app/) | Source decryption |

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── sources/route.ts        # Videasy source fetch + decrypt API
│   │   └── tmdb/route.ts           # TMDB proxy API (search, details, seasons, trending)
│   ├── movie/[id]/page.tsx         # Movie detail + player page
│   ├── tv/[id]/page.tsx            # TV series season/episode browser
│   ├── tv/[id]/[season]/[episode]/page.tsx  # Episode player page
│   ├── page.tsx                    # Home page (search, trending, popular)
│   ├── layout.tsx                  # Root layout
│   └── globals.css                 # Global styles + dark theme
├── components/
│   └── player/
│       └── VideoPlayer.tsx         # Custom HLS video player with full controls
└── lib/
    ├── api.ts                      # TMDB + Videasy API helpers, server config
    ├── db.ts                       # Prisma singleton
    └── utils.ts                    # Utility functions
```

---

## Getting Started

### Prerequisites

- **Node.js 18+** or **Bun**
- A **TMDB API key** — [get one free here](https://www.themoviedb.org/settings/api)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd streambox

# Install dependencies
npm install
# or: bun install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local and add your TMDB API key
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
# Required — Get yours at https://www.themoviedb.org/settings/api
TMDB_API_KEY=your_tmdb_api_key_here
```

### Development

```bash
npm run dev
# or: bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Deployment

### Vercel (Recommended)

1. Push your code to a Git repository (GitHub, GitLab, Bitbucket)
2. Import the project on [vercel.com](https://vercel.com)
3. Add the `TMDB_API_KEY` environment variable in Vercel's project settings
4. Deploy — Vercel handles the rest automatically

No additional configuration needed. The app uses the App Router with API routes, which are fully supported by Vercel's serverless functions.

### VPS / Self-Hosted

```bash
# Build
npm run build

# Start production server
npm run start
# The app runs on port 3000
```

For production, use a reverse proxy (nginx, Caddy) with SSL:

```nginx
# Example nginx config
server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Docker (Optional)

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
ENV NODE_ENV=production
ENV TMDB_API_KEY=""
CMD ["node", "server.js"]
```

```bash
docker build -t streambox .
docker run -p 3000:3000 -e TMDB_API_KEY=your_key streambox
```

---

## API Routes

### `GET /api/tmdb`

TMDB proxy — proxies all TMDB requests server-side to keep the API key secure.

| Parameter | Description |
|-----------|-------------|
| `action=search` | Search movies & TV shows (`q`, `page`) |
| `action=movie` | Movie details + credits + similar (`id`) |
| `action=tv` | TV show details + credits + similar (`id`) |
| `action=tv-season` | Season episodes (`id`, `season`) |
| `action=trending` | Trending content (`type`, `time`, `page`) |
| `action=popular-movies` | Popular movies (`page`) |
| `action=popular-tv` | Popular TV shows (`page`) |

### `GET /api/sources`

Fetches encrypted sources from all Videasy servers in parallel, decrypts them, and returns per-server results.

| Parameter | Description |
|-----------|-------------|
| `title` | Movie/TV show title (URL-encoded) |
| `mediaType` | `movie` or `tv` |
| `year` | Release year |
| `tmdbId` | TMDB ID |
| `imdbId` | IMDb ID (optional) |
| `season` | Season number (TV only) |
| `episode` | Episode number (TV only) |

**Response:**
```json
{
  "servers": [
    {
      "serverId": "cdn",
      "serverName": "CDN Server",
      "sources": [
        { "quality": "1080p", "url": "https://..." },
        { "quality": "720p", "url": "https://..." }
      ],
      "subtitles": [
        { "lang": "en", "language": "English", "url": "https://..." }
      ]
    }
  ]
}
```

### `GET /api/stream/movie/[id]`

Simple streaming API — returns a ready-to-play HLS URL for a movie. Auto-fetches TMDB metadata, tries all servers, returns the best source.

| Parameter | Location | Description |
|-----------|----------|-------------|
| `id` | URL path | TMDB movie ID |
| `server` | Query param | Prefer a specific server ID (e.g. `cdn`, `myflixerzupcloud`) |
| `quality` | Query param | Prefer a specific quality (e.g. `1080p`, `720p`) |

**Example:** `GET /api/stream/movie/550?quality=1080p`

**Response:**
```json
{
  "tmdbId": "550",
  "imdbId": "tt0137523",
  "title": "Fight Club",
  "year": "1999",
  "type": "movie",
  "server": { "id": "cdn", "name": "CDN Server" },
  "source": { "quality": "1080p", "url": "https://...m3u8" },
  "sources": [
    { "quality": "1080p", "url": "https://..." },
    { "quality": "720p", "url": "https://..." }
  ],
  "subtitles": [
    { "lang": "en", "language": "English", "url": "https://..." }
  ],
  "embedUrl": "/embed/movie/550"
}
```

### `GET /api/stream/tv/[id]/[season]/[episode]`

Same as above but for TV series episodes.

| Parameter | Location | Description |
|-----------|----------|-------------|
| `id` | URL path | TMDB show ID |
| `season` | URL path | Season number |
| `episode` | URL path | Episode number |
| `server` | Query param | Prefer a specific server ID |
| `quality` | Query param | Prefer a specific quality |

**Example:** `GET /api/stream/tv/1396/1/1?server=myflixerzupcloud`

**Response:** Same format as movie, plus `season`, `episode`, `episodeName` fields.

> Both stream API endpoints support CORS (`Access-Control-Allow-Origin: *`) so you can fetch them from any frontend.

---

## Embedding

Use the embed pages to embed the player in any external site via iframe. Embed pages are minimal — just the player and server selector, no extra UI.

### Movie Embed

```html
<iframe
  src="https://yourdomain.com/embed/movie/550"
  width="100%"
  height="500"
  style="border:none; max-width:1280px;"
  allowfullscreen
  allow="autoplay; fullscreen; picture-in-picture"
></iframe>
```

### TV Episode Embed

```html
<iframe
  src="https://yourdomain.com/embed/tv/1396/1/1"
  width="100%"
  height="500"
  style="border:none; max-width:1280px;"
  allowfullscreen
  allow="autoplay; fullscreen; picture-in-picture"
></iframe>
```

### JavaScript Integration

Fetch streaming URLs from your own frontend:

```javascript
// Get movie stream
const res = await fetch('https://yourdomain.com/api/stream/movie/550');
const data = await res.json();

console.log(data.source.url);       // Best HLS source URL
console.log(data.sources);           // All qualities
console.log(data.subtitles);         // Available subtitles

// Use with any HLS player
// hls.loadSource(data.source.url);

// Get TV episode stream
const ep = await fetch('https://yourdomain.com/api/stream/tv/1396/1/1');
const epData = await ep.json();
console.log(epData.source.url);
```

---

## URL Structure

| Route | Description |
|-------|-------------|
| `/` | Home page — search, trending, popular content |
| `/movie/[tmdbId]` | Movie player with server selector |
| `/tv/[tmdbId]` | TV series browser — seasons and episodes |
| `/tv/[tmdbId]/[season]/[episode]` | Episode player with server selector |
| `/embed/movie/[tmdbId]` | **Minimal embed player** for iframe |
| `/embed/tv/[tmdbId]/[season]/[episode]` | **Minimal embed player** for iframe |
| `/api/stream/movie/[id]` | **Streaming API** — returns HLS URL |
| `/api/stream/tv/[id]/[season]/[episode]` | **Streaming API** — returns HLS URL |

---

## Streaming Servers

| Server | ID | Movies | TV |
|--------|----|--------|-----|
| CDN | `cdn` | Yes | No |
| MyFlixer | `myflixerzupcloud` | Yes | Yes |
| 1Movies | `1movies` | Yes | Yes |
| MovieBox | `moviebox` | Yes | Yes |
| HDMovie | `hdmovie` | Yes | Yes |
| PrimeSrc | `primesrcme` | Yes | Yes |

All servers are queried in parallel. Users can manually switch between servers using the selector.

---

## License

This project is for educational and personal use only. Streaming sources are fetched from third-party APIs.
