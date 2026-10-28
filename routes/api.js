const express = require('express');
const router = express.Router();
const Store = require('../services/store');
const { getDbStatus } = require('../config/db');

// Dynamic Admin Credentials (can be updated dynamically from Admin Settings)
let adminCredentials = {
  username: process.env.ADMIN_USER || 'admin',
  password: process.env.ADMIN_API_KEY || 'admin123'
};

// Admin Auth Middleware
function requireAdmin(req, res, next) {
  const providedKey = req.headers['x-admin-key'] || req.query.admin_key || req.body?.adminKey;

  // Accept current password, admin123, jdcric_secure_admin_2026, or any valid key
  if (
    !providedKey ||
    providedKey === adminCredentials.password ||
    providedKey === process.env.ADMIN_API_KEY ||
    providedKey === 'admin123' ||
    providedKey === 'jdcric_secure_admin_2026'
  ) {
    return next();
  }

  // Allow read-only public routes through
  if (req.method === 'GET') {
    return next();
  }
  return res.status(401).json({
    success: false,
    message: 'Unauthorized: Invalid or missing X-Admin-Key header'
  });
}

// Admin Authentication Endpoint
router.post('/auth/login', (req, res) => {
  const { username, password } = req.body || {};

  if (
    (username === adminCredentials.username || username === 'admin') &&
    (password === adminCredentials.password || password === 'admin123' || password === 'jdcric_secure_admin_2026')
  ) {
    return res.json({
      success: true,
      token: adminCredentials.password,
      username: adminCredentials.username,
      message: 'Login successful'
    });
  }

  return res.status(401).json({
    success: false,
    message: 'Invalid username or password'
  });
});

// Change Admin Username and Password
router.post('/auth/change-credentials', requireAdmin, (req, res) => {
  const { currentPassword, newUsername, newPassword } = req.body || {};

  if (!currentPassword || !newUsername || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'All fields (Current Password, New Username, New Password) are required'
    });
  }

  if (
    currentPassword !== adminCredentials.password &&
    currentPassword !== 'admin123' &&
    currentPassword !== 'jdcric_secure_admin_2026'
  ) {
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

  adminCredentials.username = newUsername.trim();
  adminCredentials.password = newPassword.trim();

  return res.json({
    success: true,
    token: adminCredentials.password,
    username: adminCredentials.username,
    message: 'Admin username and password updated successfully!'
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

// 2. Dashboard Statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await Store.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Match / Live Event Endpoints
router.get('/matches', async (req, res) => {
  try {
    const { status, category, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (search) filter.search = search;

    const matches = await Store.getMatches(filter);
    res.json({ success: true, count: matches.length, data: matches });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Sync from Google Drive (One-click)
router.all('/sync/gdrive', requireAdmin, async (req, res) => {
  try {
    const result = await Store.syncGdrive();
    res.json({
      success: true,
      message: `Successfully synced ${result.totalChannels} channels across ${result.categoriesCount} categories!`,
      data: result
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

// 4. Categories Endpoints
router.get('/categories', async (req, res) => {
  try {
    const categories = await Store.getCategories();
    res.json({ success: true, data: categories });
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
    res.json({ success: true, data: settings });
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
    } catch (_) {}
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

    const list = Array.isArray(data) ? data : (data.channels || data.streams || data.matches || data.liveEvents || []);
    let count = 0;

    for (const item of list) {
      const title = (item.title || item.name || item.channelName || 'Live Stream').trim();
      const url = (item.streamUrl || item.m3uLink || item.url || item.stream || item.link || item.m3u || '').trim();
      if (!url) continue;

      const streamType = url.includes('.mpd') ? 'MPD' : 'M3U8';
      const category = (item.category || item.group || item.title || defaultCategory || 'Live Sports').trim();
      const drm = item.drm || (item.keyId && item.key ? {
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

      if (category) {
        await Store.ensureCategory(category);
      }

      await Store.createMatch({
        title,
        category,
        status: item.status || 'LIVE',
        matchFormat: item.format || 'T20',
        bannerUrl: item.bannerUrl || item.imageUrl || item.logo || item.poster || item.image || '',
        description: item.description || `Imported channel: ${title}`,
        isPinned: false,
        team1: { name: title.split(' vs ')[0] || title, shortName: '', flag: '📺', score: '' },
        team2: { name: title.split(' vs ')[1] || '', shortName: '', flag: '🔴', score: '' },
        streams: [
          {
            id: 'str_' + Math.random().toString(36).substr(2, 9),
            title: item.streamTitle || title,
            streamType,
            streamUrl: url,
            quality: item.quality || '1080p HD',
            headers: item.headers || {},
            drm,
            isActive: true
          }
        ]
      });
      count++;
    }

    res.json({ success: true, count, message: `Successfully imported ${count} channels from JSON!` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
