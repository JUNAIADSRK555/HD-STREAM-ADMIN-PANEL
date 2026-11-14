require('dotenv').config();
const fs = require('fs');
const path = require('path');

/**
 * Normalizes any Google Drive link to direct download URL:
 * - https://drive.google.com/file/d/FILE_ID/view... -> https://drive.google.com/uc?export=download&id=FILE_ID
 * - https://drive.google.com/open?id=FILE_ID -> https://drive.google.com/uc?export=download&id=FILE_ID
 * - https://drive.google.com/uc?export=download&id=FILE_ID -> direct URL
 * - Raw FILE_ID -> https://drive.google.com/uc?export=download&id=FILE_ID
 */
function normalizeGoogleDriveUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();

  // Pattern: /file/d/FILE_ID/...
  const fileIdMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (fileIdMatch && fileIdMatch[1]) {
    return `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
  }

  // Pattern: id=FILE_ID
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/i);
  if (idParamMatch && idParamMatch[1]) {
    return `https://drive.google.com/uc?export=download&id=${idParamMatch[1]}`;
  }

  // Pattern: bare alphanumeric ID (length between 20 and 60 chars)
  if (/^[a-zA-Z0-9_-]{20,60}$/.test(trimmed)) {
    return `https://drive.google.com/uc?export=download&id=${trimmed}`;
  }

  return trimmed;
}

/**
 * Fetch raw content from Google Drive with follow redirects
 * Handles potential Google Drive virus scan warning for larger files
 */
