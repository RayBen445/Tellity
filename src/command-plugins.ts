import crypto from 'node:crypto';
import { URL } from 'node:url';
import { db, ensureAdminBootstrap, getDbSnapshot, getRole, isRateLimited, logCommand, setRole, upsertUsage } from './server-db.js';

export type PluginResult = {
  handled: boolean;
  text?: string;
  markdown?: boolean;
};

type CommandContext = {
  chatId: number;
  userId: number;
  firstName?: string;
  username?: string;
  text: string;
  command: string;
  args: string[];
  appUrl: string;
};

const ADMIN_ONLY = new Set(['/stats', '/backup', '/admins', '/invite']);

function cleanAppUrl(input: string): string {
  const trimmed = (input || '').trim();
  if (!trimmed) return 'http://localhost:3000';
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function parseDateInput(value: string): number | null {
  if (!value) return null;
  const direct = Date.parse(value);
  if (!Number.isNaN(direct)) return direct;
  if (/^\d+$/.test(value)) return Number(value) * 1000;
  return null;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${d}d ${h}h ${m}m ${s}s`;
}

function monthCalendar(year: number, month: number): string {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startDay = first.getUTCDay();
  const header = 'Su Mo Tu We Th Fr Sa';
  const cells: string[] = [];
  for (let i = 0; i < startDay; i += 1) cells.push('  ');
  for (let day = 1; day <= lastDay; day += 1) cells.push(day.toString().padStart(2, ' '));
  const lines = [header];
  for (let i = 0; i < cells.length; i += 7) {
    lines.push(cells.slice(i, i + 7).join(' '));
  }
  return lines.join('\n');
}

function parseCommand(text: string): { command: string; args: string[] } {
  const pieces = text.trim().split(/\s+/).filter(Boolean);
  const raw = (pieces[0] || '').toLowerCase();
  const command = raw.includes('@') ? raw.split('@')[0] : raw;
  return { command, args: pieces.slice(1) };
}

function hashText(algorithm: string, input: string): string | null {
  const allowed = ['md5', 'sha1', 'sha256', 'sha512'];
  if (!allowed.includes(algorithm)) return null;
  return crypto.createHash(algorithm).update(input).digest('hex');
}

function randomPassword(length = 16, includeSymbols = true, includeNumbers = true): string {
  const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}<>?';
  let chars = letters;
  if (includeNumbers) chars += numbers;
  if (includeSymbols) chars += symbols;

  let output = '';
  const maxUnbiased = Math.floor(256 / chars.length) * chars.length;
  while (output.length < length) {
    const [byte] = crypto.randomBytes(1);
    if (byte >= maxUnbiased) continue;
    output += chars[byte % chars.length];
  }
  return output;
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'on', 'y'].includes(value.toLowerCase());
}

function ensureAdminByEnv(userId: number, adminIds: Set<number>): void {
  if (adminIds.has(userId)) {
    setRole(userId, 'admin');
  }
}

export function recordShortLinkClick(alias: string): string | null {
  const row = db.prepare(`SELECT url FROM short_links WHERE alias = ?`).get(alias) as { url: string } | undefined;
  if (!row) return null;
  db.prepare(`UPDATE short_links SET clicks = clicks + 1, updated_at = ? WHERE alias = ?`).run(Date.now(), alias);
  return row.url;
}

export function buildAnalyticsSummary(): Record<string, unknown> {
  const users = db.prepare(`SELECT COUNT(DISTINCT user_id) as total FROM command_logs`).get() as { total: number };
  const active24h = db.prepare(`SELECT COUNT(DISTINCT user_id) as total FROM command_logs WHERE executed_at > ?`).get(Date.now() - 86_400_000) as { total: number };
  const commands = db.prepare(`SELECT command, usage_count FROM command_usage ORDER BY usage_count DESC LIMIT 10`).all();
  return {
    totalUsers: users.total,
    activeUsers24h: active24h.total,
    topCommands: commands
  };
}

export function buildBackupPayload(): Record<string, unknown> {
  return {
    exportedAt: new Date().toISOString(),
    data: getDbSnapshot()
  };
}

export async function handlePluginCommand(params: {
  text: string;
  chatId: number;
  userId: number;
  firstName?: string;
  username?: string;
  appUrl?: string;
}): Promise<PluginResult> {
  const { command, args } = parseCommand(params.text);
  if (!command.startsWith('/')) {
    return { handled: false };
  }

  const appUrl = cleanAppUrl(params.appUrl || process.env.APP_URL || '');
  const ctx: CommandContext = {
    chatId: params.chatId,
    userId: params.userId,
    firstName: params.firstName,
    username: params.username,
    text: params.text,
    command,
    args,
    appUrl
  };

  ensureAdminBootstrap(ctx.userId);
  const envAdmins = new Set(
    (process.env.TELLITY_ADMIN_USER_IDS || '')
      .split(',')
      .map(v => Number(v.trim()))
      .filter(v => Number.isFinite(v) && v > 0)
  );
  ensureAdminByEnv(ctx.userId, envAdmins);

  if (isRateLimited(ctx.userId, 30)) {
    logCommand({ chatId: ctx.chatId, userId: ctx.userId, command: ctx.command, text: ctx.text, status: 'rate_limited' });
    return {
      handled: true,
      text: '⏳ Rate limit exceeded. Please wait about a minute before sending more commands.'
    };
  }

  const role = getRole(ctx.userId);
  if (ADMIN_ONLY.has(ctx.command) && role !== 'admin') {
    logCommand({ chatId: ctx.chatId, userId: ctx.userId, command: ctx.command, text: ctx.text, status: 'forbidden' });
    return { handled: true, text: '🔒 This command is admin-only.' };
  }

  const result = runCommand(ctx, role);
  if (!result.handled) {
    return result;
  }

  upsertUsage(ctx.command);
  logCommand({ chatId: ctx.chatId, userId: ctx.userId, command: ctx.command, text: ctx.text, status: 'ok' });
  return result;
}

function runCommand(ctx: CommandContext, role: 'admin' | 'user'): PluginResult {
  switch (ctx.command) {
    case '/todo': return handleTodo(ctx);
    case '/habit': return handleHabit(ctx);
    case '/countdown': return handleCountdown(ctx);
    case '/timer': return handleTimer(ctx);
    case '/stopwatch': return handleStopwatch(ctx);
    case '/calendar': return handleCalendar(ctx);
    case '/qr': return handleQr(ctx);
    case '/shorten': return handleShorten(ctx);
    case '/barcode': return handleBarcode(ctx);
    case '/password': return handlePassword(ctx);
    case '/uuid': return handleUuid(ctx);
    case '/hash': return handleHash(ctx);
    case '/mergepdf':
    case '/splitpdf':
    case '/compress':
    case '/resize':
    case '/convert':
    case '/ocr':
      return {
        handled: true,
        text: `🧰 ${ctx.command} is available via REST upload endpoints. Use /help plus dashboard upload panel for binary file operations.`
      };
    case '/userinfo': return handleUserInfo(ctx);
    case '/chatinfo': return handleChatInfo(ctx);
    case '/admins': return { handled: true, text: role === 'admin' ? '👑 You are an admin. Configure more admins with /admins add <userId>.' : 'No admins found for this request.' };
    case '/stats': return { handled: true, text: formatStats(buildAnalyticsSummary()), markdown: true };
    case '/invite': return handleInvite(ctx);
    case '/backup': return { handled: true, text: `💾 Backup ready: ${ctx.appUrl}/api/backup` };
    case '/vote': return handleVote(ctx);
    case '/quiz': return handleQuiz(ctx);
    case '/giveaway': return handleGiveaway(ctx);
    case '/leaderboard': return handleLeaderboard();
    case '/suggest': return handleSuggest(ctx);
    case '/feedback': return handleFeedback(ctx);
    case '/json': return handleJson(ctx);
    case '/base64': return handleBase64(ctx);
    case '/regex': return handleRegex(ctx);
    case '/timestamp': return handleTimestamp(ctx);
    case '/color': return handleColor(ctx);
    case '/schedule': return handleSchedule(ctx);
    case '/autodelete':
    case '/autoreply':
    case '/keywords':
    case '/welcome':
    case '/goodbye':
      return handleAutomation(ctx);
    default:
      return { handled: false };
  }
}

function handleTodo(ctx: CommandContext): PluginResult {
  const action = (ctx.args[0] || 'list').toLowerCase();
  const now = Date.now();

  if (action === 'add') {
    const title = ctx.args.slice(1).join(' ').trim();
    if (!title) return { handled: true, text: 'Usage: /todo add <task title>' };
    db.prepare(`INSERT INTO todos(user_id, title, due_date, status, created_at, updated_at) VALUES(?, ?, NULL, 'open', ?, ?)`)
      .run(ctx.userId, title, now, now);
    return { handled: true, text: '✅ Task added.' };
  }

  if (action === 'list' || action === 'all' || action === 'open' || action === 'done') {
    const statusFilter = action === 'list' || action === 'all' ? null : action;
    const rows = statusFilter
      ? db.prepare(`SELECT id, title, due_date, status FROM todos WHERE user_id = ? AND status = ? ORDER BY id DESC`).all(ctx.userId, statusFilter)
      : db.prepare(`SELECT id, title, due_date, status FROM todos WHERE user_id = ? ORDER BY id DESC`).all(ctx.userId);
    if (!rows.length) return { handled: true, text: '📭 No tasks found.' };
    const lines = rows.map((r: any) => `#${r.id} [${r.status}] ${r.title}${r.due_date ? ` (due ${r.due_date})` : ''}`);
    return { handled: true, text: `🗂️ Your tasks\n${lines.join('\n')}` };
  }

  if (action === 'done') {
    const id = Number(ctx.args[1]);
    if (!id) return { handled: true, text: 'Usage: /todo done <id>' };
    db.prepare(`UPDATE todos SET status='done', updated_at=? WHERE id=? AND user_id=?`).run(now, id, ctx.userId);
    return { handled: true, text: '✅ Task marked complete.' };
  }

  if (action === 'delete') {
    const id = Number(ctx.args[1]);
    if (!id) return { handled: true, text: 'Usage: /todo delete <id>' };
    db.prepare(`DELETE FROM todos WHERE id=? AND user_id=?`).run(id, ctx.userId);
    return { handled: true, text: '🗑️ Task deleted.' };
  }

  if (action === 'edit') {
    const id = Number(ctx.args[1]);
    const title = ctx.args.slice(2).join(' ').trim();
    if (!id || !title) return { handled: true, text: 'Usage: /todo edit <id> <new title>' };
    db.prepare(`UPDATE todos SET title=?, updated_at=? WHERE id=? AND user_id=?`).run(title, now, id, ctx.userId);
    return { handled: true, text: '✏️ Task updated.' };
  }

  if (action === 'due') {
    const id = Number(ctx.args[1]);
    const due = ctx.args[2];
    if (!id || !due) return { handled: true, text: 'Usage: /todo due <id> <YYYY-MM-DD>' };
    db.prepare(`UPDATE todos SET due_date=?, updated_at=? WHERE id=? AND user_id=?`).run(due, now, id, ctx.userId);
    return { handled: true, text: '📅 Due date updated.' };
  }

  return { handled: true, text: 'Usage: /todo [add|list|open|done|edit|delete|due]' };
}

