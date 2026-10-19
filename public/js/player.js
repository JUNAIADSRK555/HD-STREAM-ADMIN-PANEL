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

function playStreamUrl(streamUrl, streamType = 'M3U8') {
  const video = document.getElementById('admin-video-player');
  const input = document.getElementById('stream-test-input');
  if (!video) return;

  if (input) input.value = streamUrl;

  logPlayerStatus(`🔄 Loading stream: ${streamUrl} (${streamType})`);

  // Destroy previous HLS instance if any
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }

  if (streamUrl.includes('.m3u8') || streamType === 'M3U8') {
    if (window.Hls && Hls.isSupported()) {
      hlsInstance = new Hls({
        debug: false,
        enableWorker: true,
        lowLatencyMode: true
      });
      hlsInstance.loadSource(streamUrl);
      hlsInstance.attachMedia(video);

      hlsInstance.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        logPlayerStatus(`✅ HLS Manifest Loaded. Available Qualities: ${data.levels.length}`);
        video.play().catch(e => logPlayerStatus(`Autoplay notice: User interaction needed to start audio.`));
      });

      hlsInstance.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              logPlayerStatus(`⚠️ Fatal Network Error. Attempting HLS recovery...`);
              hlsInstance.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              logPlayerStatus(`⚠️ Fatal Media Error. Attempting HLS recovery...`);
              hlsInstance.recoverMediaError();
              break;
            default:
              logPlayerStatus(`❌ Unrecoverable HLS error: ${data.details}. (Check CORS or stream token)`);
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
      logPlayerStatus(`❌ HLS is not supported in this browser.`);
    }
  } else {
    // Standard Direct MP4 / WebM
    video.src = streamUrl;
    video.play().catch(e => logPlayerStatus(`Notice: Click play on video.`));
  }
}

function testStreamFromInput() {
  const input = document.getElementById('stream-test-input');
  if (!input || !input.value.trim()) {
    showToast('Please enter or paste a valid stream URL', 'warning');
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
