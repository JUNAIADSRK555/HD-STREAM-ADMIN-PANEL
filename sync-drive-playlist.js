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
 * Parses either JSON or M3U/M3U8 playlist into standard channels array
 */
function parsePlaylist(content) {
  const trimmed = content.trim();

  // --- 1. Try JSON Format ---
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      const rawChannels = Array.isArray(parsed)
        ? parsed
        : (Array.isArray(parsed.channels) ? parsed.channels : null);

      if (!rawChannels || rawChannels.length === 0) {
        throw new Error('JSON structure does not contain a non-empty channels array.');
      }

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

      if (validChannels.length === 0) {
        throw new Error('No valid channel stream URLs found in JSON.');
      }

      return validChannels;
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

    return channels;
  }

  throw new Error('Unsupported playlist format: Content is neither valid JSON nor valid M3U/M3U8.');
}

/**
 * Main auto-sync function.
 * Fetches playlist from Google Drive, validates, parses, and safely updates public/tv/data.json.
 * If validation fails for ANY reason, existing public/tv/data.json is kept untouched.
 */
async function syncDrivePlaylist(customUrl = null) {
  const driveUrl = customUrl || process.env.GOOGLE_DRIVE_PLAYLIST_URL;
  const targetPath = path.join(__dirname, 'public', 'tv', 'data.json');

  if (!driveUrl || !driveUrl.trim()) {
    console.log('[Drive Sync] GOOGLE_DRIVE_PLAYLIST_URL is not configured in .env. Skipping sync.');
    return { success: false, message: 'GOOGLE_DRIVE_PLAYLIST_URL not set' };
  }

  // Placeholder check
  if (driveUrl.includes('YOUR_GOOGLE_DRIVE_FILE_ID')) {
    console.log('[Drive Sync] GOOGLE_DRIVE_PLAYLIST_URL is set to placeholder. Please specify a real Google Drive file ID.');
    return { success: false, message: 'Placeholder file ID configured' };
  }

  console.log(`[Drive Sync] Starting Google Drive playlist sync...`);
  console.log(`[Drive Sync] Configured URL: ${driveUrl.trim()}`);
  console.log(`[Drive Sync] Direct Download URL: ${normalizeGoogleDriveUrl(driveUrl.trim())}`);

  try {
    const rawContent = await fetchGoogleDriveContent(driveUrl.trim());
    const validatedContent = validateRawContent(rawContent);
    const parsedChannels = parsePlaylist(validatedContent);

    if (!Array.isArray(parsedChannels) || parsedChannels.length === 0) {
      throw new Error('Zero valid channels parsed from playlist.');
    }

    // Prepare backup of existing file if present
    if (fs.existsSync(targetPath)) {
      try {
        const backupPath = path.join(__dirname, 'public', 'tv', 'data.json.bak');
        fs.copyFileSync(targetPath, backupPath);
      } catch (_) {}
    }

    const payload = {
      channels: parsedChannels
    };

    fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2), 'utf8');

    console.log(`[Drive Sync SUCCESS] Successfully updated ${parsedChannels.length} channels in public/tv/data.json!`);
    return {
      success: true,
      channelsCount: parsedChannels.length
    };
  } catch (err) {
    console.error(`[Drive Sync ERROR] Sync rejected: ${err.message}`);
    console.warn(`[Drive Sync SAFEGUARD] Existing public/tv/data.json was preserved untouched.`);
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
  parsePlaylist,
  syncDrivePlaylist
};

