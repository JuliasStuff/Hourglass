# Hourglass ⏳

A playful PWA time tracker. Start a timer, tag it with an activity, and watch the clock fill up so you can see at a glance when a quarter hour has passed.

## Features

- **Analog clock timer** with hour / minute / second hands and a filled minute sweep so a quarter / half / three-quarter hour is obvious at a glance
- **Activities & types** — group activities under custom types, each with their own emoji and color
- **Stats tab** — totals plus breakdowns by type and by activity, filterable by Today / Week / Month / All time
- **Installable PWA** — works offline once loaded; add to home screen on phones for an app-like experience
- **Local-first storage** in `localStorage`

## Run it

Just open `index.html` in a browser, or serve the folder over HTTP so the service worker can register:

```powershell
# from inside the Hourglass folder
python -m http.server 8000
# then visit http://localhost:8000
```

## Project layout

```
index.html              Markup + analog clock SVG + tabs
styles.css              Theme + animations
app.js                  Timer, activities, stats, persistence
manifest.webmanifest    PWA manifest
service-worker.js       Offline cache
icons/icon.svg          App icon
```
