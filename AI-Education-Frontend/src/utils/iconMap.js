// The backend's Feature.menu_icon column (served via GET /api/menu) was
// seeded using PrimeIcons ("pi pi-xxx") and Font Awesome ("fa-xxx" /
// "fa fa-xxx") class-name conventions, from a different (PrimeNG/Angular)
// frontend that shared the same Feature table. This app renders icons with
// Google's Material Symbols ligature font, which only draws a glyph when
// the text it's given is one of *its* recognized icon names - anything
// else (e.g. "pi pi-home") just prints as literal text on screen.
//
// This map translates the known PrimeIcons/FontAwesome values seeded in
// the DB to their closest Material Symbols equivalent. It's intentionally
// keyed on the *normalized* icon token (prefix + separators stripped), so
// "pi pi-home", "pi-home", and "fa fa-home" all resolve the same way.
const ICON_NAME_MAP = {
  // Navigation / general
  home: 'home',
  dashboard: 'dashboard',
  th: 'dashboard', // pi pi-th (grid icon, commonly used for dashboards)
  bars: 'menu',

  // People / accounts
  user: 'person',
  users: 'group',
  'user-doctor': 'stethoscope',
  'address-book': 'contacts',
  'supervisor-account': 'supervisor_account',

  // Org / places
  building: 'domain',
  briefcase: 'work',
  sitemap: 'account_tree',

  // Security
  shield: 'shield',
  lock: 'lock',
  key: 'vpn_key',

  // Calendar / time
  calendar: 'calendar_month',
  clock: 'schedule',
  history: 'history',

  // Files / content
  file: 'description',
  'file-o': 'description',
  folder: 'folder',
  'folder-open': 'folder_open',
  book: 'menu_book',
  'address-card': 'badge',

  // Actions / status
  cog: 'settings',
  gear: 'settings',
  wrench: 'build',
  bolt: 'bolt',
  check: 'check',
  'check-circle': 'check_circle',
  times: 'close',
  'exclamation-circle': 'error',
  'exclamation-triangle': 'warning',
  'question-circle': 'help',
  question: 'help',
  info: 'info',
  'info-circle': 'info',
  bell: 'notifications',
  envelope: 'mail',
  chart: 'bar_chart',
  'chart-bar': 'bar_chart',
  'chart-line': 'show_chart',
  wallet: 'wallet',
  'credit-card': 'credit_card',
  terminal: 'terminal',
  circle: 'circle',
  plus: 'add',
  'plus-circle': 'add_circle',
  'sign-out': 'logout',
  'sign-in': 'login',

  // Education module (Font Awesome "fas fa-x" tokens seeded for the
  // AI Tutor / Practice / Progress / Notes / Bookmarks / Achievements
  // menu tree) - none of these overlapped with the healthcare-app
  // tokens above, so they were all silently falling back to the
  // generic 'label' icon.
  robot: 'smart_toy',
  comments: 'forum',
  'book-open': 'auto_stories',
  route: 'alt_route',
  'pencil-alt': 'edit_note',
  tags: 'sell',
  'clipboard-check': 'fact_check',
  'sticky-note': 'sticky_note_2',
  trophy: 'emoji_events',
  'file-alt': 'description',
  'chart-pie': 'pie_chart',
  'calendar-alt': 'calendar_month',
  list: 'list',
  clone: 'style',
  'diagram-project': 'account_tree',
  'layer-group': 'layers',
  'project-diagram': 'account_tree',
  brain: 'psychology',
  lightbulb: 'lightbulb',
  bookmark: 'bookmark',
  bookmarks: 'bookmarks',
  'graduation-cap': 'school',
  chalkboard: 'co_present',
  'chalkboard-teacher': 'co_present',
  tasks: 'task_alt',
};

