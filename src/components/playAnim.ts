/** How long `data-play` stays on: longer than any one-shot animation in styles.css. */
const PLAY_MS = 300;

const playing = new WeakMap<HTMLElement, number>();

/**
 * Plays a one-shot animation: the `[data-play='<name>']` rules in styles.css, restarted if it is
 * already running. Nothing at all under reduced motion. The attribute comes off afterwards, so
 * the element coming back from `display: none` doesn't play it again.
 */
export function playAnim(el: HTMLElement, name: string) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (el.dataset.play) {
    delete el.dataset.play;
    void el.offsetWidth;
  }
  el.dataset.play = name;
  clearTimeout(playing.get(el));
  playing.set(
    el,
    window.setTimeout(() => delete el.dataset.play, PLAY_MS),
  );
}
