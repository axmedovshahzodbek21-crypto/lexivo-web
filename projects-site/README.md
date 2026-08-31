# Lexivo Projects

A standalone, static project-preview site for the Lexivo studio:
**Lexivo**, **IELTS CDI**, and **Batch** — plus an open slot for the next one.

No build step. Plain HTML/CSS/JS. Deploy anywhere that serves static files.

```
index.html          markup + all SEO tags (title, description, OG, Twitter, JSON-LD)
styles.css          design system (light + dark, theme toggle)
script.js           the PROJECTS array + rendering  ← edit this to add a project
favicon.svg
og-image.svg        source for the social image — export to og-image.png (see below)
site.webmanifest
robots.txt
sitemap.xml
vercel.json         cleanUrls + cache headers (ignored by non-Vercel hosts)
```

## Add a project

Open `script.js`, copy an existing object in the `PROJECTS` array, and edit it.
Fields are documented in the comment at the top of that file. Minimum:

```js
{
  name: "New Thing",
  kind: "Web app",
  accent: "#e0a72c",         // "lexivo" | "cdi" | "batch" | any hex
  status: "In progress",
  tagline: "One sentence about what it does.",
  features: ["thing one", "thing two"],
  stack: ["React", "TypeScript"],
  art: "cards",               // "cards" | "gauge" | "amrap" | omit
  links: [{ label: "Visit ↗", href: "https://example.com" }],
}
```

The card renders itself. The hero count updates automatically.
No other file needs to change unless the project gets its own page (then add a
`<url>` to `sitemap.xml`).

## Set the real domain

The placeholder domain is `https://projects.lexivo.app`. Before going live,
find-and-replace it in:

- `index.html` (canonical, `og:*`, `twitter:*`, JSON-LD `@id`s)
- `robots.txt`
- `sitemap.xml`
- `site.webmanifest` (only if you host under a subpath)

## Social share image

`og-image.svg` is the design source. Crawlers do **not** render SVG OG images,
so export a PNG named `og-image.png` (1200×630) next to it. Easiest options:

```bash
# with rsvg-convert
rsvg-convert -w 1200 -h 630 og-image.svg -o og-image.png

# or with a headless Chrome / any "SVG to PNG 1200x630" tool
```

Then verify with the [OpenGraph](https://www.opengraph.xyz/) or Twitter card
validator after deploying.

## Deploy

**Vercel** — `vercel` from this folder, or point a new project at the repo with
framework preset "Other" and no build command.

**Netlify** — drag-and-drop the folder, or set build command empty and publish
directory to `.`.

**GitHub Pages** — push to a repo, enable Pages from the branch root. Remove
`vercel.json` (harmless but unused).

## Local preview

```bash
python -m http.server 8000
# or:  npx serve .
```

Then open <http://localhost:8000>.
