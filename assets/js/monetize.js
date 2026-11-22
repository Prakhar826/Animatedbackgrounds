/* =====================================================================
   Monetization loader — consent-first, resource-aware provider runner.
   Configure providers in monetize.config.js (no edits needed here).
   Public API: window.ABMonetize.{hasProviders, consent, toggleConsent,
   setConsent, status}
   ===================================================================== */
(() => {
  'use strict';
  const C = window.AB_MONETIZE || { providers: {} };
  const KEY = 'ab:monetizeConsent';
  const providers = Object.entries(C.providers || {})
    .filter(([, p]) => p && p.enabled && p.scriptUrl)
    .map(([id, p]) => Object.assign({ id, loaded: false, running: false, handle: null }, p));

  const get = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const set = v => { try { localStorage.setItem(KEY, v); } catch (e) { } };

  let battery = null;
  if (navigator.getBattery) navigator.getBattery().then(b => { battery = b; b.addEventListener('levelchange', evaluate); b.addEventListener('chargingchange', evaluate); }).catch(() => { });

  function healthy() {
    if (document.visibilityState !== 'visible') return false;
    if (!navigator.onLine) return false;
    const c = navigator.connection;
    if (c && C.respectSaveData && c.saveData) return false;
    if (c && /(^|-)2g$/.test(c.effectiveType || '')) return false;
    if (battery && !battery.charging && battery.level < (C.minBattery ?? 0.35)) return false;
    return true;
  }
  function loadScript(src) {
    return new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = src; s.async = true; s.onload = ok; s.onerror = fail;
      document.head.appendChild(s);
    });
  }
  async function startAll() {
    for (const p of providers) {
      if (p.running) continue;
      try {
        if (!p.loaded) { await loadScript(p.scriptUrl); p.loaded = true; }
        p.handle = await p.start({ key: p.key, site: location.hostname });
        p.running = true;
      } catch (e) { console.warn('[monetize]', p.id, 'failed to start', e); }
    }
  }
  async function stopAll() {
    for (const p of providers) {
      if (!p.running) continue;
      try { await p.stop(p.handle); } catch (e) { console.warn('[monetize]', p.id, 'failed to stop', e); }
      p.running = false; p.handle = null;
    }
  }
  function evaluate() {
    if (!providers.length) return;
    const allowed = !C.requireConsent || get() === 'granted';
    (allowed && healthy()) ? startAll() : stopAll();
  }

  function toast(msg) {
    const box = document.getElementById('toasts'); if (!box) return;
    const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = '<i class="fa-solid fa-microchip"></i>' + msg;
    box.appendChild(t); setTimeout(() => t.remove(), 2600);
  }
  function setConsent(v) { set(v); evaluate(); }
  function toggleConsent() {
    const on = get() === 'granted';
    setConsent(on ? 'denied' : 'granted');
    toast(on ? 'Stopped sharing idle compute' : 'Thank you for supporting us!');
  }
  function prompt() {
    if (!providers.length || !C.requireConsent || get()) return;
    const t = C.consentText || {};
    const el = document.createElement('div');
    el.className = 'consent-card';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-live', 'polite');
    el.innerHTML = `<h4><i class="fa-solid fa-heart" style="color:var(--heart)"></i> ${t.title || 'Support us'}</h4>
      <p>${t.body || ''}</p>
      <div class="consent-actions"><button class="btn btn-ghost btn-sm" data-c="denied">${t.decline || 'No thanks'}</button><button class="btn btn-primary btn-sm" data-c="granted">${t.accept || 'Allow'}</button></div>`;
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-c]'); if (!b) return;
      setConsent(b.dataset.c); el.remove();
      if (b.dataset.c === 'granted') toast('Thank you for supporting us!');
    });
    document.body.appendChild(el);
  }

  window.ABMonetize = {
    hasProviders: () => providers.length > 0,
    consent: () => get(),
    setConsent, toggleConsent,
    status: () => providers.map(p => ({ id: p.id, loaded: p.loaded, running: p.running }))
  };

  if (!providers.length) return;
  document.addEventListener('visibilitychange', evaluate);
  addEventListener('online', evaluate); addEventListener('offline', evaluate);
  if (navigator.connection && navigator.connection.addEventListener) navigator.connection.addEventListener('change', evaluate);
  addEventListener('load', () => {
    evaluate();
    setTimeout(prompt, (C.consentDelay ?? 25) * 1000);
  });
})();
