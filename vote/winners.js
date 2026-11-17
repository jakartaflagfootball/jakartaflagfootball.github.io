// JFF People's Choice — winners page for designers (full-quality photo downloads)
(function () {
  const { api, CATEGORIES, CATEGORY_LABEL, teams, players, esc } = JFF;
  const $ = (id) => document.getElementById(id);
  const S = { weeks: [], week: null, top: 3, board: [], photos: {}, list: [] };
  const ORD = ['', '1st', '2nd', '3rd', '4th', '5th'];
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const ended = (w) => w.closed || Date.now() > +new Date(w.ends_at);
  const fileName = (r) => {
    const p = players[r.player_id];
    return [slug(S.week.label.split(/[—-]/)[0]), slug(CATEGORY_LABEL[r.category]), ORD[r.rank] || r.rank + 'th', slug(p.nickname || p.full_name), p.number].filter(Boolean).join('-') + '.jpg';
  };
  const details = (r) => {
    const p = players[r.player_id];
    return `${CATEGORY_LABEL[r.category]} · ${ORD[r.rank] || r.rank} · ${p.nickname || p.full_name} #${p.number} (${p.full_name}) · ${p.position || 'Position TBA'} · ${teams[p.team].name} · ${r.votes} vote${r.votes === 1 ? '' : 's'}`;
  };

  // Top N per category, with tied players sharing a rank.
  function ranked() {
    const out = [];
    for (const c of CATEGORIES) {
      const rows = S.board.filter((r) => r.category === c && players[r.player_id]).sort((a, b) => b.votes - a.votes);
      let rank = 0, prev = null;
      rows.forEach((r, i) => { if (r.votes !== prev) { rank = i + 1; prev = r.votes; } if (rank <= S.top) out.push({ ...r, rank }); });
    }
    return out;
  }

  function render() {
    $('weekSelect').innerHTML = S.weeks.map((w) => `<option value="${w.id}" ${w === S.week ? 'selected' : ''}>${esc(w.label)}</option>`).join('');
    if (!S.week) { $('winners').innerHTML = '<p class="lb-empty">No weeks yet.</p>'; return; }
    $('liveNote').innerHTML = ended(S.week) ? ''
      : `<div class="nom-note warn">Voting for ${esc(S.week.label)} is still open until ${JFF.fmtDate(S.week.ends_at)}. These are live standings, not final results.</div>`;
    S.list = ranked();
    const withPhoto = S.list.filter((r) => S.photos[r.player_id]).length;
    $('zipBtn').disabled = !withPhoto;
    $('zipBtn').textContent = withPhoto ? `Download all ${withPhoto} photo${withPhoto === 1 ? '' : 's'} (.zip)` : 'No photos to download';
    $('winners').innerHTML = CATEGORIES.map((c) => {
      const rows = S.list.filter((r) => r.category === c);
      return `<section class="win-cat" data-side="${c.split('_')[1]}">
        <div class="section-header"><h2>${esc(CATEGORY_LABEL[c])}</h2><small>${rows.length ? '' : 'No votes'}</small></div>
        <div class="win-list">${rows.map((r) => {
          const p = players[r.player_id], path = S.photos[r.player_id];
          return `<article class="win-card">
            <div class="win-photo">${path ? `<img src="${esc(api.photoUrl(path))}" alt="${esc(p.nickname || p.full_name)}" loading="lazy">` : '<span>No photo</span>'}<b class="win-rank">${ORD[r.rank] || r.rank}</b></div>
            <div class="win-info">
              <div class="pc-nick">${esc(p.nickname || p.full_name)} <span class="win-num">#${esc(p.number)}</span></div>
              <div class="pc-full">${esc(p.full_name)}</div>
              <div class="pc-full">${esc(p.position || 'Position TBA')} · ${esc(teams[p.team].name)}</div>
              <div class="win-votes">${r.votes} vote${r.votes === 1 ? '' : 's'}</div>
              <div class="win-btns">
                ${path ? `<button class="btn-primary btn-sm" data-dl="${esc(r.category + '|' + r.player_id)}" type="button">Download photo</button>` : ''}
                <button class="btn-secondary btn-sm" data-copy="${esc(r.category + '|' + r.player_id)}" type="button">Copy details</button>
              </div>
            </div>
          </article>`;
        }).join('')}</div></section>`;
    }).join('');
  }

  async function loadWeek() {
    $('winners').innerHTML = '<p class="lb-empty">Loading…</p>';
    const [board, noms] = await Promise.all([api.leaderboard(S.week.id), api.listNominations(S.week.id).catch(() => [])]);
    S.board = board;
    S.photos = Object.fromEntries(noms.filter((n) => n.photo_path).map((n) => [n.player_id, n.photo_path]));
    render();
  }

  const find = (key) => { const [category, pid] = key.split('|'); return S.list.find((r) => r.category === category && r.player_id === pid); };
  const save = (href, name) => { const a = document.createElement('a'); a.href = href; if (name) a.download = name; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); };

  async function downloadOne(btn, r) {
    btn.disabled = true; const label = btn.textContent; btn.textContent = 'Preparing…';
    try { save(await api.fullPhotoUrl(S.photos[r.player_id], fileName(r)), fileName(r)); }
    catch (e) { console.error(e); JFF.toast(e.message || 'Download failed', 'error'); }
    finally { btn.disabled = false; btn.textContent = label; }
  }

  const loadZip = () => window.JSZip ? Promise.resolve() : new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    s.onload = res; s.onerror = () => rej(new Error('Could not load the zip tool. Check your connection.'));
    document.head.appendChild(s);
  });

  async function downloadAll(btn) {
    const rows = S.list.filter((r) => S.photos[r.player_id]);
    btn.disabled = true;
    try {
      await loadZip();
      const zip = new JSZip();
      let i = 0;
      for (const r of rows) {
        btn.textContent = `Adding ${++i} of ${rows.length}…`;
        const res = await fetch(await api.fullPhotoUrl(S.photos[r.player_id]));
        if (!res.ok) throw new Error(`Could not get the photo of ${players[r.player_id].nickname || players[r.player_id].full_name}`);
        zip.file(fileName(r), await res.blob());
      }
      zip.file('details.txt', S.list.map(details).join('\n') + '\n');
      btn.textContent = 'Zipping…';
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      save(url, `jff-potw-${slug(S.week.label)}-photos.zip`);
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) { console.error(e); JFF.toast(e.message || 'Download failed', 'error'); }
    finally { btn.disabled = false; render(); }
  }

  document.addEventListener('click', async (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.dl) downloadOne(t, find(t.dataset.dl));
    else if (t.dataset.copy) {
      const text = details(find(t.dataset.copy));
      try { await navigator.clipboard.writeText(text); JFF.toast('Copied'); } catch { prompt('Copy this:', text); }
    }
    else if (t.id === 'zipBtn') downloadAll(t);
    else if (t.hasAttribute('data-signin')) api.signIn();
    else if (t.id === 'signOutW') api.signOut();
  });
  $('weekSelect').addEventListener('change', (e) => { S.week = S.weeks.find((w) => String(w.id) === e.target.value); loadWeek(); });
  $('topSelect').addEventListener('change', (e) => { S.top = +e.target.value; render(); });

  let gated = null;
  async function gate(user) {
    if ((user?.id || null) === gated) return;
    gated = user?.id || null;
    $('seasonLabel').textContent = window.JFF_CONFIG.SEASON;
    $('demoBanner').innerHTML = api.demo ? '<div class="demo-banner"><span>⚠ <b>Demo mode.</b> Any signed-in demo user counts as a designer.</span></div>' : '';
    $('body').style.display = 'none';
    if (!user) {
      $('gate').innerHTML = '<div class="auth-bar"><p><b>Designers and admins only.</b> Sign in with the Google account JFF added as a designer.</p><div class="signin-slot" id="winSignin"></div></div>';
      api.mountSignIn($('winSignin'));
      return;
    }
    let ok = false;
    try { ok = await api.isMedia(); } catch (e) { console.error(e); }
    if (!ok) {
      $('gate').innerHTML = `<div class="auth-bar"><p><b>${esc(user.email)}</b> isn't on JFF's designer list. Ask a JFF admin to add this email.</p><button class="btn-link" id="signOutW">Sign out</button></div>`;
      return;
    }
    $('gate').innerHTML = `<div class="auth-bar" style="margin-bottom:1.5rem"><p>Signed in as <b>${esc(user.email)}</b></p><button class="btn-link" id="signOutW">Sign out</button></div>`;
    $('body').style.display = 'block';
    S.weeks = await api.listWeeks();
    S.week = S.weeks.find((w) => +new Date(w.starts_at) <= Date.now()) || S.weeks[0] || null;
    if (S.week) await loadWeek(); else render();
  }

  api.onAuthChange(gate);
  api.getUser().then(gate);
})();
