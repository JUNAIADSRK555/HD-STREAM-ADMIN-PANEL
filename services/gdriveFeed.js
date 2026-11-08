const CATEGORY_DRIVE_URL = 'https://drive.google.com/uc?export=download&id=1KxcfPpIjkeRaHWyrN53otPBci5s6FMMO';
const LIVE_EVENTS_DRIVE_URL = 'https://drive.google.com/uc?export=download&id=1f2YiLF71pHEPlmodEtLQ-NfT3opWRreu';
const SPORTS_DATA_URL = 'https://raw.githubusercontent.com/sm-monirulislam/Upcoming-and-Live-Sports-Data/main/Sports_data.json';

// Strict Cricket Filter Function
function isCricketMatch(m) {
  if (!m) return false;
  const cat = String(m.Category || m.sport || m.category || '').trim().toLowerCase();
  const title = String(m.event_name || m.eventName || m.title || '').trim().toLowerCase();
  const league = String(m.league || (m.eventInfo && m.eventInfo.eventName) || '').trim().toLowerCase();
  const fullText = `${cat} ${title} ${league}`;

  if (cat === 'cricket') return true;

  const cricketKeywords = [
    'cricket', 't20', 'odi', 'test match', 'test series', 'ipl',
    'bbl', 'psl', 'cpl', 'lpl', 'npl', 'bpl', 'abu dhabi',
    'world test championship', 'u19', 'big bash', 'ranji',
    'bcci', 'icc', 'stump', 'wicket', 'overs', 'bangladesh',
    'west indies', 'pakistan', 'sri lanka', 'zimbabwe', 'afghanistan'
  ];

  for (const keyword of cricketKeywords) {
    if (fullText.includes(keyword)) {
      return true;
    }
  }
  return false;
}

// Format matches from Sports_data.json (for Football, American Football, Basketball, etc.)
function formatSportsDataMatch(m, index = 0) {
  const title = (m.event_name || (m.eventInfo && `${m.eventInfo.teamA} vs ${m.eventInfo.teamB}`) || `Sports Match ${index + 1}`).trim();
  const status = (m.status || 'LIVE').toUpperCase();
  const category = (m.Category || 'Football').trim();
  const info = m.eventInfo || {};
  const tournament = (info.eventName || category || 'Live Sports').trim();

  const team1Name = (info.teamA || title.split(/\s+vs\s+/i)[0] || 'Team 1').trim();
  const team2Name = (info.teamB || title.split(/\s+vs\s+/i)[1] || 'Team 2').trim();

  const streams = (m.streams || []).map((s, sIdx) => {
    let url = (s.stream_url || s.streamUrl || s.url || '').trim();
    if (!url || !url.startsWith('http')) return null;

    const isMpd = url.includes('.mpd');
    const streamType = isMpd ? 'MPD' : 'M3U8';
    const referer = (s.referer || s.referrer || '').trim();

    return {
      id: `sports_str_${index}_${sIdx}`,
      title: s.channel_name || `Server ${sIdx + 1} HD`,
      streamType,
      streamUrl: url,
      quality: '1080p HD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
        'Referer': referer,
        'Origin': referer ? new URL(referer).origin : ''
      },
      drm: { enabled: false }
    };
  }).filter(Boolean);

  if (streams.length === 0) return null;

  return {
    id: `sports_${index}_${Buffer.from(title).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}`,
    title,
    category,
    status,
    format: tournament,
    startTime: info.startTime || 'LIVE NOW',
    bannerUrl: info.event_logo || info.teamAFlag || '',
    description: `${tournament}: ${title}`,
    isPinned: status === 'LIVE',
    team1: {
      name: team1Name,
      shortName: team1Name.slice(0, 4).toUpperCase().trim(),
      flag: info.teamAFlag || '⚽',
      logo: info.teamAFlag || '',
      score: ''
    },
    team2: {
      name: team2Name,
      shortName: team2Name.slice(0, 4).toUpperCase().trim(),
      flag: info.teamBFlag || '🔴',
      logo: info.teamBFlag || '',
      score: ''
    },
    totalStreams: streams.length,
    streams
  };
}

