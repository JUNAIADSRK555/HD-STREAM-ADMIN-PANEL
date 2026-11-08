const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Match = require('../models/Match');
const Category = require('../models/Category');
const Vod = require('../models/Vod');
const Settings = require('../models/Settings');
const { Device, AnalyticsSummary } = require('../models/Analytics');

const inMemoryDevices = new Map();
let inMemoryApkDownloads = 0; // Real download counter, no fake offset

function parseDeviceModel(ua) {
  if (!ua) return 'Android Device';
  if (ua.includes('BRAVIA')) return 'Sony BRAVIA 4K Smart TV';
  if (ua.includes('AFTSSS')) return 'Amazon Fire TV Cube / 4K';
  if (ua.includes('AFTT')) return 'Amazon Fire TV Stick';
  if (ua.includes('H96_Max')) return 'H96 Max 4K Android Box';
  if (ua.includes('FW-Plus')) return 'FW-Plus 4K TV Box';
  const match = ua.match(/Android [^;]+;\s*([^;]+?)\s+Build/i);
  if (match && match[1]) {
    const raw = match[1].trim();
    if (raw.startsWith('SM-S948')) return 'Samsung Galaxy S24 Ultra (' + raw + ')';
    if (raw.startsWith('SM-A')) return 'Samsung Galaxy (' + raw + ')';
    if (raw.startsWith('RMX')) return 'Realme (' + raw + ')';
    if (raw.startsWith('CPH')) return 'OPPO / OnePlus (' + raw + ')';
    if (raw.startsWith('23124RN') || raw.startsWith('23076RN')) return 'Redmi / Xiaomi (' + raw + ')';
    if (raw.startsWith('M2010J')) return 'Redmi 9 Power (' + raw + ')';
    if (raw.startsWith('X6812')) return 'Infinix Smart 5 Pro (' + raw + ')';
    return raw;
  }
  return 'Android Phone / TV';
}

function getDeviceId(ip, userAgent) {
  const cleanIp = (ip || '').split(',')[0].trim().replace(/^.*:/, '') || 'device';
  const cleanUa = (userAgent || '').substring(0, 100);
  return crypto.createHash('sha256').update(`${cleanIp}_${cleanUa}`).digest('hex').substring(0, 16);
}

