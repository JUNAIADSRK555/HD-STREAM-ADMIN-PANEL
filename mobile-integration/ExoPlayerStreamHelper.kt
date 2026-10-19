package com.jdcric.live.player

import android.content.Context
import android.net.Uri
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.MimeTypes
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import com.jdcric.live.model.stream.StreamSource
import org.json.JSONArray
import org.json.JSONObject
import android.util.Base64

/**
 * High-Performance ExoPlayer / Media3 Stream Builder with Dynamic DRM (ClearKey) & Custom Headers
 */
object ExoPlayerStreamHelper {

    /**
     * Builds a configured ExoPlayer instance ready to play HLS (M3U8) or DASH (MPD)
     */
    fun buildPlayer(context: Context, stream: StreamSource): ExoPlayer {
        // 1. Setup Custom HTTP Headers (User-Agent, Referer, Origin)
        val userAgent = stream.headers["User-Agent"] ?: "JDCRIC-LIVE-ExoPlayer/1.5"
        val httpDataSourceFactory = DefaultHttpDataSource.Factory()
            .setUserAgent(userAgent)
            .setAllowCrossProtocolRedirects(true)
            .setConnectTimeoutMs(15000)
            .setReadTimeoutMs(15000)

        // Inject custom headers (e.g., Referer for anti-hotlinking)
        val customHeaders = mutableMapOf<String, String>()
        stream.headers.forEach { (key, value) ->
            if (key.isNotEmpty() && value.isNotEmpty()) {
                customHeaders[key] = value
            }
        }
        if (customHeaders.isNotEmpty()) {
            httpDataSourceFactory.setDefaultRequestProperties(customHeaders)
        }

        val mediaSourceFactory = DefaultMediaSourceFactory(context)
            .setDataSourceFactory(httpDataSourceFactory)

        val player = ExoPlayer.Builder(context)
            .setMediaSourceFactory(mediaSourceFactory)
            .build()

        // 2. Build MediaItem with DRM Configuration
        val mediaItem = buildMediaItem(stream)
        player.setMediaItem(mediaItem)
        player.prepare()
        player.playWhenReady = true

        return player
    }

    private fun buildMediaItem(stream: StreamSource): MediaItem {
        val uri = Uri.parse(stream.streamUrl)
        val mediaItemBuilder = MediaItem.Builder()
            .setUri(uri)
            .setMediaMetadata(
                MediaMetadata.Builder()
                    .setTitle(stream.title)
                    .build()
            )

        // Detect MIME Type
        when {
            stream.streamUrl.contains(".m3u8", ignoreCase = true) || stream.streamType == "M3U8" -> {
                mediaItemBuilder.setMimeType(MimeTypes.APPLICATION_M3U8)
            }
            stream.streamUrl.contains(".mpd", ignoreCase = true) || stream.streamType == "MPD" -> {
                mediaItemBuilder.setMimeType(MimeTypes.APPLICATION_MPD)
            }
        }

        // 3. ClearKey DRM Integration (Key 1 & Key 2)
        if (stream.drm.enabled && stream.drm.keyId.isNotEmpty() && stream.drm.key.isNotEmpty()) {
            val drmConfiguration = buildClearKeyDrmConfiguration(stream.drm.keyId, stream.drm.key)
            mediaItemBuilder.setDrmConfiguration(drmConfiguration)
        }

        return mediaItemBuilder.build()
    }

    /**
     * Constructs ClearKey DRM Configuration in W3C format
     * KeyId and Key are passed as 32-character hex strings from the Admin Panel
     */
    private fun buildClearKeyDrmConfiguration(keyIdHex: String, keyHex: String): MediaItem.DrmConfiguration {
        val kidBase64 = hexToBase64Url(keyIdHex)
        val kBase64 = hexToBase64Url(keyHex)

        // Generate JSON: {"keys":[{"kty":"oct","k":"<key>","kid":"<kid>"}]}
        val keyObj = JSONObject().apply {
            put("kty", "oct")
            put("kid", kidBase64)
            put("k", kBase64)
        }
        val keysArray = JSONArray().apply {
            put(keyObj)
        }
        val clearKeyJson = JSONObject().apply {
            put("keys", keysArray)
        }.toString()

        // ClearKey license URI format for Media3
        val licenseUri = Uri.parse("data:application/json;base64," + Base64.encodeToString(clearKeyJson.toByteArray(), Base64.NO_WRAP))

        return MediaItem.DrmConfiguration.Builder(C.CLEARKEY_UUID)
            .setLicenseUri(licenseUri)
            .setMultiSession(false)
            .build()
    }

    private fun hexToBase64Url(hexString: String): String {
        val cleanHex = hexString.replace("[^0-9a-fA-F]".toRegex(), "")
        val bytes = ByteArray(cleanHex.length / 2)
        for (i in bytes.indices) {
            val index = i * 2
            bytes[i] = cleanHex.substring(index, index + 2).toInt(16).toByte()
        }
        return Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP).trim()
    }
}
