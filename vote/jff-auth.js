// Shared JFF sign-in storage.
// Keeps the Supabase login in cookies on .jakartaflagfootball.com so every JFF site
// (main site, /vote, playbook.jakartaflagfootball.com, …) shares one sign-in.
// To reuse on another JFF site: include this file, then create the client with
//   supabase.createClient(URL, KEY, { auth: JFFAuth.options() })
// using the SAME Supabase project URL and key.
window.JFFAuth = (function () {
  const ROOT = 'jakartaflagfootball.com';
  const CHUNK = 3000;               // stay well under the ~4KB per-cookie browser limit
  const MAX_AGE = 60 * 60 * 24 * 365;

  // On any *.jakartaflagfootball.com host, share the cookie across the whole domain.
  // Anywhere else (localhost, previews) keep it on the current host only.
  const domain = location.hostname === ROOT || location.hostname.endsWith('.' + ROOT) ? '.' + ROOT : null;
  const attrs = (maxAge) => ['path=/', `max-age=${maxAge}`, 'SameSite=Lax', domain && `domain=${domain}`, location.protocol === 'https:' && 'Secure']
    .filter(Boolean).join('; ');

  function readAll() {
    const out = {};
    for (const part of document.cookie.split('; ')) {
      const i = part.indexOf('=');
      if (i > 0) out[part.slice(0, i)] = part.slice(i + 1);
    }
    return out;
  }
  function chunkNames(all, key) {
    return Object.keys(all).filter((n) => n === key || n.startsWith(key + '.'));
  }
  function remove(key) {
    for (const n of chunkNames(readAll(), key)) document.cookie = `${n}=; ${attrs(0)}`;
  }

  const storage = {
    getItem(key) {
      const all = readAll();
      if (all[key] !== undefined) return decodeURIComponent(all[key]);
      let s = '', i = 0;
      while (all[`${key}.${i}`] !== undefined) s += all[`${key}.${i++}`];
      return i ? decodeURIComponent(s) : null;
    },
    setItem(key, value) {
      remove(key);
      const enc = encodeURIComponent(value);
      if (enc.length <= CHUNK) { document.cookie = `${key}=${enc}; ${attrs(MAX_AGE)}`; return; }
      for (let i = 0, n = 0; i < enc.length; i += CHUNK, n++) {
        let piece = enc.slice(i, i + CHUNK);
        // never split a %XX escape across two cookies
        const cut = piece.lastIndexOf('%');
        if (cut > piece.length - 3 && i + CHUNK < enc.length) { piece = piece.slice(0, cut); i -= CHUNK - cut; }
        document.cookie = `${key}.${n}=${piece}; ${attrs(MAX_AGE)}`;
      }
    },
    removeItem: remove,
  };

  const exported = {
    storage,
    domain,
    options() {
      return { storage, storageKey: 'jff-auth', flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true };
    },
    inAppBrowser,
    mountSignIn,
    oneTap,
    signOutGoogle() { try { window.google?.accounts?.id?.disableAutoSelect(); } catch {} },
  };

  // ─── GOOGLE SIGN-IN BUTTON ─────────────────────────────
  // Uses Google's own button/popup ("Sign in to jakartaflagfootball.com") and hands the
  // Google token to Supabase, instead of redirecting through the supabase.co address.

  // Instagram, Facebook, TikTok, LINE, etc. open links in a built-in browser where
  // Google blocks sign-in. Detect those so we can ask people to open a real browser.
  function inAppBrowser() {
    const ua = navigator.userAgent || '';
    const m = ua.match(/Instagram|FBAN|FBAV|FB_IAB|FBIOS|Line\/|TikTok|musical_ly|Bytedance|Twitter|LinkedInApp|Snapchat|Threads|GSA\//);
    if (m) return { name: { FBAN: 'Facebook', FBAV: 'Facebook', FB_IAB: 'Facebook', FBIOS: 'Facebook', 'Line/': 'LINE', musical_ly: 'TikTok', Bytedance: 'TikTok', 'GSA/': 'Google app' }[m[0]] || m[0] };
    if (/Android/.test(ua) && /; wv\)/.test(ua)) return { name: 'this app' };
    return null;
  }

  let gisLoad = null;
  function loadGis() {
    if (window.google?.accounts?.id) return Promise.resolve();
    return (gisLoad ||= new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = () => res(); s.onerror = () => { gisLoad = null; rej(new Error('Could not load Google sign-in')); };
      document.head.appendChild(s);
    }));
  }

  // Google only accepts one initialize() at a time; a fresh nonce is used for each sign-in.
  let pendingNonce = null, initPromise = null;
  function initGis(sb, clientId, onError) {
    return (initPromise ||= doInitGis(sb, clientId, onError).catch((e) => { initPromise = null; throw e; }));
  }
  async function doInitGis(sb, clientId, onError) {
    await loadGis();
    const raw = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('');
    const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    const hashed = Array.from(new Uint8Array(hashBuf), (b) => b.toString(16).padStart(2, '0')).join('');
    pendingNonce = raw;
    google.accounts.id.initialize({
      client_id: clientId,
      nonce: hashed,
      ux_mode: 'popup',
      context: 'signin',
      itp_support: true,
      use_fedcm_for_prompt: true,
      callback: async (resp) => {
        const nonce = pendingNonce; pendingNonce = null; initPromise = null; // next sign-in gets a fresh nonce
        const { error } = await sb.auth.signInWithIdToken({ provider: 'google', token: resp.credential, nonce });
        if (error) onError?.(error);
      },
    });
  }

  function renderInAppNotice(el, app) {
    const url = location.href;
    const android = /Android/.test(navigator.userAgent);
    const intent = 'intent://' + url.replace(/^https?:\/\//, '') + '#Intent;scheme=https;package=com.android.chrome;end';
    el.innerHTML = `<div class="inapp-notice">
      <b>Open this page in your browser to sign in.</b>
      <span>Google doesn't allow sign-in inside ${app.name}. ${android ? 'Tap the button below, or tap ⋮ and choose <b>Open in Chrome</b>.' : 'Tap <b>•••</b> (top or bottom right) and choose <b>Open in browser</b> / <b>Open in Safari</b>.'}</span>
      <div class="inapp-btns">${android ? `<a class="btn-primary btn-sm" href="${intent}">Open in Chrome</a>` : ''}<button type="button" class="btn-secondary btn-sm" data-copy-link>Copy link</button></div>
    </div>`;
    el.querySelector('[data-copy-link]').onclick = async () => {
      try { await navigator.clipboard.writeText(url); el.querySelector('[data-copy-link]').textContent = 'Copied. Paste it in your browser'; }
      catch { prompt('Copy this link and open it in your browser:', url); }
    };
  }

  // Put a Google sign-in button into `el`. Falls back to the redirect flow (`fallback`)
  // if no client ID is set or Google's script can't load.
  async function mountSignIn(el, { sb, clientId, fallback, onError, text = 'signin_with' }) {
    if (!el) return;
    const app = inAppBrowser();
    if (app) return renderInAppNotice(el, app);
    if (!clientId) return fallback(el);
    try {
      await initGis(sb, clientId, onError);
      el.innerHTML = '';
      google.accounts.id.renderButton(el, {
        type: 'standard', theme: 'outline', size: 'large', shape: 'rectangular',
        text, logo_alignment: 'left', locale: document.documentElement.lang === 'id' ? 'id' : 'en', width: Math.max(220, Math.min(320, el.clientWidth || 320)),
      });
    } catch (e) {
      console.warn(e); fallback(el);
    }
  }

  // The "Continue as …" popup for people already signed in to Google in this browser.
  async function oneTap({ sb, clientId, onError }) {
    if (!clientId || inAppBrowser()) return;
    try { await initGis(sb, clientId, onError); google.accounts.id.prompt(); } catch (e) { console.warn(e); }
  }
  return exported;
})();
