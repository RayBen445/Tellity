import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'tellity.db');
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'user',
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS command_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  command TEXT NOT NULL,
  text TEXT,
  status TEXT NOT NULL,
  executed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS command_usage (
  command TEXT PRIMARY KEY,
  usage_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS habits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS habit_checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  habit_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  checkin_date TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(habit_id, user_id, checkin_date)
);

CREATE TABLE IF NOT EXISTS countdowns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  label TEXT NOT NULL,
  target_ts INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS timers (
  user_id INTEGER PRIMARY KEY,
  status TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  remaining_seconds INTEGER NOT NULL,
  started_at INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS stopwatches (
  user_id INTEGER PRIMARY KEY,
  status TEXT NOT NULL,
  elapsed_ms INTEGER NOT NULL,
  started_at INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS short_links (
  alias TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  creator_user_id INTEGER NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  question TEXT NOT NULL,
  options_json TEXT NOT NULL,
  multiple_choice INTEGER NOT NULL DEFAULT 0,
  anonymous INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS vote_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vote_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  option_index INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  rating INTEGER,
  text TEXT,
  kind TEXT NOT NULL DEFAULT 'review',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS automation_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  rule_type TEXT NOT NULL,
  key TEXT,
  value TEXT,
  metadata_json TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  run_at INTEGER,
  recurring_cron TEXT,
  timezone TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`);

export function upsertUsage(command: string): void {
  const now = Date.now();
  db.prepare(`
    INSERT INTO command_usage(command, usage_count, updated_at)
    VALUES(?, 1, ?)
    ON CONFLICT(command) DO UPDATE SET
      usage_count = usage_count + 1,
      updated_at = excluded.updated_at
  `).run(command, now);
}

export function logCommand(params: {
  chatId: number;
  userId: number;
  command: string;
  text: string;
  status: string;
}): void {
  db.prepare(`
    INSERT INTO command_logs(chat_id, user_id, command, text, status, executed_at)
    VALUES(?, ?, ?, ?, ?, ?)
  `).run(params.chatId, params.userId, params.command, params.text, params.status, Date.now());
}

export function isRateLimited(userId: number, limitPerMinute = 20): boolean {
  const since = Date.now() - 60_000;
  const row = db.prepare(`SELECT COUNT(*) as total FROM command_logs WHERE user_id = ? AND executed_at >= ?`).get(userId, since) as { total: number };
  return row.total >= limitPerMinute;
}

export function getRole(userId: number): 'admin' | 'user' {
  const row = db.prepare(`SELECT role FROM user_roles WHERE user_id = ?`).get(userId) as { role?: string } | undefined;
  return row?.role === 'admin' ? 'admin' : 'user';
}

export function ensureAdminBootstrap(userId: number): void {
  const total = (db.prepare(`SELECT COUNT(*) as total FROM user_roles WHERE role = 'admin'`).get() as { total: number }).total;
  if (total === 0) {
    db.prepare(`INSERT OR REPLACE INTO user_roles(user_id, role, updated_at) VALUES(?, 'admin', ?)`).run(userId, Date.now());
  }
}

export function setRole(userId: number, role: 'admin' | 'user'): void {
  db.prepare(`INSERT OR REPLACE INTO user_roles(user_id, role, updated_at) VALUES(?, ?, ?)`).run(userId, role, Date.now());
}

export function getDbSnapshot(): Record<string, unknown> {
  const tableNames = [
    'user_roles', 'command_logs', 'command_usage', 'todos', 'habits', 'habit_checkins',
    'countdowns', 'timers', 'stopwatches', 'short_links', 'votes', 'vote_entries',
    'suggestions', 'feedback', 'automation_rules', 'schedules'
  ];

  const snapshot: Record<string, unknown> = {};
  for (const table of tableNames) {
    snapshot[table] = db.prepare(`SELECT * FROM ${table}`).all();
  }
  return snapshot;
}
