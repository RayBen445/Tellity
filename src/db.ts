import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

// Case helper mappers
function toCamel(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(v => toCamel(v));
  } else if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((result, key) => {
      const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      result[camelKey] = toCamel(obj[key]);
      return result;
    }, {} as any);
  }
  return obj;
}

function toSnake(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(v => toSnake(v));
  } else if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((result, key) => {
      const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      result[snakeKey] = toSnake(obj[key]);
      return result;
    }, {} as any);
  }
  return obj;
}

class DatabaseManager {
  private data: DatabaseSchema;
  private loadedIds: Record<string, string[]>;

  constructor() {
    this.data = this.getInitialSchema();
    this.loadedIds = {};
    // Load is invoked asynchronously from middlewares/endpoints
    this.load().catch(err => console.error('Supabase initial load error:', err));
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

  public async load(): Promise<void> {
    try {
      const [
        todosRes,
        habitsRes,
        countdownsRes,
        timersRes,
        stopwatchesRes,
        calendarEventsRes,
        shortUrlsRes,
        pollsRes,
        feedbacksRes,
        suggestionsRes,
        schedulesRes,
        autodeleteRes,
        autoRepliesRes,
        keywordsRes,
        welcomesRes,
        goodbyesRes,
        userRolesRes,
        commandLogsRes,
        quizSessionsRes
      ] = await Promise.all([
        supabase.from('todos').select('*'),
        supabase.from('habits').select('*'),
        supabase.from('countdowns').select('*'),
        supabase.from('timers').select('*'),
        supabase.from('stopwatches').select('*'),
        supabase.from('calendar_events').select('*'),
        supabase.from('short_urls').select('*'),
        supabase.from('polls').select('*'),
        supabase.from('feedbacks').select('*'),
        supabase.from('suggestions').select('*'),
        supabase.from('schedules').select('*'),
        supabase.from('autodelete_settings').select('*'),
        supabase.from('auto_replies').select('*'),
        supabase.from('keywords').select('*'),
        supabase.from('welcomes').select('*'),
        supabase.from('goodbyes').select('*'),
        supabase.from('user_roles').select('*'),
        supabase.from('command_logs').select('*'),
        supabase.from('quiz_sessions').select('*')
      ]);

      // Array sets
      this.data.todos = toCamel(todosRes.data || []) as TodoItem[];
      this.data.habits = toCamel(habitsRes.data || []) as HabitItem[];
      this.data.countdowns = toCamel(countdownsRes.data || []) as CountdownItem[];
      this.data.timers = toCamel(timersRes.data || []) as TimerItem[];
      this.data.calendarEvents = toCamel(calendarEventsRes.data || []) as CalendarEvent[];
      this.data.shortUrls = toCamel(shortUrlsRes.data || []) as ShortUrlItem[];
      this.data.polls = toCamel(pollsRes.data || []) as PollItem[];
      this.data.feedbacks = toCamel(feedbacksRes.data || []) as FeedbackItem[];
      this.data.suggestions = toCamel(suggestionsRes.data || []) as SuggestionItem[];
      this.data.schedules = toCamel(schedulesRes.data || []) as ScheduleItem[];
      this.data.autoReplies = toCamel(autoRepliesRes.data || []) as AutoReplyRule[];
      this.data.commandLogs = toCamel(commandLogsRes.data || []) as any[];

      // Keyed Records mapping
      this.data.stopwatches = {};
      (stopwatchesRes.data || []).forEach(row => {
        const item = toCamel(row);
        this.data.stopwatches[item.userId] = item;
      });

      this.data.autodeleteSettings = {};
      (autodeleteRes.data || []).forEach(row => {
        this.data.autodeleteSettings[row.chat_id] = row.seconds;
      });

      this.data.welcomes = {};
      (welcomesRes.data || []).forEach(row => {
        this.data.welcomes[row.chat_id] = row.message;
      });

      this.data.goodbyes = {};
      (goodbyesRes.data || []).forEach(row => {
        this.data.goodbyes[row.chat_id] = row.message;
      });

      this.data.userRoles = {
        'admin': 'admin',
        'tele_user': 'admin',
        '123456': 'admin'
      };
      (userRolesRes.data || []).forEach(row => {
        this.data.userRoles[row.user_id_or_username.toLowerCase()] = row.role;
      });

      this.data.keywords = {};
      (keywordsRes.data || []).forEach(row => {
        this.data.keywords[row.phrase] = { action: row.action, count: row.count };
      });

      this.data.quizSessions = {};
      (quizSessionsRes.data || []).forEach(row => {
        const item = toCamel(row);
        this.data.quizSessions[item.chatId] = {
          currentQuestionIdx: item.currentQuestionIdx,
          score: item.score,
          scoreHistory: item.scoreHistory
        };
      });

      // Update tracker caches for deletions
      this.loadedIds = {
        todos: this.data.todos.map(t => t.id),
        habits: this.data.habits.map(h => h.id),
        countdowns: this.data.countdowns.map(c => c.id),
        timers: this.data.timers.map(t => t.id),
        calendarEvents: this.data.calendarEvents.map(e => e.id),
        shortUrls: this.data.shortUrls.map(u => u.id),
        polls: this.data.polls.map(p => p.id),
        feedbacks: this.data.feedbacks.map(f => f.id),
        suggestions: this.data.suggestions.map(s => s.id),
        schedules: this.data.schedules.map(s => s.id),
        autoReplies: this.data.autoReplies.map(r => r.id),
        
        stopwatches: Object.keys(this.data.stopwatches),
        autodeleteSettings: Object.keys(this.data.autodeleteSettings),
        welcomes: Object.keys(this.data.welcomes),
        goodbyes: Object.keys(this.data.goodbyes),
        userRoles: Object.keys(this.data.userRoles),
        keywords: Object.keys(this.data.keywords),
        quizSessions: Object.keys(this.data.quizSessions)
      };

    } catch (e) {
      console.error('Error loading data from Supabase:', e);
    }
  }

  public async save(): Promise<void> {
    try {
      // 1. Compile upsert arrays
      const stopwatchesRows = Object.values(this.data.stopwatches).map(item => toSnake(item));
      const autodeleteRows = Object.entries(this.data.autodeleteSettings).map(([chatId, seconds]) => ({ chat_id: parseInt(chatId, 10), seconds }));
      const welcomesRows = Object.entries(this.data.welcomes).map(([chatId, message]) => ({ chat_id: parseInt(chatId, 10), message }));
      const goodbyesRows = Object.entries(this.data.goodbyes).map(([chatId, message]) => ({ chat_id: parseInt(chatId, 10), message }));
      const userRolesRows = Object.entries(this.data.userRoles).map(([userIdOrUsername, role]) => ({ user_id_or_username: userIdOrUsername, role }));
      const keywordsRows = Object.entries(this.data.keywords).map(([phrase, obj]) => ({ phrase, action: obj.action, count: obj.count }));
      const quizSessionsRows = Object.entries(this.data.quizSessions).map(([chatId, obj]) => toSnake({ chatId, ...obj }));

      // 2. Perform parallel upserts
      await Promise.all([
        this.data.todos.length > 0 ? supabase.from('todos').upsert(toSnake(this.data.todos)) : Promise.resolve(),
        this.data.habits.length > 0 ? supabase.from('habits').upsert(toSnake(this.data.habits)) : Promise.resolve(),
        this.data.countdowns.length > 0 ? supabase.from('countdowns').upsert(toSnake(this.data.countdowns)) : Promise.resolve(),
        this.data.timers.length > 0 ? supabase.from('timers').upsert(toSnake(this.data.timers)) : Promise.resolve(),
        stopwatchesRows.length > 0 ? supabase.from('stopwatches').upsert(stopwatchesRows) : Promise.resolve(),
        this.data.calendarEvents.length > 0 ? supabase.from('calendar_events').upsert(toSnake(this.data.calendarEvents)) : Promise.resolve(),
        this.data.shortUrls.length > 0 ? supabase.from('short_urls').upsert(toSnake(this.data.shortUrls)) : Promise.resolve(),
        this.data.polls.length > 0 ? supabase.from('polls').upsert(toSnake(this.data.polls)) : Promise.resolve(),
        this.data.feedbacks.length > 0 ? supabase.from('feedbacks').upsert(toSnake(this.data.feedbacks)) : Promise.resolve(),
        this.data.suggestions.length > 0 ? supabase.from('suggestions').upsert(toSnake(this.data.suggestions)) : Promise.resolve(),
        this.data.schedules.length > 0 ? supabase.from('schedules').upsert(toSnake(this.data.schedules)) : Promise.resolve(),
        autodeleteRows.length > 0 ? supabase.from('autodelete_settings').upsert(autodeleteRows) : Promise.resolve(),
        this.data.autoReplies.length > 0 ? supabase.from('auto_replies').upsert(toSnake(this.data.autoReplies)) : Promise.resolve(),
        keywordsRows.length > 0 ? supabase.from('keywords').upsert(keywordsRows) : Promise.resolve(),
        welcomesRows.length > 0 ? supabase.from('welcomes').upsert(welcomesRows) : Promise.resolve(),
        goodbyesRows.length > 0 ? supabase.from('goodbyes').upsert(goodbyesRows) : Promise.resolve(),
        userRolesRows.length > 0 ? supabase.from('user_roles').upsert(userRolesRows) : Promise.resolve(),
        this.data.commandLogs.length > 0 ? supabase.from('command_logs').upsert(toSnake(this.data.commandLogs)) : Promise.resolve(),
        quizSessionsRows.length > 0 ? supabase.from('quiz_sessions').upsert(quizSessionsRows) : Promise.resolve()
      ]);

      // 3. Handle Deletions in parallel
      const deletions: Promise<any>[] = [];
      const getDeletedIds = (current: string[], loaded: string[]) => (loaded || []).filter(x => !current.includes(x));

      const deletedTodos = getDeletedIds(this.data.todos.map(t => t.id), this.loadedIds.todos);
      if (deletedTodos.length > 0) deletions.push(supabase.from('todos').delete().in('id', deletedTodos));

      const deletedHabits = getDeletedIds(this.data.habits.map(h => h.id), this.loadedIds.habits);
      if (deletedHabits.length > 0) deletions.push(supabase.from('habits').delete().in('id', deletedHabits));

      const deletedCountdowns = getDeletedIds(this.data.countdowns.map(c => c.id), this.loadedIds.countdowns);
      if (deletedCountdowns.length > 0) deletions.push(supabase.from('countdowns').delete().in('id', deletedCountdowns));

      const deletedTimers = getDeletedIds(this.data.timers.map(t => t.id), this.loadedIds.timers);
      if (deletedTimers.length > 0) deletions.push(supabase.from('timers').delete().in('id', deletedTimers));

      const deletedEvents = getDeletedIds(this.data.calendarEvents.map(e => e.id), this.loadedIds.calendarEvents);
      if (deletedEvents.length > 0) deletions.push(supabase.from('calendar_events').delete().in('id', deletedEvents));

      const deletedUrls = getDeletedIds(this.data.shortUrls.map(u => u.id), this.loadedIds.shortUrls);
      if (deletedUrls.length > 0) deletions.push(supabase.from('short_urls').delete().in('id', deletedUrls));

      const deletedPolls = getDeletedIds(this.data.polls.map(p => p.id), this.loadedIds.polls);
      if (deletedPolls.length > 0) deletions.push(supabase.from('polls').delete().in('id', deletedPolls));

      const deletedFeedbacks = getDeletedIds(this.data.feedbacks.map(f => f.id), this.loadedIds.feedbacks);
      if (deletedFeedbacks.length > 0) deletions.push(supabase.from('feedbacks').delete().in('id', deletedFeedbacks));

      const deletedSuggestions = getDeletedIds(this.data.suggestions.map(s => s.id), this.loadedIds.suggestions);
      if (deletedSuggestions.length > 0) deletions.push(supabase.from('suggestions').delete().in('id', deletedSuggestions));

      const deletedSchedules = getDeletedIds(this.data.schedules.map(s => s.id), this.loadedIds.schedules);
      if (deletedSchedules.length > 0) deletions.push(supabase.from('schedules').delete().in('id', deletedSchedules));

      const deletedReplies = getDeletedIds(this.data.autoReplies.map(r => r.id), this.loadedIds.autoReplies);
      if (deletedReplies.length > 0) deletions.push(supabase.from('auto_replies').delete().in('id', deletedReplies));

      // Keyed record deletions
      const deletedStopwatches = getDeletedIds(Object.keys(this.data.stopwatches), this.loadedIds.stopwatches);
      if (deletedStopwatches.length > 0) deletions.push(supabase.from('stopwatches').delete().in('user_id', deletedStopwatches));

      const deletedAutodelete = getDeletedIds(Object.keys(this.data.autodeleteSettings), this.loadedIds.autodeleteSettings);
      if (deletedAutodelete.length > 0) deletions.push(supabase.from('autodelete_settings').delete().in('chat_id', deletedAutodelete));

      const deletedWelcomes = getDeletedIds(Object.keys(this.data.welcomes), this.loadedIds.welcomes);
      if (deletedWelcomes.length > 0) deletions.push(supabase.from('welcomes').delete().in('chat_id', deletedWelcomes));

      const deletedGoodbyes = getDeletedIds(Object.keys(this.data.goodbyes), this.loadedIds.goodbyes);
      if (deletedGoodbyes.length > 0) deletions.push(supabase.from('goodbyes').delete().in('chat_id', deletedGoodbyes));

      const deletedRoles = getDeletedIds(Object.keys(this.data.userRoles), this.loadedIds.userRoles);
      if (deletedRoles.length > 0) deletions.push(supabase.from('user_roles').delete().in('user_id_or_username', deletedRoles));

      const deletedKeywords = getDeletedIds(Object.keys(this.data.keywords), this.loadedIds.keywords);
      if (deletedKeywords.length > 0) deletions.push(supabase.from('keywords').delete().in('phrase', deletedKeywords));

      const deletedQuiz = getDeletedIds(Object.keys(this.data.quizSessions), this.loadedIds.quizSessions);
      if (deletedQuiz.length > 0) deletions.push(supabase.from('quiz_sessions').delete().in('chat_id', deletedQuiz));

      if (deletions.length > 0) {
        await Promise.all(deletions);
      }

      // 4. Update local ID trackers
      this.loadedIds = {
        todos: this.data.todos.map(t => t.id),
        habits: this.data.habits.map(h => h.id),
        countdowns: this.data.countdowns.map(c => c.id),
        timers: this.data.timers.map(t => t.id),
        calendarEvents: this.data.calendarEvents.map(e => e.id),
        shortUrls: this.data.shortUrls.map(u => u.id),
        polls: this.data.polls.map(p => p.id),
        feedbacks: this.data.feedbacks.map(f => f.id),
        suggestions: this.data.suggestions.map(s => s.id),
        schedules: this.data.schedules.map(s => s.id),
        autoReplies: this.data.autoReplies.map(r => r.id),
        
        stopwatches: Object.keys(this.data.stopwatches),
        autodeleteSettings: Object.keys(this.data.autodeleteSettings),
        welcomes: Object.keys(this.data.welcomes),
        goodbyes: Object.keys(this.data.goodbyes),
        userRoles: Object.keys(this.data.userRoles),
        keywords: Object.keys(this.data.keywords),
        quizSessions: Object.keys(this.data.quizSessions)
      };

    } catch (e) {
      console.error('Error saving data to Supabase:', e);
    }
  }

  public getData(): DatabaseSchema {
    return this.data;
  }

  public setRole(userIdOrUsername: string, role: 'admin' | 'user'): void {
    this.data.userRoles[userIdOrUsername.toLowerCase()] = role;
    this.save().catch(err => console.error('Supabase setRole save error:', err));
  }

  public getRole(userIdOrUsername: string): 'admin' | 'user' {
    const role = this.data.userRoles[userIdOrUsername.toLowerCase()];
    if (!role) {
      return 'user';
    }
    return role;
  }

  public logCommand(userId: string, username: string, command: string): void {
    this.data.commandLogs.push({
      userId,
      username,
      command,
      timestamp: Date.now()
    });
    this.save().catch(err => console.error('Supabase logCommand save error:', err));
  }

  public clearAll(): void {
    this.data = this.getInitialSchema();
    this.save().catch(err => console.error('Supabase clearAll save error:', err));
  }
}

export const db = new DatabaseManager();
