# Deploy Supabase Edge Function - CORS Proxy

## What was fixed:
The Supabase Edge Function now properly forwards cookies and session data, which is required for Totelepep bet placement API.

## How to Deploy:

### Option 1: Using Supabase Dashboard (Easiest)

1. Go to your Supabase project: https://supabase.com/dashboard/project/zaleugflzamrkrfkrcsa
2. Click on **Edge Functions** in the left sidebar
3. Click **Create a Function** or edit existing `cors-proxy` function
4. Copy the contents of `supabase/functions/cors-proxy/index.ts`
5. Paste into the Supabase editor
6. Click **Deploy**

### Option 2: Using Supabase CLI

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link to your project:
   ```bash
   supabase link --project-ref zaleugflzamrkrfkrcsa
   ```

4. Deploy the function:
   ```bash
   supabase functions deploy cors-proxy
   ```

### Option 3: Using Git Integration

1. Connect your GitHub repo to Supabase Edge Functions
2. The function will auto-deploy on push

## Testing:

After deployment, test the function:

```bash
curl -X POST "https://zaleugflzamrkrfkrcsa.supabase.co/functions/v1/cors-proxy?url=https://httpbin.org/post" \
  -H "Content-Type: application/json" \
  -H "Cookie: test=value" \
  -d '{"test": "data"}'
```

## What changed:

- ✅ Now forwards `Cookie` headers to Totelepep API
- ✅ Forwards `Set-Cookie` headers back to client
- ✅ Properly handles authentication sessions
- ✅ More secure - only forwards necessary headers
- ✅ Better CORS configuration with credentials support

## Benefits over corsproxy.io:

- ✅ **Your own infrastructure** - full control
- ✅ **No rate limits** - Supabase generous free tier
- ✅ **Reliable** - enterprise-grade infrastructure
- ✅ **Private** - requests don't go through third-party
- ✅ **Scalable** - handles thousands of requests
