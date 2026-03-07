// app.js — shared utilities

function tournamentCard(t) {
  return `
    <a href="tournaments.html" class="tournament-card" onclick="sessionStorage.setItem('openTournament','${t.id}')">
      <div class="tc-name">${t.name}</div>
      <div class="tc-meta">
        ${t.start_date || ''}
        ${t.location ? ' · ' + t.location : ''}
      </div>
      <div class="tc-badges">
        ${t.gender === 'M' ? '<span class="tc-badge">Men\'s</span>' : t.gender === 'F' ? '<span class="tc-badge">Women\'s</span>' : ''}
        <span class="tc-badge">${t.num_teams || 0} teams</span>
        <span class="tc-badge">${t.num_matches || 0} matches</span>
      </div>
    </a>`;
}