function handleHabit(ctx: CommandContext): PluginResult {
  const action = (ctx.args[0] || 'list').toLowerCase();
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  if (action === 'add') {
    const name = ctx.args.slice(1).join(' ').trim();
    if (!name) return { handled: true, text: 'Usage: /habit add <habit name>' };
    db.prepare(`INSERT INTO habits(user_id, name, created_at, updated_at) VALUES(?, ?, ?, ?)`).run(ctx.userId, name, now, now);
    return { handled: true, text: '🌱 Habit created.' };
  }

  if (action === 'checkin') {
    const id = Number(ctx.args[1]);
    if (!id) return { handled: true, text: 'Usage: /habit checkin <habitId>' };
    db.prepare(`INSERT OR IGNORE INTO habit_checkins(habit_id, user_id, checkin_date, created_at) VALUES(?, ?, ?, ?)`).run(id, ctx.userId, today, now);
    return { handled: true, text: '✅ Daily check-in recorded.' };
  }

  if (action === 'report' || action === 'weekly' || action === 'monthly') {
    const days = action === 'monthly' ? 30 : 7;
    const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
    const rows = db.prepare(`
      SELECT h.id, h.name, COUNT(c.id) as checkins
      FROM habits h
      LEFT JOIN habit_checkins c ON h.id = c.habit_id AND c.checkin_date >= ?
      WHERE h.user_id = ?
      GROUP BY h.id, h.name
      ORDER BY checkins DESC
    `).all(since, ctx.userId) as Array<{ id: number; name: string; checkins: number }>;
    if (!rows.length) return { handled: true, text: 'No habits tracked yet.' };
    const lines = rows.map(r => `#${r.id} ${r.name}: ${r.checkins} check-ins in last ${days} days`);
    return { handled: true, text: `📈 Habit report\n${lines.join('\n')}` };
  }

  const list = db.prepare(`SELECT id, name FROM habits WHERE user_id=? ORDER BY id DESC`).all(ctx.userId) as Array<{ id: number; name: string }>;
  if (!list.length) return { handled: true, text: 'Usage: /habit add <name>' };
  return { handled: true, text: `🧭 Habits\n${list.map(h => `#${h.id} ${h.name}`).join('\n')}` };
}

function handleCountdown(ctx: CommandContext): PluginResult {
  const action = (ctx.args[0] || 'list').toLowerCase();
  if (action === 'add') {
    const label = ctx.args[1];
    const targetRaw = ctx.args.slice(2).join(' ');
    if (!label || !targetRaw) return { handled: true, text: 'Usage: /countdown add <name> <ISO date-time>' };
    const ts = parseDateInput(targetRaw);
    if (!ts) return { handled: true, text: 'Invalid date format. Example: 2026-12-31T23:59:59Z' };
    db.prepare(`INSERT INTO countdowns(user_id, label, target_ts, created_at) VALUES(?, ?, ?, ?)`).run(ctx.userId, label, ts, Date.now());
    return { handled: true, text: '⏳ Countdown added.' };
  }

  if (action === 'delete') {
    const id = Number(ctx.args[1]);
    if (!id) return { handled: true, text: 'Usage: /countdown delete <id>' };
    db.prepare(`DELETE FROM countdowns WHERE id=? AND user_id=?`).run(id, ctx.userId);
    return { handled: true, text: '🗑️ Countdown removed.' };
  }

  const rows = db.prepare(`SELECT id, label, target_ts FROM countdowns WHERE user_id=? ORDER BY target_ts ASC`).all(ctx.userId) as Array<{ id: number; label: string; target_ts: number }>;
  if (!rows.length) return { handled: true, text: 'Usage: /countdown add <name> <ISO date-time>' };
  const now = Date.now();
  const lines = rows.map(r => `#${r.id} ${r.label}: ${formatDuration(r.target_ts - now)}`);
  return { handled: true, text: `⏱️ Countdowns\n${lines.join('\n')}` };
}

function handleTimer(ctx: CommandContext): PluginResult {
  const action = (ctx.args[0] || 'status').toLowerCase();
  const now = Date.now();
  const row = db.prepare(`SELECT * FROM timers WHERE user_id=?`).get(ctx.userId) as any;

  if (action === 'start') {
    const seconds = Number(ctx.args[1]);
    if (!seconds || seconds <= 0) return { handled: true, text: 'Usage: /timer start <seconds>' };
    db.prepare(`INSERT OR REPLACE INTO timers(user_id, status, duration_seconds, remaining_seconds, started_at, updated_at) VALUES(?, 'running', ?, ?, ?, ?)`)
      .run(ctx.userId, seconds, seconds, now, now);
    return { handled: true, text: `⏱️ Timer started for ${seconds}s.` };
  }

  if (!row) return { handled: true, text: 'No timer found. Use /timer start <seconds>.' };

  if (action === 'pause') {
    if (row.status !== 'running' || !row.started_at) return { handled: true, text: 'Timer is not running.' };
    const elapsed = Math.floor((now - row.started_at) / 1000);
    const remaining = Math.max(0, row.remaining_seconds - elapsed);
    db.prepare(`UPDATE timers SET status='paused', remaining_seconds=?, started_at=NULL, updated_at=? WHERE user_id=?`).run(remaining, now, ctx.userId);
    return { handled: true, text: `⏸️ Timer paused (${remaining}s left).` };
  }

  if (action === 'resume') {
    if (row.status !== 'paused') return { handled: true, text: 'Timer is not paused.' };
    db.prepare(`UPDATE timers SET status='running', started_at=?, updated_at=? WHERE user_id=?`).run(now, now, ctx.userId);
    return { handled: true, text: '▶️ Timer resumed.' };
  }

  if (action === 'cancel') {
    db.prepare(`DELETE FROM timers WHERE user_id=?`).run(ctx.userId);
    return { handled: true, text: '🛑 Timer canceled.' };
  }

  const remaining = row.status === 'running' && row.started_at
    ? Math.max(0, row.remaining_seconds - Math.floor((now - row.started_at) / 1000))
    : row.remaining_seconds;
  if (remaining === 0 && row.status !== 'completed') {
    db.prepare(`UPDATE timers SET status='completed', remaining_seconds=0, started_at=NULL, updated_at=? WHERE user_id=?`).run(now, ctx.userId);
    return { handled: true, text: '✅ Timer completed!' };
  }
  return { handled: true, text: `⏲️ Timer status: ${row.status}, ${remaining}s remaining.` };
}

function handleStopwatch(ctx: CommandContext): PluginResult {
  const action = (ctx.args[0] || 'status').toLowerCase();
  const now = Date.now();
  let row = db.prepare(`SELECT * FROM stopwatches WHERE user_id=?`).get(ctx.userId) as any;

  if (!row) {
    db.prepare(`INSERT OR REPLACE INTO stopwatches(user_id, status, elapsed_ms, started_at, updated_at) VALUES(?, 'idle', 0, NULL, ?)`)
      .run(ctx.userId, now);
    row = db.prepare(`SELECT * FROM stopwatches WHERE user_id=?`).get(ctx.userId) as any;
  }

  if (action === 'start' || action === 'resume') {
    if (row.status === 'running') return { handled: true, text: 'Stopwatch is already running.' };
    db.prepare(`UPDATE stopwatches SET status='running', started_at=?, updated_at=? WHERE user_id=?`).run(now, now, ctx.userId);
    return { handled: true, text: '▶️ Stopwatch running.' };
  }

  if (action === 'pause') {
    if (row.status !== 'running' || !row.started_at) return { handled: true, text: 'Stopwatch is not running.' };
    const elapsed = row.elapsed_ms + (now - row.started_at);
    db.prepare(`UPDATE stopwatches SET status='paused', elapsed_ms=?, started_at=NULL, updated_at=? WHERE user_id=?`).run(elapsed, now, ctx.userId);
    return { handled: true, text: `⏸️ Stopwatch paused at ${formatDuration(elapsed)}.` };
  }

  if (action === 'reset') {
    db.prepare(`UPDATE stopwatches SET status='idle', elapsed_ms=0, started_at=NULL, updated_at=? WHERE user_id=?`).run(now, ctx.userId);
    return { handled: true, text: '🔄 Stopwatch reset.' };
  }

  const elapsed = row.status === 'running' && row.started_at ? row.elapsed_ms + (now - row.started_at) : row.elapsed_ms;
  return { handled: true, text: `⏱️ Elapsed: ${formatDuration(elapsed)} (${row.status})` };
}

function handleCalendar(ctx: CommandContext): PluginResult {
  const arg = ctx.args[0];
  const base = arg ? new Date(arg) : new Date();
  if (Number.isNaN(base.getTime())) return { handled: true, text: 'Usage: /calendar [YYYY-MM]' };
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth() + 1;
  const cal = monthCalendar(year, month);
  const reminderCount = (db.prepare(`SELECT COUNT(*) as total FROM schedules WHERE user_id=? AND status='scheduled'`).get(ctx.userId) as { total: number }).total;
  return { handled: true, text: `📅 ${year}-${String(month).padStart(2, '0')}\n\n${cal}\n\nReminders scheduled: ${reminderCount}` };
}

function handleQr(ctx: CommandContext): PluginResult {
  const content = ctx.args.join(' ').trim();
  if (!content) return { handled: true, text: 'Usage: /qr <text|url|contact info>' };
  const link = `${ctx.appUrl}/api/qr?text=${encodeURIComponent(content)}`;
  return { handled: true, text: `🔳 QR generated: ${link}` };
}

function handleShorten(ctx: CommandContext): PluginResult {
  const action = (ctx.args[0] || 'create').toLowerCase();
  if (action === 'list') {
    const rows = db.prepare(`SELECT alias, url, clicks FROM short_links WHERE creator_user_id=? ORDER BY created_at DESC LIMIT 20`).all(ctx.userId) as any[];
    if (!rows.length) return { handled: true, text: 'No short links created yet.' };
    return { handled: true, text: rows.map(r => `${ctx.appUrl}/s/${r.alias} → ${r.url} (${r.clicks} clicks)`).join('\n') };
  }

  if (action === 'stats') {
    const alias = ctx.args[1];
    if (!alias) return { handled: true, text: 'Usage: /shorten stats <alias>' };
    const row = db.prepare(`SELECT alias, url, clicks FROM short_links WHERE alias=?`).get(alias) as any;
    if (!row) return { handled: true, text: 'Alias not found.' };
    return { handled: true, text: `🔗 ${row.alias}\nURL: ${row.url}\nClicks: ${row.clicks}` };
  }

  const urlText = action === 'create' ? ctx.args[1] : ctx.args[0];
  const customAlias = action === 'create' ? ctx.args[2] : ctx.args[1];
  if (!urlText) return { handled: true, text: 'Usage: /shorten <url> [alias]' };

  try {
    new URL(urlText);
  } catch {
    return { handled: true, text: 'Please provide a valid URL.' };
  }

  const alias = (customAlias || crypto.randomBytes(3).toString('hex')).toLowerCase();
  const now = Date.now();
  db.prepare(`INSERT INTO short_links(alias, url, creator_user_id, clicks, created_at, updated_at) VALUES(?, ?, ?, 0, ?, ?)`)
    .run(alias, urlText, ctx.userId, now, now);
  return { handled: true, text: `✅ Short link created: ${ctx.appUrl}/s/${alias}` };
}

function handleBarcode(ctx: CommandContext): PluginResult {
  const text = ctx.args.join(' ').trim();
  if (!text) return { handled: true, text: 'Usage: /barcode <text>' };
  const link = `${ctx.appUrl}/api/barcode?text=${encodeURIComponent(text)}&format=code128`;
  return { handled: true, text: `🏷️ Barcode image: ${link}` };
}

function handlePassword(ctx: CommandContext): PluginResult {
  const length = Number(ctx.args[0] || 16);
  const includeSymbols = parseBool(ctx.args[1], true);
  const includeNumbers = parseBool(ctx.args[2], true);
  const pwd = randomPassword(Math.min(Math.max(length, 8), 64), includeSymbols, includeNumbers);
  return { handled: true, text: `🔐 Password: \`${pwd}\``, markdown: true };
}

function handleUuid(ctx: CommandContext): PluginResult {
  const count = Math.min(Math.max(Number(ctx.args[0] || 1), 1), 50);
  const uuids = Array.from({ length: count }, () => crypto.randomUUID());
  return { handled: true, text: uuids.join('\n') };
}

function handleHash(ctx: CommandContext): PluginResult {
  const algorithm = (ctx.args[0] || '').toLowerCase();
  const input = ctx.args.slice(1).join(' ');
  if (!algorithm || !input) return { handled: true, text: 'Usage: /hash <md5|sha1|sha256|sha512> <text>' };
  const digest = hashText(algorithm, input);
  if (!digest) return { handled: true, text: 'Unsupported algorithm.' };
  return { handled: true, text: `${algorithm.toUpperCase()}: ${digest}` };
}

function handleUserInfo(ctx: CommandContext): PluginResult {
  const totalCommands = (db.prepare(`SELECT COUNT(*) as total FROM command_logs WHERE user_id=?`).get(ctx.userId) as { total: number }).total;
  const joined = db.prepare(`SELECT MIN(executed_at) as first_seen FROM command_logs WHERE user_id=?`).get(ctx.userId) as { first_seen: number | null };
  return {
    handled: true,
    text: `👤 User info\nID: ${ctx.userId}\nUsername: @${ctx.username || 'unknown'}\nName: ${ctx.firstName || 'Unknown'}\nJoin date: ${joined.first_seen ? new Date(joined.first_seen).toISOString() : 'N/A'}\nCommands used: ${totalCommands}`
  };
}

function handleChatInfo(ctx: CommandContext): PluginResult {
  const memberEstimate = (db.prepare(`SELECT COUNT(DISTINCT user_id) as total FROM command_logs WHERE chat_id=?`).get(ctx.chatId) as { total: number }).total;
  return {
    handled: true,
    text: `💬 Chat info\nChat ID: ${ctx.chatId}\nMember count (active estimate): ${memberEstimate}\nType: private/group (from update context)`
  };
}

function formatStats(summary: Record<string, any>): string {
  const top = (summary.topCommands || []).map((c: any) => `- ${c.command}: ${c.usage_count}`).join('\n') || '- none';
  return `📊 *Bot stats*\n\nTotal users: ${summary.totalUsers}\nActive users (24h): ${summary.activeUsers24h}\n\nTop commands:\n${top}`;
}

function handleInvite(ctx: CommandContext): PluginResult {
  const token = crypto.randomBytes(6).toString('hex');
  const ttl = ctx.args[0] ? Number(ctx.args[0]) : 0;
  const suffix = ttl > 0 ? `?expiresIn=${ttl}` : '';
  return { handled: true, text: `🔗 Invite link: ${ctx.appUrl}/invite/${token}${suffix}` };
}

function handleVote(ctx: CommandContext): PluginResult {
  const action = (ctx.args[0] || '').toLowerCase();
  const now = Date.now();

  if (action === 'create') {
    const raw = ctx.text.substring(ctx.text.toLowerCase().indexOf('create') + 6).trim();
    const parts = raw.split('|').map(p => p.trim()).filter(Boolean);
    if (parts.length < 3) {
      return { handled: true, text: 'Usage: /vote create <question>|<option1>|<option2>[|option3]' };
    }
    const [question, ...options] = parts;
    db.prepare(`INSERT INTO votes(chat_id, question, options_json, multiple_choice, anonymous, created_by, created_at, active)
      VALUES(?, ?, ?, 0, 1, ?, ?, 1)`)
      .run(ctx.chatId, question, JSON.stringify(options), ctx.userId, now);
    const id = (db.prepare(`SELECT last_insert_rowid() as id`).get() as { id: number }).id;
    return { handled: true, text: `🗳️ Vote #${id} created. Cast with /vote cast ${id} <optionIndex>` };
  }

  if (action === 'cast') {
    const voteId = Number(ctx.args[1]);
    const optionIndex = Number(ctx.args[2]);
    if (!voteId || Number.isNaN(optionIndex)) return { handled: true, text: 'Usage: /vote cast <voteId> <optionIndex>' };
    db.prepare(`INSERT INTO vote_entries(vote_id, user_id, option_index, created_at) VALUES(?, ?, ?, ?)`)
      .run(voteId, ctx.userId, optionIndex, now);
    return { handled: true, text: '✅ Vote submitted.' };
  }

  const votes = db.prepare(`SELECT id, question, options_json FROM votes WHERE chat_id=? AND active=1 ORDER BY id DESC LIMIT 5`).all(ctx.chatId) as any[];
  if (!votes.length) return { handled: true, text: 'No active votes. Create one with /vote create ...' };
  const lines = votes.map(v => {
    const options = JSON.parse(v.options_json).map((o: string, i: number) => `${i}: ${o}`).join(', ');
    return `#${v.id} ${v.question} [${options}]`;
  });
  return { handled: true, text: lines.join('\n') };
}

function handleQuiz(ctx: CommandContext): PluginResult {
  const action = (ctx.args[0] || '').toLowerCase();
  const now = Date.now();
  if (action === 'create') {
    const raw = ctx.text.substring(ctx.text.toLowerCase().indexOf('create') + 6).trim();
    const parts = raw.split('|').map(p => p.trim()).filter(Boolean);
    if (parts.length < 4) return { handled: true, text: 'Usage: /quiz create <question>|<option1>|<option2>|<answerIndex>' };
    const question = parts[0];
    const answerIndex = Number(parts[parts.length - 1]);
    const options = parts.slice(1, parts.length - 1);
    if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= options.length) {
      return { handled: true, text: 'answerIndex must be a valid option index (0-based).' };
    }
    db.prepare(`INSERT INTO quizzes(chat_id, question, options_json, answer_index, created_by, created_at, active)
      VALUES(?, ?, ?, ?, ?, ?, 1)`)
      .run(ctx.chatId, question, JSON.stringify(options), answerIndex, ctx.userId, now);
    const id = (db.prepare(`SELECT last_insert_rowid() as id`).get() as { id: number }).id;
    return { handled: true, text: `🧠 Quiz #${id} created. Answer with /quiz answer ${id} <optionIndex>` };
  }

  if (action === 'answer') {
    const quizId = Number(ctx.args[1]);
    const selected = Number(ctx.args[2]);
    if (!quizId || Number.isNaN(selected)) return { handled: true, text: 'Usage: /quiz answer <quizId> <optionIndex>' };
    const quiz = db.prepare(`SELECT answer_index FROM quizzes WHERE id=? AND active=1`).get(quizId) as { answer_index: number } | undefined;
    if (!quiz) return { handled: true, text: 'Quiz not found.' };
    const isCorrect = Number(selected === quiz.answer_index);
    db.prepare(`INSERT INTO quiz_entries(quiz_id, user_id, selected_index, is_correct, created_at) VALUES(?, ?, ?, ?, ?)`)
      .run(quizId, ctx.userId, selected, isCorrect, now);
    return { handled: true, text: isCorrect ? '✅ Correct answer!' : '❌ Incorrect answer.' };
  }

  if (action === 'leaderboard') {
    const rows = db.prepare(`SELECT user_id, SUM(is_correct) as score FROM quiz_entries GROUP BY user_id ORDER BY score DESC LIMIT 10`).all() as any[];
    if (!rows.length) return { handled: true, text: 'No quiz scores yet.' };
    return { handled: true, text: `🧠 Quiz leaderboard\n${rows.map((r, i) => `${i + 1}. ${r.user_id} — ${r.score}`).join('\n')}` };
  }

  const quizzes = db.prepare(`SELECT id, question, options_json FROM quizzes WHERE chat_id=? AND active=1 ORDER BY id DESC LIMIT 5`).all(ctx.chatId) as any[];
  if (!quizzes.length) return { handled: true, text: 'No active quizzes. Use /quiz create ...' };
  const lines = quizzes.map(q => {
    const options = JSON.parse(q.options_json).map((o: string, i: number) => `${i}: ${o}`).join(', ');
    return `#${q.id} ${q.question} [${options}]`;
  });
  return { handled: true, text: lines.join('\n') };
}

