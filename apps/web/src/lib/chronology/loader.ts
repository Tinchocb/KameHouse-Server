import type { TimelineSpan, TimelineSeries } from "./types";
import { getSeriesFromSpans } from "./helpers";

const CHRONOLOGY_URL = "/data/cronologia_lapsos_dragonball.json";

let cachedSpans: TimelineSpan[] | null = null;
let cachedSeries: TimelineSeries[] | null = null;

export async function loadChronology(): Promise<TimelineSpan[]> {
  if (cachedSpans) return cachedSpans;

  const res = await fetch(CHRONOLOGY_URL);
  if (!res.ok) throw new Error("Failed to load chronology data");

  const data: any = await res.json();
  cachedSpans = data.spans as TimelineSpan[];
  return cachedSpans;
}

export async function getSpansBySeries(seriesId: string): Promise<TimelineSpan[]> {
  const spans = await loadChronology();
  return spans.filter((s) => s.seriesId === seriesId);
}

export async function getSeriesList(): Promise<TimelineSeries[]> {
  if (cachedSeries) return cachedSeries;

  const spans = await loadChronology();
  cachedSeries = getSeriesFromSpans(spans);
  return cachedSeries ?? [];
}