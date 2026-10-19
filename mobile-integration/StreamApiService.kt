package com.jdcric.live.data.remote

import com.jdcric.live.model.stream.MobileFeedResponse
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.GET
import java.util.concurrent.TimeUnit

interface StreamApiService {

    /**
     * Fetch complete real-time live match & streaming feed from Admin Backend
     */
    @GET("api/feed/mobile")
    suspend fun getMobileFeed(): MobileFeedResponse

    companion object {
        // Replace with your live Render / Vercel cloud URL (e.g., https://your-app.onrender.com/)
        private const val BASE_URL = "https://your-stream-backend.onrender.com/"

        fun create(baseUrl: String = BASE_URL): StreamApiService {
            val logging = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BASIC
            }

            val client = OkHttpClient.Builder()
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(15, TimeUnit.SECONDS)
                .addInterceptor(logging)
                .build()

            return Retrofit.Builder()
                .baseUrl(baseUrl)
                .client(client)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
                .create(StreamApiService::class.java)
        }
    }
}
