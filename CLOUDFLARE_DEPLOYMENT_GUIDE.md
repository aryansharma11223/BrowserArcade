# Cloudflare Pages Free — Deployment Guide for Browser Arcade

> **Cost & Architecture Guarantee:**
> - **Total Investment:** Strictly **$0 / ₹0 (Zero Cost)**.
> - **No credit card required.**
> - **Hosting Plan:** Cloudflare Pages Free Tier (unlimited bandwidth, unmetered requests, 500 builds/month).
> - **Terms & Monetization:** A review of Cloudflare's service terms identified **no prohibition on commercial static websites or advertising**.
> - **AdSense Eligibility Note:** While Cloudflare Pages permits advertising, Google independently evaluates all AdSense applications based on its publisher policies, content maturity, and traffic. **AdSense approval is not guaranteed.**
> - **Static Website Architecture:** Zero backend, zero build command, zero runtime dependencies.

---

## 1. Overview & Pre-Deployment Checklist

Browser Arcade is built entirely with vanilla web standards:
- Static HTML5, CSS3, and vanilla JavaScript (ES modules).
- No package manager (`npm`/`yarn`/`pnpm`) or build pipeline (`vite`/`webpack`) is required.
- Global security headers and revalidating asset cache rules configured via `_headers`.
- Custom error page handled via root `404.html`.
- Persistent state handled client-side via browser `localStorage`.

### Local Repository Status
- **Repository:** `https://github.com/aryansharma11223/BrowserArcade`
- **Target Branch:** `main`
- **Production Domain:** `https://browserarcade.pages.dev`
- **Configuration Files:**
  - `_headers`: Defines security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) on `/*` and conditional revalidation caching (`max-age=0, must-revalidate`) on `/assets/*`.
  - `_redirects`: Configures deterministic HTTP 301 permanent redirects enforcing trailing slashes on all directory routes (`/about`, `/games/2048`, `/contact`, `/privacy`, `/terms`).
  - `404.html`: Custom branded fallback page automatically served by Cloudflare Pages on invalid routes.
  - `sitemap.xml` & `robots.txt`: SEO crawling and indexing definitions with pre-deployment placeholder domains.

---

## 2. Step-by-Step Cloudflare Pages Setup

Follow these exact steps in your browser to deploy Browser Arcade for free.

