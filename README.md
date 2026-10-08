# CloudOps Control Center

A frontend-only cloud operations dashboard built with HTML, CSS, and JavaScript.

The project is designed to feel like a small operational product rather than a static landing page. It uses public APIs directly from the browser, so there is no custom backend and no server-side credentials.

## What it includes

- Live repository metrics from the GitHub REST API
- Recent commit activity and an interactive 14-day commit chart
- External platform health from the Cloudflare status API
- Regional telemetry from Open-Meteo
- Infrastructure, deployment, network, activity, and settings workspaces
- Browser-side network latency probes
- Optional automatic refresh stored in localStorage
- Responsive dark interface with reduced-motion support
- GitHub Pages deployment through GitHub Actions

## Stack

- HTML5
- CSS3
- Vanilla JavaScript
- Fetch API
- GitHub REST API
- Cloudflare Status API
- Open-Meteo API
- GitHub Actions

## Run locally

Because this is a static site, it does not require npm or a backend.

A simple static server is recommended so browser API requests behave consistently:

```bash
python -m http.server 5500
```

Then open:

```
http://localhost:5500
```

## Repository structure

```text
cloudops-control-center/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── api.js
│   └── app.js
├── assets/
│   └── favicon.svg
└── .github/
    └── workflows/
        └── deploy-pages.yml
```

## Live data and privacy

The dashboard requests data directly from public endpoints in the browser. No API secret, login token, or backend database is included in this repository.

Network results depend on the visitor's connection and location. External APIs can also rate-limit requests or become temporarily unavailable; the interface handles these conditions without making the dashboard unusable.

## GitHub Pages

The repository includes a GitHub Actions workflow that deploys the root of the repository as a static Pages site whenever `main` changes.

