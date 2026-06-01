# Tellity Telegram Bot

Tellity is a modular Telegram bot platform focused on productivity, utility tooling, file operations, community engagement, and automation.

## Current Implementation Highlights

- SQLite-backed persistence (`data/tellity.db`) for user tasks, habits, countdowns, timers, stopwatches, rules, links, feedback, and analytics.
- Modular command plugin engine (`/tmp/workspace/RayBen445/Tellity/src/command-plugins.ts`) with centralized routing.
- Built-in command execution logging, per-command analytics, and rate limiting.
- Role-aware command gates for admin-only features such as `/stats`, `/backup`, `/invite`, and `/admins`.
- Utility endpoints:
  - `/api/qr` for QR image generation
  - `/api/barcode` for barcode image generation
  - `/api/color-preview` for color previews
  - `/api/backup` for JSON backup exports
  - `/s/:alias` for short-link redirects with click tracking
- Frontend `App.tsx` now split with reusable modules in:
  - `/tmp/workspace/RayBen445/Tellity/src/utils`
  - `/tmp/workspace/RayBen445/Tellity/src/commands`
  - `/tmp/workspace/RayBen445/Tellity/src/components`

## Vision

Build a production-ready Telegram bot with:

- Modular command plugins
- Multi-user scalability
- Database-backed persistence
- Role-based permissions for admin actions
- Command execution logging
- Built-in analytics and growth tracking

## Command Scope

### Productivity

- `/todo` — personal tasks (add, edit, complete, delete, due dates, status filters, per-user lists)
- `/habit` — habit tracking (daily check-ins, streaks, progress, weekly/monthly reports)
- `/countdown` — event countdowns with day/hour/minute/second precision
- `/timer` — start/pause/resume/cancel timers with completion notifications
- `/stopwatch` — start/pause/resume/reset and elapsed-time display
- `/calendar` — monthly calendar view, events, reminders, and date navigation

### Utility

- `/qr` — QR code generation (text, URL, contact, image download)
- `/shorten` — URL shortener with click tracking, analytics, and aliases
- `/barcode` — barcode generation with multiple formats and image export
- `/password` — secure password generation with configurable options
- `/uuid` — UUID v4 generation with bulk output support
- `/hash` — MD5/SHA1/SHA256/SHA512 and file hashing

### File Tools

- `/mergepdf` — merge multiple PDFs
- `/splitpdf` — split by pages, ranges, or sections
- `/compress` — image compression for JPEG, PNG, and WEBP with quality control
- `/resize` — image resizing with custom sizes, presets, and aspect ratio support
- `/convert` — file conversion for images, documents, and supported audio
- `/ocr` — text extraction from images with language support

### Telegram Features

- `/userinfo` — user metadata and activity stats
- `/chatinfo` — chat metadata, member count, and settings
- `/admins` — administrator list with roles
- `/stats` — bot analytics (users, activity, commands, growth)
- `/invite` — invite link generation and usage tracking
- `/backup` — export bot/user configuration and data

### Community

- `/vote` — single/multiple choice and anonymous voting
- `/quiz` — timed quizzes with scoring and leaderboards
- `/giveaway` — validated entries and random winner selection
- `/leaderboard` — ranking views across configurable categories
- `/suggest` — suggestion collection and status workflows
- `/feedback` — ratings, reviews, reports, and admin alerts

### Developer Tools

- `/json` — JSON formatting and validation
- `/base64` — Base64 encode/decode
- `/regex` — regex testing with match preview and explanation
- `/timestamp` — Unix/human-readable timestamp conversion
- `/color` — HEX/RGB/HSL conversion and previews

### Automation

- `/schedule` — one-time and recurring scheduled messages with timezone support
- `/autodelete` — per-chat auto-deletion rules
- `/autoreply` — keyword/pattern automatic responses
- `/keywords` — keyword actions with analytics
- `/welcome` — customizable group welcome messages with variables/media
- `/goodbye` — customizable leave messages with variables/media

## Technical Requirements

- Persistent database storage for all command data
- Safe multi-user concurrency support
- Rate limiting for abuse prevention
- Role-based access control for admin-only commands
- Usage analytics across all feature modules
- Export and backup capabilities
- Telegram Bot API best-practice compliance
- Scalable architecture for future command expansion

## Local Development

### Prerequisites

- Node.js 20+
- npm

### Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Add required environment variables in `.env.local`.
3. Start development server:

   ```bash
   npm run dev
   ```

### Validation

```bash
npm run lint
npm run build
```