function handleGiveaway(ctx: CommandContext): PluginResult {
  const action = (ctx.args[0] || '').toLowerCase();
  const now = Date.now();
  if (action === 'create') {
    const winnerCount = Math.max(1, Number(ctx.args[1]) || 1);
    const title = ctx.args.slice(2).join(' ').trim();
    if (!title) return { handled: true, text: 'Usage: /giveaway create <winnerCount> <title>' };
    db.prepare(`INSERT INTO giveaways(chat_id, title, winner_count, created_by, created_at, active) VALUES(?, ?, ?, ?, ?, 1)`)
      .run(ctx.chatId, title, winnerCount, ctx.userId, now);
    const id = (db.prepare(`SELECT last_insert_rowid() as id`).get() as { id: number }).id;
    return { handled: true, text: `🎁 Giveaway #${id} created. Users can join with /giveaway enter ${id}` };
  }

  if (action === 'enter') {
    const giveawayId = Number(ctx.args[1]);
    if (!giveawayId) return { handled: true, text: 'Usage: /giveaway enter <id>' };
    db.prepare(`INSERT OR IGNORE INTO giveaway_entries(giveaway_id, user_id, created_at) VALUES(?, ?, ?)`).run(giveawayId, ctx.userId, now);
    return { handled: true, text: '✅ Entry recorded.' };
  }

  if (action === 'draw') {
    const giveawayId = Number(ctx.args[1]);
    if (!giveawayId) return { handled: true, text: 'Usage: /giveaway draw <id>' };
    const giveaway = db.prepare(`SELECT id, title, winner_count FROM giveaways WHERE id=? AND active=1`).get(giveawayId) as any;
    if (!giveaway) return { handled: true, text: 'Giveaway not found or already closed.' };
    const entries = db.prepare(`SELECT user_id FROM giveaway_entries WHERE giveaway_id=? ORDER BY created_at ASC`).all(giveawayId) as Array<{ user_id: number }>;
    if (!entries.length) return { handled: true, text: 'No entries yet.' };
    const shuffled = [...entries].sort(() => crypto.randomInt(0, 2) * 2 - 1);
    const winners = shuffled.slice(0, giveaway.winner_count).map(w => w.user_id);
    db.prepare(`UPDATE giveaways SET active=0 WHERE id=?`).run(giveawayId);
    return { handled: true, text: `🏆 Giveaway "${giveaway.title}" winners: ${winners.join(', ')}` };
  }

  const rows = db.prepare(`SELECT id, title, winner_count, active FROM giveaways WHERE chat_id=? ORDER BY id DESC LIMIT 10`).all(ctx.chatId) as any[];
  if (!rows.length) return { handled: true, text: 'No giveaways yet. Use /giveaway create ...' };
  return { handled: true, text: rows.map(r => `#${r.id} [${r.active ? 'active' : 'closed'}] ${r.title} (${r.winner_count} winner(s))`).join('\n') };
}

