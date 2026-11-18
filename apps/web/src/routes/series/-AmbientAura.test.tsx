import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LazyMotion, domAnimation } from 'framer-motion';
import { AmbientAura } from './-AmbientAura';

describe('AmbientAura', () => {
    it('renderiza la imagen de aura con opacidad según allowGlowFx', () => {
        const { rerender } = render(
            <LazyMotion features={domAnimation}>
                <AmbientAura
                    src="https://example.com/dbz.webp"
                    accent="var(--spotlight-dbz-vivid)"
                    seriesKey="1"
                    allowGlowFx={true}
                />
            </LazyMotion>
        );

        const img = screen.getByRole('presentation', { hidden: true });
        expect(img).toHaveAttribute('src', 'https://example.com/dbz.webp');
        expect(img).toHaveStyle({ opacity: '0.28' });

        rerender(
            <LazyMotion features={domAnimation}>
                <AmbientAura
                    src="https://example.com/dbz.webp"
                    accent="var(--spotlight-dbz-vivid)"
                    seriesKey="1"
                    allowGlowFx={false}
                />
            </LazyMotion>
        );

        expect(img).toHaveStyle({ opacity: '0.18' });
    });

    it('renderiza el acento de la era en sincronía con la serie', () => {
        render(
            <LazyMotion features={domAnimation}>
                <AmbientAura
                    src={null}
                    accent="#ff6600"
                    seriesKey="2"
                    allowGlowFx={true}
                />
            </LazyMotion>
        );

        const accentEl = screen.getByTestId('aura-accent');
        expect(accentEl).toBeInTheDocument();
        expect(accentEl).toHaveAttribute('aria-hidden', 'true');
    });
});
