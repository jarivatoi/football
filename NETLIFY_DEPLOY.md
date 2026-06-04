# Deploy to Netlify

## Option 1: Deploy via Netlify UI (Easiest)

1. **Go to https://app.netlify.com/**
2. **Click "Add new site" → "Import an existing project"**
3. **Connect to GitHub** and select your `football` repository
4. **Build settings:**
   - Build command: `npm run build`
   - Publish directory: `dist`
5. **Click "Deploy site"**

Netlify will automatically detect the `netlify.toml` file and deploy your functions!

## Option 2: Deploy via CLI

```bash
# Install Netlify CLI globally (one time)
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy
npm run deploy
```

## After Deployment

1. Your site will be at: `https://your-site-name.netlify.app`
2. Bet placement will use: `https://your-site-name.netlify.app/.netlify/functions/placebet`
3. This proxies to Totelepep API server-side (no CORS issues!)

## Test Bet Placement

1. Visit your Netlify URL
2. Select a match and expand markets
3. Click on odds to add to bet slip
4. Place a bet
5. Check Network tab - you should see the bet go through the Netlify Function
6. You should receive a ticket number!

## How It Works

- Frontend sends bet to: `/.netlify/functions/placebet`
- Netlify Function receives it and forwards to: `https://www.totelepep.mu/webapi/placebet`
- Response is sent back to frontend
- No CORS issues because the function runs server-side!