// A handful of the education Feature rows were seeded with menu_icon
// values from react-icons instead of PrimeIcons/Font Awesome - e.g.
// "rx/RxDashboard", "ri/RiChatAi3Line" (library prefix + PascalCase
// component name, slash-separated). The pi/fa guard below doesn't
// recognize this shape at all (no space/dash after the prefix), so these
// were falling through as "already a valid Material Symbols name" and
// rendering as raw text on screen ("RX/RXDASHBOARD", "MD/MDOUTLINE...").
// Mapped explicitly here, keyed on the lowercased full "prefix/Name"
// value, since react-icons spans dozens of unrelated libraries (rx, ri,
// si, gi, fa6, md, bs, ai, bi, io, tb...) with no common naming
// convention to normalize automatically the way pi/fa can be.
const REACT_ICON_NAME_MAP = {
  'md/mdoutlinedashboard': 'dashboard',
  'ri/richatai3line': 'smart_toy',
  'si/sigreatlearning': 'school',
  'gi/giconvergencetarget': 'target',
  'fa6/fabarsprogress': 'trending_up',
  'fa6/faregnotesticky': 'sticky_note_2',
  'fa/fabookmark': 'bookmark',
  'rx/rxdashboard': 'emoji_events', // Achievements - RxDashboard is a mismatched icon choice upstream, mapped to something that actually fits the feature
};

/**
 * A react-icons-style spec looks like "prefix/PascalCaseName" (e.g.
 * "rx/RxDashboard", "fa6/FaBarsProgress") - short lowercase library
 * prefix, a slash, then a capitalized component name. Used as a safety
 * net: any value shaped like this that ISN'T in REACT_ICON_NAME_MAP above
 * still gets caught and sent to the neutral fallback, rather than being
 * mistaken for an already-valid Material Symbols name and leaking onto
 * the screen as literal text.
 */
const looksLikeReactIconSpec = (raw) => /^[a-z0-9]{1,8}\/[A-Z][A-Za-z0-9]*$/.test(raw.trim());

/**
 * Strip a PrimeIcons ("pi pi-home") or Font Awesome ("fa-home", "fa fa-home")
 * class string down to its bare token ("home").
 */
const normalizeIconToken = (raw) => {
  if (typeof raw !== 'string') return '';
  return raw
    .trim()
    .toLowerCase()
    .replace(/^(pi|fa|fas|far|fal|fab)(\s|-)+/, '') // leading library prefix
    .replace(/^(pi|fa|fas|far|fal|fab)-/, '') // e.g. "pi-home" without the space form
    .trim();
};

/**
 * Resolve a menu icon value (which may already be a valid Material Symbols
 * name, e.g. hardcoded entries like 'dashboard', or a PrimeIcons/Font
 * Awesome class string from the backend) to a Material Symbols name that
 * will actually render a glyph.
 *
 * Falls back to a generic icon rather than ever handing the raw string to
 * the <span className="material-symbols-outlined"> ligature font, so an
 * unmapped backend value degrades to a neutral bullet instead of garbled
 * text like "PI PI-HOME" on screen.
 */
export const resolveMenuIcon = (icon, fallback = 'label') => {
  if (typeof icon !== 'string' || !icon.trim()) return fallback;

  const trimmedLower = icon.trim().toLowerCase();

  // react-icons style spec ("rx/RxDashboard") - check the explicit map
  // first, then fall back safely rather than passing the raw spec
  // through, even for prefixes not covered above.
  if (looksLikeReactIconSpec(icon)) {
    return REACT_ICON_NAME_MAP[trimmedLower] || fallback;
  }

  // Not a "pi pi-x" / "fa-x" style class at all - most likely already a
  // valid Material Symbols name (all the hardcoded menuItems in
  // Sidebar.jsx are, e.g. 'dashboard', 'menu_book', 'analytics') so pass
  // it through unchanged.
  if (!/^(pi|fa|fas|far|fal|fab)(\s|-)/.test(icon.trim().toLowerCase())) {
    return icon;
  }

  const token = normalizeIconToken(icon);
  return ICON_NAME_MAP[token] || fallback;
};

export default resolveMenuIcon;