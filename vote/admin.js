// JFF Player of the Week — admin page
(function () {
  const { api, CATEGORIES, CATEGORY_LABEL, teams, players, esc } = JFF;
  const $ = (id) => document.getElementById(id);

  // datetime-local values are treated as Jakarta time (UTC+7, no daylight saving).
  const fromWib = (v) => new Date(v + ':00+07:00').toISOString();
  const toWib = (d) => new Date(+new Date(d) + 7 * 3600e3).toISOString().slice(0, 16);

  function status(w) {
    if (w.closed) return ['Closed early', ''];
    const now = Date.now();
    if (now < +new Date(w.starts_at)) return ['Scheduled', ''];
    if (now > +new Date(w.ends_at)) return ['Finished', ''];
    return ['Voting open', 'open'];
  }

  async function render() {
    const weeks = await api.listWeeks();
    $('weekCount').textContent = `${weeks.length} total`;
    const boards = await Promise.all(weeks.map((w) => api.leaderboard(w.id)));
    const voters = await Promise.all(weeks.map((w) => api.voterCount(w.id)));
    const noms = await Promise.all(weeks.map((w) => (w.nominations ? api.listNominations(w.id).catch(() => []) : [])));
    $('weeks').innerHTML = weeks.map((w, i) => {
      const [label, cls] = status(w);
      const res = CATEGORIES.map((c) => {
        const rows = boards[i].filter((r) => r.category === c && players[r.player_id]).slice(0, 5);
        return `<div><h4>${esc(CATEGORY_LABEL[c])}</h4><ol>${rows.length ? rows.map((r) => {
          const p = players[r.player_id];
          return `<li><span>${esc(p.nickname || p.full_name)} #${esc(p.number)} · ${esc(teams[p.team].name)}</span><span>${r.votes}</span></li>`;
        }).join('') : '<li style="color:#555;font-weight:400">No votes</li>'}</ol></div>`;
      }).join('');
      return `<div class="week-row">
        <div class="week-row-head">
          <div><b>${esc(w.label)}</b> <span class="status-pill ${cls}" style="margin-left:.4rem">${label}</span>
            <small>${JFF.fmtDate(w.starts_at)} → ${JFF.fmtDate(w.ends_at)} · ${voters[i]} voters</small></div>
          <div class="week-row-btns">
            ${w.closed ? `<button class="btn-secondary btn-sm" data-reopen="${w.id}">Reopen</button>` : `<button class="btn-secondary btn-sm" data-close="${w.id}">Close now</button>`}
            <button class="btn-secondary btn-sm" data-extend="${w.id}">+1 day</button>
            <button class="btn-secondary btn-sm" data-csv="${w.id}">Export CSV</button>
            <button class="btn-secondary btn-sm" data-clear="${w.id}" data-label="${esc(w.label)}">Clear votes</button>
            <button class="btn-link" data-delete="${w.id}" style="color:#a44">Delete</button>
          </div>
        </div>
        ${w.nominations ? nomSummary(noms[i]) : ''}
        <div class="week-results">${res}</div>
      </div>`;
    }).join('') || '<p class="lb-empty">No weeks yet. Create the first one above.</p>';
  }

  function nomSummary(rows) {
    const byTeam = new Map();
    for (const r of rows) { if (!players[r.player_id]) continue; if (!byTeam.has(r.team_id)) byTeam.set(r.team_id, []); byTeam.get(r.team_id).push(players[r.player_id]); }
    const all = window.JFF_TEAMS;
    const missing = all.filter((t) => !byTeam.has(t.id));
    const done = all.filter((t) => byTeam.has(t.id))
      .map((t) => `${esc(t.name)}: ${byTeam.get(t.id).map((p) => esc((p.nickname || p.full_name) + ' #' + p.number)).join(', ')}`);
    return `<div class="nom-summary"><b>Captain nominations: ${byTeam.size} of ${all.length} teams submitted.</b>
      ${missing.length ? `<br>⏳ Waiting: ${missing.map((t) => esc(t.name)).join(', ')}` : ''}
      ${done.length ? `<br>✓ ${done.join(' · ')}` : ''}
      <br><a href="captain.html" style="color:var(--gold)">Nominate for a team →</a></div>`;
  }

  async function renderCaptains() {
    let rows;
    try { rows = await api.listCaptains(); }
    catch (e) { $('captains').innerHTML = '<p class="lb-empty">Run supabase/nominations.sql in Supabase to turn on captains.</p>'; return; }
    $('captainCount').textContent = `${rows.length} emails · ${new Set(rows.map((r) => r.team_id)).size} of ${window.JFF_TEAMS.length} teams`;
    const sorted = [...window.JFF_TEAMS].sort((a, b) => a.division.localeCompare(b.division) || a.name.localeCompare(b.name));
    $('captainTeam').innerHTML = sorted.map((t) => `<option value="${t.id}">${esc(t.name)} (${t.division === 'men' ? "Men's" : "Women's"})</option>`).join('');
    $('captains').innerHTML = sorted.map((t) => {
      const mine = rows.filter((r) => r.team_id === t.id);
      return `<div class="captain-row"><span><b>${esc(t.name)}</b>${mine.length ? '' : '<span style="color:#555">No captain yet</span>'}</span></div>`
        + mine.map((r) => `<div class="captain-row" style="margin-left:1rem"><span>${esc(r.email)}</span><button class="btn-link" data-uncaptain="${esc(r.team_id)}" data-email="${esc(r.email)}" style="color:#a44">Remove</button></div>`).join('');
    }).join('');
  }

  async function exportCsv(id) {
    const w = (await api.listWeeks()).find((x) => x.id === id);
    const rows = await api.leaderboard(id);
    const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const lines = [['week', 'category', 'rank', 'votes', 'nickname', 'full_name', 'number', 'position', 'team'].join(',')];
    for (const c of CATEGORIES) {
      rows.filter((r) => r.category === c && players[r.player_id]).forEach((r, i) => {
        const p = players[r.player_id];
        lines.push([q(w.label), q(CATEGORY_LABEL[c]), i + 1, r.votes, q(p.nickname), q(p.full_name), q(p.number), q(p.position), q(teams[p.team].name)].join(','));
      });
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = `jff-potw-${w.label.replace(/[^\w]+/g, '-').toLowerCase()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  document.addEventListener('click', async (e) => {
    const t = e.target.closest('button'); if (!t) return;
    const d = t.dataset;
    try {
      if (d.close) await api.updateWeek(+d.close, { closed: true });
      else if (d.reopen) await api.updateWeek(+d.reopen, { closed: false });
      else if (d.extend) { const w = (await api.listWeeks()).find((x) => x.id === +d.extend); await api.updateWeek(w.id, { ends_at: new Date(+new Date(w.ends_at) + 864e5).toISOString() }); }
      else if (d.csv) return exportCsv(+d.csv);
      else if (d.uncaptain) { if (!confirm(`Remove ${d.email} as captain of ${teams[d.uncaptain].name}?`)) return; await api.removeCaptain(d.uncaptain, d.email); JFF.toast('Captain removed'); return renderCaptains(); }
      else if (d.clear) {
        if (!confirm(`Remove ALL votes in "${d.label}"? The week stays open, and everyone (including you) can vote again. This cannot be undone.`)) return;
        const n = await api.clearVotes(+d.clear);
        if (n === 0) { JFF.toast('No votes were removed. If there were votes, run the admin-delete SQL in Supabase first.', 'error'); return render(); }
        JFF.toast(`Removed ${n} vote${n === 1 ? '' : 's'}`); return render();
      }
      else if (d.delete) { if (!confirm('Delete this week and ALL its votes? This cannot be undone.')) return; await api.deleteWeek(+d.delete); }
      else if (t.hasAttribute('data-signin')) return api.signIn();
      else if (t.id === 'signOutA') return api.signOut();
      else return;
      JFF.toast('Saved'); render();
    } catch (err) { JFF.toast(err.message, 'error'); }
  });

  $('newWeek').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const starts_at = fromWib(f.get('starts')), ends_at = fromWib(f.get('ends'));
    if (new Date(ends_at) <= new Date(starts_at)) return JFF.toast('Close time must be after open time', 'error');
    try { await api.createWeek({ label: f.get('label').trim(), starts_at, ends_at, nominations: f.get('nominations') === 'on' }); e.target.reset(); setDefaults(); JFF.toast('Week created'); render(); }
    catch (err) { JFF.toast(err.message, 'error'); }
  });

  $('newCaptain').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const team = f.get('team'), email = String(f.get('email')).trim().toLowerCase();
    try {
      const existing = (await api.listCaptains()).filter((r) => r.team_id === team);
      if (existing.some((r) => r.email === email)) return JFF.toast('Already a captain of this team');
      if (existing.length >= 2 && !confirm(`${teams[team].name} already has ${existing.length} captains. Add ${email} as another one?`)) return;
      await api.addCaptain(team, email);
      e.target.email.value = ''; JFF.toast(`Added ${email} to ${teams[team].name}`); renderCaptains();
    } catch (err) { JFF.toast(err.message, 'error'); }
  });
  $('newWeek').nominations.addEventListener('change', (e) => {
    $('startsLabel').textContent = e.target.checked ? 'Voting opens · nominations close (WIB)' : 'Opens (WIB)';
  });

  function setDefaults() {
    const f = $('newWeek');
    const now = new Date(); now.setMinutes(0, 0, 0);
    f.starts.value = toWib(now);
    f.ends.value = toWib(+now + 5 * 864e5);
  }

  async function gate(user) {
    $('demoBanner').innerHTML = api.demo ? '<div class="demo-banner"><span>⚠ <b>Demo mode.</b> Any signed-in demo user is an admin. Changes stay in this browser.</span></div>' : '';
    if (!user) {
      $('adminBody').style.display = 'none';
      $('gate').innerHTML = '<div class="auth-bar"><p><b>Admins only.</b> Sign in with the Google account listed in the admins table.</p><div class="signin-slot" id="adminSignin"></div></div>';
      api.mountSignIn($('adminSignin'));
      return;
    }
    if (!(await api.isAdmin())) {
      $('adminBody').style.display = 'none';
      $('gate').innerHTML = `<div class="auth-bar"><p><b>${esc(user.email)}</b> is not an admin. Ask a JFF admin to add your email.</p><button class="btn-link" id="signOutA">Sign out</button></div>`;
      return;
    }
    $('gate').innerHTML = `<div class="auth-bar" style="margin-bottom:1.5rem"><p>Signed in as <b>${esc(user.email)}</b></p><button class="btn-link" id="signOutA">Sign out</button></div>`;
    $('adminBody').style.display = 'block';
    setDefaults(); render(); renderCaptains();
  }

  api.onAuthChange(gate);
  api.getUser().then(gate);
})();
