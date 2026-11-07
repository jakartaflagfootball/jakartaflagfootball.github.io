// ─── JFF Player of the Week — settings ──────────────────
// Leave SUPABASE_URL empty to run in DEMO MODE (votes are stored only in this browser).
// After creating your Supabase project, paste its URL and anon key here
// (Supabase → Project Settings → API). The anon key is meant to be public.
window.JFF_CONFIG = {
  SUPABASE_URL: 'https://lnpmzhoakmbtqndfdbjo.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_Dzc6MeLVUSL-K78Ixkx_Lw_Up12zgFE',

  // Google Cloud → Clients → your Web client → Client ID (ends in .apps.googleusercontent.com).
  // Public by design. If empty, sign-in falls back to redirecting through Supabase.
  GOOGLE_CLIENT_ID: '412148161548-gdpt2nr7qendjn9boatds9kcnlol6sjf.apps.googleusercontent.com',

  // The public address people will share. Used in share links and the story image.
  PUBLIC_URL: 'https://jakartaflagfootball.com/vote/',

  // Shown in the header.
  SEASON: 'Open SZN IV',

  // How often the live leaderboard refreshes, in seconds.
  REFRESH_SECONDS: 15,
};
