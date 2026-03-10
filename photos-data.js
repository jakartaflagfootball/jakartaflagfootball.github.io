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
 *   event     — event type string — drives Event filter pills
 *                 current values: "Open SZN" | "Devzone" | "8v8" | "WFF" | "Community Sessions"
 *                 adding a new value here auto-creates a new pill
 *   eventSub  — specific sub-event (e.g. "Open SZN 3") — used for tournament card linking later
 *   team      — array of team names in the photo — used for team card linking later
 *   featured  — true = included in the default 20 shown when no filters are active
 */

window.PHOTOS = [
  {
    src: 'photo-assets/@keyzaramadiva-1135.jpg',
    title: 'Womens of the Community',
    year: 2022,
    event: 'Community Sessions',
    eventSub: '',
    team: [],
    featured: true
  },
  {
    src: 'photo-assets/@PAULUSARDE (1302 of 4098).jpg',
    title: 'Diving Reach',
    year: 2025,
    event: 'Open SZN',
    eventSub: 'Open SZN 3',
    team: [],
    featured: true
  },
  {
    src: 'photo-assets/@PAULUSARDE (2062 of 2493).jpg',
    title: 'Touchdown Hype',
    year: 2025,
    event: 'Open SZN',
    eventSub: 'Open SZN 3',
    team: [],
    featured: true
  },
  {
    src: 'photo-assets/@PAULUSARDE (3408 of 4098).jpg',
    title: 'Going Up',
    year: 2025,
    event: 'Open SZN',
    eventSub: 'Open SZN 3',
    team: [],
    featured: true
  },
  {
    src: 'photo-assets/@PAULUSARDE (3436 of 3476).jpg',
    title: 'Open SZN 3 Champions',
    year: 2025,
    event: 'Open SZN',
    eventSub: 'Open SZN 3',
    team: [],
    featured: true
  },
  {
    src: 'photo-assets/@PAULUSARDE-2095.jpg',
    title: 'The Release',
    year: 2024,
    event: 'Open SZN',
    eventSub: 'Open SZN 2',
    team: [],
    featured: true
  },
  {
    src: 'photo-assets/@PAULUSARDE-2367 copy.jpeg',
    title: 'Fan Hype',
    year: 2023,
    event: '8v8',
    eventSub: '8v8 League 2023',
    team: [],
    featured: true
  },
  {
    src: 'photo-assets/@PAULUSARDE-4021.jpg',
    title: 'Squad Up',
    year: 2024,
    event: 'Open SZN',
    eventSub: 'Open SZN 2',
    team: [],
    featured: true
  },
  {
    src: 'photo-assets/@PAULUSARDE-8956.jpg',
    title: 'Playing Through Rain',
    year: 2025,
    event: 'Open SZN',
    eventSub: 'Open SZN 3',
    team: [],
    featured: true
  },
  {
    src: 'photo-assets/@SHOWTIME.INA-293.JPG',
    title: 'OGs of JFF',
    year: 2023,
    event: 'Community Sessions',
    eventSub: '',
    team: [],
    featured: true
  },
  {
    src: 'photo-assets/@SHOWTIME.INA-1214.JPG',
    title: 'Night Lights',
    year: 2022,
    event: 'Community Sessions',
    eventSub: '',
    team: [],
    featured: true
  },
  {
    src: 'photo-assets/rrshutterspeed-323.jpg',
    title: 'Touchdown Celebration',
    year: 2025,
    event: 'WFF',
    eventSub: 'Open SZN 3',
    team: [],
    featured: true
  },
  {
    src: 'photo-assets/@PAULUSARDE-9990.jpeg',
    title: 'The Defensive Line',
    year: 2024,
    event: '8v8',
    eventSub: '8v8 League 2024',
    team: [],
    featured: true
  },
  {
    src: 'photo-assets/@PAULUSARDE-9763.jpeg',
    title: 'Ready to Snap',
    year: 2024,
    event: '8v8',
    eventSub: '8v8 League 2024',
    team: [],
    featured: true
  },
  {
    src: 'photo-assets/@PAULUSARDE (1824 of 2142).jpg',
    title: 'After the Catch',
    year: 2025,
    event: '8v8',
    eventSub: '8v8 League 2025',
    team: [],
    featured: true
  },
  {
    src: 'photo-assets/@PAULUSARDE (1473 of 2142).jpg',
    title: 'Incomplete',
    year: 2025,
    event: '8v8',
    eventSub: '8v8 League 2025',
    team: [],
    featured: true
  },
  {
    src: 'photo-assets/@PAULUSARDE (1694 of 2142).jpg',
    title: 'Quick Release',
    year: 2025,
    event: '8v8',
    eventSub: '8v8 League 2025',
    team: [],
    featured: true
  },
  {
    src: 'photo-assets/@PAULUSARDE (911 of 2142).jpg',
    title: 'Got Your Flag',
    year: 2025,
    event: '8v8',
    eventSub: '8v8 League 2025',
    team: [],
    featured: true
  },
  {
    src: 'photo-assets/@PAULUSARDE (1432 of 2142).jpg',
    title: 'Victory Lift',
    year: 2025,
    event: '8v8',
    eventSub: '8v8 League 2025',
    team: [],
    featured: true
  },
  {
    src: 'photo-assets/@PAULUSARDE (349 of 2142).jpg',
    title: 'The Huddle',
    year: 2025,
    event: '8v8',
    eventSub: '8v8 League 2025',
    team: [],
    featured: true
  },
];
