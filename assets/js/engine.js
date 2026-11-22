/* =====================================================================
   Procedural background engine (Canvas2D)
   Shared by the Background Engine editor and the GIF converter.
   Every effect is a pure function of (time, options) so it can be
   rendered live with rAF *and* frame-by-frame for GIF export.
   ===================================================================== */
(function () {
  const TAU = Math.PI * 2;

  const hexRgb = hex => {
    let h = String(hex || '#000').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const rgba = (hex, a) => { const c = hexRgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
  const lerp = (a, b, t) => a + (b - a) * t;

  const DEFAULTS = {
    effect: 'aurora',
    colors: ['#ff8a3d', '#ff4d94', '#6b5bff', '#22d3ee'],
    bg: '#0a0a12',
    speed: 1,
    complexity: 5,
    scale: 1,
    glow: 0.55,
    angle: 45,
    grain: 0.05
  };

  const EFFECTS = {
    aurora: 'Aurora',
    waves: 'Waves',
    particles: 'Particles',
    plasma: 'Plasma',
    tunnel: 'Tunnel',
    mesh: 'Mesh'
  };

  const PALETTES = [
    ['#ff8a3d', '#ff4d94', '#6b5bff', '#22d3ee'],
    ['#ffd166', '#ff7b54', '#ef476f', '#b5179e'],
    ['#00f5d4', '#00bbf9', '#4c6ef5', '#9b5de5'],
    ['#f72585', '#b5179e', '#7209b7', '#3a0ca3'],
    ['#f8f9fa', '#adb5bd', '#6c757d', '#343a40'],
    ['#80ed99', '#57cc99', '#38a3a5', '#22577a'],
    ['#ffb703', '#fb8500', '#e63946', '#6a040f'],
    ['#06d6a0', '#118ab2', '#073b4c', '#ef476f']
  ];

  /* ---------- grain pattern (built once) ---------- */
  let grainCanvas = null;
  function grainPattern(ctx) {
    if (!grainCanvas) {
      grainCanvas = document.createElement('canvas');
      grainCanvas.width = grainCanvas.height = 128;
      const g = grainCanvas.getContext('2d');
      const img = g.createImageData(128, 128);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 120 + Math.random() * 135;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    }
    return ctx.createPattern(grainCanvas, 'repeat');
  }

  /* =====================================================================
     effects — each paints the full frame for time t (seconds)
     ===================================================================== */

  function paintAurora(ctx, w, h, t, o) {
    ctx.fillStyle = o.bg; ctx.fillRect(0, 0, w, h);
    const n = Math.max(3, Math.round(o.complexity));
    const R = Math.max(w, h) * 0.75 * o.scale;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const ph = i * 1.9;
      const x = w * (0.5 + 0.46 * Math.sin(t * o.speed * 0.55 + ph));
      const y = h * (0.5 + 0.42 * Math.cos(t * o.speed * 0.47 + ph * 1.3));
      const r = R * (0.42 + 0.22 * Math.sin(t * o.speed * 0.8 + ph));
      const c = o.colors[i % o.colors.length];
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(c, 0.62 * (0.45 + o.glow)));
      g.addColorStop(0.45, rgba(c, 0.20 * (0.45 + o.glow)));
      g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function paintWaves(ctx, w, h, t, o) {
    const base = ctx.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, rgba(o.colors[o.colors.length - 1], 0.20));
    base.addColorStop(1, o.bg);
    ctx.fillStyle = o.bg; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);

    const layers = Math.max(3, Math.round(o.complexity));
    const amp = h * 0.09 * o.scale;
    for (let L = 0; L < layers; L++) {
      const k = L / Math.max(1, layers - 1);
      const yBase = h * lerp(0.42, 1.06, k);
      const freq = TAU / (w * lerp(0.85, 0.42, k));
      const spd = o.speed * lerp(0.55, 1.25, k);
      const c = o.colors[L % o.colors.length];
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += Math.max(4, w / 160)) {
        const y = yBase
          + Math.sin(x * freq + t * spd * 1.6 + L) * amp
          + Math.sin(x * freq * 2.3 - t * spd) * amp * 0.42;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h); ctx.closePath();
      const g = ctx.createLinearGradient(0, yBase - amp * 2, 0, h);
      g.addColorStop(0, rgba(c, 0.55 * (0.5 + o.glow)));
      g.addColorStop(1, rgba(c, 0.06));
      ctx.fillStyle = g;
      ctx.fill();
    }
  }

  function paintParticles(ctx, w, h, t, o) {
    const g0 = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    g0.addColorStop(0, rgba(o.colors[2] || o.colors[0], 0.20));
    g0.addColorStop(1, o.bg);
    ctx.fillStyle = o.bg; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = g0; ctx.fillRect(0, 0, w, h);

    const count = Math.max(28, Math.round(o.complexity * 26));
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < count; i++) {
      const seed = i * 12.9898;
      const sx = ((Math.sin(seed) * 43758.5453) % 1 + 1) % 1;
      const sy = ((Math.sin(seed * 1.7) * 24634.6345) % 1 + 1) % 1;
      const drift = (t * o.speed * (0.02 + (i % 7) * 0.006));
      const x = ((sx + drift) % 1) * w;
      const y = ((sy + Math.sin(t * o.speed * 0.5 + i) * 0.04 + 1) % 1) * h;
      const r = (0.8 + (i % 5) * 0.85) * o.scale * 1.6;
      const c = o.colors[i % o.colors.length];
      const tw = 0.45 + 0.55 * Math.abs(Math.sin(t * o.speed * 1.5 + i));
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4.5);
      g.addColorStop(0, rgba(c, 0.85 * tw));
      g.addColorStop(0.25, rgba(c, 0.30 * tw));
      g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r * 4.5, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function paintPlasma(ctx, w, h, t, o) {
    const sw = Math.max(48, Math.round(w / 8));
    const sh = Math.max(27, Math.round(h / 8));
    if (!paintPlasma.buf || paintPlasma.buf.width !== sw) {
      paintPlasma.buf = document.createElement('canvas');
      paintPlasma.buf.width = sw; paintPlasma.buf.height = sh;
      paintPlasma.ctx = paintPlasma.buf.getContext('2d');
      paintPlasma.img = paintPlasma.ctx.createImageData(sw, sh);
    }
    const img = paintPlasma.img, d = img.data;
    const col = o.colors.map(hexRgb);
    const sp = o.speed * 1.1, sc = o.scale * 0.06;
    let p = 0;
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const v = Math.sin(x * sc + t * sp)
          + Math.sin(y * sc * 1.3 - t * sp * 0.8)
          + Math.sin((x + y) * sc * 0.7 + t * sp * 0.6)
          + Math.sin(Math.hypot(x - sw / 2, y - sh / 2) * sc * 1.4 - t * sp);
        const n = (v + 4) / 8;                       // 0..1
        const f = n * (col.length - 1);
        const i0 = Math.floor(f), i1 = Math.min(col.length - 1, i0 + 1), ft = f - i0;
        d[p++] = lerp(col[i0][0], col[i1][0], ft);
        d[p++] = lerp(col[i0][1], col[i1][1], ft);
        d[p++] = lerp(col[i0][2], col[i1][2], ft);
        d[p++] = 255;
      }
    }
    paintPlasma.ctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(paintPlasma.buf, 0, 0, w, h);
    if (o.glow > 0.05) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.25 * o.glow;
      ctx.drawImage(paintPlasma.buf, 0, 0, w, h);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  function paintTunnel(ctx, w, h, t, o) {
    ctx.fillStyle = o.bg; ctx.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const rings = Math.max(6, Math.round(o.complexity * 2.2));
    ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.012 * o.scale);
    for (let i = rings - 1; i >= 0; i--) {
      const k = i / rings;
      const p = ((k + t * o.speed * 0.16) % 1);
      const ww = w * (0.06 + p * 1.5), hh = h * (0.06 + p * 1.5);
      const c = o.colors[i % o.colors.length];
      ctx.strokeStyle = rgba(c, 0.30 + 0.55 * p * (0.5 + o.glow));
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cx - ww / 2, cy - hh / 2, ww, hh, Math.min(ww, hh) * 0.10);
      else ctx.rect(cx - ww / 2, cy - hh / 2, ww, hh);
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.55);
    g.addColorStop(0, rgba(o.colors[0], 0.55));
    g.addColorStop(1, rgba(o.bg, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, Math.max(w, h) * 0.55, 0, TAU); ctx.fill();
  }

  function paintMesh(ctx, w, h, t, o) {
    const a = (o.angle * Math.PI) / 180 + t * o.speed * 0.10;
    const cx = w / 2, cy = h / 2;
    const R = Math.hypot(w, h);
    ctx.fillStyle = o.bg; ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    const bands = Math.max(3, Math.round(o.complexity) + 1);
    for (let i = 0; i < bands; i++) {
      const k = i / bands;
      const c = o.colors[i % o.colors.length];
      const g = ctx.createLinearGradient(-R / 2, -R, R / 2, R);
      g.addColorStop(0, rgba(c, 0.9 * (0.35 + o.glow)));
      g.addColorStop(1, rgba(o.colors[(i + 1) % o.colors.length], 0.25));
      ctx.fillStyle = g;
      const off = -R + (i * R * 2) / bands + Math.sin(t * o.speed + i) * R * 0.06 * o.scale;
      ctx.fillRect(off, -R, (R * 2) / bands, R * 2);
    }
    ctx.restore();
    const veil = ctx.createRadialGradient(cx, cy, R * 0.08, cx, cy, R * 0.60);
    veil.addColorStop(0, rgba(o.bg, 0.72));
    veil.addColorStop(1, rgba(o.bg, 0));
    ctx.fillStyle = veil; ctx.fillRect(0, 0, w, h);
  }

  const PAINTERS = { aurora: paintAurora, waves: paintWaves, particles: paintParticles, plasma: paintPlasma, tunnel: paintTunnel, mesh: paintMesh };

  function draw(ctx, w, h, t, opts) {
    const o = Object.assign({}, DEFAULTS, opts);
    const paint = PAINTERS[o.effect] || paintAurora;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    paint(ctx, w, h, t, o);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    if (o.grain > 0.01) {
      ctx.globalAlpha = Math.min(0.16, o.grain);
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = grainPattern(ctx);
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  /* live preview controller */
  function preview(canvas, opts) {
    const ctx = canvas.getContext('2d');
    let raf = 0, start = performance.now(), playing = true, options = Object.assign({}, DEFAULTS, opts);
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(160, Math.round((rect.width || 640) * dpr));
      const h = Math.max(90, Math.round((rect.height || 360) * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    };
    const loop = now => {
      resize();
      const t = (now - start) / 1000;
      draw(ctx, canvas.width, canvas.height, t, options);
      if (playing) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return {
      set(next) { options = Object.assign({}, options, next); },
      play() { if (!playing) { playing = true; raf = requestAnimationFrame(loop); } },
      pause() { playing = false; cancelAnimationFrame(raf); },
      destroy() { cancelAnimationFrame(raf); }
    };
  }

  /* CSS-only approximation for gradient-family effects */
  function cssFor(o) {
    const opts = Object.assign({}, DEFAULTS, o);
    const cols = opts.colors.join(', ');
    const dur = Math.max(3, Math.round(18 / Math.max(0.2, opts.speed)));
    return `/* Generated with animatedbackgrounds.me/create/ */
.bg-anim {
  background: linear-gradient(${Math.round(opts.angle)}deg, ${cols});
  background-size: 400% 400%;
  animation: bg-anim-shift ${dur}s ease-in-out infinite;
}
@keyframes bg-anim-shift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@media (prefers-reduced-motion: reduce) { .bg-anim { animation: none; } }`;
  }

  /* self-contained HTML export (canvas + inlined engine) */
  function standaloneHTML(o) {
    const opts = Object.assign({}, DEFAULTS, o);
    const name = (opts.name || 'Animated background').replace(/[<>&"]/g, '');
    const payload = JSON.stringify(opts).replace(/</g, '\\u003c');
    const src = PAYLOAD_SRC + '\nvar O=' + payload + ';var c=document.getElementById("c"),x=c.getContext("2d"),t0=performance.now();' +
      'function R(){var r=c.getBoundingClientRect(),d=Math.min(2,devicePixelRatio||1);' +
      'c.width=Math.max(160,Math.round(r.width*d));c.height=Math.max(90,Math.round(r.height*d));}' +
      'function L(n){R();ABE(x,c.width,c.height,(n-t0)/1000,O);requestAnimationFrame(L);}requestAnimationFrame(L);';
    return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<title>' + name + '</title>\n<style>html,body{height:100%;margin:0;overflow:hidden}' +
      '#c{width:100%;height:100%;display:block}</style>\n</head>\n<body>\n<canvas id="c"></canvas>\n' +
      '<!-- Generated with https://animatedbackgrounds.me/create/ -->\n<script>\n' + src + '\n</script>\n</body>\n</html>\n';
  }

  /* minified copy of the painters, injected into HTML export */
  const PAYLOAD_SRC = '(' + function () {
    var TAU = Math.PI * 2;
    function hx(h) { h = String(h || '#000').replace('#', ''); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; var n = parseInt(h, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    function rg(h, a) { var c = hx(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
    function lp(a, b, t) { return a + (b - a) * t; }
    window.ABE = function (ctx, w, h, t, o) {
      ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      var e = o.effect, n, i, x, y, r, g, c, k, L, f, sp, amp;
      if (e === 'waves') {
        ctx.fillStyle = o.bg; ctx.fillRect(0, 0, w, h);
        var bs = ctx.createLinearGradient(0, 0, 0, h);
        bs.addColorStop(0, rg(o.colors[o.colors.length - 1], .2)); bs.addColorStop(1, o.bg);
        ctx.fillStyle = bs; ctx.fillRect(0, 0, w, h);
        var layers = Math.max(3, Math.round(o.complexity));
        for (L = 0; L < layers; L++) {
          k = L / Math.max(1, layers - 1); var yb = h * lp(.42, 1.06, k), fq = TAU / (w * lp(.85, .42, k)), sd = o.speed * lp(.55, 1.25, k);
          c = o.colors[L % o.colors.length]; amp = h * .09 * o.scale;
          ctx.beginPath(); ctx.moveTo(0, h);
          for (x = 0; x <= w; x += Math.max(4, w / 160)) {
            y = yb + Math.sin(x * fq + t * sd * 1.6 + L) * amp + Math.sin(x * fq * 2.3 - t * sd) * amp * .42;
            ctx.lineTo(x, y);
          }
          ctx.lineTo(w, h); ctx.closePath();
          g = ctx.createLinearGradient(0, yb - amp * 2, 0, h);
          g.addColorStop(0, rg(c, .55 * (.5 + o.glow))); g.addColorStop(1, rg(c, .06));
          ctx.fillStyle = g; ctx.fill();
        }
      } else if (e === 'particles') {
        g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * .75);
        g.addColorStop(0, rg(o.colors[2] || o.colors[0], .2)); g.addColorStop(1, o.bg);
        ctx.fillStyle = o.bg; ctx.fillRect(0, 0, w, h); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        n = Math.max(28, Math.round(o.complexity * 26)); ctx.globalCompositeOperation = 'lighter';
        for (i = 0; i < n; i++) {
          var s2 = i * 12.9898, sx = ((Math.sin(s2) * 43758.5453) % 1 + 1) % 1, sy = ((Math.sin(s2 * 1.7) * 24634.6345) % 1 + 1) % 1;
          x = ((sx + t * o.speed * (.02 + (i % 7) * .006)) % 1) * w;
          y = ((sy + Math.sin(t * o.speed * .5 + i) * .04 + 1) % 1) * h;
          r = (.8 + (i % 5) * .85) * o.scale * 1.6; c = o.colors[i % o.colors.length];
          var tw = .45 + .55 * Math.abs(Math.sin(t * o.speed * 1.5 + i));
          g = ctx.createRadialGradient(x, y, 0, x, y, r * 4.5);
          g.addColorStop(0, rg(c, .85 * tw)); g.addColorStop(.25, rg(c, .3 * tw)); g.addColorStop(1, rg(c, 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 4.5, 0, TAU); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      } else if (e === 'tunnel') {
        ctx.fillStyle = o.bg; ctx.fillRect(0, 0, w, h);
        n = Math.max(6, Math.round(o.complexity * 2.2)); ctx.lineWidth = Math.max(2, Math.min(w, h) * .012 * o.scale);
        for (i = n - 1; i >= 0; i--) {
          var pp = ((i / n + t * o.speed * .16) % 1), ww = w * (.06 + pp * 1.5), hh = h * (.06 + pp * 1.5);
          ctx.strokeStyle = rg(o.colors[i % o.colors.length], .3 + .55 * pp * (.5 + o.glow));
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(w / 2 - ww / 2, h / 2 - hh / 2, ww, hh, Math.min(ww, hh) * .1);
          else ctx.rect(w / 2 - ww / 2, h / 2 - hh / 2, ww, hh);
          ctx.stroke();
        }
        g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * .55);
        g.addColorStop(0, rg(o.colors[0], .55)); g.addColorStop(1, rg(o.bg, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(w / 2, h / 2, Math.max(w, h) * .55, 0, TAU); ctx.fill();
      } else if (e === 'mesh') {
        var a2 = o.angle * Math.PI / 180 + t * o.speed * .1, R2 = Math.hypot(w, h);
        ctx.fillStyle = o.bg; ctx.fillRect(0, 0, w, h);
        ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(a2);
        n = Math.max(3, Math.round(o.complexity) + 1);
        for (i = 0; i < n; i++) {
          c = o.colors[i % o.colors.length];
          g = ctx.createLinearGradient(-R2 / 2, -R2, R2 / 2, R2);
          g.addColorStop(0, rg(c, .9 * (.35 + o.glow))); g.addColorStop(1, rg(o.colors[(i + 1) % o.colors.length], .25));
          ctx.fillStyle = g;
          ctx.fillRect(-R2 + i * R2 * 2 / n + Math.sin(t * o.speed + i) * R2 * .06 * o.scale, -R2, R2 * 2 / n, R2 * 2);
        }
        ctx.restore();
        g = ctx.createRadialGradient(w / 2, h / 2, R2 * .08, w / 2, h / 2, R2 * .6);
        g.addColorStop(0, rg(o.bg, .72)); g.addColorStop(1, rg(o.bg, 0));
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      } else {
        ctx.fillStyle = o.bg; ctx.fillRect(0, 0, w, h);
        n = Math.max(3, Math.round(o.complexity)); var RR = Math.max(w, h) * .75 * o.scale;
        ctx.globalCompositeOperation = 'lighter';
        for (i = 0; i < n; i++) {
          var ph = i * 1.9;
          x = w * (.5 + .46 * Math.sin(t * o.speed * .55 + ph));
          y = h * (.5 + .42 * Math.cos(t * o.speed * .47 + ph * 1.3));
          r = RR * (.42 + .22 * Math.sin(t * o.speed * .8 + ph));
          c = o.colors[i % o.colors.length];
          g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, rg(c, .62 * (.45 + o.glow))); g.addColorStop(.45, rg(c, .2 * (.45 + o.glow))); g.addColorStop(1, rg(c, 0));
          ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.restore();
    };
  }.toString() + ')();';

  window.ABEngine = {
    DEFAULTS, EFFECTS, PALETTES, draw, preview, cssFor, standaloneHTML,
    defaults: () => Object.assign({}, DEFAULTS)
  };
})();
