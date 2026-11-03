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

/**
 * 1. Mobile Consolidated App Feed
 * GET /api/feed/mobile or /api/feed/app-data
 * Single fast network call for Android / iOS mobile applications
 * Live events and Categories are dynamically fetched from Google Drive links!
 */
router.get(['/mobile', '/app-data'], async (req, res) => {
  try {
    // Track device activity in background
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    Store.trackDevice(clientIp, userAgent).catch(() => {});

    const isForceRefresh = req.query.refresh === 'true';

    // Live events & Categories are loaded directly from Google Drive links (removed from MongoDB admin store)
    const [driveEvents, driveCategories, vods, settings] = await Promise.all([
      GDriveFeed.getDriveEvents(isForceRefresh),
      GDriveFeed.getDriveCategories(isForceRefresh),
      Store.getVods(),
      Store.getSettings()
    ]);

    const liveEvents = driveEvents.liveEvents || [];
    const upcomingEvents = driveEvents.upcomingEvents || [];
    const finishedEvents = (driveEvents.recentEvents || []).slice(0, 10);

    const responsePayload = {
      status: 'success',
      timestamp: Date.now(),
      serverIsoTime: new Date().toISOString(),
      dataSource: {
        categories: 'Google Drive',
        liveEvents: 'Google Drive',
        categoryUrl: GDriveFeed.CATEGORY_DRIVE_URL,
        liveEventsUrl: GDriveFeed.LIVE_EVENTS_DRIVE_URL
      },
      appConfig: {
        appName: settings.appName || 'HD STREAM',
        announcement: settings.announcement,
        announcementEnabled: settings.announcementEnabled,
        appVersion: settings.appVersion,
        minVersion: settings.minVersion,
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
      categories: driveCategories.map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        icon: c.icon || 'fas fa-tv',
        imageUrl: c.imageUrl || '',
        m3uLink: c.m3uLink || '',
        portal_url: c.portal_url || '',
        mac: c.mac || ''
      })),
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
