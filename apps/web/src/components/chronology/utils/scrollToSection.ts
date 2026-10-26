/**
 * Lleva la vista al comienzo de una sección. La altura del contenido cambia mientras el scroll suave
 * está en curso (tarjetas que se montan), así que un salto largo podía quedar cientos de px antes de
 * la sección: al terminar se verifica la posición y se corrige (hasta 3 veces).
 */
export function scrollToSection(domId: string, smooth: boolean): void {
  const el = document.getElementById(domId);
  if (!el) return;

  let scroller: HTMLElement | null = el.parentElement;
  while (scroller && scroller.scrollHeight <= scroller.clientHeight) scroller = scroller.parentElement;

  if (scroller) {
    const scrollerRect = scroller.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const computed = window.getComputedStyle(el);
    const scrollMarginTop = parseFloat(computed.scrollMarginTop) || 0;
    const targetScrollTop = scroller.scrollTop + (elRect.top - scrollerRect.top) - scrollMarginTop;
    scroller.scrollTo({
      top: Math.max(0, targetScrollTop),
      behavior: smooth ? 'smooth' : 'auto',
    });
  } else {
    el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  }
}
