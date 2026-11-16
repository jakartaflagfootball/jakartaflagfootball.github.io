// Open SZN IV season hub.
// Reads season.json (pools, schedule, scores) and the team list in vote/roster.js. Standings,
// tiebreakers, seeding and the playoff race are worked out here from the game results, using
// the rules in the Open SZN IV guidebook.
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
  const byTime = (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.field.localeCompare(b.field);

  let S = null;
  let div = 'men';
  let teamFilter = '';

  function logo(id) {
    if (!id) return '<span class="logo-fb tbd">?</span>';
    const t = TEAMS[id];
    const ini = esc(initials(name(id)));
    if (!t?.logo) return `<span class="logo-fb">${ini}</span>`;
    return `<img class="logo" src="${P.logos}${esc(t.logo)}" alt="" loading="lazy" data-i="${ini}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'logo-fb',textContent:this.dataset.i}))">`;
  }

  // ─── Pool standings ──────────────────────────────────
  const isMen = (d) => S.divisions[d].format === 'men-3x4';
  const pools = (d) => S.divisions[d].pools;
  const poolGames = (d, p) => S.games.filter((x) => x.division === d && x.stage === 'pool' && x.pool === p);
  const poolOf = (id) => { for (const [d, c] of Object.entries(S.divisions)) for (const [p, ids] of Object.entries(c.pools)) if (ids.includes(id)) return { div: d, pool: p }; return null; };
  const poolDone = (d) => S.games.filter((x) => x.division === d && x.stage === 'pool').every(played);

  function rowsFrom(ids, games, pts) {
    const rows = Object.fromEntries(ids.map((id) => [id, { id, p: 0, w: 0, l: 0, d: 0, pf: 0, pa: 0, pts: 0, form: [] }]));
    for (const x of [...games].sort(byTime)) {
      const h = rows[x.home], a = rows[x.away];
      if (!h || !a || !played(x)) continue;
      h.p++; a.p++; h.pf += x.homeScore; h.pa += x.awayScore; a.pf += x.awayScore; a.pa += x.homeScore;
      const r = Math.sign(x.homeScore - x.awayScore);
      if (r > 0) { h.w++; a.l++; h.pts += pts.win; a.pts += pts.loss; h.form.push('w'); a.form.push('l'); }
      else if (r < 0) { a.w++; h.l++; a.pts += pts.win; h.pts += pts.loss; a.form.push('w'); h.form.push('l'); }
      else { h.d++; a.d++; h.pts += pts.draw; a.pts += pts.draw; h.form.push('d'); a.form.push('d'); }
    }
    Object.values(rows).forEach((r) => { r.pd = r.pf - r.pa; });
    return rows;
  }

  // Inside a pool: points, then head-to-head among the tied teams (a mini-table when three or
  // more are tied), then point difference, fewest points allowed, most points scored.
  function table(d, p) {
    const games = poolGames(d, p);
    const rows = rowsFrom(pools(d)[p], games, S.points);
    const list = Object.values(rows);
    const groups = new Map();
    list.forEach((r) => { if (!groups.has(r.pts)) groups.set(r.pts, []); groups.get(r.pts).push(r); });
    for (const tied of groups.values()) {
      if (tied.length < 2) continue;
      const ids = tied.map((r) => r.id);
      const mini = rowsFrom(ids, games.filter((x) => ids.includes(x.home) && ids.includes(x.away)), S.points);
      tied.forEach((r) => { r.h2h = mini[r.id].pts; });
    }
    list.sort((a, b) => b.pts - a.pts || (b.h2h || 0) - (a.h2h || 0) || b.pd - a.pd || a.pa - b.pa || b.pf - a.pf || name(a.id).localeCompare(name(b.id)));
    list.forEach((r, i) => { r.rank = i + 1; r.pool = p; });
    return list;
  }

  // Across pools (no head-to-head): points, point difference, fewest allowed, most scored.
  const crossSort = (a, b) => b.pts - a.pts || b.pd - a.pd || a.pa - b.pa || b.pf - a.pf || name(a.id).localeCompare(name(b.id));
  function byFinish(d, n) { return Object.keys(pools(d)).map((p) => table(d, p)[n - 1]).filter(Boolean).sort(crossSort); }

  // ─── Seeding (guidebook) ─────────────────────────────
  // Men: #1–#3 pool winners, #4–#6 runners-up, #7–#8 the two best 3rd-place teams.
  // No pool rematches in the quarterfinals: #7 and #8 (or #5 and #6) trade opponents. Seeds
  // themselves stay in merit order; only the pairing changes.
  // `seeds` is the merit order (seed n = seeds[n-1]). `slots` is the bracket order that the
  // "#n" slots in season.json resolve to (1v8, 2v7, 3v6, 4v5 by position).
  function menSeeds() {
    const firsts = byFinish('men', 1), seconds = byFinish('men', 2), thirds = byFinish('men', 3), fourths = byFinish('men', 4);
    const seeds = [...firsts, ...seconds, ...thirds.slice(0, 2)];
    let slots = [...seeds];
    const qf = [[0, 7], [1, 6], [2, 5], [3, 4]];
    const clashing = (s, pairs) => pairs.map(([a, b]) => [s[a], s[b]]).find(([x, y]) => x && y && x.pool === y.pool);
    const swaps = [];
    for (const [pairs, i, j] of [[[qf[0], qf[1]], 6, 7], [[qf[2], qf[3]], 4, 5]]) {
      const c = clashing(slots, pairs);
      if (!c) continue;
      const s = [...slots]; [s[i], s[j]] = [s[j], s[i]]; slots = s;
      swaps.push({ seeds: [i + 1, j + 1], teams: [c[0].id, c[1].id], pool: c[0].pool });
    }
    const opp = {};
    qf.forEach(([a, b]) => { if (slots[a] && slots[b]) { opp[slots[a].id] = slots[b].id; opp[slots[b].id] = slots[a].id; } });
    const tier2 = [thirds[2], ...fourths].filter(Boolean);
    return { seeds, slots, opp, tier2, thirds, swaps };
  }
  const menSeedNo = (id) => menSeeds().seeds.findIndex((r) => r.id === id) + 1;
  function womenSeeds() { return table('women', 'A').slice(0, 4); }

  // Resolve a playoff slot ("#1", "MT#2", "W#3", "W:MQF1", "L:WSF2") to a team id, or null.
  function resolve(slot, d, projected) {
    let m;
    if ((m = slot.match(/^([WL]):(.+)$/))) {
      const g = S.games.find((x) => x.id === m[2]);
      if (!g) return null;
      const h = g.home || resolve(g.homeSlot, d, false), a = g.away || resolve(g.awaySlot, d, false);
      if (!played(g) || !h || !a) return null;
      const homeWon = g.homeScore > g.awayScore;
      return (m[1] === 'W') === homeWon ? h : a;
    }
    if (!projected && !poolDone(d)) return null;
    if ((m = slot.match(/^#(\d)$/))) return menSeeds().slots[+m[1] - 1]?.id || null;
    if ((m = slot.match(/^MT#(\d)$/))) return menSeeds().tier2[+m[1] - 1]?.id || null;
    if ((m = slot.match(/^W#(\d)$/))) return womenSeeds()[+m[1] - 1]?.id || null;
    return null;
  }
  function slotText(slot) {
    let m;
    if ((m = slot.match(/^([WL]):(.+)$/))) return `${m[1] === 'W' ? 'Winner' : 'Loser'} ${m[2]}`;
    if ((m = slot.match(/^#(\d)$/))) return `#${m[1]} seed`;
    if ((m = slot.match(/^MT#(\d)$/))) return `MT #${m[1]} seed`;
    if ((m = slot.match(/^W#(\d)$/))) return `#${m[1]} seed`;
    return slot;
  }
  const side = (g, s) => (g.stage === 'pool' ? g[s] : g[s] || resolve(g[s + 'Slot'], g.division, false));

  // ─── Playoff race ────────────────────────────────────
  // Tries every win/loss result of the pool games still to play. Ties on points count against
  // the team (for "clinched") or in its favour (for "out"), since tiebreakers can still move.
  function race(d, p) {
    const ids = pools(d)[p];
    const base = Object.fromEntries(table(d, p).map((r) => [r.id, r.pts]));
    const rem = poolGames(d, p).filter((x) => !played(x));
    if (rem.length > 16) return null;
    const out = Object.fromEntries(ids.map((id) => [id, { worst: 0, best: Infinity, worstIfWin: 0, left: rem.filter((x) => x.home === id || x.away === id) }]));
    for (let mask = 0; mask < (1 << rem.length); mask++) {
      const pts = { ...base }, wins = {};
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
    const men = isMen(d);
    const K = men ? 2 : 4;
    for (const id of ids) {
      const r = out[id];
      const vs = r.left.length === 1 ? ` vs ${name(r.left[0].home === id ? r.left[0].away : r.left[0].home)}` : '';
      const range = r.best === r.worst ? `${ord(r.best)}` : `${ord(r.best)}–${ord(r.worst)}`;
      if (r.worst <= K) {
        r.status = 'clinched';
        r.note = r.worst === 1 ? `Clinched 1st in Pool ${p}.` : men ? `Clinched a top-2 spot: into the Playoffs bracket.` : `Into the semifinals. Can finish ${range}.`;
      } else if (r.worstIfWin <= K) {
        r.status = 'destiny';
        r.note = r.left.length === 1 ? `Into the ${men ? 'Playoffs' : 'semifinals'} with a win${vs}.` : `Into the ${men ? 'Playoffs' : 'semifinals'} if they win their last ${r.left.length} games.`;
      } else if (r.best <= K) {
        r.status = 'help';
        r.note = `Can still finish top ${K}, but needs other results to go their way. Can finish ${range}.`;
      } else if (men && r.best === 3) {
        r.status = 'wild';
        r.note = r.worst === 3 ? 'Locked into 3rd: in the wildcard race.' : `Needs 3rd place for a wildcard shot. Can finish ${range}.`;
      } else {
        r.status = 'out';
        r.note = men ? 'Plays for places 9–12 on Playoff Day.' : 'Finishes 5th. Season ends after Week 3.';
      }
    }
    return { K, remaining: rem.length, teams: out };
  }
  const PILL = { clinched: 'Clinched', destiny: 'Control own fate', help: 'Needs help', wild: 'Wildcard race', out: 'Out' };

  // ─── Shared pieces ───────────────────────────────────
  function teamLine(g, s, done, win) {
    const id = side(g, s);
    const label = id ? name(id) : slotText(g[s + 'Slot']);
    return `<div class="g-row ${done ? (win ? 'win' : '') : 'up'} ${id ? '' : 'tbd'}">${logo(id)}<span class="nm">${esc(label)}</span>${done ? `<span class="sc">${g[s === 'home' ? 'homeScore' : 'awayScore']}</span>` : ''}</div>`;
  }
  function gameRow(x) {
    const done = played(x);
    const tag = x.stage === 'playoff' ? `<span class="g-code">${esc(x.id)}</span>` : '';
    return `<a class="game" href="#match-${esc(x.id)}">
      <div class="g-when">${done ? '<span class="ft">FINAL</span>' : `<b>${esc(x.time)}</b>`}${esc(x.field)}${x.field === S.livestream ? '<span class="live">● Live</span>' : ''}</div>
      <div class="g-teams">${tag}${teamLine(x, 'home', done, x.homeScore > x.awayScore)}${teamLine(x, 'away', done, x.awayScore > x.homeScore)}</div>
      <div class="g-side">${x.recap ? '<span class="tag">Recap</span>' : ''}<span class="chev" aria-hidden="true">›</span></div></a>`;
  }

  function standingsTable(d, p, compact) {
    const rows = table(d, p);
    const rc = race(d, p);
    const men = isMen(d);
    const shown = compact ? rows.slice(0, men ? 3 : 4) : rows;
    return `<div class="tbl-wrap"><table class="st">
      <thead><tr><th scope="col" style="text-align:center">#</th><th scope="col">Team</th><th scope="col">W</th><th scope="col">L</th>${compact ? '' : '<th scope="col">PD</th><th scope="col" class="col-form">Form</th>'}<th scope="col">Pts</th></tr></thead>
      <tbody>${shown.map((r) => {
        const st = rc?.teams[r.id]?.status;
        const mark = st === 'clinched' ? '<span class="mark x" title="Clinched">x</span>' : st === 'out' ? `<span class="mark e" title="${men ? 'Places 9–12' : 'Eliminated'}">e</span>` : '';
        const cut = !compact && ((men && r.rank === 2) ? 'cut' : (men && r.rank === 3) ? 'cut-wild' : (!men && r.rank === 4) ? 'cut' : '');
        return `<tr class="${cut} ${st === 'out' ? 'is-out' : ''}" data-team="${esc(r.id)}">
          <td class="rk">${r.rank}</td>
          <td class="tm"><a href="#team-${esc(r.id)}">${logo(r.id)}<span>${esc(name(r.id))} ${mark}</span></a></td>
          <td>${r.w}</td><td>${r.l}</td>
          ${compact ? '' : `<td class="pd">${r.pd > 0 ? '+' : ''}${r.pd}</td><td class="col-form"><span class="form">${r.form.slice(-5).map((f) => `<i class="${f}"></i>`).join('')}</span></td>`}
          <td class="pts">${r.pts}</td></tr>`;
      }).join('')}</tbody></table></div>`;
  }

  function wildcardTable() {
    const t = byFinish('men', 3);
    return `<div class="blk-head"><h2 class="blk-title">3rd-place race</h2><span class="blk-sub">Best 2 become wildcards</span></div>
      <div class="tbl-wrap"><table class="st"><thead><tr><th scope="col" style="text-align:center">#</th><th scope="col">Team</th><th scope="col">Pts</th><th scope="col">PD</th><th scope="col">PA</th><th scope="col">PF</th></tr></thead>
      <tbody>${t.map((r, i) => `<tr class="${i === 1 ? 'cut' : ''}" data-team="${esc(r.id)}"><td class="rk">${i + 1}</td><td class="tm"><a href="#team-${esc(r.id)}">${logo(r.id)}<span>${esc(name(r.id))} <span class="pool-tag">${esc(r.pool)}3</span></span></a></td><td class="pts">${r.pts}</td><td class="pd">${r.pd > 0 ? '+' : ''}${r.pd}</td><td>${r.pa}</td><td>${r.pf}</td></tr>`).join('')}</tbody></table></div>
      <p class="tiebreak">3rd-place teams never meet, so they're compared on points, then point difference, fewest points allowed, most points scored, then a coin toss.</p>`;
  }

  // Seeds 1–8 (men) or 1–4 (women), how each got there, and who they open against.
  function seedRows(list, opp, how, oppLabel) {
    return list.map((r, i) => {
      const o = list[opp(i)];
      return `<tr data-team="${esc(r.id)}"><td class="rk">${i + 1}</td>
        <td class="tm"><a href="#team-${esc(r.id)}">${logo(r.id)}<span>${esc(name(r.id))}<small class="seed-how">${esc(how(r, i))}</small></span></a></td>
        <td class="pts">${r.pts}</td><td class="pd">${r.pd > 0 ? '+' : ''}${r.pd}</td>
        <td class="vs">${o ? `${oppLabel} #${opp(i) + 1}` : ''}</td></tr>`;
    }).join('');
  }
  function seedTable(body, oppHead) {
    return `<div class="tbl-wrap"><table class="st seeds"><thead><tr><th scope="col" style="text-align:center">Seed</th><th scope="col">Team</th><th scope="col">Pts</th><th scope="col">PD</th><th scope="col">${oppHead}</th></tr></thead><tbody>${body}</tbody></table></div>`;
  }
  function playoffPicture(done) {
    const head = `<div class="blk-head"><h2 class="blk-title">Playoff picture</h2><span class="blk-sub">${done ? 'Final seeds' : 'If the season ended today'}</span></div>`;
    if (!isMen(div)) {
      const s = womenSeeds();
      return `<section class="blk">${head}${seedTable(seedRows(s, (i) => 3 - i, (r) => `${ord(r.rank)} in the pool`, 'vs'), 'Semi')}
        <p class="tiebreak">Semifinals: #1 v #4, #2 v #3.</p></section>`;
    }
    const { seeds, opp, tier2, swaps } = menSeeds();
    const finish = ['winner', 'runner-up', '3rd · wildcard'];
    const how = (r) => `Pool ${r.pool} ${finish[r.rank - 1]}`;
    const oppIdx = (i) => seeds.findIndex((r) => r.id === opp[seeds[i].id]);
    const notes = swaps.map((w) => `#${w.seeds[0]} and #${w.seeds[1]} trade opponents so ${name(w.teams[0])} and ${name(w.teams[1])} (both Pool ${w.pool}) don't meet again.`);
    const mtHow = (r, i) => (i === 0 ? `Pool ${r.pool} 3rd · missed wildcard` : `Pool ${r.pool} 4th`);
    return `<section class="blk">${head}
      ${seedTable(seedRows(seeds, oppIdx, how, 'vs'), 'QF')}
      <p class="tiebreak">Seeds #1–3 are the pool winners, #4–6 the runners-up, #7–8 the two best 3rd-place teams. Each group is ranked by points, point difference, fewest points allowed, most points scored. Quarterfinals: 1v8, 2v7, 3v6, 4v5, unless that's a pool rematch.${notes.length ? ' ' + esc(notes.join(' ')) : ''}</p>
      <div class="group-label" style="margin-top:1.5rem">Places 9–12</div>
      ${seedTable(seedRows(tier2, (i) => 3 - i, mtHow, 'vs MT'), 'Semi')}
      <p class="tiebreak">MT #1 is the 3rd-place team that missed the wildcard, MT #2–4 the 4th-place teams. Semifinals: MT1 v MT4, MT2 v MT3.</p>
      </section>`;
  }

  // ─── Views ───────────────────────────────────────────
  function viewOverview() {
    const games = S.games.filter((x) => x.division === div);
    const next = games.filter((x) => !played(x)).sort(byTime);
    const nextDay = next[0]?.date;
    const last = games.filter(played).sort((a, b) => byTime(b, a));
    const lastDay = last[0]?.date;
    const ps = Object.keys(pools(div));
    return `<div class="ov-grid"><div>
      ${nextDay ? `<section class="blk"><div class="blk-head"><h2 class="blk-title">Next up</h2><span class="blk-sub">${fmtDay(nextDay)}</span></div>
        <div class="games">${next.filter((x) => x.date === nextDay).map(gameRow).join('')}</div></section>` : ''}
      ${lastDay ? `<section class="blk"><div class="blk-head"><h2 class="blk-title">Latest results</h2><a class="blk-link" href="#${hashFor('games')}">All games</a></div>
        <div class="games">${last.filter((x) => x.date === lastDay).sort(byTime).map(gameRow).join('')}</div></section>` : ''}
    </div><div>
      <section class="blk"><div class="blk-head"><h2 class="blk-title">Standings</h2><a class="blk-link" href="#${hashFor('standings')}">Full table</a></div>
        ${ps.map((p) => `${ps.length > 1 ? `<div class="group-label">Pool ${esc(p)}</div>` : ''}${standingsTable(div, p, true)}`).join('')}</section>
      <a class="cta blk" href="${P.vote}"><span><b>People's Choice Player of the Week</b><small>Vote for this week's best offense and defense.</small></span><span class="go" aria-hidden="true">→</span></a>
    </div></div>`;
  }

  function viewStandings() {
    const men = isMen(div);
    const ps = Object.keys(pools(div));
    return ps.map((p) => `<section class="blk">${ps.length > 1 ? `<div class="group-label">Pool ${esc(p)}</div>` : ''}${standingsTable(div, p, false)}</section>`).join('') +
      `<div class="legend">${men
        ? '<span><i class="line"></i> Top 2: Playoffs bracket</span><span><i class="line gold"></i> 3rd: wildcard race</span><span><span class="mark x">x</span> Clinched top 2</span><span><span class="mark e">e</span> Plays for 9–12</span>'
        : '<span><i class="line"></i> Top 4: semifinals</span><span><span class="mark x">x</span> Clinched</span><span><span class="mark e">e</span> Eliminated</span>'}</div>
      <p class="tiebreak">Win 3 pts · Tie 1 · Loss 0. Ties inside a pool: head-to-head (a mini-table if three or more are tied), then point difference, fewest points allowed, most points scored, coin toss.</p>
      ${men ? `<section class="blk" style="margin-top:2rem">${wildcardTable()}</section>` : ''}`;
  }

  function viewGames() {
    const ids = Object.values(pools(div)).flat().sort((a, b) => name(a).localeCompare(name(b)));
    if (teamFilter && !ids.includes(teamFilter)) teamFilter = '';
    const list = S.games.filter((x) => x.division === div && (!teamFilter || side(x, 'home') === teamFilter || side(x, 'away') === teamFilter)).sort(byTime);
    const days = new Map();
    for (const x of list) { const k = x.stage === 'pool' ? `Week ${x.week}` : 'Playoff Day'; if (!days.has(k)) days.set(k, []); days.get(k).push(x); }
    return `<div class="filter"><label for="teamFilter">Team</label><select id="teamFilter"><option value="">All teams</option>${ids.map((id) => `<option value="${esc(id)}" ${id === teamFilter ? 'selected' : ''}>${esc(name(id))}</option>`).join('')}</select></div>` +
      [...days].map(([k, gs]) => `<div class="day-head"><h3>${esc(k)}</h3><span>${fmtDay(gs[0].date)} · ${esc(S.venue)}</span></div><div class="games">${gs.map(gameRow).join('')}</div>`).join('') +
      (teamFilter && !days.has('Playoff Day') && !poolDone(div) ? '<p class="empty-note">Playoff Day games appear here once seeds are set after Week 3.</p>' : '');
  }

  function bracketCard(g, projected) {
    const row = (s) => {
      const id = g[s] || resolve(g[s + 'Slot'], g.division, projected);
      // A "#n" slot is a bracket position; label it with the team's real seed.
      const tag = id && /^#\d$/.test(g[s + 'Slot']) ? `#${menSeedNo(id)}` : g[s + 'Slot'].replace(/^W:|^L:/, (m) => (m === 'W:' ? 'W ' : 'L '));
      return `<div class="bm-row"><span class="seed">${esc(tag)}</span>${logo(id)}<span class="nm ${id ? '' : 'tbd'}">${esc(id ? name(id) : slotText(g[s + 'Slot']))}</span>${played(g) ? `<span class="sc">${g[s === 'home' ? 'homeScore' : 'awayScore']}</span>` : ''}</div>`;
    };
    return `<a class="bm" href="#match-${esc(g.id)}"><div class="bm-head"><b>${esc(g.id)}</b><span>${esc(g.round)} · ${esc(g.time)} · ${esc(g.field)}</span></div>${row('home')}${row('away')}</a>`;
  }

  function viewPlayoffs() {
    const men = isMen(div);
    const ps = Object.keys(pools(div));
    const left = ps.reduce((s, p) => s + poolGames(div, p).filter((x) => !played(x)).length, 0);
    const done = poolDone(div);
    let html = `<p class="explain">${men
      ? 'Top 2 in each pool make the 8-team Playoffs bracket, joined by the two best 3rd-place teams as wildcards. Everyone else plays for places 9–12. Every men\'s team plays on Playoff Day, Sat 5 Dec.'
      : 'The top 4 make the semifinals on Playoff Day, Sat 5 Dec. 5th place finishes the season after Week 3.'} ${left ? `With ${left} pool games left, this checks every possible result to show where each team stands. Ties on points are left open until they happen, since tiebreakers can still change.` : 'The pool stage is complete.'}</p>`;
    for (const p of ps) {
      const rc = race(div, p);
      html += `<section class="blk">${ps.length > 1 ? `<div class="group-label">Pool ${esc(p)}</div>` : ''}<div class="race">${table(div, p).map((r) => {
        const t = rc.teams[r.id];
        return `<a class="race-row ${t.status === 'out' ? 'out' : ''}" href="#team-${esc(r.id)}"><span class="rk">${r.rank}</span>${logo(r.id)}<span class="who"><b>${esc(name(r.id))} <span class="rec">${r.w}–${r.l}</span></b><small><span class="pill ${t.status}">${PILL[t.status]}</span> ${esc(t.note)}</small></span></a>`;
      }).join('')}</div></section>`;
    }
    if (men) html += `<section class="blk">${wildcardTable()}</section>`;
    html += playoffPicture(done);
    const po =S.games.filter((x) => x.division === div && x.stage === 'playoff');
    const groupsOrder = men ? ['Playoffs', 'Places 9–12'] : ['Championship'];
    html += `<section class="blk"><div class="blk-head"><h2 class="blk-title">${done ? 'Playoff Day' : 'If it ended today'}</h2><span class="blk-sub">Sat 5 Dec · ${esc(S.venue)}</span></div>
      ${done ? '' : '<p class="explain">Projected from the current standings, including the no-rematch rule for the quarterfinals. Seeds are set after Week 3.</p>'}
      ${groupsOrder.map((b) => {
        // Before seeds are set, show only the opening games; later rounds are all "Winner of…".
        const gs = po.filter((x) => x.bracket === b && (done || !/^[WL]:/.test(x.homeSlot)));
        const rounds = [...new Set(gs.map((x) => x.round))];
        return `<div class="group-label">${esc(b === 'Playoffs' ? 'Playoffs bracket · places 1–8' : b === 'Places 9–12' ? 'Places 9–12' : 'Semifinals')}</div>
          ${rounds.map((r) => `<div class="round-label">${esc(r)}</div><div class="bracket">${gs.filter((x) => x.round === r).sort((a, b) => a.id.localeCompare(b.id)).map((g) => bracketCard(g, true)).join('')}</div>`).join('')}`;
      }).join('')}
      ${done ? '' : `<p class="tiebreak"><a class="blk-link" href="#${hashFor('games')}">Full Playoff Day schedule →</a></p>`}</section>`;
    return html;
  }

  function viewTeams() {
    const ps = pools(div);
    return Object.entries(ps).map(([p, ids]) => {
      const t = Object.fromEntries(table(div, p).map((r) => [r.id, r]));
      return `<section class="blk">${Object.keys(ps).length > 1 ? `<div class="group-label">Pool ${esc(p)}</div>` : ''}<div class="tgrid">${[...ids].sort((a, b) => name(a).localeCompare(name(b))).map((id) => `<a class="tcard" href="#team-${esc(id)}">${logo(id)}<b>${esc(name(id))}</b><small>${t[id].w}–${t[id].l} · ${ord(t[id].rank)} in Pool ${esc(p)}</small></a>`).join('')}</div></section>`;
    }).join('');
  }

  function viewTeam(id) {
    const where = poolOf(id);
    if (!where) return '<p class="empty-note">Team not found.</p>';
    div = where.div;
    const r = table(where.div, where.pool).find((x) => x.id === id);
    const rc = race(where.div, where.pool)?.teams[id];
    const games = S.games.filter((x) => side(x, 'home') === id || side(x, 'away') === id).sort(byTime);
    const next = games.find((x) => !played(x));
    const roster = PLAYERS.filter((p) => p.team === id).sort((a, b) => (a.number === '' ? 999 : +a.number) - (b.number === '' ? 999 : +b.number));
    const per = (v) => (r.p ? (v / r.p).toFixed(1) : '–');
    return `<a class="back" href="#${hashFor('standings')}">← Standings</a>
      <div class="hero-team">${logo(id)}<div><h2>${esc(name(id))}</h2><p>${S.divisions[where.div].label} · Pool ${esc(where.pool)} · ${ord(r.rank)} place</p></div></div>
      <div class="tiles"><div class="tile"><b>${r.w}–${r.l}</b><small>Record</small></div><div class="tile"><b>${r.pd > 0 ? '+' : ''}${r.pd}</b><small>Pt diff</small></div><div class="tile"><b>${per(r.pf)}</b><small>Scored/gm</small></div><div class="tile"><b>${per(r.pa)}</b><small>Allowed/gm</small></div></div>
      ${rc ? `<div class="status-line"><span class="pill ${rc.status}">${PILL[rc.status]}</span><span>${esc(rc.note)}</span></div>` : ''}
      ${next ? `<section class="blk"><div class="blk-head"><h2 class="blk-title">Next game</h2><span class="blk-sub">${fmtDay(next.date)}</span></div><div class="games">${gameRow(next)}</div></section>` : ''}
      <section class="blk"><div class="blk-head"><h2 class="blk-title">Schedule & results</h2></div><div class="games">${games.map(gameRow).join('')}</div>
        ${poolDone(where.div) ? '' : '<p class="tiebreak">Playoff Day games are added once seeds are set after Week 3.</p>'}</section>
      <section class="blk"><div class="blk-head"><h2 class="blk-title">Roster</h2><span class="blk-sub">${roster.length} players</span></div>
        ${roster.length ? `<div class="roster">${roster.map((p) => `<div class="pl"><span class="no">${esc(p.number)}</span><span class="nm"><b>${esc(p.nickname || p.full_name)}</b>${p.nickname ? `<small>${esc(p.full_name)}</small>` : ''}</span><span class="pos">${esc(p.position || '')}</span></div>`).join('')}</div>` : '<p class="empty-note">Roster coming soon.</p>'}</section>`;
  }

  function viewMatch(gid) {
    const x = S.games.find((g) => g.id === gid);
    if (!x) return '<p class="empty-note">Game not found.</p>';
    div = x.division;
    const done = played(x);
    const h = side(x, 'home'), a = side(x, 'away');
    const tbl = x.stage === 'pool' ? Object.fromEntries(table(x.division, x.pool).map((r) => [r.id, r])) : {};
    const allRows = Object.fromEntries(Object.keys(pools(x.division)).flatMap((p) => table(x.division, p)).map((r) => [r.id, r]));
    const rec = (id) => (allRows[id] ? `${allRows[id].w}–${allRows[id].l} · ${ord(allRows[id].rank)} in Pool ${allRows[id].pool}` : '');
    const sideHtml = (id, slot) => id
      ? `<a class="board-team" href="#team-${esc(id)}">${logo(id)}<b>${esc(name(id))}</b><small>${rec(id)}</small></a>`
      : `<div class="board-team">${logo(null)}<b>${esc(slotText(slot))}</b><small>To be decided</small></div>`;
    const hl = done && x.homeScore < x.awayScore, al = done && x.awayScore < x.homeScore;
    let html = `<a class="back" href="#${hashFor('games')}">← Games</a>
      <p class="match-meta">${x.stage === 'pool' ? `Pool ${esc(x.pool)} · Week ${x.week}` : `${esc(x.id)} · ${esc(x.round)}${x.decides ? ' · decides ' + esc(x.decides) : ''}`} · ${fmtDay(x.date)} · ${esc(x.time)} · ${esc(x.field)}${x.field === S.livestream ? ' · <span class="live">● Livestream</span>' : ''}</p>
      <div class="board">${sideHtml(h, x.homeSlot)}<div class="board-score ${done ? '' : 'kick'}">${done ? `<span class="${hl ? 'lose' : ''}">${x.homeScore}</span>–<span class="${al ? 'lose' : ''}">${x.awayScore}</span><small>FINAL</small>` : `${esc(x.time)}<small>KICKOFF</small>`}</div>${sideHtml(a, x.awaySlot)}</div>`;
    if (done) html += `<section class="blk"><div class="blk-head"><h2 class="blk-title">Match notes</h2></div>${x.recap ? `<div class="recap">${esc(x.recap)}</div>` : '<div class="recap empty">No write-up for this game yet.</div>'}</section>`;
    const A = allRows[h], B = allRows[a];
    if (A && B && (A.p || B.p)) {
      const stat = (label, va, vb, fmt = (v) => v) => {
        const m = Math.max(Math.abs(va), Math.abs(vb)) || 1;
        return `<div class="cmp-row"><span>${fmt(va)}</span><div class="cmp-mid"><small>${label}</small><div class="bars"><i><b style="width:${Math.max(0, va) / m * 100}%"></b></i><i><b style="width:${Math.max(0, vb) / m * 100}%"></b></i></div></div><span>${fmt(vb)}</span></div>`;
      };
      const pg = (r, v) => (r.p ? v / r.p : 0);
      html += `<section class="blk"><div class="blk-head"><h2 class="blk-title">Season so far</h2><span class="blk-sub">Pool games</span></div><div class="cmp">
        ${stat('Wins', A.w, B.w)}${stat('Points scored / game', pg(A, A.pf), pg(B, B.pf), (v) => v.toFixed(1))}${stat('Points allowed / game', pg(A, A.pa), pg(B, B.pa), (v) => v.toFixed(1))}${stat('Point difference', A.pd, B.pd, (v) => (v > 0 ? '+' : '') + Math.round(v))}</div></section>`;
    }
    if (!done && x.stage === 'pool') {
      const rc = race(x.division, x.pool);
      if (rc) html += `<section class="blk"><div class="blk-head"><h2 class="blk-title">What's at stake</h2></div><ul class="stake">${[h, a].map((id) => `<li><b>${esc(name(id))}:</b> ${esc(rc.teams[id].note)}</li>`).join('')}</ul></section>`;
    }
    return html;
  }

  // ─── Routing ─────────────────────────────────────────
  // #standings, #standings-women, #team-orcas, #match-MQF1
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
    document.querySelectorAll('#tabs a').forEach((a) => { a.href = '#' + hashFor(a.dataset.view); if (a.dataset.view === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    $('divMen').setAttribute('aria-pressed', String(div === 'men'));
    $('divWomen').setAttribute('aria-pressed', String(div === 'women'));
    $('teamFilter')?.addEventListener('change', (e) => { teamFilter = e.target.value; route(); });
    document.querySelectorAll('.st tbody tr[data-team]').forEach((tr) => tr.addEventListener('click', (e) => { if (!e.target.closest('a')) location.hash = 'team-' + tr.dataset.team; }));
  }
  function currentView() { const a = document.querySelector('#tabs a[aria-current="page"]'); return a ? a.dataset.view : 'overview'; }
  document.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => {
    div = b.dataset.div; teamFilter = '';
    const hh = hashFor(currentView());
    if (location.hash.slice(1) === hh) route(); else location.hash = hh;
  }));
  window.addEventListener('hashchange', () => { route(); const bar = document.querySelector('.szn-bar'); if (bar && window.scrollY > bar.offsetTop) window.scrollTo({ top: bar.offsetTop - 1 }); });
  function setNavHeight() { const n = document.querySelector('.nav'); if (n) document.documentElement.style.setProperty('--nav-h', n.offsetHeight + 'px'); }
  window.addEventListener('resize', setNavHeight);

  // ─── Boot ────────────────────────────────────────────
  setNavHeight();
  fetch(P.season, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((data) => {
    S = data;
    const pg = S.games.filter((x) => x.stage === 'pool');
    const weeks = new Set(pg.map((x) => x.week));
    const doneWeeks = [...weeks].filter((w) => pg.filter((x) => x.week === w).every(played)).length;
    const upd = new Date(S.updated).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
    $('sznMeta').innerHTML = `<span><b>Week ${doneWeeks}</b> of ${weeks.size} played</span><span>Playoff Day: Sat 5 Dec</span><span>${esc(S.venue)}</span><span>Updated ${esc(upd)} WIB</span>`;
    if (S.sample) $('sampleNote').innerHTML = '<p class="sample-note">Pools and schedule are real. Scores for Weeks 1–2 are made up until the Reclub results are connected.</p>';
    route();
  }).catch(() => { $('view').innerHTML = '<p class="empty-note">Season data could not be loaded. Refresh to try again.</p>'; });
})();
