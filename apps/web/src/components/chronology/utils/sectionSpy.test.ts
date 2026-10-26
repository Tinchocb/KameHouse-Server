import { describe, expect, it } from 'vitest';
import { pickActiveSection } from './sectionSpy';

describe('pickActiveSection', () => {
  const ids = ['era-section-classic', 'era-section-z', 'era-section-daima'];
  const line = 250;

  it('devuelve undefined cuando no hay secciones', () => {
    expect(pickActiveSection([], [], line, false)).toBeUndefined();
  });

  it('devuelve undefined cuando atTop es true', () => {
    expect(pickActiveSection(ids, [100, 500, 900], line, false, true)).toBeUndefined();
  });

  it('devuelve undefined cuando ninguna sección ha alcanzado la línea de referencia (scroll al inicio)', () => {
    // La primera sección está en top 350px, por debajo de la línea 250px (usuario viendo la cabecera)
    expect(pickActiveSection(ids, [350, 800, 1200], line, false, false)).toBeUndefined();
  });

  it('devuelve la primera sección cuando su tope pasa la línea', () => {
    expect(pickActiveSection(ids, [200, 600, 1000], line, false, false)).toBe('era-section-classic');
  });

  it('devuelve la segunda sección cuando pasa la línea', () => {
    expect(pickActiveSection(ids, [-100, 150, 700], line, false, false)).toBe('era-section-z');
  });

  it('devuelve la última sección cuando atBottom es true', () => {
    expect(pickActiveSection(ids, [-500, -200, 300], line, true, false)).toBe('era-section-daima');
  });
});
