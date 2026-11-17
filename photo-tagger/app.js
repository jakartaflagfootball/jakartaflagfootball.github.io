// JFF Photo Room: tagged, scored match photos for JFF designers and admins.
// Data comes from jff-photo-tagger/run.py (on the media Mac), which uploads results.json.gz and face
// pictures to the private Supabase bucket "photo-tagger". Shortlist, names and face fixes are shared
// tables (see jff-photo-tagger/supabase/photo-tagger.sql); access is limited by potw_is_media()
// to JFF admins and the designer list on /vote/admin.html.
//
// Demo mode (no Supabase): open with ?demo=http://localhost:3010 while jff-photo-tagger/serve.py runs.
(function () {
  const BUCKET = 'photo-tagger';
  const PAGE = 120, PEOPLE_SHOWN = 40, REFRESH_MS = 30000;
  const KEYS = [['overall', 'Overall'], ['clarity', 'Clarity'], ['action', 'Action'], ['framing', 'Framing'], ['moment', 'Moment'], ['look', 'Look']];
  const LABEL = Object.fromEntries(KEYS);
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const color = (v) => (v >= 70 ? 'var(--ok)' : v >= 40 ? 'var(--gold)' : 'var(--hard)');
  const driveImg = (id, w) => `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${w}`;
  const driveDownload = (id) => `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download`;

  function toast(msg, kind) {
    const t = $('#toast');
    t.textContent = msg; t.className = 'toast show' + (kind ? ' ' + kind : '');
    clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = 'toast'), 2600);
  }

  async function gunzipJson(blob) {
    const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
    if (head[0] !== 0x1f || head[1] !== 0x8b) return JSON.parse(await blob.text()); // already decompressed
    const text = await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).text();
    return JSON.parse(text);
  }

  // ─── BACKENDS ───────────────────────────────────────────
  function onlineBackend() {
    const cfg = window.JFF_CONFIG;
    const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: JFFAuth.options() });
    const ok = ({ data, error }) => { if (error) throw error; return data; };
    const faceCache = {};
    let user = null;
    const toUser = (u) => u && { id: u.id, email: u.email };
    const now = () => new Date().toISOString();
    return {
      demo: false,
      async getUser() { const { data } = await sb.auth.getSession(); return (user = toUser(data.session?.user)); },
      onAuthChange(cb) { sb.auth.onAuthStateChange((_e, s) => cb((user = toUser(s?.user)))); },
      mountSignIn(el) {
        return JFFAuth.mountSignIn(el, {
          sb, clientId: cfg.GOOGLE_CLIENT_ID,
          fallback: (slot) => {
            slot.innerHTML = '<button class="btn primary" type="button">Sign in with Google</button>';
            slot.firstChild.onclick = () => sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href } });
          },
          onError: (e) => toast(e?.message || String(e), 'error'),
        });
      },
      async signOut() { JFFAuth.signOutGoogle(); await sb.auth.signOut(); },
      async allowed() { return !!ok(await sb.rpc('potw_is_media')); },
      async results() { return gunzipJson(ok(await sb.storage.from(BUCKET).download('results.json.gz'))); },
      async faceUrls(paths) {
        const need = [...new Set(paths)].filter((p) => p && !faceCache[p]);
        if (need.length) {
          const rows = ok(await sb.storage.from(BUCKET).createSignedUrls(need, 6 * 3600));
          rows.forEach((r) => { if (r.signedUrl) faceCache[r.path] = r.signedUrl; });
        }
        return faceCache;
      },
      async shortlist() { return ok(await sb.from('pt_shortlist').select('photo_id,added_by,added_at')); },
      async star(id, on) {
        if (on) ok(await sb.from('pt_shortlist').upsert({ photo_id: id, added_by: user.email, added_at: now() }));
        else ok(await sb.from('pt_shortlist').delete().eq('photo_id', id));
      },
      async names() { return ok(await sb.from('pt_names').select('group_id,name')); },
      async setName(gid, name) { ok(await sb.from('pt_names').upsert({ group_id: gid, name, updated_by: user.email, updated_at: now() })); },
      async fixes() { return ok(await sb.from('pt_face_fixes').select('photo_id,face_idx,group_id')); },
      async setFix(photoId, idx, gid) {
        ok(await sb.from('pt_face_fixes').upsert({ photo_id: photoId, face_idx: idx, group_id: gid, updated_by: user.email, updated_at: now() }));
      },
    };
  }

  // Local preview against jff-photo-tagger/serve.py; edits are kept in this browser only.
  function demoBackend(base) {
    const load = (k, d) => { try { return JSON.parse(localStorage.getItem('pt-demo-' + k)) ?? d; } catch { return d; } };
    const save = (k, v) => { try { localStorage.setItem('pt-demo-' + k, JSON.stringify(v)); } catch {} };
    const user = { id: 'demo', email: 'demo@localhost' };
    return {
      demo: true,
      async getUser() { return user; },
      onAuthChange() {},
      mountSignIn() {},
      async signOut() { toast('Demo mode has no sign-in'); },
      async allowed() { return true; },
      async results() { const r = await fetch(base + '/data/results.json', { cache: 'no-store' }); if (!r.ok) throw new Error('Start jff-photo-tagger/serve.py first'); return r.json(); },
      async faceUrls(paths) { return Object.fromEntries(paths.map((p) => [p, base + '/data/' + p])); },
      async shortlist() { return load('shortlist', []); },
      async star(id, on) {
        const l = load('shortlist', []).filter((r) => r.photo_id !== id);
        if (on) l.push({ photo_id: id, added_by: user.email, added_at: new Date().toISOString() });
        save('shortlist', l);
      },
      async names() { return Object.entries(load('names', {})).map(([group_id, name]) => ({ group_id: +group_id, name })); },
      async setName(gid, name) { const n = load('names', {}); n[gid] = name; save('names', n); },
      async fixes() { return load('fixes', []); },
      async setFix(photo_id, face_idx, group_id) {
        const l = load('fixes', []).filter((r) => !(r.photo_id === photo_id && r.face_idx === face_idx));
        l.push({ photo_id, face_idx, group_id }); save('fixes', l);
      },
    };
  }

  const demoBase = new URLSearchParams(location.search).get('demo');
  const api = demoBase ? demoBackend(demoBase.replace(/\/$/, '')) : onlineBackend();

  // ─── STATE ──────────────────────────────────────────────
  const S = {
    data: null, byId: {}, num: {}, photoById: {}, faces: {}, star: {},
    sort: 'overall', bestOnly: true, starOnly: false, person: null, game: '', allPeople: false,
    list: [], shown: 0, idx: -1, fixing: null, user: null,
  };

  // ─── ROSTER (vote/roster.js) ────────────────────────────
  const TEAMS = Object.fromEntries((window.JFF_TEAMS || []).map((t) => [t.id, t]));
  const PLAYERS = Object.fromEntries((window.JFF_PLAYERS || []).map((p) => [p.id, p]));
  const nick = (p) => (p.nickname || p.full_name.split(' ')[0]).trim();
  const nickCount = {};
  Object.values(PLAYERS).forEach((p) => { const k = nick(p).toLowerCase(); nickCount[k] = (nickCount[k] || 0) + 1; });
  // name used for a face group: the nickname, plus the number when two players share a nickname
  const rosterName = (p) => (nickCount[nick(p).toLowerCase()] > 1 ? `${nick(p)} #${p.number}` : nick(p));
  const BY_NAME = Object.fromEntries(Object.values(PLAYERS).map((p) => [rosterName(p).toLowerCase(), p]));
  const teamName = (id) => TEAMS[id]?.name || id;
  const byNumber = (a, b) => (a.number === '' ? 999 : +a.number) - (b.number === '' ? 999 : +b.number);
  const teamPlayers = (tid) => Object.values(PLAYERS).filter((p) => p.team === tid).sort(byNumber);

  const personLabel = (id) => { const p = S.byId[id]; return p && p.name ? p.name : p ? `Person ${S.num[id]}` : 'Unknown'; };
  const personKey = (id) => { const p = S.byId[id]; return p && p.name ? 'n:' + p.name.toLowerCase() : 'g:' + id; };
  const topOf = (f) => f.split('/')[0];
  const shortGame = (f) => f.split('/').slice(1).join(' › ') || f;
  function inGame(p) {
    if (!S.game) return true;
    if (S.game.startsWith('top:')) return topOf(p.folder) === S.game.slice(4);
    return p.folder === S.game.slice(2);
  }
  const recomputePeople = (p) => { p.people = [...new Set(p.faces.map((f) => f.person).filter((g) => g != null))]; };

  // ─── GATE ───────────────────────────────────────────────
  async function boot() {
    if (api.demo) $('#sub').innerHTML = `<span class="demo">Demo mode: data from ${esc(demoBase)}, edits stay in this browser</span>`;
    S.user = await api.getUser();
    if (!S.user) {
      $('#gate').innerHTML = `<h2>Sign in</h2><p>Match photos, face tags and the shared shortlist are for JFF designers and admins. Sign in with the Google account JFF added as a designer.</p><div class="slot" id="signin"></div>`;
      api.mountSignIn($('#signin'));
      api.onAuthChange((u) => { if (u && !S.user) { S.user = u; boot(); } });
      return;
    }
    let allowed = false;
    try { allowed = await api.allowed(); } catch (e) { console.error(e); }
    if (!allowed) {
      $('#gate').innerHTML = `<h2>No access</h2><p><b>${esc(S.user.email)}</b> isn't on JFF's designer list. Ask a JFF admin to add this email on the vote admin page.</p><button class="btn" id="out">Sign out</button>`;
      $('#out').onclick = async () => { await api.signOut(); location.reload(); };
      return;
    }
    $('#gate').innerHTML = '<h2>Loading photos…</h2>';
    try {
      const [data, names, fixes, star] = await Promise.all([api.results(), api.names(), api.fixes(), api.shortlist()]);
      S.data = data;
      prepare(names, fixes);
      setShortlist(star);
    } catch (e) {
      console.error(e);
      $('#gate').innerHTML = `<h2>Couldn't load photos</h2><p>${esc(e.message || e)}</p><p>If nothing has been uploaded yet, run <span class="mono">run.py</span> on the media Mac.</p>`;
      return;
    }
    $('#gate').hidden = true; $('#app').hidden = false;
    if (!api.demo) $('#sub').innerHTML = `Signed in as <b>${esc(S.user.email)}</b> <button class="btn" id="signOut">Sign out</button>`;
    $('#signOut')?.addEventListener('click', async () => { await api.signOut(); location.reload(); });
    renderAll();
    setInterval(refresh, REFRESH_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  }

  function prepare(names, fixes) {
    const d = S.data;
    S.byId = Object.fromEntries(d.people.map((p) => [p.id, p]));
    S.num = Object.fromEntries(d.people.map((p, n) => [p.id, n + 1]));
    names.forEach((r) => { if (S.byId[r.group_id]) S.byId[r.group_id].name = r.name; });
    S.photoById = Object.fromEntries(d.photos.map((p) => [p.id, p]));
    fixes.forEach((r) => {
      const p = S.photoById[r.photo_id], f = p?.faces[r.face_idx];
      if (!f || (r.group_id != null && !S.byId[r.group_id])) return;
      f.person = r.group_id; f.fixed = true; recomputePeople(p);
    });
  }

  function setShortlist(rows) { S.star = Object.fromEntries(rows.map((r) => [r.photo_id, r])); }

  async function refresh() {
    if (document.hidden || !S.data) return;
    try {
      setShortlist(await api.shortlist());
      $('#starOnly').textContent = `★ Shortlist (${Object.keys(S.star).length})`;
      document.querySelectorAll('.card').forEach((c) => {
        const on = !!S.star[c.dataset.id];
        c.classList.toggle('starred', on); c.querySelector('.star').setAttribute('aria-pressed', on);
      });
    } catch (e) { console.warn(e); }
  }

  // ─── RENDER ─────────────────────────────────────────────
  function renderAll() { renderHeader(); renderGames(); renderSort(); renderPeople(); renderGrid(); }

  function renderHeader() {
    const d = S.data;
    const bursts = new Set(d.photos.map((p) => p.burst)).size;
    const named = new Set(d.people.filter((p) => p.name).map((p) => p.name.toLowerCase())).size;
    $('#stats').innerHTML = [[d.photos.length, 'Photos'], [bursts, 'Moments'], [named, 'Named'], [Object.keys(S.star).length, 'Shortlisted']]
      .map(([n, l]) => `<div class="stat"><b>${n}</b><small>${l}</small></div>`).join('');
    $('#starOnly').textContent = `★ Shortlist (${Object.keys(S.star).length})`;
  }

  function renderGames() {
    const counts = {};
    S.data.photos.forEach((p) => (counts[p.folder] = (counts[p.folder] || 0) + 1));
    const tops = {};
    Object.keys(counts).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).forEach((f) => (tops[topOf(f)] ||= []).push(f));
    let html = `<option value="">All games (${S.data.photos.length})</option>`;
    for (const [top, folders] of Object.entries(tops)) {
      const n = folders.reduce((s, f) => s + counts[f], 0);
      html += `<optgroup label="${esc(top)}"><option value="top:${esc(top)}">All of this upload (${n})</option>` +
        folders.map((f) => `<option value="f:${esc(f)}">${esc(shortGame(f))} (${counts[f]})</option>`).join('') + '</optgroup>';
    }
    const sel = $('#game'); sel.innerHTML = html; sel.value = S.game;
    sel.onchange = () => { S.game = sel.value; renderPeople(); renderGrid(); };
  }

  function renderSort() {
    $('#sort').innerHTML = KEYS.map(([k, l]) => `<button data-k="${k}" aria-pressed="${k === S.sort}">${l}</button>`).join('');
    $('#sort').onclick = (e) => { const k = e.target.dataset.k; if (!k) return; S.sort = k; renderSort(); renderGrid(); };
  }

  async function renderPeople() {
    const el = $('#people');
    const counts = {};
    S.data.photos.forEach((p) => { if (inGame(p)) p.people.forEach((id) => (counts[id] = (counts[id] || 0) + 1)); });
    const scoped = S.data.people.filter((p) => counts[p.id]).sort((a, b) => (!a.name - !b.name) || counts[b.id] - counts[a.id]);
    const shown = S.allPeople ? scoped : scoped.slice(0, PEOPLE_SHOWN);
    let urls = {};
    try { urls = await api.faceUrls(shown.map((p) => p.face)); } catch (e) { console.warn(e); }
    el.innerHTML = shown.map((p) => `
      <div class="person ${S.person === personKey(p.id) ? 'on' : ''}" data-id="${p.id}">
        <span class="count">${counts[p.id]}</span>
        <button class="face" aria-label="Show photos of ${esc(personLabel(p.id))}"><img src="${esc(urls[p.face] || '')}" alt="" loading="lazy"></button>
        <input value="${esc(p.name)}" placeholder="Person ${S.num[p.id]}" aria-label="Name for person ${S.num[p.id]}" maxlength="60" list="rosterList">
        ${whoLine(p)}
      </div>`).join('') || '<div class="hint">No people in this selection.</div>';
    if (scoped.length > PEOPLE_SHOWN)
      el.insertAdjacentHTML('beforeend', `<button class="more-people" id="morePeople">${S.allPeople ? 'Show fewer' : `Show all ${scoped.length}`}</button>`);
    $('#morePeople')?.addEventListener('click', () => { S.allPeople = !S.allPeople; renderPeople(); });
    el.querySelectorAll('.person').forEach((card) => {
      const id = +card.dataset.id;
      card.querySelector('.face').onclick = () => { const k = personKey(id); S.person = S.person === k ? null : k; renderPeople(); renderGrid(); };
      const inp = card.querySelector('input');
      inp.onkeydown = (e) => { if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') { inp.value = S.byId[id].name || ''; inp.blur(); } };
      inp.onblur = async () => {
        const name = inp.value.trim();
        if (name === (S.byId[id].name || '')) return;
        if (!(await nameGroup(id, name))) inp.value = S.byId[id].name || '';
      };
      card.querySelectorAll('.sugg').forEach((b) => b.addEventListener('click', () => nameGroup(id, rosterName(PLAYERS[b.dataset.player]))));
    });
    fillPeopleList();
  }

  // Under a person card: the roster player it's named after, or the best suggestion to confirm.
  function whoLine(p) {
    if (p.name) {
      const pl = BY_NAME[p.name.toLowerCase()];
      return pl ? `<span class="who">#${esc(pl.number)} · ${esc(teamName(pl.team))}</span>` : '';
    }
    // same number on both teams of a game ties: show both and let the person pick
    const open = (p.sugg || []).filter((x) => PLAYERS[x.player] && !takenName(rosterName(PLAYERS[x.player])));
    return open.filter((x) => x.votes === open[0].votes).slice(0, 2).map((s) => {
      const pl = PLAYERS[s.player];
      return `<button class="sugg" data-player="${esc(pl.id)}" title="Jersey #${esc(pl.number)} read in ${s.votes} photos. Tap to confirm">
        ${esc(rosterName(pl))} #${esc(pl.number)}<br>${esc(teamName(pl.team))}? ✓</button>`;
    }).join('');
  }
  const takenName = (name) => S.data.people.some((q) => q.name && q.name.toLowerCase() === name.toLowerCase());

  async function nameGroup(id, name) {
    const p = S.byId[id], wasActive = S.person === personKey(id);
    try { await api.setName(id, name); } catch (e) { toast(e.message || 'Could not save name', 'error'); return false; }
    p.name = name; if (wasActive) S.person = personKey(id);
    toast(name ? `Named ${name}` : 'Name cleared');
    renderHeader(); renderPeople(); renderGrid();
    if (S.idx >= 0) openLb(S.idx);
    return true;
  }

  function fillPeopleList() {
    const seen = new Set(), opts = [];
    S.data.people.forEach((p) => {
      const label = personLabel(p.id);
      if (!seen.has(label.toLowerCase())) { seen.add(label.toLowerCase()); opts.push(label); }
    });
    Object.values(PLAYERS).forEach((p) => {
      const n = rosterName(p);
      if (!seen.has(n.toLowerCase())) { seen.add(n.toLowerCase()); opts.push(n); }
    });
    $('#peopleList').innerHTML = opts.map((o) => `<option value="${esc(o)}">`).join('');
    if (!$('#rosterList')) document.body.insertAdjacentHTML('beforeend', '<datalist id="rosterList"></datalist>');
    $('#rosterList').innerHTML = Object.values(PLAYERS).sort((a, b) => a.team.localeCompare(b.team) || byNumber(a, b))
      .map((p) => `<option value="${esc(rosterName(p))}">#${esc(p.number)} ${esc(teamName(p.team))}</option>`).join('');
  }

  function filtered() {
    let list = S.data.photos.filter(inGame);
    if (S.starOnly) list = list.filter((p) => S.star[p.id]);
    if (S.person) list = list.filter((p) => p.people.some((id) => personKey(id) === S.person));
    else if (S.bestOnly && !S.starOnly) list = list.filter((p) => p.best_in_burst);
    return [...list].sort((a, b) => b.scores[S.sort] - a.scores[S.sort]);
  }

  function renderGrid() {
    S.list = filtered();
    const tag = $('#filterTag');
    if (S.person) {
      const g = S.data.people.find((p) => personKey(p.id) === S.person);
      tag.textContent = `${personLabel(g.id)} ✕`; tag.classList.add('show');
    } else tag.classList.remove('show');
    $('#bestOnly').setAttribute('aria-pressed', S.bestOnly);
    $('#bestOnly').style.opacity = S.person || S.starOnly ? 0.4 : 1;
    $('#starOnly').setAttribute('aria-pressed', S.starOnly);
    $('#countLabel').textContent = `${S.list.length} photos · sorted by ${LABEL[S.sort].toLowerCase()}`;
    S.shown = 0;
    $('#grid').innerHTML = S.list.length ? '' : `<div class="empty">${S.starOnly ? 'Nothing shortlisted here yet. Tap ★ on a photo to add it.' : 'No photos match.'}</div>`;
    morePhotos();
  }

  function morePhotos() {
    if (S.shown >= S.list.length) return;
    const from = S.shown, to = Math.min(S.list.length, from + PAGE);
    S.shown = to;
    $('#grid').insertAdjacentHTML('beforeend', S.list.slice(from, to).map((p, k) => cardHtml(p, from + k)).join(''));
    requestAnimationFrame(() => { if ($('#more').getBoundingClientRect().top < innerHeight + 1200) morePhotos(); });
  }
  new IntersectionObserver((es) => { if (es[0].isIntersecting && S.data) morePhotos(); }, { rootMargin: '1200px' }).observe($('#more'));

  function cardHtml(p, i) {
    const s = p.scores, on = !!S.star[p.id];
    const names = [...new Map(p.people.map((id) => [personKey(id), id])).values()];
    return `<div class="card ${on ? 'starred' : ''}" data-id="${esc(p.id)}">
      <button class="open" data-i="${i}" aria-label="${esc(p.name)}, ${LABEL[S.sort]} ${s[S.sort]}">
        <div class="thumb">
          <img src="${driveImg(p.id, 640)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">
          <span class="pill rank">#${i + 1}</span>
          ${p.burst_size > 1 && !S.person ? `<span class="pill burst">${p.burst_size} frames</span>` : ''}
          <span class="badge" style="color:${color(s[S.sort])}">${s[S.sort]}<small>${LABEL[S.sort]}</small></span>
        </div>
        <div class="meta">
          <div class="bars">${KEYS.slice(1).map(([k, l]) => `<span class="bar" title="${l} ${s[k]}">${l}<i><b style="--v:${s[k] / 100};--c:${color(s[k])}"></b></i></span>`).join('')}</div>
          <div class="tags">${names.map((id) => `<span class="tag ${S.byId[id]?.name ? '' : 'anon'}">${esc(personLabel(id))}</span>`).join('')}</div>
        </div>
      </button>
      <button class="star" data-star="${esc(p.id)}" aria-pressed="${on}" aria-label="${on ? 'Remove from' : 'Add to'} shortlist">★</button>
    </div>`;
  }

  async function toggleStar(id) {
    const on = !S.star[id];
    const prev = S.star[id];
    if (on) S.star[id] = { photo_id: id, added_by: S.user.email, added_at: new Date().toISOString() }; else delete S.star[id];
    syncStarUi(id);
    try { await api.star(id, on); toast(on ? 'Added to shortlist' : 'Removed from shortlist'); }
    catch (e) { if (prev) S.star[id] = prev; else delete S.star[id]; syncStarUi(id); toast(e.message || 'Could not update shortlist', 'error'); }
  }
  function syncStarUi(id) {
    const on = !!S.star[id];
    document.querySelectorAll(`.card[data-id="${CSS.escape(id)}"]`).forEach((c) => {
      c.classList.toggle('starred', on); c.querySelector('.star').setAttribute('aria-pressed', on);
    });
    renderHeader();
    if (S.idx >= 0 && S.list[S.idx]?.id === id) renderSide(S.list[S.idx]);
  }

  // ─── LIGHTBOX ───────────────────────────────────────────
  function openLb(i) {
    S.idx = i; const p = S.list[i]; if (!p) return;
    closeFix();
    const minFace = p.w * 0.018;
    const boxes = p.faces.map((f, j) => {
      const [x1, y1, x2, y2] = f.bbox;
      if (f.person == null && !f.fixed && x2 - x1 < minFace) return '';
      const cls = f.fixed ? 'fixed' : f.person == null || !S.byId[f.person]?.name ? 'anon' : '';
      const label = f.person == null ? (f.fixed ? 'Not tagged' : '?') : personLabel(f.person);
      return `<button class="box ${cls}" data-face="${j}" title="Fix who this is"
        style="left:${(x1 / p.w) * 100}%;top:${(y1 / p.h) * 100}%;width:${((x2 - x1) / p.w) * 100}%;height:${((y2 - y1) / p.h) * 100}%"><span>${esc(label)}</span></button>`;
    }).join('');
    $('#stage').innerHTML = `<img src="${driveImg(p.id, 1600)}" alt="${esc(p.name)}" referrerpolicy="no-referrer">${boxes}`;
    renderSide(p);
    $('#lb').classList.add('open'); document.body.style.overflow = 'hidden';
    $('#lbClose').focus();
  }

  function renderSide(p) {
    const s = p.scores, st = S.star[p.id];
    $('#side').innerHTML = `
      <h2 style="color:${color(s.overall)}">${s.overall}<small>overall</small></h2>
      <div class="rows">${KEYS.slice(1).map(([k, l]) => `<div class="row"><span class="k">${l}</span><i><b style="--v:${s[k] / 100};--c:${color(s[k])}"></b></i><span class="v">${s[k]}</span></div>`).join('')}</div>
      <div class="file mono">${esc(p.folder)}/${esc(p.name)}${p.burst_size > 1 ? ` · burst of ${p.burst_size}${p.best_in_burst ? ' (best)' : ''}` : ''}</div>
      <div class="actions">
        <button class="btn gold" id="lbStar" aria-pressed="${!!st}">${st ? '★ Shortlisted' : '☆ Add to shortlist'}</button>
        <a class="btn primary" href="${driveDownload(p.id)}" rel="noopener">Download original</a>
        <a class="btn" href="${esc(p.drive_url)}" target="_blank" rel="noopener">Open in Drive</a>
      </div>
      ${st ? `<div class="by">Shortlisted by ${esc(st.added_by)}</div>` : ''}
      <div class="actions"><button class="btn" id="prev">← Prev</button><button class="btn" id="next">Next →</button></div>
      <div class="legend">Tap a face box to fix who it is. <b>Clarity</b> sharpness of the main player · <b>Action</b> live play ·
        <b>Framing</b> player size, placement, cut-offs · <b>Moment</b> emotion and celebration · <b>Look</b> overall appeal.
        Clarity, action, moment and look are ranked within each game (100 = best in that game).</div>`;
    $('#lbStar').onclick = () => toggleStar(p.id);
    $('#prev').onclick = () => openLb(Math.max(0, S.idx - 1));
    $('#next').onclick = () => openLb(Math.min(S.list.length - 1, S.idx + 1));
  }

  function closeLb() { closeFix(); $('#lb').classList.remove('open'); document.body.style.overflow = ''; S.idx = -1; }

  // ─── FACE FIXES ─────────────────────────────────────────
  function openFix(btn) {
    const p = S.list[S.idx], j = +btn.dataset.face, f = p.faces[j];
    S.fixing = { p, j };
    $('#fixTitle').textContent = f.person == null ? 'Who is this?' : `Is this ${personLabel(f.person)}?`;
    const inp = $('#fixInput'); inp.value = f.person == null ? '' : personLabel(f.person);
    renderPicks(p, f);
    const r = btn.getBoundingClientRect(), box = $('#fix');
    box.classList.add('open');
    const w = box.offsetWidth, h = box.offsetHeight;
    box.style.left = Math.max(16, Math.min(innerWidth - w - 16, r.left)) + 'px';
    box.style.top = (r.bottom + h + 24 < innerHeight ? r.bottom + 24 : Math.max(16, r.top - h - 8)) + 'px';
    if (matchMedia('(hover: hover)').matches) { inp.focus(); inp.select(); } // no keyboard pop-up on phones
    else $('#fixPicks').scrollTop = 0;
  }

  // Tappable roster players: suggestions for this face's group, then both teams of this game.
  function renderPicks(p, f) {
    const g = f.person != null ? S.byId[f.person] : null;
    const sugg = (g?.sugg || []).map((x) => PLAYERS[x.player]).filter(Boolean);
    const teams = (S.data.games?.[p.folder] || []).length ? S.data.games[p.folder] : g?.teams || [];
    const chip = (pl, sug) => `<button class="pl ${sug ? 'sug' : ''}" data-player="${esc(pl.id)}"><b>#${esc(pl.number)}</b>${esc(nick(pl))}</button>`;
    let html = sugg.length ? `<h4>Suggested from jersey number</h4><div class="row-chips">${sugg.map((pl) => chip(pl, true)).join('')}</div>` : '';
    teams.forEach((t) => { const ps = teamPlayers(t); if (ps.length) html += `<h4>${esc(teamName(t))}</h4><div class="row-chips">${ps.map((pl) => chip(pl, false)).join('')}</div>`; });
    $('#fixPicks').innerHTML = html;
    $('#fixPicks').hidden = !html;
  }

  // A roster player was picked for the face being fixed.
  function pickPlayer(pl) {
    const name = rosterName(pl), { p, j } = S.fixing || {};
    if (!p) return;
    const existing = resolvePerson(name);
    if (existing !== undefined) return saveFix(existing);
    const gid = p.faces[j].person;
    if (gid != null && !S.byId[gid]?.name) { closeFix(); return nameGroup(gid, name); } // name the whole group
    toast(gid == null ? `${name} has no face group yet. Name them on a clearer photo first.`
      : `${name} has no face group yet, and this face is in ${personLabel(gid)}'s group. Pick "Not a known person" or name ${name} on another photo first.`, 'error');
  }
  function closeFix() { $('#fix').classList.remove('open'); S.fixing = null; }

  function resolvePerson(text) {
    const t = text.trim().toLowerCase();
    if (!t) return undefined;
    const m = t.match(/^person\s*(\d+)$/);
    if (m) return S.data.people.find((p) => S.num[p.id] === +m[1])?.id;
    const named = S.data.people.filter((p) => p.name && p.name.toLowerCase() === t);
    return named.sort((a, b) => b.count - a.count)[0]?.id;
  }

  async function saveFix(gid) {
    const { p, j } = S.fixing || {};
    if (!p) return;
    const f = p.faces[j], before = { person: f.person, fixed: f.fixed };
    f.person = gid; f.fixed = true; recomputePeople(p);
    closeFix(); openLb(S.idx);
    try { await api.setFix(p.id, j, gid); toast('Saved. Face groups learn from this on the next photo run'); }
    catch (e) { Object.assign(f, before); recomputePeople(p); openLb(S.idx); toast(e.message || 'Could not save fix', 'error'); }
  }

  // ─── EVENTS ─────────────────────────────────────────────
  $('#grid').addEventListener('click', (e) => {
    const star = e.target.closest('.star'); if (star) return toggleStar(star.dataset.star);
    const open = e.target.closest('.open'); if (open) openLb(+open.dataset.i);
  });
  $('#stage').addEventListener('click', (e) => { const b = e.target.closest('.box'); if (b) openFix(b); });
  $('#fixPicks').addEventListener('click', (e) => { const b = e.target.closest('.pl'); if (b) pickPlayer(PLAYERS[b.dataset.player]); });
  $('#fixSave').onclick = () => {
    const pl = BY_NAME[$('#fixInput').value.trim().toLowerCase()];
    if (pl && resolvePerson($('#fixInput').value) === undefined) return pickPlayer(pl);
    const gid = resolvePerson($('#fixInput').value);
    if (gid === undefined) return toast('No one with that name yet. Name their face group in People first.', 'error');
    saveFix(gid);
  };
  $('#fixInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#fixSave').click(); if (e.key === 'Escape') closeFix(); });
  $('#fixNone').onclick = () => saveFix(null);
  $('#fixCancel').onclick = closeFix;
  $('#lbClose').onclick = closeLb;
  $('#lb').addEventListener('click', (e) => { if (e.target.id === 'lb' || e.target.classList.contains('lb-inner')) closeLb(); });
  $('#bestOnly').onclick = () => { if (S.person || S.starOnly) return; S.bestOnly = !S.bestOnly; renderGrid(); };
  $('#starOnly').onclick = () => { S.starOnly = !S.starOnly; renderGrid(); };
  $('#filterTag').onclick = () => { S.person = null; renderPeople(); renderGrid(); };
  document.addEventListener('keydown', (e) => {
    if (S.idx < 0 || S.fixing || e.target.matches('input')) return;
    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowLeft') openLb(Math.max(0, S.idx - 1));
    if (e.key === 'ArrowRight') openLb(Math.min(S.list.length - 1, S.idx + 1));
    if (e.key.toLowerCase() === 's') toggleStar(S.list[S.idx].id);
  });

  boot().catch((e) => { console.error(e); $('#gate').innerHTML = `<h2>Something went wrong</h2><p>${esc(e.message || e)}</p>`; });
})();