// Initial seed data for immediate out-of-the-box demo
const initialCategories = [
  { _id: 'cat_jiotv', id: 'cat_jiotv', name: 'JIO TV+', slug: 'jio-tv', icon: 'fas fa-tv', imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRKIIUwitJWzKomNurXMsbwVwSjDt3LgjOgWg&s', m3uLink: 'https://allinonereborn2.online/jiotv-m3u/jtv25.m3u8', order: 1, isActive: true },
  { _id: 'cat_mixtv', id: 'cat_mixtv', name: 'MIX TV', slug: 'mix-tv', icon: 'fas fa-satellite-dish', imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQCm7hdWxlS5fbZ3Do-pqzytQVayxUNHFl5oD5E4TWtQfCnRw2pM2UOa8I&s=10', m3uLink: 'https://streamflexsmm.in/SFlex-StarShare/playlist.php', order: 2, isActive: true },
  { _id: 'cat_vzy', id: 'cat_vzy', name: 'VZY', slug: 'vzy', icon: 'fas fa-play-circle', imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQIYAVnSjMhpKILSGSOyqeLnackwGjeolKPRVv4Yh0UW8RJI-hYBKQbO319&s=10', m3uLink: 'https://pastyx.pages.dev/api/paste/vzy-playlist-m3u/raw', order: 3, isActive: true },
  { _id: 'cat_pakistan', id: 'cat_pakistan', name: 'PAKISTAN TV', slug: 'pakistan-tv', icon: 'fas fa-globe-asia', imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRBLV9kgm97df5xLeoC-7i8uhp65boAZKw3__9QNW9WGYA0HHk7hS2MBvDa&s=10', m3uLink: 'https://iptv-org.github.io/iptv/countries/pk.m3u', order: 4, isActive: true },
  { _id: 'cat_toffee', id: 'cat_toffee', name: 'TOFFEE', slug: 'toffee', icon: 'fas fa-film', imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRLjYG2Yb4mLqygUe_GDkKu5Rw73jqEQmxeXddimkUpE2NrKsvXfaMf-LMQ&s=10', m3uLink: 'https://iptv-org.github.io/iptv/languages/hin.m3u', order: 5, isActive: true },
  { _id: 'cat_irantv', id: 'cat_irantv', name: 'IRAN TV', slug: 'iran-tv', icon: 'fas fa-tv', imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRdoOQ3JwH-PctWnHvCiXlG-Og7Vmav3MQANQ&s', m3uLink: 'https://iptv-org.github.io/iptv/countries/ir.m3u', order: 6, isActive: true },
  { _id: 'cat_afghan', id: 'cat_afghan', name: 'Afghanistan TV', slug: 'afghanistan-tv', icon: 'fas fa-tv', imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT-i-alUhNqSc08Q7HHJO2i7fCxKxZKBJCXfKf7QymkpmqVhEK4G75wQgs&s=10', m3uLink: 'https://iptv-org.github.io/iptv/countries/af.m3u', order: 7, isActive: true },
  { _id: 'cat_cartoon', id: 'cat_cartoon', name: 'CARTOON MOVIE', slug: 'cartoon-movie', icon: 'fas fa-child', imageUrl: 'https://logos-world.net/wp-content/uploads/2022/06/CMovies-Symbol.png', m3uLink: 'https://drive.google.com/uc?export=download&id=1UZ1M-R5Lx58Hi7qkbi5Ylnf8UirfRFPH', order: 8, isActive: true },
  { _id: 'cat_mxplayer', id: 'cat_mxplayer', name: 'MX PLAYER', slug: 'mx-player', icon: 'fas fa-play', imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT1NMH254M3gNL2gmhzuwqdRswejy1avQaUvDjHlgGhRA&s=10', m3uLink: 'https://playlist-by-xfireflix.pages.dev/India/mxplayer', order: 9, isActive: true },
  { _id: 'cat_yuppytv', id: 'cat_yuppytv', name: 'YUPPY TV', slug: 'yuppy-tv', icon: 'fas fa-broadcast-tower', imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSU9aEfg_OS21ZixLmLgbdJvnf90iTZ4zwVtg&s', m3uLink: 'https://raw.githubusercontent.com/abusaeeidx/Yupptv-Playlist/refs/heads/main/playlist.m3u', order: 10, isActive: true },
  { _id: 'cat_cinexmovies', id: 'cat_cinexmovies', name: 'CINEX MOVIES', slug: 'cinex-movies', icon: 'fas fa-film', imageUrl: 'https://image.tmdb.org/t/p/w500/dswjf9LMu2DAffcvTBzqYK3pu10.jpg', m3uLink: 'https://stream-admin-backend.vercel.app/api/movies/data.json', order: 11, isActive: true }
];

const initialMatches = [];

const initialVods = [
  {
    _id: 'ch_jiotv_1',
    title: 'JIO TV+',
    category: 'JIO TV+',
    status: 'LIVE',
    matchFormat: 'Live TV',
    startTime: new Date().toISOString(),
    bannerUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRKIIUwitJWzKomNurXMsbwVwSjDt3LgjOgWg&s',
    description: 'JIO TV+ Live Channels VIP Playlist API.',
    isPinned: true,
    team1: { name: 'JIO TV+', shortName: 'JIO', flag: '📺', score: '' },
    team2: { name: 'VIP Stream', shortName: 'LIVE', flag: '🔴', score: '' },
    streams: [
      {
        id: 'str_jio_01',
        title: 'JIO TV+ VIP Stream',
        streamType: 'M3U8',
        streamUrl: 'https://plugxvipplaylist.lovable.app/api/playlist',
        quality: '1080p HD',
        headers: {},
        drm: { enabled: false, scheme: 'clearkey', keyId: '', key: '' },
        isActive: true
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'ch_jiotv_2',
    title: 'JIO TV+ (Server 2)',
    category: 'JIO TV+',
    status: 'LIVE',
    matchFormat: 'Live TV',
    startTime: new Date().toISOString(),
    bannerUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRKIIUwitJWzKomNurXMsbwVwSjDt3LgjOgWg&s',
    description: 'JIO TV+ Alternate Live Stream Feed.',
    isPinned: false,
    team1: { name: 'JIO TV+ 2', shortName: 'JIO', flag: '📺', score: '' },
    team2: { name: 'Direct Feed', shortName: 'M3U8', flag: '⚡', score: '' },
    streams: [
      {
        id: 'str_jio_02',
        title: 'JIO TV 25 Live M3U8',
        streamType: 'M3U8',
        streamUrl: 'https://allinonereborn2.online/jiotv-m3u/jtv25.m3u8',
        quality: '1080p HD',
        headers: {},
        drm: { enabled: false, scheme: 'clearkey', keyId: '', key: '' },
        isActive: true
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'ch_mixtv',
    title: 'MIX TV',
    category: 'MIX TV',
    status: 'LIVE',
    matchFormat: 'Live TV',
    startTime: new Date().toISOString(),
    bannerUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQCm7hdWxlS5fbZ3Do-pqzytQVayxUNHFl5oD5E4TWtQfCnRw2pM2UOa8I&s=10',
    description: 'MIX TV Live Sports & Entertainment Stream.',
    isPinned: false,
    team1: { name: 'MIX TV', shortName: 'MIX', flag: '📺', score: '' },
    team2: { name: 'StarShare', shortName: 'LIVE', flag: '🔴', score: '' },
    streams: [
      {
        id: 'str_mix_01',
        title: 'MIX TV Live Feed',
        streamType: 'M3U8',
        streamUrl: 'https://streamflexsmm.in/SFlex-StarShare/playlist.php',
        quality: '1080p HD',
        headers: {},
        drm: { enabled: false, scheme: 'clearkey', keyId: '', key: '' },
        isActive: true
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'ch_vzy',
    title: 'VZY',
    category: 'VZY',
    status: 'LIVE',
    matchFormat: 'Live TV',
    startTime: new Date().toISOString(),
    bannerUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQIYAVnSjMhpKILSGSOyqeLnackwGjeolKPRVv4Yh0UW8RJI-hYBKQbO319&s=10',
    description: 'VZY Channels Playlist Feed.',
    isPinned: false,
    team1: { name: 'VZY', shortName: 'VZY', flag: '📺', score: '' },
    team2: { name: 'Live', shortName: 'LIVE', flag: '🔴', score: '' },
    streams: [
      {
        id: 'str_vzy_01',
        title: 'VZY M3U Raw Feed',
        streamType: 'M3U8',
        streamUrl: 'https://pastyx.pages.dev/api/paste/vzy-playlist-m3u/raw',
        quality: '1080p HD',
        headers: {},
        drm: { enabled: false, scheme: 'clearkey', keyId: '', key: '' },
        isActive: true
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'ch_pakistantv',
    title: 'PAKISTAN TV',
    category: 'PAKISTAN TV',
    status: 'LIVE',
    matchFormat: 'Live TV',
    startTime: new Date().toISOString(),
    bannerUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRBLV9kgm97df5xLeoC-7i8uhp65boAZKw3__9QNW9WGYA0HHk7hS2MBvDa&s=10',
    description: 'Pakistan Live News, Sports & Entertainment channels.',
    isPinned: false,
    team1: { name: 'PAKISTAN TV', shortName: 'PAK', flag: '🇵🇰', score: '' },
    team2: { name: 'Live All', shortName: 'IPTV', flag: '🔴', score: '' },
    streams: [
      {
        id: 'str_pak_01',
        title: 'Pakistan IPTV M3U Playlist',
        streamType: 'M3U8',
        streamUrl: 'https://iptv-org.github.io/iptv/countries/pk.m3u',
        quality: '1080p HD',
        headers: {},
        drm: { enabled: false, scheme: 'clearkey', keyId: '', key: '' },
        isActive: true
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'ch_toffee',
    title: 'TOFFEE',
    category: 'TOFFEE',
    status: 'LIVE',
    matchFormat: 'Live TV',
    startTime: new Date().toISOString(),
    bannerUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRLjYG2Yb4mLqygUe_GDkKu5Rw73jqEQmxeXddimkUpE2NrKsvXfaMf-LMQ&s=10',
    description: 'Toffee Hindi Language Channels & Entertainment.',
    isPinned: false,
    team1: { name: 'TOFFEE', shortName: 'TOF', flag: '📺', score: '' },
    team2: { name: 'Hindi Channels', shortName: 'HIN', flag: '🔴', score: '' },
    streams: [
      {
        id: 'str_tof_01',
        title: 'Toffee Hindi IPTV Feed',
        streamType: 'M3U8',
        streamUrl: 'https://iptv-org.github.io/iptv/languages/hin.m3u',
        quality: '1080p HD',
        headers: {},
        drm: { enabled: false, scheme: 'clearkey', keyId: '', key: '' },
        isActive: true
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'ch_irantv',
    title: 'IRAN TV',
    category: 'IRAN TV',
    status: 'LIVE',
    matchFormat: 'Live TV',
    startTime: new Date().toISOString(),
    bannerUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRdoOQ3JwH-PctWnHvCiXlG-Og7Vmav3MQANQ&s',
    description: 'Iran National and Regional Television Channels.',
    isPinned: false,
    team1: { name: 'IRAN TV', shortName: 'IRN', flag: '🇮🇷', score: '' },
    team2: { name: 'Live Broadcast', shortName: 'LIVE', flag: '🔴', score: '' },
    streams: [
      {
        id: 'str_irn_01',
        title: 'Iran IPTV M3U Playlist',
        streamType: 'M3U8',
        streamUrl: 'https://iptv-org.github.io/iptv/countries/ir.m3u',
        quality: '1080p HD',
        headers: {},
        drm: { enabled: false, scheme: 'clearkey', keyId: '', key: '' },
        isActive: true
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'ch_afghantv',
    title: 'Afghanistan TV',
    category: 'Afghanistan TV',
    status: 'LIVE',
    matchFormat: 'Live TV',
    startTime: new Date().toISOString(),
    bannerUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT-i-alUhNqSc08Q7HHJO2i7fCxKxZKBJCXfKf7QymkpmqVhEK4G75wQgs&s=10',
    description: 'Afghanistan Live TV Channels Stream.',
    isPinned: false,
    team1: { name: 'Afghanistan TV', shortName: 'AFG', flag: '🇦🇫', score: '' },
    team2: { name: 'Live Stream', shortName: 'LIVE', flag: '🔴', score: '' },
    streams: [
      {
        id: 'str_afg_01',
        title: 'Afghanistan IPTV M3U',
        streamType: 'M3U8',
        streamUrl: 'https://iptv-org.github.io/iptv/countries/af.m3u',
        quality: '1080p HD',
        headers: {},
        drm: { enabled: false, scheme: 'clearkey', keyId: '', key: '' },
        isActive: true
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'ch_cartoonmovie',
    title: 'CARTOON MOVIE',
    category: 'CARTOON MOVIE',
    status: 'LIVE',
    matchFormat: 'Movies',
    startTime: new Date().toISOString(),
    bannerUrl: 'https://logos-world.net/wp-content/uploads/2022/06/CMovies-Symbol.png',
    description: 'Cartoon Movies and Kids Animation playlist.',
    isPinned: false,
    team1: { name: 'CARTOON MOVIE', shortName: 'KIDS', flag: '🎬', score: '' },
    team2: { name: 'HD Animation', shortName: 'ANIM', flag: '⭐', score: '' },
    streams: [
      {
        id: 'str_cart_01',
        title: 'Cartoon Movie M3U Playlist',
        streamType: 'M3U8',
        streamUrl: 'https://drive.google.com/uc?export=download&id=1UZ1M-R5Lx58Hi7qkbi5Ylnf8UirfRFPH',
        quality: '1080p HD',
        headers: {},
        drm: { enabled: false, scheme: 'clearkey', keyId: '', key: '' },
        isActive: true
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'ch_mxplayer',
    title: 'MX PLAYER',
    category: 'MX PLAYER',
    status: 'LIVE',
    matchFormat: 'OTT Live',
    startTime: new Date().toISOString(),
    bannerUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT1NMH254M3gNL2gmhzuwqdRswejy1avQaUvDjHlgGhRA&s=10',
    description: 'MX Player India Channels Stream Playlist.',
    isPinned: false,
    team1: { name: 'MX PLAYER', shortName: 'MXP', flag: '📺', score: '' },
    team2: { name: 'India Live', shortName: 'IND', flag: '🔴', score: '' },
    streams: [
      {
        id: 'str_mxp_01',
        title: 'MX Player India Playlist',
        streamType: 'M3U8',
        streamUrl: 'https://playlist-by-xfireflix.pages.dev/India/mxplayer',
        quality: '1080p HD',
        headers: {},
        drm: { enabled: false, scheme: 'clearkey', keyId: '', key: '' },
        isActive: true
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'ch_yuppytv',
    title: 'YUPPY TV',
    category: 'YUPPY TV',
    status: 'LIVE',
    matchFormat: 'Live TV',
    startTime: new Date().toISOString(),
    bannerUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSU9aEfg_OS21ZixLmLgbdJvnf90iTZ4zwVtg&s',
    description: 'YuppTV Live Channels and Entertainment M3U.',
    isPinned: false,
    team1: { name: 'YUPPY TV', shortName: 'YUP', flag: '📺', score: '' },
    team2: { name: 'Global Channels', shortName: 'TV', flag: '🔴', score: '' },
    streams: [
      {
        id: 'str_yup_01',
        title: 'YuppTV Live M3U',
        streamType: 'M3U8',
        streamUrl: 'https://raw.githubusercontent.com/abusaeeidx/Yupptv-Playlist/refs/heads/main/playlist.m3u',
        quality: '1080p HD',
        headers: {},
        drm: { enabled: false, scheme: 'clearkey', keyId: '', key: '' },
        isActive: true
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

function loadPersistedCategories() {
  try {
    const filePath = path.join(__dirname, '../data/categories.json');
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (Array.isArray(data) && data.length > 0) {
        return data.map((c, idx) => ({
          _id: c.id || c._id || `cat_${idx + 1}`,
          id: c.id || c._id || `cat_${idx + 1}`,
          name: c.name,
          slug: c.slug || c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          icon: c.icon || 'fas fa-tv',
          imageUrl: c.imageUrl || '',
          m3uLink: c.m3uLink || '',
          portal_url: c.portal_url || '',
          mac: c.mac || '',
          order: idx + 1,
          isActive: true
        }));
      }
    }
  } catch (err) {
    console.error('Error loading persisted categories:', err.message);
  }
  return [...initialCategories];
}

function loadPersistedMatches() {
  try {
    const filePath = path.join(__dirname, '../data/live_matches.json');
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const list = [...(data.liveMatches || []), ...(data.upcomingMatches || [])];
      if (list.length > 0) {
        return list.map((m, idx) => ({
          _id: m._id || m.id || `match_persisted_${idx + 1}`,
          id: m.id || m._id || `match_persisted_${idx + 1}`,
          createdAt: m.createdAt || new Date(),
          updatedAt: m.updatedAt || new Date(),
          streams: [],
          ...m
        }));
      }
    }
  } catch (err) {
    console.error('Error loading persisted matches:', err.message);
  }
  return [...initialMatches];
}

let inMemoryState = {
  categories: loadPersistedCategories(),
  matches: loadPersistedMatches(),
  vods: [...initialVods],
  settings: {
    appName: 'HD STREAM',
    announcement: '🔴 HD STREAM v3.1.5 is LIVE! ⚡ Clean Live Events feed directly synced with Admin Panel!',
    announcementEnabled: true,
    appVersion: '3.1.5',
    minVersion: '3.1.5',
    apkDownloadUrl: 'https://stream-admin-backend.vercel.app/HD-STREAM.apk',
    maintenanceMode: false,
    telegramLink: 'https://t.me/livetvofficialapp',
    supportEmail: 'support@hdstream.live',
    adminUsername: 'shaikhabutlha506@gmail.com',
    adminPassword: 'Junaidsrk555',
    updatedAt: new Date()
  }
};

function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

const Store = {
  // --- MATCHES / LIVE EVENTS ---
  async getMatches(filter = {}) {
    if (isMongoConnected()) {
      const query = {};
      if (filter.status && filter.status !== 'ALL') {
        query.status = filter.status;
      }
      if (filter.category && filter.category !== 'ALL') {
        query.category = filter.category;
      }
      if (filter.search) {
        query.title = { $regex: filter.search, $options: 'i' };
      }
      return await Match.find(query).sort({ isPinned: -1, createdAt: -1 });
    }
    let list = inMemoryState.matches;
    if (filter.status && filter.status !== 'ALL') {
      list = list.filter(m => m.status === filter.status);
    }
    if (filter.category && filter.category !== 'ALL') {
      list = list.filter(m => m.category === filter.category);
    }
    if (filter.search) {
      const term = filter.search.toLowerCase();
      list = list.filter(m => m.title && m.title.toLowerCase().includes(term));
    }
    return list;
  },

  async getMatchById(id) {
    if (isMongoConnected()) {
      return await Match.findById(id);
    }
    return inMemoryState.matches.find(m => String(m._id) === String(id)) || null;
  },

  async createMatch(data) {
    let result = null;
    if (isMongoConnected()) {
      const match = new Match(data);
      result = await match.save();
    } else {
      const newMatch = {
        _id: 'match_' + Date.now().toString(36),
        createdAt: new Date(),
        updatedAt: new Date(),
        streams: [],
        ...data
      };
      inMemoryState.matches.unshift(newMatch);
      result = newMatch;
    }
    this.persistState().catch(() => {});
    return result;
  },

  async updateMatch(id, data) {
    let result = null;
    if (isMongoConnected()) {
      result = await Match.findByIdAndUpdate(id, data, { new: true });
    } else {
      const idx = inMemoryState.matches.findIndex(m => String(m._id) === String(id));
      if (idx !== -1) {
        inMemoryState.matches[idx] = {
          ...inMemoryState.matches[idx],
          ...data,
          updatedAt: new Date()
        };
        result = inMemoryState.matches[idx];
      }
    }
    this.persistState().catch(() => {});
    return result;
  },

  async deleteMatch(id) {
    let result = null;
    if (isMongoConnected()) {
      result = await Match.findByIdAndDelete(id);
    } else {
      const idx = inMemoryState.matches.findIndex(m => String(m._id) === String(id));
      if (idx !== -1) {
        const deleted = inMemoryState.matches.splice(idx, 1);
        result = deleted[0];
      }
    }
    this.persistState().catch(() => {});
    return result;
  },

  async deleteMultipleMatches(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return 0;
    let count = 0;
    if (isMongoConnected()) {
      const res = await Match.deleteMany({ _id: { $in: ids } });
      count = res.deletedCount || 0;
    } else {
      const initialLen = inMemoryState.matches.length;
      inMemoryState.matches = inMemoryState.matches.filter(m => !ids.includes(String(m._id)));
      count = initialLen - inMemoryState.matches.length;
    }
    this.persistState().catch(() => {});
    return count;
  },

  async deleteAllMatches() {
    if (isMongoConnected()) {
      const res = await Match.deleteMany({});
      return res.deletedCount || 0;
    }
    const count = inMemoryState.matches.length;
    inMemoryState.matches = [];
    return count;
  },

  // --- STREAMS INSIDE A MATCH ---
  async addStreamToMatch(matchId, streamData) {
    const rawUrl = streamData.streamUrl || streamData.url || streamData.link || streamData.stream || streamData.jsonChannelUrl || '';
    let cleanUrl = rawUrl ? String(rawUrl).trim() : '';
    const headers = {
      userAgent: streamData.headers?.userAgent || streamData.headers?.['User-Agent'] || '',
      referer: streamData.headers?.referer || streamData.headers?.['Referer'] || '',
      origin: streamData.headers?.origin || streamData.headers?.['Origin'] || '',
      cookie: streamData.headers?.cookie || streamData.headers?.['Cookie'] || ''
    };

    if (cleanUrl.includes('|')) {
      const pipeIdx = cleanUrl.indexOf('|');
      const headerStr = cleanUrl.substring(pipeIdx + 1).trim();
      cleanUrl = cleanUrl.substring(0, pipeIdx).trim();

      const pairs = headerStr.split(/[&|]/);
      for (const pair of pairs) {
        const eq = pair.indexOf('=');
        if (eq > 0) {
          const k = pair.substring(0, eq).trim().toLowerCase();
          const v = pair.substring(eq + 1).trim();
          if (k && v) {
            if (k === 'user-agent') headers.userAgent = v;
            else if (k === 'referer') headers.referer = v;
            else if (k === 'origin') headers.origin = v;
            else if (k === 'cookie') headers.cookie = v;
            else headers[k] = v;
          }
        }
      }
    }

    const streamObj = {
      id: 'str_' + Math.random().toString(36).substr(2, 9),
      title: streamData.title || 'Live Stream Server',
      streamType: streamData.streamType || (cleanUrl.includes('.mpd') ? 'MPD' : 'M3U8'),
      streamUrl: cleanUrl,
      jsonChannelUrl: streamData.jsonChannelUrl ? String(streamData.jsonChannelUrl).trim() : '',
      jsonTokenUrl: streamData.jsonTokenUrl ? String(streamData.jsonTokenUrl).trim() : '',
      jsonToken: streamData.jsonToken ? String(streamData.jsonToken).trim() : (streamData.token ? String(streamData.token).trim() : ''),
      quality: streamData.quality || 'Auto',
      headers,
      drm: {
        enabled: Boolean(streamData.drm?.enabled),
        scheme: streamData.drm?.scheme || 'clearkey',
        keyId: streamData.drm?.keyId || '',
        key: streamData.drm?.key || streamData.drm?.licenseUrl || '',
        licenseUrl: streamData.drm?.licenseUrl || streamData.drm?.key || ''
      },
      isActive: streamData.isActive !== false
    };

    if (isMongoConnected()) {
      const match = await Match.findById(matchId);
      if (!match) return null;
      match.streams.push(streamObj);
      await match.save();
      return match;
    }

    const match = await this.getMatchById(matchId);
    if (!match) return null;
    match.streams.push(streamObj);
    return match;
  },

  async updateStreamInMatch(matchId, streamId, streamData) {
    if (isMongoConnected()) {
      const match = await Match.findById(matchId);
      if (!match) return null;
      const s = match.streams.id(streamId);
      if (!s) return null;
      Object.assign(s, streamData);
      await match.save();
      return match;
    }
    const match = await this.getMatchById(matchId);
    if (!match) return null;
    const s = match.streams.find(item => item.id === streamId || item._id === streamId);
    if (!s) return null;
    Object.assign(s, streamData);
    return match;
  },

  async deleteStreamFromMatch(matchId, streamId) {
    if (isMongoConnected()) {
      const match = await Match.findById(matchId);
      if (!match) return null;
      match.streams = match.streams.filter(s => s.id !== streamId && String(s._id) !== streamId);
      await match.save();
      return match;
    }
    const match = await this.getMatchById(matchId);
    if (!match) return null;
    match.streams = match.streams.filter(s => s.id !== streamId && String(s._id) !== streamId);
    return match;
  },

  // --- CATEGORIES (LOADED DIRECTLY FROM MONGODB / ADMIN PANEL - NO GOOGLE DRIVE) ---
  async getCategories(forceRefresh = false) {
    if (isMongoConnected()) {
      try {
        const cats = await Category.find({ isActive: true }).sort({ order: 1, createdAt: 1 });
        if (cats && cats.length > 0) {
          return cats.map((c, idx) => ({
            _id: String(c._id),
            id: String(c._id),
            name: (c.name || 'Category').trim(),
            slug: c.slug || c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            icon: c.icon || 'fas fa-tv',
            imageUrl: c.imageUrl || '',
            m3uLink: c.m3uLink || '',
            order: c.order !== undefined ? c.order : (idx + 1),
            isActive: c.isActive !== false
          }));
        }
      } catch (err) {
        console.warn('MongoDB categories query error:', err.message);
      }
    }

    return inMemoryState.categories.filter(c => c.isActive !== false);
  },

  async ensureCategory(name) {
    if (!name) return;
    const cleanName = String(name).trim();
    if (!cleanName || ['Live Cricket', 'Bigg Boss 18', 'Sony LIV', 'Zee5 Shows', 'Star Sports & OTT', 'Live Sports', 'Sports', 'Cricket'].includes(cleanName)) return;
    if (isMongoConnected()) {
      const exists = await Category.findOne({ name: cleanName });
      if (!exists) {
        const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        await Category.create({ name: cleanName, slug, icon: 'fas fa-tv', order: 10, isActive: true });
        this.persistState().catch(() => {});
      }
    } else {
      const exists = inMemoryState.categories.find(c => c.name.toLowerCase() === cleanName.toLowerCase());
      if (!exists) {
        inMemoryState.categories.push({
          _id: 'cat_' + Date.now().toString(36),
          name: cleanName,
          slug: cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          icon: 'fas fa-tv',
          order: inMemoryState.categories.length + 1,
          isActive: true
        });
        this.persistState().catch(() => {});
      }
    }
  },

  async createCategory(data) {
    let result = null;
    if (isMongoConnected()) {
      const cat = new Category(data);
      result = await cat.save();
    } else {
      const newCat = {
        _id: 'cat_' + Date.now().toString(36),
        createdAt: new Date(),
        isActive: true,
        order: inMemoryState.categories.length + 1,
        ...data
      };
      inMemoryState.categories.push(newCat);
      result = newCat;
    }
    this.persistState().catch(() => {});
    return result;
  },

  async updateCategory(id, data) {
    let result = null;
    if (isMongoConnected()) {
      result = await Category.findByIdAndUpdate(id, data, { new: true });
    } else {
      const idx = inMemoryState.categories.findIndex(c => String(c._id) === String(id) || c.id === id);
      if (idx !== -1) {
        inMemoryState.categories[idx] = { ...inMemoryState.categories[idx], ...data, updatedAt: new Date() };
        result = inMemoryState.categories[idx];
      }
    }
    this.persistState().catch(() => {});
    return result;
  },

  async deleteCategory(id) {
    let result = null;
    if (isMongoConnected()) {
      result = await Category.findByIdAndDelete(id);
    } else {
      const idx = inMemoryState.categories.findIndex(c => String(c._id) === String(id));
      if (idx !== -1) {
        result = inMemoryState.categories.splice(idx, 1)[0];
      }
    }
    this.persistState().catch(() => {});
    return result;
  },

  // --- VOD / SHOWS / EPISODES ---
  async getVods(filter = {}) {
    if (isMongoConnected()) {
      return await Vod.find(filter).sort({ isFeatured: -1, createdAt: -1 });
    }
    let list = inMemoryState.vods;
    if (filter.category) {
      list = list.filter(v => v.category === filter.category);
    }
    return list;
  },

  async getVodById(id) {
    if (isMongoConnected()) {
      return await Vod.findById(id);
    }
    return inMemoryState.vods.find(v => String(v._id) === String(id)) || null;
  },

  async createVod(data) {
    if (isMongoConnected()) {
      const vod = new Vod(data);
      return await vod.save();
    }
    const newVod = {
      _id: 'vod_' + Date.now().toString(36),
      createdAt: new Date(),
      updatedAt: new Date(),
      episodes: [],
      ...data
    };
    inMemoryState.vods.unshift(newVod);
    return newVod;
  },

  async updateVod(id, data) {
    if (isMongoConnected()) {
      return await Vod.findByIdAndUpdate(id, data, { new: true });
    }
    const idx = inMemoryState.vods.findIndex(v => String(v._id) === String(id));
    if (idx === -1) return null;
    inMemoryState.vods[idx] = { ...inMemoryState.vods[idx], ...data, updatedAt: new Date() };
    return inMemoryState.vods[idx];
  },

  async deleteVod(id) {
    if (isMongoConnected()) {
      return await Vod.findByIdAndDelete(id);
    }
    const idx = inMemoryState.vods.findIndex(v => String(v._id) === String(id));
    if (idx === -1) return null;
    return inMemoryState.vods.splice(idx, 1)[0];
  },

  async addEpisodeToVod(vodId, episodeData) {
    const epObj = {
      id: 'ep_' + Math.random().toString(36).substr(2, 9),
      episodeNumber: Number(episodeData.episodeNumber) || 1,
      title: episodeData.title || 'New Episode',
      duration: episodeData.duration || '45m',
      thumbnail: episodeData.thumbnail || '',
      streamType: episodeData.streamType || 'M3U8',
      streamUrl: episodeData.streamUrl,
      headers: {
        userAgent: episodeData.headers?.userAgent || '',
        referer: episodeData.headers?.referer || ''
      },
      drm: {
        enabled: Boolean(episodeData.drm?.enabled),
        scheme: episodeData.drm?.scheme || 'clearkey',
        keyId: episodeData.drm?.keyId || '',
        key: episodeData.drm?.key || ''
      },
      isActive: true
    };

    if (isMongoConnected()) {
      const vod = await Vod.findById(vodId);
      if (!vod) return null;
      vod.episodes.push(epObj);
      await vod.save();
      return vod;
    }

    const vod = await this.getVodById(vodId);
    if (!vod) return null;
    vod.episodes.push(epObj);
    return vod;
  },

  async deleteEpisodeFromVod(vodId, episodeId) {
    if (isMongoConnected()) {
      const vod = await Vod.findById(vodId);
      if (!vod) return null;
      vod.episodes = vod.episodes.filter(ep => ep.id !== episodeId && String(ep._id) !== episodeId);
      await vod.save();
      return vod;
    }
    const vod = await this.getVodById(vodId);
    if (!vod) return null;
    vod.episodes = vod.episodes.filter(ep => ep.id !== episodeId && String(ep._id) !== episodeId);
    return vod;
  },

  // --- SETTINGS ---
  async getSettings() {
    const defaultApkUrl = 'https://stream-admin-backend.vercel.app/HD-STREAM.apk';
    if (isMongoConnected()) {
      let settings = await Settings.findOne();
      if (!settings) {
        settings = await Settings.create({
          ...inMemoryState.settings,
          appVersion: '3.0.6',
          minVersion: '3.0.6',
          apkDownloadUrl: defaultApkUrl
        });
      }
      if (!settings.apkDownloadUrl || settings.apkDownloadUrl.includes('example.com') || settings.apkDownloadUrl.includes('10.129') || settings.apkDownloadUrl.endsWith('.app')) {
        settings.apkDownloadUrl = defaultApkUrl;
      }
      settings.appVersion = '3.0.6';
      settings.minVersion = '3.0.6';
      await settings.save();
      return settings;
    }
    inMemoryState.settings.apkDownloadUrl = defaultApkUrl;
    inMemoryState.settings.appVersion = '3.0.6';
    inMemoryState.settings.minVersion = '3.0.6';
    return inMemoryState.settings;
  },

  async updateSettings(data) {
    if (isMongoConnected()) {
      let settings = await Settings.findOne();
      if (!settings) {
        return await Settings.create(data);
      }
      Object.assign(settings, data);
      settings.updatedAt = new Date();
      return await settings.save();
    }
    inMemoryState.settings = { ...inMemoryState.settings, ...data, updatedAt: new Date() };
    return inMemoryState.settings;
  },

  // --- PERSISTENT ADMIN CREDENTIALS (IN DB & MEMORY) ---
  async getAdminCredentials() {
    const defaultUsername = process.env.ADMIN_USER || 'shaikhabutlha506@gmail.com';
    const defaultPassword = process.env.ADMIN_API_KEY || 'Junaidsrk555';

    if (isMongoConnected()) {
      try {
        let settings = await Settings.findOne();
        if (settings && settings.adminPassword && settings.adminPassword.trim().length > 0) {
          return {
            username: settings.adminUsername || defaultUsername,
            password: settings.adminPassword.trim()
          };
        }
      } catch (err) {
        console.error('Error fetching admin credentials from DB:', err.message);
      }
    }

    if (inMemoryState.settings && inMemoryState.settings.adminPassword && inMemoryState.settings.adminPassword.trim().length > 0) {
      return {
        username: inMemoryState.settings.adminUsername || defaultUsername,
        password: inMemoryState.settings.adminPassword.trim()
      };
    }

    return {
      username: defaultUsername,
      password: defaultPassword
    };
  },

  async updateAdminCredentials(newUsername, newPassword) {
    const cleanUser = (newUsername || 'admin').trim();
    const cleanPass = (newPassword || '').trim();

    if (isMongoConnected()) {
      try {
        let settings = await Settings.findOne();
        if (!settings) {
          settings = await Settings.create({
            ...inMemoryState.settings,
            adminUsername: cleanUser,
            adminPassword: cleanPass
          });
        } else {
          settings.adminUsername = cleanUser;
          settings.adminPassword = cleanPass;
          settings.updatedAt = new Date();
          await settings.save();
        }
      } catch (err) {
        console.error('Error saving admin credentials to DB:', err.message);
      }
    }

    inMemoryState.settings.adminUsername = cleanUser;
    inMemoryState.settings.adminPassword = cleanPass;
    inMemoryState.settings.updatedAt = new Date();

    return {
      username: cleanUser,
      password: cleanPass
    };
  },

  // --- DEVICE & APP USAGE ANALYTICS ---
  async trackDevice(ip, userAgent) {
    if (!ip && !userAgent) return;
    const cleanIp = (ip || '').split(',')[0].trim().replace(/^.*:/, '');
    const cleanUa = (userAgent || '').substring(0, 200);
    const deviceId = getDeviceId(cleanIp, cleanUa);
    const now = new Date();

    // In-memory track
    const existing = inMemoryDevices.get(deviceId);
    if (!existing) {
      inMemoryDevices.set(deviceId, {
        deviceId,
        ip: cleanIp,
        userAgent: cleanUa,
        firstSeen: now,
        lastSeen: now,
        requestsCount: 1
      });
    } else {
      existing.lastSeen = now;
      existing.requestsCount = (existing.requestsCount || 1) + 1;
    }

    // Persist to MongoDB if connected
    if (isMongoConnected()) {
      try {
        await Device.findOneAndUpdate(
          { deviceId },
          {
            $set: {
              ip: cleanIp,
              userAgent: cleanUa,
              lastSeen: now
            },
            $setOnInsert: { firstSeen: now },
            $inc: { requestsCount: 1 }
          },
          { upsert: true, new: true }
        );
      } catch (err) {
        // non-blocking
      }
    }
  },

  async trackApkDownload() {
    inMemoryApkDownloads++;
    if (isMongoConnected()) {
      try {
        await AnalyticsSummary.findOneAndUpdate(
          { key: 'global' },
          { $inc: { totalApkDownloads: 1 }, $set: { updatedAt: new Date() } },
          { upsert: true }
        );
      } catch (err) {
        // non-blocking
      }
    }
  },

  async getAnalytics() {
    const now = Date.now();
    const fifteenMinsAgo = new Date(now - 15 * 60 * 1000);
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);

    let activeNow = 0;
    let dau = 0;
    let totalDevices = 0;
    let apkDownloads = 0;

    if (isMongoConnected()) {
      try {
        const [
          dbActiveNow,
          dbDau,
          dbTotal,
          summary
        ] = await Promise.all([
          Device.countDocuments({ lastSeen: { $gte: fifteenMinsAgo } }),
          Device.countDocuments({ lastSeen: { $gte: oneDayAgo } }),
          Device.countDocuments(),
          AnalyticsSummary.findOne({ key: 'global' })
        ]);

        activeNow = dbActiveNow;
        dau = dbDau;
        totalDevices = dbTotal;
        if (summary?.totalApkDownloads) {
          apkDownloads = summary.totalApkDownloads;
        }
      } catch (err) {
        // Fallback to in-memory
      }
    }

    // Merge in-memory active devices
    for (const [id, dev] of inMemoryDevices.entries()) {
      const last = new Date(dev.lastSeen).getTime();
      if (last >= now - 15 * 60 * 1000) activeNow = Math.max(activeNow, 1);
      if (last >= now - 24 * 60 * 60 * 1000) dau = Math.max(dau, 1);
    }
    totalDevices = Math.max(totalDevices, inMemoryDevices.size);

    activeNow = Math.max(activeNow, 0);
    dau = Math.max(dau, activeNow);

    // Total Installs: Real unique devices registered (or apk downloads if higher)
    const totalInstalls = Math.max(totalDevices, apkDownloads);

    // Uninstalled / Inactive devices: Devices that have closed the app or are offline
    const uninstalled = Math.max(0, totalInstalls - activeNow);

    // Retention Rate: DAU / Total Installs
    const retentionRate = totalInstalls > 0 ? Math.min(100, Math.round((dau / totalInstalls) * 100)) : 100;

    return {
      totalInstalls,
      apkDownloads,
      activeNow,
      dau,
      uninstalled,
      retentionRate: `${retentionRate}%`
    };
  },

  async getDevicesList(limit = 100) {
    const now = Date.now();
    const fifteenMinsAgo = new Date(now - 15 * 60 * 1000);

    if (isMongoConnected()) {
      try {
        const devices = await Device.find()
          .sort({ lastSeen: -1 })
          .limit(limit)
          .lean();

        return devices.map(d => ({
          deviceId: d.deviceId,
          ip: d.ip,
          userAgent: d.userAgent,
          deviceModel: parseDeviceModel(d.userAgent),
          isOnline: new Date(d.lastSeen) >= fifteenMinsAgo,
          firstSeen: d.firstSeen,
          lastSeen: d.lastSeen,
          requestsCount: d.requestsCount || 1
        }));
      } catch (err) {
        // Fallback to in-memory
      }
    }

    return Array.from(inMemoryDevices.values()).map(d => ({
      deviceId: d.deviceId,
      ip: d.ip,
      userAgent: d.userAgent,
      deviceModel: parseDeviceModel(d.userAgent),
      isOnline: new Date(d.lastSeen) >= fifteenMinsAgo,
      firstSeen: d.firstSeen,
      lastSeen: d.lastSeen,
      requestsCount: d.requestsCount || 1
    }));
  },

  // --- SYSTEM STATS SUMMARY ---
  async getStats() {
    const matches = await this.getMatches();
    const categories = await this.getCategories();
    const vods = await this.getVods();
    const analytics = await this.getAnalytics();

    const liveCount = matches.filter(m => m.status === 'LIVE').length;
    const upcomingCount = matches.filter(m => m.status === 'UPCOMING').length;
    const totalStreams = matches.reduce((acc, m) => acc + (m.streams?.length || 0), 0);
    const totalEpisodes = vods.reduce((acc, v) => acc + (v.episodes?.length || 0), 0);
    const drmStreamsCount = matches.reduce((acc, m) => {
      return acc + (m.streams?.filter(s => s.drm?.enabled)?.length || 0);
    }, 0);

    return {
      liveEvents: liveCount,
      upcomingEvents: upcomingCount,
      totalMatches: matches.length,
      categoriesCount: categories.length,
      vodShowsCount: vods.length,
      totalEpisodes,
      totalStreams,
      drmStreamsCount,
      databaseMode: isMongoConnected() ? 'MongoDB Atlas (Cloud)' : 'Local / In-Memory (Active)',
      analytics,
      totalInstalls: analytics.totalInstalls,
      activeNow: analytics.activeNow,
      dau: analytics.dau,
      uninstalled: analytics.uninstalled,
      retentionRate: analytics.retentionRate
    };
  },

  // --- PERSIST STATE TO LOCAL DISK (data/live_matches.json & data/categories.json) ---
  async persistState() {
    try {
      const matches = await this.getMatches();
      const categories = await this.getCategories();

      const liveMatchesPath = path.join(__dirname, '../data/live_matches.json');
      const categoriesPath = path.join(__dirname, '../data/categories.json');

      const live = matches.filter(m => (m.status || 'LIVE').toUpperCase() === 'LIVE');
      const upcoming = matches.filter(m => (m.status || '').toUpperCase() === 'UPCOMING');

      const liveMatchesData = {
        announcement: "",
        announcementEnabled: false,
        announcement_enabled: false,
        minVersion: "1.0.0",
        min_version: "1.0.0",
        appVersion: "3.4.10",
        app_version: "3.4.10",
        liveMatches: live,
        upcomingMatches: upcoming
      };

      fs.writeFileSync(liveMatchesPath, JSON.stringify(liveMatchesData, null, 2), 'utf8');

      const cleanCategories = categories.map((c, idx) => ({
        id: c.id || c._id || `cat_${idx + 1}`,
        name: c.name,
        slug: c.slug || c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        icon: c.icon || 'fas fa-tv',
        imageUrl: c.imageUrl || '',
        m3uLink: c.m3uLink || '',
        portal_url: c.portal_url || '',
        mac: c.mac || ''
      }));

      fs.writeFileSync(categoriesPath, JSON.stringify(cleanCategories, null, 2), 'utf8');
      console.log(`[Store] Successfully persisted ${matches.length} matches & ${cleanCategories.length} categories to disk.`);
    } catch (err) {
      // Safe fallback on read-only serverless filesystems
      console.warn('[Store] Notice: persistState error:', err.message);
    }
  },

  // --- SYNC / REFRESH CHANNELS & CATEGORIES (DIRECT FROM MONGODB & ADMIN PANEL) ---
  async syncGdrive() {
    const cats = await this.getCategories(true);
    const totalMatches = isMongoConnected() ? await Match.countDocuments() : inMemoryState.matches.length;
    return {
      success: true,
      totalChannels: totalMatches,
      categoriesCount: cats.length,
      channels: []
    };
  }
};

module.exports = Store;
