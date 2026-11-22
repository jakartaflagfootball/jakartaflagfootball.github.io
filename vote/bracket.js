// JFF "Feeling Gue Sih…" Bracket Challenge — fill out the whole playoff bracket before Playoff Day.
(function () {
  const { api, teams, esc } = JFF;
  const cfg = window.JFF_CONFIG;
  const SEASON = cfg.PICKEM_SEASON;
  const DRAFT = 'jff-bracket-draft-' + SEASON;
  const $ = (id) => document.getElementById(id);
  const S = { user: null, name: null, admin: false, season: null, games: {}, picks: {}, div: 'men', lock: null, board: [], champs: [], count: 0, pending: false };
  const TZ = 'Asia/Jakarta';
  const fmt = (d, o) => new Date(d).toLocaleString('en-GB', { timeZone: TZ, ...o });
  const short = (g) => g.id.split(':')[1];
  const tName = (id) => teams[id]?.name || id;
  const locked = () => !S.lock || Date.now() >= +S.lock;
  const final = (g) => g.home_score != null && g.away_score != null && g.home && g.away;
  const winnerOf = (g) => (g.home_score > g.away_score ? g.home : g.away_score > g.home_score ? g.away : null);
  const bracketGames = () => Object.values(S.games).filter(JFF.inBracket).sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
  const teamsFor = (id, picks = S.picks) => JFF.bracketTeams(S.games, SEASON, picks, id);
  const saveDraft = () => { try { localStorage.setItem(DRAFT, JSON.stringify(S.picks)); } catch {} };
  const readDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT)) || {}; } catch { return {}; } };

  // ─── LOAD ───
  async function loadGames() {
    S.season = await JFF.loadSeason();
    const rows = JFF.pickemRows(S.season);
    if (api.demo) await api.syncPickemGames(rows);
    const db = Object.fromEntries((await api.pickemGames(SEASON).catch(() => [])).map((g) => [g.id, g]));
    // season.json describes the bracket; the database has the synced results.
    S.games = Object.fromEntries(rows.map((r) => [r.id, { ...r, ...(db[r.id] ? { home_score: db[r.id].home_score, away_score: db[r.id].away_score } : {}) }]));
    const ko = bracketGames().map((g) => +new Date(g.kickoff));
    S.lock = ko.length ? new Date(Math.min(...ko)) : null;
  }
  async function loadMine() {
    S.name = S.user ? await api.myPickemName().catch(() => null) : null;
    S.admin = S.user ? await api.isAdmin().catch(() => false) : false;
    const saved = S.user ? await api.myBracket(SEASON).catch(() => ({})) : {};
    const draft = readDraft();
    // A bracket filled in before signing in is kept and saved once signed in.
    S.picks = Object.keys(saved).length ? saved : draft;
    S.pending = !locked() && S.user && !Object.keys(saved).length && Object.keys(draft).length > 0;
    prune();
  }
  async function loadPublic() {
    const [board, count, champs] = await Promise.all([
      api.bracketLeaderboard(SEASON).catch(() => []),
      api.bracketCount(SEASON).catch(() => 0),
      api.bracketChampions(SEASON).catch(() => []),
    ]);
    S.board = board; S.count = count; S.champs = champs;
  }

  // Drop picks that no longer fit (a team you knocked out earlier can't play a later round).
  function prune() {
    for (const g of bracketGames()) {
      const id = short(g), p = S.picks[id];
      if (!p) continue;
      const [h, a] = teamsFor(id);
      if (p !== h && p !== a) delete S.picks[id];
    }
  }

  // ─── STRUCTURE: columns from the first round to the final ───
  function columns(div) {
    const gs = bracketGames().filter((g) => g.division === div);
    const fin = gs.find((g) => g.round === 'Final'), third = gs.find((g) => g.round === '3rd place');
    if (!fin) return { cols: [], fin: null, third: null };
    const feeders = (g) => [g.home_slot, g.away_slot].map((s) => /^W:(.+)$/.exec(s || '')?.[1]).filter(Boolean).map((id) => S.games[`${SEASON}:${id}`]).filter(Boolean);
    const cols = [[fin]];
    while (cols[0].flatMap(feeders).length) cols.unshift(cols[0].flatMap(feeders));
    return { cols, fin, third };
  }
  // Teams that can no longer play in game `forGame`: anyone who lost, except that semifinal
  // losers still play the 3rd place game.
  function eliminated(forGame) {
    const out = new Set();
    for (const g of bracketGames()) {
      if (!final(g) || !winnerOf(g) || g.division !== forGame.division) continue;
      if (forGame.round === '3rd place' && g.round !== 'Quarterfinal') continue;
      out.add(winnerOf(g) === g.home ? g.away : g.home);
    }
    return out;
  }
  const roundName = (g) => ({ Quarterfinal: 'Quarterfinals', Semifinal: 'Semifinals', Final: 'Final' }[g.round] || g.round);
  const seedTag = (slot) => { const m = /^(?:W)?#(\d)$/.exec(slot || ''); return m ? `<span class="br-seed">${m[1]}</span>` : ''; };

  function teamBtn(g, side, team) {
    const id = short(g), mine = team && S.picks[id] === team, isFirst = !/^[WL]:/.test(g[side + '_slot'] || '');
    if (!team) {
      const m = /^([WL]):(.+)$/.exec(g[side + '_slot'] || '');
      const label = m ? `${m[1] === 'W' ? 'Winner' : 'Loser'} of ${m[2].replace(/^[MW]/, '')}` : 'TBA';
      return `<div class="br-team empty"><span class="br-tbd">${esc(label)}</span></div>`;
    }
    let cls = mine ? 'mine' : '';
    if (final(g)) { if (winnerOf(g) === team) cls += ' won'; if (mine) cls += winnerOf(g) === team ? ' right' : ' wrong'; }
    // Busted: you picked a team that's already been knocked out.
    const busted = mine && !final(g) && eliminated(g).has(team);
    if (busted) cls += ' wrong busted';
    const score = final(g) && g.home === team ? g.home_score : final(g) && g.away === team ? g.away_score : null;
    return `<button type="button" class="br-team ${cls}" data-game="${esc(id)}" data-team="${esc(team)}" ${locked() ? 'disabled' : ''} aria-pressed="${!!mine}">
      ${isFirst ? seedTag(g[side + '_slot']) : ''}${JFF.logoHtml(teams[team] || { name: team }, 'team-logo br-logo')}
      <span class="br-name">${esc(tName(team))}</span>${score != null ? `<span class="br-score">${score}</span>` : ''}
      ${mine ? `<span class="br-check">${(final(g) && winnerOf(g) !== team) || busted ? '✗' : '✓'}</span>` : ''}</button>`;
  }

  function gameCard(g, extra = '') {
    const id = short(g), [h, a] = teamsFor(id);
    const pts = JFF.bracketPoints(g.round);
    const res = final(g) && S.picks[id] ? (S.picks[id] === winnerOf(g) ? `<span class="br-pts ok">+${pts}</span>` : '<span class="br-pts">0</span>') : `<span class="br-pts dim">${pts} pt${pts === 1 ? '' : 's'}</span>`;
    return `<div class="br-game ${extra}" id="br-${esc(id)}">
      <div class="br-meta"><span>${esc(id)} · ${fmt(g.kickoff, { hour: '2-digit', minute: '2-digit' })}</span>${res}</div>
      ${teamBtn(g, 'home', h)}${teamBtn(g, 'away', a)}</div>`;
  }

  function renderBracket() {
    const { cols, fin, third } = columns(S.div);
    if (!fin) { $('bracket').innerHTML = '<p class="lb-empty">The playoff bracket isn\'t set yet.</p>'; return; }
    const champ = S.picks[short(fin)];
    const champHtml = `<div class="br-champ ${champ ? 'set' : ''}"><small>${S.div === 'men' ? "Men's" : "Women's"} champion</small>
      ${champ ? `${JFF.logoHtml(teams[champ] || { name: champ }, 'team-logo br-champ-logo')}<b>${esc(tName(champ))}</b>` : '<b class="br-tbd">Pick the final</b>'}
      ${final(fin) ? `<span class="br-real">Actual: ${esc(tName(winnerOf(fin)))}</span>` : ''}</div>`;
    $('bracket').innerHTML = cols.map((col, i) => {
      const last = i === cols.length - 1;
      return `<div class="br-col ${last ? 'br-col-final' : ''}" data-n="${col.length}">
        <h3>${esc(roundName(col[0]))}</h3>
        <div class="br-games">${last ? champHtml : ''}${col.map((g) => gameCard(g)).join('')}
        ${last && third ? `<h3 class="br-sub">3rd place</h3>${gameCard(third, 'third')}` : ''}</div></div>`;
    }).join('');
    $('bracket').dataset.cols = cols.length;
    $('hint').textContent = cols.length > 1 ? 'On a phone, swipe sideways for the next round →' : '';
  }

  function renderStatus() {
    const all = bracketGames(), mine = all.filter((g) => S.picks[short(g)]).length;
    $('myPicks').textContent = `${mine}/${all.length}`;
    const me = S.board.find((r) => r.me);
    $('myPoints').textContent = me ? me.points : (S.user && mine ? 0 : '—');
    $('bracketCount').textContent = S.count;
    if (!S.lock) { $('lockIn').textContent = '—'; $('lockLabel').textContent = 'Not open yet'; }
    else if (locked()) { $('lockIn').textContent = 'Locked'; $('lockLabel').textContent = 'Playoffs under way'; }
    else {
      const ms = +S.lock - Date.now(), d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60;
      $('lockIn').textContent = d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
      $('lockLabel').textContent = `Locks ${fmt(S.lock, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
    }
    document.querySelectorAll('#divToggle button').forEach((b) => b.classList.toggle('active', b.dataset.div === S.div));
  }

  function renderAuth() {
    const u = S.user;
    $('authBar').innerHTML = u
      ? `<div class="auth-user">${u.avatar ? `<img src="${esc(u.avatar)}" alt="" referrerpolicy="no-referrer">` : `<span class="auth-avatar">${esc(JFF.initials(u.name))}</span>`}
           <p>Playing as <b>${esc(S.name || u.name)}</b><br><span style="font-size:.78rem">${locked() ? 'Brackets are locked.' : 'Your bracket saves as you pick.'} · <button class="btn-link" id="rename" type="button">change name</button></span></p></div>
         <button class="btn-link" id="signOut" type="button">Sign out</button>`
      : `<p><b>Sign in to save your bracket.</b> You can start picking first; it's kept until you sign in.</p><div class="signin-slot" id="authSignin"></div>`;
    if (!u) api.mountSignIn($('authSignin'));
  }

  function renderShare() {
    const champs = ['men', 'women'].map((d) => { const f = columns(d).fin; return f && S.picks[short(f)] ? [d, S.picks[short(f)], f] : null; }).filter(Boolean);
    $('shareBox').innerHTML = champs.length
      ? `<p>Your champions: ${champs.map(([d, t]) => `<b>${esc(tName(t))}</b> (${d === 'men' ? "Men's" : "Women's"})`).join(' and ')}. Tantang temen kamu!</p>
         <div class="pk-share-btns"><button class="btn-primary btn-sm" id="shareWa" type="button">Share on WhatsApp</button><button class="btn-secondary btn-sm" id="shareCopy" type="button">Copy</button></div>`
      : '';
  }
  function shareText() {
    const lines = ['men', 'women'].map((d) => {
      const { fin } = columns(d); if (!fin) return null;
      const w = S.picks[short(fin)]; if (!w) return null;
      const [h, a] = teamsFor(short(fin)), other = w === h ? a : h;
      return `🏆 ${d === 'men' ? "Men's" : "Women's"}: ${tName(w)} over ${tName(other)}`;
    }).filter(Boolean);
    return `Feeling gue sih… My ${S.season.name} playoff bracket:\n${lines.join('\n')}\n\nBerani beda? Fill yours: ${cfg.PUBLIC_URL}bracket.html`;
  }

  function renderChamps() {
    const finals = ['men', 'women'].map((d) => columns(d).fin).filter(Boolean);
    const mineSaved = S.user && !S.pending && Object.keys(S.picks).length;
    if (!S.champs.length) {
      $('champions').innerHTML = `<p class="lb-empty">${mineSaved || S.admin ? 'No champion picks yet.' : '🔒 Save your bracket to see which teams fans are backing.'}</p>`;
      $('champNote').textContent = '';
      return;
    }
    $('champNote').textContent = S.admin && !mineSaved ? 'Admin view' : '';
    $('champions').innerHTML = finals.map((f) => {
      const rows = S.champs.filter((r) => r.game_id === short(f)).sort((a, b) => b.picks - a.picks);
      const n = rows.reduce((t, r) => t + +r.picks, 0);
      return `<div class="br-champs"><h4>${f.division === 'men' ? "Men's" : "Women's"} champion</h4>${rows.length ? rows.map((r) => {
        const pc = Math.round((r.picks / n) * 100);
        return `<div class="lb-row pk-lb"><div class="lb-bar" style="width:${pc}%"></div>${JFF.logoHtml(teams[r.team] || { name: r.team })}
          <div style="min-width:0"><div class="lb-name">${esc(tName(r.team))}</div><div class="lb-meta">${r.picks} bracket${+r.picks === 1 ? '' : 's'}</div></div>
          <span class="lb-votes">${pc}<small>%</small></span></div>`;
      }).join('') : '<p class="lb-empty">No picks yet.</p>'}</div>`;
    }).join('');
  }

  function renderBoard() {
    const rows = S.board;
    if (!rows.length) { $('leaderboard').innerHTML = '<p class="lb-empty">Scores start on Playoff Day, after the first result.</p>'; return; }
    const top = rows.slice(0, 10), mine = rows.find((r) => r.me), show = mine && !top.includes(mine) ? [...top, mine] : top;
    const max = Math.max(1, rows[0].points);
    $('leaderboard').innerHTML = show.map((r) => `<div class="lb-row pk-lb ${r.me ? 'mine' : ''}">
      <div class="lb-bar" style="width:${(r.points / max) * 100}%"></div><span class="lb-rank">${r.rank}</span>
      <div style="min-width:0"><div class="lb-name">${esc(r.name)}${r.me ? ' (you)' : ''}</div><div class="lb-meta">${r.correct}/${r.decided} right</div></div>
      <span class="lb-votes">${r.points}<small>pts</small></span></div>`).join('');
  }

  function renderAll() { renderAuth(); renderStatus(); renderBracket(); renderShare(); renderChamps(); renderBoard(); }

  // ─── SAVING ───
  let timer = null, saving = false;
  const setState = (t, cls = '') => { $('saveState').textContent = t; $('saveState').className = 'br-status ' + cls; };
  function scheduleSave() {
    saveDraft();
    if (!S.user) { setState('Not saved yet · sign in to save', 'warn'); return; }
    if (!S.name) { askName(); setState('Not saved yet', 'warn'); return; }
    setState('Saving…');
    clearTimeout(timer); timer = setTimeout(saveNow, 700);
  }
  async function saveNow() {
    if (saving) { timer = setTimeout(saveNow, 400); return; }
    saving = true;
    try {
      await api.saveBracket(SEASON, { ...S.picks });
      S.pending = false; setState('Saved ✓', 'ok');
      try { localStorage.removeItem(DRAFT); } catch {}
      await loadPublic(); renderStatus(); renderChamps(); renderBoard();
    } catch (e) { console.error(e); setState('Not saved', 'warn'); JFF.toast(e.message || 'Bracket not saved. Try again.', 'error'); }
    finally { saving = false; }
  }

  function pick(id, team) {
    if (locked()) return JFF.toast('Brackets are locked: the playoffs have started.');
    if (S.picks[id] === team) return;
    S.picks[id] = team;
    prune();
    renderStatus(); renderBracket(); renderShare();
    if (!S.user) { saveDraft(); setState('Not saved yet · sign in to save', 'warn'); $('signinModal').classList.add('show'); api.mountSignIn($('modalSignin')); return; }
    scheduleSave();
  }

  // ─── NAME ───
  function askName() {
    const f = $('nameForm');
    f.name.value = S.name || defaultName(S.user?.name);
    $('nameModal').classList.add('show');
    setTimeout(() => f.name.select(), 50);
  }
  function defaultName(full) {
    if (!full || full.includes('@')) return '';
    const w = full.trim().split(/\s+/);
    return (w.length > 1 ? `${w[0]} ${w[w.length - 1][0]}.` : w[0]).slice(0, 24);
  }
  $('nameForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = e.target.name.value.trim().replace(/\s+/g, ' ');
    if (name.length < 2) return JFF.toast('At least 2 characters', 'error');
    try { await api.setPickemName(name); S.name = name; $('nameModal').classList.remove('show'); renderAuth(); }
    catch (err) { return JFF.toast(err.message, 'error'); }
    if (Object.keys(S.picks).length && !locked()) scheduleSave();
  });

  // ─── EVENTS ───
  document.addEventListener('click', async (e) => {
    const t = e.target.closest('button, .modal-back'); if (!t) return;
    if (t.classList.contains('modal-back') && e.target === t) return t.classList.remove('show');
    const d = t.dataset;
    if (t.hasAttribute('data-close')) t.closest('.modal-back').classList.remove('show');
    else if (d.game && d.team) pick(d.game, d.team);
    else if (d.div) { S.div = d.div; renderStatus(); renderBracket(); $('bracket').parentElement.scrollLeft = 0; }
    else if (t.id === 'rename') askName();
    else if (t.id === 'signOut') api.signOut();
    else if (t.hasAttribute('data-signin')) api.signIn();
    else if (t.id === 'shareWa') window.open('https://wa.me/?text=' + encodeURIComponent(shareText()), '_blank', 'noopener');
    else if (t.id === 'shareCopy') { try { await navigator.clipboard.writeText(shareText()); JFF.toast('Copied'); } catch { prompt('Copy this:', shareText()); } }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.modal-back.show').forEach((m) => m.classList.remove('show')); });

  let current;
  async function onUser(user) {
    if ((user?.id || null) === current) return;
    current = user?.id || null; S.user = user;
    if (user) $('signinModal').classList.remove('show');
    await loadMine(); await loadPublic(); renderAll();
    if (S.pending) scheduleSave();
    else setState(user && Object.keys(S.picks).length ? 'Saved ✓' : '', 'ok');
  }

  (async function start() {
    $('demoBanner').innerHTML = api.demo ? '<div class="demo-banner"><span>⚠ <b>Demo mode.</b> Brackets stay in this browser; other fans are made up.</span></div>' : '';
    if (location.hash === '#women') S.div = 'women';
    try { await loadGames(); }
    catch (e) { console.error(e); $('bracket').innerHTML = '<p class="lb-empty">Could not load the bracket. Refresh to try again.</p>'; return; }
    S.user = await api.getUser(); current = S.user?.id || null;
    await loadMine(); await loadPublic();
    renderAll();
    if (S.pending) scheduleSave();
    else if (S.user && Object.keys(S.picks).length) setState('Saved ✓', 'ok');
    api.onAuthChange(onUser);
    if (!S.user) api.oneTap();
    setInterval(() => { const was = locked(); renderStatus(); if (locked() !== was) renderAll(); }, 30000);
    setInterval(async () => { if (document.hidden) return; await loadPublic(); renderStatus(); renderChamps(); renderBoard(); }, 120000);
  })();
})();
