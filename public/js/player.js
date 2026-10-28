// In-Admin Video Stream Preview Controller
let hlsInstance = null;

function initPlayer() {
  const video = document.getElementById('admin-video-player');
  if (!video) return;

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

function playStreamUrl(rawStreamUrl, streamType = 'M3U8') {
  const video = document.getElementById('admin-video-player');
  const input = document.getElementById('stream-test-input');
  if (!video || !rawStreamUrl) return;

  // Gracefully handle piped stream links: https://example.com/master.m3u8|User-Agent=...
  let streamUrl = String(rawStreamUrl).trim();
  if (streamUrl.includes('|')) {
    streamUrl = streamUrl.split('|')[0].trim();
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

  const isHls = streamUrl.toLowerCase().includes('.m3u8') ||
                streamUrl.toLowerCase().includes('.ts') ||
                String(streamType).toUpperCase() === 'M3U8' ||
                String(streamType).toUpperCase() === 'HLS';

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
        logPlayerStatus(`✅ Stream Loaded. Available Qualities: ${data.levels.length}`);
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
    // Standard Direct MP4 / WebM / Other Streams
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

document.addEventListener('DOMContentLoaded', initPlayer);
