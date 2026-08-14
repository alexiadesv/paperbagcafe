# Blind Box Café 

## Features

- Multi-select maker with latte art, tart decorating, pressed toast, a typed
  letter, watercolor painting, and handwritten name tags.
- Pointer and touch support, pressure/hold-sensitive milk pouring, toothpick
  foam warping, watercolor blending, undo, and animated sealing.
- Bag colors, To/From fields, a tear-off receipt, Web Share support, and a
  read-only recipient opening.
- Local persistence while making and optional Supabase-backed cross-device
  sharing.

## Local development

Requires a current Node.js release.

```bash
npm install
npm run dev
```

Open the URL printed by Vite. Do not open `index.html` directly because canvas
pixel tools require an HTTP origin.

Useful checks:

```bash
npm run build
npm run lint
npm test
npm run test:e2e
```

Without Supabase environment variables, the app uses a local demo share store.
Those links only work in the browser profile that created them.

## Supabase setup

1. Create a Supabase project and enable **Anonymous Sign-Ins** under
   Authentication → Providers.
2. Install the Supabase CLI and link this directory to the project.
3. Apply `supabase/migrations/001_packages.sql`.
4. Deploy the public opener:

   ```bash
   supabase db push
   supabase functions deploy open-package
   ```

5. Copy `.env.example` to `.env.local` and supply the project URL and anon key:

   ```text
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
   ```

The migration creates owner-only package policies, a private size-limited
`package-media` bucket, and the authenticated `send_package` transition.
`open-package` is the only public reader: it accepts an unguessable slug,
removes storage paths and ownership data, signs media for one hour, and records
the first opening. Never put the service-role key in Vite environment files.

## Production hosting

Build with `npm run build` and deploy `dist/` to a static host. Configure the
host to rewrite unknown routes to `/index.html` so `/open/:slug` works when a
recipient follows a shared link. Set the two `VITE_SUPABASE_*` values in the
hosting provider before building.

## Assets

Runtime watercolor files are copied to `public/watercolor-assets/`. The source
asset pack remains in `watercolor-assets/`; rebuild it with:

```bash
python scripts/build_watercolor_asset_pack.py
```

The older latte-art pipeline in `scripts/build_assets.py` remains available for
regenerating the foam stamp and calibrated latte assets.
