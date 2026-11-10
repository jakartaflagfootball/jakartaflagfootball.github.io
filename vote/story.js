// Builds a 1080×1920 Instagram Story image for a player, in the JFF look.
window.JFFStory = {
  async make(p, team, catLabel, voted, url, photoUrl) {
    await Promise.all([document.fonts.load('200px "Bebas Neue"'), document.fonts.load('600 40px "DM Sans"')]).catch(() => {});
    const W = 1080, H = 1920, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    const img = (src, cors) => new Promise((res) => { const i = new Image(); if (cors) i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
    const [logo, teamLogo, photo] = await Promise.all([img('jff-logo.png'), team.logo ? img('team-logos/' + team.logo) : null, photoUrl ? img(photoUrl, true) : null]);

    // Background
    x.fillStyle = '#0e0e0e'; x.fillRect(0, 0, W, H);
    let g = x.createRadialGradient(W * 0.8, H * 0.3, 0, W * 0.8, H * 0.3, W * 0.9);
    g.addColorStop(0, 'rgba(192,57,43,0.35)'); g.addColorStop(1, 'rgba(192,57,43,0)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    g = x.createRadialGradient(W * 0.1, H * 0.85, 0, W * 0.1, H * 0.85, W * 0.6);
    g.addColorStop(0, 'rgba(201,168,76,0.12)'); g.addColorStop(1, 'rgba(201,168,76,0)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(255,255,255,0.035)'; x.lineWidth = 2;
    for (let i = 0; i <= W; i += 90) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); }
    for (let i = 0; i <= H; i += 90) { x.beginPath(); x.moveTo(0, i); x.lineTo(W, i); x.stroke(); }
    x.fillStyle = '#c0392b'; x.fillRect(W - 18, 0, 18, H);

    const L = 96;
    const fit = (text, font, size, max) => { let s = size; do { x.font = font.replace('{s}', s); s -= 4; } while (x.measureText(text).width > max && s > 40); };

    if (photo) {
      // Photo layout: the player fills the top, details sit on the fade below.
      const PH = 1300, r = Math.max(W / photo.width, PH / photo.height);
      const pw = photo.width * r, ph = photo.height * r;
      x.drawImage(photo, (W - pw) / 2, Math.min(0, (PH - ph) * 0.25), pw, ph);
      g = x.createLinearGradient(0, 0, 0, 420); g.addColorStop(0, 'rgba(14,14,14,.85)'); g.addColorStop(1, 'rgba(14,14,14,0)');
      x.fillStyle = g; x.fillRect(0, 0, W, 420);
      g = x.createLinearGradient(0, 640, 0, PH); g.addColorStop(0, 'rgba(14,14,14,0)'); g.addColorStop(1, '#0e0e0e');
      x.fillStyle = g; x.fillRect(0, 640, W, PH - 640);
      x.fillStyle = '#c0392b'; x.fillRect(W - 18, 0, 18, H);
      if (logo) { const h = 110, w = (logo.width / logo.height) * h; x.drawImage(logo, L, 110, w, h); }
      x.fillStyle = '#f2f2f2'; x.font = '56px "Bebas Neue"'; x.textBaseline = 'alphabetic';
      x.fillText('JAKARTA FLAG FOOTBALL', L, 290);
      x.fillStyle = '#c9a84c'; x.font = '500 28px "DM Sans"';
      x.fillText((window.JFF_CONFIG.SEASON || '').toUpperCase().split('').join(String.fromCharCode(8202)), L, 336);
      if (teamLogo) { const s = 150, k = Math.min(s / teamLogo.width, s / teamLogo.height); x.drawImage(teamLogo, W - L - teamLogo.width * k, 110, teamLogo.width * k, teamLogo.height * k); }

      x.fillStyle = '#c0392b'; x.font = '90px "Bebas Neue"';
      x.fillText(voted ? 'I VOTED FOR' : 'VOTE FOR', L, 1090);
      x.fillStyle = '#f2f2f2'; fit((p.nickname || p.full_name).toUpperCase(), '{s}px "Bebas Neue"', 190, W - L * 2 - 20);
      x.fillText((p.nickname || p.full_name).toUpperCase(), L, 1250);
      x.fillStyle = '#c9a84c';
      const meta = ['#' + p.number, p.position, team.name].filter(Boolean).join('  ·  ').toUpperCase();
      fit(meta, '600 {s}px "DM Sans"', 42, W - L * 2); x.fillText(meta, L, 1325);
      x.fillStyle = '#aaa'; fit(p.full_name, '400 {s}px "DM Sans"', 36, W - L * 2); x.fillText(p.full_name, L, 1380);
      x.fillStyle = '#888'; x.font = '500 34px "DM Sans"';
      fit("PEOPLE'S CHOICE · " + catLabel.toUpperCase() + ' · PLAYER OF THE WEEK', '500 {s}px "DM Sans"', 34, W - L * 2);
      x.fillText("PEOPLE'S CHOICE · " + catLabel.toUpperCase() + ' · PLAYER OF THE WEEK', L, 1460);
    } else {

    // Header
    if (logo) { const h = 120, w = (logo.width / logo.height) * h; x.drawImage(logo, L, 150, w, h); }
    x.fillStyle = '#f2f2f2'; x.font = '64px "Bebas Neue"'; x.textBaseline = 'alphabetic';
    x.fillText('JAKARTA FLAG FOOTBALL', L, 360);
    x.fillStyle = '#c9a84c'; x.font = '500 30px "DM Sans"';
    x.fillText((window.JFF_CONFIG.SEASON || '').toUpperCase().split('').join(String.fromCharCode(8202)), L, 410);

    // Title
    x.fillStyle = '#f2f2f2'; x.font = '200px "Bebas Neue"';
    x.fillText(voted ? 'I VOTED' : 'VOTE FOR', L, 640);
    x.fillStyle = '#c0392b'; x.fillRect(L, 680, 140, 10);
    x.fillStyle = '#888'; x.font = '500 40px "DM Sans"';
    x.fillText("PEOPLE'S CHOICE · " + catLabel.toUpperCase(), L, 760);
    x.fillStyle = '#f2f2f2';
    x.fillText('PLAYER OF THE WEEK', L, 812);

    // Player card
    const cy = 840, ch = 620;
    x.fillStyle = '#181818'; x.strokeStyle = '#2e2e2e'; x.lineWidth = 3;
    x.beginPath(); x.roundRect(L, cy, W - L * 2, ch, 28); x.fill(); x.stroke();
    x.fillStyle = '#c0392b'; x.fillRect(L, cy, 12, ch);
    if (teamLogo) { const s = 170, r = Math.min(s / teamLogo.width, s / teamLogo.height); x.drawImage(teamLogo, W - L - 50 - teamLogo.width * r, cy + 50, teamLogo.width * r, teamLogo.height * r); }
    x.fillStyle = '#555'; x.font = '90px "Bebas Neue"'; x.fillText('#', L + 60, cy + 160);
    const hashW = x.measureText('#').width + 8;
    x.fillStyle = '#c0392b'; x.font = '240px "Bebas Neue"'; x.fillText(p.number, L + 60 + hashW, cy + 250);
    x.fillStyle = '#f2f2f2'; fit(p.nickname || p.full_name, '{s}px "Bebas Neue"', 150, W - L * 2 - 120);
    x.fillText((p.nickname || p.full_name).toUpperCase(), L + 60, cy + 400);
    x.fillStyle = '#aaa'; fit(p.full_name, '400 {s}px "DM Sans"', 40, W - L * 2 - 120);
    x.fillText(p.full_name, L + 60, cy + 460);
    x.fillStyle = '#c9a84c';
    const meta = [p.position, team.name].filter(Boolean).join('  ·  ').toUpperCase();
    fit(meta, '600 {s}px "DM Sans"', 38, W - L * 2 - 120);
    x.fillText(meta, L + 60, cy + 550);
    }

    // Call to action
    x.fillStyle = '#f2f2f2'; x.font = '110px "Bebas Neue"';
    x.fillText(voted ? 'YOUR TURN.' : 'ONE VOTE EACH.', L, 1640);
    x.fillStyle = '#c0392b'; x.beginPath(); x.roundRect(L, 1690, W - L * 2, 110, 10); x.fill();
    x.fillStyle = '#fff'; fit(url.replace(/^https?:\/\//, '').replace(/\/$/, ''), '600 {s}px "DM Sans"', 44, W - L * 2 - 60);
    x.textAlign = 'center'; x.fillText(url.replace(/^https?:\/\//, '').replace(/\/$/, ''), W / 2, 1762); x.textAlign = 'left';

    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const file = new File([blob], `jff-potw-${p.nickname || p.number}.png`.replace(/\s+/g, '-'), { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "JFF People's Choice Player of the Week" }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    JFF.toast('Image saved. Post it to your Story and add the link sticker.');
  },
};
