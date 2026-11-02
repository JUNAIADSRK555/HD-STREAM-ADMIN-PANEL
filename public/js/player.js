// In-Admin Video Stream Preview Controller (Supports HLS, MP4 & DASH MPD with ClearKey DRM)
let hlsInstance = null;
let shakaPlayerInstance = null;

function initPlayer() {
  const video = document.getElementById('admin-video-player');
  if (!video) return;

  if (window.shaka) {
    try {
      shaka.polyfill.installAll();
    } catch (_) {}
  }

  video.addEventListener('playing', () => {
    logPlayerStatus(`🟢 Playing: ${video.videoWidth}x${video.videoHeight} (ReadyState: ${video.readyState})`);
  });

  video.addEventListener('error', (e) => {
    const err = video.error ? `${video.error.code} - ${video.error.message}` : 'Unknown';
    logPlayerStatus(`❌ Video Error: ${err}`);
  });

  video.addEventListener('waiting', () => {
    logPlayerStatus(`⏳ Buffering live stream...`);
  });
}

async function playStreamUrl(rawStreamUrl, streamType = 'M3U8', drmConfig = null) {
  const video = document.getElementById('admin-video-player');
  const input = document.getElementById('stream-test-input');
  if (!video || !rawStreamUrl) return;

  // Gracefully handle piped stream links: https://example.com/master.m3u8|User-Agent=...
  let streamUrl = String(rawStreamUrl).trim();
  let pipeHeaders = {};
  if (streamUrl.includes('|')) {
    const parts = streamUrl.split('|');
    streamUrl = parts[0].trim();
  }

  // Auto-prefix https:// if protocol is missing
  if (!/^([a-z0-9+.-]+:)?\/\//i.test(streamUrl) && !streamUrl.startsWith('data:') && !streamUrl.startsWith('blob:')) {
    streamUrl = 'https://' + streamUrl;
  }

  if (input) input.value = streamUrl;

  logPlayerStatus(`🔄 Loading stream: ${streamUrl} (${streamType})`);

  // Destroy previous HLS instance if any
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }

  // Destroy previous Shaka Player instance if any
  if (shakaPlayerInstance) {
    try {
      await shakaPlayerInstance.destroy();
    } catch (_) {}
    shakaPlayerInstance = null;
  }

  const isMpd = streamUrl.toLowerCase().includes('.mpd') ||
                streamUrl.toLowerCase().includes('/dash/') ||
                String(streamType).toUpperCase() === 'MPD' ||
                String(streamType).toUpperCase() === 'DASH';

  const isHls = streamUrl.toLowerCase().includes('.m3u8') ||
                streamUrl.toLowerCase().includes('.ts') ||
                String(streamType).toUpperCase() === 'M3U8' ||
                String(streamType).toUpperCase() === 'HLS';

  // 1. DASH MPD + ClearKey DRM Playback via Shaka Player
  if (isMpd && window.shaka && shaka.Player.isBrowserSupported()) {
    try {
      shakaPlayerInstance = new shaka.Player(video);
      shakaPlayerInstance.addEventListener('error', (event) => {
        logPlayerStatus(`❌ Shaka DRM Error: ${event.detail?.message || 'Decryption/Manifest error'}`);
      });

      // ClearKey DRM Configuration (Multi-Key Support & KID:Key Parsing)
      let clearKeysObj = {};
      const parseKeyPairs = (str) => {
        if (!str) return;
        str.split(',').forEach(pair => {
          const parts = pair.split(':');
          if (parts.length >= 2) {
            const kid = parts[0].trim().replace(/[^0-9a-fA-F]/g, '').toLowerCase();
            const key = parts[1].trim().replace(/[^0-9a-fA-F]/g, '').toLowerCase();
            if (kid && key) clearKeysObj[kid] = key;
          }
        });
      };

      if (typeof drmConfig === 'string') {
        parseKeyPairs(drmConfig);
      } else if (drmConfig && typeof drmConfig === 'object') {
        if (drmConfig.licenseUrl) parseKeyPairs(drmConfig.licenseUrl);
        if (drmConfig.keyId && drmConfig.key) {
          const kid = drmConfig.keyId.trim().replace(/[^0-9a-fA-F]/g, '').toLowerCase();
          const key = drmConfig.key.trim().replace(/[^0-9a-fA-F]/g, '').toLowerCase();
          if (kid && key) clearKeysObj[kid] = key;
        }
      }

      if (Object.keys(clearKeysObj).length > 0) {
        logPlayerStatus(`🔑 ClearKey Applied: ${Object.keys(clearKeysObj).length} key(s) configured`);
        shakaPlayerInstance.configure({
          drm: {
            clearKeys: clearKeysObj
          }
        });
      }

      // Headers (Referer & Origin)
      const referer = drmConfig?.headers?.referer || drmConfig?.referer || '';
      const origin = drmConfig?.headers?.origin || drmConfig?.origin || '';
      if (referer || origin) {
        try {
          shakaPlayerInstance.getNetworkingEngine().registerRequestFilter((type, request) => {
            if (referer) request.headers['Referer'] = referer;
            if (origin) request.headers['Origin'] = origin;
          });
        } catch (_) {}
      }

      await shakaPlayerInstance.load(streamUrl);
      logPlayerStatus(`✅ DASH MPD Stream Loaded successfully!`);
      video.play().catch(e => logPlayerStatus(`Autoplay notice: Click play to start video.`));
      return;
    } catch (e) {
      logPlayerStatus(`⚠️ Shaka DASH Error: ${e.message}. Falling back to native/HLS...`);
    }
  }

  // 2. HLS (M3U8) Playback via Hls.js
  if (isHls) {
    if (window.Hls && Hls.isSupported()) {
      hlsInstance = new Hls({
        debug: false,
        enableWorker: true,
        lowLatencyMode: true
      });
      hlsInstance.loadSource(streamUrl);
      hlsInstance.attachMedia(video);

      hlsInstance.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        logPlayerStatus(`✅ HLS Stream Loaded. Available Qualities: ${data.levels.length}`);
        video.play().catch(e => logPlayerStatus(`Autoplay notice: User interaction needed to start audio.`));
      });

      hlsInstance.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              logPlayerStatus(`⚠️ Network Error. Attempting stream recovery...`);
              hlsInstance.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              logPlayerStatus(`⚠️ Media Error. Attempting stream recovery...`);
              hlsInstance.recoverMediaError();
              break;
            default:
              logPlayerStatus(`❌ Stream notice: ${data.details}. (Check CORS or stream headers)`);
              hlsInstance.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Safari / iOS playback
      video.src = streamUrl;
      video.play().catch(e => console.warn(e));
    } else {
      video.src = streamUrl;
      video.play().catch(e => logPlayerStatus(`Notice: Click play on video.`));
    }
  } else {
    // 3. Standard Direct MP4 / WebM Streams
    video.src = streamUrl;
    video.play().catch(e => logPlayerStatus(`Notice: Click play on video.`));
  }
}

