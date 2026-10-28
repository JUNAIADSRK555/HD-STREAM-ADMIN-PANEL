
// HD STREAM — Live Sports & OTT Admin Dashboard Application Controller

const state = {
  adminKey: localStorage.getItem('hd_stream_admin_key') || 'admin123',
  matches: [],
  categories: [],
  vods: [],
  settings: {},
  stats: {},
  activeTab: 'overview',
  activeFilter: 'ALL',
  activeCategory: 'ALL',
  searchQuery: '',
  currentPage: 1,
  pageSize: 24
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initNav();
  initInputs();
  initPipedUrlListeners();
  checkAuthAndInit();
});

// --- AUTHENTICATION GATE & LOCK SCREEN ---
function checkAuthAndInit() {
  const overlay = document.getElementById('auth-lock-overlay');
  const isLoggedIn = sessionStorage.getItem('hd_admin_logged_in') === 'true';

  if (isLoggedIn) {
    if (overlay) overlay.classList.add('hidden');
    fetchAllData();
    setInterval(fetchDashboardStats, 30000);
  } else {
    if (overlay) overlay.classList.remove('hidden');
    const pwdInput = document.getElementById('auth-password');
    if (pwdInput) pwdInput.focus();
  }
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const user = document.getElementById('auth-username').value.trim();
  const pass = document.getElementById('auth-password').value.trim();
  const errorBox = document.getElementById('auth-error-msg');
  const errorText = document.getElementById('auth-error-text');
  const submitBtn = document.getElementById('btn-auth-submit');

  if (errorBox) errorBox.classList.add('hidden');
  if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, password: pass })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      sessionStorage.setItem('hd_admin_logged_in', 'true');
      state.adminKey = data.token || pass;
      localStorage.setItem('hd_stream_admin_key', state.adminKey);

      const overlay = document.getElementById('auth-lock-overlay');
      if (overlay) {
        overlay.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => overlay.classList.add('hidden'), 300);
      }
      showToast('Welcome to HD STREAM Admin Portal!', 'success');
      fetchAllData();
      setInterval(fetchDashboardStats, 30000);
    } else {
      if (errorBox && errorText) {
        errorText.textContent = data.message || 'Invalid username or password';
        errorBox.classList.remove('hidden');
      }
    }
  } catch (err) {
    if (errorBox && errorText) {
      errorText.textContent = 'Server connection error: ' + err.message;
      errorBox.classList.remove('hidden');
    }
  } finally {
    if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-lock-open"></i> Unlock Dashboard';
  }
}