function handleLeaderboard(): PluginResult {
  const rows = db.prepare(`SELECT user_id, COUNT(*) as score FROM command_logs GROUP BY user_id ORDER BY score DESC LIMIT 10`).all() as any[];
  if (!rows.length) return { handled: true, text: 'No leaderboard data yet.' };
  return { handled: true, text: `🏆 Leaderboard\n${rows.map((r, i) => `${i + 1}. ${r.user_id} — ${r.score}`).join('\n')}` };
}

function handleSuggest(ctx: CommandContext): PluginResult {
  const action = (ctx.args[0] || 'add').toLowerCase();
  const now = Date.now();
  if (action === 'add') {
    const text = ctx.args.slice(1).join(' ').trim();
    if (!text) return { handled: true, text: 'Usage: /suggest add <idea>' };
    db.prepare(`INSERT INTO suggestions(user_id, text, status, created_at, updated_at) VALUES(?, ?, 'open', ?, ?)`)
      .run(ctx.userId, text, now, now);
    return { handled: true, text: '💡 Suggestion submitted.' };
  }
  const rows = db.prepare(`SELECT id, text, status FROM suggestions WHERE user_id=? ORDER BY id DESC`).all(ctx.userId) as any[];
  if (!rows.length) return { handled: true, text: 'No suggestions yet.' };
  return { handled: true, text: rows.map(r => `#${r.id} [${r.status}] ${r.text}`).join('\n') };
}

