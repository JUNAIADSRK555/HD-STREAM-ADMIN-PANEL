const express = require('express');
const router = express.Router();
const Store = require('../services/store');
const GDriveFeed = require('../services/gdriveFeed');

// Helper to convert hex to base64url for W3C ClearKey format
function hexToBase64Url(hexStr) {
  if (!hexStr) return '';
  const cleanHex = hexStr.replace(/[^0-9a-fA-F]/g, '');
  const buffer = Buffer.from(cleanHex, 'hex');
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Format Store matches to Android LiveStreamEvent format
function formatStoreMatch(m, index = 0) {
  const title = (m.title || m.name || `Live Stream ${index + 1}`).trim();
  const status = (m.status || 'LIVE').toUpperCase();

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

  const streams = (m.streams || []).map((s, sIdx) => {
    let url = (s.streamUrl || s.url || '').trim();
    if (!url) return null;

    const isMpd = (s.streamType || '').toUpperCase() === 'MPD' || url.includes('.mpd');
    const isHls = (s.streamType || '').toUpperCase() === 'M3U8' || url.includes('.m3u8');
    const streamType = s.streamType || (isMpd ? 'MPD' : isHls ? 'M3U8' : 'DIRECT');

    let drm = s.drm || {};
    if (!drm.keyId && url.includes('drmLicense=')) {
      const match = url.match(/drmLicense=([0-9a-fA-F]{32}):([0-9a-fA-F]{32})/);
      if (match) {
        drm = { enabled: true, scheme: 'clearkey', keyId: match[1], key: match[2] };
      }
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
      id: s.id || `str_${m._id || index}_${sIdx}`,
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
        enabled: Boolean(drm?.enabled || drm?.keyId || drm?.key || drm?.licenseUrl),
        scheme: drm?.scheme || (drm?.keyId || drm?.key ? 'clearkey' : 'none'),
        keyId: drm?.keyId || '',
        key: drm?.key || '',
        licenseUrl: drm?.licenseUrl || (drm?.keyId && drm?.key ? `${drm.keyId}:${drm.key}` : ''),
        clearKeyLicense
      }
    };
  }).filter(Boolean);

  return {
    id: String(m._id || m.id || `match_${index}`),
    title,
    category: m.category || 'Live Sports',
    status,
    matchFormat: m.matchFormat || 'T20',
    startTime: m.startTime || new Date().toISOString(),
    bannerUrl: m.bannerUrl || '',
    description: m.description || '',
    isPinned: Boolean(m.isPinned),
    team1: {
      name: team1Name,
      shortName: m.team1?.shortName || team1Name.substring(0, 4).toUpperCase(),
      flag: m.team1?.flag || '📺',
      score: m.team1?.score || ''
    },
    team2: {
      name: team2Name,
      shortName: m.team2?.shortName || team2Name.substring(0, 4).toUpperCase(),
      flag: m.team2?.flag || '🔴',
      score: m.team2?.score || ''
    },
    streams
  };
}

/**
 * 1. Mobile Consolidated App Feed
 * GET /api/feed/mobile or /api/feed/app-data
 * Single fast network call for Android / iOS mobile applications
 * Live events and Categories are dynamically fetched from Store & Google Drive links!
 */
