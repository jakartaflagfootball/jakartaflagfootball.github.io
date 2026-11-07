// Backend layer. Uses Supabase when configured, otherwise a local demo backend
// so the site can be previewed without any setup.
(function () {
  const cfg = window.JFF_CONFIG;
  const CATEGORIES = ['men_offense', 'men_defense', 'women_offense', 'women_defense'];

  // ─── SUPABASE ──────────────────────────────────────────
  function supabaseApi() {
    // Sign-in is stored in a cookie shared across *.jakartaflagfootball.com (see jff-auth.js).
    const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: JFFAuth.options() });
    const ok = ({ data, error }) => { if (error) throw error; return data; };
    const toUser = (u) => u && {
      id: u.id,
      email: u.email,
      name: u.user_metadata?.full_name || u.user_metadata?.name || u.email,
      avatar: u.user_metadata?.avatar_url || u.user_metadata?.picture || null,
    };
    return {
      demo: false,
      async getUser() { const { data } = await sb.auth.getSession(); return toUser(data.session?.user); },
      onAuthChange(cb) { sb.auth.onAuthStateChange((_e, s) => cb(toUser(s?.user))); },
      // Fallback only: full-page redirect through Supabase (used if Google's button can't load).
      async signIn() {
        await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href } });
      },
      mountSignIn(el, text) {
        return JFFAuth.mountSignIn(el, { sb, clientId: cfg.GOOGLE_CLIENT_ID, text, fallback: fallbackButton, onError: signInError });
      },
      oneTap() { return JFFAuth.oneTap({ sb, clientId: cfg.GOOGLE_CLIENT_ID, onError: signInError }); },
      async signOut() { JFFAuth.signOutGoogle(); await sb.auth.signOut(); },
      async listWeeks() { return ok(await sb.from('potw_weeks').select('*').order('starts_at', { ascending: false })); },
      async myVotes(weekId) {
        const user = await this.getUser(); if (!user) return {};
        const rows = ok(await sb.from('potw_votes').select('category,player_id').eq('week_id', weekId).eq('voter_id', user.id));
        return Object.fromEntries(rows.map((r) => [r.category, r.player_id]));
      },
      async castVote(weekId, category, playerId) {
        const { error } = await sb.from('potw_votes').insert({ week_id: weekId, category, player_id: playerId });
        if (error) {
          if (error.code === '23505') throw new Error('You already voted in this category this week.');
          if (error.code === '42501') throw new Error('Vote not accepted. Voting may have closed. Refresh the page and try again.');
          throw error;
        }
      },
      async leaderboard(weekId) { return ok(await sb.rpc('potw_leaderboard', { w: weekId })); },
      async voterCount(weekId) { return ok(await sb.rpc('potw_voter_count', { w: weekId })); },
      async isAdmin() { return !!ok(await sb.rpc('is_admin')); },
      async createWeek(w) { return ok(await sb.from('potw_weeks').insert(w).select().single()); },
      async updateWeek(id, patch) { return ok(await sb.from('potw_weeks').update(patch).eq('id', id).select().single()); },
      async deleteWeek(id) { ok(await sb.from('potw_weeks').delete().eq('id', id)); },
      async clearVotes(id) {
        const { count, error } = await sb.from('potw_votes').delete({ count: 'exact' }).eq('week_id', id);
        if (error) throw error;
        return count ?? 0;
      },
    };
  }

  // ─── DEMO (localStorage) ───────────────────────────────
  function demoApi() {
    const KEY = 'jff-potw-demo-v1';
    const listeners = [];
    const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
    const save = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };
    let state = load();
    if (!state) {
      const now = Date.now(), day = 864e5;
      state = {
        user: null, nextWeek: 3, votes: [],
        weeks: [
          { id: 2, label: 'Week 2 — Matchday 2', starts_at: new Date(now - day).toISOString(), ends_at: new Date(now + 4 * day).toISOString(), closed: false },
          { id: 1, label: 'Week 1 — Matchday 1', starts_at: new Date(now - 8 * day).toISOString(), ends_at: new Date(now - 2 * day).toISOString(), closed: false },
        ],
      };
      // Fake votes from other fans so the leaderboard has something to show.
      const players = window.JFF_PLAYERS;
      let fake = 0;
      for (const w of [1, 2]) for (const c of CATEGORIES) {
        const pool = players.filter((p) => p.division === c.split('_')[0]).sort(() => Math.random() - 0.5).slice(0, 9);
        pool.forEach((p, i) => { for (let n = 0; n < Math.round(40 / (i + 1.3)); n++) state.votes.push({ week_id: w, category: c, player_id: p.id, voter_id: 'fan-' + (fake++ % 120) }); });
      }
      save(state);
    }
    const emit = () => listeners.forEach((cb) => cb(state.user));
    const isOpen = (w) => !w.closed && Date.now() >= +new Date(w.starts_at) && Date.now() <= +new Date(w.ends_at);
    const delay = (v) => new Promise((r) => setTimeout(() => r(v), 120));
    return {
      demo: true,
      async getUser() { return state.user; },
      onAuthChange(cb) { listeners.push(cb); },
      mountSignIn(el) { const app = JFFAuth.inAppBrowser(); return app ? JFFAuth.mountSignIn(el, {}) : fallbackButton(el); },
      oneTap() {},
      async signIn() { state.user = { id: 'demo-you', email: 'you@example.com', name: 'Demo Voter', avatar: null }; save(state); emit(); },
      async signOut() { state.user = null; save(state); emit(); },
      async listWeeks() { return delay([...state.weeks].sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at))); },
      async myVotes(weekId) {
        if (!state.user) return {};
        return Object.fromEntries(state.votes.filter((v) => v.week_id === weekId && v.voter_id === state.user.id).map((v) => [v.category, v.player_id]));
      },
      async castVote(weekId, category, playerId) {
        if (!state.user) throw new Error('Please sign in first.');
        const w = state.weeks.find((x) => x.id === weekId);
        if (!w || !isOpen(w)) throw new Error('Voting is closed for this week.');
        const p = window.JFF_PLAYERS.find((x) => x.id === playerId);
        if (!p || p.division !== category.split('_')[0]) throw new Error('That player is not in this category.');
        if (state.votes.some((v) => v.week_id === weekId && v.category === category && v.voter_id === state.user.id))
          throw new Error('You already voted in this category this week.');
        state.votes.push({ week_id: weekId, category, player_id: playerId, voter_id: state.user.id });
        save(state); await delay();
      },
      async leaderboard(weekId) {
        const m = new Map();
        for (const v of state.votes) if (v.week_id === weekId) { const k = v.category + '|' + v.player_id; m.set(k, (m.get(k) || 0) + 1); }
        return delay([...m].map(([k, n]) => { const [category, player_id] = k.split('|'); return { category, player_id, votes: n }; }).sort((a, b) => b.votes - a.votes));
      },
      async voterCount(weekId) { return new Set(state.votes.filter((v) => v.week_id === weekId).map((v) => v.voter_id)).size; },
      async isAdmin() { return !!state.user; },
      async createWeek(w) { const row = { id: state.nextWeek++, closed: false, ...w }; state.weeks.push(row); save(state); return row; },
      async updateWeek(id, patch) { const w = state.weeks.find((x) => x.id === id); Object.assign(w, patch); save(state); return w; },
      async deleteWeek(id) { state.weeks = state.weeks.filter((x) => x.id !== id); state.votes = state.votes.filter((v) => v.week_id !== id); save(state); },
      async clearVotes(id) { const n = state.votes.filter((v) => v.week_id === id).length; state.votes = state.votes.filter((v) => v.week_id !== id); save(state); return n; },
      resetDemo() { try { localStorage.removeItem(KEY); } catch {} location.reload(); },
    };
  }

  const GOOGLE_ICON = '<svg viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
  function fallbackButton(el) { el.innerHTML = `<button type="button" class="btn-google" data-signin>${GOOGLE_ICON}Sign in with Google</button>`; }
  function signInError(e) { console.error(e); window.JFF?.toast('Sign-in failed: ' + (e.message || 'please try again'), 'error'); }

  const api = cfg.SUPABASE_URL ? supabaseApi() : demoApi();

  // ─── SHARED HELPERS ────────────────────────────────────
  const TZ = 'Asia/Jakarta';
  window.JFF = {
    api,
    CATEGORIES,
    CATEGORY_LABEL: { men_offense: "Men's Offense", men_defense: "Men's Defense", women_offense: "Women's Offense", women_defense: "Women's Defense" },
    teams: Object.fromEntries(window.JFF_TEAMS.map((t) => [t.id, t])),
    players: Object.fromEntries(window.JFF_PLAYERS.map((p) => [p.id, p])),
    isOpen(w) { return !!w && !w.closed && Date.now() >= +new Date(w.starts_at) && Date.now() <= +new Date(w.ends_at); },
    // Week to show by default: the open one, else the next upcoming, else the most recent.
    pickWeek(weeks) {
      const now = Date.now();
      return weeks.find((w) => JFF.isOpen(w))
        || [...weeks].filter((w) => !w.closed && +new Date(w.starts_at) > now).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))[0]
        || weeks[0] || null;
    },
    fmtDate(d) { return new Date(d).toLocaleString('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' WIB'; },
    esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
    initials(name) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase(); },
    logoHtml(team, cls = 'team-logo') {
      return team.logo
        ? `<img class="${cls}" src="team-logos/${JFF.esc(team.logo)}" alt="${JFF.esc(team.name)}" loading="lazy">`
        : `<span class="${cls} team-logo-fallback">${JFF.esc(JFF.initials(team.name))}</span>`;
    },
    toast(msg, kind = '') {
      let el = document.getElementById('toast');
      if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
      el.className = 'toast show ' + kind; el.textContent = msg;
      clearTimeout(el._t); el._t = setTimeout(() => (el.className = 'toast'), 3200);
    },
  };
})();