### Step 2.1 — Log in to Cloudflare
1. Go to [https://dash.cloudflare.com/](https://dash.cloudflare.com/).
2. Log in with your free Cloudflare account (or create one for free — no credit card needed).

### Step 2.2 — Navigate to Pages
1. In the left navigation sidebar, select **Compute (Workers & Pages)** or **Workers & Pages**.
2. Click the **Create application** button.
3. Select the **Pages** tab (not Workers).
4. Click **Connect to Git**.

### Step 2.3 — Authorize and Scope GitHub Access
1. Click **Connect GitHub**.
2. When prompted by GitHub for repository permissions:
   - **Recommended Security Practice:** Choose **Only select repositories**.
   - Select **`aryansharma11223/BrowserArcade`** from the repository dropdown.
   - *(Avoid choosing "All repositories" to maintain least-privilege security).*
3. Authorize and install Cloudflare Pages.

### Step 2.4 — Configure Build & Deployment Settings
Select `BrowserArcade` from the list of repositories and click **Begin setup**.

Enter the following configuration settings:

| Setting | Value | Notes |
| :--- | :--- | :--- |
| **Project name** | `browserarcade` | Sets your confirmed free production URL: `https://browserarcade.pages.dev` |
| **Production branch** | `main` | Deploys updates pushed to the `main` branch |
| **Framework preset** | `None` | Browser Arcade is pure static HTML/CSS/JS |
| **Build command** | *(Leave completely empty/blank)* | No compilation or bundling required |
| **Build output directory** | `/` | Serves files directly from the repository root |
| **Root directory** | *(Leave blank)* | Defaults to repository root |
| **Environment variables** | *(None)* | No environment variables or API keys needed |

### Step 2.5 — Deploy
1. Click **Save and Deploy**.
2. Cloudflare will clone the repository and publish the static files in seconds.
3. Once completed, your live site is active at: `https://browserarcade.pages.dev`.

---

## 3. Post-Deployment Verification Checklist

Once Cloudflare displays the green deployment success checkmark, perform these verification checks:

### 3.1 Route & Directory Verification
Verify that all routes resolve cleanly with no 404 or redirect loops:
- `https://browserarcade.pages.dev/` (Arcade Homepage)
- `https://browserarcade.pages.dev/games/2048/` (2048 Game)
- `https://browserarcade.pages.dev/about/` (About Page)
- `https://browserarcade.pages.dev/contact/` (Contact Page)
- `https://browserarcade.pages.dev/privacy/` (Privacy Policy)
- `https://browserarcade.pages.dev/terms/` (Terms & Conditions)

### 3.2 Routing Behavior: Explicit Redirects vs. Built-in Cloudflare Behavior
Browser Arcade clearly distinguishes between explicit repository configuration and Cloudflare Pages native behavior:

#### Explicitly Configured Redirects (`_redirects`)
To eliminate routing ambiguity and ensure consistent canonical trailing slashes for all directory routes, the repository defines five explicit HTTP 301 permanent redirects in `_redirects`:
- `/about` → `/about/` (301)
- `/games/2048` → `/games/2048/` (301)
- `/contact` → `/contact/` (301)
- `/privacy` → `/privacy/` (301)
- `/terms` → `/terms/` (301)

#### Documented Cloudflare Built-in Behavior
Cloudflare Pages provides the following native static routing behaviors according to its official documentation:
- **Directory Index Serving:** Each folder containing an `index.html` file (`/about/index.html`, `/games/2048/index.html`, etc.) is natively served at its directory URL (`/about/`, `/games/2048/`, etc.) with HTTP 200 OK.
- **Extensionless Redirects:** Cloudflare Pages officially documents automatic redirects for extension paths matching directory indexes, such as `/about/index.html` → `/about/`.
- **404 Fallback:** When a requested path does not match any file or directory route, Cloudflare Pages automatically serves the root `404.html` with an HTTP 404 status.

### 3.3 404 Routing Verification
- Navigate to an intentional non-existent URL (e.g., `https://<project-name>.pages.dev/non-existent-test-path`).
- Confirm that the branded custom `404.html` page renders with the "Return to Arcade Hub" link.

### 3.4 Security & Cache Headers Verification
Open your browser's Developer Tools (**F12** -> **Network** tab), refresh the page, and select the document or an asset:
- **HTML Pages** (`/`, `/games/2048/`, etc.):
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - *Must NOT contain immutable cache headers to ensure instant updates.*
- **Static Assets** (`/assets/css/style.css`, `/assets/js/main.js`, etc.):
  - `Cache-Control: public, max-age=0, must-revalidate`
  - *Because assets are not content-hashed, `max-age=0, must-revalidate` ensures browsers check for fresh versions with lightweight 304 ETag revalidation and updates are never blocked by stale cache.*

### 3.5 2048 Gameplay & Storage Verification
- Test Arrow keys, WASD keys, and mobile touch swipes.
- Press **Undo** after a move to verify full state restoration.
- Refresh the page and confirm that `arcade_2048_bestScore` persists in `localStorage`.
- Toggle Sound: confirm Web Audio synthesizes move/merge/game-over sounds cleanly without errors in the DevTools console.

---

## 4. Production Domain & Future Custom Domain Guidance

Browser Arcade is configured for its confirmed production domain:
`https://browserarcade.pages.dev`

All production metadata elements are configured with this address:
- Canonical links across all 6 pages (`https://browserarcade.pages.dev/...`)
- Open Graph URLs (`og:url`) and preview image (`og:image`)
- Twitter card image tags (`twitter:image`)
- `sitemap.xml` with all 6 production route URLs
- `robots.txt` referencing `https://browserarcade.pages.dev/sitemap.xml`

### Future Custom Domain Update (Optional)
If you decide to bind a custom domain in the future (e.g. `https://yourcustomdomain.com`), follow these steps:
1. **Update Canonical URLs** to the new domain across all 6 HTML files.
2. **Update Open Graph and Twitter tags** (`og:url`, `og:image`, `twitter:image`) across all 6 HTML files.
3. **Update `sitemap.xml`** with the new domain.
4. **Update `robots.txt`** sitemap reference with the new domain.

> **Note on Zero Cost & Monetization:**
> - Cloudflare Pages allows adding custom domains at **$0 / ₹0 cost** with automatic free SSL/TLS certificates.
> - Regardless of domain choice (whether `*.pages.dev` or a custom domain), Cloudflare Pages Free has no identified prohibition on advertising, and Google independently evaluates all AdSense applications based on publisher criteria (**AdSense approval is not guaranteed**).

---

## 5. Managing or Disconnecting the GitHub Integration

If you ever wish to revoke access or pause deployments:
- **From Cloudflare:**
  - In the Pages project dashboard, go to **Settings** -> **Builds & deployments**.
  - Under **Source repository**, you can pause builds or disconnect the repository.
- **From GitHub:**
  - Go to your GitHub account **Settings** -> **Applications** -> **Installed GitHub Apps**.
  - Select **Cloudflare Pages** and click **Uninstall** or adjust repository access.
