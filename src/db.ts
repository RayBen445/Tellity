import fs from 'fs';
import path from 'path';

export interface TodoItem {
  id: string;
  userId: string;
  task: string;
  completed: boolean;
  dueDate?: string;
  createdAt: string;
}

export interface HabitItem {
  id: string;
  userId: string;
  name: string;
  streak: number;
  logs: string[]; // dates of completion 'YYYY-MM-DD'
  createdAt: string;
}

export interface CountdownItem {
  id: string;
  userId: string;
  name: string;
  eventDate: string; // ISO String
  createdAt: string;
}

export interface TimerItem {
  id: string;
  userId: string;
  durationSec: number;
  remainingSec: number;
  status: 'running' | 'paused' | 'completed';
  createdAt: string;
  lastTickAt?: number;
}

export interface StopwatchItem {
  userId: string;
  startAt?: number; // millisecond timestamp
  elapsedSec: number;
  status: 'running' | 'paused' | 'idle';
}

export interface CalendarEvent {
  id: string;
  userId: string;
  date: string; // 'YYYY-MM-DD'
  eventName: string;
}

export interface ShortUrlItem {
  id: string;
  alias: string;
  originalUrl: string;
  clicks: number;
  analytics: Array<{ timestamp: number; ip?: string }>;
}

export interface PollItem {
  id: string;
  chatId: number;
  question: string;
  options: string[];
  votes: Record<string, number>; // optionIndex -> count
  votedUserIds: Record<string, number>; // userId -> optionIndex
  active: boolean;
  anonymous: boolean;
}

export interface FeedbackItem {
  id: string;
  userId: string;
  username: string;
  text: string;
  rating: number;
  timestamp: string;
}

export interface SuggestionItem {
  id: string;
  userId: string;
  username: string;
  text: string;
  status: 'pending' | 'reviewing' | 'completed';
  timestamp: string;
}

export interface ScheduleItem {
  id: string;
  chatId: number;
  text: string;
  runAt: string; // Date string or next fire timestamp
  type: 'onetime' | 'recurring';
  intervalMin?: number; // Minutes interval for recurring
}

export interface AutoReplyRule {
  id: string;
  trigger: string;
  reply: string;
}

export interface DatabaseSchema {
  todos: TodoItem[];
  habits: HabitItem[];
  countdowns: CountdownItem[];
  timers: TimerItem[];
  stopwatches: Record<string, StopwatchItem>; // userId -> stopwatch
  calendarEvents: CalendarEvent[];
  shortUrls: ShortUrlItem[];
  polls: PollItem[];
  feedbacks: FeedbackItem[];
  suggestions: SuggestionItem[];
  schedules: ScheduleItem[];
  autodeleteSettings: Record<number, number>; // chatId -> seconds duration (0 = inactive)
  autoReplies: AutoReplyRule[];
  keywords: Record<string, { action: string; count: number }>;
  welcomes: Record<number, string>; // chatId -> welcome message
  goodbyes: Record<number, string>; // chatId -> goodbye message
  userRoles: Record<string, 'admin' | 'user'>; // userId or username -> role
  commandLogs: Array<{ userId: string; username: string; command: string; timestamp: number }>;
  quizSessions: Record<string, { currentQuestionIdx: number; score: number; scoreHistory: Record<string, number> }>; // chatId -> session
}

const DB_FILE_PATH = path.join(process.cwd(), 'database.json');

class DatabaseManager {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.getInitialSchema();
    this.load();
  }

  private getInitialSchema(): DatabaseSchema {
    return {
      todos: [],
      habits: [],
      countdowns: [],
      timers: [],
      stopwatches: {},
      calendarEvents: [],
      shortUrls: [],
      polls: [],
      feedbacks: [],
      suggestions: [],
      schedules: [],
      autodeleteSettings: {},
      autoReplies: [],
      keywords: {},
      welcomes: {},
      goodbyes: {},
      userRoles: {
        'admin': 'admin',
        'tele_user': 'admin',
        '123456': 'admin'
      },
      commandLogs: [],
      quizSessions: {}
    };
  }

  public load(): void {
    try {
      if (fs.existsSync(DB_FILE_PATH)) {
        const fileContent = fs.readFileSync(DB_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(fileContent);
        this.data = { ...this.getInitialSchema(), ...parsed };
      }
    } catch (e) {
      console.error('Error loading database file:', e);
      this.data = this.getInitialSchema();
    }
  }

  public save(): void {
    try {
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error saving database file:', e);
    }
  }

  public getData(): DatabaseSchema {
    return this.data;
  }

  // Set user role
  public setRole(userIdOrUsername: string, role: 'admin' | 'user'): void {
    this.data.userRoles[userIdOrUsername.toLowerCase()] = role;
    this.save();
  }

  // Get user role
  public getRole(userIdOrUsername: string): 'admin' | 'user' {
    const role = this.data.userRoles[userIdOrUsername.toLowerCase()];
    if (!role) {
      // By default, first user/admin is admin, everything else defaults to user unless registered
      return 'user';
    }
    return role;
  }

  // Log command execution for analytics
  public logCommand(userId: string, username: string, command: string): void {
    this.data.commandLogs.push({
      userId,
      username,
      command,
      timestamp: Date.now()
    });
    this.save();
  }

  // Clear specific collections
  public clearAll(): void {
    this.data = this.getInitialSchema();
    this.save();
  }
}

export const db = new DatabaseManager();
