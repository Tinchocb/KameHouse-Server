import { createFileRoute } from '@tanstack/react-router';
import { AppErrorBoundary } from '@/components/shared/app-error-boundary';

interface ChronologySearchParams {
  era?: string;
  highlight?: string;
}

export const Route = createFileRoute('/chronology/')({
  validateSearch: (search: Record<string, unknown>): ChronologySearchParams => ({
    era: typeof search.era === 'string' ? search.era : undefined,
    highlight: typeof search.highlight === 'string' ? search.highlight : undefined,
  }),
  errorComponent: AppErrorBoundary,
});
