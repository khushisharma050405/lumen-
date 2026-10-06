# LUMEN — AI Writing Assistant

Lumen is a calm, focused, and elegant AI writing companion re-themed and engineered to match the editorial "Verse" design system: cream backgrounds, sage-green pill buttons, pastel icon tiles, high-contrast serif typography with italic accents, 24px-radius cards, soft elevation shadows, and a leaf emblem.

---

## 🌿 Core Features

1. **Editorial Landing Page (`/`, `/login`, `/signup`)**
   - High-contrast serif display typography (*Write smarter, not harder.*).
   - Realistic writing desk hero visual with books (*Better Writing*, *Bigger Ideas*), coffee, and sun-dappled eucalyptus foliage.
   - Floating interactive preview chips with gentle ambient floating animations (`✦ Grammar corrected ✓`, `More natural phrasing`, sample note card).
   - Six-feature strip with pastel icon tiles linking directly to editing tools:
     - **Grammar Autocorrector** (Peach)
     - **Sentence Autocomplete** (Mint)
     - **Paraphrase Detection** (Lavender)
     - **Text Similarity** (Warm Sand)
     - **Text Generation** (Sky Blue)
     - **Text Summarization** (Rose / Taupe)
   - Auth Card with 24px corner radius: Email input, Password input with reveal/hide toggle, Remember Me, Sage pill submit button, Google OAuth button, and instant Login/Signup mode toggling.

2. **Writing Desk Workspace (`/write`)**
   - Dual-layer mirror editor with wavy underlines for detected issues and faint Tab-accept suggestions.
   - Real-time Toolbar: Fix all, Save draft, Copy, Clear, Sample text, and live metrics (word count, character count, estimated reading time).
   - Four Tabbed Sidebar Panels:
     - **Grammar**: Issue breakdown with one-click fix buttons.
     - **Similarity**: Source text comparison with semantic & lexical match meters and shared phrase chips.
     - **Generate**: Tone-based paragraph drafting (Formal, Concise, Warm) and draft improvement (Tighten, Formalize, Soften, Split long).
     - **Summary**: Interactive extractive summarization with sentence count slider and reduction percentage.

3. **Saved Drafts (`/history`)**
   - Searchable draft library with quick keyword search, word count tags, open-in-editor, and deletion.

4. **Settings (`/settings`)**
   - Toggle switches for real-time grammar checks and tab autocompletions.
   - Configurable default tone, summary length slider, editor typeface (Serif vs. Sans), and font size (15px–24px).

5. **FastAPI Backend + Silent Resilient Fallback**
   - Python FastAPI service providing endpoints for grammar, autocomplete, similarity, paraphrase, generate, improve, summarize, JWT auth, and drafts.
   - Client-side `src/api.js` provides debounced calls and **falls back silently** to `src/nlp.js` client-side heuristics if the backend is unavailable or offline.

---

## 🚀 Quickstart & Run Steps

### 1. Frontend (React 18 + Vite)

```bash
# Install dependencies
npm install

# Start Vite dev server (runs on http://localhost:5173)
npm run dev

# Production build check
npm run build
```

### 2. Backend (FastAPI + Python 3)

```bash
# Navigate to the backend directory
cd backend

# Install dependencies
pip install -r requirements.txt

# Run the FastAPI server (runs on http://127.0.0.1:8000)
uvicorn main:app --reload --port 8000
```

*Note: The frontend operates fully offline even if the FastAPI backend is not running, seamlessly falling back to `src/nlp.js` heuristics.*

---

## 🎨 Design System Tokens (`src/theme.css`)

- **Palette**:
  - Cream Backgrounds: `--verse-cream: #F5EFEB;`, `--verse-cream-light: #FAF7F2;`
  - Sage Green Primary: `--verse-sage-dark: #37483B;`, hover `#29382D`
  - Sage Pill Background: `--verse-sage-pill-bg: #EBF1EC;`
  - High-Contrast Ink: `--verse-ink: #1F2421;`, `--verse-ink-secondary: #58605A;`
  - Pastel Tiles:
    - Peach (`#FEEAE1` / `#D96A43`)
    - Mint (`#E6F0E6` / `#477754`)
    - Lavender (`#EDE7F6` / `#7E62AA`)
    - Warm Sand (`#F7EEDC` / `#A27B3D`)
    - Sky Blue (`#E3F1F7` / `#3E84A6`)
    - Rose / Taupe (`#F4E7E7` / `#995F69`)
- **Typography**:
  - Headings: `Newsreader`, editorial high-contrast serif with graceful italic styling.
  - Body: `Instrument Sans`, clean modern geometric UI sans-serif.
- **Radii**:
  - Cards: `24px` (`--radius-card: 24px;`)
  - Buttons: `9999px` (`--radius-pill: 9999px;`)
  - Inputs: `14px` (`--radius-md: 14px;`)

---

## 🖼️ Assets You Can Replace

The project includes production-ready assets and SVGs. To customize them with your own brand assets:

1. **Hero Desk Photograph (`public/verse_hero_bg.jpg`)**:
   - Location: `public/verse_hero_bg.jpg`
   - Purpose: The background writing desk scene in the landing hero with books and eucalyptus leaves.
   - Recommended replacement: A 16:9 photography asset or 3D render (`1920x1080` or `1600x900` JPEG/WebP) displaying your preferred aesthetic or workspace visual.

2. **Leaf Logo Icon (`src/icons.jsx` -> `LeafIcon`)**:
   - Location: `src/icons.jsx` (the `LeafIcon` SVG component)
   - Purpose: Displayed on the top navigation bar and atop the 24px auth card.
   - Recommended replacement: Swap the SVG path with your official corporate SVG emblem or logo mark.

3. **Backend JWT Secret Key**:
   - Location: `backend/auth.py`
   - Default: `"verse-secret-key-2026-production"`
   - Recommended replacement: Set via `VERSE_JWT_SECRET` environment variable in production.

4. **Google OAuth Client Credentials**:
   - Location: `src/Landing.jsx` (`handleGoogleAuth`) & `backend/auth.py`
   - Default: Simulates authentication with demo user `writer@verse.ai`.
   - Recommended replacement: Plug in your Google OAuth Client ID for live production single sign-on.

---

## 📦 Git Branch & Commit History

Branch: `verse-retheme`

- **Step 1**: Initial audit & baseline commit
- **Step 2**: `Step 2: Create src/theme.css design tokens and apply Verse theme across all pages`
- **Step 3**: `Step 3: Add Landing, Login and Signup pages with Verse hero, floating chips, six-feature strip, and 24px login card`
- **Step 4**: `Step 4: Make layout responsive at 1440, 768, and 375 with subtle floating animations`
- **Step 5**: `Step 5: Add FastAPI backend with NLP, JWT auth, and drafts endpoints`
- **Step 6**: `Step 6: Add src/api.js with debounced calls and silent offline fallback to src/nlp.js`
- **Step 7**: `Step 7: Validate build, test all flows, and update root README with run instructions`
