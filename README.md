# Pocket Dragons · The Choosing

Open `index.html` directly, or serve this folder as a static site. `Start-Game.cmd`
opens it locally on Windows; it is not needed for the hosted version.

## The prototype

Fourteen scenes, sixteen egg affinities. Each choice routes the player to a
different next scene while contributing weighted resonance to one or more egg
types. Routes converge on different kinds of emotional tests, so the same step
can feel different depending on what the player did earlier. The reveal ranks the
top three and shows each as that egg's share of all sixteen affinities — the
three do not sum to 100%, by design.

Verified properties of the graph:

- 14 scenes, 1,584 complete paths, every one reaching the reveal
- No cycles; path length is bounded between 5 and 8 choices
- No scene unreachable, no dead links, no orphaned assets
- Reveal frequency spread across the sixteen eggs is 1.26 : 1 (max/min)

## Deploying to Render

`render.yaml` declares a static site rooted at this folder with long-lived
caching on the image assets and revalidation on the document. No build step.

## Assets

Art is sourced from the supplied Pocket Dragons folder, resized and re-encoded
to WebP for delivery (31 MB of PNG -> 0.76 MB). The original full-resolution PNGs
are the masters and are not part of this deploy.

The two teaser MP4s are **not** bundled here. They were never referenced by the
page and added ~60 MB to the deploy. Re-add them when there is an intro or
trailer panel that actually plays them.

## QA

The test suite runs automatically on GitHub via `.github/workflows/qa.yml` — every
push and pull request. Nothing to install locally; check the Actions tab for a
green tick before letting a commit reach production.

It checks graph structure, replays all 1,584 paths, and drives the real DOM
through **two consecutive playthroughs** (several past bugs only appeared on the
second run). It also asserts that specific past regressions stay fixed: no second
script block, no stray `scene = 0` global, no hardcoded 8-step denominator.

To run it locally instead, if you have Node installed:

    cd qa && npm install && npm test

`qa/` is test-only and not part of the page. Render publishes the repo root, so
the file is reachable at `/qa/qa.js` — it contains no secrets, but move the site
into a subfolder and repoint `staticPublishPath` if you would rather it weren't.