function handleFeedback(ctx: CommandContext): PluginResult {
  const action = (ctx.args[0] || 'add').toLowerCase();
  if (action === 'add') {
    const rating = Number(ctx.args[1]);
    const text = ctx.args.slice(2).join(' ').trim();
    db.prepare(`INSERT INTO feedback(user_id, rating, text, kind, created_at) VALUES(?, ?, ?, 'review', ?)`).run(ctx.userId, Number.isFinite(rating) ? rating : null, text, Date.now());
    return { handled: true, text: '📝 Feedback recorded.' };
  }
  const avg = db.prepare(`SELECT AVG(rating) as avg_rating, COUNT(*) as total FROM feedback`).get() as any;
  return { handled: true, text: `⭐ Feedback stats\nAverage: ${Number(avg.avg_rating || 0).toFixed(2)}\nTotal entries: ${avg.total}` };
}

function handleJson(ctx: CommandContext): PluginResult {
  const text = ctx.args.join(' ').trim();
  if (!text) return { handled: true, text: 'Usage: /json <raw json>' };
  try {
    const parsed = JSON.parse(text);
    return { handled: true, text: `✅ Valid JSON\n\n${JSON.stringify(parsed, null, 2)}` };
  } catch (err: any) {
    return { handled: true, text: `❌ Invalid JSON: ${err.message}` };
  }
}