function handleAdminLogout() {
  sessionStorage.removeItem('hd_admin_logged_in');
  const overlay = document.getElementById('auth-lock-overlay');
  if (overlay) {
    overlay.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
    const pwdInput = document.getElementById('auth-password');
    if (pwdInput) {
      pwdInput.value = '';
      pwdInput.focus();
    }
  }
  showToast('Admin session locked.', 'info');
}

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
    matches: ['Live Events & Broadcasts', 'Manage live channels, events, and multi-server streaming feeds.'],
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
  stats: { liveEvents: 0, upcomingEvents: 0, totalStreams: 0, drmStreamsCount: 0, vodShowsCount: 0, totalEpisodes: 0 },
  matches: [],
  categories: [
    { _id: 'c_jio', name: 'JIO TV+', slug: 'jio-tv', icon: 'fas fa-tv', imageUrl: '', m3uLink: '', order: 1 },
    { _id: 'c_mix', name: 'MIX TV', slug: 'mix-tv', icon: 'fas fa-satellite-dish', imageUrl: '', m3uLink: '', order: 2 },
    { _id: 'c_vzy', name: 'VZY', slug: 'vzy', icon: 'fas fa-play-circle', imageUrl: '', m3uLink: '', order: 3 },
    { _id: 'c_pak', name: 'PAKISTAN TV', slug: 'pakistan-tv', icon: 'fas fa-globe-asia', imageUrl: '', m3uLink: '', order: 4 },
    { _id: 'c_tof', name: 'TOFFEE', slug: 'toffee', icon: 'fas fa-film', imageUrl: '', m3uLink: '', order: 5 },
    { _id: 'c_irn', name: 'IRAN TV', slug: 'iran-tv', icon: 'fas fa-tv', imageUrl: '', m3uLink: '', order: 6 },
    { _id: 'c_afg', name: 'Afghanistan TV', slug: 'afghanistan-tv', icon: 'fas fa-tv', imageUrl: '', m3uLink: '', order: 7 },
    { _id: 'c_cart', name: 'CARTOON MOVIE', slug: 'cartoon-movie', icon: 'fas fa-child', imageUrl: '', m3uLink: '', order: 8 },
    { _id: 'c_mxp', name: 'MX PLAYER', slug: 'mx-player', icon: 'fas fa-play', imageUrl: '', m3uLink: '', order: 9 },
    { _id: 'c_yup', name: 'YUPPY TV', slug: 'yuppy-tv', icon: 'fas fa-broadcast-tower', imageUrl: '', m3uLink: '', order: 10 }
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

async function fetchCategories(forceRefresh = false) {
  try {
    const url = forceRefresh ? '/api/categories?refresh=true' : '/api/categories';
    const res = await apiRequest(url);
    if (res && res.success) {
      state.categories = res.data;
      if (forceRefresh) showToast('Categories refreshed from Google Drive!', 'success');
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
          <div class="text-slate-300 font-medium flex items-center gap-2">
            <span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">${m.team1?.name || 'Live Broadcast'}</span>
            ${m.team2?.name ? `<span class="text-slate-500 font-bold">vs</span><span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">${m.team2.name}</span>` : ''}
          </div>
          <button onclick="openStreamsModal('${m._id}')" class="text-emerald-400 hover:underline font-semibold flex items-center gap-1">
            <i class="fa-solid fa-server"></i> ${streamsCount} Streams &rarr;
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function filterCategory(catName) {
  state.activeCategory = catName;
  state.currentPage = 1;
  const select = document.getElementById('matches-category-select');
  if (select) select.value = catName;
  renderMatchesList();
}

function handleSearchInput(val) {
  state.searchQuery = (val || '').trim();
  state.currentPage = 1;
  renderMatchesList();
}

function changeMatchesPage(delta) {
  state.currentPage += delta;
  renderMatchesList();
  window.scrollTo({ top: 250, behavior: 'smooth' });
}

function viewCategoryMatches(catName) {
  state.activeCategory = catName;
  state.currentPage = 1;
  switchTab('matches');
  renderMatchesList();
}

async function triggerGdriveSync() {
  const btn1 = document.getElementById('btn-sync-gdrive');
  const btn2 = document.getElementById('btn-sync-gdrive-top');
  const origHtml1 = btn1 ? btn1.innerHTML : '';
  const origHtml2 = btn2 ? btn2.innerHTML : '';

  if (btn1) { btn1.disabled = true; btn1.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Syncing Channels...'; }
  if (btn2) { btn2.disabled = true; btn2.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Syncing...'; }

  showToast('Connecting to Google Drive and syncing all channels across categories...', 'info');

  try {
    const res = await apiRequest('/api/sync/gdrive', 'POST');
    showToast(res.message || 'Google Drive channels synced successfully!', 'success');
    await fetchCategories();
    await fetchMatches();
    await fetchDashboardStats();
  } catch (err) {
    showToast('Sync error: ' + err.message, 'error');
  } finally {
    if (btn1) { btn1.disabled = false; btn1.innerHTML = origHtml1; }
    if (btn2) { btn2.disabled = false; btn2.innerHTML = origHtml2; }
  }
}

function updateCategoryFilterUI(categories, matches) {
  const catSelect = document.getElementById('matches-category-select');
  const pillsBar = document.getElementById('category-pills-bar');
  if (!catSelect && !pillsBar) return;

  const countMap = {};
  matches.forEach(m => {
    const c = m.category || 'Unknown';
    countMap[c] = (countMap[c] || 0) + 1;
  });

  const catList = categories && categories.length > 0 ? categories.map(c => c.name) : Object.keys(countMap);
  Object.keys(countMap).forEach(k => {
    if (!catList.includes(k)) catList.push(k);
  });

  if (catSelect) {
    catSelect.innerHTML = `
      <option value="ALL">📁 All Categories (${matches.length})</option>
      ${catList.map(name => `
        <option value="${name}" ${state.activeCategory === name ? 'selected' : ''}>
          ${name} (${countMap[name] || 0})
        </option>
      `).join('')}
    `;
  }

  if (pillsBar) {
    pillsBar.innerHTML = `
      <button onclick="filterCategory('ALL')" class="shrink-0 px-3 py-1 rounded-full font-bold transition flex items-center gap-1.5 cursor-pointer ${state.activeCategory === 'ALL' ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20' : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'}">
        <span>All (${matches.length})</span>
      </button>
      ${catList.map(name => `
        <button onclick="filterCategory('${name}')" class="shrink-0 px-3 py-1 rounded-full font-bold transition flex items-center gap-1.5 cursor-pointer ${state.activeCategory === name ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20' : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'}">
          <span>${name}</span>
          <span class="text-[10px] px-1.5 py-0.2 rounded-full ${state.activeCategory === name ? 'bg-slate-950 text-emerald-400' : 'bg-slate-800 text-slate-400'}">${countMap[name] || 0}</span>
        </button>
      `).join('')}
    `;
  }
}

function renderMatchesList() {
  const container = document.getElementById('matches-grid');
  if (!container) return;

  let list = state.matches || [];

  // 1. Status Filter
  if (state.activeFilter !== 'ALL') {
    list = list.filter(m => m.status === state.activeFilter);
  }

  // 2. Live Search Filter (Title or Teams)
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    list = list.filter(m =>
      (m.title && m.title.toLowerCase().includes(q)) ||
      (m.team1?.name && m.team1.name.toLowerCase().includes(q)) ||
      (m.team2?.name && m.team2.name.toLowerCase().includes(q))
    );
  }

  const pageInfo = document.getElementById('matches-page-info');
  const pageNumbers = document.getElementById('matches-page-numbers');
  const btnPrev = document.getElementById('btn-prev-page');
  const btnNext = document.getElementById('btn-next-page');

  if (list.length === 0) {
    container.innerHTML = `
      <div class="col-span-2 p-12 text-center bg-slate-900/40 rounded-xl border border-slate-800">
        <i class="fa-solid fa-tower-broadcast text-4xl text-slate-600 mb-3"></i>
        <h4 class="text-lg font-bold text-slate-300">No live events found matching current filter</h4>
        <p class="text-xs text-slate-400 mt-1">Click below to add a live match, stream URL, headers, and DRM keys directly.</p>
        <button onclick="openNewMatchModal()" class="mt-4 px-4 py-2.5 rounded-xl bg-[#d48a7b] text-slate-950 font-black text-xs inline-flex items-center gap-2 hover:bg-[#e29b8d] transition cursor-pointer shadow-lg shadow-[#d48a7b]/25">
          <i class="fa-solid fa-plus-circle"></i> + Add Live Event & Stream
        </button>
      </div>
    `;
    if (pageInfo) pageInfo.textContent = 'Showing 0 events';
    if (pageNumbers) pageNumbers.textContent = 'Page 0';
    if (btnPrev) btnPrev.disabled = true;
    if (btnNext) btnNext.disabled = true;
    return;
  }

  const totalFiltered = list.length;
  const totalPages = Math.ceil(totalFiltered / state.pageSize) || 1;
  if (state.currentPage > totalPages) state.currentPage = totalPages;
  if (state.currentPage < 1) state.currentPage = 1;

  const startIndex = (state.currentPage - 1) * state.pageSize;
  const endIndex = Math.min(startIndex + state.pageSize, totalFiltered);
  const pageItems = list.slice(startIndex, endIndex);

  if (pageInfo) {
    pageInfo.innerHTML = `Showing <strong class="text-white">${startIndex + 1} - ${endIndex}</strong> of <strong class="text-emerald-400">${totalFiltered}</strong> live events`;
  }
  if (pageNumbers) pageNumbers.textContent = `Page ${state.currentPage} of ${totalPages}`;
  if (btnPrev) btnPrev.disabled = state.currentPage <= 1;
  if (btnNext) btnNext.disabled = state.currentPage >= totalPages;

  container.innerHTML = pageItems.map(m => {
    const isLive = m.status === 'LIVE';
    const statusColor = isLive ? 'bg-red-500/20 text-red-400 border-red-500/30' : (m.status === 'UPCOMING' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-slate-700/30 text-slate-400 border-slate-700');
    const streams = m.streams || [];

    return `
      <div class="glass-panel p-5 space-y-4 relative overflow-hidden group">
        <!-- Card Top Bar -->
        <div class="flex items-center justify-between">
          <label class="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="checkbox" class="match-select-checkbox w-4 h-4 rounded accent-emerald-500 cursor-pointer" value="${m._id}" onchange="updateSelectedMatchesCount()">
            <span class="text-xs font-bold text-slate-400">${m.category}</span>
            ${m.isPinned ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30"><i class="fa-solid fa-thumbtack"></i> PINNED</span>' : ''}
          </label>
          <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusColor} flex items-center gap-1">
            ${isLive ? '<span class="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span>' : ''}
            ${m.status}
          </span>
        </div>

        <!-- Full-Width Banner Image -->
        ${m.bannerUrl ? `
          <div class="w-full h-44 rounded-xl overflow-hidden relative border border-slate-800 shadow-lg">
            <img src="${m.bannerUrl}" alt="${m.title}" class="w-full h-full object-cover" onerror="this.parentElement.style.display='none'">
            <div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent"></div>
          </div>
        ` : ''}

        <!-- Title & Format -->
        <div>
          <h4 class="text-lg font-extrabold text-white group-hover:text-emerald-400 transition leading-snug">${m.title}</h4>
          <p class="text-xs text-slate-400 mt-0.5 font-medium">${m.matchFormat || 'T20'} • ${m.startTime || 'Scheduled'}</p>
        </div>

        <!-- Teams / Participants Box (Clean - No Scoreboard) -->
        <div class="bg-slate-900/90 rounded-xl p-3 border border-slate-800 flex items-center justify-between text-xs">
          <span class="font-bold text-slate-200 flex items-center gap-1.5">
            <span>${m.team1?.flag || '📺'}</span> ${m.team1?.name || 'Channel / Team 1'}
          </span>
          ${m.team2?.name ? `
            <span class="text-slate-500 font-bold px-2">VS</span>
            <span class="font-bold text-slate-200 flex items-center gap-1.5">
              <span>${m.team2?.flag || '🔴'}</span> ${m.team2?.name}
            </span>
          ` : ''}
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

  const selectAll = document.getElementById('select-all-matches');
  if (selectAll) selectAll.checked = false;
  updateSelectedMatchesCount();
}

// --- BULK SELECTION & BULK DELETE ---
function toggleSelectAllMatches(checked) {
  document.querySelectorAll('.match-select-checkbox').forEach(cb => {
    cb.checked = checked;
  });
  updateSelectedMatchesCount();
}

function updateSelectedMatchesCount() {
  const checkboxes = document.querySelectorAll('.match-select-checkbox');
  const checkedBoxes = document.querySelectorAll('.match-select-checkbox:checked');
  const countSpan = document.getElementById('matches-selected-count');
  if (countSpan) countSpan.textContent = checkedBoxes.length;

  const btnDelete = document.getElementById('btn-delete-selected');
  if (btnDelete) {
    btnDelete.disabled = checkedBoxes.length === 0;
    btnDelete.innerHTML = `<i class="fa-solid fa-trash-can"></i> Delete Selected (${checkedBoxes.length})`;
  }

  const selectAll = document.getElementById('select-all-matches');
  if (selectAll && checkboxes.length > 0) {
    selectAll.checked = checkedBoxes.length === checkboxes.length;
  }
}

async function deleteSelectedMatches() {
  const checkedBoxes = Array.from(document.querySelectorAll('.match-select-checkbox:checked'));
  const ids = checkedBoxes.map(cb => cb.value);
  if (ids.length === 0) return;

  if (!confirm(`Are you sure you want to delete ${ids.length} selected live events?`)) return;

  try {
    const res = await apiRequest('/api/matches/bulk-delete', 'POST', { ids });
    showToast(res.message || `Deleted ${ids.length} events!`, 'success');
    await fetchMatches();
    await fetchDashboardStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteAllLiveEvents() {
  const total = state.matches.length;
  if (total === 0) {
    showToast('No live events to delete', 'info');
    return;
  }

  if (!confirm(`⚠️ DANGER: Are you sure you want to delete ALL ${total} live events? This will remove all channels and streams.`)) return;

  try {
    const res = await apiRequest('/api/matches/delete-all', 'POST');
    showToast(res.message || 'All live events deleted successfully!', 'success');
    await fetchMatches();
    await fetchDashboardStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderCategoriesTable() {
  const tbody = document.getElementById('categories-table-body');
  if (!tbody) return;

  if (!state.categories || state.categories.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-500">Loading categories from Google Drive feed...</td></tr>`;
    return;
  }

  tbody.innerHTML = state.categories.map(c => `
    <tr class="hover:bg-slate-900/50 transition">
      <td class="p-4">
        <div class="w-10 h-10 rounded-lg overflow-hidden bg-slate-950 border border-slate-700/80 flex items-center justify-center p-1 shrink-0">
          ${c.imageUrl ? `
            <img src="${c.imageUrl}" alt="${c.name}" class="w-full h-full object-contain" onerror="this.onerror=null; this.parentElement.innerHTML='<i class=\\'fa-solid fa-tv text-emerald-400 text-sm\\'></i>'">
          ` : `
            <i class="${c.icon || 'fa-solid fa-tv'} text-emerald-400 text-sm"></i>
          `}
        </div>
      </td>
      <td class="p-4">
        <div class="font-extrabold text-white text-sm">${c.name}</div>
        <div class="text-[11px] font-mono text-slate-400 mt-0.5">${c.slug}</div>
      </td>
      <td class="p-4">
        <div class="flex items-center gap-2 max-w-md">
          <input type="text" readonly value="${c.m3uLink || ''}"
                 class="bg-black/60 border border-slate-800 text-[11px] font-mono text-cyan-300 rounded-lg px-2.5 py-1.5 w-full truncate select-all focus:border-cyan-500 focus:outline-none">
          <button onclick="copyToClipboard('${c.m3uLink || ''}')" class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs shrink-0 cursor-pointer transition" title="Copy Playlist Link">
            <i class="fa-solid fa-copy"></i>
          </button>
        </div>
      </td>
      <td class="p-4">
        <span class="text-xs font-mono font-bold text-slate-400 bg-slate-950 px-2 py-1 rounded border border-slate-800">#${c.order || 1}</span>
      </td>
      <td class="p-4">
        <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Active
        </span>
      </td>
      <td class="p-4 text-right">
        <div class="flex items-center justify-end gap-2">
          ${c.m3uLink ? `
            <a href="${c.m3uLink}" target="_blank" class="px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer">
              <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i> Test Link
            </a>
          ` : ''}
        </div>
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
  // match-category is now a hidden input (value = "Live Event"), skip it
  const vodCat = document.getElementById('vod-category');
  if (vodCat) {
    const options = state.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    vodCat.innerHTML = options || '<option value="Entertainment">Entertainment</option>';
  }
}

function populateSettingsInputs(settings) {
  setInputValue('setting-announcement', settings.announcement || '');
  setInputValue('setting-app-version', settings.appVersion || '2.0.0');
  setInputValue('setting-apk-url', settings.apkDownloadUrl || '');
  const maint = document.getElementById('setting-maintenance');
  if (maint) maint.checked = Boolean(settings.maintenanceMode);

  updateApkQrCode(settings.apkDownloadUrl, settings.appVersion);
}

// --- APK LINK & LIVE QR CODE ---
function updateApkQrCode(apkUrl, appVersion) {
  const defaultDirectUrl = `${window.location.origin}/HD-STREAM.apk`;
  const url = (apkUrl && !apkUrl.includes('example.com') && !apkUrl.includes('10.129')) ? apkUrl : defaultDirectUrl;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(url)}`;

  const dashInput = document.getElementById('dashboard-apk-url');
  if (dashInput) dashInput.value = url;

  const dashQr = document.getElementById('dashboard-apk-qr');
  if (dashQr) dashQr.src = qrUrl;

  const directBtn = document.getElementById('btn-download-apk-direct');
  if (directBtn) {
    directBtn.href = url;
    directBtn.setAttribute('download', 'HD-STREAM.apk');
  }

  const versionBadge = document.getElementById('apk-version-badge');
  if (versionBadge && appVersion) versionBadge.textContent = 'v' + appVersion;

  const modalQr = document.getElementById('modal-apk-qr-img');
  if (modalQr) modalQr.src = qrUrl;

  const modalBtn = document.getElementById('modal-apk-download-btn');
  if (modalBtn) {
    modalBtn.href = url;
    modalBtn.setAttribute('download', 'HD-STREAM.apk');
  }
}

function openApkModal() {
  const apkUrl = document.getElementById('dashboard-apk-url')?.value || state.settings?.apkDownloadUrl || '';
  updateApkQrCode(apkUrl, state.settings?.appVersion);
  openModal('modal-apk-qr');
}

async function saveDashboardApkUrl() {
  const apkUrl = document.getElementById('dashboard-apk-url')?.value.trim();
  if (!apkUrl) {
    showToast('Please enter an APK URL', 'warning');
    return;
  }

  try {
    await apiRequest('/api/settings', 'PUT', { apkDownloadUrl: apkUrl });
    if (!state.settings) state.settings = {};
    state.settings.apkDownloadUrl = apkUrl;
    setInputValue('setting-apk-url', apkUrl);
    updateApkQrCode(apkUrl, state.settings?.appVersion);
    showToast('APK link updated & QR code regenerated!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
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
  setInputValue('match-stream-url', '');
  setInputValue('match-cookie-value', '');
  setInputValue('match-referer-value', '');
  setInputValue('match-origin-value', '');
  setInputValue('match-drm-license-url', '');
  setInputValue('match-user-agent', 'Default');
  setInputValue('match-drm-scheme', 'clearkey');
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
  setInputValue('match-team2-name', m.team2?.name || '');

  const pinned = document.getElementById('match-pinned');
  if (pinned) pinned.checked = Boolean(m.isPinned);

  const firstStream = m.streams?.[0];
  if (firstStream) {
    setInputValue('match-stream-url', firstStream.streamUrl || '');
    setInputValue('match-cookie-value', firstStream.headers?.cookie || '');
    setInputValue('match-referer-value', firstStream.headers?.referer || '');
    setInputValue('match-origin-value', firstStream.headers?.origin || '');
    const drmLic = firstStream.drm?.licenseUrl || firstStream.drm?.key || (firstStream.drm?.keyId ? `${firstStream.drm.keyId}:${firstStream.drm.key}` : '');
    setInputValue('match-drm-license-url', drmLic);
    const ua = firstStream.headers?.userAgent || '';
    setInputValue('match-user-agent', ua.includes('Hotstar') ? 'Hotstar' : (ua.includes('Jio') ? 'JioCinema' : (ua.includes('Exo') ? 'ExoPlayer' : (ua.includes('Chrome') || ua.includes('Mozilla') ? 'Chrome' : 'Default'))));
    setInputValue('match-drm-scheme', firstStream.drm?.scheme || (firstStream.drm?.enabled ? 'clearkey' : 'none'));
  } else {
    setInputValue('match-stream-url', '');
    setInputValue('match-cookie-value', '');
    setInputValue('match-referer-value', '');
    setInputValue('match-origin-value', '');
    setInputValue('match-drm-license-url', '');
    setInputValue('match-user-agent', 'Default');
    setInputValue('match-drm-scheme', 'clearkey');
  }

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
    isPinned: document.getElementById('match-pinned')?.checked || false,
    team1: {
      name: document.getElementById('match-team1-name')?.value.trim() || 'Team 1',
      score: ''
    },
    team2: {
      name: document.getElementById('match-team2-name')?.value.trim() || '',
      score: ''
    }
  };

  const streamUrlInput = document.getElementById('match-stream-url')?.value.trim();
  if (streamUrlInput) {
    const cookieVal = document.getElementById('match-cookie-value')?.value.trim() || '';
    const refererVal = document.getElementById('match-referer-value')?.value.trim() || '';
    const originVal = document.getElementById('match-origin-value')?.value.trim() || '';
    const drmLicUrl = document.getElementById('match-drm-license-url')?.value.trim() || '';
    const userAgentVal = document.getElementById('match-user-agent')?.value || 'Default';
    const drmSchemeVal = document.getElementById('match-drm-scheme')?.value || 'clearkey';

    let finalUa = '';
    if (userAgentVal === 'Hotstar') finalUa = 'HotstarMobile/12.5.0 (Android 14; Mobile)';
    else if (userAgentVal === 'JioCinema') finalUa = 'JioCinema/24.0.0 (Linux; Android 14)';
    else if (userAgentVal === 'ExoPlayer') finalUa = 'ExoPlayer (Android)';
    else if (userAgentVal === 'Chrome') finalUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0';
    else if (userAgentVal !== 'Default') finalUa = userAgentVal;

    let isDrm = Boolean(drmLicUrl && drmSchemeVal !== 'none');
    let keyId = '';
    let key = '';
    let licenseUrl = '';
    if (drmLicUrl) {
      // Format: KID:KEY hex pair (e.g. "abc123:def456") - only if NOT a URL
      if (!drmLicUrl.startsWith('http') && drmLicUrl.includes(':')) {
        const colonIdx = drmLicUrl.indexOf(':');
        keyId = drmLicUrl.substring(0, colonIdx).trim();
        key = drmLicUrl.substring(colonIdx + 1).trim();
      } else {
        // It's a license URL (Widevine / ClearKey endpoint)
        licenseUrl = drmLicUrl;
        key = drmLicUrl;
      }
    }

    const streamObj = {
      id: 'str_' + Math.random().toString(36).substr(2, 9),
      title: payload.title || 'Live Stream Server',
      streamType: streamUrlInput.includes('.mpd') ? 'MPD' : 'M3U8',
      streamUrl: streamUrlInput,
      quality: '1080p HD',
      headers: {
        userAgent: finalUa,
        referer: refererVal,
        origin: originVal,
        cookie: cookieVal
      },
      drm: {
        enabled: isDrm,
        scheme: drmSchemeVal,
        keyId,
        key,
        licenseUrl
      },
      isActive: true
    };

    if (id) {
      const existing = state.matches.find(m => m._id === id);
      const remainingStreams = (existing?.streams || []).slice(1);
      payload.streams = [streamObj, ...remainingStreams];
    } else {
      payload.streams = [streamObj];
    }
  } else if (id) {
    const existing = state.matches.find(m => m._id === id);
    if (existing?.streams) {
      payload.streams = existing.streams;
    }
  }

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

  container.innerHTML = streams.map(s => {
    const sid = s.id || s._id || '';
    return `
    <div class="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap mb-1">
            <span class="font-bold text-xs text-white truncate">${s.title}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">${s.streamType}</span>
            ${s.drm?.enabled ? '<span class="drm-pill text-[10px]">DRM</span>' : ''}
          </div>
          <p class="text-[11px] font-mono text-emerald-400 truncate">${s.streamUrl || s.jsonChannelUrl || ''}</p>
          ${s.headers?.userAgent ? `<p class="text-[10px] text-slate-500 font-mono truncate">UA: ${s.headers.userAgent}</p>` : ''}
          ${s.headers?.referer ? `<p class="text-[10px] text-slate-500 font-mono truncate">Ref: ${s.headers.referer}</p>` : ''}
          ${s.drm?.licenseUrl ? `<p class="text-[10px] text-amber-400 font-mono truncate">DRM: ${s.drm.licenseUrl}</p>` : ''}
        </div>

      <div class="flex items-center gap-2 shrink-0">
        <button onclick="previewStream('${s.streamUrl}', '${s.streamType}')" class="btn-ghost text-xs p-1.5" title="Test Playback">
          <i class="fa-solid fa-play text-emerald-400"></i>
        </button>
        <button onclick="deleteStream('${match._id}', '${sid}')" class="text-red-400 hover:text-red-300 text-xs p-1.5" title="Delete Stream">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  `}).join('');
}

function toggleDrmInputs(checked) {
  const container = document.getElementById('drm-inputs-container');
  if (container) {
    container.classList.toggle('hidden', !checked);
  }
}

function handleDrmSchemeChange(scheme) {
  const isWidevine = scheme === 'widevine';
  const ckFields = document.getElementById('clearkey-fields');
  const wvFields = document.getElementById('widevine-fields');
  if (ckFields) ckFields.classList.toggle('hidden', isWidevine);
  if (wvFields) wvFields.classList.toggle('hidden', !isWidevine);
}

function applyOttPreset(type) {
  const ua = document.getElementById('stream-user-agent');
  const ref = document.getElementById('stream-referer');
  const drmChk = document.getElementById('stream-drm-enable');
  const schemeSel = document.getElementById('stream-drm-scheme');

  if (type === 'hotstar') {
    if (ua) ua.value = 'HotstarMobile/12.5.0 (Android 14; Mobile)';
    if (ref) ref.value = 'https://www.hotstar.com/';
    if (drmChk) { drmChk.checked = true; toggleDrmInputs(true); }
    if (schemeSel) { schemeSel.value = 'widevine'; handleDrmSchemeChange('widevine'); }
    showToast('Hotstar Preset applied (Widevine DRM + UA)', 'info');
  } else if (type === 'jio') {
    if (ua) ua.value = 'JioCinema/24.0.0 (Linux; Android 14)';
    if (ref) ref.value = 'https://www.jiocinema.com/';
    if (drmChk) { drmChk.checked = true; toggleDrmInputs(true); }
    if (schemeSel) { schemeSel.value = 'widevine'; handleDrmSchemeChange('widevine'); }
    showToast('JioCinema Preset applied (Widevine DRM + UA)', 'info');
  } else if (type === 'sony') {
    if (ua) ua.value = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0';
    if (ref) ref.value = 'https://www.sonyliv.com/';
    showToast('Sony LIV Preset applied (UA + Referer)', 'info');
  }
}

async function handleSaveStream(e) {
  e.preventDefault();
  const matchId = document.getElementById('stream-match-id').value;
  const rawStreamUrl = document.getElementById('stream-url')?.value.trim();
  if (!rawStreamUrl) {
    showToast('Please enter a Media Stream URL', 'warning');
    return;
  }

  const cookieVal = document.getElementById('stream-cookie')?.value.trim() || '';
  const refererVal = document.getElementById('stream-referer')?.value.trim() || '';
  const originVal = document.getElementById('stream-origin')?.value.trim() || '';
  const drmLicUrl = document.getElementById('stream-drm-license-url')?.value.trim() || '';
  const userAgentVal = document.getElementById('stream-user-agent')?.value || 'Default';
  const drmSchemeVal = document.getElementById('stream-drm-scheme')?.value || 'clearkey';

  let finalUa = '';
  if (userAgentVal === 'Hotstar') finalUa = 'HotstarMobile/12.5.0 (Android 14; Mobile)';
  else if (userAgentVal === 'JioCinema') finalUa = 'JioCinema/24.0.0 (Linux; Android 14)';
  else if (userAgentVal === 'ExoPlayer') finalUa = 'ExoPlayer (Android)';
  else if (userAgentVal === 'Chrome') finalUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0';
  else if (userAgentVal !== 'Default') finalUa = userAgentVal;

  let isDrm = Boolean(drmLicUrl && drmSchemeVal !== 'none');
  let keyId = '';
  let key = '';
  let licenseUrl = '';
  if (drmLicUrl) {
    if (drmLicUrl.includes(':') && !drmLicUrl.startsWith('http')) {
      const parts = drmLicUrl.split(':');
      keyId = parts[0].trim();
      key = parts[1].trim();
    } else {
      licenseUrl = drmLicUrl;
      key = drmLicUrl;
    }
  }

  const payload = {
    title: document.getElementById('stream-title')?.value.trim() || 'Live Stream Server',
    streamType: document.getElementById('stream-type')?.value || (rawStreamUrl.includes('.mpd') ? 'MPD' : 'M3U8'),
    streamUrl: rawStreamUrl,
    quality: '1080p HD',
    headers: {
      userAgent: finalUa,
      referer: refererVal,
      origin: originVal,
      cookie: cookieVal
    },
    drm: {
      enabled: isDrm,
      scheme: drmSchemeVal,
      keyId,
      key,
      licenseUrl
    }
  };

  try {
    const res = await apiRequest(`/api/matches/${matchId}/streams`, 'POST', payload);
    showToast('Streaming server added successfully!', 'success');
    document.getElementById('form-stream').reset();

    await fetchMatches();
    await fetchDashboardStats();

    // Re-render streams inside open modal
    const updatedMatch = state.matches.find(m => m._id === matchId);
    if (updatedMatch) renderStreamsModalList(updatedMatch);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openImportModal() {
  openModal('modal-import');
}

function switchImportTab(tab) {
  const isM3u = tab === 'm3u';
  const m3uForm = document.getElementById('form-import-m3u');
  const jsonForm = document.getElementById('form-import-json');
  if (m3uForm) m3uForm.classList.toggle('hidden', !isM3u);
  if (jsonForm) jsonForm.classList.toggle('hidden', isM3u);

  const m3uTab = document.getElementById('import-tab-m3u');
  const jsonTab = document.getElementById('import-tab-json');
  if (m3uTab) {
    m3uTab.className = isM3u
      ? 'flex-1 py-1.5 rounded-md font-bold text-xs bg-purple-600 text-white'
      : 'flex-1 py-1.5 rounded-md font-bold text-xs text-slate-400 hover:text-white';
  }
  if (jsonTab) {
    jsonTab.className = !isM3u
      ? 'flex-1 py-1.5 rounded-md font-bold text-xs bg-purple-600 text-white'
      : 'flex-1 py-1.5 rounded-md font-bold text-xs text-slate-400 hover:text-white';
  }
}

async function loadUserGoogleDriveM3u() {
  const gdriveUrl = 'https://drive.google.com/uc?export=download&id=1KxcfPpIjkeRaHWyrN53otPBci5s6FMMO';
  const urlInput = document.getElementById('import-m3u-url');
  if (urlInput) urlInput.value = gdriveUrl;
  showToast('Loading Google Drive M3U playlists...', 'info');

  try {
    const res = await apiRequest('/api/import/m3u', 'POST', { m3uUrl: gdriveUrl });
    showToast(res.message || 'Successfully loaded playlists!', 'success');
    closeModal('modal-import');
    await fetchMatches();
    await fetchCategories();
    await fetchDashboardStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleImportM3u(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-submit-m3u');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Importing...';
  }

  try {
    const m3uUrl = document.getElementById('import-m3u-url').value.trim();
    const m3uContent = document.getElementById('import-m3u-text').value.trim();
    const defaultCategory = document.getElementById('import-m3u-category').value.trim();

    const res = await apiRequest('/api/import/m3u', 'POST', { m3uUrl, m3uContent, defaultCategory });
    showToast(res.message || 'M3U channels imported successfully!', 'success');
    closeModal('modal-import');
    document.getElementById('form-import-m3u').reset();
    await fetchMatches();
    await fetchCategories();
    await fetchDashboardStats();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Import M3U Channels';
    }
  }
}

async function handleImportJson(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-submit-json');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Importing...';
  }

  try {
    const jsonUrl = document.getElementById('import-json-url').value.trim();
    const jsonContent = document.getElementById('import-json-text').value.trim();
    const defaultCategory = document.getElementById('import-json-category').value.trim();

    const res = await apiRequest('/api/import/json', 'POST', { jsonUrl, jsonContent, defaultCategory });
    showToast(res.message || 'JSON channels imported successfully!', 'success');
    closeModal('modal-import');
    document.getElementById('form-import-json').reset();
    await fetchMatches();
    await fetchCategories();
    await fetchDashboardStats();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Import JSON Channels';
    }
  }
}

async function deleteStream(matchId, streamId) {
  if (!confirm('Remove this streaming link?')) return;
  const match = state.matches.find(m => String(m._id) === String(matchId));
  if (match && match.streams) {
    match.streams = match.streams.filter(s => String(s.id || s._id) !== String(streamId));
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
  const streamUrl = document.getElementById('episode-url').value.trim();

  if (!streamUrl) {
    showToast('Please enter a stream/video URL', 'warning');
    return;
  }

  const payload = {
    episodeNumber: Number(document.getElementById('episode-num').value) || 1,
    title: document.getElementById('episode-title').value.trim(),
    streamUrl,
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
    if (!state.settings) state.settings = {};
    Object.assign(state.settings, payload);
    updateApkQrCode(payload.apkDownloadUrl, payload.appVersion);
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

// --- DIRECT CHANNEL (MANUAL + TOKEN + DRM JSON KEY) HANDLERS ---

function openDirectChannelModal() {
  const form = document.getElementById('form-direct-channel');
  if (form) form.reset();
  const select = document.getElementById('direct-channel-category');
  if (select && state.categories && state.categories.length > 0) {
    select.innerHTML = state.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
  }
  openModal('modal-direct-channel');
}

function applyDirectPreset(preset) {
  const ua = document.getElementById('direct-header-ua');
  const ref = document.getElementById('direct-header-ref');
  const presets = {
    hotstar: { ua: 'Hotstar;Android/12.5.0 (Linux; Android 14; SM-S918B)', ref: 'https://www.hotstar.com/' },
    jio: { ua: 'JioCinema/24.03.11 (Linux; Android 14)', ref: 'https://www.jiocinema.com/' },
    sony: { ua: 'SonyLIV/6.12.0 (Android; 14; Mobile)', ref: 'https://www.sonyliv.com/' },
    fancode: { ua: 'FanCode/7.10.0 (Android; 14)', ref: 'https://www.fancode.com/' }
  };
  if (presets[preset]) {
    if (ua) ua.value = presets[preset].ua;
    if (ref) ref.value = presets[preset].ref;
    showToast(`Applied ${preset.toUpperCase()} preset headers!`, 'info');
  }
}

function toggleDirectDrm(enabled) {
  const container = document.getElementById('direct-drm-container');
  if (container) container.classList.toggle('hidden', !enabled);
}

function handleDirectDrmSchemeChange(scheme) {
  const clearkey = document.getElementById('direct-clearkey-fields');
  const widevine = document.getElementById('direct-widevine-fields');
  if (clearkey && widevine) {
    clearkey.classList.toggle('hidden', scheme !== 'clearkey');
    widevine.classList.toggle('hidden', scheme !== 'widevine');
  }
}

async function handleDirectChannelSave(e) {
  e.preventDefault();
  const title = document.getElementById('direct-channel-title').value.trim();
  const category = document.getElementById('direct-channel-category').value;
  const streamUrl = document.getElementById('direct-stream-url').value.trim();
  const streamType = document.getElementById('direct-stream-type').value;
  const quality = document.getElementById('direct-stream-quality').value.trim();
  const status = document.getElementById('direct-channel-status').value;
  const token = document.getElementById('direct-stream-token').value.trim();
  const userAgent = document.getElementById('direct-header-ua').value.trim();
  const referer = document.getElementById('direct-header-ref').value.trim();
  const origin = document.getElementById('direct-header-origin')?.value.trim() || '';
  const cookie = document.getElementById('direct-header-cookie').value.trim();
  const bannerUrl = document.getElementById('direct-channel-banner').value.trim();
  const drmEnabled = document.getElementById('direct-drm-enable').checked;
  const drmScheme = document.getElementById('direct-drm-scheme').value;
  const kidKey = document.getElementById('direct-drm-kidkey').value.trim();
  const licenseUrl = document.getElementById('direct-drm-license-url').value.trim();

  let drm = { enabled: false };
  if (drmEnabled) {
    if (drmScheme === 'clearkey') {
      let keyId = '';
      let key = '';
      if (kidKey.includes(':')) {
        const parts = kidKey.split(':');
        keyId = parts[0].trim();
        key = parts[1].trim();
      } else {
        keyId = kidKey;
        key = kidKey;
      }
      drm = { enabled: true, scheme: 'clearkey', keyId, key, licenseUrl: '' };
    } else {
      drm = { enabled: true, scheme: 'widevine', keyId: '', key: licenseUrl, licenseUrl };
    }
  }

  const jsonChannelUrl = document.getElementById('direct-json-channel-url')?.value.trim() || '';
  const jsonTokenUrl = document.getElementById('direct-json-token-url')?.value.trim() || '';
  const effectiveStreamUrl = streamUrl || jsonChannelUrl;

  if (!effectiveStreamUrl) {
    showToast('Please enter a Stream URL or JSON Channel URL', 'warning');
    return;
  }

  const payload = {
    title,
    category,
    status,
    format: 'HD Stream',
    bannerUrl,
    description: `Official broadcast of ${title}`,
    streamTitle: `${title} - High Quality`,
    streamType,
    streamUrl: effectiveStreamUrl,
    jsonChannelUrl,
    jsonTokenUrl,
    jsonToken: token,
    quality,
    token,
    userAgent,
    referer,
    origin,
    cookie,
    drm
  };

  const btn = document.getElementById('btn-save-direct-channel');
  if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publishing...';

  try {
    const res = await apiRequest('/api/channels/direct-create', 'POST', payload);
    showToast(res.message || 'Channel created and live in app feed!', 'success');
    closeModal('modal-direct-channel');
    await fetchMatches();
    await fetchDashboardStats();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (btn) btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Publish Channel to Feed';
  }
}

// --- PIPED STREAM URL & HEADERS AUTO-PARSER ---
// Auto-parses links like: https://example.com/master.m3u8?token=...|User-Agent=...&Referer=...&Origin=...
function initPipedUrlListeners() {
  function attach(urlId, uaId, refId, originId) {
    const input = document.getElementById(urlId);
    if (!input) return;

    input.addEventListener('input', () => {
      const val = input.value.trim();
      if (val.includes('|')) {
        const pipeIdx = val.indexOf('|');
        const cleanUrl = val.substring(0, pipeIdx).trim();
        const headerStr = val.substring(pipeIdx + 1).trim();

        input.value = cleanUrl;

        const pairs = headerStr.split(/[&|]/);
        for (const pair of pairs) {
          const eq = pair.indexOf('=');
          if (eq > 0) {
            const k = pair.substring(0, eq).trim().toLowerCase();
            const v = pair.substring(eq + 1).trim();
            if (k && v) {
              if (k === 'user-agent' && uaId) {
                const el = document.getElementById(uaId);
                if (el) el.value = v;
              } else if (k === 'referer' && refId) {
                const el = document.getElementById(refId);
                if (el) el.value = v;
              } else if (k === 'origin' && originId) {
                const el = document.getElementById(originId);
                if (el) el.value = v;
              }
            }
          }
        }
        showToast('✓ Auto-extracted Piped Stream URL & Headers (Sony LIV / Jio / Hotstar)!', 'success');
      }
    });
  }

  attach('match-stream-url', 'match-user-agent', 'match-referer-value', 'match-origin-value');
  attach('stream-url', 'stream-user-agent', 'stream-referer', null);
  attach('direct-stream-url', 'direct-header-ua', 'direct-header-ref', 'direct-header-origin');
}

// --- ADMIN CREDENTIALS UPDATE ---
async function handleChangeCredentials(e) {
  e.preventDefault();
  const currentPassword = document.getElementById('cred-current-pass').value;
  const newUsername = document.getElementById('cred-new-user').value.trim();
  const newPassword = document.getElementById('cred-new-pass').value;
  const statusEl = document.getElementById('cred-change-status');

  if (statusEl) {
    statusEl.textContent = 'Updating credentials...';
    statusEl.className = 'text-xs text-amber-400 font-semibold';
  }

  try {
    const res = await apiRequest('/api/auth/change-credentials', 'POST', {
      currentPassword,
      newUsername,
      newPassword
    });

    if (res.token) {
      state.adminKey = res.token;
      localStorage.setItem('hd_stream_admin_key', res.token);
    }

    if (statusEl) {
      statusEl.textContent = '✓ Updated successfully!';
      statusEl.className = 'text-xs text-emerald-400 font-semibold';
    }
    showToast('Admin username & password updated!', 'success');
    document.getElementById('form-change-credentials').reset();
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = '✗ ' + (err.message || 'Update failed');
      statusEl.className = 'text-xs text-rose-400 font-semibold';
    }
    showToast(err.message || 'Failed to update credentials', 'error');
  }
}
