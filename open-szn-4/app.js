// Open SZN IV season hub.
// Reads season.json (written each week from Reclub) and the team list in vote/roster.js,
// then renders standings, games, the playoff race and team/match pages. Everything else
// (records, standings, scenarios) is worked out here from the game results.
(function () {
  const P = window.SZN_PATHS;
  const TEAMS = Object.fromEntries((window.JFF_TEAMS || []).map((t) => [t.id, t]));
  const PLAYERS = window.JFF_PLAYERS || [];
  const VIEWS = ['overview', 'standings', 'games', 'playoffs', 'teams'];
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ord = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
  const fmtDay = (d) => new Date(d + 'T00:00:00+07:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' });
  const played = (g) => g.homeScore != null && g.awayScore != null;
  const name = (id) => TEAMS[id]?.name || id;
  const initials = (s) => s.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  let S = null;            // season.json
  let div = 'men';
  let teamFilter = '';

  // Team logo, or the team's initials if there's no logo file.
  function logo(id) {
    const t = TEAMS[id];
    const ini = esc(initials(name(id)));
    if (!t?.logo) return `<span class="logo-fb">${ini}</span>`;
    return `<img class="logo" src="${P.logos}${esc(t.logo)}" alt="" loading="lazy" data-i="${ini}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'logo-fb',textContent:this.dataset.i}))">`;
  }

  // ─── Standings ───────────────────────────────────────
  function groupsOf(d) { return S.divisions[d].groups; }
  function groupOfTeam(id) {
    for (const [d, cfg] of Object.entries(S.divisions)) for (const [g, ids] of Object.entries(cfg.groups)) if (ids.includes(id)) return { div: d, group: g };
    return null;
  }
  function groupGames(d, g) { return S.games.filter((x) => x.division === d && x.stage === 'group' && (x.group || '') === g); }

  function table(d, g) {
    const pts = S.points;
    const rows = Object.fromEntries(groupsOf(d)[g].map((id) => [id, { id, p: 0, w: 0, l: 0, d: 0, pf: 0, pa: 0, pts: 0, form: [] }]));
    const games = groupGames(d, g).filter(played).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    for (const x of games) {
      const h = rows[x.home], a = rows[x.away];
      if (!h || !a) continue;
      h.p++; a.p++; h.pf += x.homeScore; h.pa += x.awayScore; a.pf += x.awayScore; a.pa += x.homeScore;
      if (x.homeScore > x.awayScore) { h.w++; a.l++; h.pts += pts.win; a.pts += pts.loss; h.form.push('w'); a.form.push('l'); }
      else if (x.homeScore < x.awayScore) { a.w++; h.l++; a.pts += pts.win; h.pts += pts.loss; a.form.push('w'); h.form.push('l'); }
      else { h.d++; a.d++; h.pts += pts.draw; a.pts += pts.draw; h.form.push('d'); a.form.push('d'); }
    }
    const list = Object.values(rows);
    list.forEach((r) => { r.pd = r.pf - r.pa; });
    // Points, then head-to-head between two tied teams, then point difference, then points scored.
    const h2h = (a, b) => {
      const m = games.filter((x) => (x.home === a.id && x.away === b.id) || (x.home === b.id && x.away === a.id));
      let s = 0;
      for (const x of m) { const aScore = x.home === a.id ? x.homeScore : x.awayScore, bScore = x.home === a.id ? x.awayScore : x.homeScore; s += Math.sign(bScore - aScore); }
      return s;
    };
    list.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      const tied = list.filter((r) => r.pts === a.pts);
      if (tied.length === 2) { const h = h2h(a, b); if (h) return h; }
      return b.pd - a.pd || b.pf - a.pf || name(a.id).localeCompare(name(b.id));
    });
    list.forEach((r, i) => { r.rank = i + 1; });
    return list;
  }

  // ─── Playoff race ────────────────────────────────────
  // Tries every win/loss outcome of the group games still to play. A team has clinched if it
  // finishes inside the playoff spots in every outcome, even losing every tie on points; it is
  // out if it finishes outside them in every outcome, even winning every tie.
  function race(d, g) {
    const K = S.divisions[d].playoffSpotsPerGroup;
    const ids = groupsOf(d)[g];
    const base = Object.fromEntries(table(d, g).map((r) => [r.id, r.pts]));
    const rem = groupGames(d, g).filter((x) => !played(x));
    const out = Object.fromEntries(ids.map((id) => [id, { worst: 0, best: Infinity, worstIfWin: 0, left: rem.filter((x) => x.home === id || x.away === id) }]));
    if (rem.length > 16) return null; // too early to be useful
    const n = rem.length;
    for (let mask = 0; mask < (1 << n); mask++) {
      const pts = { ...base };
      const wins = {};
      rem.forEach((x, i) => { const w = mask & (1 << i) ? x.home : x.away; pts[w] += S.points.win; wins[w] = (wins[w] || 0) + 1; });
      for (const id of ids) {
        let above = 0, tied = 0;
        for (const o of ids) if (o !== id) { if (pts[o] > pts[id]) above++; else if (pts[o] === pts[id]) tied++; }
        const r = out[id];
        r.worst = Math.max(r.worst, above + tied + 1);
        r.best = Math.min(r.best, above + 1);
        if ((wins[id] || 0) === r.left.length) r.worstIfWin = Math.max(r.worstIfWin, above + tied + 1);
      }
    }
    for (const id of ids) {
      const r = out[id];
      const opp = (x) => (x.home === id ? x.away : x.home);
      if (r.worst <= K) {
        r.status = 'clinched';
        r.note = r.worst === 1 ? `Clinched 1st${g ? ' in Group ' + g : ''}` : n ? `In the playoffs. Can finish ${ord(r.best)}–${ord(r.worst)}.` : `Finished ${ord(r.worst)}.`;
      } else if (r.best > K) {
        r.status = 'out'; r.note = 'Out of playoff contention.';
      } else if (r.worstIfWin <= K) {
        r.status = 'destiny';
        r.note = r.left.length === 1 ? `In with a win vs ${name(opp(r.left[0]))}.` : `In if they win their last ${r.left.length} games.`;
      } else {
        r.status = 'help';
        r.note = r.left.length ? `Needs results elsewhere. Can finish ${ord(r.best)}–${ord(r.worst)}.` : `Waiting on other results. Can finish ${ord(r.best)}–${ord(r.worst)}.`;
      }
    }
    return { K, remaining: n, teams: out };
  }
  const PILL = { clinched: 'Clinched', destiny: 'Control own fate', help: 'Needs help', out: 'Eliminated' };

  // ─── Shared pieces ───────────────────────────────────
  function gameRow(x) {
    const done = played(x);
    const hw = done && x.homeScore > x.awayScore, aw = done && x.awayScore > x.homeScore;
    const row = (id, sc, win) => `<div class="g-row ${done ? (win ? 'win' : '') : 'up'}">${logo(id)}<span class="nm">${esc(name(id))}</span>${done ? `<span class="sc">${sc}</span>` : ''}</div>`;
    return `<a class="game" href="#match-${esc(x.id)}">
      <div class="g-when">${done ? '<span class="ft">FINAL</span>' : `<b>${esc(x.time)}</b>`}${esc(x.field)}</div>
      <div class="g-teams">${row(x.home, x.homeScore, hw)}${row(x.away, x.awayScore, aw)}</div>
      <div class="g-side">${x.recap ? '<span class="tag">Recap</span>' : ''}<span class="chev" aria-hidden="true">›</span></div></a>`;
  }

  function standingsTable(d, g, compact) {
    const rows = table(d, g);
    const rc = race(d, g);
    const K = S.divisions[d].playoffSpotsPerGroup;
    const shown = compact ? rows.slice(0, K) : rows;
    return `<div class="tbl-wrap"><table class="st">
      <thead><tr><th scope="col" style="text-align:center">#</th><th scope="col">Team</th><th scope="col">W</th><th scope="col">L</th>${compact ? '' : '<th scope="col">PD</th><th scope="col" class="col-form">Form</th>'}<th scope="col">Pts</th></tr></thead>
      <tbody>${shown.map((r) => {
        const st = rc?.teams[r.id]?.status;
        const mark = st === 'clinched' ? '<span class="mark x" title="Clinched a playoff spot">x</span>' : st === 'out' ? '<span class="mark e" title="Eliminated">e</span>' : '';
        return `<tr class="${r.rank === K && !compact ? 'cut' : ''} ${st === 'out' ? 'is-out' : ''}" data-team="${esc(r.id)}">
          <td class="rk">${r.rank}</td>
          <td class="tm"><a href="#team-${esc(r.id)}">${logo(r.id)}<span>${esc(name(r.id))} ${mark}</span></a></td>
          <td>${r.w}</td><td>${r.l}</td>
          ${compact ? '' : `<td class="pd">${r.pd > 0 ? '+' : ''}${r.pd}</td><td class="col-form"><span class="form">${r.form.slice(-5).map((f) => `<i class="${f}"></i>`).join('')}</span></td>`}
          <td class="pts">${r.pts}</td></tr>`;
      }).join('')}</tbody></table></div>`;
  }

  function gamedays(list) {
    const by = new Map();
    for (const x of list) { const k = x.stage === 'group' ? `Gameday ${x.gameday}` : (x.round || 'Playoffs'); if (!by.has(k)) by.set(k, []); by.get(k).push(x); }
    return [...by.entries()];
  }

  // ─── Views ───────────────────────────────────────────
  function viewOverview() {
    const games = S.games.filter((x) => x.division === div);
    const next = games.filter((x) => !played(x)).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    const nextDay = next[0]?.date;
    const last = games.filter(played).sort((a, b) => b.date.localeCompare(a.date));
    const lastDay = last[0]?.date;
    const groups = Object.keys(groupsOf(div));
    return `<div class="ov-grid"><div>
      ${nextDay ? `<section class="blk"><div class="blk-head"><h2 class="blk-title">Next up</h2><span class="blk-sub">${fmtDay(nextDay)}</span></div>
        <div class="games">${next.filter((x) => x.date === nextDay).map(gameRow).join('')}</div></section>` : ''}
      ${lastDay ? `<section class="blk"><div class="blk-head"><h2 class="blk-title">Latest results</h2><a class="blk-link" href="#${hashFor('games')}">All games</a></div>
        <div class="games">${last.filter((x) => x.date === lastDay).map(gameRow).join('')}</div></section>` : ''}
    </div><div>
      <section class="blk"><div class="blk-head"><h2 class="blk-title">Standings</h2><a class="blk-link" href="#${hashFor('standings')}">Full table</a></div>
        ${groups.map((g) => `${g ? `<div class="group-label">Group ${esc(g)}</div>` : ''}${standingsTable(div, g, true)}`).join('')}</section>
      <a class="cta blk" href="${P.vote}"><span><b>People's Choice Player of the Week</b><small>Vote for this week's best offense and defense.</small></span><span class="go" aria-hidden="true">→</span></a>
    </div></div>`;
  }

  function viewStandings() {
    const cfg = S.divisions[div];
    return Object.keys(cfg.groups).map((g) => `<section class="blk">${g ? `<div class="group-label">Group ${esc(g)}</div>` : ''}${standingsTable(div, g, false)}</section>`).join('') +
      `<div class="legend"><span><i class="line"></i> Playoff line (top ${cfg.playoffSpotsPerGroup}${Object.keys(cfg.groups).length > 1 ? ' per group' : ''})</span><span><span class="mark x">x</span> Clinched</span><span><span class="mark e">e</span> Eliminated</span></div>
      <p class="tiebreak">Win ${S.points.win} pts · Draw ${S.points.draw} · Loss ${S.points.loss}. Ties broken by ${S.tiebreakers.slice(1).join(', then ').toLowerCase()}.</p>`;
  }

  function viewGames() {
    const ids = Object.values(groupsOf(div)).flat().sort((a, b) => name(a).localeCompare(name(b)));
    if (teamFilter && !ids.includes(teamFilter)) teamFilter = '';
    const list = S.games.filter((x) => x.division === div && (!teamFilter || x.home === teamFilter || x.away === teamFilter))
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    return `<div class="filter"><label for="teamFilter">Team</label><select id="teamFilter"><option value="">All teams</option>${ids.map((id) => `<option value="${esc(id)}" ${id === teamFilter ? 'selected' : ''}>${esc(name(id))}</option>`).join('')}</select></div>` +
      gamedays(list).map(([k, gs]) => `<div class="day-head"><h3>${esc(k)}</h3><span>${fmtDay(gs[0].date)}</span></div><div class="games">${gs.map(gameRow).join('')}</div>`).join('');
  }

  function viewPlayoffs() {
    const cfg = S.divisions[div];
    const groups = Object.keys(cfg.groups);
    const races = groups.map((g) => [g, race(div, g)]);
    const left = races.reduce((s, [, r]) => s + (r ? r.remaining : 0), 0);
    let html = `<p class="explain">Top ${cfg.playoffSpotsPerGroup}${groups.length > 1 ? ' in each group' : ''} make the playoffs. ${left ? `With ${left} group games left, this works through every possible result to show where each team stands.` : 'The group stage is complete.'} Ties on points are treated as unresolved until they happen, since head-to-head and point difference can still change.</p>`;
    for (const [g, rc] of races) {
      html += `<section class="blk">${g ? `<div class="group-label">Group ${esc(g)}</div>` : ''}`;
      if (!rc) { html += '<p class="empty-note">The playoff race appears once each team has a few games left.</p></section>'; continue; }
      html += `<div class="race">${table(div, g).map((r) => { const t = rc.teams[r.id]; return `<a class="race-row ${t.status === 'out' ? 'out' : ''}" href="#team-${esc(r.id)}">
        <span class="rk">${r.rank}</span>${logo(r.id)}<span class="who"><b>${esc(name(r.id))} <span class="rec">${r.w}–${r.l}</span></b><small><span class="pill ${t.status}">${PILL[t.status]}</span> ${esc(t.note)}</small></span>
        </a>`; }).join('')}</div></section>`;
    }
    // Bracket: real playoff games if they exist, otherwise current seeding.
    const po = S.games.filter((x) => x.division === div && x.stage === 'playoff');
    if (po.length) {
      html += `<section class="blk"><div class="blk-head"><h2 class="blk-title">Playoffs</h2></div>${gamedays(po).map(([k, gs]) => `<div class="day-head"><h3>${esc(k)}</h3><span>${fmtDay(gs[0].date)}</span></div><div class="games">${gs.map(gameRow).join('')}</div>`).join('')}</section>`;
    } else {
      const seedTeam = (s) => { const m = s.match(/^([A-Z]*)(\d+)$/); const t = table(div, m[1] || ''); return t[Number(m[2]) - 1]?.id; };
      html += `<section class="blk"><div class="blk-head"><h2 class="blk-title">If it ended today</h2><span class="blk-sub">${esc(cfg.bracketRound)}</span></div><div class="bracket">${cfg.bracket.map(([a, b]) => {
        const ta = seedTeam(a), tb = seedTeam(b);
        return `<div class="bm">${[[a, ta], [b, tb]].map(([s, id]) => `<div class="bm-row"><span class="seed">${esc(s)}</span>${logo(id)}<span class="nm">${esc(name(id))}</span></div>`).join('')}</div>`;
      }).join('')}</div></section>`;
    }
    return html;
  }

  function viewTeams() {
    const cfg = S.divisions[div];
    return Object.entries(cfg.groups).map(([g, ids]) => {
      const t = Object.fromEntries(table(div, g).map((r) => [r.id, r]));
      return `<section class="blk">${g ? `<div class="group-label">Group ${esc(g)}</div>` : ''}<div class="tgrid">${[...ids].sort((a, b) => name(a).localeCompare(name(b))).map((id) => `<a class="tcard" href="#team-${esc(id)}">${logo(id)}<b>${esc(name(id))}</b><small>${t[id].w}–${t[id].l} · ${ord(t[id].rank)}</small></a>`).join('')}</div></section>`;
    }).join('');
  }

  function viewTeam(id) {
    const where = groupOfTeam(id);
    if (!where) return '<p class="empty-note">Team not found.</p>';
    div = where.div;
    const r = table(where.div, where.group).find((x) => x.id === id);
    const rc = race(where.div, where.group)?.teams[id];
    const games = S.games.filter((x) => x.home === id || x.away === id).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    const next = games.find((x) => !played(x));
    const roster = PLAYERS.filter((p) => p.team === id).sort((a, b) => (a.number === '' ? 999 : +a.number) - (b.number === '' ? 999 : +b.number));
    const per = (v) => (r.p ? (v / r.p).toFixed(1) : '–');
    return `<a class="back" href="#${hashFor('standings')}">← Standings</a>
      <div class="hero-team">${logo(id)}<div><h2>${esc(name(id))}</h2><p>${S.divisions[where.div].label}${where.group ? ' · Group ' + esc(where.group) : ''} · ${ord(r.rank)} place</p></div></div>
      <div class="tiles"><div class="tile"><b>${r.w}–${r.l}</b><small>Record</small></div><div class="tile"><b>${r.pd > 0 ? '+' : ''}${r.pd}</b><small>Pt diff</small></div><div class="tile"><b>${per(r.pf)}</b><small>Pts for/gm</small></div><div class="tile"><b>${per(r.pa)}</b><small>Pts agst/gm</small></div></div>
      ${rc ? `<div class="status-line"><span class="pill ${rc.status}">${PILL[rc.status]}</span><span>${esc(rc.note)}</span></div>` : ''}
      ${next ? `<section class="blk"><div class="blk-head"><h2 class="blk-title">Next game</h2><span class="blk-sub">${fmtDay(next.date)}</span></div><div class="games">${gameRow(next)}</div></section>` : ''}
      <section class="blk"><div class="blk-head"><h2 class="blk-title">Schedule & results</h2></div><div class="games">${games.map(gameRow).join('')}</div></section>
      <section class="blk"><div class="blk-head"><h2 class="blk-title">Roster</h2><span class="blk-sub">${roster.length} players</span></div>
        ${roster.length ? `<div class="roster">${roster.map((p) => `<div class="pl"><span class="no">${esc(p.number)}</span><span class="nm"><b>${esc(p.nickname || p.full_name)}</b>${p.nickname ? `<small>${esc(p.full_name)}</small>` : ''}</span><span class="pos">${esc(p.position || '')}</span></div>`).join('')}</div>` : '<p class="empty-note">Roster coming soon.</p>'}</section>`;
  }

  function viewMatch(gid) {
    const x = S.games.find((g) => g.id === gid);
    if (!x) return '<p class="empty-note">Game not found.</p>';
    div = x.division;
    const done = played(x);
    const g = x.group || '';
    const tbl = Object.fromEntries(table(x.division, g).map((r) => [r.id, r]));
    const rec = (id) => (tbl[id] ? `${tbl[id].w}–${tbl[id].l} · ${ord(tbl[id].rank)}` : '');
    const side = (id, lose) => `<a class="board-team" href="#team-${esc(id)}">${logo(id)}<b>${esc(name(id))}</b><small>${rec(id)}</small></a>`;
    const hl = done && x.homeScore < x.awayScore, al = done && x.awayScore < x.homeScore;
    let html = `<a class="back" href="#${hashFor('games')}">← Games</a>
      <p class="match-meta">${x.stage === 'group' ? (g ? `Group ${esc(g)} · ` : '') + `Gameday ${x.gameday}` : esc(x.round || 'Playoffs')} · ${fmtDay(x.date)} · ${esc(x.time)} · ${esc(x.field)}</p>
      <div class="board">${side(x.home)}<div class="board-score ${done ? '' : 'kick'}">${done ? `<span class="${hl ? 'lose' : ''}">${x.homeScore}</span>–<span class="${al ? 'lose' : ''}">${x.awayScore}</span><small>FINAL</small>` : `${esc(x.time)}<small>KICKOFF</small>`}</div>${side(x.away)}</div>`;
    // Match notes: written by JFF or a captain after the game.
    if (done) html += `<section class="blk"><div class="blk-head"><h2 class="blk-title">Match notes</h2></div>${x.recap ? `<div class="recap">${esc(x.recap)}</div>` : '<div class="recap empty">No write-up for this game yet.</div>'}</section>`;
    // Head to head on season numbers.
    const a = tbl[x.home], b = tbl[x.away];
    if (a && b && (a.p || b.p)) {
      const stat = (label, va, vb, fmt = (v) => v) => {
        const m = Math.max(Math.abs(va), Math.abs(vb)) || 1;
        return `<div class="cmp-row"><span>${fmt(va)}</span><div class="cmp-mid"><small>${label}</small><div class="bars"><i><b style="width:${Math.max(0, va) / m * 100}%"></b></i><i><b style="width:${Math.max(0, vb) / m * 100}%"></b></i></div></div><span>${fmt(vb)}</span></div>`;
      };
      const pg = (r, v) => (r.p ? v / r.p : 0);
      html += `<section class="blk"><div class="blk-head"><h2 class="blk-title">Season so far</h2><span class="blk-sub">${esc(name(x.home))} vs ${esc(name(x.away))}</span></div><div class="cmp">
        ${stat('Wins', a.w, b.w)}${stat('Points for / game', pg(a, a.pf), pg(b, b.pf), (v) => v.toFixed(1))}${stat('Points against / game', pg(a, a.pa), pg(b, b.pa), (v) => v.toFixed(1))}${stat('Point difference', a.pd, b.pd, (v) => (v > 0 ? '+' : '') + Math.round(v))}</div></section>`;
    }
    // What's at stake, from the playoff race.
    if (!done && x.stage === 'group') {
      const rc = race(x.division, g);
      if (rc) {
        const lines = [x.home, x.away].map((id) => `<li><b>${esc(name(id))}:</b> ${esc(rc.teams[id].note)}</li>`).join('');
        html += `<section class="blk"><div class="blk-head"><h2 class="blk-title">What's at stake</h2></div><ul class="stake">${lines}</ul></section>`;
      }
    }
    return html;
  }

  // ─── Routing ─────────────────────────────────────────
  // #standings, #standings-women, #team-orcas, #match-g12
  function hashFor(view) { return div === 'men' ? view : `${view}-women`; }
  function route() {
    const h = location.hash.slice(1);
    let view = 'overview', html;
    if (h.startsWith('team-')) { html = viewTeam(h.slice(5)); view = 'teams'; }
    else if (h.startsWith('match-')) { html = viewMatch(h.slice(6)); view = 'games'; }
    else {
      const m = h.match(/^([a-z]+)(-women)?$/);
      if (m && VIEWS.includes(m[1])) { view = m[1]; div = m[2] ? 'women' : 'men'; }
      else if (!h) { try { div = localStorage.getItem('szn4-div') === 'women' ? 'women' : div; } catch {} }
      html = { overview: viewOverview, standings: viewStandings, games: viewGames, playoffs: viewPlayoffs, teams: viewTeams }[view]();
    }
    try { localStorage.setItem('szn4-div', div); } catch {}
    $('view').innerHTML = html;
    document.querySelectorAll('#tabs a').forEach((a) => { a.href = '#' + hashFor(a.dataset.view); a.toggleAttribute('aria-current', a.dataset.view === view); if (a.dataset.view === view) a.setAttribute('aria-current', 'page'); });
    $('divMen').setAttribute('aria-pressed', String(div === 'men'));
    $('divWomen').setAttribute('aria-pressed', String(div === 'women'));
    $('teamFilter')?.addEventListener('change', (e) => { teamFilter = e.target.value; route(); });
    document.querySelectorAll('.st tbody tr[data-team]').forEach((tr) => tr.addEventListener('click', (e) => { if (!e.target.closest('a')) location.hash = 'team-' + tr.dataset.team; }));
  }
  function currentView() { const a = document.querySelector('#tabs a[aria-current="page"]'); return a ? a.dataset.view : 'overview'; }
  document.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => {
    div = b.dataset.div; teamFilter = '';
    const v = currentView();
    const h = hashFor(v);
    if (location.hash.slice(1) === h) route(); else location.hash = h;
  }));
  window.addEventListener('hashchange', () => { route(); const bar = document.querySelector('.szn-bar'); if (bar && window.scrollY > bar.offsetTop) window.scrollTo({ top: bar.offsetTop - 1 }); });

  function setNavHeight() { const n = document.querySelector('.nav'); if (n) document.documentElement.style.setProperty('--nav-h', n.offsetHeight + 'px'); }
  window.addEventListener('resize', setNavHeight);

  // ─── Boot ────────────────────────────────────────────
  setNavHeight();
  fetch(P.season, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((data) => {
    S = data;
    const g = S.games.filter((x) => x.stage === 'group');
    const doneDays = new Set(g.filter(played).map((x) => x.gameday)), allDays = new Set(g.map((x) => x.gameday));
    const upd = new Date(S.updated).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
    $('sznMeta').innerHTML = `<span><b>Gameday ${doneDays.size}</b> of ${allDays.size} played</span><span>${esc(S.venue)}</span><span>Updated ${esc(upd)} WIB</span>`;
    if (S.sample) $('sampleNote').innerHTML = '<p class="sample-note">Preview with sample scores. Teams, logos and rosters are real; results are made up until the season data is connected.</p>';
    route();
  }).catch(() => { $('view').innerHTML = '<p class="empty-note">Season data could not be loaded. Refresh to try again.</p>'; });
})();