function handleBase64(ctx: CommandContext): PluginResult {
  const action = (ctx.args[0] || '').toLowerCase();
  const text = ctx.args.slice(1).join(' ');
  if (!action || !text) return { handled: true, text: 'Usage: /base64 <encode|decode> <text>' };
  try {
    if (action === 'encode') return { handled: true, text: Buffer.from(text, 'utf8').toString('base64') };
    if (action === 'decode') return { handled: true, text: Buffer.from(text, 'base64').toString('utf8') };
    return { handled: true, text: 'Unknown mode. Use encode or decode.' };
  } catch (err: any) {
    return { handled: true, text: `Decode error: ${err.message}` };
  }
}

function handleRegex(ctx: CommandContext): PluginResult {
  const pattern = ctx.args[0];
  const text = ctx.args.slice(1).join(' ');
  if (!pattern || !text) return { handled: true, text: 'Usage: /regex <pattern> <text>' };
  if (pattern.length > 120) return { handled: true, text: 'Pattern too long (max 120 chars).' };
  if (/[^a-zA-Z0-9_\-\s.*+?^$[\](){}|\\]/.test(pattern)) {
    return { handled: true, text: 'Pattern contains unsupported characters.' };
  }
  const hasRegexMeta = /[.*+?^$[\](){}|\\]/.test(pattern);
  const explain = hasRegexMeta ? 'Pattern validated (meta tokens detected).' : 'Pattern validated as literal.';
  const preview = text.includes(pattern) ? `✅ Preview match (literal): ${pattern}` : 'No literal preview match.';
  return { handled: true, text: `${explain}\n${preview}` };
}

