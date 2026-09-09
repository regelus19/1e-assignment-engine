# GitHub / Vercel Deployment Checklist

## Repository contents

- Keep the full React/Vite source at the repository root.
- Keep the binary floor-plan asset committed at `src/assets/1e-floorplan.png`.
- Do not move the floor-plan image to an external URL; Vite imports and fingerprints it at build time.
- Do not commit `node_modules/`, `dist/`, or `.vercel/`.

## Before push

```bash
npm install
npm run typecheck
npm run build
npm run preview
```

Verify that **Current Staffing** opens by default and that the floor-plan image renders with clickable room overlays.

## GitHub

1. Create or use the dedicated repository for the app.
2. Push this project to the `main` branch.
3. Optional GitHub Pages deployment is already configured in `.github/workflows/deploy-pages.yml`.
4. In repository **Settings → Pages**, set the source to **GitHub Actions** if GitHub Pages will be used.

## Vercel

1. In Vercel, import the GitHub repository.
2. Framework preset should detect **Vite** automatically.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. No environment variables are required for the current localStorage version.
6. Deploy and verify the production URL.

`vercel.json` pins the build command and output directory so the deployment does not depend on dashboard-only settings.

## Smoke test after deploy

- Floor plan image loads.
- Rooms 101–122 are clickable.
- Acuity color changes update the selected room.
- Quick flags toggle from the right-side room panel.
- RN assignment cards show room chips and live status.
- ACTIVE / FLEXED / ON_CALL / RECALLED changes persist on refresh in the same browser.
- Room reassignment works from the selected room to an RN card.
- Current Staffing state remains separate from Tomorrow Plan.
- Print View remains the simple first-name, three-column handoff sheet.

## Current V1 limitation

Persistence is browser-local (`localStorage`). A different device or browser will have a different data set until the SharePoint data-service phase is implemented.
