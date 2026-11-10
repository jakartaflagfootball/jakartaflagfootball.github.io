// JFF People's Choice — captain nominations page
(function () {
  const { api, teams, players, esc } = JFF;
  const $ = (id) => document.getElementById(id);
  const MAX = 2;
  const S = { user: null, teamIds: [], team: '', weeks: [], week: null, saved: new Set(), picked: new Set(), busy: false, photos: {}, uploading: null, photoFor: null };

  const votingStarted = () => S.week && Date.now() >= +new Date(S.week.starts_at);
  const locked = (pid) => votingStarted() && S.saved.has(pid);
  const num = (p) => (p.number === '' || p.number == null ? Infinity : Number(p.number));
  const byNumber = (a, b) => num(a) - num(b) || String(a.number).length - String(b.number).length;

  // Week to nominate for: the next one whose nominations are still running.
  function pickWeek(weeks) {
    const live = weeks.filter((w) => JFF.nominatingOpen(w));
    return live.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))[0] || null;
  }

  function render() {
    const t = teams[S.team];
    $('teamField').style.display = S.teamIds.length > 1 ? '' : 'none';
    $('teamSelect').innerHTML = S.teamIds.map((id) => `<option value="${id}" ${id === S.team ? 'selected' : ''}>${esc(teams[id]?.name || id)}</option>`).join('');
    $('weekLabel').textContent = S.week.label;
    $('weekInfo').textContent = votingStarted()
      ? `Voting is open until ${JFF.fmtDate(S.week.ends_at)}`
      : `Nominations close ${JFF.fmtDate(S.week.starts_at)}`;

    const changed = S.picked.size !== S.saved.size || [...S.picked].some((p) => !S.saved.has(p));
    let status;
    if (votingStarted() && S.saved.size >= MAX) status = `<div class="nom-note ok">✓ Your nominees for ${esc(t.name)} are in and voting is open. Nominees can't be changed now. Ask a JFF admin if something is wrong.</div>`;
    else if (votingStarted() && S.saved.size) status = `<div class="nom-note">Voting is already open. You can still add a second nominee, but nominees can't be removed now.</div>`;
    else if (votingStarted()) status = `<div class="nom-note warn">You're late. Voting already opened, but ${esc(t.name)} can still nominate: your players appear for voting as soon as you submit. Once submitted, they can't be changed.</div>`;
    else if (S.saved.size) status = `<div class="nom-note ok">✓ Submitted. You can still change your picks until ${JFF.fmtDate(S.week.starts_at)}.</div>`;
    else status = `<div class="nom-note">Pick 1–2 players, then tap <b>Submit nominees</b>. You can change them until ${JFF.fmtDate(S.week.starts_at)}. Until you submit, nobody from ${esc(t.name)} can be voted for.</div>`;
    $('nomStatus').innerHTML = status;

    renderPhotos();

    const roster = window.JFF_PLAYERS.filter((p) => p.team === S.team).sort(byNumber);
    $('rosterTitle').textContent = t.name;
    $('pickCount').textContent = `${S.picked.size} of ${MAX} picked`;
    $('roster').innerHTML = roster.map((p) => {
      const on = S.picked.has(p.id), lock = locked(p.id);
      return `<button type="button" class="player-card nom-card ${on ? 'voted' : ''} ${lock ? 'locked' : ''}" data-pick="${p.id}" aria-pressed="${on}">
        <div class="pc-top"><span class="pc-num">${esc(p.number)}</span><span class="pc-pos ${p.position ? '' : 'empty'}">${esc(p.position || 'Pos TBA')}</span></div>
        <div><div class="pc-nick">${esc(p.nickname || p.full_name)}</div><div class="pc-full">${esc(p.full_name)}</div></div>
        <span class="nom-tick">${lock ? '🔒 Nominated' : on ? '✓ Nominated' : 'Tap to nominate'}</span>
      </button>`;
    }).join('');

    const showBar = changed && !S.busy;
    $('nomBar').classList.toggle('show', showBar || S.busy);
    $('nomBarText').textContent = S.picked.size ? `${S.picked.size} of ${MAX}: ${[...S.picked].map((id) => players[id].nickname || players[id].full_name).join(', ')}` : 'No players picked';
    $('submitBtn').disabled = S.busy || !changed || (!S.picked.size && votingStarted());
    $('submitBtn').textContent = S.busy ? 'Saving…' : !S.picked.size ? 'Remove nominees' : 'Submit nominees';
  }

  // ─── Photos ───
  const canSetPhoto = (pid) => !votingStarted() || !S.photos[pid];
  function renderPhotos() {
    const saved = [...S.saved].map((id) => players[id]).filter(Boolean).sort(byNumber);
    if (!saved.length) { $('photos').innerHTML = ''; return; }
    $('photos').innerHTML = `<div class="section-header"><h2>Photos</h2><small>Optional · shown on the vote card and Story image</small></div>
      <div class="photo-list">${saved.map((p) => {
        const url = api.photoUrl(S.photos[p.id]);
        const busy = S.uploading === p.id;
        const can = canSetPhoto(p.id) && !S.uploading;
        return `<div class="photo-item">
          <div class="photo-frame">${url ? `<img src="${esc(url)}" alt="${esc(p.nickname || p.full_name)}">` : '<span>No photo</span>'}${busy ? '<i class="photo-busy">Uploading…</i>' : ''}</div>
          <div class="photo-meta"><b>${esc(p.nickname || p.full_name)} #${esc(p.number)}</b>
            ${canSetPhoto(p.id) ? `<button type="button" class="btn-secondary btn-sm" data-photo="${p.id}" ${can ? '' : 'disabled'}>${url ? 'Change photo' : 'Add photo'}</button>` : '<small>🔒 Locked while voting is open</small>'}
          </div></div>`;
      }).join('')}</div>
      <p class="photo-tip">Use a clear, upright photo of the player, ideally in their jersey. It's cropped to a 4:5 portrait, like an Instagram post.</p>`;
  }

  // Shrink to Instagram size as a JPEG before uploading.
  async function shrink(file) {
    let src;
    try { src = await createImageBitmap(file); }
    catch {
      src = await new Promise((res, rej) => {
        const i = new Image(); i.onload = () => res(i);
        i.onerror = () => rej(new Error("Couldn't read this photo. Try a JPG or PNG (on iPhone, a screenshot of the photo works)."));
        i.src = URL.createObjectURL(file);
      });
    }
    // Keep enough pixels to fill a 1080×1350 portrait crop, but cap the long side at 2400.
    const r = Math.min(1, Math.max(1080 / src.width, 1350 / src.height), 2400 / Math.max(src.width, src.height));
    const c = document.createElement('canvas');
    c.width = Math.round(src.width * r); c.height = Math.round(src.height * r);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return new Promise((res) => c.toBlob(res, 'image/jpeg', 0.86));
  }

  async function uploadPhoto(pid, file) {
    if (!file) return;
    if (!/^image\//.test(file.type) && !/\.(heic|heif|jpe?g|png|webp)$/i.test(file.name)) return JFF.toast('Please pick a photo.', 'error');
    S.uploading = pid; renderPhotos();
    try {
      const blob = await shrink(file);
      S.photos[pid] = await api.uploadPhoto(S.week.id, pid, blob);
      JFF.toast('Photo saved');
    } catch (e) {
      console.error(e); JFF.toast(e.message || 'Upload failed. Try again.', 'error');
    } finally { S.uploading = null; renderPhotos(); }
  }

  async function loadTeam() {
    const rows = await api.listNominations(S.week.id);
    S.saved = new Set(rows.filter((r) => r.team_id === S.team).map((r) => r.player_id));
    S.photos = Object.fromEntries(rows.filter((r) => r.photo_path).map((r) => [r.player_id, r.photo_path]));
    S.picked = new Set(S.saved);
    render();
  }

  function toggle(pid) {
    if (locked(pid)) return JFF.toast("Voting is open, so this nominee can't be removed.", 'error');
    if (S.picked.has(pid)) S.picked.delete(pid);
    else if (S.picked.size >= MAX) return JFF.toast(`Max ${MAX} players. Untick one first.`, 'error');
    else S.picked.add(pid);
    render();
  }

  async function submit() {
    const add = [...S.picked].filter((p) => !S.saved.has(p));
    const remove = [...S.saved].filter((p) => !S.picked.has(p));
    if (votingStarted() && add.length && !confirm(`Voting is already open. ${add.map((id) => players[id].nickname || players[id].full_name).join(' and ')} will appear for voting straight away and can't be removed. Submit?`)) return;
    S.busy = true; render();
    try {
      for (const pid of remove) await api.unnominate(S.week.id, pid);
      for (const pid of add) await api.nominate(S.week.id, S.team, pid);
      JFF.toast(S.picked.size ? 'Nominees submitted' : 'Nominees removed');
    } catch (e) {
      JFF.toast(e.message || 'Could not save. Try again.', 'error');
    } finally {
      S.busy = false;
      await loadTeam();
    }
  }

  async function gate(user) {
    S.user = user;
    $('demoBanner').innerHTML = api.demo ? '<div class="demo-banner"><span>⚠ <b>Demo mode.</b> Any signed-in demo user is a captain of every team. Changes stay in this browser.</span></div>' : '';
    $('body').style.display = 'none';
    if (!user) {
      $('gate').innerHTML = '<div class="auth-bar"><p><b>Team captains only.</b> Sign in with the Google account your team gave to JFF.</p><div class="signin-slot" id="capSignin"></div></div>';
      api.mountSignIn($('capSignin'));
      return;
    }
    const signedIn = `<p>Signed in as <b>${esc(user.email)}</b></p><button class="btn-link" id="signOutC">Sign out</button>`;
    try {
      [S.teamIds, S.weeks] = await Promise.all([api.myCaptainTeams(), api.listWeeks()]);
    } catch (e) {
      console.error(e);
      $('gate').innerHTML = `<div class="auth-bar">${signedIn}</div><p class="lb-empty">Could not load. Check your connection and refresh.</p>`;
      return;
    }
    S.teamIds = S.teamIds.filter((id) => teams[id]).sort((a, b) => teams[a].name.localeCompare(teams[b].name));
    if (!S.teamIds.length) {
      $('gate').innerHTML = `<div class="auth-bar"><p><b>${esc(user.email)}</b> isn't listed as a team captain. Ask a JFF admin to add this email, or sign in with the account your team gave to JFF.</p><button class="btn-link" id="signOutC">Sign out</button></div>`;
      return;
    }
    S.week = pickWeek(S.weeks);
    if (!S.week) {
      $('gate').innerHTML = `<div class="auth-bar" style="margin-bottom:1.5rem">${signedIn}</div><p class="lb-empty">No nominations are open right now. Come back after your next gameday.</p>`;
      return;
    }
    $('gate').innerHTML = `<div class="auth-bar" style="margin-bottom:1.5rem">${signedIn}</div>`;
    if (!S.teamIds.includes(S.team)) S.team = S.teamIds[0];
    $('body').style.display = 'block';
    await loadTeam();
  }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-pick],[data-photo],[data-signin],#signOutC,#submitBtn');
    if (!t || S.busy) return;
    if (t.dataset.photo) { if (S.uploading) return; S.photoFor = t.dataset.photo; $('photoInput').value = ''; $('photoInput').click(); }
    else if (t.dataset.pick) toggle(t.dataset.pick);
    else if (t.id === 'submitBtn') submit();
    else if (t.id === 'signOutC') api.signOut();
    else if (t.hasAttribute('data-signin')) api.signIn().catch((err) => JFF.toast(err.message, 'error'));
  });
  $('photoInput').addEventListener('change', (e) => uploadPhoto(S.photoFor, e.target.files[0]));
  $('teamSelect').addEventListener('change', (e) => { S.team = e.target.value; loadTeam(); });

  $('seasonLabel').textContent = window.JFF_CONFIG.SEASON;
  let last;
  const onUser = (u) => { if ((u?.id || null) === last) return; last = u?.id || null; gate(u); };
  api.onAuthChange(onUser);
  api.getUser().then(onUser);
  // Re-render when the deadline passes while the page is open.
  setInterval(() => { if (S.week && !S.busy && $('body').style.display !== 'none') render(); }, 30000);
})();
