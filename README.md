# 🤖 Tellity Telegram Bot Hub & Sandbox Console

A high-performance, full-stack, production-ready Telegram Bot sandbox system built on Node.js, Express, TypeScript, Vite, and React 18. Equipped with **36+ advanced command modules**, cryptographic utilties, file compilers, real-time telemetry analytics, interactive community loops, and server-side visual rendering engines.

---

## 🚀 Key Features & Commands

### 📅 Productivity Commands
*   `/todo` — Fully featured personal task manager. Support task creations, checklists, status updates, deletions, and custom target schedules.
*   `/habit` — Interactive daily habit streak and progress tracker with monthly reports.
*   `/countdown` — Multi-timer countdown to custom dates showing exact days, hours, and minutes remaining.
*   `/timer` — Interactive pauseable and resumeable alarms that alert you in-chat when due.
*   `/stopwatch` — Split lap timers and millisecond diagnostic stopwatches.
*   `/calendar` — Real-time monthly Gregorian visual calendar grid render.

### 🛠️ Utility Commands
*   `/qr` — Generates and returns pixel-perfect QR Code image URLs and instant file cards in-chat.
*   `/barcode` — Encodes any sequence string into high-fidelity downloadable barcode visual elements.
*   `/shorten` — Production-ready URL shortener and click metric reporter using the `tinyurl` engine.
*   `/password` — Secure random cryptographic password customizer.
*   `/uuid` — Standard high-entropy UUID V4 tracker.
*   `/hash` — Instantly hashes messages using SHA-256, MD5, or SHA-1 hashes.

### 📄 File Tools & Image Editors
*   `/mergepdf` — Consolidates multiple remote PDF documents in a single high-quality merged file using `pdf-lib`.
*   `/splitpdf` — Extracts precision page ranges from a target PDF document buffer on the fly.
*   `/compress` — Performs deep image compression adjusting output WEBP quality ratios using `sharp`.
*   `/resize` — Refills and resizes image buffers to custom pixel dimensions dynamically.
*   `/convert` — Transforms images seamlessly across PNG, JPG, WEBP, and GIF standard media types.
*   `/ocr` — Connects to advanced server-side Gemini Vision models (`gemini-3.5-flash`) to perform character recognition from direct URLs or file uploads.

### 📡 core Telegram Features
*   `/userinfo` — Decodes user permission tiers, active roles, and historical API interaction indexes.
*   `/chatinfo` — Diagnostic status reporting about active conversation channels and group parameters.
*   `/admins` — Audits list of conversation moderators and permissions indices.
*   `/stats` — Live analytics dashboards illustrating top command usage counts and trend vectors.
*   `/invite` — Generates expiring group invite keys with limited user entry slots.
*   `/backup` — Securely compiles database state `database.json` into a single downloadable JSON backup attachment. (Administrators only).

### 🏆 Interactive Community Loop
*   `/vote` — Generates anonymous multi-choice user polls with real-time tally tracking.
*   `/quiz` — Interactive trivia questions updating cumulative player scorecard leaderboards (`/leaderboard`).
*   `/giveaway` — RNG-validated raffle draws selecting random winners across input candidate pools.
*   `/suggest` — Submits and logs suggestion review ballots directly into backend databases.
*   `/feedback` — Registers 1-5 star ratings and reviews to monitor interface satisfaction logs.

### ⚙️ Developer Tools
*   `/json` — Standard JSON syntax validator and beautifier formatting outputs with tab structure indentation.
*   `/base64` — High-speed Base64 text string encoder and decoder.
*   `/regex` — Comprehensive RegExp compiler and tester highlighting matches and captured groups.
*   `/timestamp` — Epoc-gregorian date string bi-directional converters.
*   `/color` — Decodes color inputs to RGB/HSL and render clean 200x200 solid swatch PNG previews.

### 🤖 Advanced Automation
*   `/schedule` — Sets automated back-ground alerts executing on precise timings.
*   `/sys_autodelete` — Cleans outbound chat memory, auto-deleting system dispatches after short delay parameters.
*   `/autoreply` — Standard keyword interceptor replying custom terms automatically.
*   `/keywords` — Phrase analyzer registering usage analytics and analytics indexes.
*   `/welcome` — Custom templates played when new participants enter discussion areas.
*   `/goodbye` — Exit messages logged when memory registers clean.

---

## 🗄️ Database Management (`/src/db.ts`)

Data layers use a file-backed JSON store (`database.json`) providing:
*   Multi-user data isolation.
*   Role-Based Access Control (RBAC) tiers: `admin` | `moderator` | `user`.
*   Transactional operations protecting state updates.

---

## 🛠️ Setup & Running Locally

1.  **Environment Variables**:
    Clone `.env.example` as `.env` and configure accordingly:
    ```env
    TELEGRAM_BOT_TOKEN=your_token_here
    GEMINI_API_KEY=your_gemini_key_here
    APP_URL=https://your-public-endpoint.com
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Boot Dev Server**:
    Runs Express and compiles React client assets seamlessly:
    ```bash
    npm run dev
    ```

4.  **Production build**:
    ```bash
    npm run build
    npm run start
    ```

---

## 📜 MIT LICENSE

Copyright (c) 2026 Tellity Bot Hub Developers

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
