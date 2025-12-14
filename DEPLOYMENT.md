# Deployment Guide

## Cloudflare Pages Setup

### Prerequisites
1. A Cloudflare account
2. A Convex account with a deployment

### Environment Variables

You need to configure the following environment variables in your Cloudflare Pages project settings:

#### Required for Build:
- `CONVEX_DEPLOY_KEY` - Your Convex deployment key (get this from Convex dashboard)

The build process will deploy Convex and capture `NEXT_PUBLIC_CONVEX_URL` for the Next.js build.

#### Convex Environment Variables (set in Convex, not Cloudflare Pages):
- `GEMINI_API_KEY` - Google Gemini API key used by Convex actions

### Build Configuration

In your Cloudflare Pages project settings, use:
- **Build command**: `npm run build`
- **Build output directory**: `out`
- **Node version**: 18 or higher

### How the Build Works

1. The `build.sh` script runs first
2. It deploys to Convex and captures the `NEXT_PUBLIC_CONVEX_URL`
3. It then runs the Next.js build with the environment variable set
4. The static site is exported to the `out` directory

### Troubleshooting

If you encounter build errors:

1. **"No address provided to ConvexReactClient"**:
   - Ensure `CONVEX_DEPLOY_KEY` is set in Cloudflare Pages environment variables
   - The build script should handle this automatically

2. **"convex: command not found"**:
   - This should not happen as convex is in package.json dependencies
   - If it does, check that `npm install` completed successfully

3. **Permission denied on build.sh**:
   - The script should already be executable
   - If not, Cloudflare Pages may need the build command changed to: `chmod +x build.sh && npm run build`

### Local Development

For local development:
1. Copy `.env.local.example` to `.env.local`
2. Run `npm run convex` to start the Convex dev server
3. Run `npm run dev` to start the Next.js dev server
4. The `.env.local` file will be automatically populated by Convex
5. Set your Gemini key in Convex (one-time):
   ```bash
   npx convex env set GEMINI_API_KEY your_gemini_api_key
   ```

### Manual Build Test

To test the build locally:
```bash
npm run build
```

This will run the same build process that Cloudflare Pages uses.