function handleTimestamp(ctx: CommandContext): PluginResult {
  const mode = (ctx.args[0] || 'now').toLowerCase();
  if (mode === 'now') {
    return { handled: true, text: `Unix: ${Math.floor(Date.now() / 1000)}\nISO: ${new Date().toISOString()}` };
  }
  const value = Number(ctx.args[1] || ctx.args[0]);
  if (!Number.isFinite(value)) return { handled: true, text: 'Usage: /timestamp [now|tohuman <unix>|tounix <iso>]'};
  if (mode === 'tohuman' || ctx.args.length === 1) {
    return { handled: true, text: new Date(value * 1000).toISOString() };
  }
  return { handled: true, text: `${Math.floor(new Date(ctx.args.slice(1).join(' ')).getTime() / 1000)}` };
}

function handleColor(ctx: CommandContext): PluginResult {
  const input = (ctx.args[0] || '').trim();
  if (!input) return { handled: true, text: 'Usage: /color <hex>' };
  const hex = input.startsWith('#') ? input.slice(1) : input;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return { handled: true, text: 'Provide a HEX color, e.g. #FF00AA' };
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return { handled: true, text: `HEX #${hex.toUpperCase()}\nRGB(${r}, ${g}, ${b})\nPreview: ${ctx.appUrl}/api/color-preview?hex=${hex}` };
}

