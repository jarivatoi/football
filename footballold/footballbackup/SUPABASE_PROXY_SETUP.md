# Supabase CORS Proxy Setup

## Prerequisites
- You already have a Supabase project
- Node.js installed

## Step 1: Install Supabase CLI

```bash
npm install -g supabase
```

## Step 2: Login to Supabase

```bash
supabase login
```

This will open a browser window for authentication.

## Step 3: Find Your Project Reference

1. Go to https://app.supabase.com
2. Click on your project
3. Go to Settings → General
4. Copy the "Project reference ID" (looks like: `xxxxxxxxxxxxxxxxxxxx`)

## Step 4: Link Your Project

```bash
cd c:\Users\subit\Downloads\Totepepfull
supabase link --project-ref YOUR_PROJECT_REF
```

Replace `YOUR_PROJECT_REF` with your actual project ID.

## Step 5: Deploy the Edge Function

```bash
supabase functions deploy cors-proxy
```

## Step 6: Get Your Function URL

After deployment, you'll get a URL like:
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/cors-proxy
```

## Step 7: Update Your App

Edit `src/services/totelepepExtractor.ts`:

```typescript
private corsProxies = [
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/cors-proxy?url=',  // YOUR Supabase proxy!
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
];
```

## Usage Example

```typescript
// Before (with public proxy):
const url = 'https://corsproxy.io/?' + encodeURIComponent('https://www.totelepep.mu/webapi/GetSport?...');

// After (with your Supabase proxy):
const url = 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/cors-proxy?url=' + encodeURIComponent('https://www.totelepep.mu/webapi/GetSport?...');
```

## Testing

```bash
# Test the function directly:
curl "https://YOUR_PROJECT_REF.supabase.co/functions/v1/cors-proxy?url=https://httpbin.org/get"
```

## Pricing

**Supabase Free Tier:**
- ✅ 500,000 Edge Function invocations per month
- ✅ 50GB bandwidth per month
- ✅ Enough for ~1,000+ users per month

**If you exceed free tier:**
- $10/month for 2M invocations
- Very affordable for production

## Benefits

✅ **Your own proxy** - no sharing with other apps
✅ **Reliable** - Supabase infrastructure
✅ **Fast** - Edge network (globally distributed)
✅ **Scalable** - Handles thousands of users
✅ **Free** - Generous free tier
✅ **You control it** - no third-party dependencies

## Monitoring

Check usage in Supabase Dashboard:
1. Go to your project
2. Click "Edge Functions" in sidebar
3. View invocation count and errors