router.get(['/mobile', '/app-data'], async (req, res) => {
  try {
    // Track device activity in background
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    Store.trackDevice(clientIp, userAgent).catch(() => {});

    const isForceRefresh = req.query.refresh === 'true';

    // Live events & Categories are loaded from Store (Admin additions & JSON imports) + Google Drive
    const [storeMatches, storeCategories, driveEvents, driveCategories, vods, settings] = await Promise.all([
      Store.getMatches().catch(() => []),
      Store.getCategories().catch(() => []),
      GDriveFeed.getDriveEvents(isForceRefresh).catch(() => ({ liveEvents: [], upcomingEvents: [], recentEvents: [] })),
      GDriveFeed.getDriveCategories(isForceRefresh).catch(() => []),
      Store.getVods().catch(() => []),
      Store.getSettings().catch(() => ({}))
    ]);

    // Format Store matches
    const formattedStoreMatches = (storeMatches || []).map((m, idx) => formatStoreMatch(m, idx));

    const storeLive = formattedStoreMatches.filter(m => (m.status || 'LIVE').toUpperCase() === 'LIVE');
    const storeUpcoming = formattedStoreMatches.filter(m => (m.status || '').toUpperCase() === 'UPCOMING');
    const storeFinished = formattedStoreMatches.filter(m => (m.status || '').toUpperCase() === 'FINISHED');

    const driveLive = driveEvents.liveEvents || [];
    const driveUpcoming = driveEvents.upcomingEvents || [];
    const driveFinished = driveEvents.recentEvents || [];

    // Combine: Store matches first (admin priority), followed by Google Drive matches (deduplicated by title)
    const seenEventKeys = new Set();
    const liveEvents = [];
    for (const ev of [...storeLive, ...driveLive]) {
      const key = (ev.title || '').toLowerCase().trim();
      if (!seenEventKeys.has(key)) {
        seenEventKeys.add(key);
        liveEvents.push(ev);
      }
    }

    const seenUpcomingKeys = new Set();
    const upcomingEvents = [];
    for (const ev of [...storeUpcoming, ...driveUpcoming]) {
      const key = (ev.title || '').toLowerCase().trim();
      if (!seenUpcomingKeys.has(key)) {
        seenUpcomingKeys.add(key);
        upcomingEvents.push(ev);
      }
    }

    const recentEvents = [...storeFinished, ...driveFinished].slice(0, 10);

    // Merge Categories: Store categories + Google drive categories (filtered for adult & removed tabs)
    const seenCatSlugs = new Set();
    const categories = [];

    const isExcludedCat = (name, slug) => {
      const combined = `${name || ''} ${slug || ''}`.toLowerCase();
      if (/adult|18\+|porn|erotic|nsfw|xxx/i.test(combined)) return true;
      if (['live-channels', 'movies', 'cinex-movies', 'hd-stream'].includes(slug?.toLowerCase())) return true;
      return false;
    };

    for (const c of storeCategories || []) {
      const name = (c.name || '').trim();
      const slug = (c.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-')).trim();
      if (!name || seenCatSlugs.has(slug) || isExcludedCat(name, slug)) continue;
      seenCatSlugs.add(slug);
      categories.push({
        id: c.id || c._id || `cat_${slug}`,
        name,
        slug,
        icon: c.icon || 'fas fa-tv',
        imageUrl: c.imageUrl || '',
        m3uLink: c.m3uLink || '',
        portal_url: c.portal_url || '',
        mac: c.mac || ''
      });
    }

    for (const c of driveCategories || []) {
      const name = (c.name || '').trim();
      const slug = (c.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-')).trim();
      if (!name || seenCatSlugs.has(slug) || isExcludedCat(name, slug)) continue;
      seenCatSlugs.add(slug);
      categories.push({
        id: c.id,
        name,
        slug,
        icon: c.icon || 'fas fa-tv',
        imageUrl: c.imageUrl || '',
        m3uLink: c.m3uLink || '',
        portal_url: c.portal_url || '',
        mac: c.mac || ''
      });
    }

    const responsePayload = {
      status: 'success',
      timestamp: Date.now(),
      serverIsoTime: new Date().toISOString(),
      dataSource: {
        adminMatches: storeLive.length,
        adminCategories: storeCategories.length,
        categories: 'Merged (Admin + Google Drive)',
        liveEvents: 'Merged (Admin + Google Drive)',
        categoryUrl: GDriveFeed.CATEGORY_DRIVE_URL,
        liveEventsUrl: GDriveFeed.LIVE_EVENTS_DRIVE_URL
      },
      appConfig: {
        appName: settings.appName || 'HD STREAM',
        announcement: settings.announcement,
        announcementEnabled: settings.announcementEnabled,
        appVersion: '3.4.10',
        minVersion: settings.minVersion || '1.0.0',
        apkDownloadUrl: settings.apkDownloadUrl || 'https://raw.githubusercontent.com/JUNAIADSRK555/HD-STREAM-ADMIN-PANEL/main/public/HD-STREAM.apk',
        maintenanceMode: settings.maintenanceMode,
        telegramLink: settings.telegramLink || 'https://t.me/livetvofficialapp',
        supportEmail: settings.supportEmail || 'shaikhabutlha506@gmail.com',
        sponsorBannerUrl: settings.sponsorBannerUrl || '',
        sponsorRedirectUrl: settings.sponsorRedirectUrl || 'https://t.me/livetvofficialapp',
        adsterraEnabled: settings.adsterraEnabled !== false,
        adsterraZoneId: settings.adsterraZoneId || '8492041',
        adsterraPublisherId: settings.adsterraPublisherId || 'shaikhabutlha506@gmail.com',
        channelChangeAdFrequency: settings.channelChangeAdFrequency || 5
      },
      categories,
      liveEvents,
      upcomingEvents,
      recentEvents: finishedEvents,
      vodSection: vods.map(v => ({
        id: v._id,
        title: v.title,
        category: v.category,
        posterUrl: v.posterUrl,
        bannerUrl: v.bannerUrl,
        description: v.description,
        rating: v.rating,
        releaseYear: v.releaseYear,
        isFeatured: v.isFeatured,
        totalEpisodes: v.episodes?.length || 0,
        episodes: (v.episodes || []).map(ep => ({
          id: ep.id || ep._id,
          episodeNumber: ep.episodeNumber,
          title: ep.title,
          duration: ep.duration,
          thumbnail: ep.thumbnail,
          streamType: ep.streamType,
          streamUrl: ep.streamUrl,
          headers: ep.headers || {},
          drm: ep.drm || { enabled: false }
        }))
      }))
    };

    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json(responsePayload);
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * Google Drive status endpoint
 * GET /api/feed/gdrive/status
 */
router.get('/gdrive/status', async (req, res) => {
  try {
    const isForceRefresh = req.query.refresh === 'true';
    const [events, categories] = await Promise.all([
      GDriveFeed.getDriveEvents(isForceRefresh),
      GDriveFeed.getDriveCategories(isForceRefresh)
    ]);

    res.json({
      status: 'success',
      googleDriveSources: {
        categoryUrl: GDriveFeed.CATEGORY_DRIVE_URL,
        liveEventsUrl: GDriveFeed.LIVE_EVENTS_DRIVE_URL
      },
      counts: {
        categories: categories.length,
        liveMatches: events.liveEvents.length,
        upcomingMatches: events.upcomingEvents.length,
        finishedMatches: events.recentEvents.length
      },
      categories,
      events
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * 2. Automatic M3U / IPTV Playlist Generator
 * GET /api/feed/playlist.m3u
 * Can be opened in VLC, OTT Navigator, TiviMate, or ExoPlayer!
 */
router.get('/playlist.m3u', async (req, res) => {
  try {
    const [driveEvents, vods] = await Promise.all([
      GDriveFeed.getDriveEvents(),
      Store.getVods()
    ]);

    const liveMatches = driveEvents.liveEvents || [];

    let m3uContent = '#EXTM3U x-tvg-url=""\n\n';

    // 1. Live Match Streams from Google Drive
    m3uContent += '<!-- ======== LIVE MATCHES & CRICKET STREAMS (GOOGLE DRIVE) ======== -->\n';
    liveMatches.forEach(m => {
      (m.streams || []).forEach((stream) => {
        if (!stream.streamUrl) return;

        const channelName = `${m.title} — ${stream.title} [${stream.quality}]`;
        const groupTitle = m.category || 'Live Cricket';
        const logo = m.bannerUrl || m.team1?.flag || '';
        const userAgent = stream.headers?.['User-Agent'] ? ` http-user-agent="${stream.headers['User-Agent']}"` : '';
        const referer = stream.headers?.['Referer'] ? ` http-referrer="${stream.headers['Referer']}"` : '';

        m3uContent += `#EXTINF:-1 tvg-id="${stream.id}" tvg-name="${m.title}" tvg-logo="${logo}" group-title="${groupTitle}"${userAgent}${referer},${channelName}\n`;
        m3uContent += `${stream.streamUrl}\n\n`;
      });
    });

    // 2. VOD Episodes
    m3uContent += '<!-- ======== VOD & ENTERTAINMENT EPISODES ======== -->\n';
    vods.forEach(v => {
      (v.episodes || []).forEach(ep => {
        if (!ep.streamUrl) return;
        const channelName = `${v.title} — Ep ${ep.episodeNumber}: ${ep.title}`;
        const groupTitle = v.category || 'Entertainment';
        const logo = ep.thumbnail || v.posterUrl || '';

        m3uContent += `#EXTINF:-1 tvg-id="${ep.id}" tvg-name="${v.title}" tvg-logo="${logo}" group-title="${groupTitle}",${channelName}\n`;
        m3uContent += `${ep.streamUrl}\n\n`;
      });
    });

    res.setHeader('Content-Type', 'application/x-mpegurl');
    res.setHeader('Content-Disposition', 'inline; filename="jdcric_streams.m3u"');
    res.send(m3uContent);
  } catch (error) {
    res.status(500).send('#EXTM3U\n# Error generating playlist: ' + error.message);
  }
});

/**
 * 3. ClearKey License Server endpoint
 * GET /api/feed/clearkey/:matchId/:streamId
 */
router.get('/clearkey/:matchId/:streamId', async (req, res) => {
  try {
    const events = await GDriveFeed.getDriveEvents();
    const allMatches = [...events.liveEvents, ...events.upcomingEvents, ...events.recentEvents];
    const match = allMatches.find(m => m.id === req.params.matchId);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    const stream = (match.streams || []).find(s => s.id === req.params.streamId);
    if (!stream || !stream.drm?.enabled) {
      return res.status(404).json({ error: 'Stream or DRM not found' });
    }

    const { keyId, key } = stream.drm;
    const responseJson = {
      keys: [
        {
          kty: 'oct',
          kid: hexToBase64Url(keyId),
          k: hexToBase64Url(key)
        }
      ]
    };

    res.json(responseJson);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
