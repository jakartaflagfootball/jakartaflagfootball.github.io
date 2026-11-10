// JFF Player of the Week — voting page
(function () {
  const { api, CATEGORIES, CATEGORY_LABEL, teams, players, esc } = JFF;
  const cfg = window.JFF_CONFIG;
  const $ = (id) => document.getElementById(id);
  const SHARE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>';

  const params = new URLSearchParams(location.search);
  const S = {
    user: null, weeks: [], week: null, myVotes: {}, board: [], voters: 0, noms: null,
    cat: CATEGORIES.includes(params.get('c')) ? params.get('c') : 'men_offense',
    invite: players[params.get('p')] || null,
    search: '', team: '', showAll: false, pending: null,
  };
  if (S.invite && S.cat.split('_')[0] !== S.invite.division) S.cat = S.invite.division + '_offense';

  // ─── RENDER ───────────────────────────────────────────
  const division = () => S.cat.split('_')[0];
  const open = () => JFF.isOpen(S.week);
  const playerLine = (p) => [p.position || 'Position TBA', teams[p.team].name].join(' · ');

  function playerChip(p) {
    return `${JFF.logoHtml(teams[p.team])}<div class="pc-num">${esc(p.number)}</div>
      <div class="modal-player-info"><b>${esc(p.nickname || p.full_name)}</b><span>${esc(p.full_name)}</span><span>${esc(playerLine(p))}</span></div>`;
  }

  function renderAuth() {
    $('authBar').innerHTML = S.user
      ? `<div class="auth-user">${S.user.avatar ? `<img src="${esc(S.user.avatar)}" alt="" referrerpolicy="no-referrer">` : `<span class="auth-avatar">${esc(JFF.initials(S.user.name))}</span>`}
           <p>Signed in as <b>${esc(S.user.name)}</b><br><span style="font-size:.78rem">${votedCount()} of 4 categories voted${S.week ? ' for ' + esc(S.week.label) : ''}</span></p></div>
         <button class="btn-link" id="signOut">Sign out</button>`
      : `<p><b>Sign in to vote.</b> One vote per person per category, and your vote stays anonymous.</p>
         <div class="signin-slot" id="authSignin"></div>`;
    $('signOut')?.addEventListener('click', () => api.signOut());
    if (!S.user) api.mountSignIn($('authSignin'));
  }
  const votedCount = () => CATEGORIES.filter((c) => S.myVotes[c]).length;

  function renderTabs() {
    $('catTabs').innerHTML = CATEGORIES.map((c) => {
      const [div, side] = CATEGORY_LABEL[c].split(' ');
      const mine = players[S.myVotes[c]];
      const state = mine ? `✓ ${esc(mine.nickname || mine.full_name)}` : S.user && open() ? 'Not voted yet' : '';
      return `<button class="cat-tab ${c === S.cat ? 'active' : ''}" role="tab" aria-selected="${c === S.cat}" data-cat="${c}">
        <span class="cat-tab-div">${esc(div)}</span><span class="cat-tab-name">${esc(side)}</span>
        <span class="cat-tab-state ${mine ? 'done' : ''}">${state || '&nbsp;'}</span></button>`;
    }).join('');
  }

  function renderWeek() {
    $('weekSelect').innerHTML = S.weeks.map((w) => `<option value="${w.id}" ${w === S.week ? 'selected' : ''}>${esc(w.label)}</option>`).join('')
      || '<option>No voting rounds yet</option>';
    const st = $('weekStatus');
    if (!S.week) { st.className = 'status-pill'; st.textContent = 'Not started'; }
    else if (open()) { st.className = 'status-pill open'; st.textContent = 'Voting open'; }
    else if (!S.week.closed && Date.now() < +new Date(S.week.starts_at)) { st.className = 'status-pill'; st.textContent = (S.week.nominations ? 'Captains nominating · voting opens ' : 'Opens ') + JFF.fmtDate(S.week.starts_at); }
    else { st.className = 'status-pill'; st.textContent = 'Voting closed'; }
    $('voterCount').textContent = S.voters.toLocaleString('en-US');
    tick();
  }

  function tick() {
    const w = S.week;
    if (!w) { $('countdown').textContent = '—'; return; }
    const now = Date.now(), start = +new Date(w.starts_at), end = +new Date(w.ends_at);
    let target, label;
    if (w.closed || now > end) { $('countdown').textContent = 'Final'; $('countdownLabel').textContent = 'Results'; return; }
    if (now < start) { target = start; label = 'Voting opens in'; } else { target = end; label = 'Voting closes in'; }
    let s = Math.max(0, Math.floor((target - now) / 1000));
    const d = Math.floor(s / 86400); s %= 86400;
    const h = Math.floor(s / 3600); s %= 3600;
    const m = Math.floor(s / 60); s %= 60;
    $('countdown').textContent = d ? `${d}d ${h}h ${m}m` : `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
    $('countdownLabel').textContent = label;
  }

  function renderBoard() {
    const rows = S.board.filter((r) => r.category === S.cat && players[r.player_id]);
    const max = rows[0]?.votes || 1;
    const shown = S.showAll ? rows : rows.slice(0, 10);
    $('lbCat').textContent = CATEGORY_LABEL[S.cat];
    let rank = 0, prev = null;
    $('leaderboard').innerHTML = rows.length ? shown.map((r, i) => {
      if (r.votes !== prev) { rank = i + 1; prev = r.votes; }
      const p = players[r.player_id];
      return `<div class="lb-row ${S.myVotes[S.cat] === p.id ? 'mine' : ''}">
        <span class="lb-bar" style="width:${Math.round((r.votes / max) * 100)}%"></span>
        <span class="lb-rank">${rank}</span>${JFF.logoHtml(teams[p.team])}
        <div style="min-width:0"><div class="lb-name">${esc(p.nickname || p.full_name)} <span style="color:var(--muted);font-weight:400">#${esc(p.number)}</span></div>
        <div class="lb-meta">${esc(playerLine(p))}</div></div>
        <span class="lb-votes">${r.votes}<small>${r.votes === 1 ? 'vote' : 'votes'}</small></span></div>`;
    }).join('') + (rows.length > 10 ? `<button class="btn-link lb-more" id="lbMore">${S.showAll ? 'Show top 10' : `Show all ${rows.length}`}</button>` : '')
      : `<p class="lb-empty">No votes yet in ${esc(CATEGORY_LABEL[S.cat])}. Be the first.</p>`;
    $('lbMore')?.addEventListener('click', () => { S.showAll = !S.showAll; renderBoard(); });
    $('lbUpdated').textContent = S.board.length || rows.length ? 'Updated ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
  }

  function renderTeamFilter() {
    const list = window.JFF_TEAMS.filter((t) => t.division === division());
    if (S.team && !list.some((t) => t.id === S.team)) S.team = '';
    $('teamFilter').innerHTML = `<option value="">All ${division() === 'men' ? "men's" : "women's"} teams</option>`
      + list.map((t) => `<option value="${t.id}" ${t.id === S.team ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
  }

  function renderPlayers() {
    const q = S.search.trim().toLowerCase();
    const mine = S.myVotes[S.cat];
    const list = window.JFF_PLAYERS.filter((p) => p.division === division() && (!S.team || p.team === S.team)
      && (!S.noms || S.noms.has(p.id))
      && (!q || [p.full_name, p.nickname, p.number, teams[p.team].name, p.position].join(' ').toLowerCase().includes(q)));
    $('gridTitle').textContent = CATEGORY_LABEL[S.cat];
    $('gridCount').textContent = `${list.length} ${S.noms ? (list.length === 1 ? 'nominee' : 'nominees') : 'players'}`;
    const byTeam = new Map();
    for (const p of list) { if (!byTeam.has(p.team)) byTeam.set(p.team, []); byTeam.get(p.team).push(p); }
    // Within each team: by jersey number (0, 00, 1, 2 … 99); players without a number go last.
    const num = (p) => (p.number === '' || p.number == null ? Infinity : Number(p.number));
    for (const ps of byTeam.values()) ps.sort((a, b) => num(a) - num(b) || String(a.number).length - String(b.number).length);
    const card = (p) => {
      const isMine = mine === p.id;
      const btn = isMine ? '<button class="pc-vote is-mine" disabled>✓ Your vote</button>'
        : mine ? '<button class="pc-vote" disabled>Voted</button>'
        : !open() ? `<button class="pc-vote" disabled>${notStarted() ? 'Opens soon' : 'Closed'}</button>`
        : `<button class="pc-vote" data-vote="${p.id}">Vote</button>`;
      return `<article class="player-card ${isMine ? 'voted' : mine ? 'dim' : ''} ${S.invite?.id === p.id ? 'highlight' : ''}" id="pc-${p.id}">
        <div class="pc-top"><span class="pc-num">${esc(p.number)}</span><span class="pc-pos ${p.position ? '' : 'empty'}">${esc(p.position || 'Pos TBA')}</span></div>
        <div><div class="pc-nick">${esc(p.nickname || p.full_name)}</div><div class="pc-full">${esc(p.full_name)}</div></div>
        <div class="pc-actions">${btn}<button class="pc-share" data-share="${p.id}" title="Share ${esc(p.nickname)}'s vote link" aria-label="Share">${SHARE_ICON}</button></div>
      </article>`;
    };
    // Nominations week: say which teams' captains haven't picked yet.
    let waiting = '';
    if (S.noms && !q && S.week && !S.week.closed && Date.now() < +new Date(S.week.ends_at)) {
      const nominated = new Set([...S.noms].map((id) => players[id]?.team));
      const missing = window.JFF_TEAMS.filter((t) => t.division === division() && (!S.team || t.id === S.team) && !nominated.has(t.id));
      if (missing.length) waiting = `<p class="nom-waiting">Waiting for nominees from <b>${missing.map((t) => esc(t.name)).join(', ')}</b>. Their players appear here as soon as their captain submits.</p>`;
    }
    const empty = S.noms && !q
      ? `<p class="no-results">No nominees yet. Team captains pick 1–2 players after each gameday${notStarted() ? `, and voting opens ${esc(JFF.fmtDate(S.week.starts_at))}` : ''}.</p>`
      : '<p class="no-results">No players match your search.</p>';
    $('playerGroups').innerHTML = waiting + (list.length ? [...byTeam].map(([tid, ps]) => `<div class="team-group">
        <div class="team-group-head">${JFF.logoHtml(teams[tid])}<h3>${esc(teams[tid].name)}</h3><small>${ps.length} ${S.noms ? (ps.length === 1 ? 'nominee' : 'nominees') : (ps.length === 1 ? 'player' : 'players')}</small></div>
        <div class="players-grid">${ps.map(card).join('')}</div></div>`).join('')
      : empty);
  }
  const notStarted = () => !!S.week && !S.week.closed && Date.now() < +new Date(S.week.starts_at);

  function renderBanners() {
    $('demoBanner').innerHTML = api.demo
      ? `<div class="demo-banner"><span>⚠ <b>Demo mode.</b> Votes are saved only in this browser, with fake votes from other fans. Add your Supabase keys in config.js to go live.</span><button class="btn-link" id="resetDemo">Reset demo</button></div>` : '';
    $('resetDemo')?.addEventListener('click', () => api.resetDemo());
    const p = S.invite;
    $('inviteBanner').innerHTML = p
      ? `<div class="invite-banner">🏈 You've been invited to vote for <b>${esc(p.nickname || p.full_name)} #${esc(p.number)}</b> (${esc(playerLine(p))}) for <b>${esc(CATEGORY_LABEL[S.cat])}</b>. Find them highlighted below.</div>` : '';
  }

  function renderAll() { renderBanners(); renderAuth(); renderWeek(); renderTabs(); renderTeamFilter(); renderPlayers(); renderBoard(); }

  // ─── DATA ─────────────────────────────────────────────
  async function loadNoms() {
    if (!S.week?.nominations) { S.noms = null; return false; }
    const rows = await api.listNominations(S.week.id);
    const next = new Set(rows.map((r) => r.player_id));
    const changed = !S.noms || next.size !== S.noms.size || [...next].some((id) => !S.noms.has(id));
    S.noms = next;
    return changed;
  }
  async function refreshBoard() {
    if (!S.week) return;
    try {
      if (S.week.nominations && await loadNoms()) renderPlayers();
      [S.board, S.voters] = await Promise.all([api.leaderboard(S.week.id), api.voterCount(S.week.id)]);
      renderBoard(); $('voterCount').textContent = Number(S.voters).toLocaleString('en-US');
    } catch (e) { console.error(e); }
  }
  async function loadWeek() {
    S.myVotes = S.week ? await api.myVotes(S.week.id) : {};
    S.board = []; S.voters = 0; S.noms = null;
    try { await loadNoms(); } catch (e) { console.error(e); }
    renderAll(); await refreshBoard(); renderWeek();
  }

  // ─── ACTIONS ──────────────────────────────────────────
  const showModal = (id) => $(id).classList.add('show');
  const hideModals = () => document.querySelectorAll('.modal-back.show').forEach((m) => m.classList.remove('show'));

  function askVote(pid) {
    const p = players[pid];
    if (!S.user) {
      try { sessionStorage.setItem('jff-pending-vote', JSON.stringify({ pid, cat: S.cat, week: S.week.id })); } catch {}
      $('signinPlayer').style.display = 'flex'; $('signinPlayer').innerHTML = playerChip(p);
      showModal('signinModal'); api.mountSignIn($('modalSignin'), 'continue_with'); return;
    }
    S.pending = pid;
    $('confirmCat').innerHTML = `${esc(CATEGORY_LABEL[S.cat])} · ${esc(S.week.label)}`;
    $('confirmPlayer').innerHTML = playerChip(p);
    showModal('confirmModal');
  }

  async function castVote() {
    const pid = S.pending, cat = S.cat, btn = $('confirmBtn');
    btn.disabled = true; btn.textContent = 'Voting…';
    try {
      await api.castVote(S.week.id, cat, pid);
      S.myVotes[cat] = pid; hideModals();
      renderAuth(); renderTabs(); renderPlayers(); await refreshBoard();
      openShare(pid, cat, true);
    } catch (e) {
      JFF.toast(e.message || 'Something went wrong. Try again.', 'error');
      if (/already/i.test(e.message)) { S.myVotes = await api.myVotes(S.week.id); renderAll(); hideModals(); }
    } finally { btn.disabled = false; btn.textContent = 'Cast vote'; }
  }

  const baseUrl = () => (api.demo ? location.origin + location.pathname : cfg.PUBLIC_URL);
  const shareUrl = (pid, cat) => `${baseUrl()}?p=${encodeURIComponent(pid)}&c=${cat}`;
  const shareText = (p, cat, voted) =>
    `${voted ? 'I just voted for' : 'Vote for'} ${p.nickname || p.full_name} #${p.number} (${teams[p.team].name}) for JFF People's Choice ${CATEGORY_LABEL[cat]} Player of the Week! 🏈🔥 One vote each, so get in:`;

  function openShare(pid, cat, voted) {
    const p = players[pid];
    $('shareCheck').style.display = voted ? 'grid' : 'none';
    $('shareTitle').textContent = voted ? 'Vote counted!' : `Rally for ${p.nickname || p.full_name}`;
    $('shareSub').textContent = voted
      ? (votedCount() < 4 ? `Now get your friends to vote too. You still have ${4 - votedCount()} ${4 - votedCount() === 1 ? 'category' : 'categories'} left.` : "You've voted in all 4 categories. Now get your friends to vote.")
      : `Send ${p.nickname || 'their'} vote link to your group chats.`;
    $('sharePlayer').innerHTML = playerChip(p);
    const url = shareUrl(pid, cat), text = shareText(p, cat, voted);
    $('shareWa').onclick = () => window.open('https://wa.me/?text=' + encodeURIComponent(text + ' ' + url), '_blank', 'noopener');
    $('shareCopy').onclick = async () => {
      try { await navigator.clipboard.writeText(url); JFF.toast('Link copied'); }
      catch { prompt('Copy this link:', url); }
    };
    $('shareStory').onclick = () => JFFStory.make(p, teams[p.team], CATEGORY_LABEL[cat], voted, baseUrl()).catch((e) => { console.error(e); JFF.toast('Could not make the image', 'error'); });
    const nat = $('shareNative');
    nat.style.display = navigator.share ? 'flex' : 'none';
    nat.onclick = () => navigator.share({ title: "JFF People's Choice Player of the Week", text, url }).catch(() => {});
    showModal('shareModal');
  }

  // ─── EVENTS ───────────────────────────────────────────
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-cat],[data-vote],[data-share],[data-signin],[data-close]');
    if (!t) { if (e.target.classList.contains('modal-back')) hideModals(); return; }
    if (t.dataset.cat) { S.cat = t.dataset.cat; S.showAll = false; renderTabs(); renderTeamFilter(); renderPlayers(); renderBoard();
      const u = new URL(location.href); u.searchParams.set('c', S.cat); history.replaceState(null, '', u); }
    else if (t.dataset.vote) askVote(t.dataset.vote);
    else if (t.dataset.share) openShare(t.dataset.share, S.cat, false);
    else if (t.hasAttribute('data-signin')) { hideModals(); api.signIn().catch((err) => JFF.toast(err.message, 'error')); }
    else if (t.hasAttribute('data-close')) hideModals();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideModals(); });
  $('confirmBtn').addEventListener('click', castVote);
  $('search').addEventListener('input', (e) => { S.search = e.target.value; renderPlayers(); });
  $('teamFilter').addEventListener('change', (e) => { S.team = e.target.value; renderPlayers(); });
  $('weekSelect').addEventListener('change', (e) => { S.week = S.weeks.find((w) => String(w.id) === e.target.value); loadWeek(); });

  api.onAuthChange(async (user) => {
    const changed = (user?.id || null) !== (S.user?.id || null);
    S.user = user;
    if (!changed) return;
    if (user) document.getElementById('signinModal').classList.remove('show');
    await loadWeek();
    resumePendingVote();
  });

  function resumePendingVote() {
    if (!S.user || !S.week) return;
    let pv; try { pv = JSON.parse(sessionStorage.getItem('jff-pending-vote')); sessionStorage.removeItem('jff-pending-vote'); } catch {}
    if (!pv || pv.week !== S.week.id || !players[pv.pid] || S.myVotes[pv.cat] || !open()) return;
    S.cat = pv.cat; renderTabs(); renderTeamFilter(); renderPlayers(); renderBoard();
    askVote(pv.pid);
  }

  // ─── START ────────────────────────────────────────────
  (async function start() {
    $('seasonLabel').textContent = cfg.SEASON;
    try {
      S.user = await api.getUser();
      S.weeks = await api.listWeeks();
      S.week = JFF.pickWeek(S.weeks);
      await loadWeek();
      resumePendingVote();
      if (!S.user) api.oneTap();
      if (S.invite) setTimeout(() => $('pc-' + S.invite.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    } catch (e) {
      console.error(e);
      JFF.toast('Could not load voting. Check your connection and refresh.', 'error');
    }
    setInterval(tick, 1000);
    setInterval(() => { if (!document.hidden && S.week) refreshBoard(); }, cfg.REFRESH_SECONDS * 1000);
    setInterval(() => { const was = open(); renderWeek(); if (was !== open()) { renderTabs(); renderPlayers(); } }, 30000);
  })();
})();
