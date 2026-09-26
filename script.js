(() => {
  const C = window.CONTENT;
  const $ = (id) => document.getElementById(id);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- Hearts canvas ----------
  const canvas = $("hearts");
  const ctx = canvas.getContext("2d");
  const hearts = [];
  const colors = ["#f7a1bc", "#e86a92", "#f9c4d4", "#d9b8f0", "#ff8fab"];
  let dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener("resize", resize);
  resize();

  function drawHeart(x, y, size, color, alpha, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(size / 30, size / 30);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.bezierCurveTo(-15, -4, -12, -18, 0, -10);
    ctx.bezierCurveTo(12, -18, 15, -4, 0, 8);
    ctx.fill();
    ctx.restore();
  }

  function ambientHeart(startAnywhere) {
    return {
      x: Math.random() * innerWidth,
      y: startAnywhere ? Math.random() * innerHeight : innerHeight + 20,
      size: 10 + Math.random() * 18,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -(0.3 + Math.random() * 0.6),
      color: colors[(Math.random() * colors.length) | 0],
      alpha: 0.25 + Math.random() * 0.35,
      rot: (Math.random() - 0.5) * 0.6,
      sway: Math.random() * Math.PI * 2,
      ambient: true,
    };
  }

  const ambientCount = innerWidth < 600 ? 14 : 24;
  if (!reduceMotion) for (let i = 0; i < ambientCount; i++) hearts.push(ambientHeart(true));

  function burst() {
    if (reduceMotion) return;
    const cx = innerWidth / 2, cy = innerHeight / 2;
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 3 + Math.random() * 7;
      hearts.push({
        x: cx, y: cy,
        size: 10 + Math.random() * 22,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2,
        color: colors[(Math.random() * colors.length) | 0],
        alpha: 0.9, rot: Math.random() * 6, sway: 0,
        ambient: false, life: 1,
      });
    }
  }

  function tick() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = hearts.length - 1; i >= 0; i--) {
      const h = hearts[i];
      if (h.ambient) {
        h.sway += 0.02;
        h.x += h.vx + Math.sin(h.sway) * 0.3;
        h.y += h.vy;
        if (h.y < -30) hearts[i] = ambientHeart(false);
      } else {
        h.vy += 0.12;
        h.vx *= 0.985;
        h.x += h.vx;
        h.y += h.vy;
        h.life -= 0.008;
        if (h.life <= 0 || h.y > innerHeight + 40) { hearts.splice(i, 1); continue; }
      }
      drawHeart(h.x, h.y, h.size, h.color, h.ambient ? h.alpha : h.alpha * h.life, h.rot);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ---------- Fill in content ----------
  document.querySelectorAll("[data-name]").forEach((el) => (el.textContent = C.name));
  const suffix = (n) => (n % 100 >= 11 && n % 100 <= 13) ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th");
  document.querySelectorAll("[data-age]").forEach((el) => (el.textContent = C.age + suffix(C.age)));
  $("hero-sub").textContent = C.heroSubtitle;
  $("from").textContent = C.from;

  // ---------- Gallery ----------
  const polaroids = $("polaroids");
  C.photos.forEach((p, i) => {
    const btn = document.createElement("button");
    btn.className = "polaroid reveal";
    btn.style.setProperty("--tilt", `${(i % 2 ? 1 : -1) * (2 + Math.random() * 3)}deg`);
    btn.innerHTML = `<div class="ph">💗</div><p></p>`;
    btn.querySelector("p").textContent = p.caption || "";
    const img = new Image();
    img.loading = "lazy";
    img.alt = p.caption || `Photo ${i + 1}`;
    img.onload = () => { const ph = btn.querySelector(".ph"); ph.textContent = ""; ph.appendChild(img); };
    img.src = p.src;
    btn.addEventListener("click", () => {
      if (!img.complete || !img.naturalWidth) return;
      $("lb-img").src = p.src;
      $("lb-img").alt = img.alt;
      $("lb-cap").textContent = p.caption || "";
      $("lightbox").hidden = false;
    });
    polaroids.appendChild(btn);
  });
  const closeLb = () => ($("lightbox").hidden = true);
  $("lightbox").addEventListener("click", (e) => { if (e.target.tagName !== "IMG") closeLb(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape") closeLb(); });

  // ---------- Letter ----------
  const envelope = $("envelope");
  const paper = $("paper");
  const out = $("letter-text");
  const sign = $("letter-sign");
  const paras = C.letter.trim().split(/\n\s*\n/);
  sign.append(C.signOff, document.createElement("br"), C.from);
  let typing = null, opening = null, typed = false;

  function finish() {
    clearInterval(typing);
    typed = true;
    out.innerHTML = "";
    paras.forEach((t) => { const p = document.createElement("p"); p.textContent = t; out.appendChild(p); });
    sign.classList.add("show");
  }

  // Odd taps open the letter, even taps close it.
  envelope.addEventListener("click", () => {
    const hint = $("tap-hint");
    if (envelope.classList.toggle("open")) {
      hint.textContent = "tap to close";
      opening = setTimeout(() => {
        paper.hidden = false;
        if (!typed) typeLetter();
      }, 700);
    } else {
      clearTimeout(opening);
      if (!paper.hidden) finish(); // if it was mid-typing, reopening shows the whole letter
      paper.hidden = true;
      hint.textContent = "tap to open";
    }
  });

  function typeLetter() {
    if (reduceMotion) return finish();

    let pi = 0, ci = 0;
    let p = document.createElement("p");
    const caret = document.createElement("span");
    caret.className = "caret";
    out.appendChild(p);
    p.appendChild(caret);
    typing = setInterval(() => {
      if (pi >= paras.length) { caret.remove(); return finish(); }
      const text = paras[pi];
      caret.before(text[ci]);
      ci++;
      if (ci >= text.length) {
        pi++; ci = 0;
        if (pi < paras.length) { p = document.createElement("p"); out.appendChild(p); p.appendChild(caret); }
      }
    }, 28);
  }
  // Tap the letter to skip the typing
  paper.addEventListener("click", () => { if (!typed) finish(); });

  // ---------- Reasons ----------
  const cards = $("cards");
  C.reasons.forEach((r, i) => {
    const b = document.createElement("button");
    b.className = "card reveal";
    b.setAttribute("aria-label", `Reason ${i + 1}`);
    b.innerHTML = `<div class="card-inner"><div class="card-face card-front"><span>💌</span><b>Reason #${i + 1}</b></div><div class="card-face card-back"></div></div>`;
    b.querySelector(".card-back").textContent = r;
    b.addEventListener("click", () => b.classList.toggle("flipped"));
    cards.appendChild(b);
  });

  // ---------- Scroll reveal ----------
  document.querySelectorAll(".section > h2, .envelope").forEach((el) => el.classList.add("reveal"));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.15 });
  document.querySelectorAll(".reveal").forEach((el, i) => {
    el.style.transitionDelay = `${(i % 4) * 80}ms`;
    io.observe(el);
  });

  // ---------- Show site ----------
  $("site").classList.add("revealed");
  setTimeout(burst, 300);
})();
