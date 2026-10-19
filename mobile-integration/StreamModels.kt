package com.jdcric.live.model.stream

import com.google.gson.annotations.SerializedName

/**
 * Mobile Consolidated Feed Response from Admin Panel API (/api/feed/mobile)
 */
data class MobileFeedResponse(
    @SerializedName("status") val status: String = "",
    @SerializedName("timestamp") val timestamp: Long = 0L,
    @SerializedName("appConfig") val appConfig: AppConfig = AppConfig(),
    @SerializedName("categories") val categories: List<FeedCategory> = emptyList(),
    @SerializedName("liveEvents") val liveEvents: List<LiveStreamEvent> = emptyList(),
    @SerializedName("upcomingEvents") val upcomingEvents: List<LiveStreamEvent> = emptyList(),
    @SerializedName("recentEvents") val recentEvents: List<LiveStreamEvent> = emptyList(),
    @SerializedName("vodSection") val vodSection: List<VodShow> = emptyList()
)

data class AppConfig(
    @SerializedName("appName") val appName: String = "",
    @SerializedName("announcement") val announcement: String = "",
    @SerializedName("announcementEnabled") val announcementEnabled: Boolean = false,
    @SerializedName("appVersion") val appVersion: String = "1.5.0",
    @SerializedName("apkDownloadUrl") val apkDownloadUrl: String = "",
    @SerializedName("maintenanceMode") val maintenanceMode: Boolean = false,
    @SerializedName("telegramLink") val telegramLink: String = ""
)

data class FeedCategory(
    @SerializedName("id") val id: String = "",
    @SerializedName("name") val name: String = "",
    @SerializedName("slug") val slug: String = "",
    @SerializedName("icon") val icon: String = ""
)

data class LiveStreamEvent(
    @SerializedName("id") val id: String = "",
    @SerializedName("title") val title: String = "",
    @SerializedName("category") val category: String = "",
    @SerializedName("status") val status: String = "LIVE", // LIVE, UPCOMING, FINISHED
    @SerializedName("format") val format: String = "T20",
    @SerializedName("startTime") val startTime: String = "",
    @SerializedName("bannerUrl") val bannerUrl: String = "",
    @SerializedName("description") val description: String = "",
    @SerializedName("isPinned") val isPinned: Boolean = false,
    @SerializedName("team1") val team1: TeamInfo = TeamInfo(),
    @SerializedName("team2") val team2: TeamInfo = TeamInfo(),
    @SerializedName("totalStreams") val totalStreams: Int = 0,
    @SerializedName("streams") val streams: List<StreamSource> = emptyList()
)

data class TeamInfo(
    @SerializedName("name") val name: String = "",
    @SerializedName("shortName") val shortName: String = "",
    @SerializedName("flag") val flag: String = "",
    @SerializedName("score") val score: String = ""
)

data class StreamSource(
    @SerializedName("id") val id: String = "",
    @SerializedName("title") val title: String = "",
    @SerializedName("streamType") val streamType: String = "M3U8", // M3U8, MPD, DIRECT, EMBED
    @SerializedName("streamUrl") val streamUrl: String = "",
    @SerializedName("quality") val quality: String = "Auto",
    @SerializedName("headers") val headers: Map<String, String> = emptyMap(),
    @SerializedName("drm") val drm: DrmConfig = DrmConfig()
)

data class DrmConfig(
    @SerializedName("enabled") val enabled: Boolean = false,
    @SerializedName("scheme") val scheme: String = "clearkey", // clearkey, widevine
    @SerializedName("keyId") val keyId: String = "", // Key 1 (Hex)
    @SerializedName("key") val key: String = "",     // Key 2 (Hex)
    @SerializedName("licenseUrl") val licenseUrl: String? = null
)

data class VodShow(
    @SerializedName("id") val id: String = "",
    @SerializedName("title") val title: String = "",
    @SerializedName("category") val category: String = "",
    @SerializedName("posterUrl") val posterUrl: String = "",
    @SerializedName("bannerUrl") val bannerUrl: String = "",
    @SerializedName("description") val description: String = "",
    @SerializedName("rating") val rating: String = "8.5",
    @SerializedName("releaseYear") val releaseYear: String = "2026",
    @SerializedName("totalEpisodes") val totalEpisodes: Int = 0,
    @SerializedName("episodes") val episodes: List<VodEpisode> = emptyList()
)

data class VodEpisode(
    @SerializedName("id") val id: String = "",
    @SerializedName("episodeNumber") val episodeNumber: Int = 1,
    @SerializedName("title") val title: String = "",
    @SerializedName("duration") val duration: String = "",
    @SerializedName("thumbnail") val thumbnail: String = "",
    @SerializedName("streamType") val streamType: String = "M3U8",
    @SerializedName("streamUrl") val streamUrl: String = "",
    @SerializedName("headers") val headers: Map<String, String> = emptyMap(),
    @SerializedName("drm") val drm: DrmConfig = DrmConfig()
)
