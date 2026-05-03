/**
 * mindmap.js  —  Shared runtime for all CampusX mind map pages
 * v2: + initFlowCycle() — sequential auto-highlight of flow steps
 *
 * Exports / initialises:
 *   MindMap.initParticles(tokens, hues?)  — floating token canvas
 *   MindMap.initCounters()                — auto-count all [data-count] KPIs
 *   MindMap.initScrollReveal()            — IntersectionObserver card entrance
 *   MindMap.initRipple()                  — click-ripple on .mm-kpi + .mm-card
 *   MindMap.initParallax()                — aurora blob parallax on scroll
 *   MindMap.initColorShift(maxDeg?)       — hue-rotate page on scroll
 *   MindMap.initFlowCycle(interval?)      — auto-cycle .mm-step-active highlight
 *   MindMap.init(tokens, hues?, maxDeg?)  — call all of the above at once
 */

const MindMap = (() => {

  /* ─────────────────────────────────────────
     1. FLOATING TOKEN PARTICLES  (canvas)
     tokens : string[]  — domain-specific labels
     hues   : number[]  — HSL hue values, default multi-colour
  ───────────────────────────────────────── */
  function initParticles(tokens = ['AI', '→', '[]', 'ctx', '//'], hues = [22, 38, 165, 210, 270]) {
    const canvas = document.getElementById('mm-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const particles = [];

    function resize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    for (let i = 0; i < 20; i++) {
      particles.push({
        x:   Math.random() * window.innerWidth,
        y:   Math.random() * window.innerHeight + window.innerHeight,
        vx:  (Math.random() - .5) * .35,
        vy:  -(Math.random() * .55 + .25),
        a:   Math.random() * .2 + .06,
        txt: tokens[Math.floor(Math.random() * tokens.length)],
        sz:  Math.random() * 3 + 9,
        hue: hues[Math.floor(Math.random() * hues.length)],
      });
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -30) {
          p.y = canvas.height + 20;
          p.x = Math.random() * canvas.width;
        }
        ctx.save();
        ctx.font = `500 ${p.sz}px 'JetBrains Mono', monospace`;
        ctx.fillStyle = `hsla(${p.hue},58%,40%,${p.a})`;
        ctx.fillText(p.txt, p.x, p.y);
        ctx.restore();
      });
      requestAnimationFrame(draw);
    }
    draw();
  }

  /* ─────────────────────────────────────────
     2. COUNTER  — animates [data-count] KPIs
     Usage:  <span class="mm-kpi-val" data-count="42">0</span>
     Special: data-count="skip"  → leave text as-is (e.g. "skill.md")
  ───────────────────────────────────────── */
  function initCounters() {
    document.querySelectorAll('[data-count]').forEach((el, i) => {
      const raw = el.dataset.count;
      if (raw === 'skip') return;         // static label — don't animate
      const target = parseFloat(raw);
      if (isNaN(target)) return;

      setTimeout(() => {
        const start = performance.now();
        const dur   = 1100;
        (function step(now) {
          const t = Math.min((now - start) / dur, 1);
          const e = 1 - Math.pow(1 - t, 3);           // ease-out-cubic
          el.textContent = el.dataset.suffix
            ? Math.round(e * target) + el.dataset.suffix
            : Math.round(e * target);
          if (t < 1) requestAnimationFrame(step);
        })(performance.now());
      }, 200 + i * 120);
    });
  }

  /* ─────────────────────────────────────────
     3. SCROLL REVEAL  (IntersectionObserver)
     Adds .mm-visible to .mm-card when in view.
     Odd cards slide from left, even from right
     (defined in base.css).
  ───────────────────────────────────────── */
  function initScrollReveal() {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          entry.target.style.animationDelay = (i * 0.07) + 's';
          entry.target.classList.add('mm-visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.mm-card').forEach(c => obs.observe(c));
  }

  /* ─────────────────────────────────────────
     4. CLICK RIPPLE
     Injects .mm-ripple div on click for any
     element with data-ripple or .mm-kpi / .mm-card
  ───────────────────────────────────────── */
  function initRipple() {
    const targets = document.querySelectorAll('.mm-kpi, .mm-card, [data-ripple]');
    targets.forEach(el => {
      el.addEventListener('click', (e) => {
        const rect  = el.getBoundingClientRect();
        const ring  = document.createElement('div');
        ring.className = 'mm-ripple';
        ring.style.left = (e.clientX - rect.left)  + 'px';
        ring.style.top  = (e.clientY - rect.top)   + 'px';
        // Tint ripple to match card accent if set
        const accent = getComputedStyle(el).getPropertyValue('--c-accent').trim();
        if (accent) ring.style.background = accent.replace(')', ', .25)').replace('rgb', 'rgba') || ring.style.background;
        el.appendChild(ring);
        ring.addEventListener('animationend', () => ring.remove());
      });
    });
  }

  /* ─────────────────────────────────────────
     5. PARALLAX AURORA
     Moves each .aurora-blob at a different
     scroll rate — pure translateY, no mouse.
  ───────────────────────────────────────── */
  function initParallax() {
    const rates  = [0.10, -0.07, 0.05];  // multipliers per blob
    const blobs  = document.querySelectorAll('.aurora-blob');
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      blobs.forEach((b, i) => {
        b.style.transform = `translateY(${y * (rates[i] ?? 0.05)}px)`;
      });
    }, { passive: true });
  }

  /* ─────────────────────────────────────────
     6. SCROLL COLOR SHIFT
     Slightly hue-rotates the whole page as the
     user scrolls — subtle warmth transition.
  ───────────────────────────────────────── */
  function initColorShift(maxDeg = 16) {
    window.addEventListener('scroll', () => {
      const scrolled = window.scrollY;
      const total    = document.body.scrollHeight - window.innerHeight;
      const progress = total > 0 ? scrolled / total : 0;
      document.documentElement.style.filter = `hue-rotate(${progress * maxDeg}deg)`;
    }, { passive: true });
  }

  /* ─────────────────────────────────────────
     7. FLOW CYCLE  (v2 — new)
     Sequentially highlights each .mm-step in
     every .mm-flow on the page, one at a time,
     cycling continuously. Adds/removes the
     .mm-step-active class (styled in base.css).
     interval : ms between step advances (default 1200)
  ───────────────────────────────────────── */
  function initFlowCycle(interval = 1200) {
    document.querySelectorAll('.mm-flow').forEach(flow => {
      const steps = Array.from(flow.querySelectorAll('.mm-step'));
      if (steps.length < 2) return;

      let current = 0;

      // Kick off first highlight immediately
      steps[0].classList.add('mm-step-active');

      setInterval(() => {
        steps.forEach(s => s.classList.remove('mm-step-active'));
        steps[current].classList.add('mm-step-active');
        current = (current + 1) % steps.length;
      }, interval);
    });
  }

  /* ─────────────────────────────────────────
     8. INIT ALL  — convenience entry point
  ───────────────────────────────────────── */
  function init(tokens, hues, maxDeg) {
    window.addEventListener('load', () => {
      initParticles(tokens, hues);
      initCounters();
      initScrollReveal();
      initRipple();
      initParallax();
      initColorShift(maxDeg);
      initFlowCycle();
    });
  }

  /* Public API */
  return { init, initParticles, initCounters, initScrollReveal, initRipple, initParallax, initColorShift, initFlowCycle };

})();
