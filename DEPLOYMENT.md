# Find Your Bench — Deployment Guide
# Target domain: findyourbench.app

---

## 1. Google Maps API Key

You need a Google Maps API key before deploying.

1. Go to https://console.cloud.google.com/
2. Create or select a project ("Find Your Bench")
3. Enable these APIs under **APIs & Services → Library**:
   - Maps JavaScript API
   - Places API
   - Geocoding API
4. Go to **APIs & Services → Credentials → Create Credentials → API Key**
5. Restrict the key:
   - **Application restrictions** → HTTP referrers
   - Add:
     - `localhost:5173` (local dev)
     - `*.vercel.app` (preview deploys)
     - `findyourbench.app`
     - `www.findyourbench.app`
   - **API restrictions** → restrict to the three APIs above

---

## 2. Deploy to Vercel

### 2a. Push code to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 2b. Create Vercel project

1. Go to https://vercel.com → **Add New Project**
2. Import your GitHub repository
3. Framework preset: **Vite**
4. Build command: `npm run build`
5. Output directory: `dist`

### 2c. Set environment variables in Vercel

In **Project Settings → Environment Variables**, add:

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | `https://ubgnmvplrygcszjekeqv.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | *(value from your .env file)* |
| `VITE_GOOGLE_MAPS_API_KEY` | *(your Google Maps key)* |

Set these for **Production**, **Preview**, and **Development** environments.

6. Click **Deploy**

---

## 3. Connect findyourbench.app

### 3a. Add domain in Vercel

1. Go to your Vercel project → **Settings → Domains**
2. Click **Add Domain** → type `findyourbench.app`
3. Also add `www.findyourbench.app` and set it to redirect to `findyourbench.app`
4. Vercel will show you DNS records to configure

### 3b. Configure DNS at your registrar

Vercel will give you one of two options:

**Option A — Nameservers (recommended, simplest)**
Point your domain's nameservers to Vercel's nameservers:
- `ns1.vercel-dns.com`
- `ns2.vercel-dns.com`

**Option B — A/CNAME records**
| Type | Name | Value |
|------|------|-------|
| `A` | `@` | `76.76.21.21` |
| `CNAME` | `www` | `cname.vercel-dns.com` |

DNS propagation takes up to 48 hours but is usually live within minutes.

### 3c. HTTPS

Vercel provisions a Let's Encrypt SSL certificate automatically once DNS is verified. No extra steps needed — HTTPS is enforced by default and HTTP redirects to HTTPS.

---

## 4. Supabase: Allow your domain

In **Supabase Dashboard → Authentication → URL Configuration**:

1. Set **Site URL** to `https://findyourbench.app`
2. Add to **Redirect URLs**:
   - `https://findyourbench.app/**`
   - `https://www.findyourbench.app/**`
   - `http://localhost:5173/**` (for local dev)

---

## 5. Verify deployment checklist

- [ ] https://findyourbench.app loads (green padlock = HTTPS)
- [ ] www.findyourbench.app redirects to apex domain
- [ ] Map loads on desktop
- [ ] Map loads on iPhone Safari (add to Home Screen → standalone mode)
- [ ] Map loads on Android Chrome
- [ ] Geolocation prompt appears on mobile
- [ ] Long-press on map drops a pin (mobile)
- [ ] Sign up / sign in works
- [ ] Adding a bench with photo works
- [ ] Ratings save correctly
- [ ] Leaderboard loads
- [ ] Refreshing any page doesn't 404 (SPA routing via vercel.json rewrites)

---

## 6. Mobile performance notes

The app is optimized for mobile with:
- Code-split chunks (React, Maps, Supabase, Icons loaded separately)
- Service worker caching static assets (`/sw.js`)
- PWA manifest for "Add to Home Screen" on iOS and Android
- `viewport-fit=cover` for iPhone notch/Dynamic Island support
- `apple-mobile-web-app-capable` for full-screen standalone mode on iOS
- `user-scalable=no` to prevent accidental zoom on the map

---

## 7. Local development

```bash
cp .env.example .env   # fill in your keys
npm install
npm run dev            # http://localhost:5173
```

Never commit `.env` — it is already in `.gitignore`.
