/* =====================================================================
   Animated Backgrounds — PWA front-end (vanilla JS, no build step)
   ---------------------------------------------------------------------
   v3 changes
     · Screenshots are hosted locally (/assets/shots/<id>.jpg) so no card
       can ever show a "Screenshot missing" / 404 placeholder.
     · Home hero = CSS infinite screenshot carousel (minimamente style).
     · "All collections" previews use unique, popular screenshots.
     · Newsletter form posts to the blog's subscribe endpoint.
     · "Add tag" asks the owner for approval (/requests/).
     · Blog cards come from blog.animatedbackgrounds.me (RSS → /data/blog.json).
     · Floating Carbon ad (official snippet, dismissible).
   ===================================================================== */
(() => {
  'use strict';

  const CFG = window.AB_CONFIG || {};
  const SITE = (CFG.site || 'https://animatedbackgrounds.me').replace(/\/$/, '');
  const BLOG = CFG.blog || 'https://blog.animatedbackgrounds.me/';
  const API_BASE = (CFG.apiBase || '').replace(/\/$/, '');
  const NEWSLETTER = CFG.newsletter || {};
  const CARBON = CFG.carbon || {};
  const NS = 'animatedbackgrounds.me';
  const COUNTER_API = 'https://abacus.jasoncameron.dev';
  const PAGE = 24;
  const DOT = ['#2a9df4', '#4f7cff', '#e5484d', '#f5a524', '#6e56cf', '#d6409f', '#30a46c', '#3e63dd', '#8e4ec6', '#12a594', '#8d8d8d', '#e37926'];

  /* ---------------- helpers ---------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => n == null ? '–' : n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const store = {
    get(k, d) { try { const v = localStorage.getItem('ab:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('ab:' + k, JSON.stringify(v)); } catch (e) { } },
    del(k) { try { localStorage.removeItem('ab:' + k); } catch (e) { } }
  };
  const session = {
    get(k) { try { return sessionStorage.getItem('ab:' + k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem('ab:' + k, v); } catch (e) { } },
    del(k) { try { sessionStorage.removeItem('ab:' + k); } catch (e) { } }
  };

  /* Counter keys — MUST match .github/scripts/sync-background-stats.mjs */
  function djb2(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(36); }
  function ckey(prefix, id) {
    const k = (prefix + '-' + id).replace(/[^A-Za-z0-9_.-]/g, '-');
    return k.length <= 64 ? k : k.slice(0, 54) + '-' + djb2(k);
  }
  /* Abacus: serialize requests per tab and retry explicit 429s. A 429 is
     guaranteed not to have incremented the counter, so retrying is safe.
     Do not blindly retry a timed-out hit: the server may have processed it. */
  const Counter = (() => {
    let queue = Promise.resolve();
    let lastRequestAt = 0;
    const MIN_GAP_MS = 420;
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    function retryDelay(response, attempt) {
      const header = response.headers && response.headers.get('Retry-After');
      let delay = header ? Number(header) : NaN;
      if (!Number.isFinite(delay) && header) {
        const date = Date.parse(header);
        if (Number.isFinite(date)) delay = date - Date.now();
      }
      if (!(delay > 0)) {
        const reset = Number(response.headers && response.headers.get('RateLimit-Reset'));
        if (Number.isFinite(reset) && reset > 0) delay = reset * 1000 - Date.now();
      }
      if (!(delay > 0)) delay = 1000 * (attempt + 1);
      return Math.min(15000, Math.max(1000, delay)) + Math.floor(Math.random() * 120);
    }

    async function req(path, safeToRetry = false) {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const task = queue.then(async () => {
          const gap = MIN_GAP_MS - (Date.now() - lastRequestAt);
          if (gap > 0) await sleep(gap);
          lastRequestAt = Date.now();
          return fetch(`${COUNTER_API}/${path}`, { cache: 'no-store' });
        });
        queue = task.then(() => undefined, () => undefined);

        let response;
        try {
          response = await task;
        } catch (error) {
          if (safeToRetry && attempt < 2) {
            await sleep(500 * (attempt + 1));
            continue;
          }
          return null;
        }

        if (response.status === 404) return 0;
        if (response.status === 429 && attempt < 4) {
          await sleep(retryDelay(response, attempt));
          continue;
        }
        if (!response.ok) {
          if (safeToRetry && response.status >= 500 && attempt < 2) {
            await sleep(500 * (attempt + 1));
            continue;
          }
          return null;
        }

        try {
          const json = await response.json();
          return typeof json.value === 'number' && Number.isFinite(json.value) ? json.value : null;
        } catch (error) {
          return null;
        }
      }
      return null;
    }

    return {
      req,
      hit(key) { return req(`hit/${NS}/${key}`, false); },
      get(key) { return req(`get/${NS}/${key}`, true); }
    };
  })();

  /* ---------------- state ---------------- */
  const S = {
    cats: [], bgs: [], byId: new Map(), catMap: new Map(),
    stats: { b: {}, updated: 0 },
    live: {}, // Global values are never persisted per browser; stats.json is shared.
    shots: null,             // Set of ids with a local screenshot (null = unknown)
    picks: {}, hero: null,
    posts: null,
    list: [], shown: 0, observer: null,
    modalList: [], modalIdx: -1, modalOpen: false,
    deferredInstall: null
  };
  const isSpa = () => document.body.dataset.route === 'spa';

  let dataPromise = null;
  function loadData() {
    if (dataPromise) return dataPromise;
    dataPromise = Promise.all([
      fetch('/data/backgrounds.json', { cache: 'no-store' }).then(r => r.json()),
      fetch('/data/stats.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : {}).catch(() => ({})),
      fetch('/data/meta.json').then(r => r.ok ? r.json() : null).catch(() => null)
    ]).then(([d, st, meta]) => {
      S.stats = Object.assign({ b: {}, updated: 0 }, st);
      if (meta) {
        S.shots = new Set(meta.shots || []);
        S.picks = meta.picks || {};
        S.hero = Array.isArray(meta.hero) ? meta.hero : null;
      }
      const removedSet = new Set(store.get('removed', []));
      S.cats = d.categories.map((c, i) => Object.assign(c, { color: c.color || DOT[i % DOT.length], items: [] }));
      S.cats.forEach(c => S.catMap.set(c.slug, c));
      S.allBgs = d.backgrounds.filter(b => !b.hidden).map((b, i) => {
        b.idx = i;
        b.name = b.title || `Animated Background #${i + 1}`;
        b.by = b.author || (b.user && b.user !== 'username' ? '@' + b.user : 'CodePen creator');
        b.tags = (b.tags || []).filter(t => S.catMap.has(t));
        S.byId.set(b.id, b);
        return b;
      });
      S.bgs = S.allBgs.filter(b => !removedSet.has(b.id));
      S.bgs.forEach(b => b.tags.forEach(t => S.catMap.get(t).items.push(b)));
      const ca = $('#count-all'); if (ca) ca.textContent = S.bgs.length;
      return S;
    });
    return dataPromise;
  }
  function loadPosts() {
    if (S.posts) return Promise.resolve(S.posts);
    return fetch('/data/blog.json').then(r => r.ok ? r.json() : { posts: [] })
      .then(j => (S.posts = Array.isArray(j) ? j : (j.posts || [])))
      .catch(() => (S.posts = []));
  }

  /* ---------------- URLs & screenshots ---------------- */
  const hasShot = id => S.shots === null || S.shots.has(id);
  const thumb = b => {
    const custom = typeof b.screenshotUrl === 'string' ? b.screenshotUrl.trim() : '';
    if (custom && (/^https:\/\//i.test(custom) || custom.startsWith('/assets/shots/'))) return custom;
    return S.shots && !S.shots.has(b.id) ? '' : `/assets/shots/${b.id}.jpg`;
  };
  const penUrl = b => `https://codepen.io/${b.user}/pen/${b.id}`;
  const fullUrl = b => `https://codepen.io/${b.user}/full/${b.id}`;
  const embedUrl = b => `https://codepen.io/${b.user}/embed/${b.id}?default-tab=result&theme-id=dark&editable=false`;
  const pageUrl = b => `${SITE}/background/${b.id}/`;
  const catTint = b => { const c = S.catMap.get(b.tags && b.tags[0]); return (c && c.tint) || ['#f1efec', '#e9e6e1']; };

  /** Screenshot <img>, or a tinted gradient tile when we have no capture yet. */
  function shotHTML(b, { alt = '', cls = '', eager = false } = {}) {
    const src = thumb(b);
    if (src) return `<img${cls ? ` class="${cls}"` : ''} src="${src}" alt="${esc(alt)}" ${eager ? '' : 'loading="lazy" '}decoding="async" width="640" height="360" data-shot="${esc(b.id)}">`;
    const [a, c] = catTint(b);
    return `<span class="shot-fallback" role="img" aria-label="${esc(alt || b.name)}" style="--fa:${c[0]};--fb:${c[1]}"><i class="fa-solid fa-wand-magic-sparkles"></i></span>`;
  }

  /* ---------------- counts (views / likes) ---------------- */
  function setLive(id, patch) {
    S.live[id] = Object.assign({}, S.live[id], patch, { t: Date.now() });
    const keys = Object.keys(S.live);
    if (keys.length > 900) keys.sort((a, b) => S.live[a].t - S.live[b].t).slice(0, 300).forEach(k => delete S.live[k]);
  }
  function viewsOf(id) {
    const s = S.stats.b && S.stats.b[id], l = S.live[id];
    const sv = s ? s[0] : 0;
    return l && l.v != null ? Math.max(sv, l.v) : sv;
  }
  function likesOf(id) {
    const s = S.stats.b && S.stats.b[id], l = S.live[id];
    const sl = s ? s[1] : 0;
    // Likes are cumulative and never decremented. Keep the larger value so a
    // snapshot taken mid-scan cannot temporarily hide a newer live increment.
    return l && l.l != null ? Math.max(sl, l.l) : sl;
  }
  const score = b => viewsOf(b.id) + likesOf(b.id) * 8 + (b.featured ? 3 : 0) + (Likes.has(b.id) ? 2 : 0);

  /* ---------------- likes (localStorage) ---------------- */
  const Likes = {
    list: store.get('likes', []),
    ever: store.get('likedEver', {}),
    inflight: new Set(),
    has(id) { return this.list.includes(id); },
    toggle(id) {
      const on = !this.has(id);
      if (on) {
        this.list = [id, ...this.list.filter(x => x !== id)];
      } else {
        this.list = this.list.filter(x => x !== id);
      }
      store.set('likes', this.list);
      refreshCounts(id);
      updateNavCounts();
      return on;
    },
    async count(id) {
      if (this.ever[id]) return true;
      if (this.inflight.has(id)) return false;
      this.inflight.add(id);
      const value = await Counter.hit(ckey('l', id));
      this.inflight.delete(id);

      // Never mark a like as counted until Abacus confirms the increment.
      // This is the key fix for likes that previously failed silently forever.
      if (value == null) return false;
      this.ever[id] = Date.now();
      store.set('likedEver', this.ever);
      setLive(id, { l: value });
      refreshCounts(id);
      return true;
    },
    clear() { this.list = []; store.set('likes', []); updateNavCounts(); }
  };
  function updateNavCounts() {
    const c = $('#count-likes'); if (c) c.textContent = Likes.list.length || '';
    const h = $('#hero-likes'); if (h) h.textContent = Likes.list.length;
  }
  function refreshCounts(id) {
    const liked = Likes.has(id), n = likesOf(id);
    $$(`[data-like="${CSS.escape(id)}"]`).forEach(btn => {
      btn.classList.toggle('liked', liked);
      btn.setAttribute('aria-pressed', liked);
      const i = btn.querySelector('i'); if (i) i.className = (liked ? 'fa-solid' : 'fa-regular') + ' fa-heart';
      const sp = btn.querySelector('span'); if (sp && !btn.classList.contains('like-big')) sp.textContent = n ? fmt(n) : '';
      if (btn.classList.contains('like-big') && sp) sp.textContent = liked ? 'Liked' : 'Like';
    });
    $$(`[data-like-icon="${CSS.escape(id)}"]`).forEach(ic => {
      ic.className = (liked ? 'fa-solid is-liked' : 'fa-regular') + ' fa-heart';
    });
    $$(`[data-views="${CSS.escape(id)}"]`).forEach(el => el.textContent = fmt(viewsOf(id)));
    $$(`[data-likes="${CSS.escape(id)}"]`).forEach(el => el.textContent = fmt(likesOf(id)));
  }
  function toggleLike(id, btn = null) {
    const on = Likes.toggle(id);
    if (btn) { btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop'); }
    toast(on ? 'Added to Favorites' : 'Removed from Favorites', on ? 'fa-solid fa-heart' : 'fa-regular fa-heart');

    if (on && !Likes.ever[id]) {
      Likes.count(id).then(ok => {
        if (!ok && Likes.has(id)) {
          toast('Saved on this browser, but the global like could not sync. Please try again when online.', 'fa-solid fa-triangle-exclamation');
        }
      });
    }
    return on;
  }
  function likeClick(btn) {
    const id = btn.dataset.like;
    const on = toggleLike(id, btn);
    if (!on && location.pathname.startsWith('/favorites')) {
      const card = btn.closest('.bg-card'); if (card && !btn.closest('.modal')) card.remove();
      if (!Likes.list.length) render(location.pathname, false);
    }
  }

  /* views: counted once per session per item */
  async function countView(id) {
    const k = ckey('v', id);
    const already = session.get('v:' + id);
    const v = already ? await Counter.get(k) : await Counter.hit(k);
    // Only mark this item as viewed after the server confirms the increment.
    // Failed requests remain eligible for a later retry in this session.
    if (!already && v != null) session.set('v:' + id, '1');
    if (v != null) setLive(id, { v });
    refreshCounts(id);
  }
  async function fetchLikes(id) {
    const v = await Counter.get(ckey('l', id));
    const l = S.live[id];
    if (v != null && !(l && l.l != null && Date.now() - l.t < 4000)) setLive(id, { l: Math.max(v, 0) });
    refreshCounts(id);
  }

  /* ---------------- toast / copy / share ---------------- */
  function toast(msg, icon = 'fa-solid fa-circle-check') {
    const box = $('#toasts'); if (!box) return;
    const t = document.createElement('div');
    t.className = 'toast'; t.innerHTML = `<i class="${icon}"></i>${esc(msg)}`;
    box.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 320); }, 2400);
  }
  async function copy(text, msg = 'Copied to clipboard') {
    try { await navigator.clipboard.writeText(text); }
    catch (e) { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
    toast(msg, 'fa-solid fa-copy');
  }
  async function share(title, url) {
    if (navigator.share) { try { await navigator.share({ title, url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    copy(url, 'Link copied');
  }

  /* ---------------- templates ---------------- */
  function cardHTML(b) {
    const liked = Likes.has(b.id), n = likesOf(b.id), v = viewsOf(b.id);
    const hot = v >= 500 || n >= 25;
    return `<article class="bg-card" data-id="${esc(b.id)}">
      <a class="bg-thumb" href="/background/${esc(b.id)}/" data-open="${esc(b.id)}" aria-label="Preview ${esc(b.name)}">
        ${shotHTML(b, { alt: `${b.name} — animated background` })}
        <span class="play"><i class="fa-solid fa-play"></i></span>
        ${hot ? '<span class="badge"><i class="fa-solid fa-fire"></i> Hot</span>' : ''}
      </a>
      <div class="bg-info">
        <div class="bg-meta">
          <h3 title="${esc(b.name)}">${esc(b.name)}</h3>
        </div>
        <span class="stat-pill" title="Views"><i class="fa-regular fa-eye"></i> <span data-views="${esc(b.id)}">${fmt(v)}</span></span>
        <button class="like-btn${liked ? ' liked' : ''}" data-like="${esc(b.id)}" aria-pressed="${liked}" aria-label="Like"><i class="${liked ? 'fa-solid' : 'fa-regular'} fa-heart"></i><span>${n ? fmt(n) : ''}</span></button>
        <button class="kebab" data-menu="${esc(b.id)}" aria-label="More options"><i class="fa-solid fa-ellipsis-vertical"></i></button>
      </div>
    </article>`;
  }
  /** Unique screenshot picks per collection (computed at build time). */
  function picksFor(c) {
    const ids = S.picks && S.picks[c.slug];
    if (ids && ids.length) return ids.map(id => S.byId.get(id)).filter(Boolean);
    return c.items.slice().sort((a, b) => score(b) - score(a)).slice(0, 3);
  }
  function collectionCardHTML(c) {
    const p = picksFor(c);
    return `<article class="collection-card">
      <a href="/collection/${c.slug}/" data-link>
        <div class="cc-art n${p.length}" style="background:linear-gradient(135deg,${c.tint[0]},${c.tint[1]})">
          ${p.map(b => shotHTML(b, { alt: `${c.name} background preview` })).join('')}
          <span class="cc-icon"><i class="fa-solid ${c.icons[0]}"></i></span>
        </div>
      </a>
      <div class="cc-info">
        <div><h3><a href="/collection/${c.slug}/" data-link style="color:inherit">${esc(c.name)}</a></h3><p>${c.items.length} Backgrounds</p></div>
        <button class="kebab" data-cmenu="${c.slug}" aria-label="Collection options"><i class="fa-solid fa-ellipsis-vertical"></i></button>
      </div>
    </article>`;
  }
  function postCardHTML(p) {
    const url = p.url || BLOG;
    return `<article class="post-card">
      <a class="pc-img" href="${esc(url)}" target="_blank" rel="noopener">${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.title)}" loading="lazy">` : '<span class="pc-ph"><i class="fa-solid fa-feather"></i></span>'}</a>
      <div class="pc-body"><span class="pc-cat">${esc(p.category || 'Blog')}</span>
        <h3><a href="${esc(url)}" target="_blank" rel="noopener">${esc(p.title)}</a></h3>
        <p>${esc(p.excerpt || '')}</p>
        <div class="pc-meta"><span><i class="fa-regular fa-calendar"></i> ${esc(p.dateText || '')}</span>${p.minutes ? `<span><i class="fa-regular fa-clock"></i> ${p.minutes} min read</span>` : ''}<i class="fa-solid fa-arrow-up-right-from-square pc-ext"></i></div>
      </div></article>`;
  }
  function catChips(active) {
    return `<a class="chip${!active ? ' active' : ''}" href="/all/" data-link>All <small>${S.bgs.length}</small></a>` +
      S.cats.map(c => `<a class="chip${active === c.slug ? ' active' : ''}" href="/collection/${c.slug}/" data-link><i class="fa-solid ${c.icons[0]}"></i>${esc(c.name)} <small>${c.items.length}</small></a>`).join('');
  }
  const sortSelect = cur => `<select class="sort-select" id="sort-select" aria-label="Sort">
      ${[['popular', 'Most popular'], ['liked', 'Most liked'], ['default', 'Default order'], ['az', 'A – Z'], ['shuffle', 'Shuffle']].map(([v, l]) => `<option value="${v}"${cur === v ? ' selected' : ''}>${l}</option>`).join('')}
    </select>`;
  function sortList(list, mode) {
    switch (mode) {
      case 'liked': return list.slice().sort((a, b) => likesOf(b.id) - likesOf(a.id) || score(b) - score(a));
      case 'default': return list.slice();
      case 'az': return list.slice().sort((a, b) => (a.title ? 0 : 1) - (b.title ? 0 : 1) || a.name.localeCompare(b.name));
      case 'shuffle': return shuffle(list);
      default: return list.slice().sort((a, b) => score(b) - score(a) || a.idx - b.idx);
    }
  }
  const gridShell = () => `<div class="bg-grid" id="grid"></div>
    <div class="load-more-wrap"><button class="btn btn-soft" id="load-more" hidden>Load more <i class="fa-solid fa-chevron-down"></i></button></div>
    <div class="sentinel" id="sentinel"></div>`;
  const emptyHTML = (icon, title, text, actions = '') => `<div class="empty"><i class="${icon} big"></i><h3>${title}</h3><p>${text}</p>${actions}</div>`;

  /* ---------------- grid with infinite scroll ---------------- */
  function startGrid(list) {
    S.list = list; S.shown = 0;
    if (S.observer) S.observer.disconnect();
    const more = () => {
      const grid = $('#grid'); if (!grid) return;
      const next = S.list.slice(S.shown, S.shown + PAGE);
      grid.insertAdjacentHTML('beforeend', next.map(cardHTML).join(''));
      S.shown += next.length;
      checkImages(grid);
      const btn = $('#load-more'); if (btn) btn.hidden = S.shown >= S.list.length;
    };
    more();
    const sen = $('#sentinel');
    if ('IntersectionObserver' in window && sen) {
      S.observer = new IntersectionObserver(es => { if (es[0].isIntersecting && S.shown < S.list.length) more(); }, { rootMargin: '600px' });
      S.observer.observe(sen);
    }
    const btn = $('#load-more'); if (btn) btn.onclick = more;
  }
  function checkImages(root) {
    $$('img', root).forEach(img => { if (img.complete && img.naturalWidth) img.classList.add('loaded'); });
  }

  /* ---------------- views ---------------- */
  const view = () => $('#view');
  function setTitle(t, d) {
    document.title = t ? `${t} · Animated Backgrounds` : 'Animated Backgrounds — 650+ Free CSS & JS Animated Backgrounds';
    const m = $('meta[name="description"]'); if (m && d) m.setAttribute('content', d);
  }

  /* OriginKit-style sleek top discovery bar (instant above-the-fold gallery). */
  function heroHTML() {
    const compact = document.documentElement.classList.contains('compact');
    return `<div class="discover-bar" id="hero-section">
        <p class="discover-count">Discover ${S.bgs.length} Backgrounds</p>
        <a class="announce-pill" href="/create/" data-link>
          <span class="announce-tag"><i class="fa-solid fa-sparkles fa-wand-magic-sparkles"></i> Studio</span>
          <span>Design &amp; export custom CSS or GIF backgrounds free</span>
          <span class="announce-arrow" aria-hidden="true"><i class="fa-solid fa-arrow-right"></i></span>
        </a>
        <div class="view-toggle" role="group" aria-label="Grid layout">
          <button type="button" data-grid-mode="comfy" class="${compact ? '' : 'active'}" title="3-column gallery"><i class="fa-solid fa-table-cells-large"></i></button>
          <button type="button" data-grid-mode="compact" class="${compact ? 'active' : ''}" title="Compact grid"><i class="fa-solid fa-table-cells"></i></button>
        </div>
      </div>`;
  }

  function viewHome() {
    setTitle(null);
    const popular = sortList(S.bgs, 'popular').slice(0, 9);
    const favs = Likes.list.map(id => S.byId.get(id)).filter(b => b && !store.get('removed', []).includes(b.id)).slice(0, 6);
    view().innerHTML = `
      ${heroHTML()}

      <section class="section" id="trending">
        <div class="bg-grid">${popular.map(cardHTML).join('')}</div>
      </section>

      ${newsletterHTML('/')}


      ${favs.length ? `<section class="section" id="your-favorites">
        <div class="section-head"><div><h2><i class="fa-solid fa-heart" style="color:var(--heart)"></i> Your favorites</h2><p>Saved on this device</p></div><a class="see-all" href="/favorites/" data-link>All favorites <i class="fa-solid fa-arrow-right"></i></a></div>
        <div class="bg-grid">${favs.map(cardHTML).join('')}</div></section>` : ''}

      <section class="section" id="explore">
        <div class="section-head"><div><h2>Explore everything</h2><p>Scroll to load more backgrounds</p></div>${sortSelect('default')}</div>
        ${gridShell()}
      </section>`;
    checkImages(view());
    startGrid(S.bgs.slice());
    bindSort(S.bgs);
    bindNewsletter(view());
    scheduleSubscribePopup();
    $$('[data-grid-mode]', view()).forEach(btn => {
      btn.onclick = () => {
        store.set('density', btn.dataset.gridMode);
        applyDensity();
        $$('[data-grid-mode]', view()).forEach(b => b.classList.toggle('active', b === btn));
      };
    });
  }
  function bindSort(base) {
    const sel = $('#sort-select'); if (!sel) return;
    sel.onchange = () => {
      startGridReset(sortList(base, sel.value));
      const u = new URL(location.href); u.searchParams.set('sort', sel.value); history.replaceState(history.state, '', u);
    };
  }
  function startGridReset(list) { const g = $('#grid'); if (g) g.innerHTML = ''; startGrid(list); }

  function listPage({ title, sub, icon, color, list, active, sort = 'popular', extra = '' }) {
    view().innerHTML = `
      <section class="section">
        <div class="section-head"><div><h1>${icon ? `<i class="fa-solid ${icon}" style="color:var(--text-2)"></i> ` : ''}${esc(title)}</h1><p>${sub}</p></div>${extra}</div>
        <div class="toolbar"><nav class="chips" aria-label="Collections">${catChips(active)}</nav>${sortSelect(sort)}</div>
        ${list.length ? gridShell() : emptyHTML('fa-solid fa-ghost', 'Nothing here yet', 'This collection is still being curated. Check back soon!', '<a class="btn btn-primary" href="/all/" data-link>Browse all</a>')}
      </section>`;
    if (list.length) { startGrid(sortList(list, sort)); bindSort(list); }
    const ch = $('.toolbar .chips .active'); if (ch) ch.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  function viewAll(_, q) {
    setTitle('All Animated Backgrounds', `Browse all ${S.bgs.length} free animated backgrounds.`);
    listPage({ title: 'All Backgrounds', sub: `${S.bgs.length} free animated backgrounds — click any card to preview`, icon: 'fa-layer-group', list: S.bgs, sort: q.get('sort') || 'default' });
  }
  function viewCollection([slug], q) {
    const c = S.catMap.get(slug);
    if (!c) return viewNotFound();
    setTitle(c.name, `${c.items.length} free ${c.name.toLowerCase()} backgrounds. ${c.desc}`);
    listPage({ title: c.name, sub: `${c.items.length} backgrounds · ${esc(c.desc)}`, icon: c.icons[0], color: c.color, list: c.items, active: slug, sort: q.get('sort') || 'popular',
      extra: `<button class="btn btn-soft btn-sm" data-share-url="${SITE}/collection/${slug}/" data-share-title="${esc(c.name)}"><i class="fa-solid fa-share-nodes"></i> Share</button>` });
  }
  function viewPopular(_, q) {
    setTitle('Popular Animated Backgrounds', 'The most viewed and liked animated backgrounds.');
    listPage({ title: 'Popular', sub: 'Ranked by global views &amp; likes' + (S.stats.updated ? ` · updated ${new Date(S.stats.updated).toLocaleDateString()}` : ''), icon: 'fa-fire', color: 'var(--primary)', list: S.bgs, sort: q.get('sort') || 'popular' });
  }
  function viewRandom() {
    setTitle('Random Animated Backgrounds');
    view().innerHTML = `<section class="section">
      <div class="section-head"><div><h1><i class="fa-solid fa-shuffle" style="color:var(--text-2)"></i> Random picks</h1><p>A fresh shuffle every time — find hidden gems.</p></div>
      <div class="chips"><button class="btn btn-soft" id="reshuffle"><i class="fa-solid fa-rotate"></i> Shuffle again</button><button class="btn btn-primary" id="surprise"><i class="fa-solid fa-wand-magic-sparkles"></i> Surprise me</button></div></div>
      ${gridShell()}</section>`;
    const go = () => startGridReset(shuffle(S.bgs));
    go();
    $('#reshuffle').onclick = go;
    $('#surprise').onclick = () => { const b = S.bgs[Math.random() * S.bgs.length | 0]; openModal(b.id, S.list); };
  }
  function viewFavorites() {
    setTitle('My Favorites');
    const list = Likes.list.map(id => S.byId.get(id)).filter(Boolean);
    view().innerHTML = `<section class="section">
      <div class="section-head"><div><h1><i class="fa-solid fa-heart" style="color:var(--heart)"></i> Favorites</h1><p>${list.length} liked background${list.length === 1 ? '' : 's'} · saved privately in this browser</p></div>
      ${list.length ? `<div class="chips"><button class="btn btn-soft btn-sm" id="fav-export"><i class="fa-solid fa-file-export"></i> Export</button><button class="btn btn-ghost btn-sm" id="fav-clear"><i class="fa-solid fa-trash"></i> Clear</button></div>` : ''}</div>
      ${list.length ? gridShell() : emptyHTML('fa-regular fa-heart', 'No favorites yet', 'Tap the <i class="fa-regular fa-heart"></i> on any background to save it here. Likes are stored on your device — no account needed.', '<a class="btn btn-primary" href="/popular/" data-link>Discover popular backgrounds</a>')}
    </section>`;
    if (list.length) {
      startGrid(list);
      $('#fav-clear').onclick = () => { if (confirm('Remove all favorites from this device?')) { Likes.clear(); viewFavorites(); } };
      $('#fav-export').onclick = exportLikes;
    }
  }
  function searchList(q) {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return S.bgs.filter(b => {
      const hay = (b.name + ' ' + b.by + ' ' + b.user + ' ' + b.id + ' ' + b.tags.map(t => S.catMap.get(t).name + ' ' + t).join(' ')).toLowerCase();
      return terms.every(t => hay.includes(t));
    }).sort((a, b) => score(b) - score(a));
  }
  function viewSearch(_, q) {
    const term = (q.get('q') || '').trim();
    setTitle(term ? `Search: ${term}` : 'Search');
    const input = $('#search-input'); if (input && document.activeElement !== input) input.value = term;
    const list = searchList(term);
    const catHits = term ? S.cats.filter(c => (c.name + ' ' + c.slug).toLowerCase().includes(term.toLowerCase())) : [];
    view().innerHTML = `<section class="section">
      <div class="section-head"><div><h1>${term ? `Results for “${esc(term)}”` : 'Search backgrounds'}</h1><p>${term ? `${list.length} background${list.length === 1 ? '' : 's'} found` : 'Type in the search box above — try “wave”, “3d”, “hearts”, “gradient”…'}</p></div></div>
      ${catHits.length ? `<div class="chips" style="margin-bottom:18px">${catHits.map(c => `<a class="chip" href="/collection/${c.slug}/" data-link><i class="fa-solid ${c.icons[0]}" style="color:${c.color}"></i> ${esc(c.name)} collection <small>${c.items.length}</small></a>`).join('')}</div>` : ''}
      ${list.length ? gridShell() : emptyHTML('fa-solid fa-magnifying-glass', term ? 'No matches' : 'Start typing', 'Browse a collection instead:', `<div class="chips" style="justify-content:center">${S.cats.slice(0, 8).map(c => `<a class="chip" href="/collection/${c.slug}/" data-link>${esc(c.name)}</a>`).join('')}</div>`)}
    </section>`;
    if (list.length) startGrid(list);
  }
  function viewBackground([id]) {
    const b = S.byId.get(id);
    if (!b) return viewNotFound();
    setTitle(b.name, `${b.name} by ${b.by} — free animated background. Preview, like and get the code.`);
    const related = sortList(S.bgs.filter(x => x.id !== id && x.tags.some(t => b.tags.includes(t))), 'popular').slice(0, 12);
    const more = related.length ? related : shuffle(S.bgs.filter(x => x.id !== id)).slice(0, 12);
    const liked = Likes.has(id);
    view().innerHTML = `
      <nav class="breadcrumbs"><a href="/" data-link>Home</a><i class="fa-solid fa-chevron-right"></i>${b.tags[0] ? `<a href="/collection/${b.tags[0]}/" data-link>${esc(S.catMap.get(b.tags[0]).name)}</a><i class="fa-solid fa-chevron-right"></i>` : `<a href="/all/" data-link>All</a><i class="fa-solid fa-chevron-right"></i>`}<span>${esc(b.name)}</span></nav>
      <section class="section">
        <div class="section-head"><div><h1>${esc(b.name)}</h1><p>by ${esc(b.by)} on CodePen</p></div></div>
        <div class="modal-stage" style="margin:0" id="detail-stage">
          ${thumb(b) ? `<img class="stage-poster" src="${thumb(b)}" alt="">` : ''}
          <iframe src="${embedUrl(b)}" title="${esc(b.name)}" loading="lazy" allow="accelerometer; fullscreen" allowfullscreen></iframe>
        </div>
        <div class="modal-foot" style="padding:16px 0 0">
          <div class="modal-stats">
            <span><i class="fa-regular fa-eye"></i> <b data-views="${esc(id)}">${fmt(viewsOf(id))}</b> views</span>
            <span><i class="${liked ? 'fa-solid is-liked' : 'fa-regular'} fa-heart" data-like-icon="${esc(id)}"></i> <b data-likes="${esc(id)}">${fmt(likesOf(id))}</b> likes</span>
            <div class="chips">${b.tags.map(t => `<a class="chip chip-xs" href="/collection/${t}/" data-link>${esc(S.catMap.get(t).name)}</a>`).join('')}</div>
          </div>
          <div class="modal-actions">
            <button class="btn btn-soft like-big${liked ? ' liked' : ''}" data-like="${esc(id)}"><i class="${liked ? 'fa-solid' : 'fa-regular'} fa-heart"></i> <span>${liked ? 'Liked' : 'Like'}</span></button>
            <button class="btn btn-soft" data-tag="${esc(id)}"><i class="fa-solid fa-tags"></i> Add tag</button>
            <button class="btn btn-soft" data-share-url="${pageUrl(b)}" data-share-title="${esc(b.name)}"><i class="fa-solid fa-share-nodes"></i> Share</button>
            <button class="btn btn-soft" data-embed="${esc(id)}"><i class="fa-solid fa-code"></i> Embed</button>
            <a class="btn btn-soft" href="${fullUrl(b)}" target="_blank" rel="noopener"><i class="fa-solid fa-expand"></i> Fullscreen</a>
            <a class="btn btn-primary" href="${penUrl(b)}" target="_blank" rel="noopener"><i class="fa-brands fa-codepen"></i> Get Code</a>
          </div>
          <div class="tag-panel" id="detail-tag-panel" hidden></div>
        </div>
      </section>
      <section class="section"><div class="section-head"><div><h2>More like this</h2></div></div><div class="bg-grid">${more.map(cardHTML).join('')}</div></section>`;
    checkImages(view());
    countView(id); fetchLikes(id);
  }
  function viewNotFound() {
    setTitle('Page not found');
    view().innerHTML = emptyHTML('fa-solid fa-compass', 'Page not found', 'The page you were looking for has moved or does not exist.', '<a class="btn btn-primary" href="/" data-link>Go home</a>');
  }

  /* =====================================================================
     NEWSLETTER  (same endpoint the blog uses; a real cross-origin form
     post into a hidden iframe, so no CORS gymnastics are needed)
     ===================================================================== */
  const isSubscribed = () => !!store.get('subscribed', false);
  function newsletterHTML(source = '/', inPopup = false) {
    if (isSubscribed()) return '';
    const id = 'nl-' + (source.replace(/\W/g, '') || 'home') + (inPopup ? '-pop' : '');
    return `<form class="subscribe" data-newsletter${inPopup ? ' data-nl-popup="1"' : ''} action="${esc(NEWSLETTER.action || BLOG + '_ob/subscribe')}" method="post" enctype="multipart/form-data" target="nl-sink">
      ${inPopup ? '' : '<div class="subscribe-copy"><h2><i class="fa-regular fa-envelope" style="color:var(--text-2)"></i> Get new backgrounds &amp; guides by email</h2><p>One short email when something new lands. No spam, unsubscribe anytime.</p></div>'}
      <div class="subscribe-row">
        <label class="sr-only" for="${id}">Email address</label>
        <input id="${id}" type="email" name="email" required autocomplete="email" inputmode="email" placeholder="you@example.com">
        <button class="btn btn-primary" type="submit"><i class="fa-solid fa-paper-plane"></i> Subscribe</button>
      </div>
      <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
      <input type="hidden" name="form_key" value="${esc(NEWSLETTER.formKey || 'home-newsletter')}">
      <input type="hidden" name="source" value="${esc(source)}">
      <p class="subscribe-status" role="status" aria-live="polite"></p>
    </form>`;
  }
  function bindNewsletter(root = document) {
    if (isSubscribed()) {
      $$('[data-newsletter]', root).forEach(f => f.remove());
      return;
    }
    $$('[data-newsletter]', root).forEach(form => {
      if (form.dataset.bound) return;
      form.dataset.bound = '1';
      form.addEventListener('submit', () => {
        const email = form.querySelector('input[type="email"]');
        const status = form.querySelector('.subscribe-status');
        if (!email || !email.value || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value)) {
          if (status) { status.textContent = 'Please enter a valid email address.'; status.className = 'subscribe-status err'; }
          return;
        }
        if (status) { status.textContent = 'Subscribing…'; status.className = 'subscribe-status'; }
        form.classList.add('is-done');
        store.set('subscribed', true);
        setTimeout(() => {
          if (status) { status.textContent = '✓ Subscribed! Thanks for joining.'; status.className = 'subscribe-status ok'; }
          try { form.reset(); } catch (e) { }
          if (window.gtag) gtag('event', 'newsletter_signup', { source: form.querySelector('input[name="source"]')?.value || '/' });
          setTimeout(() => {
            if (form.dataset.nlPopup) closeDialog();
            $$('[data-newsletter]').forEach(f => f.remove());
          }, 1400);
        }, 1200);
      });
    });
  }
  let nlPopTimer = null;
  function scheduleSubscribePopup() {
    clearTimeout(nlPopTimer);
    if (isSubscribed() || session.get('nl-popup-seen')) return;
    nlPopTimer = setTimeout(() => {
      const onHome = location.pathname === '/' || location.pathname === '/index.html';
      const dlg = $('#dialog');
      if (!onHome || isSubscribed() || session.get('nl-popup-seen') || S.modalOpen || (dlg && !dlg.hidden)) return;
      session.set('nl-popup-seen', '1');
      openDialog(`<div class="nl-popup">
        <span class="nl-pop-badge"><i class="fa-regular fa-envelope"></i> Free updates</span>
        <h2>Get fresh animated backgrounds in your feed</h2>
        <p>Join developers &amp; designers getting new CSS, Canvas, and WebGL backgrounds as they drop. No spam, unsubscribe anytime.</p>
        ${newsletterHTML('home-popup', true)}
        <div class="nl-pop-foot"><button type="button" class="btn btn-ghost btn-sm" data-close>Maybe later</button></div>
      </div>`);
      bindNewsletter($('#dialog-body'));
    }, 6500);
  }
  function initNewsletterSink() {
    if ($('#nl-sink')) return;
    const f = document.createElement('iframe');
    f.name = 'nl-sink'; f.id = 'nl-sink'; f.title = 'Newsletter'; f.setAttribute('aria-hidden', 'true');
    f.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(f);
  }

  /* =====================================================================
     TAG REQUESTS — "Add tag" -> owner approval on /requests/
     ===================================================================== */
  /* ---------------------------------------------------------------------
     REQUEST QUEUE (no backend)
     The site is served from static hosting, so there is nothing to POST to.
     Instead a request is (a) stored in this browser, (b) turned into a
     short shareable code, and (c) offered as a pre-filled email to the
     owner. The owner opens /requests/, pastes the codes they received,
     approves them and exports data/approved.json for the next build.
     This removes the old fetch() to a host that no longer exists, which
     was the cause of "Failed to fetch".
     --------------------------------------------------------------------- */
  const REQ_KEY = 'requests';
  const reqList = () => { const l = store.get(REQ_KEY, []); return Array.isArray(l) ? l : []; };
  const reqSave = l => store.set(REQ_KEY, l.slice(0, 250));
  const b64e = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const b64d = s => decodeURIComponent(escape(atob(String(s).replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '='))));
  const reqCode = r => 'ABREQ1.' + b64e(JSON.stringify({ t: r.type, i: r.id, c: r.collection, n: r.name || '', m: r.note || '', d: Date.now() }));
  function reqDecode(code) {
    const raw = String(code).trim().replace(/^ABREQ1\./i, '');
    const o = JSON.parse(b64d(raw));
    if (!o || typeof o.i !== 'string' || !o.i) throw new Error('Not a request code');
    const d = {
      key: 'r' + (o.d || Date.now()).toString(36) + Math.random().toString(36).slice(2, 5),
      type: o.t === 'new' ? 'new' : 'tag',
      id: o.i, collection: o.c || '', name: o.n || '', note: o.m || '',
      created: o.d || Date.now(), status: 'pending'
    };
    if (d.type === 'tag' && !S.catMap.has(d.collection)) throw new Error('Unknown collection in code');
    return d;
  }
  const reqKeyOf = r => `${r.type}|${r.id}|${r.collection}`;
  function reqAdd(r) {
    const l = reqList();
    if (l.some(x => reqKeyOf(x) === reqKeyOf(r))) return false;
    l.unshift(r); reqSave(l); return true;
  }

  function tagPanelHTML(b, inline = false) {
    const own = new Set(b.tags || []);
    const opts = S.cats.map(c => {
      const has = own.has(c.slug);
      return `<label class="${has ? 'is-in' : ''}" title="${has ? 'Already in this collection' : 'Request this collection'}">
        <input type="checkbox" name="collection" value="${c.slug}"${has ? ' disabled' : ''}>
        <span><i class="fa-solid ${c.icons[0]}" style="color:${has ? 'inherit' : c.color}"></i> ${esc(c.name)}${has ? ' ✓' : ''}</span>
      </label>`;
    }).join('');
    return `<h4><i class="fa-solid fa-tags" style="color:var(--text-2)"></i> Add this background to a collection</h4>
      <p>Pick a collection and send it for review. It is only added after the owner approves it.</p>
      <form class="tag-form" data-tag-form="${esc(b.id)}">
        <div class="tag-choices">${opts}</div>
        <div class="tag-row">
          <input name="name" maxlength="60" placeholder="Your name (optional)" autocomplete="name">
          <input name="note" maxlength="200" placeholder="Why does it fit? (optional)">
          <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
          <button class="btn btn-primary" type="submit"><i class="fa-solid fa-paper-plane"></i> Send request</button>
        </div>
        <p class="tag-note"><i class="fa-solid fa-shield-halved"></i> Reviewed by hand — usually within a day. <a href="/requests/" target="_blank" rel="noopener" class="sr-only">Owner queue</a></p>
        <p class="subscribe-status" role="status" aria-live="polite"></p>
      </form>`;
  }
  function openTagPanel(b, panel) {
    if (!panel) return;
    if (!panel.hidden) { panel.hidden = true; panel.innerHTML = ''; return; }
    panel.innerHTML = tagPanelHTML(b);
    panel.hidden = false;
    const form = panel.querySelector('[data-tag-form]');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const status = form.querySelector('.subscribe-status');
      const picks = $$('input[name="collection"]:checked', form).map(i => i.value);
      if (!picks.length) { status.textContent = 'Choose at least one collection.'; status.className = 'subscribe-status err'; return; }
      const btn = form.querySelector('button[type="submit"]');
      const name = form.querySelector('[name="name"]').value.trim();
      const note = form.querySelector('[name="note"]').value.trim();
      if (form.querySelector('[name="website"]').value) return;      // honeypot

      let added = 0;
      const codes = [];
      for (const c of picks) {
        if ((b.tags || []).includes(c)) continue;
        const r = { key: '', type: 'tag', id: b.id, collection: c, name, note, created: Date.now(), status: 'pending' };
        r.key = 'r' + r.created.toString(36) + Math.random().toString(36).slice(2, 5);
        if (reqAdd(r)) { added++; codes.push(reqCode(r)); }
      }
      if (!added) {
        status.className = 'subscribe-status';
        status.textContent = 'That request is already saved on this device — thanks!';
        return;
      }
      btn.disabled = true;
      status.className = 'subscribe-status ok';
      status.innerHTML = `✓ Request saved. It is queued for review —
        <button type="button" class="link-btn" id="tag-send">email it to the owner</button>
        or <a href="/requests/" target="_blank" rel="noopener">review the queue</a>.`;
      $$('input[name="collection"]:checked', form).forEach(i => { i.checked = false; });
      const send = form.querySelector('#tag-send');
      if (send) send.onclick = () => {
        const subject = `Collection request: ${b.name || b.id}`;
        const body = [
          `Background: ${b.name || b.id}`,
          `ID: ${b.id}`,
          `Collection(s): ${picks.join(', ')}`,
          name ? `From: ${name}` : '', note ? `Note: ${note}` : '',
          '', 'Request code(s) — paste these into /requests/ on the site:', ...codes
        ].filter(Boolean).join('\n');
        location.href = `mailto:${CFG.contactEmail || 'owner@animatedbackgrounds.me'}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      };
    });
  }

  /* =====================================================================
     NATIVE IN-PAGE AD (Carbon)
     The slot sits in the page flow below the content — never fixed, never
     overlaying anything, and with no close/minimise button. If Carbon does
     not paint an ad (blocked, no inventory) the whole block is removed so
     the page never shows an empty sponsored box.
     ===================================================================== */
  function initCarbon() {
    const box = $('#ad-native');
    if (!box) return;
    if (document.body.dataset.route === 'admin') { box.remove(); return; }
    if (!CARBON.serve) { box.remove(); return; }

    const load = () => {
      const slot = $('#carbon-slot');
      if (!slot || slot.dataset.loaded) return;
      slot.dataset.loaded = '1';
      const s = document.createElement('script');
      s.async = true; s.type = 'text/javascript';
      s.src = `https://cdn.carbonads.com/carbon.js?serve=${encodeURIComponent(CARBON.serve)}&placement=${encodeURIComponent(CARBON.placement || 'animatedbackgroundsme')}${CARBON.format ? '&format=' + encodeURIComponent(CARBON.format) : ''}`;
      s.id = '_carbonads_js';
      slot.appendChild(s);
      const lockCarbonStyle = () => {
        if ($('#ab-carbon-lock')) return;
        const st = document.createElement('style');
        st.id = 'ab-carbon-lock';
        st.textContent = `
          html body #ad-native, html body #ad-native * { box-sizing: border-box !important; }
          html body #ad-native #carbonads,
          html body #ad-native #carbonads > span,
          html body #ad-native #carbonads .carbon-wrap,
          html body #ad-native .carbon-responsive-wrap {
            background: transparent !important; background-color: transparent !important;
            border: 0 !important; box-shadow: none !important; padding: 0 !important; margin: 0 !important;
            width: 100% !important; max-width: 100% !important; min-width: 0 !important; overflow: hidden !important;
            float: none !important;
          }
          html body #ad-native #carbonads > span {
            display: flex !important; flex-direction: column !important; gap: 10px !important;
          }
          html body #ad-native #carbonads .carbon-wrap,
          html body #ad-native #carbonads .carbon-responsive-wrap {
            display: grid !important; grid-template-columns: 86px minmax(0, 1fr) !important;
            align-items: start !important; gap: 10px !important; width: 100% !important;
          }
          html body #ad-native #carbonads .carbon-img {
            grid-column: 1 !important; display: block !important; width: 86px !important; height: 66px !important;
            margin: 0 !important; padding: 0 !important; border-radius: 8px !important; overflow: hidden !important;
          }
          html body #ad-native #carbonads .carbon-img img {
            display: block !important; width: 100% !important; height: 100% !important; object-fit: cover !important;
            border-radius: 8px !important; margin: 0 !important;
          }
          html body #ad-native #carbonads .carbon-text {
            grid-column: 2 !important; display: -webkit-box !important; -webkit-line-clamp: 4 !important; -webkit-box-orient: vertical !important;
            overflow: hidden !important; min-width: 0 !important; width: auto !important; max-width: 100% !important;
            padding: 0 !important; margin: 0 !important; font-size: 12px !important; line-height: 1.4 !important;
            color: #c8c9ce !important; text-align: left !important; float: none !important;
          }
          html body #ad-native #carbonads .carbon-poweredby {
            display: flex !important; align-items: center !important; justify-content: space-between !important;
            width: 100% !important; max-width: 100% !important; min-width: 0 !important; height: 30px !important;
            padding: 0 10px !important; margin: 0 !important; border-radius: 8px !important;
            background: #ffffff !important; background-color: #ffffff !important; color: #0f0f10 !important;
            opacity: 1 !important; filter: none !important; font-size: 12.5px !important; font-weight: 500 !important;
            overflow: hidden !important; white-space: nowrap !important;
          }
        `;
        document.head.appendChild(st);
      };
      const iv = setInterval(() => {
        if (slot.querySelector('#carbonads')) { lockCarbonStyle(); box.hidden = false; clearInterval(iv); }
      }, 400);
      setTimeout(() => {
        clearInterval(iv);
        if (!slot.querySelector('#carbonads')) box.remove();
      }, 9000);
    };
    if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 3000 });
    else setTimeout(load, 1600);
  }

  /* =====================================================================
     BACKGROUND STUDIO — procedural background editor (ABEngine)
     Six effects, live canvas, palettes, sliders, HTML/GIF/CSS export and
     a "submit to the library" flow. Everything runs in the browser.
     ===================================================================== */
  const EK = window.ABEngine;
  const FX_ICON = {
    aurora: 'fa-solid fa-sun', waves: 'fa-solid fa-water', particles: 'fa-solid fa-star',
    plasma: 'fa-solid fa-fire', tunnel: 'fa-solid fa-circle-notch', mesh: 'fa-solid fa-layer-group'
  };
  const studioDefaults = () => (EK ? EK.defaults() : {
    effect: 'aurora', colors: ['#ff8a3d', '#ff4d94', '#6b5bff', '#22d3ee'],
    bg: '#0a0a12', speed: 1, complexity: 5, scale: 1, glow: 0.55, angle: 45, grain: 0.05
  });
  const slugify = s => String(s || 'background').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'background';
  const downloadBlob = (blob, name) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  /* ---------- GIF encoding (gifenc, loaded on demand) ---------- */
  async function encodeGif(w, h, opts, { frames = 30, fps = 15, colors = 128, onProgress } = {}) {
    const { GIFEncoder, quantize, applyPalette } = await import('/assets/js/vendor/gifenc.js');
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const gif = GIFEncoder();
    const delay = Math.round(1000 / fps);
    for (let i = 0; i < frames; i++) {
      EK.draw(ctx, w, h, i / fps, opts);
      const { data } = ctx.getImageData(0, 0, w, h);
      const palette = quantize(data, colors);
      const index = applyPalette(data, palette);
      gif.writeFrame(index, w, h, { palette, delay, dispose: 1 });
      if (onProgress) onProgress((i + 1) / frames);
      await new Promise(r => setTimeout(r, 0));
    }
    gif.finish();
    return new Blob([gif.bytes()], { type: 'image/gif' });
  }

  /* ---------- shared control markup ---------- */
  function studioControlsHTML(o) {
    const fx = Object.entries(EK ? EK.EFFECTS : {}).map(([k, label]) =>
      `<button type="button" class="fx-btn${o.effect === k ? ' is-on' : ''}" data-effect="${k}">
        <i class="${FX_ICON[k] || 'fa-solid fa-circle'}"></i><span>${esc(label)}</span></button>`).join('');
    const pals = (EK ? EK.PALETTES : []).map((p, i) =>
      `<button type="button" class="pal-btn${p.join() === o.colors.join() ? ' is-on' : ''}" data-palette="${i}"
        style="background:linear-gradient(120deg,${p.join(',')})" aria-label="Palette ${i + 1}"></button>`).join('');
    return `
      <div class="studio-field">
        <label>Effect</label>
        <div class="fx-grid">${fx}</div>
      </div>
      <div class="studio-field">
        <label>Palette</label>
        <div class="pal-row">${pals}</div>
        <div class="color-row" id="st-colors">${o.colors.map((c, i) =>
          `<label class="swatch" style="background:${c}"><input type="color" value="${c}" data-ci="${i}" aria-label="Colour ${i + 1}"></label>`).join('')}
          <label class="swatch swatch-bg" style="background:${o.bg}" title="Backdrop colour"><input type="color" value="${o.bg}" data-bg="1" aria-label="Backdrop colour"><i class="fa-solid fa-fill-drip"></i></label>
        </div>
      </div>
      <div class="studio-field grid2">
        <div><label for="st-speed">Speed <output id="o-speed">${o.speed.toFixed(2)}×</output></label>
          <input type="range" id="st-speed" min="0.1" max="3" step="0.05" value="${o.speed}"></div>
        <div><label for="st-complexity">Density <output id="o-complexity">${o.complexity}</output></label>
          <input type="range" id="st-complexity" min="2" max="14" step="1" value="${o.complexity}"></div>
        <div><label for="st-scale">Scale <output id="o-scale">${o.scale.toFixed(2)}</output></label>
          <input type="range" id="st-scale" min="0.4" max="2" step="0.02" value="${o.scale}"></div>
        <div><label for="st-glow">Glow <output id="o-glow">${Math.round(o.glow * 100)}%</output></label>
          <input type="range" id="st-glow" min="0" max="1" step="0.01" value="${o.glow}"></div>
        <div><label for="st-angle">Angle <output id="o-angle">${Math.round(o.angle)}°</output></label>
          <input type="range" id="st-angle" min="0" max="360" step="1" value="${o.angle}"></div>
        <div><label for="st-grain">Grain <output id="o-grain">${Math.round(o.grain * 100)}%</output></label>
          <input type="range" id="st-grain" min="0" max="0.25" step="0.005" value="${o.grain}"></div>
      </div>`;
  }

  function studioBindControls(root, state, onChange) {
    root.querySelectorAll('[data-effect]').forEach(b => b.onclick = () => {
      state.effect = b.dataset.effect;
      root.querySelectorAll('[data-effect]').forEach(x => x.classList.toggle('is-on', x === b));
      onChange();
    });
    root.querySelectorAll('[data-palette]').forEach(b => b.onclick = () => {
      state.colors = EK.PALETTES[+b.dataset.palette].slice();
      root.querySelectorAll('[data-palette]').forEach(x => x.classList.toggle('is-on', x === b));
      root.querySelectorAll('#st-colors .swatch').forEach((lab, i) => {
        if (state.colors[i]) { lab.style.background = state.colors[i]; const inp = lab.querySelector('input'); if (inp) inp.value = state.colors[i]; }
      });
      onChange();
    });
    root.querySelectorAll('[data-ci]').forEach(inp => inp.oninput = () => {
      state.colors[+inp.dataset.ci] = inp.value;
      inp.parentElement.style.background = inp.value;
      root.querySelectorAll('[data-palette]').forEach(x => x.classList.remove('is-on'));
      onChange();
    });
    const bgInp = root.querySelector('[data-bg]');
    if (bgInp) bgInp.oninput = () => { state.bg = bgInp.value; bgInp.parentElement.style.background = bgInp.value; onChange(); };
    const sl = (id, key, fmt) => {
      const el = root.querySelector('#st-' + id); if (!el) return;
      el.oninput = () => {
        state[key] = +el.value;
        const out = root.querySelector('#o-' + id); if (out) out.textContent = fmt(+el.value);
        onChange();
      };
    };
    sl('speed', 'speed', v => v.toFixed(2) + '×');
    sl('complexity', 'complexity', v => v);
    sl('scale', 'scale', v => v.toFixed(2));
    sl('glow', 'glow', v => Math.round(v * 100) + '%');
    sl('angle', 'angle', v => Math.round(v) + '°');
    sl('grain', 'grain', v => Math.round(v * 100) + '%');
  }

  /* ---------- submit-to-library ---------- */
  function submitCreation(state) {
    const name = (state.name || '').trim();
    const r = {
      key: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      type: 'new', id: 'studio-' + Date.now().toString(36),
      collection: state.effect, name, note: '', created: Date.now(), status: 'pending',
      data: { effect: state.effect, colors: state.colors.slice(), bg: state.bg, speed: state.speed, complexity: state.complexity, scale: state.scale, glow: state.glow, angle: state.angle, grain: state.grain }
    };
    reqAdd(r);
    const code = reqCode(r);
    const subject = `New background submission${name ? ': ' + name : ''}`;
    const body = [
      `Name: ${name || '(untitled)'}`,
      `Effect: ${state.effect}`,
      `Palette: ${state.colors.join(', ')}`,
      '', 'Request code — paste this into /requests/:', code
    ].join('\n');
    openDialog(`<h2><i class="fa-solid fa-circle-plus" style="color:var(--text-2)"></i> Submit your background</h2>
      <p class="muted">Your creation is saved on this device as a pending request. Send the code to the owner and, if it is a good fit, it joins the library as a featured background.</p>
      <div class="studio-field"><label for="sub-name">Credit name (optional)</label><input id="sub-name" placeholder="Your name or handle" value="${esc(name)}" maxlength="60"></div>
      <pre class="code-box" id="sub-code">${esc(code)}</pre>
      <div class="dialog-actions">
        <button class="btn btn-ghost" data-close>Close</button>
        <button class="btn btn-soft" id="sub-copy"><i class="fa-solid fa-copy"></i> Copy code</button>
        <a class="btn btn-primary" id="sub-mail" href="mailto:${esc(CFG.contactEmail || 'owner@animatedbackgrounds.me')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}"><i class="fa-solid fa-paper-plane"></i> Email it to the owner</a>
      </div>`);
    $('#sub-name').oninput = e => { r.name = e.target.value; const l = reqList(); const i = l.findIndex(x => x.key === r.key); if (i > -1) { l[i].name = e.target.value; reqSave(l); } };
    $('#sub-copy').onclick = () => copy(code, 'Request code copied');
  }

  /* ---------- /create/ ---------- */
  let studioPreview = null;
  function viewCreate() {
    setTitle('Background Studio — design animated backgrounds online',
      'Free online animated background maker: six procedural effects, 8 palettes, live preview and one-click HTML, CSS or GIF export. No signup.');
    const saved = store.get('creatorDraft', null);
    const state = Object.assign(studioDefaults(), saved && saved.effect ? saved : {});

    view().innerHTML = `
      <section class="section" id="studio">
        <div class="section-head">
          <div>
            <h1><i class="fa-solid fa-wand-magic-sparkles" style="color:var(--text-2)"></i> Background Studio</h1>
            <p>Design an animated background, then export it as HTML, CSS or a looping GIF — all in your browser.</p>
          </div>
        </div>

        <div class="studio">
          <div class="studio-stage">
            <div class="stage-frame" id="st-stage">
              <canvas id="st-canvas" aria-label="Live preview of your animated background"></canvas>
              <div class="stage-badge" id="st-badge">Aurora</div>
            </div>
            <div class="stage-bar">
              <button class="btn btn-soft btn-sm" id="st-play"><i class="fa-solid fa-pause"></i> Pause</button>
              <button class="btn btn-soft btn-sm" id="st-shuffle"><i class="fa-solid fa-dice"></i> Surprise me</button>
              <div class="segmented seg-sm" id="st-ratio">
                <button data-ratio="16/9" class="active">16:9</button>
                <button data-ratio="4/3">4:3</button>
                <button data-ratio="9/16">9:16</button>
              </div>
            </div>
            <div class="studio-exports">
              <button class="btn btn-primary" id="st-html"><i class="fa-solid fa-file-code"></i> Download HTML</button>
              <button class="btn btn-soft" id="st-gif"><i class="fa-solid fa-images"></i> Make a GIF</button>
              <button class="btn btn-soft" id="st-css"><i class="fa-solid fa-copy"></i> Copy CSS</button>
              <button class="btn btn-soft" id="st-save"><i class="fa-solid fa-floppy-disk"></i> Save</button>
              <button class="btn btn-ghost" id="st-submit"><i class="fa-solid fa-arrow-up-from-bracket"></i> Submit to the library</button>
            </div>
            <div class="studio-progress" id="st-progress" hidden><div class="bar"><span></span></div><p>Rendering frames…</p></div>
          </div>

          <div class="studio-panel">
            <div class="studio-field"><label for="st-name">Name</label>
              <input id="st-name" placeholder="Untitled background" value="${esc(state.name || '')}" maxlength="60"></div>
            ${studioControlsHTML(state)}
          </div>
        </div>
      </section>

      <section class="section" id="studio-saved">
        <div class="section-head"><div><h2>My creations</h2><p>Saved in this browser only — export or submit to keep them</p></div></div>
        <div id="st-list"></div>
      </section>

      <section class="section" id="studio-gif-cta">
        <div class="guide-cta">
          <div><h3><i class="fa-solid fa-images" style="color:var(--text-2)"></i> Need a still loop instead?</h3>
            <p>Any finished background can be rendered into a seamless GIF — perfect for slides, decks and READMEs.</p></div>
          <a class="btn btn-primary" href="/gif/" data-link><i class="fa-solid fa-arrow-right"></i> Open the GIF converter</a>
        </div>
      </section>`;

    const canvas = $('#st-canvas');
    if (!EK) { $('#st-stage').innerHTML = '<p class="muted" style="padding:24px">The editor engine failed to load.</p>'; return; }
    studioPreview = EK.preview(canvas, state);

    const badge = () => { $('#st-badge').textContent = EK.EFFECTS[state.effect] || state.effect; };
    const paintOpts = () => {
      store.set('creatorDraft', state);
      studioPreview.set(state);
      badge();
    };
    studioBindControls($('.studio-panel'), state, paintOpts);

    $('#st-name').oninput = e => { state.name = e.target.value; };
    $('#st-play').onclick = e => {
      const b = e.currentTarget;
      const paused = b.dataset.paused === '1';
      if (paused) { studioPreview.play(); b.dataset.paused = '0'; b.innerHTML = '<i class="fa-solid fa-pause"></i> Pause'; }
      else { studioPreview.pause(); b.dataset.paused = '1'; b.innerHTML = '<i class="fa-solid fa-play"></i> Play'; }
    };
    $('#st-shuffle').onclick = () => {
      state.effect = Object.keys(EK.EFFECTS)[Math.random() * Object.keys(EK.EFFECTS).length | 0];
      state.colors = EK.PALETTES[Math.random() * EK.PALETTES.length | 0].slice();
      state.speed = +(0.4 + Math.random() * 1.4).toFixed(2);
      state.complexity = 3 + (Math.random() * 8 | 0);
      state.scale = +(0.7 + Math.random() * 0.8).toFixed(2);
      state.glow = +(0.3 + Math.random() * 0.6).toFixed(2);
      state.angle = Math.random() * 360 | 0;
      viewCreate();
    };
    $$('#st-ratio button').forEach(b => b.onclick = () => {
      $$('#st-ratio button').forEach(x => x.classList.toggle('active', x === b));
      $('#st-stage').style.setProperty('--ratio', b.dataset.ratio);
    });
    $('#st-html').onclick = () => {
      const html = EK.standaloneHTML(Object.assign({}, state, { name: state.name || 'Animated background' }));
      downloadBlob(new Blob([html], { type: 'text/html' }), slugify(state.name) + '.html');
      toast('HTML downloaded');
    };
    $('#st-css').onclick = () => copy(EK.cssFor(state), 'CSS copied');
    $('#st-save').onclick = () => {
      const cs = store.get('creations', []);
      cs.unshift(Object.assign({}, state, { id: Date.now().toString(36), colors: state.colors.slice() }));
      store.set('creations', cs.slice(0, 60)); renderList(); toast('Saved to My creations');
    };
    $('#st-submit').onclick = () => submitCreation(state);
    $('#st-gif').onclick = async e => {
      const btn = e.currentTarget;
      const prog = $('#st-progress');
      btn.disabled = true; prog.hidden = false;
      const bar = prog.querySelector('.bar span'), label = prog.querySelector('p');
      label.textContent = 'Rendering frames…';
      try {
        const blob = await encodeGif(480, 270, state, {
          frames: 30, fps: 15, colors: 128,
          onProgress: p => { bar.style.width = Math.round(p * 100) + '%'; }
        });
        label.textContent = 'Done — check your downloads.';
        downloadBlob(blob, slugify(state.name) + '.gif');
        toast('GIF exported');
      } catch (err) {
        label.textContent = 'Could not render the GIF in this browser.';
      } finally {
        btn.disabled = false;
        setTimeout(() => { prog.hidden = true; bar.style.width = '0%'; }, 2200);
      }
    };

    function renderList() {
      const cs = store.get('creations', []);
      $('#st-list').innerHTML = cs.length ? `<div class="creations">${cs.map(c => `
        <article class="creation">
          <div class="creation-sw" style="background:linear-gradient(120deg,${(c.colors || []).join(',')})"></div>
          <strong>${esc(c.name || 'Untitled')}</strong>
          <p class="muted">${esc((EK.EFFECTS[c.effect] || c.effect || 'aurora'))}</p>
          <div class="chips">
            <button class="btn btn-soft btn-sm" data-load="${c.id}">Edit</button>
            <button class="btn btn-soft btn-sm" data-gif="${c.id}">GIF</button>
            <button class="btn btn-ghost btn-sm" data-del="${c.id}" aria-label="Delete"><i class="fa-solid fa-trash"></i></button>
          </div>
        </article>`).join('')}</div>`
        : emptyHTML('fa-solid fa-palette', 'No creations yet', 'Design something above and press Save — it stays on this device.');
      $$('#st-list [data-load]').forEach(b => b.onclick = () => {
        const c = store.get('creations', []).find(x => x.id === b.dataset.load);
        if (c) { store.set('creatorDraft', c); viewCreate(); scrollTo({ top: 0, behavior: 'smooth' }); }
      });
      $$('#st-list [data-del]').forEach(b => b.onclick = () => {
        store.set('creations', store.get('creations', []).filter(x => x.id !== b.dataset.del)); renderList();
      });
      $$('#st-list [data-gif]').forEach(b => b.onclick = async () => {
        const c = store.get('creations', []).find(x => x.id === b.dataset.gif); if (!c) return;
        b.disabled = true; b.textContent = '…';
        try { downloadBlob(await encodeGif(480, 270, c, { frames: 30, fps: 15, colors: 128 }), slugify(c.name) + '.gif'); toast('GIF exported'); }
        catch (e) { toast('GIF rendering failed here', 'fa-solid fa-triangle-exclamation'); }
        b.disabled = false; b.textContent = 'GIF';
      });
    }
    renderList();
  }

  /* ---------- /gif/ ---------- */
  function viewConvert(q) {
    setTitle('Animated background to GIF converter — free, in your browser',
      'Convert any animated background into a looping GIF. Pick an effect and palette, choose the size and frame rate, then download the GIF instantly.');
    const state = Object.assign(studioDefaults(), { effect: 'aurora' }, (() => {
      try { return q.get('p') ? JSON.parse(atob(q.get('p'))) : {}; } catch (e) { return {}; }
    })());
    view().innerHTML = `
      <section class="section" id="gif-converter">
        <div class="section-head"><div>
          <h1><i class="fa-solid fa-images" style="color:var(--text-2)"></i> Animated background to GIF</h1>
          <p>Turn any animated background into a looping GIF — rendered frame by frame in your browser, nothing uploaded.</p>
        </div></div>

        <div class="studio">
          <div class="studio-stage">
            <div class="stage-frame" id="gif-stage" style="--ratio:16/9">
              <canvas id="gif-canvas" aria-label="GIF source preview"></canvas>
              <div class="stage-badge">Preview</div>
            </div>
            <div class="studio-field grid3">
              <div><label for="gif-size">Size</label>
                <select id="gif-size">
                  <option value="320x180">320 × 180 (small)</option>
                  <option value="480x270" selected>480 × 270 (recommended)</option>
                  <option value="640x360">640 × 360 (large)</option>
                  <option value="360x640">360 × 640 (portrait)</option>
                  <option value="400x400">400 × 400 (square)</option>
                </select></div>
              <div><label for="gif-fps">Frame rate</label>
                <select id="gif-fps"><option value="10">10 fps</option><option value="12">12 fps</option><option value="15" selected>15 fps</option><option value="20">20 fps</option></select></div>
              <div><label for="gif-len">Length</label>
                <select id="gif-len"><option value="1.5">1.5 s</option><option value="2" selected>2 s</option><option value="3">3 s</option><option value="4">4 s</option></select></div>
            </div>
            <div class="studio-exports">
              <button class="btn btn-primary" id="gif-go"><i class="fa-solid fa-download"></i> Convert to GIF</button>
              <button class="btn btn-soft" id="gif-random"><i class="fa-solid fa-dice"></i> Random look</button>
              <a class="btn btn-ghost" href="/create/" data-link><i class="fa-solid fa-wand-magic-sparkles"></i> Open the studio</a>
            </div>
            <div class="studio-progress" id="gif-progress" hidden><div class="bar"><span></span></div><p>Rendering frames…</p></div>
            <div id="gif-out"></div>
          </div>
          <div class="studio-panel">${studioControlsHTML(state)}</div>
        </div>
      </section>

      <section class="section" id="gif-about">
        <h2>How converting an animated background to a GIF works</h2>
        <p>Each frame is drawn on a canvas by the same engine that powers the live previews, quantised to a 128-colour palette and written into a single looping GIF with <code>gifenc</code>. Because the whole process runs in your browser, your artwork never leaves the device and there is no upload limit.</p>
        <p>GIF is ideal for slides, documentation, READMEs and chat previews where CSS animations cannot run. For a real website, a live <a href="/collection/gradient/" data-link>CSS animated background</a> will always be sharper and far lighter than a GIF.</p>
      </section>`;

    const cw = () => +($('#gif-size').value.split('x')[0]);
    const ch = () => +($('#gif-size').value.split('x')[1]);
    studioPreview = EK.preview($('#gif-canvas'), state);
    studioBindControls($('.studio-panel'), state, () => { studioPreview.set(state); });
    $('#gif-random').onclick = () => {
      state.effect = Object.keys(EK.EFFECTS)[Math.random() * Object.keys(EK.EFFECTS).length | 0];
      state.colors = EK.PALETTES[Math.random() * EK.PALETTES.length | 0].slice();
      viewConvert(new URLSearchParams());
    };
    $('#gif-go').onclick = async e => {
      const btn = e.currentTarget;
      const prog = $('#gif-progress'), bar = prog.querySelector('.bar span'), label = prog.querySelector('p');
      btn.disabled = true; prog.hidden = false; bar.style.width = '0%';
      const fps = +$('#gif-fps').value, len = +$('#gif-len').value;
      const frames = Math.max(8, Math.round(fps * len));
      label.textContent = `Rendering ${frames} frames…`;
      try {
        const blob = await encodeGif(cw(), ch(), state, {
          frames, fps, colors: 128,
          onProgress: p => { bar.style.width = Math.round(p * 100) + '%'; }
        });
        const kb = Math.round(blob.size / 1024);
        label.textContent = `Done — ${kb} KB`;
        const url = URL.createObjectURL(blob);
        $('#gif-out').innerHTML = `<div class="gif-result"><img src="${url}" alt="Your converted animated GIF" width="${cw()}" height="${ch()}">
          <div><p><b>${cw()} × ${ch()} · ${fps} fps · ${len}s · ${kb} KB</b></p>
          <div class="chips"><a class="btn btn-primary btn-sm" id="gif-dl" download="animated-background.gif" href="${url}"><i class="fa-solid fa-download"></i> Download GIF</a>
          <button class="btn btn-soft btn-sm" id="gif-again"><i class="fa-solid fa-rotate"></i> Render again</button></div></div></div>`;
        $('#gif-again').onclick = () => $('#gif-go').click();
        toast('GIF ready');
      } catch (err) {
        label.textContent = 'This browser could not encode the GIF.';
        toast('GIF encoding failed', 'fa-solid fa-triangle-exclamation');
      } finally {
        btn.disabled = false;
        setTimeout(() => { prog.hidden = true; }, 2500);
      }
    };
  }

  /* ---------------- Router ---------------- */
  const routes = [
    [/^\/$/, viewHome], [/^\/all\/?$/, viewAll], [/^\/popular\/?$/, viewPopular], [/^\/random\/?$/, viewRandom],
    [/^\/favorites\/?$/, viewFavorites], [/^\/create\/?$/, viewCreate], [/^\/search\/?$/, viewSearch],
    [/^\/gif\/?$/, viewConvert],
    [/^\/collection\/([^/]+)\/?$/, viewCollection], [/^\/background\/([^/]+)\/?$/, viewBackground],
    [/^\/(index\.html|404\.html)$/, viewHome]
  ];
  const matchRoute = path => { for (const [re, fn] of routes) { const m = path.match(re); if (m) return [fn, m.slice(1).map(decodeURIComponent)]; } return null; };

  function setActiveNav(path) {
    const seg = path === '/' ? 'home' : path.split('/')[1];
    const key = { collection: 'all', background: 'all', search: 'all' }[seg] || seg;
    $$('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === key));
    const topKey = key === 'home' ? 'all' : key;
    $$('#top-nav [data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === topKey));
    $$('.side-mode-switch .mode-tab').forEach(a => a.classList.toggle('active', key === 'create' ? a.dataset.nav === 'create' : a.dataset.nav === 'all'));
    const slug = seg === 'collection' ? path.split('/')[2] : null;
    $$('#side-cats a').forEach(a => a.classList.toggle('active', !!slug && a.getAttribute('href') === `/collection/${slug}/`));
  }
  async function render(url, push = true) {
    const u = new URL(url, location.origin);
    const m = matchRoute(u.pathname);
    if (push && (!m || !isSpa())) { location.href = u.href; return; }
    if (!m) { await loadData(); setActiveNav(u.pathname); viewNotFound(); return; }
    if (push) history.pushState({ spa: true }, '', u.pathname + u.search + u.hash);
    closeMenu(); closePopover(); if (S.modalOpen) closeModal(true);
    setActiveNav(u.pathname);
    if (S.observer) S.observer.disconnect();
    if (studioPreview) { try { studioPreview.destroy(); } catch (e) { } studioPreview = null; }
    view().onclick = null; view().oninput = null;
    await loadData();
    m[0](m[1], u.searchParams);
    if (push) window.scrollTo(0, 0);
    if (window.gtag && push) gtag('event', 'page_view', { page_path: u.pathname });
  }

  /* ---------------- Modal ---------------- */
  function openModal(id, list) {
    const b = S.byId.get(id); if (!b) return;
    S.modalList = (list && list.length ? list : S.bgs).map(x => x.id);
    S.modalIdx = S.modalList.indexOf(id);
    if (S.modalIdx < 0) { S.modalList.unshift(id); S.modalIdx = 0; }
    const m = $('#bg-modal');
    if (!S.modalOpen) { history.pushState({ spa: isSpa(), modal: id }, '', location.href); }
    S.modalOpen = true;
    m.hidden = false; document.body.style.overflow = 'hidden';
    fillModal(b);
  }
  function fillModal(b) {
    const id = b.id;
    $('#modal-title').textContent = b.name;
    $('#modal-sub').textContent = `by ${b.by} · ${S.modalIdx + 1} of ${S.modalList.length}`;
    const stage = $('#modal-stage');
    stage.innerHTML = `${thumb(b) ? `<img class="stage-poster" src="${thumb(b)}" alt="">` : ''}<div class="stage-loading"><span><i class="fa-solid fa-circle-notch fa-spin"></i> Loading live preview…</span></div>`;
    clearTimeout(fillModal.t);
    fillModal.t = setTimeout(() => {
      const f = document.createElement('iframe');
      f.src = embedUrl(b); f.title = b.name; f.allow = 'accelerometer; fullscreen'; f.setAttribute('allowfullscreen', '');
      f.onload = () => { const l = stage.querySelector('.stage-loading'); if (l) l.remove(); };
      stage.appendChild(f);
    }, 120);
    const vEl = $('#modal-views'), lEl = $('#modal-likes');
    vEl.dataset.views = id; lEl.dataset.likes = id; const hIc = $('#bg-modal [data-like-icon]'); if (hIc) hIc.dataset.likeIcon = id;
    vEl.textContent = fmt(viewsOf(id)); lEl.textContent = fmt(likesOf(id));
    $('#modal-tags').innerHTML = b.tags.map(t => `<a class="chip chip-xs" href="/collection/${t}/" data-link>${esc(S.catMap.get(t).name)}</a>`).join('');
    const like = $('#modal-like'); like.dataset.like = id;
    const tagBtn = $('#modal-tag'); if (tagBtn) tagBtn.dataset.tag = id;
    const panel = $('#tag-panel'); if (panel) { panel.hidden = true; panel.innerHTML = ''; }
    $('#modal-share').dataset.shareUrl = pageUrl(b); $('#modal-share').dataset.shareTitle = b.name;
    $('#modal-embed').dataset.embed = id;
    $('#modal-full').href = fullUrl(b);
    $('#modal-code').href = penUrl(b);
    refreshCounts(id);
    renderModalRecs(b);
    const mc = $('#modal-card'); if (mc) mc.scrollTop = 0;
    countView(id); fetchLikes(id);
    if (window.gtag) gtag('event', 'view_item', { item_id: id });
  }
  function renderModalRecs(b) {
    const box = $('#modal-recs');
    if (!box || !S.bgs.length) return;
    const tagSet = new Set(b.tags || []);
    const same = shuffle(S.bgs.filter(x => x.id !== b.id && x.tags.some(t => tagSet.has(t)))).slice(0, 4);
    const used = new Set([b.id, ...same.map(x => x.id)]);
    const randNeed = Math.max(2, 6 - same.length);
    const rand = shuffle(S.bgs.filter(x => !used.has(x.id))).slice(0, randNeed);
    const picks = [
      ...same.map(x => ({ b: x, label: (S.catMap.get(x.tags.find(t => tagSet.has(t))) || {}).name || 'Similar' })),
      ...rand.map(x => ({ b: x, label: 'Discover' }))
    ];
    if (!picks.length) { box.innerHTML = ''; return; }
    box.innerHTML = `
      <div class="modal-recs-head">
        <div>
          <h3>More like this</h3>
          <p>Similar styles &amp; hand-picked discoveries</p>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" id="modal-recs-shuffle"><i class="fa-solid fa-shuffle"></i> Refresh picks</button>
      </div>
      <div class="modal-recs-grid">
        ${picks.map(({ b: x, label }) => `
          <button type="button" class="rec-card" data-rec-open="${esc(x.id)}">
            <span class="rec-thumb">
              ${shotHTML(x, { alt: x.name })}
              <span class="rec-badge">${esc(label)}</span>
            </span>
            <span class="rec-info">
              <strong title="${esc(x.name)}">${esc(x.name)}</strong>
              <span><i class="fa-regular fa-eye"></i> ${fmt(viewsOf(x.id))}</span>
            </span>
          </button>`).join('')}
      </div>`;
    checkImages(box);
    $$('[data-rec-open]', box).forEach(btn => {
      btn.onclick = () => {
        const nextId = btn.dataset.recOpen;
        const nextBg = S.byId.get(nextId);
        if (!nextBg) return;
        const idx = S.modalList.indexOf(nextId);
        if (idx >= 0) S.modalIdx = idx;
        else { S.modalList.unshift(nextId); S.modalIdx = 0; }
        fillModal(nextBg);
      };
    });
    const sh = $('#modal-recs-shuffle');
    if (sh) sh.onclick = () => renderModalRecs(b);
  }
  function stepModal(d) {
    if (!S.modalOpen || !S.modalList.length) return;
    S.modalIdx = (S.modalIdx + d + S.modalList.length) % S.modalList.length;
    fillModal(S.byId.get(S.modalList[S.modalIdx]));
  }
  function closeModal(fromPop) {
    if (!S.modalOpen) return;
    S.modalOpen = false;
    clearTimeout(fillModal.t);
    $('#bg-modal').hidden = true; $('#modal-stage').innerHTML = ''; document.body.style.overflow = '';
    const panel = $('#tag-panel'); if (panel) { panel.hidden = true; panel.innerHTML = ''; }
    if (!fromPop && history.state && history.state.modal) { S.ignorePop = true; history.back(); }
  }

  /* ---------------- dialogs ---------------- */
  function openDialog(html) {
    $('#dialog-body').innerHTML = html; $('#dialog').hidden = false;
    const f = $('#dialog-body input, #dialog-body textarea, #dialog-body button'); if (f) setTimeout(() => f.focus(), 30);
  }
  const closeDialog = () => { $('#dialog').hidden = true; $('#dialog-body').innerHTML = ''; };

  function embedDialog(id) {
    const b = S.byId.get(id); if (!b) return;
    const iframe = `<!-- "${b.name}" by ${b.by} — ${penUrl(b)} (check the pen's license) -->\n<iframe src="https://codepen.io/${b.user}/embed/${b.id}?default-tab=result&theme-id=dark" title="${esc(b.name)}" loading="lazy" style="position:fixed;inset:0;width:100%;height:100%;border:0;z-index:-1" allowfullscreen></iframe>`;
    openDialog(`<h2><i class="fa-solid fa-code"></i> Use this background</h2>
      <p class="muted">Quickest way: embed the live pen behind your content. For best performance, open <b>Get Code</b> and copy the HTML/CSS/JS into your project. New to this? Read the <a href="/guide/">step-by-step guide</a>.</p>
      <pre class="code-box">${esc(iframe)}</pre>
      <div class="dialog-actions"><a class="btn btn-soft" href="${penUrl(b)}" target="_blank" rel="noopener"><i class="fa-brands fa-codepen"></i> Get Code</a><button class="btn btn-primary" id="copy-embed"><i class="fa-solid fa-copy"></i> Copy embed</button></div>`);
    $('#copy-embed').onclick = () => copy(iframe, 'Embed code copied');
  }
  function submitDialog() {
    openDialog(`<h2><i class="fa-solid fa-circle-plus" style="color:var(--text-2)"></i> Submit a background</h2>
      <p class="muted">Found (or made) an awesome animated background on CodePen? Send it to us and we'll add it to a collection.</p>
      <form id="submit-form">
        <div class="field"><label for="sf-url">CodePen URL *</label><input id="sf-url" required placeholder="https://codepen.io/user/pen/AbCdEf"></div>
        <div id="sf-preview"></div>
        <div class="field"><label for="sf-cat">Collection</label><select id="sf-cat"><option value="">Not sure</option>${S.cats.map(c => `<option value="${c.slug}">${esc(c.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="sf-name">Your name (optional)</label><input id="sf-name" placeholder="Jane"></div>
        <div class="dialog-actions"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" type="submit"><i class="fa-solid fa-paper-plane"></i> Send</button></div>
      </form>`);
    const rx = /codepen\.io\/([\w-]+)\/(?:pen|full|details|embed|debug)\/([A-Za-z0-9]+)/;
    $('#sf-url').oninput = e => {
      const m = e.target.value.match(rx);
      $('#sf-preview').innerHTML = m ? `<img src="https://shots.codepen.io/${m[1]}/pen/${m[2]}-512.jpg" alt="Preview" style="border-radius:12px;margin:0 0 14px;max-height:180px;object-fit:cover;width:100%" onerror="this.style.display='none'">` +
        (S.byId.has(m[2]) ? '<p style="color:var(--green);font-weight:700;margin-top:-6px"><i class="fa-solid fa-circle-check"></i> Already in our library — thanks!</p>' : '') : '';
    };
    $('#submit-form').onsubmit = e => {
      e.preventDefault();
      const url = $('#sf-url').value.trim();
      if (!rx.test(url)) { toast('Please paste a valid CodePen pen URL', 'fa-solid fa-triangle-exclamation'); return; }
      const body = `New background submission\n\nURL: ${url}\nCollection: ${$('#sf-cat').value || '-'}\nFrom: ${$('#sf-name').value || '-'}`;
      location.href = `mailto:${CFG.contactEmail || 'owner@animatedbackgrounds.me'}?subject=${encodeURIComponent('Background submission')}&body=${encodeURIComponent(body)}`;
      closeDialog(); toast('Thanks! Your email app should open now.');
    };
  }
  function exportLikes() {
    const data = JSON.stringify({ app: 'animatedbackgrounds.me', exported: new Date().toISOString(), likes: Likes.list, creations: store.get('creations', []) }, null, 2);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    a.download = 'animatedbackgrounds-favorites.json'; a.click();
  }
  function importLikes() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json';
    inp.onchange = async () => {
      try {
        const d = JSON.parse(await inp.files[0].text());
        const ids = (d.likes || []).filter(id => typeof id === 'string');
        Likes.list = [...new Set([...ids, ...Likes.list])]; store.set('likes', Likes.list);
        if (Array.isArray(d.creations)) store.set('creations', d.creations);
        updateNavCounts(); toast(`Imported ${ids.length} favorites`);
        if (isSpa()) render(location.pathname + location.search, false);
      } catch (e) { toast('That file could not be imported', 'fa-solid fa-triangle-exclamation'); }
    };
    inp.click();
  }

  /* ---------------- popover menus ---------------- */
  function openPopover(anchor, html) {
    const p = $('#popover');
    p.innerHTML = html; p.hidden = false;
    const r = anchor.getBoundingClientRect();
    const w = p.offsetWidth, h = p.offsetHeight;
    const left = Math.min(window.innerWidth - w - 10, Math.max(10, r.right - w));
    let top = r.bottom + 6; if (top + h > window.innerHeight - 10) top = Math.max(10, r.top - h - 6);
    p.style.left = left + 'px'; p.style.top = top + 'px';
    S.popAnchor = anchor;
  }
  function closePopover() { const p = $('#popover'); if (p && !p.hidden) { p.hidden = true; p.innerHTML = ''; S.popAnchor = null; } }
  function cardMenu(anchor, id) {
    const b = S.byId.get(id); if (!b) return;
    const liked = Likes.has(id);
    openPopover(anchor, `
      <button data-act="preview" data-id="${esc(id)}"><i class="fa-solid fa-play"></i> Live preview</button>
      <button data-act="tag" data-id="${esc(id)}"><i class="fa-solid fa-tags"></i> Add to a collection</button>
      <button data-act="like" data-id="${esc(id)}"><i class="${liked ? 'fa-solid' : 'fa-regular'} fa-heart"></i> ${liked ? 'Remove from favorites' : 'Add to favorites'}</button>
      <a href="/background/${esc(id)}/" data-link><i class="fa-solid fa-up-right-from-square"></i> Open details page</a>
      <hr>
      <button data-act="share" data-id="${esc(id)}"><i class="fa-solid fa-share-nodes"></i> Share</button>
      <button data-act="link" data-id="${esc(id)}"><i class="fa-solid fa-link"></i> Copy link</button>
      <button data-act="embed" data-id="${esc(id)}"><i class="fa-solid fa-code"></i> Embed code</button>
      <a href="${penUrl(b)}" target="_blank" rel="noopener"><i class="fa-brands fa-codepen"></i> Get code on CodePen</a>
      <hr>
      <a href="mailto:${esc(CFG.contactEmail || 'owner@animatedbackgrounds.me')}?subject=${encodeURIComponent('Broken background ' + id)}"><i class="fa-regular fa-flag"></i> Report a problem</a>`);
  }
  function collectionMenu(anchor, slug) {
    const c = S.catMap.get(slug); if (!c) return;
    openPopover(anchor, `
      <a href="/collection/${slug}/" data-link><i class="fa-solid fa-folder-open"></i> Open collection</a>
      <button data-act="cshare" data-slug="${slug}"><i class="fa-solid fa-share-nodes"></i> Share</button>
      <button data-act="clink" data-slug="${slug}"><i class="fa-solid fa-link"></i> Copy link</button>
      <button data-act="crandom" data-slug="${slug}"><i class="fa-solid fa-shuffle"></i> Random from collection</button>`);
  }
  function settingsMenu(anchor) {
    const theme = store.get('theme', 'dark'), density = store.get('density', 'comfy');
    const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    openPopover(anchor, `
      <div class="pop-label">Theme</div>
      <div class="pop-row"><div class="segmented" id="seg-theme">${[['light', 'fa-sun', 'Light'], ['dark', 'fa-moon', 'Dark'], ['system', 'fa-circle-half-stroke', 'Auto']].map(([v, i, l]) => `<button data-theme="${v}" class="${theme === v ? 'active' : ''}"><i class="fa-solid ${i}"></i> ${l}</button>`).join('')}</div></div>
      <div class="pop-label">Grid</div>
      <div class="pop-row"><div class="segmented">${[['comfy', 'Comfortable'], ['compact', 'Compact']].map(([v, l]) => `<button data-density="${v}" class="${density === v ? 'active' : ''}">${l}</button>`).join('')}</div></div>
      <hr>
      ${!standalone && (S.deferredInstall || iOS) ? `<button data-act="install"><i class="fa-solid fa-mobile-screen"></i> Install app</button>` : ''}
      <button data-act="export"><i class="fa-solid fa-file-export"></i> Export favorites</button>
      <button data-act="import"><i class="fa-solid fa-file-import"></i> Import favorites</button>
      <button data-act="clear-likes"><i class="fa-solid fa-heart-crack"></i> Clear favorites</button>
      <button data-act="clear-cache"><i class="fa-solid fa-broom"></i> Clear offline cache</button>
      ${window.ABMonetize && window.ABMonetize.hasProviders() ? `<hr><div class="pop-label">Support us</div><button data-act="support"><i class="fa-solid fa-microchip"></i> ${window.ABMonetize.consent() === 'granted' ? 'Stop sharing idle compute' : 'Share idle compute (opt-in)'}</button>` : ''}
      <hr>
      <a href="/guide/"><i class="fa-solid fa-book-open"></i> How to use</a>
      <a href="/about/"><i class="fa-solid fa-circle-info"></i> About</a>`);
  }
  function applyTheme() {
    const t = store.get('theme', 'dark');
    const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    const m = $('meta[name="theme-color"]'); if (m) m.content = dark ? '#0f0f10' : '#f2f2f3';
  }
  function applyDensity() {
    const c = store.get('density', 'comfy') === 'compact';
    document.documentElement.classList.toggle('compact', c);
    const i = $('#density-btn i'); if (i) i.className = 'fa-solid ' + (c ? 'fa-table-cells' : 'fa-table-cells-large');
  }
  async function installApp() {
    if (S.deferredInstall) {
      S.deferredInstall.prompt();
      const r = await S.deferredInstall.userChoice; S.deferredInstall = null;
      const b = $('#install-btn'); if (b) b.hidden = true;
      if (r.outcome === 'accepted') toast('Installing Animated Backgrounds…');
    } else {
      openDialog(`<h2><i class="fa-solid fa-mobile-screen"></i> Install the app</h2>
        <p>On iPhone / iPad: tap the <b>Share</b> <i class="fa-solid fa-arrow-up-from-bracket"></i> button in Safari, then choose <b>“Add to Home Screen”</b>.</p>
        <p class="muted">On Android / desktop Chrome &amp; Edge: use the install icon in the address bar or the browser menu → “Install app”.</p>
        <div class="dialog-actions"><button class="btn btn-primary" data-close>Got it</button></div>`);
    }
  }

  /* ---------------- mobile menu ---------------- */
  function openMenu() { document.body.classList.add('menu-open'); const s = $('#scrim'); if (s) s.hidden = false; }
  function closeMenu() { document.body.classList.remove('menu-open'); const s = $('#scrim'); if (s) s.hidden = true; }

  /* ---------------- global events ---------------- */
  document.addEventListener('load', e => {
    const t = e.target; if (t.tagName === 'IMG') t.classList.add('loaded');
  }, true);
  // Local screenshots are generated for every listed background. If one is
  // ever missing, swap in the tinted gradient tile instead of a broken image.
  document.addEventListener('error', e => {
    const t = e.target;
    if (t.tagName !== 'IMG' || !/\/assets\/shots\//.test(t.src)) return;
    t.classList.add('failed');
    const id = t.dataset.shot;
    const b = id && S.byId.get(id);
    const tint = b ? catTint(b) : ['#f1efec', '#e9e6e1'];
    const ph = document.createElement('span');
    ph.className = 'shot-fallback';
    ph.setAttribute('role', 'img');
    ph.setAttribute('aria-label', t.alt || 'Animated background');
    ph.style.cssText = `--fa:${tint[0]};--fb:${tint[1]}`;
    ph.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i>';
    t.replaceWith(ph);
  }, true);

  document.addEventListener('click', e => {
    const t = e.target;
    if (!t.closest('#popover') && !t.closest('[data-menu],[data-cmenu],#settings-btn')) closePopover();

    // guide: copy buttons
    const cc = t.closest('.copy-code');
    if (cc) {
      e.preventDefault();
      const pre = cc.closest('.code-block');
      const code = pre && pre.querySelector('code');
      copy(code ? code.textContent : '');
      return;
    }

    const like = t.closest('[data-like]'); if (like) { e.preventDefault(); likeClick(like); return; }
    const tagBtn = t.closest('[data-tag]');
    if (tagBtn) {
      e.preventDefault();
      const id = tagBtn.dataset.tag, b = S.byId.get(id); if (!b) return;
      openTagPanel(b, tagBtn.closest('.modal-card') ? $('#tag-panel') : $('#detail-tag-panel'));
      return;
    }
    const open = t.closest('[data-open]');
    if (open && !e.metaKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); openModal(open.dataset.open, S.list && S.list.some(b => b.id === open.dataset.open) ? S.list : visibleList()); return; }
    const menu = t.closest('[data-menu]'); if (menu) { e.preventDefault(); S.popAnchor === menu ? closePopover() : cardMenu(menu, menu.dataset.menu); return; }
    const cmenu = t.closest('[data-cmenu]'); if (cmenu) { e.preventDefault(); S.popAnchor === cmenu ? closePopover() : collectionMenu(cmenu, cmenu.dataset.cmenu); return; }
    const sh = t.closest('[data-share-url]'); if (sh) { e.preventDefault(); share(sh.dataset.shareTitle || document.title, sh.dataset.shareUrl); return; }
    const emb = t.closest('[data-embed]'); if (emb) { e.preventDefault(); embedDialog(emb.dataset.embed); return; }
    const cl = t.closest('[data-copy-link]'); if (cl) { e.preventDefault(); copy(cl.dataset.copyLink || location.href, 'Link copied'); return; }
    const th = t.closest('[data-theme]'); if (th) { store.set('theme', th.dataset.theme); applyTheme(); $$('[data-theme]').forEach(b => b.classList.toggle('active', b === th)); return; }
    const de = t.closest('[data-density]'); if (de) { store.set('density', de.dataset.density); applyDensity(); $$('[data-density]').forEach(b => b.classList.toggle('active', b === de)); return; }

    const act = t.closest('[data-act]');
    if (act) {
      const id = act.dataset.id, slug = act.dataset.slug, b = id && S.byId.get(id);
      closePopover();
      switch (act.dataset.act) {
        case 'preview': openModal(id, visibleList()); break;
        case 'tag': openModal(id, visibleList()); setTimeout(() => { const bb = S.byId.get(id); if (bb) openTagPanel(bb, $('#tag-panel')); }, 60); break;
        case 'like': { const btn = document.querySelector(`.bg-card [data-like="${CSS.escape(id)}"]`); btn ? likeClick(btn) : toggleLike(id); break; }
        case 'share': share(b.name, pageUrl(b)); break;
        case 'link': copy(pageUrl(b), 'Link copied'); break;
        case 'embed': embedDialog(id); break;
        case 'cshare': share(S.catMap.get(slug).name, `${SITE}/collection/${slug}/`); break;
        case 'clink': copy(`${SITE}/collection/${slug}/`, 'Link copied'); break;
        case 'crandom': { const it = S.catMap.get(slug).items; openModal(it[Math.random() * it.length | 0].id, it); break; }
        case 'install': installApp(); break;
        case 'export': exportLikes(); break;
        case 'import': importLikes(); break;
        case 'clear-likes': if (confirm('Remove all favorites from this device?')) { Likes.clear(); if (isSpa()) render(location.pathname + location.search, false); } break;
        case 'support': window.ABMonetize && window.ABMonetize.toggleConsent(); break;
        case 'clear-cache': if ('caches' in window) caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))).then(() => toast('Offline cache cleared')); break;
      }
      return;
    }
    if (t.closest('[data-close]')) { e.preventDefault(); if (t.closest('#bg-modal')) closeModal(); else closeDialog(); return; }

    const a = t.closest('a[data-link]');
    if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey && a.target !== '_blank') {
      e.preventDefault(); closePopover();
      if (S.modalOpen) { closeModal(true); history.replaceState({ spa: true }, '', location.href); }
      render(a.getAttribute('href'));
    }
  });
  function visibleList() {
    const ids = $$('#view .bg-card').map(c => c.dataset.id);
    return [...new Set(ids)].map(id => S.byId.get(id)).filter(Boolean);
  }

  window.addEventListener('popstate', e => {
    if (S.ignorePop) { S.ignorePop = false; return; }
    if (S.modalOpen && !(e.state && e.state.modal)) { closeModal(true); return; }
    if ($('#dialog') && !$('#dialog').hidden) closeDialog();
    if (isSpa() && matchRoute(location.pathname)) render(location.pathname + location.search, false);
    else if (!(e.state && e.state.modal)) location.reload();
  });

  document.addEventListener('keydown', e => {
    const typing = /input|textarea|select/i.test(document.activeElement.tagName);
    if (e.key === 'Escape') { closePopover(); if ($('#dialog') && !$('#dialog').hidden) closeDialog(); else if (S.modalOpen) closeModal(); closeMenu(); }
    if (typing) return;
    if (e.key === '/') { const i = $('#search-input'); if (i) { e.preventDefault(); i.focus(); } }
    if (S.modalOpen) {
      if (e.key === 'ArrowRight') stepModal(1);
      if (e.key === 'ArrowLeft') stepModal(-1);
      if (e.key.toLowerCase() === 'l') { const l = $('#modal-like'); if (l) likeClick(l); }
    }
  });
  window.addEventListener('scroll', () => closePopover(), { passive: true });
  window.addEventListener('resize', () => closePopover());

  /* ---------------- /requests/ owner queue (no backend) ---------------- */
  async function sha256(str) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) { return ''; }
  }
  function initAdmin() {
    const box = $('#admin'); if (!box) return;
    const HASH = (CFG.adminHash || '').toLowerCase();
    const API = (CFG.apiBase || '').replace(/\/$/, '');
    let open = session.get('admin-token') === 'ok';
    let adminPass = session.get('admin-pass') || '';
    let tab = 'manage'; // 'manage' | 'screenshots' | 'add' | 'queue'
    let bgQuery = '';
    let bgFilter = 'all';
    let shotFilter = 'all';
    let bgLimit = 40;

    const getRemoved = () => store.get('removed', []);
    const saveRemoved = ids => store.set('removed', [...new Set(ids)]);
    const getAdded = () => store.get('added', []);
    const saveAdded = arr => store.set('added', arr);
    const getGh = () => store.get('gh-sync', { repo: '', branch: 'main', token: '' });
    const hasGlobal = () => !!(API || (getGh().repo && getGh().token));

    const b64enc = str => { const bytes = new TextEncoder().encode(str); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(bin); };
    const b64dec = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, '')), c => c.charCodeAt(0)));

    // Commit change directly to data/backgrounds.json on GitHub (or via Cloudflare Worker) so it updates for EVERYBODY
    async function publishGlobal(action, payload) {
      if (API) {
        const r = await fetch(`${API}/api/backgrounds/${action}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${adminPass}` },
          body: JSON.stringify(payload)
        });
        const res = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(res.error || `API error ${r.status}`);
        return 'Published globally via Worker — site rebuild triggered for everybody.';
      }

      const gh = getGh();
      if (!gh.repo || !gh.token) {
        if (action === 'screenshot') throw new Error('Connect Global Sync first. Screenshot changes must be saved to GitHub to appear for everyone.');
        return null;
      }

      const branch = gh.branch || 'main';
      const url = `https://api.github.com/repos/${gh.repo}/contents/data/backgrounds.json`;
      const headers = {
        authorization: `Bearer ${gh.token}`,
        accept: 'application/vnd.github+json',
        'content-type': 'application/json'
      };

      // Upload the screenshot asset once. The metadata update below always reads
      // the newest backgrounds.json so concurrent edits cannot silently overwrite one another.
      if (action === 'screenshot' && payload.imageBase64) {
        const assetPath = `assets/shots/${payload.id}-custom.jpg`;
        const assetUrl = `https://api.github.com/repos/${gh.repo}/contents/${assetPath}`;
        const existing = await fetch(`${assetUrl}?ref=${encodeURIComponent(branch)}&_=${Date.now()}`, {
          headers,
          cache: 'no-store'
        });
        if (!existing.ok && existing.status !== 404) {
          throw new Error(`Could not check screenshot file (${existing.status})`);
        }
        const assetBody = {
          message: `Update screenshot for background ${payload.id}`,
          content: payload.imageBase64,
          branch
        };
        if (existing.ok) assetBody.sha = (await existing.json()).sha;
        const assetPut = await fetch(assetUrl, {
          method: 'PUT',
          headers,
          body: JSON.stringify(assetBody)
        });
        if (!assetPut.ok) {
          const detail = await assetPut.text();
          throw new Error(`Screenshot upload failed (${assetPut.status}): ${detail.slice(0, 180)}`);
        }
        payload.url = `/${assetPath}?v=${Date.now()}`;
      }

      const applyChange = lib => {
        let msg = '';
        if (action === 'remove') {
          const b = lib.backgrounds.find(x => x.id === payload.id);
          if (!b) throw new Error('Background ID not found in repo data/backgrounds.json');
          b.hidden = true;
          msg = `Remove background ${payload.id} for all visitors`;
        } else if (action === 'restore') {
          const b = lib.backgrounds.find(x => x.id === payload.id);
          if (!b) throw new Error('Background ID not found in repo data/backgrounds.json');
          delete b.hidden;
          msg = `Restore background ${payload.id} for all visitors`;
        } else if (action === 'screenshot') {
          const b = lib.backgrounds.find(x => x.id === payload.id);
          if (!b) throw new Error('Background ID not found in repo data/backgrounds.json');
          if (payload.clear) delete b.screenshotUrl;
          else {
            const target = String(payload.url || '').trim();
            if (!(/^https:\/\//i.test(target) || /^\/assets\/shots\/[A-Za-z0-9_-]+\.jpg(?:\?v=\d+)?$/i.test(target))) {
              throw new Error('Screenshot must be an HTTPS image URL or an uploaded JPG asset.');
            }
            b.screenshotUrl = target;
          }
          msg = payload.clear ? `Reset screenshot for background ${payload.id}` : `Change screenshot for background ${payload.id}`;
        } else if (action === 'add') {
          const ex = lib.backgrounds.find(x => x.id === payload.id);
          if (ex) {
            delete ex.hidden;
            if (payload.title) ex.title = payload.title;
            if (payload.author) ex.author = payload.author;
            if (payload.tags && payload.tags.length) ex.tags = [...new Set([...(ex.tags || []), ...payload.tags])];
          } else {
            const entry = { id: payload.id, user: payload.user || 'username', tags: payload.tags || [] };
            if (payload.title) entry.title = payload.title;
            if (payload.author) entry.author = payload.author;
            lib.backgrounds.unshift(entry);
          }
          msg = `Add background ${payload.id} for all visitors`;
        }
        return msg;
      };

      // Retry SHA conflicts by fetching the latest JSON and re-applying only this edit.
      // This is safe for concurrent screenshot edits to different backgrounds.
      for (let attempt = 0; attempt < 5; attempt++) {
        const gr = await fetch(`${url}?ref=${encodeURIComponent(branch)}&_=${Date.now()}`, {
          headers,
          cache: 'no-store'
        });
        if (!gr.ok) throw new Error(`GitHub read failed (${gr.status}) — check repo/token in Global Sync`);
        const file = await gr.json();
        const lib = JSON.parse(b64dec(file.content));
        const msg = applyChange(lib);

        const pr = await fetch(url, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            message: msg,
            content: b64enc(JSON.stringify(lib)),
            sha: file.sha,
            branch
          })
        });

        if (pr.ok) {
          return 'Committed to GitHub — GitHub Actions is rebuilding the live site for everybody!';
        }

        const detail = await pr.text();
        if ((pr.status === 409 || pr.status === 422) && attempt < 4) {
          await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
          continue;
        }
        throw new Error(`GitHub commit failed (${pr.status}): ${detail.slice(0, 180)}`);
      }

      throw new Error('GitHub is receiving several simultaneous updates. Your screenshot file is uploaded, but its listing update could not be committed. Please press Save screenshot again.');
    }

    const openSyncDialog = () => {
      const gh = getGh();
      openDialog(`<h2><i class="fa-brands fa-github"></i> Global Live Sync (for Everybody)</h2>
        <p class="muted">This connects the public <code>/requests/</code> page to GitHub so changes publish for everyone. ChatGPT's connected GitHub account is separate and cannot be used by this public website.</p>
        <p class="muted" style="font-size:12px">Create a <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Fine-Grained Personal Access Token</a>: choose owner <b>Prakhar826</b>, select only <b>Animatedbackgrounds</b>, and grant <b>Contents: Read and write</b>. Save the token privately. It is stored in this browser's local storage; do not use this on a shared computer.</p>
        <form id="gh-sync-form">
          <div class="field"><label for="gh-repo">GitHub Repository *</label><input id="gh-repo" required value="${esc(gh.repo || 'Prakhar826/Animatedbackgrounds')}" placeholder="Prakhar826/Animatedbackgrounds"></div>
          <div class="field"><label for="gh-branch">Branch</label><input id="gh-branch" value="${esc(gh.branch || 'main')}" placeholder="main"></div>
          <div class="field"><label for="gh-token">Fine-Grained PAT (Contents: Read &amp; Write) *</label><input id="gh-token" type="password" required value="${esc(gh.token)}" placeholder="github_pat_…" autocomplete="off"></div>
          <div class="dialog-actions">
            ${gh.token ? '<button type="button" class="btn btn-danger btn-sm" id="gh-clear">Disconnect</button>' : ''}
            <button type="button" class="btn btn-ghost" data-close>Cancel</button>
            <button type="submit" class="btn btn-primary"><i class="fa-solid fa-check"></i> Save Sync</button>
          </div>
        </form>`);
      const clr = $('#gh-clear');
      if (clr) clr.onclick = () => { store.set('gh-sync', { repo: '', branch: 'main', token: '' }); closeDialog(); paint(); say('Disconnected GitHub Sync.'); };
      $('#gh-sync-form').onsubmit = e => {
        e.preventDefault();
        store.set('gh-sync', { repo: $('#gh-repo').value.trim(), branch: $('#gh-branch').value.trim() || 'main', token: $('#gh-token').value.trim() });
        closeDialog(); paint(); say('Global GitHub Sync connected — add & remove actions now publish for everybody!');
      };
    };

    async function imageFileToJpegBase64(file) {
      if (!file || !/^image\/(?:jpeg|png|webp|gif|avif)$/i.test(file.type)) {
        throw new Error('Choose a JPG, PNG, WebP, GIF or AVIF image.');
      }
      if (file.size > 15 * 1024 * 1024) throw new Error('Please choose an image smaller than 15 MB.');
      if (typeof createImageBitmap !== 'function') throw new Error('This browser cannot process the selected image. Try a newer browser.');
      const bitmap = await createImageBitmap(file);
      try {
        const scale = Math.min(1, 1600 / bitmap.width, 900 / bitmap.height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not process this image.');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const data = canvas.toDataURL('image/jpeg', 0.88);
        const base64 = data.slice(data.indexOf(',') + 1);
        if (base64.length > 4_500_000) throw new Error('The compressed image is still too large. Try a smaller image.');
        return base64;
      } finally {
        bitmap.close();
      }
    }

    function imageLoads(url) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => reject(new Error('The image URL could not be loaded. Check that it is public and allows direct image viewing.'));
        img.src = url;
      });
    }

    function openScreenshotDialog(id) {
      const b = S.byId.get(id);
      if (!b) return;
      const current = thumb(b);
      openDialog(`<h2><i class="fa-regular fa-image"></i> Change screenshot</h2>
        <p class="muted">Replace the preview image for <b>${esc(b.name)}</b> (<code>${esc(id)}</code>). You can upload an image or paste a public HTTPS image URL.</p>
        ${hasGlobal() ? '' : '<p class="req-msg">Global Sync is not connected in this browser. Connect it above to save the change for everyone. Alternatively, you can ask ChatGPT to update this background directly through the connected repository.</p>'}
        ${current ? `<img id="shot-editor-preview" src="${esc(current)}" alt="Current screenshot" style="display:block;width:100%;max-height:220px;object-fit:contain;background:var(--surface-2);border-radius:10px;margin:0 0 14px">` : '<div id="shot-editor-preview" class="shot-fallback" style="width:100%;height:150px;margin-bottom:14px"></div>'}
        <form id="shot-editor-form">
          <div class="field"><label for="shot-editor-file">Upload screenshot</label><input id="shot-editor-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif"></div>
          <div class="field"><label for="shot-editor-url">Or image URL</label><input id="shot-editor-url" type="url" inputmode="url" placeholder="https://example.com/screenshot.jpg" value="${/^https:\/\//i.test(b.screenshotUrl || '') ? esc(b.screenshotUrl) : ''}"></div>
          <p class="muted" style="font-size:12px">Uploads are resized to a maximum of 1600 × 900 and saved as optimized JPG. Images are uploaded to this repository; URL-based screenshots keep their original public URL.</p>
          <p class="req-msg" id="shot-editor-msg" role="status" aria-live="polite" hidden></p>
          <div class="dialog-actions">
            <button type="button" class="btn btn-ghost" data-close>Cancel</button>
            <button type="button" class="btn btn-ghost" id="shot-editor-reset">Reset to original</button>
            <button type="submit" class="btn btn-primary" id="shot-editor-save"><i class="fa-solid fa-cloud-arrow-up"></i> Save screenshot</button>
          </div>
        </form>`);
      const fileInput = $('#shot-editor-file');
      const urlInput = $('#shot-editor-url');
      const preview = $('#shot-editor-preview');
      const showShotMessage = (message, bad = false) => {
        const el = $('#shot-editor-msg');
        if (!el) return;
        el.hidden = false;
        el.textContent = message;
        el.style.background = bad ? 'rgba(239,68,68,.16)' : '';
        el.style.color = bad ? '#f87171' : '';
      };
      const showPreview = src => {
        if (!preview) return;
        if (preview.tagName === 'IMG') preview.src = src;
        else {
          const img = document.createElement('img');
          img.id = 'shot-editor-preview';
          img.alt = 'Screenshot preview';
          img.style.cssText = 'display:block;width:100%;max-height:220px;object-fit:contain;background:var(--surface-2);border-radius:10px;margin:0 0 14px';
          img.src = src;
          preview.replaceWith(img);
        }
      };
      fileInput.onchange = () => {
        const f = fileInput.files && fileInput.files[0];
        urlInput.value = '';
        if (f) showPreview(URL.createObjectURL(f));
      };
      urlInput.oninput = () => {
        if (urlInput.value.trim()) {
          fileInput.value = '';
          showPreview(urlInput.value.trim());
        }
      };
      $('#shot-editor-reset').onclick = async () => {
        const btn = $('#shot-editor-reset');
        btn.disabled = true;
        btn.textContent = 'Resetting…';
        try {
          await publishGlobal('screenshot', { id, clear: true });
          delete b.screenshotUrl;
          closeDialog();
          paint();
          say(`Reset screenshot for ${id}. The original local screenshot will be used.`);
        } catch (err) {
          btn.disabled = false;
          btn.textContent = 'Reset to original';
          showShotMessage(err.message, true);
        }
      };
      $('#shot-editor-form').onsubmit = async e => {
        e.preventDefault();
        const save = $('#shot-editor-save');
        const file = fileInput.files && fileInput.files[0];
        const url = urlInput.value.trim();
        const originalSaveLabel = save.innerHTML;
        save.disabled = true;
        save.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';
        try {
          let payload;
          if (file) {
            payload = { id, imageBase64: await imageFileToJpegBase64(file) };
          } else if (url) {
            if (!/^https:\/\//i.test(url)) throw new Error('Use a public HTTPS image URL.');
            await imageLoads(url);
            payload = { id, url };
          } else {
            throw new Error('Choose an image file or paste an image URL.');
          }
          await publishGlobal('screenshot', payload);
          b.screenshotUrl = payload.url || `/assets/shots/${id}-custom.jpg?v=${Date.now()}`;
          if (S.shots) S.shots.add(id);
          closeDialog();
          paint();
          say(`Screenshot updated for ${id}. GitHub Pages will publish the change automatically.`);
        } catch (err) {
          save.disabled = false;
          save.innerHTML = originalSaveLabel;
          showShotMessage(err.message, true);
        }
      };
    }

    const rowsHTML = list => list.map(rq => {
      const b = S.byId.get(rq.id);
      const srcImg = b ? thumb(b) : '';
      const cat = rq.collection ? S.catMap.get(rq.collection) : null;
      const target = cat ? cat.name : (rq.collection || 'a new background');
      const st = rq.status || 'pending';
      return `<article class="req" data-key="${esc(rq.key)}">
        ${srcImg ? `<img src="${srcImg}" alt="">` : `<span class="shot-fallback" style="width:140px;aspect-ratio:16/10;border-radius:8px"><i class="fa-solid fa-wand-magic-sparkles"></i></span>`}
        <div>
          <h3>${esc(b ? b.name : rq.title || rq.id)}</h3>
          <p><b class="req-to">→ ${esc(target)}</b> · ${esc(rq.type === 'new' ? 'new background' : 'tag request')}</p>
          <p><code>${esc(rq.id)}</code>${rq.name ? ` · from ${esc(rq.name)}` : ''} · ${new Date(rq.created).toLocaleString()}</p>
          ${rq.note ? `<p><i class="fa-regular fa-comment"></i> ${esc(rq.note)}</p>` : ''}
          <span class="status ${esc(st)}">${esc(st)}</span>
        </div>
        <div class="req-actions">
          ${st === 'pending' ? `
            <button class="btn btn-primary btn-sm" data-approve="${esc(rq.key)}"><i class="fa-solid fa-check"></i> Approve</button>
            <button class="btn btn-ghost btn-sm" data-reject="${esc(rq.key)}"><i class="fa-solid fa-xmark"></i> Reject</button>
            <button class="btn btn-ghost btn-sm" data-drop="${esc(rq.key)}" aria-label="Remove"><i class="fa-solid fa-trash"></i></button>` : `
            <button class="btn btn-ghost btn-sm" data-drop="${esc(rq.key)}" aria-label="Remove"><i class="fa-solid fa-trash"></i></button>`}
        </div>
      </article>`;
    }).join('');

    const bgRowsHTML = (list, remSet) => list.map(b => {
      const isRem = remSet.has(b.id);
      const srcImg = thumb(b);
      return `<article class="req${isRem ? ' is-removed' : ''}" data-bg-id="${esc(b.id)}">
        ${srcImg ? `<img src="${srcImg}" alt="" loading="lazy">` : `<span class="shot-fallback" style="width:140px;aspect-ratio:16/10;border-radius:8px"><i class="fa-solid fa-wand-magic-sparkles"></i></span>`}
        <div>
          <h3>${esc(b.name)}</h3>
          <p><code>${esc(b.id)}</code> · ${esc(b.by)}${b.tags.length ? ' · ' + b.tags.map(esc).join(', ') : ''}</p>
          ${isRem ? '<span class="status removed">Removed</span>' : ''}
        </div>
        <div class="req-actions">
          <a class="btn btn-ghost btn-sm" href="/background/${esc(b.id)}/" target="_blank" rel="noopener"><i class="fa-solid fa-up-right-from-square"></i> Preview</a>
          <button type="button" class="btn btn-soft btn-sm" data-edit-shot="${esc(b.id)}"><i class="fa-regular fa-image"></i> Screenshot</button>
          ${isRem
            ? `<button class="btn btn-soft btn-sm" data-restore-bg="${esc(b.id)}"><i class="fa-solid fa-rotate-left"></i> Restore</button>`
            : `<button class="btn btn-danger btn-sm" data-remove-bg="${esc(b.id)}"><i class="fa-solid fa-trash"></i> Remove</button>`}
        </div>
      </article>`;
    }).join('');

    const shotRowsHTML = list => list.map(b => {
      const srcImg = thumb(b);
      const custom = !!(b.screenshotUrl && String(b.screenshotUrl).trim());
      return `<article class="req screenshot-row" data-bg-id="${esc(b.id)}">
        ${srcImg ? `<img src="${esc(srcImg)}" alt="" loading="lazy">` : `<span class="shot-fallback" style="width:140px;aspect-ratio:16/10;border-radius:8px"><i class="fa-solid fa-wand-magic-sparkles"></i></span>`}
        <div>
          <h3>${esc(b.name)}</h3>
          <p><code>${esc(b.id)}</code> · ${esc(b.by)}</p>
          <span class="status ${custom ? 'approved' : 'pending'}">${custom ? 'Custom screenshot' : 'Original screenshot'}</span>
        </div>
        <div class="req-actions">
          <a class="btn btn-ghost btn-sm" href="/background/${esc(b.id)}/" target="_blank" rel="noopener"><i class="fa-solid fa-up-right-from-square"></i> Preview</a>
          <button type="button" class="btn btn-primary btn-sm" data-edit-shot="${esc(b.id)}"><i class="fa-regular fa-image"></i> Change Screenshot</button>
        </div>
      </article>`;
    }).join('');

    const renderView = () => {
      const list = reqList();
      const pending = list.filter(r => (r.status || 'pending') === 'pending');
      const decided = list.filter(r => (r.status || 'pending') !== 'pending');
      const approved = list.filter(r => r.status === 'approved');
      const rem = getRemoved();
      const remSet = new Set(rem);
      const added = getAdded();
      const allBgs = S.allBgs || S.bgs || [];
      const gh = getGh();
      const liveMode = hasGlobal();

      let body = '';
      if (tab === 'manage') {
        const q = bgQuery.trim().toLowerCase();
        const filtered = allBgs.filter(b => {
          if (bgFilter === 'removed' && !remSet.has(b.id)) return false;
          if (!q) return true;
          return b.name.toLowerCase().includes(q) || b.id.toLowerCase().includes(q) || b.by.toLowerCase().includes(q) || b.tags.some(t => t.toLowerCase().includes(q));
        });
        const visible = filtered.slice(0, bgLimit);
        body = `
          <div class="admin-filter-bar">
            <input id="admin-bg-search" type="search" value="${esc(bgQuery)}" placeholder="Search by title, author, tag, or CodePen ID…">
            <div class="segmented">
              <button type="button" data-bg-filter="all" class="${bgFilter === 'all' ? 'active' : ''}">All (${allBgs.length})</button>
              <button type="button" data-bg-filter="removed" class="${bgFilter === 'removed' ? 'active' : ''}">Removed (${rem.length})</button>
            </div>
          </div>
          <div class="req-list">${visible.length ? bgRowsHTML(visible, remSet) : '<p class="muted">No matching backgrounds found.</p>'}</div>
          ${filtered.length > bgLimit ? `<div class="load-more-wrap"><button class="btn btn-soft btn-sm" id="admin-bg-more">Show more (${filtered.length - bgLimit} remaining)</button></div>` : ''}`;
      } else if (tab === 'screenshots') {
        const q = bgQuery.trim().toLowerCase();
        const filtered = allBgs.filter(b => {
          const custom = !!(b.screenshotUrl && String(b.screenshotUrl).trim());
          if (shotFilter === 'custom' && !custom) return false;
          if (shotFilter === 'original' && custom) return false;
          if (!q) return true;
          return b.name.toLowerCase().includes(q) || b.id.toLowerCase().includes(q) || b.by.toLowerCase().includes(q);
        });
        const visible = filtered.slice(0, bgLimit);
        body = `
          <p class="muted" style="margin:0 0 12px">Choose a background and select <b>Change Screenshot</b>. Upload an image or paste a public HTTPS image URL. Changes are saved to the shared GitHub library when Global Sync is connected.</p>
          <div class="admin-filter-bar">
            <input id="admin-bg-search" type="search" value="${esc(bgQuery)}" placeholder="Search by title, author, or CodePen ID…">
            <div class="segmented">
              <button type="button" data-shot-filter="all" class="${shotFilter === 'all' ? 'active' : ''}">All (${allBgs.length})</button>
              <button type="button" data-shot-filter="original" class="${shotFilter === 'original' ? 'active' : ''}">Original</button>
              <button type="button" data-shot-filter="custom" class="${shotFilter === 'custom' ? 'active' : ''}">Custom</button>
            </div>
          </div>
          <div class="req-list">${visible.length ? shotRowsHTML(visible) : '<p class="muted">No matching backgrounds found.</p>'}</div>
          ${filtered.length > bgLimit ? `<div class="load-more-wrap"><button class="btn btn-soft btn-sm" id="admin-bg-more">Show more (${filtered.length - bgLimit} remaining)</button></div>` : ''}`;
      } else if (tab === 'add') {
        body = `
          <div class="admin-add-card">
            <h2 style="font-size:16px;margin:0 0 6px">Add a new background for everybody</h2>
            <p class="muted" style="margin:0 0 16px;font-size:13px">Paste any CodePen URL to add it directly to the library${liveMode ? ' and publish live for all visitors' : ' (connect Global Sync above to publish live automatically)'}.</p>
            <form id="admin-add-bg-form">
              <div class="field"><label for="ab-url">CodePen URL *</label><input id="ab-url" required placeholder="https://codepen.io/username/pen/AbCdEf"></div>
              <div class="field"><label for="ab-title">Title *</label><input id="ab-title" required placeholder="Aurora Wave Mesh"></div>
              <div class="field"><label for="ab-author">Author name</label><input id="ab-author" placeholder="Creator name"></div>
              <div class="field"><label>Collections</label>
                <div class="tag-choices">
                  ${S.cats.map(c => `<label><input type="checkbox" name="ab-tag" value="${esc(c.slug)}"><span>${esc(c.name)}</span></label>`).join('')}
                </div>
              </div>
              <button class="btn btn-primary" type="submit"><i class="fa-solid fa-plus"></i> ${liveMode ? 'Add & Publish for Everybody' : 'Add to Library'}</button>
            </form>
          </div>`;
      } else {
        body = `
          <div class="admin-tabs">
            <button class="btn btn-soft btn-sm" id="admin-add"><i class="fa-solid fa-paste"></i> Paste a request code</button>
            <button class="btn btn-soft btn-sm" id="admin-import"><i class="fa-solid fa-file-import"></i> Import JSON</button>
            <button class="btn btn-ghost btn-sm" id="admin-copy"><i class="fa-solid fa-copy"></i> Copy approved IDs</button>
          </div>
          <h2 style="font-size:1rem">Pending <span class="muted">(${pending.length})</span></h2>
          <div class="req-list">${pending.length ? rowsHTML(pending) : '<p class="muted">Nothing waiting yet.</p>'}</div>
          <h2 style="font-size:1rem;margin-top:24px">Approved <span class="muted">(${approved.length})</span></h2>
          <div class="req-list">${approved.length ? rowsHTML(approved) : '<p class="muted">No approvals yet.</p>'}</div>
          <h2 style="font-size:1rem;margin-top:24px">Rejected</h2>
          <div class="req-list">${decided.some(r => r.status === 'rejected') ? rowsHTML(decided.filter(r => r.status === 'rejected')) : '<p class="muted">Nothing rejected.</p>'}</div>`;
      }

      return `<div class="section-head"><div><h1><i class="fa-solid fa-sliders" style="color:var(--text-2)"></i> Owner Dashboard</h1>
          <p>Add or remove backgrounds for everybody and review tag requests.</p></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-soft btn-sm" id="admin-export"><i class="fa-solid fa-file-export"></i> Export approved.json</button>
            <button class="btn btn-ghost btn-sm" id="admin-out"><i class="fa-solid fa-right-from-bracket"></i> Lock</button>
          </div></div>

        <div class="sync-bar">
          <div><span class="sync-dot${liveMode ? ' on' : ''}"></span>${API ? `<b>Global Worker Connected</b> (${esc(API)}) — changes publish for everybody.` : gh.repo && gh.token ? `<b>Global GitHub Sync Connected</b> (<code>${esc(gh.repo)}</code>) — changes commit &amp; rebuild for everybody.` : `<b>Local preview mode</b> — connect GitHub Sync (or Worker API) so add/remove updates the live site for everybody.`}</div>
          ${API ? '' : `<button type="button" class="btn btn-primary btn-sm" id="admin-sync-btn"><i class="fa-brands fa-github"></i> ${gh.token ? 'Sync Settings' : 'Connect Global Sync'}</button>`}
        </div>

        <div class="admin-nav">
          <button type="button" data-admin-tab="manage" class="${tab === 'manage' ? 'active' : ''}"><i class="fa-solid fa-trash-can"></i> Remove Backgrounds <span class="nav-count">${rem.length ? rem.length + ' removed' : allBgs.length}</span></button>
          <button type="button" data-admin-tab="screenshots" class="${tab === 'screenshots' ? 'active' : ''}"><i class="fa-regular fa-image"></i> Edit Screenshots</button>
          <button type="button" data-admin-tab="add" class="${tab === 'add' ? 'active' : ''}"><i class="fa-solid fa-plus"></i> Add Background${added.length ? ` <span class="nav-count">+${added.length}</span>` : ''}</button>
          <button type="button" data-admin-tab="queue" class="${tab === 'queue' ? 'active' : ''}"><i class="fa-solid fa-inbox"></i> Request Queue <span class="nav-count">${pending.length}</span></button>
        </div>
        <p class="req-msg" id="admin-msg" hidden></p>
        ${body}`;
    };

    const say = (msg, bad) => {
      const m = $('#admin-msg'); if (!m) return;
      m.hidden = false; m.textContent = msg;
      m.style.background = bad ? 'rgba(239,68,68,.16)' : '';
      m.style.color = bad ? '#f87171' : '';
    };

    const paint = (keepFocus = false) => {
      box.innerHTML = renderView();
      $('#admin-out').onclick = () => { session.del('admin-token'); session.del('admin-pass'); open = false; login(); };
      const syncBtn = $('#admin-sync-btn');
      if (syncBtn) syncBtn.onclick = openSyncDialog;
      $$('[data-edit-shot]').forEach(btn => {
        btn.onclick = () => openScreenshotDialog(btn.dataset.editShot);
      });
      $$('[data-shot-filter]').forEach(btn => {
        btn.onclick = () => { shotFilter = btn.dataset.shotFilter; bgLimit = 40; paint(); };
      });

      $$('[data-admin-tab]').forEach(btn => {
        btn.onclick = () => { tab = btn.dataset.adminTab; bgLimit = 40; paint(); };
      });

      $('#admin-export').onclick = () => {
        const list = reqList().filter(r => r.status === 'approved');
        const rem = getRemoved();
        const added = getAdded();
        const out = {
          generated: new Date().toISOString(),
          note: 'Commit to data/approved.json and run node scripts/build.mjs to apply approved tags, added backgrounds, and removed IDs globally.',
          requests: list.map(r => ({ type: r.type, id: r.id, collection: r.collection, name: r.name, note: r.note, approved: r.created })),
          removed: rem,
          added
        };
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
        a.download = 'approved.json'; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 3000);
        say(`Exported ${list.length} requests, ${added.length} added, and ${rem.length} removed backgrounds.`);
      };

      const searchInp = $('#admin-bg-search');
      if (searchInp) {
        if (keepFocus) { searchInp.focus(); searchInp.setSelectionRange(searchInp.value.length, searchInp.value.length); }
        searchInp.oninput = () => { bgQuery = searchInp.value; bgLimit = 40; paint(true); };
      }
      $$('[data-bg-filter]').forEach(btn => {
        btn.onclick = () => { bgFilter = btn.dataset.bgFilter; bgLimit = 40; paint(); };
      });
      const moreBtn = $('#admin-bg-more');
      if (moreBtn) moreBtn.onclick = () => { bgLimit += 40; paint(); };

      $$('[data-remove-bg]').forEach(btn => {
        btn.onclick = async () => {
          const id = btn.dataset.removeBg;
          btn.disabled = true;
          try {
            const pubMsg = await publishGlobal('remove', { id });
            const rem = getRemoved(); if (!rem.includes(id)) rem.push(id); saveRemoved(rem);
            paint();
            say(pubMsg || `Removed ${id} locally. Connect Global Sync above (or export approved.json) to publish for everybody.`);
          } catch (err) { btn.disabled = false; say(err.message, true); }
        };
      });
      $$('[data-restore-bg]').forEach(btn => {
        btn.onclick = async () => {
          const id = btn.dataset.restoreBg;
          btn.disabled = true;
          try {
            const pubMsg = await publishGlobal('restore', { id });
            saveRemoved(getRemoved().filter(x => x !== id));
            paint();
            say(pubMsg || `Restored ${id} locally.`);
          } catch (err) { btn.disabled = false; say(err.message, true); }
        };
      });

      const addBgForm = $('#admin-add-bg-form');
      if (addBgForm) {
        addBgForm.onsubmit = async e => {
          e.preventDefault();
          const url = $('#ab-url').value.trim();
          const m = url.match(/codepen\.io\/([\w-]+)\/(?:pen|full|details|embed|debug)\/([A-Za-z0-9]+)/);
          if (!m) { say('Please paste a valid CodePen URL (e.g. https://codepen.io/user/pen/AbCdEf).', true); return; }
          const payload = {
            user: m[1], id: m[2],
            title: $('#ab-title').value.trim(),
            author: $('#ab-author').value.trim() || '@' + m[1],
            tags: $$('input[name="ab-tag"]:checked', addBgForm).map(el => el.value)
          };
          const btn = addBgForm.querySelector('button[type="submit"]');
          if (btn) btn.disabled = true;
          try {
            const pubMsg = await publishGlobal('add', payload);
            const cur = getAdded().filter(x => x.id !== payload.id);
            cur.unshift(payload); saveAdded(cur);
            saveRemoved(getRemoved().filter(x => x !== payload.id));
            if (!S.byId.has(payload.id)) {
              const obj = { ...payload, idx: -1, name: payload.title || payload.id, by: payload.author };
              S.allBgs.unshift(obj); S.bgs.unshift(obj); S.byId.set(obj.id, obj);
            }
            addBgForm.reset();
            paint();
            say(pubMsg || `Added ${payload.id} locally. Connect Global Sync above (or export approved.json) to publish for everybody.`);
          } catch (err) { if (btn) btn.disabled = false; say(err.message, true); }
        };
      }

      const addBtn = $('#admin-add');
      if (addBtn) addBtn.onclick = () => {
        openDialog(`<h2><i class="fa-solid fa-paste"></i> Paste a request code</h2>
          <p class="muted">One code per line. Codes start with <code>ABREQ1.</code></p>
          <div class="field"><textarea id="rc-input" rows="5" placeholder="ABREQ1.eyJ0IjoidGFnIi..."></textarea></div>
          <div class="dialog-actions"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="rc-add"><i class="fa-solid fa-plus"></i> Add to queue</button></div>`);
        $('#rc-add').onclick = () => {
          const lines = $('#rc-input').value.split(/[\s,]+/).filter(Boolean);
          let ok = 0, bad = 0;
          for (const line of lines) { try { const r = reqDecode(line); if (reqAdd(r)) ok++; } catch (e) { bad++; } }
          closeDialog(); paint();
          say(`Added ${ok} request${ok === 1 ? '' : 's'}${bad ? `, ${bad} unreadable` : ''}.`, ok === 0);
        };
      };

      const impBtn = $('#admin-import');
      if (impBtn) impBtn.onclick = () => {
        const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json';
        inp.onchange = async () => {
          try {
            const d = JSON.parse(await inp.files[0].text());
            const arr = Array.isArray(d) ? d : (d.requests || []);
            let ok = 0;
            for (const r of arr) {
              if (!r || !r.id) continue;
              if (reqAdd({ key: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), type: r.type === 'new' ? 'new' : 'tag', id: r.id, collection: r.collection || '', name: r.name || '', note: r.note || '', created: r.created || Date.now(), status: 'pending' })) ok++;
            }
            if (Array.isArray(d.removed) && d.removed.length) saveRemoved([...getRemoved(), ...d.removed]);
            if (Array.isArray(d.added) && d.added.length) saveAdded([...d.added, ...getAdded()]);
            paint(); say(`Imported ${ok} request${ok === 1 ? '' : 's'}.`, false);
          } catch (e) { say('That file could not be read.', true); }
        };
        inp.click();
      };

      const copyBtn = $('#admin-copy');
      if (copyBtn) copyBtn.onclick = () => {
        const ids = reqList().filter(r => r.status === 'approved').map(r => `${r.type}|${r.id}|${r.collection}`);
        copy(ids.join('\n') || '(nothing approved yet)', 'Approved list copied');
      };

      $$('[data-approve],[data-reject],[data-drop]').forEach(btn => {
        btn.onclick = () => {
          const key = btn.dataset.approve || btn.dataset.reject || btn.dataset.drop;
          const list = reqList();
          if (btn.dataset.drop) { reqSave(list.filter(r => r.key !== key)); paint(); say('Request removed.'); return; }
          const action = btn.dataset.approve ? 'approved' : 'rejected';
          reqSave(list.map(r => r.key === key ? Object.assign({}, r, { status: action }) : r));
          paint();
          say(action === 'approved' ? 'Approved ✓' : 'Rejected.');
        };
      });
    };

    const login = (msg = '') => {
      box.innerHTML = `<div class="admin-login">
        <i class="fa-solid fa-lock big"></i>
        <h1 style="font-size:1.2rem;margin:0 0 4px">Owner Dashboard</h1>
        <p class="muted" style="margin:0;font-size:.86rem">Sign in to add/remove backgrounds for everybody or review requests.</p>
        ${msg ? `<p class="req-msg" style="margin-top:12px">${esc(msg)}</p>` : ''}
        <form id="admin-form">
          <label class="sr-only" for="admin-pass">Password</label>
          <input id="admin-pass" type="password" autocomplete="current-password" placeholder="Password" required autofocus>
          <button class="btn btn-primary" type="submit"><i class="fa-solid fa-right-to-bracket"></i> Unlock</button>
        </form>
        <p class="tag-note" style="margin-top:12px">Password hash is <code>adminHash</code> in <code>site.config.json</code>.</p>
      </div>`;
      const form = $('#admin-form');
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const pass = $('#admin-pass').value;
        const h = await sha256(pass);
        if (!HASH || h === HASH) {
          open = true; adminPass = pass;
          session.set('admin-token', 'ok'); session.set('admin-pass', pass);
          await loadData().catch(() => { }); paint(); return;
        }
        const p = $('.req-msg');
        if (p) p.textContent = 'Incorrect password.';
        else form.insertAdjacentHTML('beforebegin', '<p class="req-msg">Incorrect password.</p>');
        form.reset();
      });
    };

    loadData().then(() => { if (open) paint(); }).catch(() => { });
    if (open) paint(); else login();
  }

  /* ---------------- init chrome (every page) ---------------- */
  function initChrome() {
    applyTheme(); applyDensity(); updateNavCounts();
    if (matchMedia('(prefers-color-scheme: dark)').addEventListener) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
    const y = $('#year'); if (y) y.textContent = new Date().getFullYear();
    setActiveNav(location.pathname);

    const mb = $('#menu-btn'); if (mb) mb.onclick = openMenu;
    const sc = $('#scrim'); if (sc) sc.onclick = closeMenu;
    const sb = $('#submit-btn'); if (sb) sb.onclick = async () => { await loadData(); submitDialog(); };
    const db = $('#density-btn'); if (db) db.onclick = () => { store.set('density', store.get('density', 'comfy') === 'compact' ? 'comfy' : 'compact'); applyDensity(); };
    const st = $('#settings-btn'); if (st) st.onclick = e => { S.popAnchor === e.currentTarget ? closePopover() : settingsMenu(e.currentTarget); };
    const ib = $('#install-btn'); if (ib) ib.onclick = installApp;
    const mp = $('#modal-prev'); if (mp) mp.onclick = () => stepModal(-1);
    const mn = $('#modal-next'); if (mn) mn.onclick = () => stepModal(1);

    // search
    const form = $('#search-form'), input = $('#search-input');
    if (form && input) {
      form.onsubmit = e => { e.preventDefault(); const q = input.value.trim(); if (isSpa()) render('/search/?q=' + encodeURIComponent(q)); else location.href = '/search/?q=' + encodeURIComponent(q); };
      input.addEventListener('input', debounce(() => {
        if (!isSpa()) return;
        const q = input.value.trim();
        if (!q) return;
        const target = '/search/?q=' + encodeURIComponent(q);
        if (location.pathname.startsWith('/search')) { history.replaceState({ spa: true }, '', target); render(target, false); }
        else render(target);
      }, 280));
    }

    // swipe in modal (mobile)
    const modal = $('#bg-modal');
    if (modal) {
      let sx = null;
      modal.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
      modal.addEventListener('touchend', e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 70 && !e.target.closest('.modal-stage')) stepModal(dx < 0 ? 1 : -1); sx = null; });
    }

    Counter.hit('site-views').then(v => { const el = $('#site-views'); if (el && v != null) el.textContent = v.toLocaleString(); });

    window.addEventListener('offline', () => toast('You are offline — cached pages still work', 'fa-solid fa-wifi'));
    window.addEventListener('online', () => toast('Back online', 'fa-solid fa-wifi'));
  }

  /* ---------------- PWA ---------------- */
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); S.deferredInstall = e;
    const b = $('#install-btn'); if (b) b.hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    const b = $('#install-btn'); if (b) b.hidden = true;
    toast('App installed — find it on your home screen!');
  });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => { }));
  }

  /* ---------------- boot ---------------- */
  initChrome();
  const detailMatch = location.pathname.match(/^\/background\/([A-Za-z0-9]{4,12})\/?$/);
  if (detailMatch) {
    fetch('/data/backgrounds.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(data => {
      const item = data && Array.isArray(data.backgrounds) ? data.backgrounds.find(x => x.id === detailMatch[1]) : null;
      const custom = item && typeof item.screenshotUrl === 'string' ? item.screenshotUrl.trim() : '';
      if (!custom || !(/^https:\/\//i.test(custom) || custom.startsWith('/assets/shots/'))) return;
      document.querySelectorAll('img').forEach(img => {
        if (img.getAttribute('src') === `/assets/shots/${detailMatch[1]}.jpg`) img.src = custom;
      });
      const og = document.querySelector('meta[property="og:image"]');
      if (og) og.content = /^https:\/\//i.test(custom) ? custom : location.origin + custom;
    }).catch(() => {});
  }
  initNewsletterSink();
  if (isSubscribed()) $$('[data-newsletter]').forEach(f => f.remove());
  const route = document.body.dataset.route;
  if (route === 'spa') {
    history.replaceState({ spa: true }, '', location.href);
    render(location.pathname + location.search, false);
  } else if (route === 'admin') {
    initAdmin();
  } else {
    bindNewsletter(document);
  }
  initCarbon();
})();
