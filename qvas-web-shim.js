/*
 * QVAS web/PWA shim
 * Replaces what server.js (Node) and main.js (Electron) provided, so the UI runs
 * standalone inside a WKWebView. Loaded before app.js.
 */
(function () {
  'use strict';

  const realFetch = window.fetch.bind(window);

  // index.html switches into "remote device" mode in any browser (no `require`). That mode starts a second
  // /api/state poller that consumes key presses it cannot act on (and has no case for key 7) and re-requests
  // audio from a server endpoint that doesn't exist here. This app IS the host, so declare it as such.
  window.electronApp = true;

  // ---------- sliders sized for a phone screen ----------
  // The Fn screen's brightness/volume sliders are built for a tall desktop window (280px bars + big padding), so on a
  // landscape phone (~393px high) the handles end up off-screen under the footer buttons. Compact the layout and size
  // the bars from the screen height; app.js reads the sizes from window.__QV_SLIDER (patched in by the build).
  (function () {
    // Sizes are computed once, lazily, because window.innerHeight is only right after the page's viewport tag has
    // been applied (this script runs before it). app.js reads window.__QV_SLIDER when it starts; the CSS is applied at
    // DOMContentLoaded. Whichever comes first fixes the numbers so the CSS and app.js always agree.
    let sizes = null;
    const compute = () => {
      if (sizes) return sizes;
      const H = window.innerHeight;
      if (!H || H >= 700) return (sizes = { track: 280, handle: 40, phone: false });
      const track = Math.max(30, Math.min(280, windowHeight() - 241));
      return (sizes = { track, handle: track < 120 ? 26 : 40, phone: true });
    };
    Object.defineProperty(window, '__QV_SLIDER', { configurable: true, get: compute });
    const applyCss = () => {
      const z = compute();
      if (!z.phone) return;
      const st = document.createElement('style');
      st.textContent = `
        /* tall desktop header/footer, compacted so a framed phone screen keeps room for the content */
        .header{padding:2px 12px !important}
        .footer,.footer-btn{min-height:64px !important}
        .footer-btn{padding:4px 8px !important;font-size:1em !important}
        .fn-panel-left{padding:6px 10px !important}
        .fn-sliders{padding:2px 20px !important;align-items:center !important}
        .fn-slider-group{width:150px !important}
        .fn-slider-value{font-size:18px !important;margin-bottom:4px !important}
        .fn-slider-label{font-size:13px !important;margin-top:4px !important}
        .fn-slider-track{height:${z.track}px !important}
        .fn-slider-handle{height:${z.handle}px !important;touch-action:none}`;
      document.head.appendChild(st);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyCss); else applyCss();
  })();

  // ---------- display frame (bezel) ----------
  // The LARPTransit "QVAS Mobile" System frame. The picture is embedded here (so it also works with no signal) and is
  // drawn behind the app, scaled as large as will fit the screen with nothing cut off. The app sits exactly in its
  // window. On an iPhone 15 Pro held sideways (852 x 393) it fills the screen edge to edge.
  const FRAME = { w: 1704, h: 787, l: 66, t: 66, r: 66, b: 66 };   // picture size and gaps around the window
  const FRAME_IMG = 'data:image/png;base64,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JVQACJVQASBUAAiVUAEgVAAIlVABIFRCBYBQASBUQgWAUAEgVEIFgFAJFQBCBYBQCRUAQgUAQgWAUAkVAEIFgFAJFQBCBQBCBYBQCRUAQgWAUAkVAEIlVAAIFQBCJVQACBUAQiVUAAiVUAEgVAAIlVABIFQACJVQASBUQgWAUAEgVEIFgFABgFABIFRCBYBQASBUQgWAUAGAUAEgVEIFgFABIFRCBYBQCRUAQgWAUAkVAEIFgFAJFQBCJVQACBUAQiVUAAgVAEIlVAAIlVABIFQACJVQASBUACBUAAiVUAEgVAAIlVABIFQAIFQACJVQASBUAAiVUAEgVEIFgFABIFRCBYBQASBUQgWAUAkVAEIFgFAJFQBCBYBQCRUAQiVUAAgVAEIlVAAIFQAIFQBCJVQACBUAQiVUAAgVAAgVAEIlVAAIFQBCJVQACJVQASBUAAiVUAEgVAAIlVABIFRCBYBQASBUQgWAUAEgVEIFgFAJFQBCBYBQCRUAQgUAQgWAUAkVAEIFgFAJFQBCBQBCBYBQCRUAQgWAUAkVAELlPwMAQgWAUAkVAEIFgFAJFQBCJVQACBUAQiVUAAgVAEIlVAAIlVABIFQACJVQASBUACBUAAiVUAEgVAAIlVABIFQAIFQACJVQASBUAAiVUAEgVAAgVAAIlVABIFQACJVQASBUQgWAUAEgVEIFgFABIFRCBYBQCRUAQgWAUAkVAEIFAEIFgFAJFQBCBYBQCRUAQgUAQgWAUAkVAEIFgFAJFQBCBQBCBYBQCRUAQgWAUAkVAEIlVAAIFQBCJVQACBUAQiVUAAiVUAEgVAAIlVABIFQACJVQASBUQgWAUAEgVEIFgFABgFABIFRCBYBQASBUQgWAUAGAUAEgVEIFgFABIFRCBYBQCRUAQgWAUAkVAEIFgFAJFQBCJVQACBUAQiVUAAgVAEIlVAAIlVABIFQACJVQASBUACBUAAiVUAEgVAAIlVABIFQAIFQACJVQASBUAAiVUAEgVEIFgFABIFRCBYBQASBUQgWAUAkVAEIFgFAJFQBCBYBQCRUAQiVUAAgVAEIlVAAIFQAIFQBCJVQACBUAQiVUAAgVAAgVAEIlVAAIFQBCJVQACJVQASBUAAiVUAEgVAAIlVABIFRCBYBQASBUQgWAUAEgVEIFgFAJFQBCBYBQCRUAQgUAQgWAUAkVAEIFgFAJFQBCBQBCBYBQCRUAQgWAUAkVAEIlVAAIFQBCJVQACBUAQiVUAAiVUAEgVAAIlVABIFQACJVQASBUQgWAUAEgVEIFgFABgFABIFRCBYBQASBUQgWAUAGAUAEgVEIFgFABIFRCBYBQCRUAQgWAUAkVAEIFgFAJFQBCJVQACBUAQiVUAAgVAEIlVAAIlVABIFQACJVQASBUACBUAAiVUAEgVAAIlVABIFQAIFQACJVQASBUAAiVUAEgVEIFgFABIFRCBYBQASBUQgWAUAkVAEIFgFAJFQBCBYBQCRUAQiVUAAgVAEIlVAAIFQAIFQBCJVQACBUAQiVUAAgVAAgVAEIlVAAIFQBCJVQACJVQASBUAAiVUAEgVAAIlVABIFRCBYBQASBUQgWAUAEgVEIFgFAJFQBCBYBQCRUAQgUAQgWAUAkVAEIFgFAJFQBCBQBCBYBQCRUAQgWAUAkVAEIlVAAIFQBCJVQACBUAQiVUAAiVUAEgVAAIlVABIFQACJVQASBUQgWAUAEgVEIFgFABgFABIFRCBYBQASBUQgWAUAGAUAEgVEIFgFABIFRCBYBQ+c8AgFABIFRCBYBQASBUQgWAUAkVAEIFgFAJFQBCBYBQCRUAQiVUAAgVAEIlVAAIFQAIFQBCJVQACBUAQiVUAAgVAAgVAEIlVAAIFQBCJVQACBUACBUAQiVUAAgVAEIlVAAIlVABIFQACJVQASBUAAiVUAEgVEIFgFABIFRCBYBQAYBQASBUQgWAUAEgVEIFgFABgFABIFRCBYBQASBUQgWAUAGAUAEgVEIFgFABIFRCBYBQCRUAQgWAUAkVAEIFgFAJFQBCJVQACBUAQiVUAAgVAEIlVAAIlVABIFQACJVQASBUACBUAAiVUAEgVAAIlVABIFQAIFQACJVQASBUAAiVUAEgVEIFgFABIFRCBYBQASBUQgWAUAkVAEIFgFAJFQBCBYBQCRUAQiVUAAgVAEIlVAAIFQAIFQBCJVQACBUAQiVUAAgVAAgVAEIlVAAIFQBCJVQACJVQASBUAAiVUAEgVAAIlVABIFRCBYBQASBUQgWAUAEgVEIFgFAJFQBCBYBQCRUAQgUAQgWAUAkVAEIFgFAJFQBCBQBCBYBQCRUAQgWAUAkVAEIlVAAIFQBCJVQACBUAQiVUAAiVUAEgVAAIlVABIFQACJVQASBUQgWAUAEgVEIFgFABgFABIFRCBYBQASBUQgWAUAGAUAEgVEIFgFABIFRCBYBQCRUAQgWAUP2yVgHAT/jllfkMoQKAvx6hAkCoAECoABAqABAqABAqAIQKAIQKAKECAKECAKECQKgAQKgAECoAECoAECoAhAoAhAoAoQIAoQIAoQJAqABAqAAQKn8EAAgVAAgVAEIFAEIFAEIFgFABgFABIFQAIFQAIFQACBUACBUAQgUAQgUAQgWAUAGAUAEgVAAgVAAgVAAIFQAIFQBCBQBCBQBCBYBQAYBQAYBQASBUACBUAAgVAAgVAAgVAEIFAEIFgFABgFABgFABIFQAIFQA/CP6P5KmgZLh1hI/AAAAAElFTkSuQmCC';
  const frameGeom = () => {
    const W = window.innerWidth || 852, H = window.innerHeight || 393;
    const s = Math.min(W / FRAME.w, H / FRAME.h);
    const fw = FRAME.w * s, fh = FRAME.h * s, ox = (W - fw) / 2, oy = (H - fh) / 2;
    return {
      fw, fh, ox, oy,
      left: Math.floor(ox + FRAME.l * s), top: Math.floor(oy + FRAME.t * s),
      right: Math.floor(ox + FRAME.r * s), bottom: Math.floor(oy + FRAME.b * s), H
    };
  };
  const windowHeight = () => { const g = frameGeom(); return g.H - g.top - g.bottom; };
  const applyFrame = () => {
    const g = frameGeom(), d = document.documentElement.style;
    d.setProperty('--qv-l', g.left + 'px'); d.setProperty('--qv-t', g.top + 'px');
    d.setProperty('--qv-r', g.right + 'px'); d.setProperty('--qv-bm', g.bottom + 'px');
    d.setProperty('--qv-fx', g.ox + 'px'); d.setProperty('--qv-fy', g.oy + 'px');
    d.setProperty('--qv-fw', g.fw + 'px'); d.setProperty('--qv-fh', g.fh + 'px');
  };
  applyFrame();
  window.addEventListener('resize', applyFrame);
  window.addEventListener('orientationchange', () => setTimeout(applyFrame, 300));
  document.addEventListener('DOMContentLoaded', applyFrame);
  window.addEventListener('load', applyFrame);

  // Fit by measuring: shrink the keyboard rows, the day buttons and the side buttons until nothing is cut off inside
  // the frame's window. It checks again whenever the screen changes, so every screen fits.
  let fitKh = 34, fitDay = 40, fitSide = null;
  const applyFit = () => {
    let st = document.getElementById('qvas-kbfit');
    if (!st) { st = document.createElement('style'); st.id = 'qvas-kbfit'; (document.head || document.documentElement).appendChild(st); }
    const kf = Math.max(10, Math.min(16, fitKh - 16)), df = Math.max(9, Math.min(14, fitDay - 22));
    st.textContent = `
      .left-panel{padding-top:4px !important}
      .touch-keyboard{margin-top:2px !important;padding-top:2px !important;padding-bottom:0 !important;justify-content:flex-start !important}
      .touch-keyboard .keyboard-row{margin:0 0 2px 0 !important}
      .touch-keyboard .key-btn{height:${fitKh}px !important;min-height:0 !important;padding-top:0 !important;padding-bottom:0 !important;font-size:${kf}px !important;line-height:1 !important}
      .touch-keyboard .day-selector{margin:2px 0 0 0 !important}
      .touch-keyboard .day-btn{height:${fitDay}px !important;min-height:0 !important;padding:0 4px !important;font-size:${df}px !important;line-height:1.05 !important}` +
      (fitSide ? `
      .right-panel .side-btn{min-height:${fitSide}px !important;flex:1 1 ${fitSide}px !important}` : '');
  };
  const fitKeyboard = () => {
    if ((window.innerHeight || 0) >= 700) return;            // only on a phone-sized screen
    applyFit();
    const kb = document.getElementById('touch-keyboard');
    if (kb && kb.offsetParent && kb.clientHeight > 40) {
      for (let i = 0; i < 40 && kb.scrollHeight > kb.clientHeight + 1 && fitKh > 14; i++) {
        fitKh--; fitDay = Math.max(22, Math.round(fitKh * 1.15)); applyFit();
      }
    }
    document.querySelectorAll('.right-panel').forEach((rp) => {
      if (!rp.offsetParent || rp.clientHeight < 40 || rp.scrollHeight <= rp.clientHeight + 1) return;
      const n = Array.from(rp.children).filter((c) => c.classList.contains('side-btn') && getComputedStyle(c).display !== 'none').length || 1;
      fitSide = Math.max(24, Math.floor(rp.clientHeight / n) - 1);
      applyFit();
    });
  };
  fitKeyboard();
  document.addEventListener('DOMContentLoaded', fitKeyboard);
  window.addEventListener('load', fitKeyboard);
  window.addEventListener('resize', () => { fitKh = 34; fitDay = 40; fitSide = null; fitKeyboard(); });
  window.addEventListener('orientationchange', () => setTimeout(() => { fitKh = 34; fitDay = 40; fitSide = null; fitKeyboard(); }, 300));
  document.addEventListener('click', () => setTimeout(fitKeyboard, 120), true);
  setInterval(fitKeyboard, 700);
  (function () {
    const st = document.createElement('style');
    st.textContent = `
      html{height:100% !important;margin:0 !important;padding:0 !important;background-color:#76787b !important;
        background-image:url("${FRAME_IMG}") !important;background-repeat:no-repeat !important;
        background-size:var(--qv-fw,100%) var(--qv-fh,100%) !important;background-position:var(--qv-fx,0) var(--qv-fy,0) !important}
      body{position:fixed !important;left:var(--qv-l,0);top:var(--qv-t,0);right:var(--qv-r,0);bottom:var(--qv-bm,0);
        width:auto !important;height:auto !important;max-width:none !important;min-height:0 !important;margin:0 !important;
        overflow:hidden;border-radius:0;box-shadow:none !important}
      /* settings / I/O / diag panels: let them scroll with a finger instead of being cut off */
      .status-panel-container,.fn-panel-container,.pei-panel-container,.cctv-panel-container,.special-panel-container,#emergency-panel{max-height:none !important;min-height:0 !important}
      .status-panel-left,#status-panel .status-panel-left,.update-panel-left,.fn-audio-device-panel{min-height:0 !important;overflow-y:auto !important;overflow-x:hidden !important;-webkit-overflow-scrolling:touch;touch-action:pan-y;overscroll-behavior:contain}
      #set3-update-content,.status-table-wrapper{overflow:visible !important}
      /* keys shrink to fit the narrower screen instead of wrapping (which clipped the bottom row) */
      .touch-keyboard .keyboard-row{flex-wrap:nowrap !important}
      .touch-keyboard .key-btn{flex:1 1 0;min-width:0 !important;max-width:84px;padding-left:2px !important;padding-right:2px !important}`;
    (document.head || document.documentElement).appendChild(st);
  })();

  // ---------- GitHub Pages base path ----------
  // On https://user.github.io/repo/ the app lives under /repo/, but app.js uses root-absolute URLs
  // like /audio/... and /api/... . Rewrite same-origin root-absolute URLs to include the base.
  const BASE = window.location.pathname.replace(/[^/]*$/, ''); // e.g. "/repo/" or "/"
  // The site keeps audio under audio/QR_PIDS_AudioFiles/; the desktop server also answered /QR_PIDS_AudioFiles/...
  function fixUrl(u) {
    try {
      if (typeof u !== 'string' || /^(blob:|data:)/i.test(u)) return u;
      const url = new URL(u, window.location.href);
      if (url.origin !== window.location.origin) return u;
      let rel = url.pathname.startsWith(BASE) ? url.pathname.slice(BASE.length) : url.pathname.replace(/^\//, '');
      if (/^QR_PIDS_AudioFiles\//i.test(rel)) rel = 'audio/' + rel;
      // GitHub Pages is case-sensitive, Windows isn't (the desktop server also matched audio names ignoring case).
      if (/^audio\//i.test(rel) && window.__QVAS_AUDIO_INDEX) {
        let dec = rel; try { dec = decodeURIComponent(rel); } catch (e) {}
        const real = window.__QVAS_AUDIO_INDEX[dec.toLowerCase()];
        if (real && real !== dec) rel = real.split('/').map(encodeURIComponent).join('/');
      }
      const fixed = BASE + rel;
      if (fixed === url.pathname) return u;
      url.pathname = fixed;
      return url.toString();
    } catch (e) {}
    return u;
  }
  function relPath(pathname) { // strip the base so route matching sees "/api/..." again
    return BASE !== '/' && pathname.startsWith(BASE) ? '/' + pathname.slice(BASE.length) : pathname;
  }
  {
    const NativeAudio = window.Audio;
    window.Audio = function (src) { const a = new NativeAudio(); if (src !== undefined) a.src = src; return a; };
    window.Audio.prototype = NativeAudio.prototype;
    [[HTMLMediaElement, 'src'], [HTMLImageElement, 'src'], [HTMLSourceElement, 'src']].forEach(([C, prop]) => {
      const d = Object.getOwnPropertyDescriptor(C.prototype, prop);
      if (d && d.set) Object.defineProperty(C.prototype, prop, { get: d.get, set(v) { d.set.call(this, fixUrl(v)); }, configurable: true });
    });
  }

  // ---------- big GTFS files are stored as <1 chunk><N> parts (GitHub 100 MB file limit) ----------
  let partsPromise = null;
  const loadParts = () => partsPromise || (partsPromise = realFetch('SEQ_GTFS/_parts.json').then(r => r.ok ? r.json() : {}).catch(() => ({})));
  async function assemble(name, dir) {
    const parts = await loadParts();
    if (!parts[name]) return null;
    const blobs = [];
    for (let i = 0; i < parts[name]; i++) {
      const r = await realFetch(`${dir}${name}.part${i}`);
      if (!r.ok) throw new Error(`missing ${name}.part${i}`);
      blobs.push(await r.blob());
    }
    return new Response(new Blob(blobs), { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  const gtfsFile = (name) => assemble(name, 'SEQ_GTFS/');

  // ---------- in-memory state (was appState / phoneGPSData in server.js) ----------
  let appState = {
    doorCycle: 0, route: '', station: '', pid: '', DI: '',
    inputValue: '', lastKeyPress: null, timestamp: Date.now()
  };
  let phoneGPS = null;
  const GPS_MAX_AGE_MS = 25000;

  // ---------- cached static data ----------
  let patternsPromise = null;
  let manifestPromise = null;
  const loadPatterns = () => patternsPromise || (patternsPromise = assemble('gtfs-patterns.json', '').then(r => r || realFetch('gtfs-patterns.json')).then(r => r.json()));
  const loadManifest = () => manifestPromise || (manifestPromise = realFetch('audio-manifest.json').then(r => r.json()));

  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

  async function bodyOf(init, input) {
    try {
      if (init && typeof init.body === 'string') return JSON.parse(init.body);
      if (input && typeof input.text === 'function') return JSON.parse(await input.text());
    } catch (e) { /* fall through */ }
    return {};
  }

  // ---------- route handlers (ported from server.js) ----------
  async function handle(pathname, search, method, init, input) {
    // v17 startup check: "are the audio + GTFS assets installed?" Everything is bundled in the site, so yes.
    // (Returning ready:true also means the app never tries the desktop-only asset downloader.)
    if (pathname === '/api/assets-status') {
      return json({ ready: true, missing: [], missingGTFSFiles: [] });
    }

    if (pathname === '/api/routes') {
      const gtfs = await loadPatterns();
      const routes = Object.keys(gtfs.routes || {}).map(id => ({
        route_id: id,
        route_name: gtfs.routes[id].route_name,
        route_long_name: gtfs.routes[id].route_long_name,
        pattern_count: (gtfs.routes[id].patterns || []).length
      }));
      return json({ success: true, total_routes: routes.length, routes });
    }

    if (pathname.startsWith('/api/route/')) {
      const gtfs = await loadPatterns();
      const code = decodeURIComponent(pathname.split('/api/route/')[1].split('?')[0]).toUpperCase();
      let route = gtfs.routes[code];
      if (!route) {
        for (const [id, data] of Object.entries(gtfs.routes)) {
          if (id.startsWith(code + '-') || id.toUpperCase() === code) { route = data; break; }
        }
      }
      if (!route) return json({ error: `Route ${code} not found` }, 404);
      return json({ success: true, route_name: route.route_name, route_long_name: route.route_long_name, patterns: route.patterns || [] });
    }

    if (pathname.startsWith('/api/search/run/')) {
      const gtfs = await loadPatterns();
      const run = decodeURIComponent(pathname.split('/api/search/run/')[1].split('?')[0]).toUpperCase();
      const found = [];
      for (const [tripId, routeId] of Object.entries(gtfs.tripIdMap || {})) {
        if (tripId.includes(run)) {
          const route = gtfs.routes[routeId];
          if (route && !found.find(r => r.route_id === routeId)) {
            found.push({ route_id: routeId, route_name: route.route_name, route_long_name: route.route_long_name, trip_id: tripId });
          }
        }
      }
      if (!found.length) return json({ success: false, message: `Run code ${run} not found`, results: [] }, 404);
      return json({ success: true, search_term: run, results_count: found.length, results: found });
    }

    if (pathname === '/api/audio-files') {
      const manifest = await loadManifest();
      const dir = new URLSearchParams(search).get('path') || '';
      const entry = manifest[decodeURIComponent(dir)];
      if (!entry) return json({ error: 'Directory not found' }, 404);
      return json(entry);
    }

    if (pathname === '/api/state') {
      const snapshot = { ...appState, timestamp: Date.now() };
      appState.lastKeyPress = null; // one-time delivery, as on the server
      return json(snapshot);
    }

    if (pathname === '/api/state-update' && method === 'POST') {
      appState = { ...appState, ...(await bodyOf(init, input)) };
      return json({ success: true });
    }

    if (pathname === '/api/key-press' && method === 'POST') {
      appState.lastKeyPress = await bodyOf(init, input);
      return json({ success: true });
    }

    if (pathname === '/api/phone-gps' && method === 'POST') {
      const p = await bodyOf(init, input);
      const lat = Number(p.lat), lon = Number(p.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return json({ success: false, error: 'Invalid GPS coordinates' }, 400);
      phoneGPS = { lat, lon, speed: p.speed ?? null, accuracy: p.accuracy ?? null, timestamp: Date.now(), receivedAt: Date.now() };
      return json({ success: true });
    }

    // On the phone the "train position" is simply the phone's own GPS.
    if (pathname === '/api/tsw/player-position') {
      if (!appGpsMode()) return json({ success: false, error: 'GPS Mode is off' });
      startGPS();
      if (phoneGPS && Date.now() - phoneGPS.receivedAt <= GPS_MAX_AGE_MS) {
        return json({ success: true, source: 'Phone GPS', ...phoneGPS });
      }
      return json({ success: false, error: gpsError || 'Waiting for a GPS fix' });
    }

    if (pathname === '/api/manual-routes' && method === 'POST') {
      // No writable project folder on iOS; keep edits for the session via localStorage.
      try { localStorage.setItem('qvas-manual-routes', JSON.stringify(await bodyOf(init, input))); } catch (e) {}
      return json({ success: true });
    }

    return null; // not ours -> real fetch (static files)
  }

  // ---------- GPS (replaces gps-transmitter.html + /api/phone-gps) ----------
  let gpsWatchId = null;
  let gpsError = '';
  // v17 ignores the 3/4/6/7 keys while its own "GPS Mode" is on (default on), and in that mode it auto-selects the
  // station nearest to the phone, which jumps the list around when you aren't on the route. So the phone starts in
  // manual mode (GPS Mode off). Turn it on from the GPS button in the key bar (or the app's Status screen) when riding.
  try { if (localStorage.getItem('gpsModeEnabled') === null) localStorage.setItem('gpsModeEnabled', 'false'); } catch (e) {}
  // The app's "This PC" GPS source asks the Windows desktop shell for a location; on a phone it must be "phone".
  try { if (localStorage.getItem('gpsSourceMode') !== 'phone') localStorage.setItem('gpsSourceMode', 'phone'); } catch (e) {}
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && appGpsMode() && gpsWatchId !== null) { stopGPS(); startGPS(); } });
  document.addEventListener('click', (e) => {
    if (e.target && e.target.closest && e.target.closest('#status-gps-source-btn')) {
      e.stopImmediatePropagation(); e.preventDefault();
      toast("On the iPhone the GPS source is always the phone's own GPS.");
    }
  }, true);
  const appGpsMode = () => { try { return localStorage.getItem('gpsModeEnabled') === 'true'; } catch (e) { return false; } };
  // iOS only pushes a new watchPosition fix when the phone MOVES, but the app treats 15 s without a fix as "GPS lost".
  // So: keep a watch running AND ask for a fix every 2 s (cached fixes are fine), and re-stamp when each one arrives.
  let gpsPollTimer = null, gpsPollBusy = false, gpsPermWarned = false;
  function onFix(pos) {
    gpsError = '';
    phoneGPS = {
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      speed: pos.coords.speed != null && pos.coords.speed >= 0 ? pos.coords.speed : null,
      accuracy: pos.coords.accuracy,
      timestamp: pos.timestamp || Date.now(),
      receivedAt: Date.now()
    };
  }
  function onGpsErr(err) {
    gpsError = (err && err.message) || 'Location unavailable';
    if (err && err.code === 1 && !gpsPermWarned) {
      gpsPermWarned = true;
      toast('Location is blocked. On the iPhone: Settings > Privacy & Security > Location Services > Safari Websites > While Using the App, with Precise Location on.');
    }
  }
  function startGPS() {
    if (!navigator.geolocation || gpsWatchId !== null) return;
    gpsWatchId = navigator.geolocation.watchPosition(onFix, onGpsErr, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    const poll = () => {
      if (gpsPollBusy) return;
      gpsPollBusy = true;
      navigator.geolocation.getCurrentPosition(
        (p) => { gpsPollBusy = false; onFix(p); },
        (e) => { gpsPollBusy = false; onGpsErr(e); },
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }); // a recent saved fix is fine when standing still
    };
    poll();
    gpsPollTimer = setInterval(poll, 2000);
  }
  function stopGPS() {
    if (gpsWatchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null; clearInterval(gpsPollTimer); gpsPollTimer = null; gpsPollBusy = false; phoneGPS = null;
  }

  // ---------- fetch interception ----------
  window.fetch = async function (input, init) {
    try {
      const raw = typeof input === 'string' ? input : (input && input.url) || String(input);
      const u = new URL(raw, window.location.href);
      const method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      const sameOrigin = u.origin === window.location.origin;
      const path = sameOrigin ? relPath(u.pathname) : u.pathname;
      // Match by path only, so hard-coded hosts like http://localhost:5000/api/key-press also resolve here.
      if (path.startsWith('/api/')) {
        const res = await handle(path, u.search, method, init, input);
        if (res) return res;
      }
      const g = path.match(/^\/SEQ_GTFS\/([a-z_]+\.txt)$/);
      if (g) { const res = await gtfsFile(g[1]); if (res) return res; }
      if (typeof input === 'string' && sameOrigin) return realFetch(fixUrl(input), init);
      if (input && input.url && sameOrigin && typeof input !== 'string') return realFetch(fixUrl(input.url), init);
    } catch (e) {
      console.error('[qvas-shim]', e);
      return json({ error: String(e.message || e) }, 500);
    }
    return realFetch(input, init);
  };

  // ---------- iOS audio: unlock, silent switch, and a working volume control ----------
  // iPhone Safari ignores HTMLMediaElement.volume (it always reads 1), so the app's volume sliders do nothing there.
  // Route elements through a Web Audio GainNode instead. Web Audio normally obeys the ring/silent switch, so ask iOS
  // (16.4+) to treat the page as "playback" audio.
  const AC = window.AudioContext || window.webkitAudioContext;
  let actx = null;
  const getCtx = () => (AC ? (actx || (actx = (window.__qvasAudioCtx = new AC()))) : null);
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}

  const unlock = () => {
    try {
      const ctx = getCtx();
      if (ctx) { ctx.resume && ctx.resume(); const b = ctx.createBuffer(1, 1, 22050); const s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); }
    } catch (e) {}
  };
  // keep trying on every touch: iOS can suspend the context again (phone call, app switch)
  ['touchend', 'click'].forEach(ev => window.addEventListener(ev, () => { try { if (actx && actx.state !== 'running') actx.resume(); else if (!actx) unlock(); } catch (e) {} }, true));

  function nativeVolumeWorks() {
    try { if (localStorage.getItem('qvasForceGain') === '1') return false; } catch (e) {}
    try { const p = new Audio(); p.volume = 0.25; return Math.abs(p.volume - 0.25) < 0.001; } catch (e) { return true; }
  }
  if (AC && typeof HTMLMediaElement !== 'undefined' && !nativeVolumeWorks()) {
    const wired = new WeakMap();
    const wire = (el) => {
      let w = wired.get(el);
      if (w) return w;
      w = { v: 1, gain: null };
      try {
        const ctx = getCtx();
        const node = ctx.createMediaElementSource(el);
        w.gain = ctx.createGain();
        node.connect(w.gain); w.gain.connect(ctx.destination);
        el.addEventListener('play', () => { try { if (ctx.state !== 'running') ctx.resume(); } catch (e) {} });
      } catch (e) { w.gain = null; }
      wired.set(el, w);
      return w;
    };
    Object.defineProperty(HTMLMediaElement.prototype, 'volume', {
      configurable: true,
      get() { const w = wired.get(this); return w ? w.v : 1; },
      set(val) {
        let v = Number(val); if (!isFinite(v)) return;
        v = Math.max(0, Math.min(1, v));
        const w = wire(this); w.v = v;
        if (w.gain) w.gain.gain.value = v;
      }
    });
  }

  // Output-device selection (setSinkId) doesn't exist on iOS; make it a harmless no-op.
  if (typeof HTMLMediaElement !== 'undefined' && !HTMLMediaElement.prototype.setSinkId) {
    HTMLMediaElement.prototype.setSinkId = function () { return Promise.resolve(); };
  }

  // Keep the screen awake while driving the display.
  if (navigator.wakeLock && navigator.wakeLock.request) {
    const lock = () => navigator.wakeLock.request('screen').catch(() => {});
    lock();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') lock(); });
  }


  // ---------- on-screen keys (iPhone has no physical keyboard) ----------
  // Same effect as pressing 3 / 4 / 6 / 7 on the desktop keyboard: posts the key to /api/key-press,
  // which app.js picks up through its /api/state polling.
  const KEYS = [
    { key: '3', label: 'Open Doors' },
    { key: '4', label: 'Now Arriving At' },
    { key: '6', label: 'Close Doors' },
    { key: '7', label: 'The Next Station Is' }
  ];
  let lastKeyTs = 0;
  function sendKey(key) {
    lastKeyTs = Math.max(Date.now(), lastKeyTs + 1); // app ignores timestamps that don't increase
    return window.fetch('/api/key-press', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, timestamp: lastKeyTs })
    });
  }
  function buildKeyBar() {
    if (document.getElementById('qvas-keybar')) return;
    const css = document.createElement('style');
    css.textContent = `
      #qvas-keybar{position:fixed;left:calc(50% - 40px);transform:translateX(-50%);z-index:2147483647;display:flex;gap:6px;padding:5px;
        border-radius:12px;background:rgba(0,0,0,.72);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);
        font-family:-apple-system,Helvetica,Arial,sans-serif;width:min(500px,calc(100vw - 300px));
        user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
      #qvas-keybar.top{top:calc(var(--qv-t,45px) + 4px)}
      #qvas-keybar.bottom{bottom:calc(var(--qv-bm,45px) + 4px)}
      #qvas-keybar button{flex:1 1 0;min-width:0;min-height:44px;padding:3px 4px;border:1px solid rgba(255,255,255,.35);
        border-radius:9px;background:#1f2a44;color:#fff;font-size:11px;line-height:1.1;touch-action:manipulation;
        -webkit-tap-highlight-color:transparent;cursor:pointer}
      #qvas-keybar button b{display:block;font-size:17px}
      #qvas-keybar button:active,#qvas-keybar button.hit{background:#3d5a99}
      #qvas-keybar .qk-ctl{flex:0 0 34px;background:#333;font-size:16px;padding:0}
      #qvas-keybar.gps-on .qk-key{opacity:.45}
      #qvas-keybar.collapsed{width:auto}
      #qvas-keybar.collapsed button.qk-key{display:none}`;
    document.head.appendChild(css);
    const bar = document.createElement('div');
    bar.id = 'qvas-keybar';
    KEYS.forEach(({ key, label }) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `<b>${key}</b>${label}`;
      b.setAttribute('aria-label', `${key} ${label}`);
      b.addEventListener('click', (e) => {
        e.preventDefault();
        b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 150);
        if (navigator.vibrate) navigator.vibrate(15);
        sendKey(key);
      });
      b.addEventListener('mousedown', (e) => e.preventDefault()); // don't steal focus from the run-number field
      bar.appendChild(b);
    });
    const store = {
      get(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } },
      set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    };
    const setPos = (p) => { bar.classList.remove('top', 'bottom'); bar.classList.add(p); store.set('qvas-keybar-pos', p); };
    const mk = (txt, label, fn) => {
      const c = document.createElement('button');
      c.type = 'button'; c.className = 'qk-ctl'; c.textContent = txt; c.setAttribute('aria-label', label);
      c.addEventListener('click', fn); return c;
    };
    bar.querySelectorAll('button').forEach(b => b.classList.add('qk-key'));
    const gps = mk('GPS Off', 'Turn GPS Mode on or off', function () {
      const appBtn = document.getElementById('status-gps-mode-btn');
      if (appBtn) appBtn.click();                       // the app's own toggle (also stops/starts its GPS automation)
      else { try { localStorage.setItem('gpsModeEnabled', String(!appGpsMode())); } catch (e) {} location.reload(); }
      setTimeout(syncGps, 50);
    });
    const dl = mk('\u2B07', 'Download audio for offline use', async function () {
      const s = await offline.refresh();
      if (s.busy) { toast('Downloading audio\u2026 ' + s.pct + '%'); return; }
      if (s.ready && !s.missing) { toast('Offline audio is ready' + (s.total ? ' (' + s.total + ' files)' : '') + '. The app works without signal.'); return; }
      if (!s.known) { toast('Connect to the internet to download the audio.'); return; }
      const mb = Math.max(1, Math.round((s.bytes || 0) / 1048576));
      if (confirm('Download the announcement audio (about ' + mb + ' MB for everything, less if you already have part of it) so the app works without signal? Use Wi-Fi.')) offline.download();
    });
    const border = mk('\u25A2', 'Frame', () => {
      applyFrame();
      toast('The frame is sized to fit this screen automatically.');
    });
    border.style.flexBasis = 'auto'; border.style.padding = '0 8px';
    bar.appendChild(border);
    dl.style.flexBasis = 'auto'; dl.style.padding = '0 8px';
    const syncDl = (s) => {
      dl.textContent = s.busy ? s.pct + '%' : '\u2B07';
      dl.style.background = s.busy ? '#8a6d00' : (s.ready ? '#1d6b3a' : (s.known && s.hadAny ? '#8a6d00' : ''));
      dl.title = s.ready ? 'Offline audio ready' : 'Download audio for offline use';
    };
    offline.onChange(syncDl); syncDl(offline.st);
    bar.appendChild(dl);
    gps.style.flexBasis = 'auto'; gps.style.padding = '0 8px'; gps.style.fontSize = '11px';
    function syncGps() {
      const on = appGpsMode();
      gps.textContent = on ? 'GPS On' : 'GPS Off';
      gps.style.background = on ? '#1d6b3a' : '';
      bar.classList.toggle('gps-on', on);
      if (on) startGPS(); else if (gpsWatchId !== null) stopGPS();
    }
    syncGps(); setInterval(syncGps, 800);
    bar.appendChild(gps);
    bar.appendChild(mk('\u21C5', 'Move keys to top or bottom', () => setPos(bar.classList.contains('top') ? 'bottom' : 'top')));
    bar.appendChild(mk('\u2013', 'Hide or show keys', function () {
      bar.classList.toggle('collapsed'); this.textContent = bar.classList.contains('collapsed') ? '3 4 6 7' : '\u2013';
      if (bar.classList.contains('collapsed')) this.style.flexBasis = 'auto', this.style.padding = '0 10px'; else this.style.flexBasis = '', this.style.padding = '';
    }));
    setPos(store.get('qvas-keybar-pos', 'top'));
    document.body.appendChild(bar);
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildKeyBar);
    else buildKeyBar();
  }

  // Desktop-only IPC (GTFS download via PowerShell, Windows brightness) is unavailable here.
  function savedBrightness() { try { const v = Number(localStorage.getItem('qvas-brightness')); return Number.isFinite(v) && localStorage.getItem('qvas-brightness') !== null ? v : 100; } catch (e) { return 100; } }
  function applyBrightness(v) {
    v = Math.max(0, Math.min(100, Number(v)));
    if (!Number.isFinite(v)) return;
    try { localStorage.setItem('qvas-brightness', String(v)); } catch (e) {}
    let dim = document.getElementById('qvas-dim');
    if (!dim && document.body) {
      dim = document.createElement('div'); dim.id = 'qvas-dim';
      dim.style.cssText = 'position:fixed;left:var(--qv-l,0);top:var(--qv-t,0);right:var(--qv-r,0);bottom:var(--qv-bm,0);background:#000;pointer-events:none;z-index:2147483646;transition:opacity .1s';
      document.body.appendChild(dim);
    }
    if (dim) dim.style.opacity = String(((100 - v) / 100) * 0.8); // never fully black
  }
  const initBrightness = () => applyBrightness(savedBrightness());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initBrightness); else initBrightness();

  // "Restart in Frameless Full Screen" is an Electron feature. On iPhone the equivalent of frameless full screen is
  // running from the Home Screen icon, so: from the icon it restarts (reloads) the app; in a Safari tab it explains how.
  function toast(msg) {
    let t = document.getElementById('qvas-toast');
    if (!t) { t = document.createElement('div'); t.id = 'qvas-toast';
      t.style.cssText = 'position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 70px);transform:translateX(-50%);max-width:80vw;z-index:2147483647;background:rgba(0,0,0,.85);color:#fff;border:1px solid rgba(255,255,255,.4);border-radius:10px;padding:10px 14px;font:14px -apple-system,Helvetica,Arial,sans-serif;text-align:center';
      document.body.appendChild(t); }
    t.textContent = msg; t.style.display = 'block';
    clearTimeout(toast._t); toast._t = setTimeout(() => { t.style.display = 'none'; }, 6000);
  }
  document.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest && e.target.closest('#restart-app-btn');
    if (!btn) return;
    e.stopImmediatePropagation(); e.preventDefault();
    const standalone = window.navigator.standalone === true || (window.matchMedia && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches));
    if (standalone) { toast('Restarting\u2026'); setTimeout(() => location.reload(), 400); return; }
    const el = document.documentElement;
    if (el.requestFullscreen) { el.requestFullscreen().then(() => toast('Full screen on')).catch(() => toast('Full screen was blocked by the browser.')); return; }
    toast('For full screen: tap Share, then Add to Home Screen, and open VAS HMI-C from the Home Screen icon.');
  }, true);

  // ---------- offline ----------
  // sw.js (generated by the build) caches the app, timetable, CCTV and data automatically. The announcement audio is
  // large, so it is downloaded once with the bar's download button; after that only new or changed files download.
  const offline = (function () {
    const AUDIO_CACHE = 'qvas-audio-v1', IDX_KEY = '__audio-index__';
    const ok = !!(window.caches && navigator.serviceWorker);
    const st = { ready: false, missing: 0, total: 0, bytes: 0, busy: false, pct: 0, hadAny: false, known: false };
    const listeners = [];
    const emit = () => listeners.forEach(f => { try { f(st); } catch (e) {} });
    const enc = (u) => u.split('/').map(encodeURIComponent).join('/');
    if (ok) window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {}); });

    async function readIndex() { try { const r = await (await caches.open(AUDIO_CACHE)).match(IDX_KEY); return r ? await r.json() : {}; } catch (e) { return {}; } }
    async function writeIndex(idx) { await (await caches.open(AUDIO_CACHE)).put(IDX_KEY, new Response(JSON.stringify(idx))); }
    async function hashes() { try { const r = await realFetch('audio-hashes.json', { cache: 'no-store' }); return r.ok ? await r.json() : null; } catch (e) { return null; } }

    async function refresh() {
      if (!ok) return st;
      const idx = await readIndex();
      st.hadAny = Object.keys(idx).length > 0;
      const h = await hashes();
      if (h) {
        let missing = 0;
        for (const u in h.files) if (idx[u] !== h.files[u]) missing++;
        Object.assign(st, { total: h.count, bytes: h.bytes, missing, ready: missing === 0, known: true });
      } else if (st.hadAny) { Object.assign(st, { ready: true, missing: 0, known: false }); }   // offline: trust what is stored
      emit(); return st;
    }

    async function download() {
      if (!ok || st.busy) return;
      const h = await hashes();
      if (!h) { toast('Connect to the internet to download the audio.'); return; }
      const cache = await caches.open(AUDIO_CACHE);
      const idx = await readIndex();
      for (const u of Object.keys(idx)) if (!(u in h.files)) { await cache.delete(enc(u)); delete idx[u]; }   // removed upstream
      const todo = Object.keys(h.files).filter(u => idx[u] !== h.files[u]);
      if (!todo.length) { await writeIndex(idx); await refresh(); toast('Audio is already downloaded.'); return; }
      const need = todo.reduce((a, u) => a + Number(h.files[u].split(':')[1] || 0), 0);
      try { const e = await navigator.storage.estimate(); if (e.quota && e.quota - e.usage < need * 1.05) { toast('Not enough free space for the audio (' + Math.round(need / 1048576) + ' MB needed).'); return; } } catch (e) {}
      try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
      st.busy = true; st.pct = 0; emit();
      let done = 0, failed = 0, next = 0, sinceSave = 0;
      const worker = async () => {
        while (next < todo.length) {
          const u = todo[next++];
          try {
            const r = await realFetch(enc(u), { cache: 'reload' });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            await cache.put(enc(u), r);
            idx[u] = h.files[u];
          } catch (e) { failed++; }
          done++; st.pct = Math.round(done / todo.length * 100); emit();
          if (++sinceSave >= 40) { sinceSave = 0; try { await writeIndex(idx); } catch (e) {} }   // so an interrupted download resumes
        }
      };
      try { await Promise.all([worker(), worker(), worker(), worker()]); } finally { try { await writeIndex(idx); } catch (e) {} st.busy = false; }
      await refresh();
      toast(failed ? `Downloaded with ${failed} problem files. Tap the download button again to retry.` : 'Audio downloaded. Announcements now work without signal.');
    }
    refresh();
    return { st, refresh, download, onChange: (f) => listeners.push(f) };
  })();
  window.__qvasOffline = offline;
  // tell people once that the audio can be downloaded
  setTimeout(async () => {
    try {
      if (localStorage.getItem('qvas-offline-tip') || !navigator.onLine) return;
      const s = await offline.refresh();
      if (s.known && !s.ready) { localStorage.setItem('qvas-offline-tip', '1'); toast('Tip: tap the download button in the key bar to save the audio for use without signal.'); }
    } catch (e) {}
  }, 12000);

  // ---------- updater ----------
  // The desktop app updates through an installer; a web app updates by being re-published. Each time a new build is
  // pushed to GitHub Pages, version.json changes. Check on start, every 10 minutes and whenever the app comes back to
  // the screen, and offer "Update now" (refreshes the cached files, then reloads).
  (function () {
    const mine = window.__QVAS_BUILD;
    if (!mine) return;
    let banner = null, snoozedUntil = 0;
    async function latest() {
      try {
        const r = await realFetch('version.json?_=' + Date.now(), { cache: 'no-store' });
        return r.ok ? await r.json() : null;
      } catch (e) { return null; }
    }
    async function applyUpdate(btn) {
      if (btn) { btn.disabled = true; btn.textContent = 'Updating\u2026'; }
      let usedSW = false;
      try {
        const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update();                       // downloads only the files that changed, then the new worker takes over
          const sw = reg.installing || reg.waiting;
          if (sw && !['activated', 'redundant'].includes(sw.state)) {
            await new Promise((res) => {
              sw.addEventListener('statechange', () => { if (['activated', 'redundant'].includes(sw.state)) res(); });
              setTimeout(res, 180000);
            });
          }
          usedSW = true;
        }
      } catch (e) {}
      if (!usedSW) {
        const files = ['./', 'index.html', 'app.js', 'style.css', 'qvas-web-shim.js', 'file-index.js', 'version.json'];
        try { await Promise.all(files.map(f => realFetch(f, { cache: 'reload' }))); } catch (e) {}
      }
      location.reload();
    }
    function showBanner(v) {
      if (banner || Date.now() < snoozedUntil) return;
      banner = document.createElement('div');
      banner.id = 'qvas-update';
      banner.style.cssText = 'position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 8px);transform:translateX(-50%);z-index:2147483647;background:rgba(0,0,0,.9);color:#fff;border:1px solid rgba(255,255,255,.45);border-radius:12px;padding:8px 12px;font:14px -apple-system,Helvetica,Arial,sans-serif;display:flex;gap:10px;align-items:center';
      const t = document.createElement('span'); t.textContent = 'Update available' + (v && v.appVersion ? ' (v' + v.appVersion + ')' : '');
      const go = document.createElement('button'); go.textContent = 'Update now';
      const later = document.createElement('button'); later.textContent = 'Later';
      [go, later].forEach(b => { b.style.cssText = 'min-height:38px;padding:0 14px;border-radius:9px;border:1px solid rgba(255,255,255,.4);background:#1d6b3a;color:#fff;font-size:14px'; });
      later.style.background = '#333';
      go.addEventListener('click', () => applyUpdate(go));
      later.addEventListener('click', () => { snoozedUntil = Date.now() + 30 * 60 * 1000; banner.remove(); banner = null; });
      banner.append(t, go, later);
      document.body.appendChild(banner);
    }
    async function check(manual) {
      const v = await latest();
      if (!v) { if (manual) toast('Could not check for updates. Are you online?'); return; }
      if (v.buildId !== mine) { snoozedUntil = 0; showBanner(v); return; }
      if (!manual) return;
      // same build as the site: also ask SaltyPlayzYT's releases whether something newer has been published
      let note = '';
      try {
        const ctl = new AbortController(); setTimeout(() => ctl.abort(), 6000);
        const r = await realFetch('https://api.github.com/repos/SaltyPlayzYT/QVAS-Project/releases/latest', { signal: ctl.signal, headers: { Accept: 'application/vnd.github+json' } });
        if (r.ok) {
          const tag = String((await r.json()).tag_name || '');
          const num = (t) => String(t).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
          const cmp = (a, b) => { for (let i = 0; i < 3; i++) { if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) - (b[i] || 0); } return 0; };
          if (tag && cmp(num(tag), num(window.__QVAS_RELEASE || window.__QVAS_VERSION || '0')) > 0)
            note = ' SaltyPlayzYT has released ' + tag + '. It will appear here automatically once the phone app has been rebuilt.';
        }
      } catch (e) {}
      toast("You're up to date" + (window.__QVAS_VERSION ? ' (v' + window.__QVAS_VERSION + ')' : '') + '.' + note);
    }
    window.__qvasCheckUpdate = check;
    setTimeout(check, 5000);
    setInterval(check, 10 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    // the Status screen's buttons call the desktop updater; point them at this one
    document.addEventListener('click', (e) => {
      const el = e.target && e.target.closest && e.target.closest('#check-application-update-btn, #check-assets-update-btn, #reinstall-audio-assets-btn');
      if (!el) return;
      e.stopImmediatePropagation(); e.preventDefault();
      if (el.id === 'check-application-update-btn') { toast('Checking for updates\u2026'); check(true); }
      else toast('Audio is built into this app. It updates together with the app (use Check for Application Updates).');
    }, true);
  })();

  window.electron = {
    platform: 'web',
    updateGTFS: async () => ({ success: false, message: 'Update GTFS on the desktop app, then re-run the site build.' }),
    getGTFSStatus: async () => ({ success: false, updatedAt: 'Bundled with app', dueAt: 'Unavailable' }),
    // A web page can't change iPhone brightness, so the slider dims the app with a black overlay instead.
    getSystemBrightness: async () => ({ success: true, value: savedBrightness() }),
    setSystemBrightness: async (v) => { applyBrightness(v); return { success: true, value: savedBrightness() }; },
    onGTFSUpdateProgress: () => {},
    onDoorStateChanged: () => {},
    onGlobalKey: () => {},
    doorUnlock: () => {},
    doorLock: () => {}
  };
})();
