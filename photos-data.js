/**
 * JFF Photo Registry
 * ─────────────────────────────────────────────────────────────
 * To add a photo: add a new object to the array below.
 * To add a new event type: just type a new string in the `event` field
 *   — it will automatically appear as a filter pill in the gallery.
 *
 * Schema:
 *   src       — path to image file, relative to site root
 *   title     — display title shown in overlay and lightbox
 *   year      — numeric year (e.g. 2024) — drives Year filter pills
 *   event     — array of event type strings — drives Event filter pills
 *                 current values: "Open SZN" | "Devzone" | "8v8" | "WFF" | "Community Sessions"
 *                 e.g. event: ['Open SZN'] or event: ['Open SZN', 'WFF'] for multiple
 *                 adding a new value here auto-creates a new pill
 *   eventSub  — specific sub-event (e.g. "Open SZN 3") — used for tournament card linking later
 *   team      — array of team names in the photo — used for team card linking later
 *   featured  — true = included in the default 20 shown when no filters are active
 *
 * File structure:
 *   photo-assets/
 *   ├── 2021/
 *   ├── 2022/
 *   ├── 2023/
 *   │   ├── 8v8/
 *   │   └── Open SZN 1/
 *   ├── 2024/
 *   │   ├── 8v8/
 *   │   └── Open SZN 2/
 *   └── 2025/
 *       ├── 8v8/
 *       ├── Open SZN 3/
 *       └── WFF/
 */

