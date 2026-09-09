# 1E Assignment Recommendation Engine

React + TypeScript + Vite application for 1 East Cardiac Universal Bed (CUB) staffing and RN assignment decision support.

## Current V1

The default workspace is **Current Staffing**, using the 1E floor plan as the live operational canvas. Rooms 101–122 are clickable and display acuity color, current RN assignment, and room flags. The right-side room detail panel supports fast acuity/flag changes, while RN assignment cards show live staff status and assigned room clusters.

The application remains advisory. Charge Nurse judgment and hospital staffing/clinical policy remain authoritative.

## Data scope

V1 uses browser `localStorage`. Do not enter patient names, MRNs, DOBs, or other patient identifiers. The optional stay token is non-PHI and exists only to support continuity testing.

## Floor-plan asset

The canonical binary floor-plan image is committed at:

```text
src/assets/1e-floorplan.png
```

It is imported by `FloorPlanCurrentStaffing.tsx`, so Vite bundles/fingerprints it automatically for GitHub/Vercel deployment.

## Local development

Requires Node.js 20 or 22.

```bash
npm install
npm run dev
```

Validation/build:

```bash
npm run typecheck
npm run build
npm run preview
```

## Main workspaces

- **Current Staffing** — live current-shift floor-plan board, RN assignments, acuity, flags, staff status, MT/PCT coverage, and midshift operational changes.
- **Tomorrow Plan** — separate planning state for anticipated staffing and patient demand.
- **Next Shift Readiness** — advisory forecast of census/acuity/capability pressure.
- **History** — snapshots and planned-vs-actual operational history.
- **Print View** — simple paper-style handoff output using first names only.

## Deployment

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the concise GitHub/Vercel checklist.

A GitHub Pages workflow is included at `.github/workflows/deploy-pages.yml`. Vercel build settings are pinned in `vercel.json`.

## Safety / scope

- CVICU-capable nurses may cover CVICU/ICU/PCU/TELE; ICU-capable nurses may cover ICU/PCU/TELE; PCU/TELE nurses may cover PCU/TELE.
- HD/Dialysis is limited to configured ICU-capable rooms.
- Geography is an optimization criterion after capability and safe workload.
- Charge RN patient assignment and TELE quad are exception decisions, not silent defaults.
- MRS target is 11.972 and remains advisory. Current color thresholds are provisional until validated rules are supplied.
