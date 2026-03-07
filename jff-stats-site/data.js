// data.js — loads all CSV files and exposes global arrays

let competitions = [];
let matches = [];
let standings = [];
let awards = [];
let rosters = [];
let players = [];

async function loadData() {
  try {
    [competitions, matches, standings, awards, rosters, players] = await Promise.all([
      fetchCSV('data/reclub_competitions.csv'),
      fetchCSV('data/reclub_matches.csv'),
      fetchCSV('data/reclub_standings.csv'),
      fetchCSV('data/reclub_awards.csv'),
      fetchCSV('data/reclub_rosters.csv'),
      fetchCSV('data/reclub_player_profiles.csv'),
    ]);
    console.log(`Loaded: ${competitions.length} competitions, ${matches.length} matches, ${standings.length} standings`);
  } catch(e) {
    console.error('Failed to load data:', e);
  }
}

async function fetchCSV(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  const buffer = await res.arrayBuffer();
  const text = new TextDecoder('utf-8').decode(buffer).replace(/^\uFEFF/, '');
  return parseCSV(text);
}

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] !== undefined ? values[idx] : '').trim();
    });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
