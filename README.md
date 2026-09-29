# alanruddock.com

Source for [alanruddock.com](https://alanruddock.com), the academic site of Dr Alan Ruddock, Associate Professor of Sport Physiology and Performance at Sheffield Hallam University.

The site is served by GitHub Pages straight from this repository. There is no build step: every file is served as committed.

## What's here

| Path | What it is |
|---|---|
| `index.html`, `styles.css` | Academic profile: research, applied projects, publications, teaching and contact. The publications list is refreshed from [OpenAlex](https://openalex.org) when the page loads. |
| `resume.json` | CV in [JSON Resume](https://jsonresume.org) format |
| `llms.txt` | Plain-text summary of the site for AI assistants and search tools |
| `vo2max/` | Interactive learning modules. "What's VO2max?" takes one primary study at a time (starting with Myers et al., *N Engl J Med* 2002) and rebuilds its figures so readers can explore the data. |
| `engine/`, `builder/` | A classroom polling platform: students vote on their phones, results appear live on the projector, and the teacher paces the stages. `builder/` is the authoring app, which publishes a presentation to this repository in one commit. |
| `the-future-of-sport-and-exercise-science/`, `wcweather/`, `test/` | Presentations published with the platform |
| `linkedin-banner.html` | Source for the LinkedIn banner image |

## Run locally

ES modules and `fetch()` do not work from `file://`, so serve the folder:

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765/ (site), http://localhost:8765/builder/ (authoring app) or http://localhost:8765/&lt;slug&gt;/results.html (a presentation's projector view).

Live voting uses Firebase Firestore. Offline, the engine falls back to `localStorage`, so two browser windows on one machine are enough to test voting.

## How it was built

Written with AI coding assistance (Claude Code), directed by me. `CLAUDE.md` holds the developer notes the assistant works from, including the platform's architecture.
