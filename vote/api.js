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
    const PUB = 'nominee-photos', FULL = 'nominee-photos-full';
    const PUB_URL = `${cfg.SUPABASE_URL}/storage/v1/object/public/${PUB}`;
    const isNew = (path) => /-sm\.jpg$/.test(path);
    // Remove every file of a photo (all three sizes, or the single older file). Failures are ignored.
    async function removePhoto(path) {
      const tasks = isNew(path)
        ? [sb.storage.from(PUB).remove([path, path.replace(/-sm\.jpg$/, '-md.jpg')]), sb.storage.from(FULL).remove([path.replace(/-sm\.jpg$/, '-full.jpg')])]
        : [sb.storage.from(PUB).remove([path])];
      const res = await Promise.all(tasks.map((t) => t.catch((e) => ({ error: e }))));
      res.filter((r) => r.error).forEach((r) => console.warn('Old photo not removed', r.error));
    }
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
      // ─── Captain nominations ───
      async listNominations(weekId) {
        return ok(await sb.from('potw_nominations').select('player_id,team_id,nominated_by,created_at,photo_path').eq('week_id', weekId));
      },
      async myCaptainTeams() {
        const rows = ok(await sb.rpc('my_captain_teams')) || [];
        return rows.map((r) => (typeof r === 'string' ? r : Object.values(r)[0]));
      },
      async nominate(weekId, teamId, playerId) {
        const { error } = await sb.from('potw_nominations').insert({ week_id: weekId, team_id: teamId, player_id: playerId });
        if (error) {
          if (error.code === '23505') return; // already nominated
          if (error.code === '42501') throw new Error('Nominations are closed for this week, or this email is not a captain of this team.');
          throw error;
        }
      },
      async unnominate(weekId, playerId) {
        const { count, error } = await sb.from('potw_nominations').delete({ count: 'exact' }).eq('week_id', weekId).eq('player_id', playerId);
        if (error) throw error;
        if (!count) throw new Error("Voting has already opened, so nominees can't be removed. Ask a JFF admin.");
      },
      // Save a nominee photo as three files (see supabase/photo-sizes.sql):
      // small + medium in the public bucket, full quality in the private one.
      // `v` comes from JFF.photoVersions(). Returns the new photo_path (the small file).
      async uploadPhoto(weekId, playerId, v) {
        const NOPE = "This photo can't be changed now. Voting has closed, or you're not this team's captain.";
        const prev = (await sb.from('potw_nominations').select('photo_path').eq('week_id', weekId).eq('player_id', playerId).maybeSingle()).data?.photo_path;
        const base = `${weekId}/${playerId}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
        const opts = { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false };
        const ups = await Promise.all([
          sb.storage.from(PUB).upload(base + '-sm.jpg', v.sm, opts),
          sb.storage.from(PUB).upload(base + '-md.jpg', v.md, opts),
          sb.storage.from(FULL).upload(base + '-full.jpg', v.full, opts),
        ]);
        const err = ups.find((u) => u.error)?.error;
        if (err) {
          await removePhoto(base + '-sm.jpg');
          if (/row-level security|403|Unauthorized/i.test(err.message || '')) throw new Error(NOPE);
          throw err;
        }
        const path = base + '-sm.jpg';
        const rows = ok(await sb.from('potw_nominations').update({ photo_path: path }).eq('week_id', weekId).eq('player_id', playerId).select('player_id'));
        if (!rows.length) { await removePhoto(path); throw new Error(NOPE); }
        // The new photo is saved; remove the old files. If this fails, they just stay unused.
        if (prev && prev !== path) await removePhoto(prev);
        return path;
      },
      // Card photo (small). Older single-file photos are returned as they are.
      photoUrl(path) { return path ? `${PUB_URL}/${path}` : null; },
      // Story photo (medium), falling back to the card photo for older uploads.
      photoMdUrl(path) { return path ? `${PUB_URL}/${isNew(path) ? path.replace(/-sm\.jpg$/, '-md.jpg') : path}` : null; },
      isOldPhoto(path) { return !!path && !isNew(path); },
      // Full-quality download link for admins/designers (expires after an hour).
      async fullPhotoUrl(path, filename) {
        if (!path) return null;
        if (!isNew(path)) return `${PUB_URL}/${path}` + (filename ? `?download=${encodeURIComponent(filename)}` : '');
        const { data, error } = await sb.storage.from(FULL).createSignedUrl(path.replace(/-sm\.jpg$/, '-full.jpg'), 3600, filename ? { download: filename } : undefined);
        if (error) throw error;
        return data.signedUrl;
      },
      async isMedia() { return !!ok(await sb.rpc('potw_is_media')); },
      async listDesigners() { return ok(await sb.from('potw_designers').select('email,added_at').order('email')); },
      async addDesigner(email) {
        const { error } = await sb.from('potw_designers').insert({ email: email.trim().toLowerCase() });
        if (error && error.code !== '23505') throw error;
      },
      async removeDesigner(email) { ok(await sb.from('potw_designers').delete().eq('email', email)); },
      // Nominations (all weeks) still on an older single-file photo.
      async listOldPhotos() {
        const rows = ok(await sb.from('potw_nominations').select('week_id,player_id,photo_path').not('photo_path', 'is', null));
        return rows.filter((r) => !isNew(r.photo_path));
      },
      async fetchPhoto(path) {
        const r = await fetch(`${PUB_URL}/${path}`);
        if (!r.ok) throw new Error('Could not load photo ' + path);
        return r.blob();
      },
      async listCaptains() { return ok(await sb.from('team_captains').select('team_id,email').order('team_id')); },
      async addCaptain(teamId, email) {
        const { error } = await sb.from('team_captains').insert({ team_id: teamId, email: email.trim().toLowerCase() });
        if (error && error.code !== '23505') throw error;
      },
      async removeCaptain(teamId, email) { ok(await sb.from('team_captains').delete().eq('team_id', teamId).eq('email', email)); },
      // ─── Feeling Gue Sih… (pick'em, see supabase/pickem.sql) ───
      async pickemGames(season) { return ok(await sb.from('pickem_games').select('*').eq('season', season)); },
      async myPicks(season) {
        const user = await this.getUser(); if (!user) return {};
        const rows = ok(await sb.from('pickem_picks').select('game_id,winner,margin').eq('user_id', user.id).like('game_id', season + ':%'));
        return Object.fromEntries(rows.map((r) => [r.game_id, r]));
      },
      async savePick(gameId, winner, margin) {
        const user = await this.getUser(); if (!user) throw new Error('Please sign in first.');
        const { error } = await sb.from('pickem_picks').upsert(
          { game_id: gameId, user_id: user.id, winner, margin: margin || null, updated_at: new Date().toISOString() },
          { onConflict: 'game_id,user_id' });
        if (error) {
          if (error.code === '42501') throw new Error('This game has kicked off, so picks are locked.');
          throw error;
        }
      },
      async clearPick(gameId) {
        const user = await this.getUser(); if (!user) return;
        ok(await sb.from('pickem_picks').delete().eq('game_id', gameId).eq('user_id', user.id));
      },
      // Split per game, only for games this fan picked. Signed out: nothing.
      async pickemCrowd(season) { if (!(await this.getUser())) return []; return ok(await sb.rpc('pickem_crowd', { s: season })); },
      async pickemCounts(season) { return ok(await sb.rpc('pickem_pick_counts', { s: season })); },
      async pickemLeaderboard(season, round) { return ok(await sb.rpc('pickem_leaderboard', { s: season, rk: round || null })); },
      async myPickemName() {
        const user = await this.getUser(); if (!user) return null;
        return (await sb.from('pickem_players').select('display_name').eq('user_id', user.id).maybeSingle()).data?.display_name || null;
      },
      async setPickemName(name) {
        const user = await this.getUser(); if (!user) throw new Error('Please sign in first.');
        ok(await sb.from('pickem_players').upsert({ user_id: user.id, display_name: name.trim() }, { onConflict: 'user_id' }));
      },
      // Admin: copy games and results from season.json (rows from JFF.pickemRows). Never deletes.
      async syncPickemGames(rows) { ok(await sb.from('pickem_games').upsert(rows, { onConflict: 'id' })); return rows.length; },
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
        user: null, nextWeek: 3, votes: [], nominations: [], captains: [],
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
        if (w.nominations && !(state.nominations || []).some((n) => n.week_id === weekId && n.player_id === playerId)) throw new Error('That player was not nominated this week.');
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
      async listNominations(weekId) { return delay((state.nominations || []).filter((n) => n.week_id === weekId)); },
      async myCaptainTeams() { return state.user ? window.JFF_TEAMS.map((t) => t.id) : []; },
      async nominate(weekId, teamId, playerId) {
        state.nominations ||= [];
        const w = state.weeks.find((x) => x.id === weekId);
        if (!w?.nominations) throw new Error('This week does not use captain nominations.');
        if (state.nominations.some((n) => n.week_id === weekId && n.player_id === playerId)) return;
        if (state.nominations.filter((n) => n.week_id === weekId && n.team_id === teamId).length >= 2) throw new Error('Each team can nominate at most 2 players.');
        state.nominations.push({ week_id: weekId, team_id: teamId, player_id: playerId, nominated_by: state.user?.email, created_at: new Date().toISOString() });
        save(state); await delay();
      },
      async unnominate(weekId, playerId) { state.nominations = (state.nominations || []).filter((n) => !(n.week_id === weekId && n.player_id === playerId)); save(state); },
      async uploadPhoto(weekId, playerId, v) {
        const n = (state.nominations || []).find((x) => x.week_id === weekId && x.player_id === playerId);
        if (!n) throw new Error('Nominate the player first.');
        const url = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
        // Demo keeps small + medium only (full-size data URLs would overflow browser storage).
        const [sm, md] = await Promise.all([url(v.sm), url(v.md)]);
        if (n.photo_path) delete (state.photoMd || {})[n.photo_path];
        n.photo_path = sm; (state.photoMd ||= {})[sm] = md;
        save(state); await delay(); return n.photo_path;
      },
      photoUrl(path) { return path || null; },
      photoMdUrl(path) { return (path && state.photoMd?.[path]) || path || null; },
      isOldPhoto(path) { return !!path && !state.photoMd?.[path]; },
      async fullPhotoUrl(path) { return (path && state.photoMd?.[path]) || path || null; },
      async isMedia() { return !!state.user; },
      async listDesigners() { return [...(state.designers || [])]; },
      async addDesigner(email) { state.designers ||= []; if (!state.designers.some((d) => d.email === email)) state.designers.push({ email: email.trim().toLowerCase() }); save(state); },
      async removeDesigner(email) { state.designers = (state.designers || []).filter((d) => d.email !== email); save(state); },
      async listOldPhotos() { return (state.nominations || []).filter((n) => n.photo_path && !state.photoMd?.[n.photo_path]); },
      async fetchPhoto(path) { return (await fetch(path)).blob(); },
      async listCaptains() { return [...(state.captains || [])]; },
      async addCaptain(team_id, email) { state.captains ||= []; state.captains.push({ team_id, email: email.trim().toLowerCase() }); save(state); },
      async removeCaptain(teamId, email) { state.captains = (state.captains || []).filter((c) => !(c.team_id === teamId && c.email === email)); save(state); },
      // ─── Feeling Gue Sih… (demo) ───
      async pickemGames(season) { return delay(Object.values(state.pkGames || {}).filter((g) => g.season === season)); },
      async myPicks(season) {
        if (!state.user) return {};
        return Object.fromEntries((state.pkPicks || []).filter((p) => p.user_id === state.user.id && p.game_id.startsWith(season + ':')).map((p) => [p.game_id, p]));
      },
      async savePick(gameId, winner, margin) {
        if (!state.user) throw new Error('Please sign in first.');
        const g = state.pkGames?.[gameId];
        if (!g || !g.home || !g.away || Date.now() >= +new Date(g.kickoff) || ![g.home, g.away].includes(winner)) throw new Error('This game has kicked off, so picks are locked.');
        state.pkPicks = state.pkPicks.filter((p) => !(p.game_id === gameId && p.user_id === state.user.id));
        state.pkPicks.push({ game_id: gameId, user_id: state.user.id, winner, margin: margin || null });
        save(state); await delay();
      },
      async clearPick(gameId) { state.pkPicks = (state.pkPicks || []).filter((p) => !(p.game_id === gameId && p.user_id === state.user?.id)); save(state); },
      // Demo users are admins, so they see every game's split.
      async pickemCrowd(season) {
        if (!state.user) return [];
        const mine = new Set((state.pkPicks || []).filter((p) => p.user_id === state.user.id).map((p) => p.game_id));
        const m = new Map();
        for (const p of state.pkPicks || []) if (p.game_id.startsWith(season + ':') && (mine.has(p.game_id) || state.user)) { const k = p.game_id + '|' + p.winner; m.set(k, (m.get(k) || 0) + 1); }
        return delay([...m].map(([k, picks]) => { const [game_id, winner] = k.split('|'); return { game_id, winner, picks }; }));
      },
      async pickemCounts(season) {
        const m = new Map();
        for (const p of state.pkPicks || []) if (p.game_id.startsWith(season + ':')) m.set(p.game_id, (m.get(p.game_id) || 0) + 1);
        return delay([...m].map(([game_id, picks]) => ({ game_id, picks })));
      },
      async pickemLeaderboard(season, round) {
        const t = new Map();
        for (const p of state.pkPicks || []) {
          const g = state.pkGames[p.game_id];
          if (!g || g.season !== season || (round && g.round_key !== round) || g.home_score == null || g.away_score == null) continue;
          const win = g.home_score > g.away_score ? g.home : g.away_score > g.home_score ? g.away : null;
          const ok = p.winner === win, m = ok && p.margin === JFF.pickemMargin(g.home_score, g.away_score);
          const r = t.get(p.user_id) || { points: 0, correct: 0, bonus: 0, picked: 0 };
          r.points += ok + m; r.correct += ok; r.bonus += m; r.picked++; t.set(p.user_id, r);
        }
        const rows = [...t].map(([u, r]) => ({ ...r, name: state.pkNames?.[u] || 'Fan', me: u === state.user?.id }))
          .sort((a, b) => b.points - a.points || b.correct - a.correct || a.name.localeCompare(b.name));
        rows.forEach((r, i) => { r.rank = i && r.points === rows[i - 1].points && r.correct === rows[i - 1].correct ? rows[i - 1].rank : i + 1; });
        return delay(rows);
      },
      async myPickemName() { return state.user ? state.pkNames?.[state.user.id] || null : null; },
      async setPickemName(name) { (state.pkNames ||= {})[state.user.id] = name.trim(); save(state); },
      async syncPickemGames(rows) {
        state.pkGames ||= {}; state.pkPicks ||= []; state.pkNames ||= {};
        const fresh = !Object.keys(state.pkGames).length;
        for (const r of rows) state.pkGames[r.id] = r;
        // Fake fans so the crowd bars and leaderboard have something to show.
        if (fresh) {
          const names = ['Raka', 'Dinda P.', 'Bimo', 'Sasa', 'Kevin T.', 'Ayu', 'Gilang', 'Nadia R.', 'Fajar', 'Putri', 'Dimas', 'Tasya', 'Rio', 'Mega', 'Yoga'];
          names.forEach((n, i) => {
            const u = 'fan-' + i; state.pkNames[u] = n;
            for (const r of rows) {
              if (!r.home || !r.away || Math.random() < 0.25) continue;
              const winner = Math.random() < 0.6 ? r.home : r.away;
              state.pkPicks.push({ game_id: r.id, user_id: u, winner, margin: ['tipis', 'aman', 'bantai', null][Math.floor(Math.random() * 4)] });
            }
          });
        }
        save(state); return rows.length;
      },
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
    // Nominations weeks: captains pick until starts_at; late picks are accepted until ends_at.
    nominatingOpen(w) { return !!w && w.nominations && !w.closed && Date.now() < +new Date(w.ends_at); },
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
    // Make the three photo sizes from a picked file. Never upscales.
    // keepFull: use the given file as the full-quality copy as it is (for converting older photos).
    async photoVersions(file, keepFull = false) {
      let src;
      try { src = await createImageBitmap(file); }
      catch {
        src = await new Promise((res, rej) => {
          const i = new Image(); i.onload = () => res(i);
          i.onerror = () => rej(new Error("Couldn't read this photo. Try a JPG or PNG (on iPhone, a screenshot of the photo works)."));
          i.src = URL.createObjectURL(file);
        });
      }
      const W = src.width, H = src.height;
      const enc = (r, q) => {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(W * r)); c.height = Math.max(1, Math.round(H * r));
        c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
        return new Promise((res) => c.toBlob(res, 'image/jpeg', q));
      };
      // Enough pixels to fill a w×h (4:5) crop.
      const fill = (w, h) => Math.min(1, Math.max(w / W, h / H));
      // One at a time, to keep memory low on phones.
      const sm = await enc(fill(600, 750), 0.8);
      const md = await enc(fill(1080, 1350), 0.84);
      const full = keepFull ? file : await enc(Math.min(1, 3000 / Math.max(W, H)), 0.9);
      src.close?.();
      return { sm, md, full };
    },
    // ─── Feeling Gue Sih… ───
    MARGINS: [
      { id: 'tipis', label: 'Tipis', range: '1–13' },
      { id: 'aman', label: 'Aman', range: '14–27' },
      { id: 'bantai', label: 'Bantai', range: '28+' },
    ],
    pickemMargin(h, a) { const d = Math.abs(h - a); return d <= 13 ? 'tipis' : d <= 27 ? 'aman' : 'bantai'; },
    async loadSeason() {
      const r = await fetch(`${cfg.SEASON_JSON_URL}?v=${Math.floor(Date.now() / 60000)}`);
      if (!r.ok) throw new Error('Could not load the schedule.');
      return r.json();
    },
    // season.json games → pickem_games rows.
    pickemRows(season, key = cfg.PICKEM_SEASON) {
      const now = new Date().toISOString();
      return season.games.filter((g) => g.id && g.date && g.time).map((g) => ({
        id: `${key}:${g.id}`, season: key,
        round_key: g.stage === 'playoff' ? 'playoffs' : 'w' + g.week,
        division: g.division,
        kickoff: new Date(`${g.date}T${g.time}:00+07:00`).toISOString(),
        home: g.home || null, away: g.away || null,
        home_score: g.home && g.away && g.homeScore != null ? g.homeScore : null,
        away_score: g.home && g.away && g.awayScore != null ? g.awayScore : null,
        updated_at: now,
      }));
    },
    toast(msg, kind = '') {
      let el = document.getElementById('toast');
      if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
      el.className = 'toast show ' + kind; el.textContent = msg;
      clearTimeout(el._t); el._t = setTimeout(() => (el.className = 'toast'), 3200);
    },
  };
})();