async function fetchGoogleDriveContent(driveUrl) {
  const directUrl = normalizeGoogleDriveUrl(driveUrl);
  if (!directUrl || !directUrl.startsWith('http')) {
    throw new Error(`Invalid Google Drive URL: "${driveUrl}"`);
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*'
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

  let res;
  try {
    res = await fetch(directUrl, {
      redirect: 'follow',
      headers,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    throw new Error(`Google Drive HTTP error: ${res.status} ${res.statusText}`);
  }

  let text = await res.text();

  // Handle Google Drive large file confirmation interstitial
  if (text.includes('uc-download-link') || (text.includes('confirm=') && text.includes('drive.google.com'))) {
    const confirmMatch = text.match(/href="(\/uc\?export=download[^"]+confirm=([^"&]+)[^"]*)"/i) ||
                         text.match(/href="([^"]+confirm=([^"&]+)[^"]*)"/i);
    if (confirmMatch) {
      let confirmUrl = confirmMatch[1].replace(/&amp;/g, '&');
      if (confirmUrl.startsWith('/')) {
        confirmUrl = 'https://drive.google.com' + confirmUrl;
      }
      const cRes = await fetch(confirmUrl, { redirect: 'follow', headers });
      if (cRes.ok) {
        text = await cRes.text();
      }
    }
  }

  return text;
}

/**
 * Validates raw content: Ensures it is not empty, not an HTML login page,
 * and not a private permission-denied document.
 */
function validateRawContent(rawText) {
  if (!rawText || !rawText.trim()) {
    throw new Error('Google Drive returned empty content.');
  }

  const trimmed = rawText.trim();

  // Check for HTML / Private Login / Permission Gate
  const isHtml = trimmed.startsWith('<!DOCTYPE html') ||
                 trimmed.startsWith('<html') ||
                 trimmed.startsWith('<!--') ||
                 /accounts\.google\.com/i.test(trimmed) ||
                 /ServiceLogin/i.test(trimmed) ||
                 /Sign in - Google Accounts/i.test(trimmed) ||
                 /You need access/i.test(trimmed) ||
                 /Request access/i.test(trimmed) ||
                 /Sign in to continue/i.test(trimmed);

  if (isHtml) {
    throw new Error('Google Drive link is private or requires Google login (HTML page returned instead of playlist). File permission must be set to "Anyone with the link can view".');
  }

  return trimmed;
}

/**
 * Parses either:
 * - A Category List (JSON array with category objects containing m3uLink / portal_url / title)
 * - OR a Channels Playlist (JSON array with streamUrl/drm or M3U/M3U8)
 * Returns { type: 'categories' | 'channels', data: [...] }
 */
function parseDrivePayload(content) {
  const trimmed = content.trim();

  // --- 1. Try JSON Format ---
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);

      // Check if it's a CATEGORY LIST
      const isArrayOfCategories = Array.isArray(parsed) && parsed.length > 0 &&
        parsed.some(item => item && (item.m3uLink || item.portal_url || item.mac || (item.title && !item.streamUrl && !item.stream_url)));

      if (isArrayOfCategories) {
        const cleanCategories = parsed
          .filter(c => {
            if (!c || typeof c !== 'object') return false;
            const title = String(c.title || c.name || '').trim();
            const slug = String(c.slug || '').trim();
            const combined = `${title} ${slug}`.toLowerCase();
            return !/adult|18\+|porn|erotic|nsfw|xxx|brazzers|playboy|sensual/i.test(combined);
          })
          .map((c, idx) => {
            const title = String(c.title || c.name || `Category ${idx + 1}`).trim();
            const slug = String(c.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-')).replace(/^-+|-+$/g, '');
            let m3uLink = String(c.m3uLink || c.url || '').trim();
            let portal_url = String(c.portal_url || '').trim();
            if (!portal_url && m3uLink.includes('stalker_portal')) {
              portal_url = m3uLink;
            }
            const img = String(c.imageUrl || c.image || c.logo || '').trim();

            const cat = {
              id: String(c.id || `gcat_${idx + 1}`).trim(),
              name: title,
              slug: slug || `cat-${idx + 1}`,
              icon: String(c.icon || (img ? img : 'fas fa-tv')).trim(),
              imageUrl: img,
              m3uLink,
              portal_url,
              mac: String(c.mac || '').trim()
            };

            if (c.tariff_plan) cat.tariff_plan = String(c.tariff_plan);
            if (c.adult_pass) cat.adult_pass = String(c.adult_pass);
            if (c.max_conn) cat.max_conn = String(c.max_conn);
            if (c.serial_cut) cat.serial_cut = String(c.serial_cut);
            if (c.device_id_1) cat.device_id_1 = String(c.device_id_1);
            if (c.device_id_2) cat.device_id_2 = String(c.device_id_2);

            return cat;
          });

        if (cleanCategories.length === 0) {
          throw new Error('Categories list contains 0 valid items after filtering.');
        }

        // Ensure JIO TV+ is present so the 1,177 core channels remain accessible
        const hasJioTv = cleanCategories.some(c => c.slug === 'jio-tv' || c.name === 'JIO TV+');
        if (!hasJioTv) {
          cleanCategories.unshift({
            id: 'gcat_1',
            name: 'JIO TV+',
            slug: 'jio-tv',
            icon: 'fas fa-tv',
            imageUrl: 'https://raw.githubusercontent.com/JUNAIADSRK555/HD-STREAM-ADMIN-PANEL/main/public/logos/jiotv.png',
            m3uLink: 'https://raw.githubusercontent.com/JUNAIADSRK555/HD-STREAM-ADMIN-PANEL/main/public/tv/data.json'
          });
        }

        return {
          type: 'categories',
          data: cleanCategories
        };
      }

      // Check if it's a CHANNELS LIST
      const rawChannels = Array.isArray(parsed)
        ? parsed
        : (Array.isArray(parsed.channels) ? parsed.channels : null);

      if (rawChannels && rawChannels.length > 0) {
        const validChannels = rawChannels.map((ch, idx) => {
          const streamUrl = (ch.streamUrl || ch.url || ch.link || ch.stream_url || '').trim();
          if (!streamUrl || !streamUrl.startsWith('http')) return null;

          const name = String(ch.name || ch.title || `Channel ${idx + 1}`).trim();
          const id = String(ch.id || `ch_${idx + 1}`).trim();
          const category = String(ch.category || ch.group || 'Live TV').trim();
          const logo = String(ch.logo || ch.imageUrl || ch.tvgLogo || ch.icon || '').trim();
          const cookie = String(ch.cookie || ch.headers?.Cookie || ch.headers?.cookie || '').trim();

          let drm = { type: 'none', keyId: '', key: '' };
          if (ch.drm && typeof ch.drm === 'object') {
            drm = {
              type: ch.drm.type || ch.drm.scheme || 'clearkey',
              keyId: String(ch.drm.keyId || ch.drm.key_id || '').trim(),
              key: String(ch.drm.key || '').trim()
            };
          } else if (ch.license_key && typeof ch.license_key === 'string' && ch.license_key.includes(':')) {
            const parts = ch.license_key.split(':');
            drm = {
              type: 'clearkey',
              keyId: parts[0].trim(),
              key: parts[1].trim()
            };
          }

          return {
            id,
            name,
            category,
            logo,
            background: logo,
            status: String(ch.status || 'Live').trim(),
            streamType: String(ch.streamType || (streamUrl.includes('.mpd') ? 'dash-cookies' : 'hls')).trim(),
            streamUrl,
            cookie,
            drm
          };
        }).filter(Boolean);

        if (validChannels.length > 0) {
          return {
            type: 'channels',
            data: validChannels
          };
        }
      }
    } catch (e) {
      if (trimmed.startsWith('{')) {
        throw new Error(`JSON parsing failed: ${e.message}`);
      }
    }
  }

  // --- 2. Try M3U / M3U8 Format ---
  if (trimmed.includes('#EXTM3U') || trimmed.includes('#EXTINF:')) {
    const lines = trimmed.split(/\r?\n/);
    const channels = [];

    let currentTitle = '';
    let currentId = '';
    let currentCategory = 'Live TV';
    let currentLogo = '';
    let currentCookie = '';
    let currentKeyId = '';
    let currentKey = '';
    let currentDrmType = 'none';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith('#EXTINF:')) {
        const commaIdx = line.lastIndexOf(',');
        currentTitle = commaIdx !== -1 ? line.substring(commaIdx + 1).trim() : 'Live Stream';

        const idMatch = line.match(/tvg-id="([^"]+)"/i);
        currentId = idMatch ? idMatch[1].trim() : '';

        const nameMatch = line.match(/tvg-name="([^"]+)"/i);
        if (nameMatch && !currentTitle) currentTitle = nameMatch[1].trim();

        const groupMatch = line.match(/group-title="([^"]+)"/i);
        currentCategory = groupMatch ? groupMatch[1].trim() : 'Live TV';

        const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
        currentLogo = logoMatch ? logoMatch[1].trim() : '';
      } else if (line.startsWith('#KODIPROP:')) {
        const prop = line.substring(10).trim();
        const eqIdx = prop.indexOf('=');
        if (eqIdx !== -1) {
          const k = prop.substring(0, eqIdx).trim().toLowerCase();
          const v = prop.substring(eqIdx + 1).trim();
          if (k.includes('license_type')) {
            currentDrmType = v.toLowerCase().includes('widevine') ? 'widevine' : 'clearkey';
          }
          if (k.includes('license_key')) {
            if (v.includes(':') && !v.startsWith('http')) {
              const parts = v.split(':');
              currentKeyId = parts[0].trim();
              currentKey = parts[1].trim();
              currentDrmType = 'clearkey';
            } else {
              currentKey = v;
            }
          }
        }
      } else if (line.startsWith('#EXTHTTP:')) {
        try {
          const jsonPart = line.substring(9).trim();
          const parsed = JSON.parse(jsonPart);
          if (parsed.cookie) currentCookie = parsed.cookie;
        } catch (_) {}
      } else if (line.startsWith('#EXTVLCOPT:')) {
        const opt = line.substring(11).trim();
        if (opt.toLowerCase().startsWith('cookie=')) {
          currentCookie = opt.substring(7).trim();
        }
      } else if (!line.startsWith('#') && (line.startsWith('http://') || line.startsWith('https://'))) {
        const streamUrl = line.trim();
        const chId = currentId || `ch_${channels.length + 1}`;
        const streamType = streamUrl.includes('.mpd') ? 'dash-cookies' : 'hls';

        channels.push({
          id: chId,
          name: currentTitle || `Channel ${channels.length + 1}`,
          category: currentCategory || 'Live TV',
          logo: currentLogo,
          background: currentLogo,
          status: 'Live',
          streamType,
          streamUrl,
          cookie: currentCookie,
          drm: {
            type: currentDrmType,
            keyId: currentKeyId,
            key: currentKey
          }
        });

        // Reset per-channel temp state
        currentTitle = '';
        currentId = '';
        currentCategory = 'Live TV';
        currentLogo = '';
        currentCookie = '';
        currentKeyId = '';
        currentKey = '';
        currentDrmType = 'none';
      }
    }

    if (channels.length === 0) {
      throw new Error('M3U playlist found but 0 valid channel stream URLs could be extracted.');
    }

    return {
      type: 'channels',
      data: channels
    };
  }

  throw new Error('Unsupported playlist format: Content is neither a valid Categories JSON, Channels JSON, nor M3U/M3U8.');
}

