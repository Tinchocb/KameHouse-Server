import type { TimelineSpan, TimelineSeries } from "./types";

export function getSeriesFromSpans(spans: TimelineSpan[]): TimelineSeries[] {
  const map = new Map<string, TimelineSeries>();
  for (const span of spans) {
    if (!map.has(span.seriesId)) {
      map.set(span.seriesId, {
        id: span.seriesId,
        tmdbId: span.tmdbId,
        title: span.seriesTitle,
        totalEpisodes: 0,
        spansCount: 0,
        canon: span.canon,
        inUniverseStartYear: 0,
        inUniverseEndYear: 0,
        dominantVibe: span.dominantVibe,
        key: span.seriesId,
        label: span.seriesTitle,
      });
    }
    const series = map.get(span.seriesId)!;
    series.spansCount += 1;
    series.totalEpisodes += Math.max(1, span.endEpisode - span.startEpisode + 1);
  }
  return Array.from(map.values());
}
