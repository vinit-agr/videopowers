// atomize visuals. "#s=3-5" shows only slides 3 to 5 (for chunked screenshots).
// After fonts load, writes a JSON report (overflow, font_ok) into the page for --dump-dom.
(function () {
  const m = location.hash.match(/s=(\d+)-(\d+)/);
  if (m) {
    const a = +m[1], b = +m[2];
    document.querySelectorAll('.slide').forEach((s, i) => { if (i + 1 < a || i + 1 > b) s.style.display = 'none'; });
  }
  async function report() {
    await document.fonts.ready;
    const want = document.body.dataset.font || '';
    const faces = [...document.fonts].filter(f => f.family.replace(/["']/g, '') === want);
    const used = new Set();
    document.querySelectorAll('.slide *').forEach(e => { if ([...e.childNodes].some(c => c.nodeType === 3 && c.textContent.trim())) used.add(String(getComputedStyle(e).fontWeight)); });
    const font_ok = !want || (faces.length > 0 && [...used].every(w => faces.some(f => String(f.weight) === w && f.status === 'loaded')));
    const overflow = [];
    document.querySelectorAll('.slide').forEach((s, i) => {
      const inner = s.querySelector('.inner'); const foot = s.querySelector('.foot');
      if (!inner) return;
      const ib = inner.getBoundingClientRect(); const cs = getComputedStyle(inner);
      const top = ib.top + parseFloat(cs.paddingTop) - 1, bottom = ib.bottom - parseFloat(cs.paddingBottom) + 1;
      const left = ib.left + parseFloat(cs.paddingLeft) - 1, right = ib.right - parseFloat(cs.paddingRight) + 1;
      const fb = foot ? foot.getBoundingClientRect() : null;
      s.querySelectorAll('[data-slot]').forEach(e => {
        const r = e.getBoundingClientRect();
        let why = '';
        const fs = parseFloat(getComputedStyle(e).fontSize) || 16;
        // glyphs of tight line-heights poke out by part of a line; only a bigger spill counts
        if (e.scrollHeight > e.clientHeight + fs * 0.5 || e.scrollWidth > e.clientWidth + 1) why = 'spills its box';
        else if (r.bottom > bottom || r.top < top || r.right > right || r.left < left) why = 'outside the content area';
        else if (fb && r.bottom > fb.top && r.top < fb.bottom && r.right > fb.left && r.left < fb.right) why = 'overlaps the footer';
        if (why) overflow.push(`slide ${i + 1}: ${e.dataset.slot}: ${why}: ${e.textContent.trim().slice(0, 40)}`);
      });
    });
    const el = document.createElement('script');
    el.type = 'application/json'; el.id = 'report';
    el.textContent = JSON.stringify({ overflow, font_ok });
    document.body.appendChild(el);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', report); else report();
})();