window.PHOTOS = [

  // ── FEATURED (shown by default when no filters are active) ──────────────

  // 2022 · Community Sessions
  {
    src: 'photo-assets/2022/@keyzaramadiva-1135.jpg',
    title: 'Womens of the Community',
    year: 2022,
    event: ['Community Sessions'],
    eventSub: '',
    team: [],
    featured: true
  },
  {
    src: 'photo-assets/2022/@SHOWTIME.INA-293.JPG',
    title: 'OGs of JFF',
    year: 2022,
    event: ['Community Sessions'],
    eventSub: '',
    team: [],
    featured: true
  },
  {
    src: 'photo-assets/2022/@SHOWTIME.INA-1214.JPG',
    title: 'Night Lights',
    year: 2022,
    event: ['Community Sessions'],
    eventSub: '',
    team: [],
    featured: true
  },

  // 2023 · 8v8 League
  {
    src: 'photo-assets/2023/8v8/@PAULUSARDE-2367 copy.jpeg',
    title: 'Fan Hype',
    year: 2023,
    event: ['8v8'],
    eventSub: '8v8 League 2023',
    team: [],
    featured: true
  },

  // 2024 · 8v8 League
  {
    src: 'photo-assets/2024/8v8/@PAULUSARDE-9763b.jpeg',
    title: 'Ready to Snap',
    year: 2024,
    event: ['8v8'],
    eventSub: '8v8 League 2024',
    team: [],
    featured: true
  },
  {
    src: 'photo-assets/2024/8v8/@PAULUSARDE-9990.jpeg',
    title: 'The Defensive Line',
    year: 2024,
    event: ['8v8'],
    eventSub: '8v8 League 2024',
    team: [],
    featured: true
  },

  // 2024 · Open SZN 2
  {
    src: 'photo-assets/2024/Open SZN 2/@PAULUSARDE-2095.jpg',
    title: 'The Release',
    year: 2024,
    event: ['Open SZN'],
    eventSub: 'Open SZN 2',
    team: [],
    featured: true
  },
  {
    src: 'photo-assets/2024/Open SZN 2/@PAULUSARDE-4021.jpg',
    title: 'Squad Up',
    year: 2024,
    event: ['Open SZN'],
    eventSub: 'Open SZN 2',
    team: [],
    featured: true
  },

  // 2025 · 8v8 League
  {
    src: 'photo-assets/2025/8v8/@PAULUSARDE (349 of 2142).jpg',
    title: 'The Huddle',
    year: 2025,
    event: ['8v8'],
    eventSub: '8v8 League 2025',
    team: [],
    featured: true
  },
  {
    src: 'photo-assets/2025/8v8/@PAULUSARDE (911 of 2142).jpg',
    title: 'Got Your Flag',
    year: 2025,
    event: ['8v8'],
    eventSub: '8v8 League 2025',
    team: [],
    featured: true
  },
  {
    src: 'photo-assets/2025/8v8/@PAULUSARDE (1432 of 2142).jpg',
    title: 'Victory Lift',
    year: 2025,
    event: ['8v8'],
    eventSub: '8v8 League 2025',
    team: [],
    featured: true
  },
  {
    src: 'photo-assets/2025/8v8/@PAULUSARDE (1473 of 2142).jpg',
    title: 'Incomplete',
    year: 2025,
    event: ['8v8'],
    eventSub: '8v8 League 2025',
    team: [],
    featured: true
  },
  {
    src: 'photo-assets/2025/8v8/@PAULUSARDE (1694 of 2142).jpg',
    title: 'Quick Release',
    year: 2025,
    event: ['8v8'],
    eventSub: '8v8 League 2025',
    team: [],
    featured: true
  },
  {
    src: 'photo-assets/2025/8v8/@PAULUSARDE (1824 of 2142).jpg',
    title: 'After the Catch',
    year: 2025,
    event: ['8v8'],
    eventSub: '8v8 League 2025',
    team: [],
    featured: true
  },

  // 2025 · Open SZN 3
  {
    src: 'photo-assets/2025/Open SZN 3/@PAULUSARDE (1302 of 4098).jpg',
    title: 'Diving Reach',
    year: 2025,
    event: ['Open SZN'],
    eventSub: 'Open SZN 3',
    team: [],
    featured: true
  },
  {
    src: 'photo-assets/2025/Open SZN 3/@PAULUSARDE (2062 of 2493).jpg',
    title: 'Touchdown Hype',
    year: 2025,
    event: ['Open SZN'],
    eventSub: 'Open SZN 3',
    team: [],
    featured: true
  },
  {
    src: 'photo-assets/2025/Open SZN 3/@PAULUSARDE (3408 of 4098).jpg',
    title: 'Going Up',
    year: 2025,
    event: ['Open SZN'],
    eventSub: 'Open SZN 3',
    team: [],
    featured: true
  },
  {
    src: 'photo-assets/2025/Open SZN 3/@PAULUSARDE (3436 of 3476).jpg',
    title: 'Open SZN 3 Champions',
    year: 2025,
    event: ['Open SZN'],
    eventSub: 'Open SZN 3',
    team: [],
    featured: true
  },
  {
    src: 'photo-assets/2025/Open SZN 3/@PAULUSARDE-8956.jpg',
    title: 'Playing Through Rain',
    year: 2025,
    event: ['Open SZN'],
    eventSub: 'Open SZN 3',
    team: [],
    featured: true
  },

  // 2025 · WFF
  {
    src: 'photo-assets/2025/WFF/rrshutterspeed-323.jpg',
    title: 'Touchdown Celebration',
    year: 2025,
    event: ['WFF'],
    eventSub: 'Open SZN 3',
    team: [],
    featured: true
  },


  // ── 2021 ────────────────────────────────────────────────────────────────

  {
    src: 'photo-assets/2021/2021jff_philo.jpg',
    title: 'JFF Origins',
    year: 2021,
    event: [],
    eventSub: '',
    team: [],
    featured: false
  },


  // ── 2022 · Community Sessions ────────────────────────────────────────────

  {
    src: 'photo-assets/2022/@SHOWTIME.INA-2.JPG',
    title: 'Flag Football Beginnings',
    year: 2022,
    event: ['Community Sessions', 'WFF'],
    eventSub: '',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2022/@SHOWTIME.INA-13.JPG',
    title: 'Early Days',
    year: 2022,
    event: ['Community Sessions', 'WFF'],
    eventSub: '',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2022/@SHOWTIME.INA-131.JPG',
    title: 'First Downs',
    year: 2022,
    event: ['Community Sessions', 'WFF'],
    eventSub: '',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2022/@SHOWTIME.INA-1294.JPG',
    title: 'Community Game Day',
    year: 2022,
    event: ['Community Sessions', 'WFF'],
    eventSub: '',
    team: [],
    featured: false
  },


  // ── 2023 · Community Sessions ────────────────────────────────────────────

  {
    src: 'photo-assets/2023/RR -679.jpg',
    title: 'Game Day Vibes',
    year: 2023,
    event: ['Community Sessions'],
    eventSub: '',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2023/RR -688.jpg',
    title: 'On the Field',
    year: 2023,
    event: ['Community Sessions'],
    eventSub: '',
    team: [],
    featured: false
  },


  // ── 2023 · 8v8 League ────────────────────────────────────────────────────

  {
    src: 'photo-assets/2023/8v8/@PAULUSARDE-4696.jpeg',
    title: 'Line of Scrimmage',
    year: 2023,
    event: ['8v8'],
    eventSub: '8v8 League 2023',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2023/8v8/@PAULUSARDE-6288.jpeg',
    title: 'Breaking Through',
    year: 2023,
    event: ['8v8'],
    eventSub: '8v8 League 2023',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2023/8v8/@PAULUSARDE-8423.jpg',
    title: 'Champions',
    year: 2023,
    event: ['8v8'],
    eventSub: '8v8 League 2023',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2023/8v8/@PAULUSARDE-8424.jpg',
    title: 'Family',
    year: 2023,
    event: ['8v8'],
    eventSub: '8v8 League 2023',
    team: [],
    featured: false
  },


  // ── 2023 · Open SZN 1 ────────────────────────────────────────────────────

  {
    src: 'photo-assets/2023/Open SZN 1/@PAULUSARDE-2758.jpg',
    title: 'First Play',
    year: 2023,
    event: ['Open SZN'],
    eventSub: 'Open SZN 1',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2023/Open SZN 1/@PAULUSARDE-2892.jpg',
    title: 'Route Running',
    year: 2023,
    event: ['Open SZN'],
    eventSub: 'Open SZN 1',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2023/Open SZN 1/@PAULUSARDE-3750.jpg',
    title: 'Celebrations',
    year: 2023,
    event: ['Open SZN'],
    eventSub: 'Open SZN 1',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2023/Open SZN 1/@PAULUSARDE-3911.jpg',
    title: 'The Squad',
    year: 2023,
    event: ['Open SZN'],
    eventSub: 'Open SZN 1',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2023/Open SZN 1/@PAULUSARDE-4103.jpg',
    title: 'Extend',
    year: 2023,
    event: ['Open SZN'],
    eventSub: 'Open SZN 1',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2023/Open SZN 1/@PAULUSARDE-4336.jpg',
    title: 'Lineup',
    year: 2023,
    event: ['Open SZN'],
    eventSub: 'Open SZN 1',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2023/Open SZN 1/@PAULUSARDE-4397.jpg',
    title: 'Jump Ball',
    year: 2023,
    event: ['Open SZN'],
    eventSub: 'Open SZN 1',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2023/Open SZN 1/@PAULUSARDE-4476.jpg',
    title: 'Wide Receiver',
    year: 2023,
    event: ['Open SZN'],
    eventSub: 'Open SZN 1',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2023/Open SZN 1/@PAULUSARDE-6147.jpg',
    title: 'Battle',
    year: 2023,
    event: ['Open SZN'],
    eventSub: 'Open SZN 1',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2023/Open SZN 1/@PAULUSARDE-6263.jpg',
    title: 'Wide Open',
    year: 2023,
    event: ['Open SZN'],
    eventSub: 'Open SZN 1',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2023/Open SZN 1/@PAULUSARDE-6583.jpg',
    title: 'On his way',
    year: 2023,
    event: ['Open SZN'],
    eventSub: 'Open SZN 1',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2023/Open SZN 1/@PAULUSARDE-7037.jpg',
    title: 'Game Changer',
    year: 2023,
    event: ['Open SZN'],
    eventSub: 'Open SZN 1',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2023/Open SZN 1/RR CGN vs EGSYG-274.jpg',
    title: 'Competition',
    year: 2023,
    event: ['Open SZN'],
    eventSub: 'Open SZN 1',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2023/Open SZN 1/RR TBG vs FRA-707.jpg',
    title: 'TBG vs FRA',
    year: 2023,
    event: ['Open SZN'],
    eventSub: 'Open SZN 1',
    team: [],
    featured: false
  },


  // ── 2024 · 8v8 League ────────────────────────────────────────────────────

  {
    src: 'photo-assets/2024/8v8/@PAULUSARDE-0330.jpeg',
    title: 'Rollout',
    year: 2024,
    event: ['8v8'],
    eventSub: '8v8 League 2024',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2024/8v8/@PAULUSARDE-8046.jpeg',
    title: 'Reading the Defense',
    year: 2024,
    event: ['8v8'],
    eventSub: '8v8 League 2024',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2024/8v8/@PAULUSARDE-8258.jpeg',
    title: 'Officiating',
    year: 2024,
    event: ['8v8'],
    eventSub: '8v8 League 2024',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2024/8v8/@PAULUSARDE-8642.jpeg',
    title: 'Eyeing the Interception',
    year: 2024,
    event: ['8v8'],
    eventSub: '8v8 League 2024',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2024/8v8/@PAULUSARDE-9047.jpeg',
    title: 'Flag Hunt',
    year: 2024,
    event: ['8v8'],
    eventSub: '8v8 League 2024',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2024/8v8/@PAULUSARDE-9194.jpeg',
    title: 'Momentum Shift',
    year: 2024,
    event: ['8v8'],
    eventSub: '8v8 League 2024',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2024/8v8/@PAULUSARDE-9763.jpeg',
    title: 'Under Pressure',
    year: 2024,
    event: ['8v8'],
    eventSub: '8v8 League 2024',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2024/8v8/@PAULUSARDE-9832.jpeg',
    title: 'Sideline Catch',
    year: 2024,
    event: ['8v8'],
    eventSub: '8v8 League 2024',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2024/8v8/@PAULUSARDE-9992.jpeg',
    title: 'Red Zone Play',
    year: 2024,
    event: ['8v8'],
    eventSub: '8v8 League 2024',
    team: [],
    featured: false
  },


  // ── 2024 · Open SZN 2 ────────────────────────────────────────────────────

  {
    src: 'photo-assets/2024/Open SZN 2/KVN00013.jpg',
    title: 'Pre-game',
    year: 2024,
    event: ['Open SZN'],
    eventSub: 'Open SZN 2',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2024/Open SZN 2/KVN00083.jpg',
    title: 'Quick Slant',
    year: 2024,
    event: ['Open SZN'],
    eventSub: 'Open SZN 2',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2024/Open SZN 2/KVN00170.jpg',
    title: 'Juke',
    year: 2024,
    event: ['Open SZN'],
    eventSub: 'Open SZN 2',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2024/Open SZN 2/KVN00340.jpg',
    title: 'The Snap',
    year: 2024,
    event: ['Open SZN'],
    eventSub: 'Open SZN 2',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2024/Open SZN 2/KVN00777.jpg',
    title: 'Fourth Down',
    year: 2024,
    event: ['Open SZN'],
    eventSub: 'Open SZN 2',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2024/Open SZN 2/KVN01347.jpg',
    title: 'Pose',
    year: 2024,
    event: ['Open SZN'],
    eventSub: 'Open SZN 2',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2024/Open SZN 2/KVN01498.jpg',
    title: 'Backfield Action',
    year: 2024,
    event: ['Open SZN'],
    eventSub: 'Open SZN 2',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2024/Open SZN 2/KVN02165.jpg',
    title: 'Reach',
    year: 2024,
    event: ['Open SZN'],
    eventSub: 'Open SZN 2',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2024/Open SZN 2/KVN02347.jpg',
    title: 'Clutch',
    year: 2024,
    event: ['Open SZN'],
    eventSub: 'Open SZN 2',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2024/Open SZN 2/KVN02409.jpg',
    title: 'Through the Mud',
    year: 2024,
    event: ['Open SZN'],
    eventSub: 'Open SZN 2',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2024/Open SZN 2/KVN03283.jpg',
    title: 'Final Drive',
    year: 2024,
    event: ['Open SZN'],
    eventSub: 'Open SZN 2',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2024/Open SZN 2/RR OPENSZN 2-1.jpg',
    title: 'Game Energy',
    year: 2024,
    event: ['Open SZN'],
    eventSub: 'Open SZN 2',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2024/Open SZN 2/RR OPENSZN 2-1 (1).jpg',
    title: 'Game Opener',
    year: 2024,
    event: ['Open SZN'],
    eventSub: 'Open SZN 2',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2024/Open SZN 2/RR OPENSZN 2-103.jpg',
    title: 'Second Half Push',
    year: 2024,
    event: ['Open SZN'],
    eventSub: 'Open SZN 2',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2024/Open SZN 2/RR OPENSZN 2-144.jpg',
    title: 'In Between',
    year: 2024,
    event: ['Open SZN'],
    eventSub: 'Open SZN 2',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2024/Open SZN 2/RR OPENSZN 2-255.jpg',
    title: 'Sack',
    year: 2024,
    event: ['Open SZN'],
    eventSub: 'Open SZN 2',
    team: [],
    featured: false
  },


  // ── 2025 · 8v8 League ────────────────────────────────────────────────────

  {
    src: 'photo-assets/2025/8v8/@PAULUSARDE (875 of 2142).jpg',
    title: 'Focus',
    year: 2025,
    event: ['8v8'],
    eventSub: '8v8 League 2025',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2025/8v8/@PAULUSARDE (951 of 2142).jpg',
    title: 'His Game',
    year: 2025,
    event: ['8v8'],
    eventSub: '8v8 League 2025',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2025/8v8/@PAULUSARDE (1001 of 1830).jpg',
    title: 'The Trench',
    year: 2025,
    event: ['8v8'],
    eventSub: '8v8 League 2025',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2025/8v8/@PAULUSARDE (1506 of 2142).jpg',
    title: 'Handoff',
    year: 2025,
    event: ['8v8'],
    eventSub: '8v8 League 2025',
    team: [],
    featured: false
  },
  {
    src: 'photo-assets/2025/8v8/LIF_3103.jpg',
    title: 'Team Energy',
    year: 2025,
    event: ['8v8'],
    eventSub: '8v8 League 2025',
    team: [],
    featured: false
  },

];
