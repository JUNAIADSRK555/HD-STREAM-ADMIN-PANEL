# 🚀 24/7 Free Cloud Hosting & Deployment Guide

Is guide me hum backend API aur Admin Panel ko **100% Free** cloud platform par deploy karenge jo **24/7 online** rahegi bina band huye.

---

## 🛠️ Step 1: Free MongoDB Atlas Database Setup (Free 24/7 Forever)

MongoDB Atlas ka **M0 Sandbox Cluster** bilkul free hai, 512 MB storage deta hai (jo hajaro live matches aur episodes ke liye kafi hai), aur kabhi band nahi hota.

1. **Account Banayein:**
   - [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) par ja kar free account create karein.
2. **Free Cluster Create Karein:**
   - **M0 Free** (Shared) plan select karein.
   - Cloud Provider me **AWS** ya **Google Cloud** aur nearest region (jaise Mumbai `ap-south-1` ya Singapore) chunein.
   - "Create Deployment" par click karein.
3. **Database User & Password Banayein:**
   - Username: `admin`
   - Password: koi strong password generate karein (jaise `StreamLivePass2026`). Is password ko copy kar lein.
4. **Network Access (IP Whitelist):**
   - Left menu me **Network Access** par jayein.
   - **Add IP Address** par click karein aur **Allow Access from Anywhere (`0.0.0.0/0`)** select karein. (Yeh zaroori hai taaki Render ya Vercel cloud server database se connect ho sake).
5. **Connection String Copy Karein:**
   - **Database** tab me ja kar **Connect** button par click karein.
   - **Drivers** (Node.js) choose karein.
   - Aapko aisi URI milegi:
     ```
     mongodb+srv://admin:<password>@cluster0.xyz.mongodb.net/?retryWrites=true&w=majority
     ```
   - `<password>` ki jagah apna password dalein aur database ka naam (jaise `streamdb`) add karein:
     ```
     mongodb+srv://admin:StreamLivePass2026@cluster0.xyz.mongodb.net/streamdb?retryWrites=true&w=majority
     ```

---

## ⚡ Option A: Vercel par Deploy karein (Recommended — 100% Free, Zero Sleep, 24/7 Instant)

Vercel par project deploy karna sabse aasan aur fast hai. Yeh serverless edge par chalta hai, isliye isme server kabhi **sleep ya down nahi hota**.

### Method 1: GitHub se 1-Click Deploy (Sabse Easy)
1. Is folder (`stream-admin-backend`) ko apne GitHub account par push karein:
   ```bash
   git init
   git add .
   git commit -m "Initial commit for stream admin"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/stream-admin-backend.git
   git push -u origin main
   ```
2. [Vercel.com](https://vercel.com/) par login karein.
3. **Add New... -> Project** par click karein aur apna GitHub repository select karein.
4. **Environment Variables** section me yeh keys add karein:
   - `MONGODB_URI` = `mongodb+srv://admin:...@cluster0.xyz.mongodb.net/streamdb?retryWrites=true&w=majority`
   - `ADMIN_API_KEY` = `jdcric_secure_admin_2026`
   - `NODE_ENV` = `production`
5. **Deploy** button dabayein!
6. 1 minute me aapka live admin panel tayyar ho jayega:
   - Live URL: `https://your-project-name.vercel.app`

---

## 🌐 Option B: Render.com par Deploy karein (Free Web Service)

Render.com Node.js backend host karne ke liye bahut popular hai. Free tier me server 15 minute baad sleep par chala jata hai, **lekin humne is project me 24/7 keep-alive self-pinger include kiya hai jo Render ko kabhi sone nahi dega!**

1. [Render.com](https://render.com/) par sign up karein.
2. Dashboard me **New +** -> **Web Service** par click karein.
3. Apna GitHub repo connect karein.
4. Settings fill karein:
   - **Name:** `stream-admin-api`
   - **Region:** Singapore ya Frankfurt
   - **Branch:** `main`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** `Free`
5. **Environment Variables** add karein:
   - `MONGODB_URI` = (Aapka MongoDB Atlas URI)
   - `ADMIN_API_KEY` = `jdcric_secure_admin_2026`
   - `APP_BASE_URL` = `https://stream-admin-api.onrender.com` (Render ka generated URL)
   - `NODE_ENV` = `production`
6. **Create Web Service** par click karein.
7. Deployment complete hone ke baad Render URL live ho jayega:
   `https://stream-admin-api.onrender.com`

> **Tip for 100% 24/7 Guarantee on Render:**
> Render ko 100% awake rakhne ke liye free service [cron-job.org](https://cron-job.org) ya [uptimerobot.com](https://uptimerobot.com) par free account banayein aur har 10 minute me `https://your-service.onrender.com/api/health` ko ping karne ke liye set kar dein.

---

## 📱 Step 3: Mobile Application me API Connect Karna

Jab aapka backend Render ya Vercel par live ho jaye, to mobile app me sirf 1 URL change karna hoga:

### 1. `StreamApiService.kt` me Live URL Dalein:
```kotlin
companion object {
    // Render ya Vercel ka live URL yahan dalein
    private const val BASE_URL = "https://your-project.vercel.app/" // ya "https://stream-admin-api.onrender.com/"
    
    fun create(): StreamApiService {
        return Retrofit.Builder()
            .baseUrl(BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(StreamApiService::class.java)
    }
}
```

### 2. Live Match Fetch Karna:
```kotlin
lifecycleScope.launch {
    try {
        val feed = streamApiService.getMobileFeed()
        
        // App config & announcements
        val announcement = feed.appConfig.announcement
        
        // Live matches list
        val liveMatches = feed.liveEvents
        
        // VOD shows (Bigg Boss, Sony LIV, etc.)
        val shows = feed.vodSection
        
        // UI me set karein
    } catch (e: Exception) {
        Log.e("StreamFeed", "Failed to fetch: ${e.message}")
    }
}
```

### 3. ExoPlayer me Stream Play Karna (ClearKey DRM & Custom Headers ke saath):
```kotlin
val liveMatch = feed.liveEvents.first()
val streamServer = liveMatch.streams.first() // jaise ICC TV 1080p

// Single line se ExoPlayer initialize ho jayega
val exoPlayer = ExoPlayerStreamHelper.buildPlayer(context, streamServer)
playerView.player = exoPlayer
```

---

## 🔒 Security & Admin Access
- Admin Panel me live events add, update, ya delete karne ke liye `X-Admin-Key` header use hota hai.
- Aap dashboard ke **App Settings** tab me ja kar apna secret key browser me save kar sakte hain.
- Public users sirf streams aur matches ko read kar sakte hain, koi bhi unhe bina key ke modify nahi kar sakta.
