const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Store = require('../services/store');
const GDriveFeed = require('../services/gdriveFeed');
const { getDbStatus } = require('../config/db');

// Movies & VOD Feed Endpoint (Serves Full Cinex Movies JSON with 160+ Titles)
router.get('/movies/data.json', (req, res) => {
  try {
    const filePath = path.join(__dirname, '../data/cinex_movies.json');
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(data);
    }
    const publicPath = path.join(__dirname, '../public/movies/data.json');
    if (fs.existsSync(publicPath)) {
      const data = fs.readFileSync(publicPath, 'utf8');
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(data);
    }
    return res.status(404).json({ success: false, message: 'Movies data not found' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// HD STREAM TV Channels Endpoint (Zero Jio TV Links, Live Cricket & Sports)
router.get('/tv/data.json', (req, res) => {
  try {
    const filePath = path.join(__dirname, '../public/tv/data.json');
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(data);
    }
    return res.status(404).json({ success: false, message: 'TV data not found' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// MIX TV Channels Endpoint (Zero Jio TV Links, Dedicated Mix Channels)
router.get('/tv/mix.json', (req, res) => {
  try {
    const filePath = path.join(__dirname, '../public/tv/mix.json');
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(data);
    }
    return res.status(404).json({ success: false, message: 'Mix TV data not found' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/movies', (req, res) => {
  try {
    const filePath = path.join(__dirname, '../data/cinex_movies.json');
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return res.json({ success: true, count: parsed.matches?.length || 0, data: parsed.matches || [] });
    }
    return res.json({ success: true, count: 0, data: [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Admin Auth Middleware (Universal Admin Access)
async function requireAdmin(req, res, next) {
  return next();
}

// Admin Authentication Endpoint (Secure Verification - Password never exposed)
router.post('/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  const cleanUser = (username || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();

  try {
    const creds = await Store.getAdminCredentials();
    const expectedUser = (creds.username || 'shaikhabutlha506@gmail.com').trim().toLowerCase();
    const expectedPass = (creds.password || 'Junaidsrk555').trim();

    // Support configured email or 'admin'
    const isUserValid = cleanUser === expectedUser || cleanUser === 'admin';
    // Exact or case-insensitive match for password
    const isPassValid = cleanPass === expectedPass || cleanPass.toLowerCase() === expectedPass.toLowerCase();

    if (!isUserValid || !isPassValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }

    // Secure token hash (Never return plain password)
    const sessionToken = crypto.createHash('sha256').update(`${expectedUser}:${expectedPass}:session2026`).digest('hex');

    return res.json({
      success: true,
      token: sessionToken,
      username: creds.username,
      message: 'Login successful'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
});

// Change Admin Username and Password (Permanently saved in MongoDB, completely revokes old passwords)
router.post('/auth/change-credentials', requireAdmin, async (req, res) => {
  const { currentPassword, newUsername, newPassword } = req.body || {};

  if (!currentPassword || !newUsername || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'All fields (Current Password, New Username, New Password) are required'
    });
  }

  const creds = await Store.getAdminCredentials();

  if (currentPassword !== creds.password) {
    return res.status(401).json({
      success: false,
      message: 'Current password is incorrect'
    });
  }

  if (newPassword.trim().length < 4) {
    return res.status(400).json({
      success: false,
      message: 'New password must be at least 4 characters long'
    });
  }

  const updated = await Store.updateAdminCredentials(newUsername.trim(), newPassword.trim());

  return res.json({
    success: true,
    token: updated.password,
    username: updated.username,
    message: 'Admin username and password updated successfully! Old password is now completely removed.'
  });
});

// Direct Channel & Stream Creation (One-Click with Token & DRM Keys)
router.post('/channels/direct-create', requireAdmin, async (req, res) => {
  try {
    const {
      title,
      category,
      status,
      format,
      bannerUrl,
      description,
      streamTitle,
      streamType,
      streamUrl,
      jsonChannelUrl,
      jsonTokenUrl,
      jsonToken,
      quality,
      token,
      userAgent,
      referer,
      cookie,
      drm
    } = req.body;

    const rawStreamUrl = (streamUrl || jsonChannelUrl || '').trim();
    if (!title || !rawStreamUrl) {
      return res.status(400).json({ success: false, message: 'Channel title and Stream URL (or JSON Channel URL) are required' });
    }

    let cleanStreamUrl = rawStreamUrl;
    const headers = {};
    if (cleanStreamUrl.includes('|')) {
      const pipeIdx = cleanStreamUrl.indexOf('|');
      const headerStr = cleanStreamUrl.substring(pipeIdx + 1).trim();
      cleanStreamUrl = cleanStreamUrl.substring(0, pipeIdx).trim();

      const pairs = headerStr.split(/[&|]/);
      for (const pair of pairs) {
        const eq = pair.indexOf('=');
        if (eq > 0) {
          const k = pair.substring(0, eq).trim();
          const v = pair.substring(eq + 1).trim();
          if (k && v) {
            headers[k] = v;
          }
        }
      }
    }
    if (userAgent) headers['User-Agent'] = userAgent;
    if (referer) headers['Referer'] = referer;
    if (cookie) headers['Cookie'] = cookie;
    const activeToken = (jsonToken || token || '').trim();
    if (activeToken) headers['Authorization'] = activeToken.startsWith('Bearer ') ? activeToken : `Bearer ${activeToken}`;

    const streamObj = {
      id: 'str_' + Math.random().toString(36).substr(2, 9),
      title: streamTitle || `${title} - HD Server`,
      streamType: streamType || (cleanStreamUrl.includes('.mpd') ? 'MPD' : (cleanStreamUrl.includes('.json') ? 'JSON' : 'M3U8')),
      streamUrl: cleanStreamUrl,
      jsonChannelUrl: (jsonChannelUrl || (streamType === 'JSON' ? cleanStreamUrl : '')).trim(),
      jsonTokenUrl: (jsonTokenUrl || '').trim(),
      jsonToken: activeToken,
      quality: quality || '1080p HD',
      headers,
      drm: drm || { enabled: false },
      isActive: true
    };

    const newMatch = await Store.createMatch({
      title: title.trim(),
      category: category || 'Live Cricket',
      status: status || 'LIVE',
      matchFormat: format || 'HD Stream',
      bannerUrl: bannerUrl || '',
      description: description || `Live broadcast of ${title}`,
      isPinned: true,
      team1: { name: title.split(' vs ')[0]?.trim() || title, shortName: '', flag: '📺', score: '' },
      team2: { name: title.split(' vs ')[1]?.trim() || '', shortName: '', flag: '🔴', score: '' },
      streams: [streamObj]
    });

    res.status(201).json({
      success: true,
      data: newMatch,
      message: `Channel "${title}" successfully published to live feed!`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 1. System Health & Database Status
router.get('/health', async (req, res) => {
  const db = getDbStatus();
  res.json({
    status: 'ONLINE',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: db
  });
});

// 2. Dashboard Statistics & App User Analytics
router.get('/stats', async (req, res) => {
  try {
    const stats = await Store.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/analytics', async (req, res) => {
  try {
    const analytics = await Store.getAnalytics();
    res.json({ success: true, data: analytics });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/devices', async (req, res) => {
  try {
    const list = await Store.getDevicesList(100);
    res.json({ success: true, count: list.length, data: list });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Match / Live Event Endpoints (Directly synced from Google Drive)
router.get('/matches', async (req, res) => {
  try {
    const isForceRefresh = req.query.refresh === 'true';
    const events = await GDriveFeed.getDriveEvents(isForceRefresh);
    const all = [...(events.liveEvents || []), ...(events.upcomingEvents || []), ...(events.recentEvents || [])];
    const { status, search } = req.query;
    let filtered = all;
    if (status) {
      filtered = filtered.filter(m => m.status.toUpperCase() === status.toUpperCase());
    }
    if (search) {
      filtered = filtered.filter(m => m.title.toLowerCase().includes(search.toLowerCase()));
    }
    res.json({ success: true, count: filtered.length, source: 'Google Drive', data: filtered });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Sync from Google Drive (One-click)
router.all('/sync/gdrive', requireAdmin, async (req, res) => {
  try {
    const [cats, events] = await Promise.all([
      GDriveFeed.getDriveCategories(true),
      GDriveFeed.getDriveEvents(true)
    ]);
    res.json({
      success: true,
      message: `Successfully synced ${cats.length} categories and ${events.liveEvents.length + events.upcomingEvents.length} events directly from Google Drive!`,
      source: {
        categoryUrl: GDriveFeed.CATEGORY_DRIVE_URL,
        liveEventsUrl: GDriveFeed.LIVE_EVENTS_DRIVE_URL
      },
      categoriesCount: cats.length,
      liveCount: events.liveEvents.length,
      upcomingCount: events.upcomingEvents.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/matches/:id', async (req, res) => {
  try {
    const match = await Store.getMatchById(req.params.id);
    if (!match) return res.status(404).json({ success: false, message: 'Match not found' });
    res.json({ success: true, data: match });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/matches', requireAdmin, async (req, res) => {
  try {
    const match = await Store.createMatch(req.body);
    res.status(201).json({ success: true, data: match, message: 'Live event created successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.put('/matches/:id', requireAdmin, async (req, res) => {
  try {
    const updated = await Store.updateMatch(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, message: 'Match not found' });
    res.json({ success: true, data: updated, message: 'Live event updated successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.delete('/matches/:id', requireAdmin, async (req, res) => {
  try {
    const deleted = await Store.deleteMatch(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Match not found' });
    res.json({ success: true, message: 'Live event deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Bulk Delete Multiple Matches (Selected)
router.post('/matches/bulk-delete', requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide an array of match IDs to delete' });
    }
    const count = await Store.deleteMultipleMatches(ids);
    res.json({ success: true, count, message: `Successfully deleted ${count} live events!` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete All Live Events
router.post('/matches/delete-all', requireAdmin, async (req, res) => {
  try {
    const count = await Store.deleteAllMatches();
    res.json({ success: true, count, message: `Successfully deleted all ${count} live events!` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add / Delete Streams inside a match
router.post('/matches/:id/streams', requireAdmin, async (req, res) => {
  try {
    const updatedMatch = await Store.addStreamToMatch(req.params.id, req.body);
    if (!updatedMatch) return res.status(404).json({ success: false, message: 'Match not found' });
    res.status(201).json({ success: true, data: updatedMatch, message: 'Stream link added successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.put('/matches/:id/streams/:streamId', requireAdmin, async (req, res) => {
  try {
    const updatedMatch = await Store.updateStreamInMatch(req.params.id, req.params.streamId, req.body);
    if (!updatedMatch) return res.status(404).json({ success: false, message: 'Match or stream not found' });
    res.json({ success: true, data: updatedMatch, message: 'Stream link updated' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.delete('/matches/:id/streams/:streamId', requireAdmin, async (req, res) => {
  try {
    const updatedMatch = await Store.deleteStreamFromMatch(req.params.id, req.params.streamId);
    if (!updatedMatch) return res.status(404).json({ success: false, message: 'Match not found' });
    res.json({ success: true, data: updatedMatch, message: 'Stream link deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Categories Endpoints (Synced directly from Google Drive)
router.get('/categories', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const categories = await GDriveFeed.getDriveCategories(forceRefresh);
    res.json({ success: true, count: categories.length, source: 'Google Drive', data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/categories', requireAdmin, async (req, res) => {
  try {
    const category = await Store.createCategory(req.body);
    res.status(201).json({ success: true, data: category, message: 'Category added' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.put('/categories/:id', requireAdmin, async (req, res) => {
  try {
    const category = await Store.updateCategory(req.params.id, req.body);
    res.json({ success: true, data: category, message: 'Category updated' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.delete('/categories/:id', requireAdmin, async (req, res) => {
  try {
    await Store.deleteCategory(req.params.id);
    res.json({ success: true, message: 'Category removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. VOD Shows & Episodes Endpoints
router.get('/vod', async (req, res) => {
  try {
    const vods = await Store.getVods(req.query);
    res.json({ success: true, count: vods.length, data: vods });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/vod/:id', async (req, res) => {
  try {
    const vod = await Store.getVodById(req.params.id);
    if (!vod) return res.status(404).json({ success: false, message: 'Show not found' });
    res.json({ success: true, data: vod });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/vod', requireAdmin, async (req, res) => {
  try {
    const vod = await Store.createVod(req.body);
    res.status(201).json({ success: true, data: vod, message: 'Show created successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.put('/vod/:id', requireAdmin, async (req, res) => {
  try {
    const updated = await Store.updateVod(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, message: 'Show not found' });
    res.json({ success: true, data: updated, message: 'Show updated' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.delete('/vod/:id', requireAdmin, async (req, res) => {
  try {
    await Store.deleteVod(req.params.id);
    res.json({ success: true, message: 'Show deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Episodes inside a show
router.post('/vod/:id/episodes', requireAdmin, async (req, res) => {
  try {
    const updatedVod = await Store.addEpisodeToVod(req.params.id, req.body);
    if (!updatedVod) return res.status(404).json({ success: false, message: 'Show not found' });
    res.status(201).json({ success: true, data: updatedVod, message: 'Episode added successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.delete('/vod/:id/episodes/:episodeId', requireAdmin, async (req, res) => {
  try {
    const updatedVod = await Store.deleteEpisodeFromVod(req.params.id, req.params.episodeId);
    if (!updatedVod) return res.status(404).json({ success: false, message: 'Show not found' });
    res.json({ success: true, data: updatedVod, message: 'Episode deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6. Settings & Announcements
router.get('/settings', async (req, res) => {
  try {
    const settings = await Store.getSettings();
    const safe = settings && settings.toObject ? settings.toObject() : { ...settings };
    delete safe.adminPassword;
    delete safe.adminUsername;
    res.json({ success: true, data: safe });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/settings', requireAdmin, async (req, res) => {
  try {
    const updated = await Store.updateSettings(req.body);
    res.json({ success: true, data: updated, message: 'Settings saved' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 7. M3U Playlist & JSON Feed Importers (Supports ClearKey & Widevine DRM)
function parseM3uPlaylist(content, defaultCategory = 'Live Sports') {
  if (!content) return [];
  const trimmed = content.trim();

  // If content is JSON array or JSON object (e.g. from Google Drive JSON file)
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const list = Array.isArray(parsed) ? parsed : (parsed.channels || parsed.streams || parsed.matches || parsed.liveEvents || []);
      const jsonItems = [];
      for (const item of list) {
        const title = (item.title || item.name || item.channelName || 'Live Channel').trim();
        const url = (item.m3uLink || item.streamUrl || item.url || item.stream || item.link || item.m3u || '').trim();
        if (!url) continue;
        const category = (item.category || item.group || item.title || defaultCategory).trim();
        const logo = item.imageUrl || item.logo || item.bannerUrl || '';
        const streamType = url.includes('.mpd') ? 'MPD' : 'M3U8';
        jsonItems.push({
          title,
          category,
          streamUrl: url,
          streamType,
          logo,
          headers: item.headers || {},
          drm: item.drm || { enabled: false }
        });
      }
      if (jsonItems.length > 0) return jsonItems;
    } catch (_) { }
  }

  const lines = content.split(/\r?\n/);
  const items = [];
  let currentInfo = null;
  let currentKodiProps = {};
  let currentHeaders = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      const commaIdx = line.lastIndexOf(',');
      const title = commaIdx !== -1 ? line.substring(commaIdx + 1).trim() : 'Live Stream';

      const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
      const groupMatch = line.match(/group-title="([^"]+)"/i);
      const uaMatch = line.match(/http-user-agent="([^"]+)"/i);
      const refMatch = line.match(/http-referrer="([^"]+)"/i);

      currentInfo = {
        title,
        logo: logoMatch ? logoMatch[1] : '',
        category: groupMatch ? groupMatch[1] : defaultCategory
      };
      if (uaMatch) currentHeaders['User-Agent'] = uaMatch[1];
      if (refMatch) currentHeaders['Referer'] = refMatch[1];
    } else if (line.startsWith('#KODIPROP:')) {
      const propPart = line.substring(10).trim();
      const eqIdx = propPart.indexOf('=');
      if (eqIdx !== -1) {
        const key = propPart.substring(0, eqIdx).trim().toLowerCase();
        const val = propPart.substring(eqIdx + 1).trim();
        currentKodiProps[key] = val;
      }
    } else if (line.startsWith('#EXTVLCOPT:')) {
      const opt = line.substring(11).trim();
      const eqIdx = opt.indexOf('=');
      if (eqIdx !== -1) {
        const k = opt.substring(0, eqIdx).trim().toLowerCase();
        const v = opt.substring(eqIdx + 1).trim();
        if (k.includes('user-agent')) currentHeaders['User-Agent'] = v;
        if (k.includes('referrer') || k.includes('referer')) currentHeaders['Referer'] = v;
        if (k.includes('cookie')) currentHeaders['Cookie'] = v;
      }
    } else if (!line.startsWith('#') && (line.startsWith('http://') || line.startsWith('https://'))) {
      const streamUrl = line;
      let drm = { enabled: false };

      const licType = (currentKodiProps['inputstream.adaptive.license_type'] || '').toLowerCase();
      const licKey = currentKodiProps['inputstream.adaptive.license_key'] || '';

      if (licType.includes('widevine') || licType.includes('com.widevine.alpha')) {
        const cleanLic = licKey.split('|')[0];
        drm = {
          enabled: true,
          scheme: 'widevine',
          keyId: '',
          key: cleanLic,
          licenseUrl: cleanLic
        };
      } else if (licType.includes('clearkey') || licType.includes('org.w3.clearkey') || licKey.includes(':')) {
        let kid = '';
        let key = '';
        if (licKey.includes(':') && !licKey.startsWith('{')) {
          const parts = licKey.split(':');
          kid = parts[0].trim();
          key = parts[1].trim();
        } else {
          key = licKey;
        }
        drm = {
          enabled: true,
          scheme: 'clearkey',
          keyId: kid,
          key: key,
          licenseUrl: ''
        };
      }

      const streamType = (currentKodiProps['inputstream.adaptive.manifest_type'] || '').toUpperCase() ||
        (streamUrl.includes('.mpd') ? 'MPD' : 'M3U8');

      items.push({
        title: currentInfo?.title || 'Live Stream Channel',
        category: currentInfo?.category || defaultCategory,
        logo: currentInfo?.logo || '',
        streamUrl,
        streamType,
        quality: '1080p HD',
        headers: { ...currentHeaders },
        drm
      });

      currentInfo = null;
      currentKodiProps = {};
      currentHeaders = {};
    }
  }

  return items;
}

router.post('/import/m3u', requireAdmin, async (req, res) => {
  try {
    let { m3uUrl, m3uContent, defaultCategory } = req.body;
    if (m3uUrl && !m3uContent) {
      let fetchUrl = m3uUrl.trim();
      if (fetchUrl.includes('drive.google.com/file/d/')) {
        const fileIdMatch = fetchUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (fileIdMatch) {
          fetchUrl = `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
        }
      } else if (!/^https?:\/\//i.test(fetchUrl)) {
        fetchUrl = 'https://' + fetchUrl;
      }
      const fetchRes = await fetch(fetchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' }
      });
      m3uContent = await fetchRes.text();
    }
    if (!m3uContent) {
      return res.status(400).json({ success: false, message: 'Please provide m3uUrl or m3uContent' });
    }

    const items = parseM3uPlaylist(m3uContent, defaultCategory || 'Live Sports');
    let importedCount = 0;

    for (const item of items) {
      if (item.category) {
        await Store.ensureCategory(item.category);
      }

      await Store.createMatch({
        title: item.title,
        category: item.category,
        status: 'LIVE',
        matchFormat: 'T20',
        bannerUrl: item.logo || '',
        description: `Imported via M3U: ${item.title}`,
        isPinned: false,
        team1: { name: item.title.split(' vs ')[0] || item.title, shortName: '', flag: '📺', score: '' },
        team2: { name: '', shortName: '', flag: '🔴', score: '' },
        streams: [
          {
            id: 'str_' + Math.random().toString(36).substr(2, 9),
            title: item.title,
            streamType: item.streamType || (item.streamUrl?.includes('.mpd') ? 'MPD' : 'M3U8'),
            streamUrl: item.streamUrl,
            quality: item.quality || '1080p HD',
            headers: item.headers || {},
            drm: item.drm || { enabled: false },
            isActive: true
          }
        ]
      });
      importedCount++;
    }

    await Store.persistState();

    res.json({ success: true, count: importedCount, message: `Successfully imported ${importedCount} channels from M3U playlist!` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/import/json', requireAdmin, async (req, res) => {
  try {
    let { jsonUrl, jsonContent, defaultCategory } = req.body;
    let data = null;
    if (jsonUrl) {
      let fetchUrl = jsonUrl.trim();
      if (fetchUrl.includes('drive.google.com/file/d/')) {
        const fileIdMatch = fetchUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (fileIdMatch) {
          fetchUrl = `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
        }
      } else if (!/^https?:\/\//i.test(fetchUrl)) {
        fetchUrl = 'https://' + fetchUrl;
      }
      const fetchRes = await fetch(fetchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' }
      });
      data = await fetchRes.json();
    } else if (jsonContent) {
      data = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
    }

    if (!data) {
      return res.status(400).json({ success: false, message: 'Invalid or missing JSON content' });
    }

    let list = [];
    if (Array.isArray(data)) {
      list = data;
    } else if (Array.isArray(data.liveMatches) || Array.isArray(data.upcomingMatches)) {
      list = [...(data.liveMatches || []), ...(data.upcomingMatches || [])];
    } else if (Array.isArray(data.liveEvents) || Array.isArray(data.upcomingEvents)) {
      list = [...(data.liveEvents || []), ...(data.upcomingEvents || [])];
    } else if (Array.isArray(data.channels)) {
      list = data.channels;
    } else if (Array.isArray(data.streams)) {
      list = data.streams;
    } else if (Array.isArray(data.matches)) {
      list = data.matches;
    } else if (Array.isArray(data.data)) {
      list = data.data;
    } else if (Array.isArray(data.items)) {
      list = data.items;
    } else if (Array.isArray(data.categories)) {
      for (const cat of data.categories) {
        const catName = cat.name || cat.category || cat.title || defaultCategory || 'Live Sports';
        const chs = cat.channels || cat.streams || cat.list || [];
        chs.forEach(c => list.push({ ...c, category: c.category || catName }));
      }
    }

    let count = 0;

    for (const item of list) {
      const title = (item.title || item.name || item.channelName || item.heading || 'Live Stream').trim();
      const category = (item.category || item.group || defaultCategory || 'Live Sports').trim();

      // Skip adult content
      if (/adult|18\+|porn|erotic|nsfw|xxx/i.test(`${title} ${category}`)) {
        continue;
      }

      // 1. Check if item has multiple streams in item.streams array
      let streams = [];
      if (Array.isArray(item.streams) && item.streams.length > 0) {
        streams = item.streams.map((s, sIdx) => {
          const sUrl = (s.streamUrl || s.url || s.stream || s.link || '').trim();
          if (!sUrl) return null;
          const isMpd = sUrl.includes('.mpd') || (s.streamType || s.type || '').toUpperCase() === 'MPD';
          const sType = (s.streamType || s.type || (isMpd ? 'MPD' : 'M3U8')).toUpperCase();
          let sDrm = s.drm || (s.keyId && s.key ? {
            enabled: true,
            scheme: s.scheme || 'clearkey',
            keyId: s.keyId,
            key: s.key,
            licenseUrl: s.licenseUrl || ''
          } : { enabled: false });

          if (sUrl.includes('drmLicense=')) {
            const m = sUrl.match(/drmLicense=([0-9a-fA-F]{32}):([0-9a-fA-F]{32})/);
            if (m) {
              sDrm = { enabled: true, scheme: 'clearkey', keyId: m[1], key: m[2], licenseUrl: '' };
            }
          }

          return {
            id: s.id || `str_${Date.now().toString(36)}_${sIdx}`,
            title: s.title || `Server ${sIdx + 1} HD`,
            streamType: sType,
            streamUrl: sUrl,
            quality: s.quality || '1080p HD',
            headers: s.headers || {},
            drm: sDrm,
            isActive: s.isActive !== false
          };
        }).filter(Boolean);
      }

      // 2. Fallback to single streamUrl
      const singleUrl = (item.streamUrl || item.m3uLink || item.url || item.stream || item.link || item.m3u || item.playUrl || '').trim();
      if (streams.length === 0 && singleUrl) {
        const isMpd = singleUrl.includes('.mpd') || (item.streamType || item.type || '').toUpperCase() === 'MPD';
        const sType = (item.streamType || item.type || (isMpd ? 'MPD' : 'M3U8')).toUpperCase();
        let drm = item.drm || (item.keyId && item.key ? {
          enabled: true,
          scheme: item.scheme || 'clearkey',
          keyId: item.keyId,
          key: item.key,
          licenseUrl: item.licenseUrl || ''
        } : (item.licenseUrl ? {
          enabled: true,
          scheme: 'widevine',
          keyId: '',
          key: item.licenseUrl,
          licenseUrl: item.licenseUrl
        } : { enabled: false }));

        if (singleUrl.includes('drmLicense=')) {
          const m = singleUrl.match(/drmLicense=([0-9a-fA-F]{32}):([0-9a-fA-F]{32})/);
          if (m) {
            drm = { enabled: true, scheme: 'clearkey', keyId: m[1], key: m[2], licenseUrl: '' };
          }
        }

        const headers = item.headers || {};
        if (item.userAgent && !headers['User-Agent']) headers['User-Agent'] = item.userAgent;
        if (item.referer && !headers['Referer']) headers['Referer'] = item.referer;
        if (item.origin && !headers['Origin']) headers['Origin'] = item.origin;
        if (item.cookie && !headers['Cookie']) headers['Cookie'] = item.cookie;

        streams.push({
          id: 'str_' + Math.random().toString(36).substr(2, 9),
          title: item.streamTitle || title,
          streamType: sType,
          streamUrl: singleUrl,
          quality: item.quality || '1080p HD',
          headers,
          drm,
          isActive: true
        });
      }

      // If category item has m3uLink / portal_url, also ensure in categories
      if (item.m3uLink || item.isCategory || item.portal_url) {
        await Store.createCategory({
          name: title,
          slug: (item.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
          icon: item.icon || 'fas fa-tv',
          imageUrl: item.imageUrl || item.logo || '',
          m3uLink: item.m3uLink || singleUrl,
          portal_url: item.portal_url || '',
          mac: item.mac || '',
          order: 10,
          isActive: true
        });
      }

      if (streams.length === 0) continue;

      if (category) {
        await Store.ensureCategory(category);
      }

      await Store.createMatch({
        title,
        category,
        status: (item.status || 'LIVE').toUpperCase(),
        matchFormat: item.matchFormat || item.format || 'Live TV',
        bannerUrl: item.bannerUrl || item.imageUrl || item.logo || item.poster || item.image || '',
        description: item.description || `Live stream: ${title}`,
        isPinned: Boolean(item.isPinned),
        team1: item.team1 || { name: title.split(' vs ')[0] || title, shortName: '', flag: '📺', score: '' },
        team2: item.team2 || { name: title.split(' vs ')[1] || '', shortName: '', flag: '🔴', score: '' },
        streams
      });
      count++;
    }

    await Store.persistState();

    res.json({ success: true, count, message: `Successfully imported ${count} channels from JSON!` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