function handleSchedule(ctx: CommandContext): PluginResult {
  const action = (ctx.args[0] || 'list').toLowerCase();
  const now = Date.now();
  if (action === 'add') {
    const runAt = parseDateInput(ctx.args[1]);
    const tz = ctx.args[2] || 'UTC';
    const message = ctx.args.slice(3).join(' ').trim();
    if (!runAt || !message) return { handled: true, text: 'Usage: /schedule add <ISO|unix> <timezone> <message>' };
    db.prepare(`INSERT INTO schedules(chat_id, user_id, message, run_at, recurring_cron, timezone, status, created_at, updated_at) VALUES(?, ?, ?, ?, NULL, ?, 'scheduled', ?, ?)`)
      .run(ctx.chatId, ctx.userId, message, runAt, tz, now, now);
    return { handled: true, text: '📅 Message scheduled.' };
  }

  const rows = db.prepare(`SELECT id, message, run_at, timezone, status FROM schedules WHERE user_id=? ORDER BY id DESC LIMIT 20`).all(ctx.userId) as any[];
  if (!rows.length) return { handled: true, text: 'No schedules yet. Use /schedule add ...' };
  return { handled: true, text: rows.map(r => `#${r.id} [${r.status}] ${new Date(r.run_at).toISOString()} ${r.timezone} — ${r.message}`).join('\n') };
}

function handleAutomation(ctx: CommandContext): PluginResult {
  const action = (ctx.args[0] || 'list').toLowerCase();
  const ruleType = ctx.command.slice(1);
  const now = Date.now();

  if (action === 'set' || action === 'add') {
    const key = ctx.args[1] || '';
    const value = ctx.args.slice(2).join(' ');
    if (!key && ctx.command !== '/autodelete') return { handled: true, text: `Usage: ${ctx.command} set <key> <value>` };
    db.prepare(`INSERT INTO automation_rules(chat_id, rule_type, key, value, metadata_json, active, created_by, created_at, updated_at) VALUES(?, ?, ?, ?, NULL, 1, ?, ?, ?)`)
      .run(ctx.chatId, ruleType, key || 'default', value || 'enabled', ctx.userId, now, now);
    return { handled: true, text: `✅ ${ctx.command} rule saved.` };
  }

  if (action === 'off' || action === 'disable') {
    db.prepare(`UPDATE automation_rules SET active=0, updated_at=? WHERE chat_id=? AND rule_type=?`).run(now, ctx.chatId, ruleType);
    return { handled: true, text: `🛑 ${ctx.command} disabled for this chat.` };
  }

  const rows = db.prepare(`SELECT id, key, value, active FROM automation_rules WHERE chat_id=? AND rule_type=? ORDER BY id DESC LIMIT 20`).all(ctx.chatId, ruleType) as any[];
  if (!rows.length) return { handled: true, text: `No ${ctx.command} rules set. Use ${ctx.command} set ...` };
  return { handled: true, text: rows.map(r => `#${r.id} [${r.active ? 'on' : 'off'}] ${r.key} => ${r.value}`).join('\n') };
}
