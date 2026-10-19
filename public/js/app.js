// HD STREAM — Live Sports & OTT Admin Dashboard Application Controller

const state = {
  adminKey: localStorage.getItem('hd_stream_admin_key') || 'admin123',
  matches: [],
  categories: [],
  vods: [],
  settings: {},
  stats: {},
  activeTab: 'overview',
  activeFilter: 'ALL'
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initNav();
  initInputs();
  fetchAllData();

  // Auto-refresh stats & live events every 30 seconds
  setInterval(fetchDashboardStats, 30000);
});

function initClock() {
  const clock = document.getElementById('current-clock');
  function update() {
    if (clock) {
      const now = new Date();
      clock.textContent = now.toUTCString().replace('GMT', 'UTC');
    }
  }
  update();
  setInterval(update, 1000);
}

function initNav() {
  // Desktop sidebar navigation
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      const tabId = link.getAttribute('data-tab');
      switchTab(tabId);
    });
  });

  // Mobile menu button
  const mobileBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('sidebar');
  if (mobileBtn && sidebar) {
    mobileBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }
}

function initInputs() {
  const keyInput = document.getElementById('input-admin-key');
  if (keyInput) keyInput.value = state.adminKey;

  // Set Feed URLs
  const mobileFeed = document.getElementById('feed-url-mobile');
  const m3uFeed = document.getElementById('feed-url-m3u');
  const origin = window.location.origin;

  if (mobileFeed) mobileFeed.textContent = `${origin}/api/feed/mobile`;
  if (m3uFeed) m3uFeed.textContent = `${origin}/api/feed/playlist.m3u`;
}

function switchTab(tabId) {
  state.activeTab = tabId;

  // Update nav link active state
  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.toggle('active', l.getAttribute('data-tab') === tabId);
  });

  // Update tab pane visibility
  document.querySelectorAll('.tab-pane').forEach(p => {
    p.classList.add('hidden');
    p.classList.remove('active');
  });

  const targetPane = document.getElementById(`tab-${tabId}`);
  if (targetPane) {
    targetPane.classList.remove('hidden');
    targetPane.classList.add('active');
  }

  // Header Title Updates
  const title = document.getElementById('page-title');
  const desc = document.getElementById('page-desc');

  const titles = {
    overview: ['Overview Dashboard', 'Real-time control center for live matches, streaming sources, and DRM keys.'],
    matches: ['Live Events & Cricket Broadcasts', 'Manage matches, scoreboards, and multi-server streaming feeds.'],
    categories: ['Categories & Channels', 'Organize content categories displayed on mobile app home screen.'],
    vod: ['Entertainment VOD & Shows', 'Manage reality shows, series like Bigg Boss, and episodes.'],
    feeds: ['Mobile API & M3U8 Feeds', 'Sync live endpoints with Android app and OTT players.'],
    player: ['In-Admin Live Stream Tester', 'Test video streaming quality, latency, and audio before broadcasting.'],
    settings: ['App Settings & Maintenance', 'Manage admin authentication, announcements, and APK updates.']
  };

  if (titles[tabId]) {
    if (title) title.textContent = titles[tabId][0];
    if (desc) desc.textContent = titles[tabId][1];
  }

  // Close mobile sidebar if open
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.remove('open');
}

// --- API CLIENT ---
async function apiRequest(endpoint, method = 'GET', body = null) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Admin-Key': state.adminKey
  };

  const options = { method, headers };
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(endpoint, options);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    showToast(`Network error: ${err.message}`, 'error');
    throw err;
  }
}

