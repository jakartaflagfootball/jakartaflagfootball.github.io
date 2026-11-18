// Homepage "Play" cards: Player of the Week voting and the Feeling Gue Sih… pick'em.
// Shown only while there's something to do (an open or upcoming vote, or games left to pick).
(function () {
  const el = document.getElementById('playCards');
  if (!el) return;
  const SUPABASE_URL = 'https://lnpmzhoakmbtqndfdbjo.supabase.co';
  const KEY = 'sb_publishable_Dzc6MeLVUSL-K78Ixkx_Lw_Up12zgFE'; // public key, read-only by design
  const SEASON_JSON = 'open-szn-4/season.json';
  const TZ = 'Asia/Jakarta';
  const when = (d) => new Date(d).toLocaleString('en-GB', { timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit' });
  const left = (ms) => {
    const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.max(1, Math.floor(ms / 6e4) % 60);
    return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
  };
  let vote = null, pick = null;

  function render() {
    const now = Date.now(), cards = [];
    if (vote) {
      const open = !vote.closed && now >= +new Date(vote.starts_at) && now < +new Date(vote.ends_at);
      const soon = !vote.closed && now < +new Date(vote.starts_at);
      if (open || soon) cards.push(`<a class="play-card" href="vote/">
        <span class="play-kicker">${open ? '<i class="play-dot"></i>Voting open' : 'Opens ' + when(vote.starts_at)}</span>
        <span class="play-title">Player of the <em>Week</em></span>
        <span class="play-sub">${open ? `${vote.label} · closes in <b>${left(+new Date(vote.ends_at) - now)}</b>` : `${vote.label}: vote for the best offense and defense players`}</span>
        <span class="play-cta">Vote now <span aria-hidden="true">→</span></span></a>`);
    }
    if (pick && +new Date(pick.kickoff) > now) cards.push(`<a class="play-card gold" href="vote/feeling.html">
        <span class="play-kicker"><i class="play-dot"></i>Pick'em · ${pick.round}</span>
        <span class="play-title">Feeling Gue <em>Sih…</em></span>
        <span class="play-sub">Tebak who wins every game. Next pick locks in <b>${left(+new Date(pick.kickoff) - now)}</b></span>
        <span class="play-cta">Make your picks <span aria-hidden="true">→</span></span></a>`);
    el.innerHTML = cards.length ? `<div class="play-inner"><div class="play-label">Open SZN IV · Play along</div><div class="play-grid">${cards.join('')}</div></div>` : '';
    el.hidden = !cards.length;
  }

  Promise.allSettled([
    fetch(`${SUPABASE_URL}/rest/v1/potw_weeks?select=label,starts_at,ends_at,closed&order=starts_at.desc&limit=4`, { headers: { apikey: KEY } })
      .then((r) => r.json()).then((weeks) => {
        const now = Date.now();
        vote = weeks.find((w) => !w.closed && now >= +new Date(w.starts_at) && now < +new Date(w.ends_at))
          || [...weeks].reverse().find((w) => !w.closed && now < +new Date(w.starts_at)) || null;
      }),
    fetch(`${SEASON_JSON}?v=${Math.floor(Date.now() / 6e5)}`).then((r) => r.json()).then((s) => {
      const g = s.games.filter((x) => x.home && x.away && x.date && x.time)
        .map((x) => ({ ...x, kickoff: `${x.date}T${x.time}:00+07:00` }))
        .filter((x) => +new Date(x.kickoff) > Date.now())
        .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))[0];
      pick = g ? { kickoff: g.kickoff, round: g.stage === 'playoff' ? 'Playoffs' : 'Week ' + g.week } : null;
    }),
  ]).then(() => { render(); setInterval(render, 60000); });
})();
