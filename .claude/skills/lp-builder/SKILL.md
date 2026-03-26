---
name: lp-builder
description: Clone any landing page from URL or screenshot and generate a production-ready HTML file for GoHighLevel. Use when user asks to clone, build, or recreate a landing page.
user-invocable: true
allowed-tools: Read, Write, Bash, Grep, Agent, WebFetch, WebSearch
---

# Landing Page Builder & Cloner

Clone any landing page from a URL or screenshot, elevate the design, and output a production-ready HTML file for GoHighLevel upload.

## How It Works

This skill uses a **team of specialized agents** working in sequence:

### Agent Pipeline

1. **Scraper Agent** — Fetches the source page via URL (or analyzes screenshot)
   - Extracts all text content, layout structure, colors, fonts
   - Downloads and catalogs all images
   - Maps the page section-by-section (hero, social proof, benefits, CTA, etc.)
   - If the page is JS-rendered and can't be fully scraped, asks for screenshots

2. **Analyzer Agent** — Studies the page's conversion strategy
   - Identifies the funnel type (advertorial, VSL, lead gen, quiz, etc.)
   - Maps persuasion elements (urgency, scarcity, authority, social proof)
   - Notes compliance issues or risky claims
   - Documents the CTA flow and conversion path

3. **Builder Agent** — Generates the production HTML
   - Creates a single self-contained HTML file (inline CSS, no external deps)
   - All images referenced via absolute URLs (CDN or original source)
   - Mobile-responsive (matches or exceeds original)
   - Clean, semantic HTML5
   - Fast-loading (no bloated libraries)
   - If "higher level" requested: upgrades design, strengthens credibility, cleaner layout

4. **QA Agent** — Reviews the output
   - Checks HTML validity
   - Verifies mobile responsiveness
   - Confirms all images load
   - Checks for compliance issues in copy
   - Validates file is under 5MB (GHL limit)

### Output
- HTML file saved to `output/landing-pages/[name]-[timestamp].html`
- File is ready for direct upload to GoHighLevel Custom HTML Pages

## Automatic Activation

Activates when message contains:
- "clone this page", "clone this landing page", "clone this LP"
- "build a landing page", "build me a page", "create a landing page"
- "recreate this page", "copy this page"
- "landing page builder", "lp builder"
- Any `/clone` or `/lp` command

## Required Info (ask if not provided)
1. **Source** — URL to clone OR screenshot of the page
2. **Modifications** — "exact clone", "higher level", or specific changes
3. **Product/offer** — what the page is selling (if changing from original)
4. **Name** — filename for the output (optional, auto-generated if not provided)

## Telegram Commands
- `/clone <url>` — Clone a landing page from URL
- `/lp <description>` — Build a landing page from scratch based on description

## GoHighLevel Upload Instructions

### Image Hosting (Automatic when GHL configured)
When `GHL_API_KEY` and `GHL_LOCATION_ID` are set in `.env`:
- Images are scraped from the source page
- Uploaded to GHL Media Library via `POST /medias/upload-file`
- HTML is updated with GHL-hosted image URLs automatically

### Page Setup in GHL
1. **Sites** → **Funnels** → **+ New Funnel** → Blank
2. Add a funnel step → **Open in builder**
3. Delete default content
4. Add element → **Custom JS/HTML**
5. Paste the generated HTML from the output file
6. Save & publish

### Environment Variables
```
GHL_API_KEY=your_private_integration_token
GHL_LOCATION_ID=your_location_id
```
Get API key: **Settings → Integrations → Private Integration → API Key**
Get Location ID: From the URL when in your sub-account

## Quality Standards
- Every page must be mobile-responsive
- Every page must load in under 3 seconds
- All images must have alt text
- CTAs must be prominent and above the fold
- Copy must be Facebook-ad-policy compliant
- No hardcoded tracking pixels (those get added in GHL)
