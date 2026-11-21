// JFF "Feeling Gue Sih…" — pick the winner of every game (pick'em).
(function () {
  const { api, teams, esc, MARGINS } = JFF;
  const cfg = window.JFF_CONFIG;
  const SEASON = cfg.PICKEM_SEASON;
  const $ = (id) => document.getElementById(id);
  const S = {
    user: null, name: null, season: null, games: [], db: {}, picks: {}, crowd: {}, counts: {}, admin: false,
    round: null, lb: 'season', board: [], seasonBoard: [], pending: null,
  };
  const TZ = 'Asia/Jakarta';
  const fmt = (d, o) => new Date(d).toLocaleString('en-GB', { timeZone: TZ, ...o });
  const roundLabel = (rk) => (rk === 'playoffs' ? 'Playoffs' : 'Week ' + rk.slice(1));
  const teamName = (id) => teams[id]?.name || id;

  // ─── STATE OF A GAME ───
  const kickoff = (g) => +new Date(g.kickoff);
  const hasTeams = (g) => !!(g.home && g.away);
  const final = (g) => g.home_score != null && g.away_score != null;
  const locked = (g) => Date.now() >= kickoff(g);
  const winnerOf = (g) => (g.home_score > g.away_score ? g.home : g.away_score > g.home_score ? g.away : null);
  const canPick = (g) => S.db[g.id] && hasTeams(g) && !locked(g);
  function result(g) {
    const p = S.picks[g.id];
    if (!p || !final(g)) return null;
    const ok = p.winner === winnerOf(g), m = ok && p.margin === JFF.pickemMargin(g.home_score, g.away_score);
    return { ok, m, pts: ok + m };
  }

  // ─── LOAD ───
  async function loadGames() {
    S.season = await JFF.loadSeason();
    $('seasonLabel').textContent = S.season.name || cfg.SEASON;
    let rows = JFF.pickemRows(S.season);
    if (api.demo) await api.syncPickemGames(rows);
    const db = await api.pickemGames(SEASON).catch((e) => { console.error(e); return []; });
    S.db = Object.fromEntries(db.map((g) => [g.id, g]));
    // season.json gives names, fields and pools; the database decides locking and scoring.
    const extra = Object.fromEntries(S.season.games.map((g) => [`${SEASON}:${g.id}`, g]));
    S.games = rows.map((r) => ({ ...r, ...(S.db[r.id] || {}), src: extra[r.id] })).sort((a, b) => kickoff(a) - kickoff(b) || (a.src?.field || '').localeCompare(b.src?.field || ''));
    if (!S.round) {
      const next = S.games.find((g) => hasTeams(g) && !locked(g)) || S.games.filter(hasTeams).pop() || S.games[0];
      S.round = next?.round_key || 'w1';
    }
  }
  async function loadMine() {
    S.picks = S.user ? await api.myPicks(SEASON).catch(() => ({})) : {};
    S.name = S.user ? await api.myPickemName().catch(() => null) : null;
    S.admin = S.user ? await api.isAdmin().catch(() => false) : false;
  }
  // The split is only sent for games this fan has picked; everyone sees the total.
  async function loadCrowd() {
    const [split, counts] = await Promise.all([api.pickemCrowd(SEASON).catch(() => []), api.pickemCounts(SEASON).catch(() => [])]);
    S.crowd = {}; S.counts = Object.fromEntries(counts.map((r) => [r.game_id, +r.picks]));
    for (const r of split) (S.crowd[r.game_id] ||= {})[r.winner] = +r.picks;
  }
  async function loadBoards() {
    const [round, season] = await Promise.all([
      api.pickemLeaderboard(SEASON, S.round).catch(() => []),
      api.pickemLeaderboard(SEASON, null).catch(() => []),
    ]);
    S.board = round; S.seasonBoard = season;
  }

  // ─── RENDER ───
  function renderAuth() {
    const u = S.user;
    $('authBar').innerHTML = u
      ? `<div class="auth-user">${u.avatar ? `<img src="${esc(u.avatar)}" alt="" referrerpolicy="no-referrer">` : `<span class="auth-avatar">${esc(JFF.initials(u.name))}</span>`}
           <p>Playing as <b>${esc(S.name || u.name)}</b><br><span style="font-size:.78rem">${openStatus()} · <button class="btn-link" id="rename" type="button">change name</button></span></p></div>
         <button class="btn-link" id="signOut" type="button">Sign out</button>`
      : `<p><b>Sign in to play.</b> Pick winners, call the margin, climb the leaderboard.</p><div class="signin-slot" id="authSignin"></div>`;
    if (!u) api.mountSignIn($('authSignin'));
  }
  function openStatus() {
    const open = S.games.filter(canPick), left = open.filter((g) => !S.picks[g.id]).length;
    return !open.length ? `${Object.keys(S.picks).length} picks this season` : left ? `${left} open game${left === 1 ? '' : 's'} still to pick` : 'All open games picked ✓';
  }

  function renderRounds() {
    const keys = [...new Set(S.games.map((g) => g.round_key))];
    $('rounds').innerHTML = keys.map((k) => {
      const gs = S.games.filter((g) => g.round_key === k), open = gs.filter(canPick);
      const mine = gs.filter((g) => S.picks[g.id]).length, pts = gs.reduce((n, g) => n + (result(g)?.pts || 0), 0);
      const state = gs.every(final) ? (S.user ? `${pts} pt${pts === 1 ? '' : 's'}` : 'Final')
        : open.length ? (S.user ? `${mine}/${gs.filter(hasTeams).length} picked` : `${open.length} open`)
        : !gs.some(hasTeams) ? 'Teams TBA' : 'Locked';
      const todo = S.user && open.some((g) => !S.picks[g.id]);
      return `<button class="pk-round ${k === S.round ? 'active' : ''} ${todo ? 'todo' : ''}" data-round="${k}" role="tab" type="button">
        <span class="cat-tab-name">${roundLabel(k)}</span><span class="cat-tab-state">${state}</span></button>`;
    }).join('');
  }

  function crowdBar(g) {
    const total = S.counts[g.id] || 0, fans = `${total} fan${total === 1 ? '' : 's'}`;
    // Admins see every split (once supabase/pickem.sql is updated); otherwise pick first.
    const adminSees = S.admin && Object.keys(S.crowd[g.id] || {}).length;
    if (!S.picks[g.id] && !adminSees) {
      if (locked(g)) return `<div class="pk-crowd empty"><span>🔒 ${total ? `${fans} picked. Only fans who picked this game see the split.` : 'No picks for this game.'}</span></div>`;
      return `<div class="pk-crowd empty locked"><span>🔒 ${total ? `${fans} picked already. ` : ''}Pick a winner to see how fans are picking.</span></div>`;
    }
    const c = S.crowd[g.id] || {}, h = c[g.home] || 0, a = c[g.away] || 0, n = h + a;
    if (!n) return `<div class="pk-crowd empty"><span>${total ? 'Loading the split…' : 'No picks yet.'}</span></div>`;
    const hp = Math.round((h / n) * 100);
    const tag = S.admin && !S.picks[g.id] ? ' · admin view' : '';
    return `<div class="pk-crowd"><div class="pk-crowd-bar"><i style="width:${hp}%"></i></div>
      <span>${hp}%</span><small>${n} fan${n === 1 ? '' : 's'} picked${tag}</small><span>${100 - hp}%</span></div>`;
  }

  function teamBtn(g, side) {
    const id = g[side], p = S.picks[g.id], src = g.src || {};
    if (!id) return `<div class="pk-team tba"><span class="team-logo team-logo-fallback">?</span><b>${esc(src[side + 'Slot'] || 'TBA')}</b></div>`;
    const t = teams[id] || { name: id }, mine = p?.winner === id;
    const score = final(g) ? `<span class="pk-score">${g[side + '_score']}</span>` : '';
    let cls = mine ? 'mine' : '';
    if (final(g) && mine) cls += winnerOf(g) === id ? ' right' : ' wrong';
    if (final(g) && winnerOf(g) === id) cls += ' won';
    return `<button class="pk-team ${cls}" type="button" data-pick="${esc(g.id)}" data-team="${esc(id)}" ${canPick(g) || (!S.db[g.id] && hasTeams(g) && !locked(g)) ? '' : 'disabled'} aria-pressed="${mine}">
      ${JFF.logoHtml(t)}<b>${esc(t.name)}</b>${score}${mine ? `<span class="pk-tick">${final(g) && winnerOf(g) !== id ? '✗' : '✓'}</span>` : ''}</button>`;
  }

  function gameCard(g) {
    const src = g.src || {}, p = S.picks[g.id], r = result(g);
    const where = [src.division === 'women' ? "Women's" : "Men's", src.pool ? 'Pool ' + src.pool : src.round, src.field].filter(Boolean).join(' · ');
    let state;
    if (final(g)) state = `<span class="pk-state final">Final</span>`;
    else if (!hasTeams(g)) state = `<span class="pk-state">Teams TBA</span>`;
    else if (locked(g)) state = `<span class="pk-state">🔒 Locked</span>`;
    else if (!S.db[g.id]) state = `<span class="pk-state">Opens soon</span>`;
    else state = `<span class="pk-state open">${p ? 'Picked · change until kickoff' : 'Open'}</span>`;
    const margin = hasTeams(g) && p && (canPick(g) || p.margin)
      ? `<div class="pk-margin"><span>${canPick(g) ? 'Menang berapa? <small>+1 bonus</small>' : 'Your margin'}</span><div>${MARGINS.map((m) =>
          `<button type="button" class="${p.margin === m.id ? 'on' : ''}" data-margin="${m.id}" data-game="${esc(g.id)}" ${canPick(g) ? '' : 'disabled'}><b>${m.label}</b><small>${m.range}</small></button>`).join('')}</div></div>`
      : '';
    const res = r ? `<div class="pk-result ${r.ok ? 'ok' : 'no'}">${r.pts === 2 ? '🎯 +2 · winner and margin' : r.ok ? '✓ +1 · right winner' : '✗ 0 · not this time'}</div>`
      : final(g) && S.user && !p ? `<div class="pk-result no">No pick</div>` : '';
    return `<article class="pk-game ${r ? (r.ok ? 'is-right' : 'is-wrong') : ''}" id="g-${esc(g.id.split(':')[1])}">
      <div class="pk-meta"><span>${esc(where)}</span>${state}</div>
      <div class="pk-teams">${teamBtn(g, 'home')}<span class="pk-vs">vs</span>${teamBtn(g, 'away')}</div>
      ${hasTeams(g) ? crowdBar(g) : ''}${margin}${res}
    </article>`;
  }

  function renderGames() {
    const gs = S.games.filter((g) => g.round_key === S.round);
    $('roundTitle').textContent = roundLabel(S.round);
    $('roundSub').textContent = gs.length ? fmt(gs[0].kickoff, { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + (S.season.venue || '') : '';
    if (!gs.length) { $('games').innerHTML = '<p class="lb-empty">No games in this round.</p>'; return; }
    const slots = new Map();
    for (const g of gs) { const k = fmt(g.kickoff, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); if (!slots.has(k)) slots.set(k, []); slots.get(k).push(g); }
    $('games').innerHTML = [...slots].map(([k, list]) => `<div class="pk-slot"><h3>${esc(k.split(', ').pop())} <small>WIB</small></h3><div class="pk-list">${list.map(gameCard).join('')}</div></div>`).join('');
    renderShare(gs);
  }

  function renderShare(gs) {
    const mine = gs.filter((g) => S.picks[g.id]);
    $('shareBox').innerHTML = mine.length
      ? `<p><b>${mine.length} pick${mine.length === 1 ? '' : 's'}</b> for ${roundLabel(S.round)}. Tantang temen kamu!</p>
         <div class="pk-share-btns"><button class="btn-primary btn-sm" id="shareWa" type="button">Share on WhatsApp</button><button class="btn-secondary btn-sm" id="shareCopy" type="button">Copy</button></div>`
      : '';
  }
  function shareText() {
    const gs = S.games.filter((g) => g.round_key === S.round && S.picks[g.id]);
    const lines = gs.map((g) => {
      const p = S.picks[g.id], other = p.winner === g.home ? g.away : g.home;
      const m = MARGINS.find((x) => x.id === p.margin);
      return `• ${teamName(p.winner)} over ${teamName(other)}${m ? ` (${m.label})` : ''}`;
    });
    return `Feeling gue sih… 🏈 My ${S.season.name} ${roundLabel(S.round)} picks:\n${lines.join('\n')}\n\nBerani beda? Pick yours: ${cfg.PUBLIC_URL}feeling.html`;
  }

  function renderBoard() {
    const rows = S.lb === 'round' ? S.board : S.seasonBoard;
    document.querySelectorAll('#lbToggle button').forEach((b) => b.classList.toggle('active', b.dataset.lb === S.lb));
    const me = S.seasonBoard.find((r) => r.me);
    $('myPoints').textContent = S.user ? (me ? me.points : 0) : '—';
    $('myRank').textContent = me ? '#' + me.rank : '—';
    if (!rows.length) { $('leaderboard').innerHTML = `<p class="lb-empty">No scores yet. Points appear after the first final score${S.lb === 'round' ? ' of ' + roundLabel(S.round) : ''}.</p>`; return; }
    const top = rows.slice(0, 10), mine = rows.find((r) => r.me);
    const show = mine && !top.includes(mine) ? [...top, mine] : top;
    const max = Math.max(1, rows[0].points);
    $('leaderboard').innerHTML = show.map((r) => `<div class="lb-row pk-lb ${r.me ? 'mine' : ''}">
      <div class="lb-bar" style="width:${(r.points / max) * 100}%"></div>
      <span class="lb-rank">${r.rank}</span>
      <div style="min-width:0"><div class="lb-name">${esc(r.name)}${r.me ? ' (you)' : ''}</div><div class="lb-meta">${r.correct}/${r.picked} right · ${r.bonus} bonus</div></div>
      <span class="lb-votes">${r.points}<small>pts</small></span></div>`).join('');
  }

  function tick() {
    const next = S.games.find((g) => hasTeams(g) && !locked(g) && S.db[g.id]);
    if (!next) { $('nextLock').textContent = '—'; $('nextLockLabel').textContent = 'No open games'; return; }
    const ms = kickoff(next) - Date.now(), d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60;
    $('nextLock').textContent = d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m ${Math.floor(ms / 1000) % 60}s`;
    $('nextLockLabel').textContent = 'Next game locks in';
    if (ms <= 0) renderAll();
  }

  function renderAll() { renderAuth(); renderRounds(); renderGames(); renderBoard(); }

  // ─── ACTIONS ───
  const modal = (id, show) => $(id).classList.toggle('show', show);

  async function pick(gameId, team, margin) {
    if (!S.user) { S.pending = { gameId, team }; modal('signinModal', true); api.mountSignIn($('modalSignin')); return; }
    if (!S.name) { S.pending = { gameId, team, margin }; return askName(); }
    const prev = S.picks[gameId];
    if (margin === undefined) margin = prev?.winner === team ? prev.margin : null;
    S.picks[gameId] = { game_id: gameId, winner: team, margin };
    renderAll();
    try {
      await api.savePick(gameId, team, margin);
      // Picking unlocks this game's split; changing a pick moves it.
      if (prev?.winner !== team) { await loadCrowd(); renderGames(); }
    }
    catch (e) {
      console.error(e); JFF.toast(e.message || 'Pick not saved. Try again.', 'error');
      if (prev) S.picks[gameId] = prev; else delete S.picks[gameId];
      await Promise.all([loadGames(), loadCrowd()]); renderAll();
    }
  }

  function askName() {
    const f = $('nameForm');
    f.name.value = S.name || defaultName(S.user.name);
    modal('nameModal', true);
    setTimeout(() => f.name.select(), 50);
  }
  // "Raka Firmansyah" → "Raka F."
  function defaultName(full) {
    if (!full || full.includes('@')) return '';
    const w = full.trim().split(/\s+/);
    return (w.length > 1 ? `${w[0]} ${w[w.length - 1][0]}.` : w[0]).slice(0, 24);
  }

  $('nameForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = e.target.name.value.trim().replace(/\s+/g, ' ');
    if (name.length < 2) return JFF.toast('At least 2 characters', 'error');
    try { await api.setPickemName(name); S.name = name; modal('nameModal', false); JFF.toast('Saved'); }
    catch (err) { return JFF.toast(err.message, 'error'); }
    const p = S.pending; S.pending = null;
    if (p) await pick(p.gameId, p.team, p.margin);
    loadBoards().then(renderBoard);
    renderAuth();
  });

  document.addEventListener('click', async (e) => {
    const t = e.target.closest('button, .modal-back'); if (!t) return;
    if (t.classList.contains('modal-back') && e.target === t) return t.classList.remove('show');
    const d = t.dataset;
    if (t.hasAttribute('data-close')) t.closest('.modal-back').classList.remove('show');
    else if (d.pick) {
      const g = S.games.find((x) => x.id === d.pick);
      if (!S.db[g.id]) return JFF.toast('Picks for this game open soon.');
      if (S.picks[g.id]?.winner !== d.team) pick(g.id, d.team);
    }
    else if (d.margin) {
      const p = S.picks[d.game]; if (!p) return;
      pick(d.game, p.winner, p.margin === d.margin ? null : d.margin);
    }
    else if (d.round) { S.round = d.round; renderRounds(); renderGames(); await loadBoards(); renderBoard(); }
    else if (d.lb) { S.lb = d.lb; renderBoard(); }
    else if (t.id === 'rename') askName();
    else if (t.id === 'signOut') api.signOut();
    else if (t.hasAttribute('data-signin')) api.signIn();
    else if (t.id === 'shareWa') window.open('https://wa.me/?text=' + encodeURIComponent(shareText()), '_blank', 'noopener');
    else if (t.id === 'shareCopy') { try { await navigator.clipboard.writeText(shareText()); JFF.toast('Copied'); } catch { prompt('Copy this:', shareText()); } }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.modal-back.show').forEach((m) => m.classList.remove('show')); });

  // Links like feeling.html#g-w3-20 (from the Open SZN IV games list) open that game.
  function focusFromHash() {
    const id = decodeURIComponent(location.hash.replace(/^#g-/, ''));
    const g = id && S.games.find((x) => x.id === `${SEASON}:${id}`);
    if (!g) return;
    if (S.round !== g.round_key) { S.round = g.round_key; renderRounds(); renderGames(); loadBoards().then(renderBoard); }
    const el = document.getElementById('g-' + id); if (!el) return;
    el.scrollIntoView({ block: 'center' });
    el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 2200);
  }
  window.addEventListener('hashchange', focusFromHash);

  // ─── START ───
  let current;
  async function onUser(user) {
    if ((user?.id || null) === current) return;
    current = user?.id || null; S.user = user;
    if (user) modal('signinModal', false);
    await loadMine(); await Promise.all([loadBoards(), loadCrowd()]); renderAll();
    if (user && S.pending) { const p = S.pending; S.pending = null; pick(p.gameId, p.team); }
  }

  (async function start() {
    $('demoBanner').innerHTML = api.demo ? '<div class="demo-banner"><span>⚠ <b>Demo mode.</b> Picks stay in this browser; other fans are made up.</span></div>' : '';
    try { await loadGames(); }
    catch (e) { console.error(e); $('games').innerHTML = '<p class="lb-empty">Could not load the schedule. Refresh to try again.</p>'; return; }
    S.user = await api.getUser(); current = S.user?.id || null;
    await Promise.all([loadMine(), loadCrowd(), loadBoards()]);
    renderAll(); tick();
    focusFromHash();
    setInterval(tick, 1000);
    api.onAuthChange(onUser);
    if (!S.user) api.oneTap();
    // Crowd and leaderboard refresh every minute while the page is visible.
    setInterval(async () => { if (document.hidden) return; await Promise.all([loadCrowd(), loadBoards()]); renderGames(); renderBoard(); }, 60000);
  })();
})();