// Backwards compatibility alias
function parsePlaylist(content) {
  const result = parseDrivePayload(content);
  return result.data;
}

/**
 * Main auto-sync function.
 * Fetches playlist/categories from Google Drive, validates, parses, and safely updates either
 * data/categories.json or public/tv/data.json depending on the payload type.
 */
async function syncDrivePlaylist(customUrl = null) {
  const driveUrl = customUrl || process.env.GOOGLE_DRIVE_PLAYLIST_URL;

  if (!driveUrl || !driveUrl.trim()) {
    console.log('[Drive Sync] GOOGLE_DRIVE_PLAYLIST_URL is not configured in .env. Skipping sync.');
    return { success: false, message: 'GOOGLE_DRIVE_PLAYLIST_URL not set' };
  }

  // Placeholder check
  if (driveUrl.includes('YOUR_GOOGLE_DRIVE_FILE_ID')) {
    console.log('[Drive Sync] GOOGLE_DRIVE_PLAYLIST_URL is set to placeholder. Please specify a real Google Drive file ID.');
    return { success: false, message: 'Placeholder file ID configured' };
  }

  console.log(`[Drive Sync] Starting Google Drive sync...`);
  console.log(`[Drive Sync] Configured URL: ${driveUrl.trim()}`);
  console.log(`[Drive Sync] Direct Download URL: ${normalizeGoogleDriveUrl(driveUrl.trim())}`);

  try {
    const rawContent = await fetchGoogleDriveContent(driveUrl.trim());
    const validatedContent = validateRawContent(rawContent);
    const parsedPayload = parseDrivePayload(validatedContent);

    if (parsedPayload.type === 'categories') {
      const targetPath = path.join(__dirname, 'data', 'categories.json');
      const backupPath = path.join(__dirname, 'data', 'categories.json.bak');

      if (fs.existsSync(targetPath)) {
        try {
          fs.copyFileSync(targetPath, backupPath);
        } catch (_) {}
      }

      fs.writeFileSync(targetPath, JSON.stringify(parsedPayload.data, null, 2), 'utf8');

      console.log(`[Drive Sync SUCCESS] Successfully synced ${parsedPayload.data.length} categories to data/categories.json!`);
      return {
        success: true,
        type: 'categories',
        categoriesCount: parsedPayload.data.length
      };
    } else {
      const targetPath = path.join(__dirname, 'public', 'tv', 'data.json');
      const backupPath = path.join(__dirname, 'public', 'tv', 'data.json.bak');

      if (fs.existsSync(targetPath)) {
        try {
          fs.copyFileSync(targetPath, backupPath);
        } catch (_) {}
      }

      const payload = {
        channels: parsedPayload.data
      };

      fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2), 'utf8');

      console.log(`[Drive Sync SUCCESS] Successfully updated ${parsedPayload.data.length} channels in public/tv/data.json!`);
      return {
        success: true,
        type: 'channels',
        channelsCount: parsedPayload.data.length
      };
    }
  } catch (err) {
    console.error(`[Drive Sync ERROR] Sync rejected: ${err.message}`);
    console.warn(`[Drive Sync SAFEGUARD] Target files preserved untouched.`);
    return {
      success: false,
      error: err.message
    };
  }
}

// Allow direct CLI execution: node sync-drive-playlist.js
if (require.main === module) {
  syncDrivePlaylist().then(result => {
    if (!result.success && result.error) {
      console.error(`[Drive Sync] Process finished with error.`);
      process.exit(1);
    } else {
      console.log(`[Drive Sync] Process finished successfully.`);
      process.exit(0);
    }
  });
}

module.exports = {
  normalizeGoogleDriveUrl,
  fetchGoogleDriveContent,
  validateRawContent,
  parseDrivePayload,
  parsePlaylist,
  syncDrivePlaylist
};