// In-memory cache to prevent Google Drive rate-limits & provide sub-millisecond response times
let cachedCategories = null;
let lastCategoriesFetch = 0;

let cachedEvents = null;
let lastEventsFetch = 0;

const CACHE_TTL_MS = 60 * 1000; // 60 seconds

// Safe hex-to-base64url for W3C clearkey if needed
function hexToBase64Url(hexStr) {
  if (!hexStr) return '';
  const cleanHex = hexStr.replace(/[^0-9a-fA-F]/g, '');
  const buffer = Buffer.from(cleanHex, 'hex');
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Fetch and parse categories from Google Drive
 */
async function getDriveCategories(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedCategories && (now - lastCategoriesFetch < CACHE_TTL_MS)) {
    return cachedCategories;
  }

  try {
    const res = await fetch(CATEGORY_DRIVE_URL, {
      redirect: 'follow',
      headers: { 'User-Agent': 'HDStream-Backend/3.2.0' }
    });

    if (!res.ok) {
      throw new Error(`Google Drive returned HTTP ${res.status}`);
    }

    const rawList = await res.json();
    if (!Array.isArray(rawList)) {
      throw new Error('Categories response is not an array');
    }

    const formatted = rawList
      .filter(c => {
        const title = (c.title || c.name || '').trim();
        const slug = (c.slug || '').trim();
        const combined = `${title} ${slug}`.toLowerCase();
        return !/adult|18\+|porn|erotic|nsfw|xxx|brazzers|playboy|sensual/i.test(combined);
      })
      .map((c, idx) => {
        const title = (c.title || c.name || `Channel ${idx + 1}`).trim();
        const slug = (c.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-')).replace(/^-+|-+$/g, '');
        const cleanM3u = (c.m3uLink || c.url || '').trim().replace(/^:\s*/, '');
        const img = (c.imageUrl || c.image || c.logo || '').trim();
        return {
          id: c.id || `gcat_${idx + 1}`,
          name: title,
          slug: slug || `cat-${idx + 1}`,
          icon: c.icon || (img ? img : 'fas fa-tv'),
          imageUrl: img,
          m3uLink: cleanM3u,
          portal_url: (c.portal_url || '').trim(),
          mac: (c.mac || '').trim(),
          sn: (c.sn || '').trim(),
          device_id_1: (c.device_id_1 || '').trim(),
          device_id_2: (c.device_id_2 || '').trim()
        };
      });

    cachedCategories = formatted;
    lastCategoriesFetch = now;
    return formatted;
  } catch (error) {
    console.error('Error fetching Google Drive categories:', error.message);
    if (cachedCategories) {
      return cachedCategories; // Return stale cache on network failure
    }
    // Hardcoded fallback list if first boot without internet
    return [
      {
        id: "gcat_1",
        name: "JIO TV+",
        slug: "jio-tv",
        icon: "fas fa-tv",
        imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRKIIUwitJWzKomNurXMsbwVwSjDt3LgjOgWg&s",
        m3uLink: "https://plugxvipplaylist.lovable.app/api/playlist"
      },
      {
        id: "gcat_2",
        name: "HD STREAM",
        slug: "hd-stream",
        icon: "fas fa-tv",
        imageUrl: "https://encryptedic.com/imagNd9GcRKIIUwitJWzKomNurXMsbwVwSjDt3LgjOgWg&s",
        m3uLink: "https://allinonereborn2.online/jiotv-m3u/jtv25.m3u8"
      },
      {
        id: "gcat_3",
        name: "MIX TV",
        slug: "mix-tv",
        icon: "fas fa-tv",
        imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQCm7hdWxlS5fbZ3Do-pqzytQVayxUNHFl5oD5E4TWtQfCnRw2pM2UOa8I&s=10",
        m3uLink: "https://streamflexsmm.in/SFlex-StarShare/playlist.php"
      },
      {
        id: "gcat_4",
        name: "VZY",
        slug: "vzy",
        icon: "fas fa-tv",
        imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQIYAVnSjMhpKILSGSOyqeLnackwGjeolKPRVv4Yh0UW8RJI-hYBKQbO319&s=10",
        m3uLink: "https://pastyx.pages.dev/api/paste/vzy-playlist-m3u/raw"
      },
      {
        id: "gcat_5",
        name: "PAKISTAN TV",
        slug: "pakistan-tv",
        icon: "fas fa-tv",
        imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRBLV9kgm97df5xLeoC-7i8uhp65boAZKw3__9QNW9WGYA0HHk7hS2MBvDa&s=10",
        m3uLink: "https://iptv-org.github.io/iptv/countries/pk.m3u"
      },
      {
        id: "gcat_6",
        name: "TOFFEE",
        slug: "toffee",
        icon: "fas fa-tv",
        imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRLjYG2Yb4mLqygUe_GDkKu5Rw73jqEQmxeXddimkUpE2NrKsvXfaMf-LMQ&s=10",
        m3uLink: "https://iptv-org.github.io/iptv/languages/hin.m3u"
      },
      {
        id: "gcat_7",
        name: "IRAN TV",
        slug: "iran-tv",
        icon: "fas fa-tv",
        imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRdoOQ3JwH-PctWnHvCiXlG-Og7Vmav3MQANQ&s",
        m3uLink: "https://iptv-org.github.io/iptv/countries/ir.m3u"
      },
      {
        id: "gcat_8",
        name: "Afghanistan TV",
        slug: "afghanistan-tv",
        icon: "fas fa-tv",
        imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT-i-alUhNqSc08Q7HHJO2i7fCxKxZKBJCXfKf7QymkpmqVhEK4G75wQgs&s=10",
        m3uLink: "https://iptv-org.github.io/iptv/countries/af.m3u"
      },
      {
        id: "gcat_9",
        name: "CARTOON MOVIE",
        slug: "cartoon-movie",
        icon: "fas fa-film",
        imageUrl: "https://logos-world.net/wp-content/uploads/2022/06/CMovies-Symbol.png",
        m3uLink: "https://drive.google.com/uc?export=download&id=1UZ1M-R5Lx58Hi7qkbi5Ylnf8UirfRFPH"
      },
      {
        id: "gcat_10",
        name: "MX PLAYER",
        slug: "mx-player",
        icon: "fas fa-play",
        imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT1NMH254M3gNL2gmhzuwqdRswejy1avQaUvDjHlgGhRA&s=10",
        m3uLink: "https://playlist-by-xfireflix.pages.dev/India/mxplayer"
      },
      {
        id: "gcat_11",
        name: "YUPPY TV",
        slug: "yuppy-tv",
        icon: "fas fa-tv",
        imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSU9aEfg_OS21ZixLmLgbdJvnf90iTZ4zwVtg&s",
        m3uLink: "https://raw.githubusercontent.com/abusaeeidx/Yupptv-Playlist/refs/heads/main/playlist.m3u"
      },
      {
        id: "gcat_12",
        name: "STALKER PORTAL LIVE",
        slug: "stalker-portal",
        icon: "fas fa-server",
        imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTJ62IwtiCZ9E8fqeu8hDPhvjHqNrols3GnUddW3VszWA&s=10",
        portal_url: "http://134.119.176.239/stalker_portal/c/",
        mac: "00:1A:79:78:EE:AD"
      }
    ];
  }
}

/**
 * Format a single match from Google Drive format to Android LiveStreamEvent
 */
function formatDriveMatch(m, defaultStatus = 'LIVE', index = 0) {
  const status = (m.status || defaultStatus || 'LIVE').toUpperCase();
  const title = (m.match_name || m.title || `Live Match ${index + 1}`).trim();

  // Extract teams
  let team1Name = 'Team 1';
  let team2Name = 'Team 2';

  if (m.team1 && m.team1.name) {
    team1Name = m.team1.name;
  } else if (/ vs /i.test(title)) {
    const parts = title.split(/\s+vs\s+/i);
    team1Name = parts[0]?.trim() || 'Team 1';
    team2Name = parts[1]?.trim() || 'Team 2';
  } else if (/ - /.test(title)) {
    const parts = title.split(/\s+-\s+/);
    team1Name = parts[0]?.trim() || 'Team 1';
    team2Name = parts[1]?.trim() || 'Team 2';
  } else {
    team1Name = title;
  }

  if (m.team2 && m.team2.name) {
    team2Name = m.team2.name;
  }

  // Parse streams
  const streams = (m.streams || []).map((s, sIdx) => {
    let url = (s.url || s.streamUrl || '').trim();
    if (!url || !url.startsWith('http')) {
      return null;
    }

    const isMpd = (s.type || '').toLowerCase() === 'mpd' || url.includes('.mpd');
    const isHls = (s.type || '').toLowerCase() === 'hls' || url.includes('.m3u8');
    const streamType = s.streamType || (isMpd ? 'MPD' : isHls ? 'M3U8' : 'DIRECT');

    let drm = s.drm || {};
    if (!drm.keyId && url.includes('drmLicense=')) {
      const match = url.match(/drmLicense=([0-9a-fA-F]{32}):([0-9a-fA-F]{32})/);
      if (match) {
        drm = {
          enabled: true,
          scheme: 'clearkey',
          keyId: match[1],
          key: match[2]
        };
      }
    } else if (s.keys && Array.isArray(s.keys) && s.keys.length > 0) {
      const k = s.keys[0];
      drm = {
        enabled: true,
        scheme: s.drm_scheme || s.drmScheme || 'clearkey',
        keyId: k.key_id || k.keyId,
        key: k.key
      };
    }

    let clearKeyLicense = null;
    if (drm?.enabled && drm.scheme === 'clearkey' && drm.keyId && drm.key) {
      clearKeyLicense = {
        keyIdHex: drm.keyId,
        keyHex: drm.key,
        w3cFormat: {
          keys: [
            {
              kty: 'oct',
              kid: hexToBase64Url(drm.keyId),
              k: hexToBase64Url(drm.key)
            }
          ]
        }
      };
    }

    return {
      id: s.id || `stream_${index}_${sIdx}`,
      title: s.title || `Server ${sIdx + 1} HD`,
      streamType,
      streamUrl: url,
      quality: s.quality || '1080p HD',
      headers: {
        'User-Agent': s.headers?.['User-Agent'] || s.headers?.userAgent || 'ExoPlayer-Media3/1.4.0',
        'Referer': s.headers?.['Referer'] || s.headers?.referer || '',
        'Origin': s.headers?.['Origin'] || s.headers?.origin || '',
        'Cookie': s.headers?.['Cookie'] || s.headers?.cookie || ''
      },
      drm: {
        enabled: Boolean(s.drm?.enabled || s.drm?.keyId || s.drm?.key || s.drm?.licenseUrl),
        scheme: s.drm?.scheme || (s.drm?.keyId || s.drm?.key ? 'clearkey' : 'none'),
        keyId: s.drm?.keyId || '',
        key: s.drm?.key || '',
        licenseUrl: s.drm?.licenseUrl || (s.drm?.keyId && s.drm?.key ? `${s.drm.keyId}:${s.drm.key}` : ''),
        clearKeyLicense
      }
    };
  });

  return {
    id: m.id || `gdrive_m_${index}_${Buffer.from(title).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}`,
    title: title,
    category: m.category || 'Live Cricket',
    status: status,
    format: m.format || 'T20',
    startTime: m.time || m.startTime || 'LIVE NOW',
    bannerUrl: m.bannerUrl || m.banner || '',
    description: m.result || m.description || '',
    isPinned: Boolean(m.isPinned),
    team1: {
      name: team1Name,
      shortName: team1Name.slice(0, 4).toUpperCase().trim(),
      flag: m.team1?.flag || m.team1?.logo || '',
      logo: m.team1?.logo || m.team1?.flag || '',
      score: m.team1?.score || ''
    },
    team2: {
      name: team2Name,
      shortName: team2Name.slice(0, 4).toUpperCase().trim(),
      flag: m.team2?.flag || m.team2?.logo || '',
      logo: m.team2?.logo || m.team2?.flag || '',
      score: m.team2?.score || ''
    },
    totalStreams: streams.filter(Boolean).length,
    streams: streams.filter(Boolean)
  };
}

/**
 * Fetch and parse Live Events:
 * 1. Cricket from Google Drive (LIVE_EVENTS_DRIVE_URL)
 * 2. Football & other sports from Sports_data.json (cricket strictly blocked with isCricketMatch)
 */
async function getDriveEvents(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedEvents && (now - lastEventsFetch < CACHE_TTL_MS)) {
    return cachedEvents;
  }

  try {
    // 1. Fetch Cricket from Google Drive & Non-Cricket from Sports_data.json in parallel
    const [driveRes, sportsRes] = await Promise.all([
      fetch(LIVE_EVENTS_DRIVE_URL, {
        redirect: 'follow',
        headers: { 'User-Agent': 'HDStream-Backend/3.2.0' }
      }).catch(err => {
        console.warn('Drive fetch error:', err.message);
        return null;
      }),
      fetch(SPORTS_DATA_URL, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' }
      }).catch(err => {
        console.warn('SportsData fetch error:', err.message);
        return null;
      })
    ]);

    let cricketAll = [];
    if (driveRes && driveRes.ok) {
      try {
        const driveData = await driveRes.json();
        const allRaw = [
          ...(driveData.live_matches || []).map(m => ({ ...m, _defaultStatus: 'LIVE' })),
          ...(driveData.upcoming_matches || []).map(m => ({ ...m, _defaultStatus: 'UPCOMING' })),
          ...(driveData.finished_matches || []).map(m => ({ ...m, _defaultStatus: 'FINISHED' }))
        ];
        cricketAll = allRaw.map((m, idx) => formatDriveMatch(m, m._defaultStatus, idx)).filter(Boolean);
      } catch (err) {
        console.error('Error parsing Drive Cricket data:', err.message);
      }
    }

    let otherSportsAll = [];
    if (sportsRes && sportsRes.ok) {
      try {
        const sportsData = await sportsRes.json();
        const sportsMatches = sportsData.matches || [];
        // Strict Cricket Filter: Strip out any cricket from Sports_data.json
        const nonCricketMatches = sportsMatches.filter(m => !isCricketMatch(m));
        otherSportsAll = nonCricketMatches.map((m, idx) => formatSportsDataMatch(m, idx)).filter(Boolean);
      } catch (err) {
        console.error('Error parsing SportsData non-cricket data:', err.message);
      }
    }

    // Combine: Cricket from Drive + Other sports from Sports_data.json
    const allFormatted = [...cricketAll, ...otherSportsAll];

    const liveMatches = allFormatted.filter(m => m.status === 'LIVE');
    const upcomingMatches = allFormatted.filter(m => m.status === 'UPCOMING');
    const finishedMatches = allFormatted.filter(m => m.status === 'FINISHED' || m.status === 'ENDED');

    const result = {
      liveEvents: liveMatches,
      upcomingEvents: upcomingMatches,
      recentEvents: finishedMatches,
      raw: { cricketCount: cricketAll.length, otherSportsCount: otherSportsAll.length }
    };

    cachedEvents = result;
    lastEventsFetch = now;
    return result;
  } catch (error) {
    console.error('Error in getDriveEvents:', error.message);
    if (cachedEvents) {
      return cachedEvents;
    }
    return {
      liveEvents: [],
      upcomingEvents: [],
      recentEvents: [],
      raw: {}
    };
  }
}

module.exports = {
  CATEGORY_DRIVE_URL,
  LIVE_EVENTS_DRIVE_URL,
  SPORTS_DATA_URL,
  isCricketMatch,
  getDriveCategories,
  getDriveEvents
};

