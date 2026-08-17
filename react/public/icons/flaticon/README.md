# Flaticon assets

Unlike Font Awesome (loaded as a stylesheet in `react/index.html`), Flaticon
is **not** a library you can install — there is no npm package or CDN that
serves its catalogue. It's a stock marketplace: you download each icon you
want as an individual file, and that file becomes part of this repo.

## Adding an icon

1. Download the icon from https://www.flaticon.com/ (prefer **SVG** — it
   stays sharp at any size; PNG only if the icon isn't offered as SVG).
2. Drop the file in this folder with a descriptive, kebab-case name, e.g.
   `bookmark-filled.svg` — not `free-icon-bookmark-1828970.svg`.
3. Record it in the attribution table below.

## Using one

Files here are served straight off the site root, so reference them by path
from `/icons/flaticon/`:

```jsx
<img src="/icons/flaticon/bookmark-filled.svg" alt="" className="site-icon" />
```

Nothing needs importing or rebuilding — `react/public/` is copied verbatim
into the build output.

## Attribution (required on the free tier)

Flaticon's free licence requires visible credit wherever the icon appears,
or a single site-wide credit line. Paid plans drop this requirement — check
which plan the downloading account is on before assuming either way.

Keep one row per icon so the credit line can be regenerated from this table:

| File | Icon page | Author |
| ---- | --------- | ------ |
| _(none yet)_ | | |
