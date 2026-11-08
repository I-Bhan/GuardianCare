# GuardianCare frontend

The website uses React, TypeScript, and Vite. For API startup, model files, and Supabase sign-in, see the [project setup guide](../README.md).

## Local development

Run the following commands from `frontend/`. On a fresh checkout, install dependencies with `npm.cmd ci` and configure the Supabase and API settings in `.env` using [.env.example](.env.example).

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open the [local website](http://127.0.0.1:5173/). Run `npm.cmd run lint` to check the source or `npm.cmd run build` to type-check the project and produce a build in `dist/`.

## Source layout

| Path | What to edit |
| --- | --- |
| `src/App.tsx` | Routes and shared layouts for account and workspace pages. |
| `src/pages/` | Home, account, dashboard, and administration pages. |
| `src/components/` | Incident log, scrollable patient roster, navigation, and account controls. |
| `src/components/monitoring.ts` | Risk ordering and star preferences stored in the browser for each account. |
| `src/lib/` | API and Supabase clients. |
| `src/context/`, `src/hooks/` | Session state and data loading. |
| `src/index.css`, `public/` | Light and dark themes, mobile layouts, fonts, and branding. |

## Dashboard behavior

Starring a vital sign moves it ahead of unstarred measurements on every patient card. Starring an incident includes it in the **Starred** filter. The incident log displays the patient's latest available risk assessment. **Not assessed** means there is no known assessment for that patient.
