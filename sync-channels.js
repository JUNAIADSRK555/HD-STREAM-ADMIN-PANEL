require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');
const Category = require('./models/Category');

const GDRIVE_JSON_URL = "https://drive.google.com/uc?export=download&id=1KxcfPpIjkeRaHWyrN53otPBci5s6FMMO";

function parseM3u(content, defaultCat, defaultLogo, maxLimit = 500) {
  const lines = content.split(/\r?\n/);
  const items = [];
  let currentTitle = null;
  let currentLogo = defaultLogo || '';
  let currentUa = '';
  let currentRef = '';
  let currentCookie = '';
  let currentKodiProps = {};

  for (let i = 0; i < lines.length; i++) {
    if (items.length >= maxLimit) break;
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      const commaIdx = line.lastIndexOf(',');
      currentTitle = commaIdx !== -1 ? line.substring(commaIdx + 1).trim() : 'Live Stream';
      const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
      if (logoMatch && logoMatch[1]) {
        currentLogo = logoMatch[1];
      }
      const uaMatch = line.match(/http-user-agent="([^"]+)"/i);
      if (uaMatch) currentUa = uaMatch[1];
      const refMatch = line.match(/http-referrer="([^"]+)"/i);
      if (refMatch) currentRef = refMatch[1];
    } else if (line.startsWith('#KODIPROP:')) {
      const propPart = line.substring(10).trim();
      const eqIdx = propPart.indexOf('=');
      if (eqIdx !== -1) {
        const k = propPart.substring(0, eqIdx).trim().toLowerCase();
        const v = propPart.substring(eqIdx + 1).trim();
        currentKodiProps[k] = v;
      }
    } else if (line.startsWith('#EXTVLCOPT:')) {
      const opt = line.substring(11).trim();
      const eqIdx = opt.indexOf('=');
      if (eqIdx !== -1) {
        const k = opt.substring(0, eqIdx).trim().toLowerCase();
        const v = opt.substring(eqIdx + 1).trim();
        if (k.includes('user-agent')) currentUa = v;
        if (k.includes('referrer') || k.includes('referer')) currentRef = v;
        if (k.includes('cookie')) currentCookie = v;
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

      const headers = {};
      if (currentUa) headers['User-Agent'] = currentUa;
      if (currentRef) headers['Referer'] = currentRef;
      if (currentCookie) headers['Cookie'] = currentCookie;

      const title = currentTitle || `${defaultCat} Channel`;
      items.push({
        title,
        category: defaultCat,
        status: 'LIVE',
        matchFormat: 'HD',
        bannerUrl: currentLogo || defaultLogo || '',
        description: `${defaultCat} Live: ${title}`,
        isPinned: false,
        team1: { name: title.split(' vs ')[0] || title, shortName: '', flag: '📺', score: '' },
        team2: { name: title.split(' vs ')[1] || '', shortName: '', flag: '🔴', score: '' },
        streams: [
          {
            id: 'str_' + Math.random().toString(36).substr(2, 9),
            title: title,
            streamType: streamUrl.includes('.mpd') ? 'MPD' : 'M3U8',
            streamUrl,
            quality: '1080p HD',
            headers,
            drm,
            isActive: true
          }
        ]
      });

      currentTitle = null;
      currentLogo = defaultLogo || '';
      currentUa = '';
      currentRef = '';
      currentCookie = '';
      currentKodiProps = {};
    }
  }

  return items;
}

async function run() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected successfully!");

  console.log("Fetching Google Drive categories file...");
  const res = await fetch(GDRIVE_JSON_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  const sources = await res.json();
  console.log(`Found ${sources.length} sources in JSON.`);

  // 1. Sync Categories collection (only the 10 user categories)
  console.log("Syncing categories in database...");
  const userCatNames = [...new Set(sources.map(s => s.title.trim()))];
  // Remove any obsolete categories not in Google Drive
  await Category.deleteMany({ name: { $nin: userCatNames } });
  
  let orderIndex = 1;
  for (const catName of userCatNames) {
    const slug = catName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    await Category.findOneAndUpdate(
      { name: catName },
      { name: catName, slug, icon: 'fas fa-tv', order: orderIndex++, isActive: true },
      { upsert: true, new: true }
    );
  }
  console.log(`Ensured ${userCatNames.length} categories exist.`);

  // 2. Clear old matches
  console.log("Clearing old matches...");
  const deleteResult = await Match.deleteMany({});
  console.log(`Deleted ${deleteResult.deletedCount} existing matches.`);

  // 3. Process each category
  const allMatches = [];

  for (const s of sources) {
    const catName = s.title.trim();
    const logo = s.imageUrl || '';
    const m3uUrl = s.m3uLink ? s.m3uLink.trim() : '';

    console.log(`\nFetching M3U for Category: "${catName}"...`);
    let playlistText = '';
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      let fetchUrl = m3uUrl;
      if (fetchUrl.includes('drive.google.com/file/d/')) {
        const fileIdMatch = fetchUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (fileIdMatch) {
          fetchUrl = `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
        }
      }
      const resp = await fetch(fetchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        redirect: 'follow',
        signal: controller.signal
      });
      clearTimeout(timer);
      if (resp.ok) {
        playlistText = await resp.text();
      } else {
        console.warn(`  Failed with HTTP status ${resp.status}`);
      }
    } catch (e) {
      console.warn(`  Fetch error: ${e.message}`);
    }

    // Limit large dumps to 150 channels so API is lightning fast
    const maxLimit = (catName === 'MIX TV' || catName === 'JIO TV+') ? 150 : 500;

    if (playlistText && (playlistText.includes('#EXTM3U') || playlistText.includes('#EXTINF') || playlistText.includes('http'))) {
      const items = parseM3u(playlistText, catName, logo, maxLimit);
      console.log(`  -> Parsed ${items.length} channels for "${catName}"`);
      if (items.length > 0) {
        allMatches.push(...items);
        continue;
      }
    }

    // Fallback: 1 main channel
    console.log(`  -> Adding 1 default fallback channel for "${catName}"`);
    allMatches.push({
      title: catName,
      category: catName,
      status: 'LIVE',
      matchFormat: 'HD',
      bannerUrl: logo,
      description: `Live Stream: ${catName}`,
      isPinned: false,
      team1: { name: catName, shortName: '', flag: '📺', score: '' },
      team2: { name: '', shortName: '', flag: '🔴', score: '' },
      streams: [
        {
          id: 'str_' + Math.random().toString(36).substr(2, 9),
          title: `${catName} - Live`,
          streamType: m3uUrl.includes('.mpd') ? 'MPD' : 'M3U8',
          streamUrl: m3uUrl,
          quality: '1080p HD',
          headers: {},
          drm: { enabled: false },
          isActive: true
        }
      ]
    });
  }

  console.log(`\nTotal channels to insert across all categories: ${allMatches.length}`);

  // Insert in chunks of 500
  const chunkSize = 500;
  for (let i = 0; i < allMatches.length; i += chunkSize) {
    const chunk = allMatches.slice(i, i + chunkSize);
    await Match.insertMany(chunk, { ordered: false });
    console.log(`Inserted chunk ${i + 1} - ${Math.min(i + chunkSize, allMatches.length)}`);
  }

  console.log("\nChannel Summary by Category:");
  const summary = await Match.aggregate([
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  console.table(summary);

  await mongoose.disconnect();
  console.log("\nDone! Sync complete.");
}

run().catch(err => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