// --- DATA FETCHING ---
const defaultSampleData = {
  stats: { liveEvents: 2, upcomingEvents: 2, totalStreams: 8, drmStreamsCount: 2, vodShowsCount: 2, totalEpisodes: 9 },
  matches: [
    {
      _id: 'match_01',
      title: 'Cricket || ICC CWC League 2',
      category: 'Cricket',
      status: 'LIVE',
      matchFormat: 'ODI',
      startTime: '05:06:32',
      team1: { name: 'Oman', shortName: 'OMA', flag: '🇴🇲', score: '210/6 (42 ov)' },
      team2: { name: 'Nepal', shortName: 'NEP', flag: '🇳🇵', score: 'Target: 235' },
      streams: [
        { id: 's1', title: 'ICC TV (1080p 60FPS)', streamType: 'M3U8', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', quality: '1080p', isActive: true },
        { id: 's2', title: 'SK LIVE (720p Low Latency)', streamType: 'M3U8', streamUrl: 'https://cph-p2p-msl.akamaized.net/hls/live/200034/test/master.m3u8', quality: '720p', isActive: true }
      ]
    },
    {
      _id: 'match_02',
      title: 'Cricket || ICC World Test Championship',
      category: 'Cricket',
      status: 'LIVE',
      matchFormat: 'Test',
      startTime: '02:36:32',
      team1: { name: 'South Africa', shortName: 'SA', flag: '🇿🇦', score: '380/7' },
      team2: { name: 'Australia', shortName: 'AUS', flag: '🇦🇺', score: '295 all out' },
      streams: [
        { id: 's3', title: 'ICC TV', streamType: 'M3U8', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', quality: '1080p', isActive: true },
        { id: 's4', title: 'SK LIVE', streamType: 'M3U8', streamUrl: 'https://cph-p2p-msl.akamaized.net/hls/live/200034/test/master.m3u8', quality: '720p', isActive: true }
      ]
    },
    {
      _id: 'match_03',
      title: 'Cricket || ODI Tri-Series in United Arab Emirates',
      category: 'Cricket',
      status: 'UPCOMING',
      matchFormat: 'ODI',
      startTime: '05:00 PM',
      team1: { name: 'Afghanistan', shortName: 'AFG', flag: '🇦🇫', score: '' },
      team2: { name: 'Zimbabwe', shortName: 'ZIM', flag: '🇿🇼', score: '' },
      streams: [
        { id: 's5', title: 'ICC TV', streamType: 'M3U8', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', quality: '1080p', isActive: true },
        { id: 's6', title: 'SK LIVE', streamType: 'M3U8', streamUrl: 'https://cph-p2p-msl.akamaized.net/hls/live/200034/test/master.m3u8', quality: '720p', isActive: true }
      ]
    },
    {
      _id: 'match_04',
      title: 'Football || Saudi Pro League',
      category: 'Football',
      status: 'UPCOMING',
      matchFormat: 'SPL',
      startTime: '08:35 PM',
      team1: { name: 'Al-Fayha', shortName: 'FAY', flag: '⚽', score: '' },
      team2: { name: 'Al-Ahli', shortName: 'AHL', flag: '🇸🇦', score: '' },
      streams: [
        { id: 's7', title: 'Server 1 HD', streamType: 'M3U8', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', quality: '1080p', isActive: true },
        { id: 's8', title: 'Server 2', streamType: 'M3U8', streamUrl: 'https://cph-p2p-msl.akamaized.net/hls/live/200034/test/master.m3u8', quality: '720p', isActive: true }
      ]
    }
  ],
  categories: [
    { _id: 'c1', name: 'BIG BOSS', slug: 'big-boss', icon: 'fas fa-tv', order: 1 },
    { _id: 'c2', name: 'House With Rohit', slug: 'rohit-house', icon: 'fas fa-baseball-bat-ball', order: 2 },
    { _id: 'c3', name: 'FC LIVE', slug: 'fancode-live', icon: 'fas fa-satellite-dish', order: 3 },
    { _id: 'c4', name: 'SONY LIVE', slug: 'sony-live', icon: 'fas fa-play', order: 4 },
    { _id: 'c5', name: 'JTV+', slug: 'jtv-plus', icon: 'fas fa-tv', order: 5 },
    { _id: 'c6', name: 'JIOSTAR', slug: 'jiostar', icon: 'fas fa-star', order: 6 },
    { _id: 'c7', name: 'ZEE GLOBAL', slug: 'zee-global', icon: 'fas fa-globe', order: 7 },
    { _id: 'c8', name: 'JIO CINEMA', slug: 'jio-cinema', icon: 'fas fa-film', order: 8 },
    { _id: 'c9', name: 'SUN NXT', slug: 'sun-nxt', icon: 'fas fa-sun', order: 9 },
    { _id: 'c10', name: 'DISH TV', slug: 'dish-tv', icon: 'fas fa-satellite', order: 10 }
  ],
  vods: [
    {
      _id: 'vod_1',
      title: 'Family Full House With Rohit Sharma',
      category: 'House With Rohit',
      totalEpisodes: 5,
      episodes: [
        { id: 'e1', episodeNumber: 1, title: 'Episode 1', duration: '45m', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
        { id: 'e2', episodeNumber: 2, title: 'Episode 2', duration: '50m', streamUrl: 'https://cph-p2p-msl.akamaized.net/hls/live/200034/test/master.m3u8' },
        { id: 'e3', episodeNumber: 3, title: 'Episode 3', duration: '48m', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
        { id: 'e4', episodeNumber: 4, title: 'Episode 4', duration: '52m', streamUrl: 'https://cph-p2p-msl.akamaized.net/hls/live/200034/test/master.m3u8' },
        { id: 'e5', episodeNumber: 5, title: 'Episode 5', duration: '55m', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' }
      ]
    }
  ],
  settings: {
    announcement: '🌐 WEBSITE UPDATED! 🔄 Bookmark our new website 📌 sktech.live',
    appVersion: '2.0.0',
    apkDownloadUrl: 'http://10.129.81.207:8080/HD-STREAM.apk',
    maintenanceMode: false
  }
};

async function fetchAllData() {
  try {
    await Promise.all([
      fetchDashboardStats(),
      fetchMatches(),
      fetchCategories(),
      fetchVods(),
      fetchSettings()
    ]);
  } catch (err) {
    console.warn('Backend offline, loading sample live state:', err);
    loadFallbackData();
  }
}

function loadFallbackData() {
  state.stats = defaultSampleData.stats;
  updateStatsUI(state.stats);

  state.matches = defaultSampleData.matches;
  renderMatchesList();
  renderOverviewLiveList();

  state.categories = defaultSampleData.categories;
  renderCategoriesTable();
  populateCategoryDropdowns();

  state.vods = defaultSampleData.vods;
  renderVodGrid();

  state.settings = defaultSampleData.settings;
  populateSettingsInputs(state.settings);

  const badge = document.getElementById('db-status-badge');
  const host = document.getElementById('db-host-text');
  if (badge) {
    badge.className = 'font-bold text-orange-400 flex items-center gap-1.5';
    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-orange-400"></span> Live Interactive Mode`;
  }
  if (host) host.textContent = 'Free 24/7 Cloud Ready (Vercel/Render)';
}

async function fetchDashboardStats() {
  try {
    const res = await apiRequest('/api/stats');
    if (res && res.success) {
      state.stats = res.data;
      updateStatsUI(res.data);
    } else {
      updateStatsUI(defaultSampleData.stats);
    }
  } catch (e) {
    updateStatsUI(defaultSampleData.stats);
  }
}

function updateStatsUI(stats) {
  setElemText('stat-live-count', stats.liveEvents || 0);
  setElemText('badge-live-count', stats.liveEvents || 0);
  setElemText('stat-upcoming-count', stats.upcomingEvents || 0);
  setElemText('stat-streams-count', stats.totalStreams || 0);
  setElemText('stat-drm-count', stats.drmStreamsCount || 0);
  setElemText('stat-vod-count', stats.vodShowsCount || 0);
  setElemText('stat-episodes-count', stats.totalEpisodes || 0);
}

async function fetchMatches() {
  try {
    const res = await apiRequest('/api/matches');
    if (res && res.success) {
      state.matches = res.data;
    } else {
      state.matches = defaultSampleData.matches;
    }
  } catch (e) {
    state.matches = defaultSampleData.matches;
  }
  renderMatchesList();
  renderOverviewLiveList();
}

async function fetchCategories() {
  try {
    const res = await apiRequest('/api/categories');
    if (res && res.success) {
      state.categories = res.data;
    } else {
      state.categories = defaultSampleData.categories;
    }
  } catch (e) {
    state.categories = defaultSampleData.categories;
  }
  renderCategoriesTable();
  populateCategoryDropdowns();
}

async function fetchVods() {
  try {
    const res = await apiRequest('/api/vod');
    if (res && res.success) {
      state.vods = res.data;
    } else {
      state.vods = defaultSampleData.vods;
    }
  } catch (e) {
    state.vods = defaultSampleData.vods;
  }
  renderVodGrid();
}

async function fetchSettings() {
  try {
    const res = await apiRequest('/api/settings');
    if (res && res.success) {
      state.settings = res.data;
    } else {
      state.settings = defaultSampleData.settings;
    }
  } catch (e) {
    state.settings = defaultSampleData.settings;
  }
  populateSettingsInputs(state.settings);
}

// --- RENDERING FUNCTIONS ---

function renderOverviewLiveList() {
  const container = document.getElementById('overview-live-list');
  if (!container) return;

  const liveMatches = state.matches.filter(m => m.status === 'LIVE');

  if (liveMatches.length === 0) {
    container.innerHTML = `
      <div class="col-span-2 p-8 text-center bg-slate-900/40 rounded-xl border border-slate-800">
        <i class="fa-solid fa-satellite text-3xl text-slate-500 mb-2"></i>
        <h4 class="font-bold text-slate-300">No matches are streaming live right now</h4>
        <p class="text-xs text-slate-400 mt-1">Click "Add Live Event" to create a match and start streaming.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = liveMatches.map(m => {
    const streamsCount = m.streams?.length || 0;
    return `
      <div class="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-emerald-500/40 transition">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold text-emerald-400 uppercase tracking-wider">${m.category}</span>
          <div class="live-indicator"><span class="live-dot"></span> LIVE</div>
        </div>
        <h4 class="font-bold text-white text-base">${m.title}</h4>
        <div class="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/80 text-xs">
          <div class="text-slate-300 font-mono">
            <span>${m.team1?.shortName || 'T1'}: <strong class="text-emerald-400">${m.team1?.score || '0/0'}</strong></span>
            <span class="mx-2 text-slate-600">vs</span>
            <span>${m.team2?.shortName || 'T2'}: <strong class="text-cyan-400">${m.team2?.score || '0/0'}</strong></span>
          </div>
          <button onclick="openStreamsModal('${m._id}')" class="text-emerald-400 hover:underline font-semibold flex items-center gap-1">
            <i class="fa-solid fa-server"></i> ${streamsCount} Streams &rarr;
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function renderMatchesList() {
  const container = document.getElementById('matches-grid');
  if (!container) return;

  let list = state.matches;
  if (state.activeFilter !== 'ALL') {
    list = list.filter(m => m.status === state.activeFilter);
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="col-span-2 p-12 text-center bg-slate-900/40 rounded-xl border border-slate-800">
        <i class="fa-solid fa-baseball-bat-ball text-4xl text-slate-600 mb-3"></i>
        <h4 class="text-lg font-bold text-slate-300">No events found in this category</h4>
        <p class="text-xs text-slate-400 mt-1">Switch filter or create a new live match.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(m => {
    const isLive = m.status === 'LIVE';
    const statusColor = isLive ? 'bg-red-500/20 text-red-400 border-red-500/30' : (m.status === 'UPCOMING' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-slate-700/30 text-slate-400 border-slate-700');
    const streams = m.streams || [];

    return `
      <div class="glass-panel p-5 space-y-4 relative overflow-hidden group">
        <!-- Card Top Bar -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-slate-400">${m.category}</span>
            ${m.isPinned ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30"><i class="fa-solid fa-thumbtack"></i> PINNED</span>' : ''}
          </div>
          <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusColor} flex items-center gap-1">
            ${isLive ? '<span class="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span>' : ''}
            ${m.status}
          </span>
        </div>

        <!-- Title & Format -->
        <div>
          <h4 class="text-lg font-extrabold text-white group-hover:text-emerald-400 transition leading-snug">${m.title}</h4>
          <p class="text-xs text-slate-400 mt-0.5 font-medium">${m.matchFormat || 'T20'} • ${m.startTime || 'Scheduled'}</p>
        </div>

        <!-- Teams Score Box -->
        <div class="bg-slate-900/90 rounded-xl p-3 border border-slate-800 space-y-2">
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-slate-200">${m.team1?.name || 'Team 1'}</span>
            <span class="font-mono font-bold text-emerald-400">${m.team1?.score || 'Yet to bat'}</span>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-slate-200">${m.team2?.name || 'Team 2'}</span>
            <span class="font-mono font-bold text-cyan-400">${m.team2?.score || ''}</span>
          </div>
        </div>

        <!-- Streams Accordion Summary -->
        <div class="space-y-2">
          <div class="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>Streaming Servers (${streams.length})</span>
            <button onclick="openStreamsModal('${m._id}')" class="text-emerald-400 hover:underline">
              <i class="fa-solid fa-plus-circle"></i> Add / Edit Streams
            </button>
          </div>

          <div class="flex flex-wrap gap-1.5">
            ${streams.length === 0 ? '<span class="text-xs text-slate-500 italic">No streaming links added yet.</span>' : 
              streams.map(s => `
                <div class="stream-badge text-xs">
                  <span class="w-2 h-2 rounded-full ${s.isActive ? 'bg-emerald-400' : 'bg-slate-600'}"></span>
                  <span class="font-semibold text-slate-200">${s.title}</span>
                  ${s.drm?.enabled ? '<span class="drm-pill">DRM</span>' : ''}
                  <button onclick="previewStream('${s.streamUrl}', '${s.streamType}')" title="Preview Stream" class="ml-1 text-emerald-400 hover:text-white">
                    <i class="fa-solid fa-play"></i>
                  </button>
                </div>
              `).join('')
            }
          </div>
        </div>

        <!-- Card Action Footer -->
        <div class="pt-3 border-t border-slate-800 flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <button onclick="quickToggleStatus('${m._id}', '${isLive ? 'FINISHED' : 'LIVE'}')" class="btn-ghost text-xs py-1 px-2.5">
              ${isLive ? '<i class="fa-solid fa-stop text-red-400"></i> Finish' : '<i class="fa-solid fa-play text-emerald-400"></i> Go Live'}
            </button>
          </div>

          <div class="flex items-center gap-1">
            <button onclick="editMatch('${m._id}')" class="btn-ghost text-xs p-2" title="Edit Event Details">
              <i class="fa-solid fa-pen-to-square text-cyan-400"></i>
            </button>
            <button onclick="deleteMatch('${m._id}')" class="btn-ghost text-xs p-2 hover:bg-red-500/20" title="Delete Event">
              <i class="fa-solid fa-trash text-red-400"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderCategoriesTable() {
  const tbody = document.getElementById('categories-table-body');
  if (!tbody) return;

  if (state.categories.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-500">No categories found.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.categories.map(c => `
    <tr class="hover:bg-slate-900/50 transition">
      <td class="p-4 text-emerald-400 text-lg"><i class="${c.icon || 'fas fa-play'}"></i></td>
      <td class="p-4 font-bold text-white">${c.name}</td>
      <td class="p-4 text-xs font-mono text-slate-400">${c.slug}</td>
      <td class="p-4">
        <span class="text-xs px-2 py-0.5 rounded-full ${c.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}">
          ${c.isActive ? 'Active' : 'Disabled'}
        </span>
      </td>
      <td class="p-4 text-right">
        <button onclick="deleteCategory('${c._id}')" class="text-red-400 hover:text-red-300 text-sm">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function renderVodGrid() {
  const container = document.getElementById('vod-grid');
  if (!container) return;

  if (state.vods.length === 0) {
    container.innerHTML = `
      <div class="col-span-3 p-12 text-center bg-slate-900/40 rounded-xl border border-slate-800">
        <i class="fa-solid fa-film text-4xl text-slate-600 mb-3"></i>
        <h4 class="text-lg font-bold text-slate-300">No VOD series added yet</h4>
        <p class="text-xs text-slate-400 mt-1">Add shows like Bigg Boss, TV serials, or Movies.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = state.vods.map(v => {
    const episodes = v.episodes || [];
    return `
      <div class="glass-panel overflow-hidden flex flex-col justify-between">
        <div class="relative h-44 bg-slate-900">
          <img src="${v.posterUrl || v.bannerUrl || 'https://images.unsplash.com/photo-1578022761797-b8636ac1773c?auto=format&fit=crop&w=600&q=80'}" 
               alt="${v.title}" class="w-full h-full object-cover">
          <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
          <span class="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-emerald-400 text-xs font-bold">
            ${v.category}
          </span>
          <span class="absolute top-3 right-3 px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-amber-400 text-xs font-bold">
            ★ ${v.rating || '8.5'}
          </span>
          <h4 class="absolute bottom-3 left-3 right-3 text-base font-extrabold text-white leading-tight">${v.title}</h4>
        </div>

        <div class="p-4 space-y-3 flex-1 flex flex-col justify-between">
          <div>
            <p class="text-xs text-slate-400 line-clamp-2">${v.description || 'No description provided.'}</p>
            <div class="mt-3 flex items-center justify-between text-xs font-semibold text-slate-300">
              <span>Total Episodes: <strong class="text-emerald-400">${episodes.length}</strong></span>
              <button onclick="openEpisodeModal('${v._id}', '${v.title.replace(/'/g, "\\'")}')" class="text-emerald-400 hover:underline">
                <i class="fa-solid fa-plus-circle"></i> Add Episode
              </button>
            </div>
          </div>

          <!-- Episode Thumbnails Row -->
          <div class="pt-2 border-t border-slate-800 flex items-center justify-between">
            <span class="text-xs text-slate-500">${v.releaseYear || '2026'}</span>
            <div class="flex items-center gap-2">
              <button onclick="deleteVod('${v._id}')" class="text-red-400 hover:text-red-300 text-xs">
                <i class="fa-solid fa-trash"></i> Delete Show
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function populateCategoryDropdowns() {
  const matchCat = document.getElementById('match-category');
  const vodCat = document.getElementById('vod-category');

  const options = state.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');

  if (matchCat) matchCat.innerHTML = options || '<option value="Live Cricket">Live Cricket</option>';
  if (vodCat) vodCat.innerHTML = options || '<option value="Bigg Boss">Bigg Boss</option>';
}

function populateSettingsInputs(settings) {
  setInputValue('setting-announcement', settings.announcement || '');
  setInputValue('setting-app-version', settings.appVersion || '1.5.0');
  setInputValue('setting-apk-url', settings.apkDownloadUrl || '');
  const maint = document.getElementById('setting-maintenance');
  if (maint) maint.checked = Boolean(settings.maintenanceMode);
}

// --- FILTERING ---
function filterMatches(status) {
  state.activeFilter = status;
  document.querySelectorAll('.match-filter-btn').forEach(btn => {
    const isTarget = btn.getAttribute('data-filter') === status;
    btn.className = isTarget 
      ? 'match-filter-btn px-4 py-2 rounded-lg bg-emerald-500 text-black font-bold' 
      : 'match-filter-btn px-4 py-2 rounded-lg text-slate-300 hover:text-white';
  });
  renderMatchesList();
}

// --- MODAL & FORM HANDLERS ---

function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('active');
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('active');
}

function openNewMatchModal() {
  document.getElementById('match-modal-title').textContent = 'Add New Live Event';
  document.getElementById('form-match').reset();
  document.getElementById('match-edit-id').value = '';
  openModal('modal-match');
}

function editMatch(id) {
  const m = state.matches.find(item => item._id === id);
  if (!m) return;

  document.getElementById('match-modal-title').textContent = 'Edit Live Event';
  document.getElementById('match-edit-id').value = m._id;
  setInputValue('match-title', m.title);
  setInputValue('match-category', m.category);
  setInputValue('match-status', m.status);
  setInputValue('match-format', m.matchFormat);
  setInputValue('match-start-time', m.startTime);
  setInputValue('match-banner', m.bannerUrl);
  setInputValue('match-team1-name', m.team1?.name || '');
  setInputValue('match-team1-score', m.team1?.score || '');
  setInputValue('match-team2-name', m.team2?.name || '');
  setInputValue('match-team2-score', m.team2?.score || '');

  const pinned = document.getElementById('match-pinned');
  if (pinned) pinned.checked = Boolean(m.isPinned);

  openModal('modal-match');
}

async function handleSaveMatch(e) {
  e.preventDefault();
  const id = document.getElementById('match-edit-id').value;

  const payload = {
    title: document.getElementById('match-title').value.trim(),
    category: document.getElementById('match-category').value,
    status: document.getElementById('match-status').value,
    matchFormat: document.getElementById('match-format').value.trim() || 'T20',
    startTime: document.getElementById('match-start-time').value.trim() || new Date().toISOString(),
    bannerUrl: document.getElementById('match-banner').value.trim(),
    isPinned: document.getElementById('match-pinned').checked,
    team1: {
      name: document.getElementById('match-team1-name').value.trim() || 'Team 1',
      score: document.getElementById('match-team1-score').value.trim()
    },
    team2: {
      name: document.getElementById('match-team2-name').value.trim() || 'Team 2',
      score: document.getElementById('match-team2-score').value.trim()
    }
  };

  try {
    if (id) {
      await apiRequest(`/api/matches/${id}`, 'PUT', payload);
      showToast('Event updated successfully!', 'success');
    } else {
      await apiRequest('/api/matches', 'POST', payload);
      showToast('New event created successfully!', 'success');
    }
    closeModal('modal-match');
    await fetchMatches();
    await fetchDashboardStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function quickToggleStatus(id, newStatus) {
  try {
    await apiRequest(`/api/matches/${id}`, 'PUT', { status: newStatus });
    showToast(`Status updated to ${newStatus}`, 'success');
    await fetchMatches();
    await fetchDashboardStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteMatch(id) {
  if (!confirm('Are you sure you want to delete this live match and its streams?')) return;
  // Instant Optimistic UI Update
  state.matches = state.matches.filter(m => String(m._id) !== String(id));
  renderMatchesList();
  renderOverviewLiveList();
  updateStatsUI({
    ...state.stats,
    liveEvents: state.matches.filter(m => m.status === 'LIVE').length,
    upcomingEvents: state.matches.filter(m => m.status === 'UPCOMING').length,
    totalStreams: state.matches.reduce((acc, m) => acc + (m.streams?.length || 0), 0)
  });
  showToast('Match deleted successfully!', 'success');

  try {
    await apiRequest(`/api/matches/${id}`, 'DELETE');
    await fetchMatches();
    await fetchDashboardStats();
  } catch (err) {
    console.warn('API delete match:', err.message);
  }
}

// --- DYNAMIC STREAMS & DRM ---

function openStreamsModal(matchId) {
  const match = state.matches.find(m => m._id === matchId);
  if (!match) return;

  document.getElementById('stream-match-id').value = matchId;
  document.getElementById('stream-modal-match-title').textContent = match.title;

  renderStreamsModalList(match);
  openModal('modal-streams');
}

function renderStreamsModalList(match) {
  const container = document.getElementById('match-streams-list');
  if (!container) return;

  const streams = match.streams || [];
  if (streams.length === 0) {
    container.innerHTML = `<div class="p-3 text-center text-xs text-slate-500 bg-slate-950 rounded-lg">No streams configured yet. Fill the form below to add Server 1.</div>`;
    return;
  }

  container.innerHTML = streams.map(s => `
    <div class="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="font-bold text-xs text-white truncate">${s.title}</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">${s.streamType}</span>
          ${s.drm?.enabled ? '<span class="drm-pill text-[10px]">ClearKey DRM</span>' : ''}
        </div>
        <p class="text-[11px] font-mono text-emerald-400 truncate mt-0.5">${s.streamUrl}</p>
        ${s.headers?.userAgent ? `<p class="text-[10px] text-slate-500 font-mono">UA: ${s.headers.userAgent}</p>` : ''}
      </div>

      <div class="flex items-center gap-2">
        <button onclick="previewStream('${s.streamUrl}', '${s.streamType}')" class="btn-ghost text-xs p-1.5" title="Test Playback">
          <i class="fa-solid fa-play text-emerald-400"></i>
        </button>
        <button onclick="deleteStream('${match._id}', '${s.id || s._id}')" class="text-red-400 hover:text-red-300 text-xs p-1.5" title="Delete Stream">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');
}

function toggleDrmInputs(checked) {
  const container = document.getElementById('drm-inputs-container');
  if (container) {
    container.classList.toggle('hidden', !checked);
  }
}

async function handleSaveStream(e) {
  e.preventDefault();
  const matchId = document.getElementById('stream-match-id').value;
  const isDrm = document.getElementById('stream-drm-enable').checked;

  const payload = {
    title: document.getElementById('stream-title').value.trim(),
    streamType: document.getElementById('stream-type').value,
    streamUrl: document.getElementById('stream-url').value.trim(),
    headers: {
      userAgent: document.getElementById('stream-user-agent').value.trim(),
      referer: document.getElementById('stream-referer').value.trim()
    },
    drm: {
      enabled: isDrm,
      scheme: 'clearkey',
      keyId: document.getElementById('stream-drm-keyid').value.trim(),
      key: document.getElementById('stream-drm-key').value.trim()
    }
  };

  try {
    const res = await apiRequest(`/api/matches/${matchId}/streams`, 'POST', payload);
    showToast('Streaming server added successfully!', 'success');
    document.getElementById('form-stream').reset();
    toggleDrmInputs(false);

    await fetchMatches();
    await fetchDashboardStats();

    // Re-render streams inside open modal
    const updatedMatch = state.matches.find(m => m._id === matchId);
    if (updatedMatch) renderStreamsModalList(updatedMatch);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteStream(matchId, streamId) {
  if (!confirm('Remove this streaming link?')) return;
  const match = state.matches.find(m => String(m._id) === String(matchId));
  if (match && match.streams) {
    match.streams = match.streams.filter(s => String(s.id) !== String(streamId));
    renderStreamsModalList(match);
    renderMatchesList();
  }
  showToast('Stream link removed!', 'success');

  try {
    await apiRequest(`/api/matches/${matchId}/streams/${streamId}`, 'DELETE');
    await fetchMatches();
    await fetchDashboardStats();
  } catch (err) {
    console.warn('API delete stream:', err.message);
  }
}

function previewStream(url, type) {
  closeModal('modal-streams');
  switchTab('player');
  playStreamUrl(url, type);
}

// --- CATEGORIES ---

function openCategoryModal() {
  document.getElementById('form-category').reset();
  openModal('modal-category');
}

async function handleSaveCategory(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('cat-name').value.trim(),
    slug: document.getElementById('cat-slug').value.trim(),
    icon: document.getElementById('cat-icon').value.trim()
  };

  try {
    await apiRequest('/api/categories', 'POST', payload);
    showToast('Category created!', 'success');
    closeModal('modal-category');
    await fetchCategories();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteCategory(id) {
  if (!confirm('Delete this category?')) return;
  state.categories = state.categories.filter(c => String(c._id) !== String(id));
  renderCategoriesTable();
  populateCategoryDropdowns();
  showToast('Category deleted successfully!', 'success');

  try {
    await apiRequest(`/api/categories/${id}`, 'DELETE');
    await fetchCategories();
  } catch (err) {
    console.warn('API delete category:', err.message);
  }
}

// --- VOD & EPISODES ---

function openNewVodModal() {
  document.getElementById('form-vod').reset();
  openModal('modal-vod');
}

async function handleSaveVod(e) {
  e.preventDefault();
  const payload = {
    title: document.getElementById('vod-title').value.trim(),
    category: document.getElementById('vod-category').value,
    releaseYear: document.getElementById('vod-year').value.trim(),
    posterUrl: document.getElementById('vod-poster').value.trim(),
    description: document.getElementById('vod-desc').value.trim()
  };

  try {
    await apiRequest('/api/vod', 'POST', payload);
    showToast('VOD show created!', 'success');
    closeModal('modal-vod');
    await fetchVods();
    await fetchDashboardStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteVod(id) {
  if (!confirm('Delete this show and all its episodes?')) return;
  state.vods = state.vods.filter(v => String(v._id) !== String(id));
  renderVodGrid();
  showToast('Show deleted successfully!', 'success');

  try {
    await apiRequest(`/api/vod/${id}`, 'DELETE');
    await fetchVods();
    await fetchDashboardStats();
  } catch (err) {
    console.warn('API delete VOD:', err.message);
  }
}

function openEpisodeModal(vodId, vodTitle) {
  document.getElementById('episode-vod-id').value = vodId;
  document.getElementById('episode-modal-show-title').textContent = vodTitle;
  document.getElementById('form-episode').reset();
  openModal('modal-episode');
}

async function handleSaveEpisode(e) {
  e.preventDefault();
  const vodId = document.getElementById('episode-vod-id').value;

  const payload = {
    episodeNumber: Number(document.getElementById('episode-num').value) || 1,
    title: document.getElementById('episode-title').value.trim(),
    streamUrl: document.getElementById('episode-url').value.trim(),
    thumbnail: document.getElementById('episode-thumb').value.trim()
  };

  try {
    await apiRequest(`/api/vod/${vodId}/episodes`, 'POST', payload);
    showToast('Episode added to show!', 'success');
    closeModal('modal-episode');
    await fetchVods();
    await fetchDashboardStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// --- SETTINGS ---

function saveAdminKey() {
  const key = document.getElementById('input-admin-key').value.trim();
  if (!key) return;
  state.adminKey = key;
  localStorage.setItem('hd_stream_admin_key', key);
  showToast('Admin API Key updated locally in browser storage!', 'success');
}

async function saveAppSettings() {
  const payload = {
    announcement: document.getElementById('setting-announcement').value.trim(),
    appVersion: document.getElementById('setting-app-version').value.trim(),
    apkDownloadUrl: document.getElementById('setting-apk-url').value.trim(),
    maintenanceMode: document.getElementById('setting-maintenance').checked
  };

  try {
    await apiRequest('/api/settings', 'PUT', payload);
    showToast('App settings saved & live in mobile feed!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// --- UTILITIES ---

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Link copied to clipboard!', 'success');
  }).catch(() => {
    prompt('Copy this URL:', text);
  });
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bg = type === 'success' ? 'bg-emerald-600' : (type === 'error' ? 'bg-red-600' : 'bg-slate-800 border border-slate-700');
  toast.className = `${bg} text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 transform transition-all duration-300 ease-out translate-y-4 opacity-0`;
  toast.innerHTML = `
    <i class="fa-solid ${type === 'success' ? 'fa-check' : (type === 'error' ? 'fa-circle-exclamation' : 'fa-info')}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-4', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function setElemText(id, text) {
  const elem = document.getElementById(id);
  if (elem) elem.textContent = text;
}

function setInputValue(id, val) {
  const elem = document.getElementById(id);
  if (elem) elem.value = val;
}