function testStreamFromInput() {
  const input = document.getElementById('stream-test-input');
  if (!input || !input.value.trim()) {
    showToast('Please enter or paste any stream URL', 'warning');
    return;
  }
  playStreamUrl(input.value.trim());
}

function logPlayerStatus(msg) {
  const logElem = document.getElementById('player-log');
  if (logElem) {
    const time = new Date().toLocaleTimeString();
    logElem.innerHTML = `[${time}] ${msg}<br>` + logElem.innerHTML;
  }
}

// 2. Player Initialization Logic (Dash.js / Shaka Player ke liye ClearKey pass karna)
function setupPlayerWithClearKey(player, streamUrl, drmKeyString, referer, origin) {
  if (!player) return;

  // Agar Referer/Origin zaroori ho toh headers set karein
  if (typeof player.setXHRSetup === 'function') {
    player.setXHRSetup(function (xhr) {
      if (referer) xhr.setRequestHeader('Referer', referer);
      if (origin) xhr.setRequestHeader('Origin', origin);
    });
  }

  // Shaka Player NetworkingEngine headers
  if (typeof player.getNetworkingEngine === 'function') {
    try {
      player.getNetworkingEngine().registerRequestFilter((type, request) => {
        if (referer) request.headers['Referer'] = referer;
        if (origin) request.headers['Origin'] = origin;
      });
    } catch (_) {}
  }

  // ClearKey DRM Configuration (Black screen aur decryption error fix karne ke liye)
  if (drmKeyString) {
    let clearKeysObj = {};
    
    // Format: keyId:key (agar multiple hain toh comma se split karein)
    drmKeyString.split(',').forEach(pair => {
      let parts = pair.split(':');
      if (parts.length >= 2) {
        const kid = parts[0].trim().replace(/[^0-9a-fA-F]/g, '').toLowerCase();
        const key = parts[1].trim().replace(/[^0-9a-fA-F]/g, '').toLowerCase();
        if (kid && key) {
          clearKeysObj[kid] = key;
        }
      }
    });

    // Dash.js player mein ClearKey apply karna
    if (typeof player.setProtectionData === 'function') {
      player.setProtectionData({
        "org.w3.clearkey": {
          "clearkeys": clearKeysObj
        }
      });
    }

    // Shaka player mein ClearKey apply karna
    if (typeof player.configure === 'function') {
      player.configure({
        drm: {
          clearKeys: clearKeysObj
        }
      });
    }
  }

  // Stream URL load karein
  if (typeof player.attachSource === 'function') {
    player.attachSource(streamUrl);
  } else if (typeof player.load === 'function') {
    player.load(streamUrl);
  }
}
window.setupPlayerWithClearKey = setupPlayerWithClearKey;

document.addEventListener('DOMContentLoaded', initPlayer);
