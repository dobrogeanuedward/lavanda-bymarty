const REVEALS = '.cover-copy,.cover-art,.section-heading,.article-card,.fanzine-copy,.atlas-panel>div,.about-split .prose,.footer-masthead,.footer-note,.footer-sign,.page-intro h1,.reading-end';

export function initWorld() {
  if (typeof document === 'undefined' || document.documentElement.dataset.worldReady) return;
  document.documentElement.dataset.worldReady = 'true';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = matchMedia('(max-width: 720px)');
  const seen = new WeakSet(), decorated = new WeakSet(), active = new Set();
  let frame = 0;

  const revealObserver = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); revealObserver.unobserve(entry.target); } });
  }, { threshold: .08, rootMargin: '0px 0px -25px 0px' }) : null;

  function updateParallax() {
    frame = 0;
    if (document.hidden || reduce.matches) return;
    const height = innerHeight || 800;
    active.forEach(element => {
      const bounds = element.getBoundingClientRect();
      const depth = Number(element.dataset.worldDepth) || .055;
      const limit = narrow.matches ? 12 : 46;
      const shift = Math.max(-limit, Math.min(limit, (height / 2 - bounds.top - bounds.height / 2) * depth * (narrow.matches ? .35 : 1)));
      element.style.setProperty('--world-y', `${Math.round(shift * 10) / 10}px`);
    });
  }
  function queueParallax() { if (!frame && !reduce.matches && active.size && !document.hidden) frame = requestAnimationFrame(updateParallax); }
  const parallaxObserver = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      entry.target.dataset.worldVisible = String(entry.isIntersecting);
      if (entry.isIntersecting) active.add(entry.target); else active.delete(entry.target);
    });
    queueParallax();
  }, { rootMargin: '120px 0px' }) : null;

  function discover() {
    document.querySelectorAll(REVEALS).forEach(element => {
      if (seen.has(element)) return;
      seen.add(element);
      element.dataset.worldReveal = '';
      if (reduce.matches || !revealObserver) element.classList.add('is-visible');
      else revealObserver.observe(element);
    });
    document.querySelectorAll('.world-parallax').forEach(element => {
      if (decorated.has(element)) return;
      decorated.add(element);
      // All moving artwork is decorative and never becomes an input target.
      element.setAttribute('aria-hidden', 'true');
      if (parallaxObserver) parallaxObserver.observe(element);
    });
  }
  function motionPreference() {
    document.documentElement.dataset.motion = reduce.matches ? 'off' : 'on';
    if (reduce.matches) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      document.querySelectorAll('[data-world-reveal]').forEach(element => element.classList.add('is-visible'));
      document.querySelectorAll('.world-parallax').forEach(element => element.style.removeProperty('--world-y'));
    } else queueParallax();
  }
  discover();
  motionPreference();
  addEventListener('scroll', queueParallax, { passive: true });
  addEventListener('resize', queueParallax, { passive: true });
  document.addEventListener('visibilitychange', queueParallax);
  document.addEventListener('lavanda-brand-changed', queueParallax);
  reduce.addEventListener?.('change', motionPreference);
  if (typeof MutationObserver === 'function') new MutationObserver(discover).observe(document.querySelector('#contenuto') || document.body, { childList: true, subtree: true });
}
