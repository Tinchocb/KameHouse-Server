import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { SmartLoreText } from './smart-lore-text';

describe('SmartLoreText', () => {
  it('renders normal text with zero replacements if no lore keywords match', () => {
    const { container } = render(<SmartLoreText text="Un día pacífico en Kame House con el Maestro Roshi." />);
    expect(container.textContent).toBe('Un día pacífico en Kame House con el Maestro Roshi.');
    expect(container.querySelector('button')).toBeNull();
  });

  it('detects and wraps canonical techniques like Mafuba and Zenkai', () => {
    const { container } = render(
      <SmartLoreText text="Mutaito empleó el Mafūba y los saiyajin aumentaron su poder con el Zenkai." />
    );
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(2);
    expect(buttons[0]?.textContent).toContain('Mafūba');
    expect(buttons[1]?.textContent).toContain('Zenkai');
  });

  it('does not wrap words that are not in the glossary', () => {
    const { container } = render(
      <SmartLoreText text="Los hombres-bestia consumieron Animorphina antes de la era de Z." />
    );
    expect(container.querySelector('button')).toBeNull();
  });

  it('detects canonical artifacts like Semillas del Ermitaño', () => {
    const { container } = render(
      <SmartLoreText text="Karin entregó las Semillas del Ermitaño para recuperar el ki." />
    );
    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    expect(button?.textContent).toContain('Semillas del Ermitaño');
  });
});
