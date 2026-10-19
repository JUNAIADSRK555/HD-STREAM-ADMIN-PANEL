const mongoose = require('mongoose');
const Match = require('../models/Match');
const Category = require('../models/Category');
const Vod = require('../models/Vod');
const Settings = require('../models/Settings');

// Initial seed data for immediate out-of-the-box demo
const initialCategories = [
  { _id: 'cat_cricket', name: 'Live Cricket', slug: 'live-cricket', icon: 'fas fa-baseball-ball', order: 1, isActive: true },
  { _id: 'cat_biggboss', name: 'Bigg Boss 18', slug: 'bigg-boss', icon: 'fas fa-tv', order: 2, isActive: true },
  { _id: 'cat_sonyliv', name: 'Sony LIV', slug: 'sony-liv', icon: 'fas fa-play-circle', order: 3, isActive: true },
  { _id: 'cat_zee5', name: 'Zee5 Shows', slug: 'zee5', icon: 'fas fa-film', order: 4, isActive: true },
  { _id: 'cat_sports', name: 'Star Sports & OTT', slug: 'star-sports', icon: 'fas fa-satellite-dish', order: 5, isActive: true }
];

const initialMatches = [
  {
    _id: 'match_001',
    title: 'India vs Pakistan — ICC Champions Trophy 2026',
    category: 'Live Cricket',
    status: 'LIVE',
    matchFormat: 'ODI',
    startTime: new Date().toISOString(),
    bannerUrl: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=1200&q=80',
    description: 'High voltage super clash live from Dubai International Stadium.',
    isPinned: true,
    team1: { name: 'India', shortName: 'IND', flag: '🇮🇳', score: '' },
    team2: { name: 'Pakistan', shortName: 'PAK', flag: '🇵🇰', score: '' },
    streams: [
      {
        id: 'str_icc_01',
        title: 'ICC TV — 1080p 60FPS (Hindi Audio)',
        streamType: 'M3U8',
        streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        quality: '1080p HD',
        headers: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) JDCRIC-LIVE/1.5',
          referer: 'https://icctv.official.stream/'
        },
        drm: {
          enabled: false,
          scheme: 'clearkey',
          keyId: '',
          key: ''
        },
        isActive: true
      },
      {
        id: 'str_sk_02',
        title: 'SK Live — Low Latency (English Feed)',
        streamType: 'M3U8',
        streamUrl: 'https://cph-p2p-msl.akamaized.net/hls/live/200034/test/master.m3u8',
        quality: '720p',
        headers: {
          userAgent: 'ExoPlayer-Media3/1.4.0',
          referer: ''
        },
        drm: {
          enabled: false,
          scheme: 'clearkey',
          keyId: '',
          key: ''
        },
        isActive: true
      },
      {
        id: 'str_drm_03',
        title: 'Star Sports HD — DRM ClearKey Protected (MPD)',
        streamType: 'MPD',
        streamUrl: 'https://dash.akamaized.net/dash264/TestCases/1c/qualcomm/1/MultiRate.mpd',
        quality: '4K Multi-Audio',
        headers: {
          userAgent: 'JDCricOTT/2.0',
          referer: 'https://hotstar.live.stream/'
        },
        drm: {
          enabled: true,
          scheme: 'clearkey',
          keyId: 'eb63836f296d4532a4eb52f6d831e674', // Demo ClearKey Key 1 (KID)
          key: 'a68eed132d1a4e1792617f69208fc440'     // Demo ClearKey Key 2 (Key)
        },
        isActive: true
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'match_002',
    title: 'Australia vs England — The Ashes Day 3',
    category: 'Live Cricket',
    status: 'UPCOMING',
    matchFormat: 'Test',
    startTime: new Date(Date.now() + 3600000 * 3).toISOString(),
    bannerUrl: 'https://images.unsplash.com/photo-1531415074868-036b107e775a?auto=format&fit=crop&w=1200&q=80',
    description: 'The historic Ashes battle continues under sunny skies at Lord’s.',
    isPinned: false,
    team1: { name: 'Australia', shortName: 'AUS', flag: '🇦🇺', score: '' },
    team2: { name: 'England', shortName: 'ENG', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', score: '' },
    streams: [
      {
        id: 'str_aus_01',
        title: 'Sky Sports Cricket HD',
        streamType: 'M3U8',
        streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        quality: '1080p',
        headers: { userAgent: '', referer: '' },
        drm: { enabled: false, scheme: 'clearkey', keyId: '', key: '' },
        isActive: true
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

const initialVods = [
  {
    _id: 'vod_001',
    title: 'Bigg Boss 18: Grand Opening & Weekend Ka Vaar',
    category: 'Bigg Boss 18',
    posterUrl: 'https://images.unsplash.com/photo-1578022761797-b8636ac1773c?auto=format&fit=crop&w=600&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?auto=format&fit=crop&w=1200&q=80',
    description: 'High drama, intense confrontations, and unfiltered reality entertainment with host Salman Khan.',
    rating: '8.8',
    releaseYear: '2026',
    isFeatured: true,
    episodes: [
      {
        id: 'ep_01',
        episodeNumber: 1,
        title: 'Episode 1: The Mega Launch & Contestants Reveal',
        duration: '1h 22m',
        thumbnail: 'https://images.unsplash.com/photo-1518173946687-a4c8a383392e?auto=format&fit=crop&w=600&q=80',
        streamType: 'M3U8',
        streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        headers: { userAgent: '', referer: '' },
        drm: { enabled: false, scheme: 'clearkey', keyId: '', key: '' },
        isActive: true
      },
      {
        id: 'ep_02',
        episodeNumber: 2,
        title: 'Episode 2: First Nominations & House Clash',
        duration: '52m',
        thumbnail: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=600&q=80',
        streamType: 'M3U8',
        streamUrl: 'https://cph-p2p-msl.akamaized.net/hls/live/200034/test/master.m3u8',
        headers: { userAgent: '', referer: '' },
        drm: { enabled: false, scheme: 'clearkey', keyId: '', key: '' },
        isActive: true
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'vod_002',
    title: 'Scam 2026: The Cyber Heist (Sony LIV Original)',
    category: 'Sony LIV',
    posterUrl: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=600&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80',
    description: 'A gripping investigative financial thriller based on true confidential cyber scandals.',
    rating: '9.2',
    releaseYear: '2026',
    isFeatured: true,
    episodes: [
      {
        id: 'ep_scam_01',
        episodeNumber: 1,
        title: 'Episode 1: The Dark Tunnel Protocol',
        duration: '48m',
        thumbnail: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=600&q=80',
        streamType: 'M3U8',
        streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        headers: { userAgent: '', referer: '' },
        drm: { enabled: false, scheme: 'clearkey', keyId: '', key: '' },
        isActive: true
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

let inMemoryState = {
  categories: [...initialCategories],
  matches: [...initialMatches],
  vods: [...initialVods],
  settings: {
    appName: 'JDCRIC & Entertainment Live',
    announcement: 'Welcome to Live Streaming HD! Enjoy high quality cricket & entertainment.',
    announcementEnabled: true,
    appVersion: '1.5.0',
    minVersion: '1.0.0',
    apkDownloadUrl: 'https://example.com/download/jdcric-live-v1.5.apk',
    maintenanceMode: false,
    telegramLink: 'https://t.me/jdcric_official',
    supportEmail: 'support@jdcric.live',
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
      return await Match.find(filter).sort({ isPinned: -1, createdAt: -1 });
    }
    let list = inMemoryState.matches;
    if (filter.status) {
      list = list.filter(m => m.status === filter.status);
    }
    if (filter.category) {
      list = list.filter(m => m.category === filter.category);
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
    if (isMongoConnected()) {
      const match = new Match(data);
      return await match.save();
    }
    const newMatch = {
      _id: 'match_' + Date.now().toString(36),
      createdAt: new Date(),
      updatedAt: new Date(),
      streams: [],
      ...data
    };
    inMemoryState.matches.unshift(newMatch);
    return newMatch;
  },

  async updateMatch(id, data) {
    if (isMongoConnected()) {
      return await Match.findByIdAndUpdate(id, data, { new: true });
    }
    const idx = inMemoryState.matches.findIndex(m => String(m._id) === String(id));
    if (idx === -1) return null;
    inMemoryState.matches[idx] = {
      ...inMemoryState.matches[idx],
      ...data,
      updatedAt: new Date()
    };
    return inMemoryState.matches[idx];
  },

  async deleteMatch(id) {
    if (isMongoConnected()) {
      return await Match.findByIdAndDelete(id);
    }
    const idx = inMemoryState.matches.findIndex(m => String(m._id) === String(id));
    if (idx === -1) return null;
    const deleted = inMemoryState.matches.splice(idx, 1);
    return deleted[0];
  },

  // --- STREAMS INSIDE A MATCH ---
  async addStreamToMatch(matchId, streamData) {
    let cleanUrl = streamData.streamUrl ? String(streamData.streamUrl).trim() : '';
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
        key: streamData.drm?.key || ''
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

  // --- CATEGORIES ---
  async getCategories() {
    if (isMongoConnected()) {
      return await Category.find({ isActive: true }).sort({ order: 1 });
    }
    return inMemoryState.categories.filter(c => c.isActive !== false);
  },

  async createCategory(data) {
    if (isMongoConnected()) {
      const cat = new Category(data);
      return await cat.save();
    }
    const newCat = {
      _id: 'cat_' + Date.now().toString(36),
      createdAt: new Date(),
      isActive: true,
      order: inMemoryState.categories.length + 1,
      ...data
    };
    inMemoryState.categories.push(newCat);
    return newCat;
  },

  async deleteCategory(id) {
    if (isMongoConnected()) {
      return await Category.findByIdAndDelete(id);
    }
    const idx = inMemoryState.categories.findIndex(c => String(c._id) === String(id));
    if (idx === -1) return null;
    return inMemoryState.categories.splice(idx, 1)[0];
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
    if (isMongoConnected()) {
      let settings = await Settings.findOne();
      if (!settings) {
        settings = await Settings.create(inMemoryState.settings);
      }
      return settings;
    }
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

  // --- SYSTEM STATS SUMMARY ---
  async getStats() {
    const matches = await this.getMatches();
    const categories = await this.getCategories();
    const vods = await this.getVods();

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
      databaseMode: isMongoConnected() ? 'MongoDB Atlas (Cloud)' : 'Local / In-Memory (Active)'
    };
  }
};

module.exports = Store;
