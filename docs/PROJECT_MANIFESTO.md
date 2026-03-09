# Antigravity Manifesto: The Hybrid Architecture

## 1. The Priority Protocol (Source Hierarchy)
- **P0 (LOCAL):** Matches in the local SQLite DB take absolute precedence. Default choice for playback.
- **P1 (DEBRID):** If not local, use cached Debrid links for instant cloud streaming.
- **P2 (TORRENT):** P2P streams are the final fallback.

## 2. Visual Identity Tokens
- **Palette:** Zinc-950 background (`#09090b`).
- **Effects:** Glassmorphism (`backdrop-blur-xl`, `border-white/10`).
- **UI Patterns:** Hero Banners (Seanime style), horizontal Swimlanes (Plex style).

## 3. Data Integrity Rules
- **IDs:** Always bridge AniList/TMDB IDs to IMDB IDs for external provider compatibility.
- **Categorization:** Strict split between "Series" (episodic) and "Movies" (standalone).

## 4. AI Behavioral Guardrails
- **Data Safety:** Never suggest destructive actions on local library files.
- **Performance:** Prioritize performance: Metadata resolution must be concurrent and non-blocking.
