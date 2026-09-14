# Pocket Dragons · The Choosing

Open `index.html` directly, or serve this folder as a static site. `Start-Game.cmd`
opens it locally on Windows; it is not needed for the hosted version.

## The prototype

Fourteen scenes, sixteen egg affinities. Each choice routes the player to a
different next scene while contributing weighted resonance (5/3/1) to three egg
types.

The last two scenes work differently. Instead of adding a fixed handful of
points, they **amplify what the player has already gathered** — answering
"Anger" scales up whatever heat you'd accumulated, "Calm" scales up your
stillness. This is why the ending feels decisive without narrowing the outcome:
multiplying your own profile can't bottleneck the way adding fixed points to a
fixed subset of eggs does. It also matches what the prose already implies —
"tell us what you carried here" should interpret the journey, not contribute
to it.

The reveal shows the top three as a blend summing to 100%, the full sixteen-egg
constellation relative to the strongest, and — the point of the whole thing —
**which specific choices built the winning egg**. Every contribution is tracked
as what that choice is worth *after* every amplification that followed it, so
the listed figures sum exactly to the score. Nothing on the reveal is
approximate.

The affinity groupings and egg readings are one fan's interpretation, not
official Pocket Dragons material.

Verified properties of the graph:

- 14 scenes, 1,584 complete paths, every one reaching the reveal
- No cycles; path length is bounded between 5 and 8 choices
- No scene unreachable, no dead links, no orphaned assets
- Reveal frequency spread across the sixteen eggs is 1.40 : 1 (max/min)
- #1 and #2 tie in 6.3% of paths (was 28.2% before the amplifier)
- Average winning margin 3.63 points (was 1.26)
- Attribution is mathematically exact on all 1,584 paths
- Every display name matches its art label and asset filename

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
