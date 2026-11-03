const express = require('express');
const router = express.Router();
const Store = require('../services/store');

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
 */
router.get(['/mobile', '/app-data'], async (req, res) => {
  try {
    // Track device activity in background
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    Store.trackDevice(clientIp, userAgent).catch(() => {});

    const [matches, categories, vods, settings] = await Promise.all([
      Store.getMatches(),
      Store.getCategories(),
      Store.getVods(),
      Store.getSettings()
    ]);

    const liveEvents = matches
      .filter(m => m.status === 'LIVE')
      .map(formatMatchForMobile);

    const upcomingEvents = matches
      .filter(m => m.status === 'UPCOMING')
      .map(formatMatchForMobile);

    const finishedEvents = matches
      .filter(m => m.status === 'FINISHED')
      .slice(0, 10)
      .map(formatMatchForMobile);

    const responsePayload = {
      status: 'success',
      timestamp: Date.now(),
      serverIsoTime: new Date().toISOString(),
      appConfig: {
        appName: settings.appName,
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
      categories: categories.map(c => ({
        id: c._id || c.id,
        name: c.name,
        slug: c.slug,
        icon: c.icon || 'fas fa-tv',
        imageUrl: c.imageUrl || '',
        m3uLink: c.m3uLink || ''
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

// Helper for formatting Match objects
function formatMatchForMobile(match) {
  const activeStreams = (match.streams || [])
    .filter(s => s.isActive !== false)
    .map(s => {
      let clearKeyLicense = null;
      if (s.drm?.enabled && s.drm.scheme === 'clearkey' && s.drm.keyId && s.drm.key) {
        clearKeyLicense = {
          keyIdHex: s.drm.keyId,
          keyHex: s.drm.key,
          w3cFormat: {
            keys: [
              {
                kty: 'oct',
                kid: hexToBase64Url(s.drm.keyId),
                k: hexToBase64Url(s.drm.key)
              }
            ]
          }
        };
      }

      return {
        id: s.id || s._id,
        title: s.title,
        streamType: s.streamType,
        streamUrl: s.streamUrl,
        quality: s.quality || 'Auto',
        headers: {
          'User-Agent': s.headers?.userAgent || 'ExoPlayer-Media3/1.4.0',
          'Referer': s.headers?.referer || '',
          'Origin': s.headers?.origin || '',
          'Cookie': s.headers?.cookie || ''
        },
        drm: {
          enabled: Boolean(s.drm?.enabled || s.drm?.keyId || s.drm?.key || s.drm?.licenseUrl),
          scheme: s.drm?.scheme || (s.drm?.keyId || s.drm?.key ? 'clearkey' : 'none'),
          keyId: s.drm?.keyId || '',
          key: s.drm?.key || '',
          licenseUrl: s.drm?.licenseUrl || (s.drm?.keyId && s.drm?.key ? `${s.drm.keyId}:${s.drm.key}` : (s.drm?.scheme === 'widevine' ? s.drm?.key : '')),
          clearKeyLicense
        }
      };
    });

  return {
    id: match._id,
    title: match.title,
    category: match.category,
    status: match.status,
    format: match.matchFormat,
    startTime: match.startTime,
    bannerUrl: match.bannerUrl,
    description: match.description,
    isPinned: Boolean(match.isPinned),
    team1: {
      name: match.team1?.name || 'Team 1',
      shortName: match.team1?.shortName || 'T1',
      flag: match.team1?.flag || match.team1?.logo || '',
      logo: match.team1?.logo || match.team1?.flag || '',
      score: match.team1?.score || ''
    },
    team2: {
      name: match.team2?.name || 'Team 2',
      shortName: match.team2?.shortName || 'T2',
      flag: match.team2?.flag || match.team2?.logo || '',
      logo: match.team2?.logo || match.team2?.flag || '',
      score: match.team2?.score || ''
    },
    totalStreams: activeStreams.length,
    streams: activeStreams
  };
}

/**
 * 2. Automatic M3U / IPTV Playlist Generator
 * GET /api/feed/playlist.m3u
 * Can be opened in VLC, OTT Navigator, TiviMate, or ExoPlayer!
 */
router.get('/playlist.m3u', async (req, res) => {
  try {
    const matches = await Store.getMatches({ status: 'LIVE' });
    const vods = await Store.getVods();

    let m3uContent = '#EXTM3U x-tvg-url=""\n\n';

    // 1. Live Match Streams
    m3uContent += '<!-- ======== LIVE MATCHES & CRICKET STREAMS ======== -->\n';
    matches.forEach(m => {
      (m.streams || []).forEach((stream, idx) => {
        if (!stream.isActive || !stream.streamUrl) return;

        const channelName = `${m.title} — ${stream.title} [${stream.quality}]`;
        const groupTitle = m.category || 'Live Cricket';
        const logo = m.bannerUrl || m.team1?.flag || '';
        const userAgent = stream.headers?.userAgent ? ` http-user-agent="${stream.headers.userAgent}"` : '';
        const referer = stream.headers?.referer ? ` http-referrer="${stream.headers.referer}"` : '';

        m3uContent += `#EXTINF:-1 tvg-id="${stream.id}" tvg-name="${m.title}" tvg-logo="${logo}" group-title="${groupTitle}"${userAgent}${referer},${channelName}\n`;

        // DRM tags (Widevine & ClearKey) for Kodi, TiviMate, Sparkle & OTT players
        if (stream.drm?.enabled && (stream.drm.scheme === 'widevine' || stream.drm.licenseUrl)) {
          m3uContent += `#KODIPROP:inputstream.adaptive.manifest_type=${stream.streamType.toLowerCase()}\n`;
          m3uContent += `#KODIPROP:inputstream.adaptive.license_type=com.widevine.alpha\n`;
          m3uContent += `#KODIPROP:inputstream.adaptive.license_key=${stream.drm.licenseUrl || stream.drm.key}\n`;
        } else if (stream.drm?.enabled && stream.drm.scheme === 'clearkey' && stream.drm.keyId && stream.drm.key) {
          m3uContent += `#KODIPROP:inputstream.adaptive.manifest_type=${stream.streamType.toLowerCase()}\n`;
          m3uContent += `#KODIPROP:inputstream.adaptive.license_type=clearkey\n`;
          m3uContent += `#KODIPROP:inputstream.adaptive.license_key=${stream.drm.keyId}:${stream.drm.key}\n`;
        }

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
 * Responds with standard W3C ClearKey JSON
 */
router.get('/clearkey/:matchId/:streamId', async (req, res) => {
  try {
    const match = await Store.getMatchById(req.params.matchId);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    const stream = (match.streams || []).find(s => s.id === req.params.streamId || String(s._id) === req.params.streamId);
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
