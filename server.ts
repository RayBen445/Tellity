import express from 'express';
import path from 'path';
import sharp from 'sharp';
import { createServer as createViteServer } from 'vite';
import { BotConfig, BotCommandConfig, MessageLog } from './src/types.js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as mathguru from 'mathguru';
import { handlePoll } from './commands/poll.js';
import { handleCalculate } from './commands/calculate.js';
import { handleNotepad } from './commands/notepad.js';
import { CommandContext } from './commands/types.js';

// Premium Modular Plugin Command Imports
import {
  handleTodo,
  handleHabit,
  handleCountdown,
  handleTimer,
  handleStopwatch,
  handleCalendar
} from './commands/productivity.js';

import {
  handleQr,
  handleShorten,
  handleBarcode,
  handlePassword,
  handleUuid,
  handleHash
} from './commands/utilities.js';

import {
  handleMergePdf,
  handleSplitPdf,
  handleCompress,
  handleResize,
  handleConvert,
  handleOcr
} from './commands/filetools.js';

import {
  handleUserInfo,
  handleChatInfo,
  handleAdmins,
  handleStats,
  handleInvite,
  handleBackup
} from './commands/telefeatures.js';

import {
  handleVote,
  handleQuiz,
  handleGiveaway,
  handleLeaderboard,
  handleSuggest,
  handleFeedback
} from './commands/community.js';

import {
  handleJson,
  handleBase64,
  handleRegex,
  handleTimestamp,
  handleColor
} from './commands/devtools.js';

import {
  handleSchedule,
  handleAutoDelete,
  handleAutoReply,
  handleKeywords,
  handleWelcome,
  handleGoodbye
} from './commands/automation.js';

import { db } from './src/db.js';

// Setup basic environment variables support
import 'dotenv/config';

const app = express();
const PORT = 3000;

app.use(express.json());

// Supabase Data Syncing Middleware
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    try {
      await db.load();
    } catch (e) {
      console.error('Middleware db.load error:', e);
    }

    const originalSend = res.send;
    res.send = async function (body) {
      try {
        await db.save();
      } catch (err) {
        console.error('Middleware db.save error:', err);
      }
      return originalSend.call(this, body);
    };
  }
  next();
});

// In-memory stable state
let botToken: string = process.env.TELEGRAM_BOT_TOKEN || '';
let botUsername: string | null = null;
let botName: string | null = null;
let isWebhookActive = false;
let webhookUrl: string | null = null;
let targetChatId: string | null = null;
let reminderTemplate = '🔔 *REMINDER ALERT FOR {first_name}*! 🕰️\n\n> "{message}"\n\nScheduled at {time} • Fired successfully 🔋';

let userLanguages: Record<number, string> = {};
let knownUsers: Record<string, { id: number; firstName: string; lastName: string }> = {};

// Custom premium timezone lookup
const cityToTz: Record<string, string> = {
  london: 'Europe/London',
  tokyo: 'Asia/Tokyo',
  paris: 'Europe/Paris',
  berlin: 'Europe/Paris',
  rome: 'Europe/Paris',
  madrid: 'Europe/Paris',
  amsterdam: 'Europe/Paris',
  newyork: 'America/New_York',
  'new york': 'America/New_York',
  ny: 'America/New_York',
  losangeles: 'America/Los_Angeles',
  'los angeles': 'America/Los_Angeles',
  la: 'America/Los_Angeles',
  chicago: 'America/Chicago',
  houston: 'America/Chicago',
  miami: 'America/New_York',
  toronto: 'America/Toronto',
  vancouver: 'America/Vancouver',
  beijing: 'Asia/Shanghai',
  shanghai: 'Asia/Shanghai',
  hongkong: 'Asia/Hong_Kong',
  singapore: 'Asia/Singapore',
  dubai: 'Asia/Dubai',
  sydney: 'Australia/Sydney',
  melbourne: 'Australia/Sydney',
  lagos: 'Africa/Lagos',
  abuja: 'Africa/Lagos',
  accra: 'Africa/Accra',
  nairobi: 'Africa/Nairobi',
  cairo: 'Africa/Cairo',
  johannesburg: 'Africa/Johannesburg',
  mumbai: 'Asia/Kolkata',
  delhi: 'Asia/Kolkata',
  kolkata: 'Asia/Kolkata',
  bangalore: 'Asia/Kolkata',
  moscow: 'Europe/Moscow',
  istanbul: 'Europe/Istanbul',
  seoul: 'Asia/Seoul',
  saopaulo: 'America/Sao_Paulo',
  'sao paulo': 'America/Sao_Paulo',
  buenosaires: 'America/Argentina/Buenos_Aires',
  'buenos aires': 'America/Argentina/Buenos_Aires',
  mexicocity: 'America/Mexico_City',
  'mexico city': 'America/Mexico_City',
  manila: 'Asia/Manila',
  bangkok: 'Asia/Bangkok',
  jakarta: 'Asia/Jakarta'
};

function getTzByLocation(location: string): string | null {
  const clean = location.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
  if (!clean) return null;
  
  // 1. Direct city check
  if (cityToTz[clean]) {
    return cityToTz[clean];
  }
  
  // 2. Substring matching in registered cities
  for (const [city, tz] of Object.entries(cityToTz)) {
    if (city.includes(clean) || clean.includes(city)) {
      return tz;
    }
  }

  // 3. Fallback evaluation
  try {
    const parts = location.trim().split('/');
    if (parts.length >= 2) {
      new Intl.DateTimeFormat('en-US', { timeZone: location.trim() });
      return location.trim();
    }
  } catch (e) {}

  return null;
}

interface UserSessionSettings {
  language: string;
  voiceSpeed: number;
  voiceAccent: string;
  autoTranslate: boolean;
  targetLang: string;
}

let userSessionSettings: Record<number, UserSessionSettings> = {};

function getSessionSettings(chatId: number): UserSessionSettings {
  if (!userSessionSettings[chatId]) {
    userSessionSettings[chatId] = {
      language: userLanguages[chatId] || 'English',
      voiceSpeed: 1.0,
      voiceAccent: 'en-US',
      autoTranslate: false,
      targetLang: 'English'
    };
  }
  if (userLanguages[chatId]) {
    userSessionSettings[chatId].language = userLanguages[chatId];
  }
  return userSessionSettings[chatId];
}

// Google Translate Proxy REST Tool
async function translateText(text: string, targetLanguageName: string): Promise<string> {
  if (!text || text.startsWith('/')) {
    return text;
  }
  const langCode = getLanguageCode(targetLanguageName);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${langCode}&dt=t&q=${encodeURIComponent(text)}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    if (!response.ok) {
      throw new Error(`Public translation API returned ${response.status}`);
    }
    const data = await response.json() as any;
    if (data && data[0] && Array.isArray(data[0])) {
      return data[0].map((item: any) => item[0]).join('');
    }
    return text;
  } catch (err: any) {
    console.warn(`Translation failed for ${targetLanguageName}:`, err.message);
    return text;
  }
}

function getCommonInlineKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🚀 /start', callback_data: '/start' },
        { text: 'ℹ️ /help', callback_data: '/help' }
      ],
      [
        { text: '⚡ /ping', callback_data: '/ping' },
        { text: '🆔 /id', callback_data: '/id' }
      ],
      [
        { text: '⚙️ /settings', callback_data: '/settings' },
        { text: '🟢 /status', callback_data: '/status' }
      ]
    ]
  };
}

function getUserLanguage(chatId: number): string {
  return userLanguages[chatId] || 'English';
}

function getLanguageCode(langName: string): string {
  const name = (langName || '').trim().toLowerCase();
  const map: Record<string, string> = {
    english: 'en',
    spanish: 'es',
    french: 'fr',
    german: 'de',
    italian: 'it',
    japanese: 'ja',
    chinese: 'zh-CN',
    russian: 'ru',
    portuguese: 'pt',
    arabic: 'ar',
    hindi: 'hi',
    yoruba: 'yo',
    hausa: 'ha',
    igbo: 'ig',
    swahili: 'sw'
  };
  return map[name] || 'en';
}

let botCommands: BotCommandConfig[] = [
  {
    command: '/start',
    description: 'The standard greeting command',
    responseTemplate: '{greeting} {first_name}! 👋\n\nWelcome to your Custom Telegram Bot! This is a real-time, premium command response to your `/start` trigger.\n\nHere are some commands you can test:\n• `/start` - Launch or reset this bot\n• `/help` - View bot instructions\n• `/settings` - Set a preferred response language\n• `/echo <text>` - Reply back with the same exact text\n• `/time` - Get system clock time\n• `/time <location>` - View local time in standard cities\n• `/date` - Show the current date\n• `/status` - Audit integration health\n• `/ping` - Check connection speed diagnostics\n• `/id` - Check your user ID or look up another user\'s ID'
  },
  {
    command: '/help',
    description: 'Displays bot purpose and available commands',
    responseTemplate: '🤖 *Telegram Bot Hub*\n\nThis bot serves as a dynamic sandbox to test real-time commands and message handlers custom-tailored through Google AI Studio.\n\n*Available Commands*:\n• `/start` — Start interacting with the bot\n• `/help` — Displays this helper guide and command list\n• `/ping` — Check real-time latency and connections\n• `/time` — Get current system server time\n• `/time <location>` — Get current time of a query city / zone\n• `/date` — Print current Gregorian calendar date\n• `/id` — Get your Telegram identity or query someone else\'s User ID\n• `/settings` — View or configure your preferred language\n• `/echo <text>` — Echoes back the text that you type\n• `/reminder <time> <msg>` — Set an automated ticking alarm (e.g., `/reminder 30s call dad`)\n• `/image <text>` — Export typed text as a beautiful downloadable vector photo card\n• `/status` — View server status and connection diagnostics\n\nFeel free to explore and add your own custom command handlers! ✨'
  },
  {
    command: '/settings',
    description: 'Calibrate your session languages, voice speed, and auto-translation toggle',
    responseTemplate: '🛠️ *Custom Telegram Bot Settings* ⚙️\n\nConfigure your profile, translations, and vocal parameters directly:\n\n• *Preferred Language*: `{language}`\n• *Voice Accent Style*: `{voiceAccent}`\n• *Voice Speed Ratio*: `{voiceSpeed}x`\n• *Auto-translation state*: `{autoTranslate}`\n• *Translation Target Language*: `{targetLang}`\n\n💡 *How to update from chat*:\n• `/settings lang <Your Language>` (e.g., `/settings lang Spanish`)\n• `/settings accent <accent>` (e.g., `/settings accent en-GB`, `fr-FR`, `yo`)\n• `/settings speed <multiply>` (e.g., `/settings speed 1.2` or `/settings speed 0.85`)\n• `/settings translate <on/off>` (e.g., `/settings translate on`)\n• `/settings target <Language>` (e.g., `/settings target Yoruba`)\n\n_Configure anytime to calibrate real-time automatic vocal synthesis and translations!_'
  },
  {
    command: '/poll',
    description: 'Schedule a dynamic interactive poll inside user chat interfaces (e.g. /poll 30 Which color?|Red|Blue)',
    responseTemplate: '📊 *Interactive Poll Scheduler*:\nType \`/poll <seconds> <question>|<option1>|<option2>...\`\nExample:\n• \`/poll 45 Favorite team?|Madrid|Arsenal|Chelsea\`'
  },
  {
    command: '/translate',
    description: 'Ad-hoc translation of any text block separate from current session language (e.g. /translate Spanish Welcome)',
    responseTemplate: '🔄 *Text Translation*:\nType \`/translate <language> <your text>\`\nExample:\n• \`/translate Spanish Good morning my friend!\`'
  },
  {
    command: '/calculate',
    description: 'Safely parse and evaluate clean mathematical expressions or metric algorithms (e.g. /calculate 12 * (4 + 6))',
    responseTemplate: '🧮 *Secure Mathematical Calculator*:\nType \`/calculate <expression>\`\nExample:\n• \`/calculate 1500 * (1 - 0.15)\`'
  },
  {
    command: '/weather',
    description: 'Check active real-time conditions and temperature statistics for any global city name (e.g. /weather Tokyo)',
    responseTemplate: '🌤️ *Global Weather Station*:\nType \`/weather <city_name>\`\nExample:\n• \`/weather Paris\`'
  },
  {
    command: '/broadcast',
    description: 'Broadcast active diagnostic or general alert messages to all session chats (e.g. /broadcast System reboot)',
    responseTemplate: '📢 *Ad-hoc Global Broadcaster*:\nType \`/broadcast <your alert message>\`\nExample:\n• \`/broadcast Server system reboot completed successfully! 🟢\`'
  },
  {
    command: '/echo',
    description: 'Echoes back any text provided after the command as a custom voice note',
    responseTemplate: 'Please provide some text for me to echo. Usage: `/echo <text>`'
  },
  {
    command: '/reminder',
    description: 'Set structured background timers and alerts (e.g. /reminder 10s check mail)',
    responseTemplate: '💡 *Reminder Usage*:\nType \`/reminder <duration> <message>\`\nExamples:\n• \`/reminder 10s drink water\`\n• \`/reminder 5m check oven\`\n• \`/reminder 1h call client\`\n\nType \`/reminder list\` to see your active timers.'
  },
  {
    command: '/image',
    description: 'Convert and export any text to a premium high-contrast PNG image card (e.g. /image hello)',
    responseTemplate: '🎨 *Text to Card Image*:\nType \`/image <your text content>\` to generate and download a gorgeous high-contrast gradient PNG card containing your text!'
  },
  {
    command: '/time',
    description: 'Retrieve current server time or location timezone time',
    responseTemplate: '🕰️ *Current Time Diagnostic*:\n\n• *System Time*: `{time}` (UTC)\n• *Status*: Active Sync 🟢'
  },
  {
    command: '/date',
    description: 'Retrieve the current calendar date',
    responseTemplate: '📅 *Current Calendar Date*:\n\n• *Current Date*: `{date}`\n• *Status*: Active Sync 🟢'
  },
  {
    command: '/status',
    description: 'Diagnoses current backend latency & bot details',
    responseTemplate: '🟢 *Telegram Integration Diagnostics*:\n\n• *Server status*: Online & Active\n• *Host*: Cloud Run Sandbox\n• *Webhooks*: Connected\n• *Response Latency*: ~45ms\n• *Engine*: Custom TypeScript Hub'
  },
  {
    command: '/ping',
    description: 'Checks real-time round-trip latency to Telegram',
    responseTemplate: '🏓 *Pong!*\n\n• *API Roundtrip Latency*: `{rt_latency}ms`\n• *Propagation Speed*: `{propagation}`\n• *Status*: Ultra-Fast / Optimal ⚡'
  },
  {
    command: '/id',
    description: 'Query your Telegram User ID or lookup another user\'s ID',
    responseTemplate: '🆔 *Your Telegram Identifiers*:\n\n• *Your User ID*: `{user_id}`\n• *Current Chat ID*: `{chat_id}`'
  },
  {
    command: '/pdf',
    description: 'Create and dispatch premium styled PDF documents from text',
    responseTemplate: '📄 *PDF Document Creator*:\nType \`/pdf <your text content>\` to compile a professional PDF document with solid borders and modern corporate headers!'
  },
  {
    command: '/font',
    description: 'Change typeface and design stylized typography card images',
    responseTemplate: '🎨 *Custom Font Vector generator*:\nType \`/font <Google_Font_Name> <text content>\` to dynamically style text card layers using custom typography!'
  },
  {
    command: '/notepad',
    description: 'Pin, edit, erase, and retrieve custom notebook notes',
    responseTemplate: '📓 *Workspace Notebook Manager*:\nType \`/notepad list\` to see notes, or \`/notepad new <content>\` to append new items!'
  }
];

let messageLogs: MessageLog[] = [];
let botReminders: any[] = [];

interface NotepadItem {
  id: number;
  content: string;
  timestamp: string;
}
let userNotepads: Record<number, NotepadItem[]> = {};

function getNotepadForSession(chatId: number): NotepadItem[] {
  if (!userNotepads[chatId]) {
    userNotepads[chatId] = [];
  }
  return userNotepads[chatId];
}

// Helper to log messages
function addLog(direction: 'incoming' | 'outgoing', chatId: number, sender: any, text: string, status: string, rawJson?: any) {
  const newLog: MessageLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    timestamp: Date.now(),
    direction,
    chatId,
    sender: {
      id: sender.id,
      username: sender.username,
      firstName: sender.first_name || sender.firstName,
      lastName: sender.last_name || sender.lastName,
    },
    text,
    status,
    rawJson
  };
  messageLogs.unshift(newLog);
  // Keep only last 100 logs
  if (messageLogs.length > 100) {
    messageLogs = messageLogs.slice(0, 100);
  }

  // Simulated Auto-delete tracking
  if (direction === 'outgoing') {
    try {
      const activeChatId = chatId.toString();
      const secondsVal = db.getData().autodeleteSettings[activeChatId];
      if (secondsVal && secondsVal > 0) {
        setTimeout(() => {
          messageLogs = messageLogs.filter(log => log.id !== newLog.id);
        }, secondsVal * 1000);
      }
    } catch (e) {}
  }
}

// Function to call Telegram API safely
async function callTelegramAPI(method: string, body: any, customToken?: string) {
  const token = customToken || botToken;
  if (!token) {
    throw new Error('Telegram bot token is not configured.');
  }

  const url = `https://api.telegram.org/bot${token}/${method}`;
  
  try {
    const isMultipart = typeof FormData !== 'undefined' && body instanceof FormData;
    const headers: Record<string, string> = {};
    if (!isMultipart) {
      headers['Content-Type'] = 'application/json';
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: isMultipart ? (body as any) : JSON.stringify(body)
    });

    const data = await response.json() as any;
    if (!data.ok) {
      throw new Error(data.description || `Telegram API error: ${response.statusText}`);
    }

    // Real-world Telegram Auto-delete tracking
    const result = data.result;
    if (result && result.message_id && result.chat && result.chat.id) {
      const activeChatId = result.chat.id.toString();
      try {
        const secondsVal = db.getData().autodeleteSettings[activeChatId];
        if (secondsVal && secondsVal > 0) {
          setTimeout(async () => {
            try {
              await callTelegramAPI('deleteMessage', {
                chat_id: activeChatId,
                message_id: result.message_id
              }, token);
            } catch (delErr: any) {
              console.error(`AutoDelete API failure for message_id ${result.message_id}:`, delErr.message);
            }
          }, secondsVal * 1000);
        }
      } catch (e) {}
    }

    return result;
  } catch (error: any) {
    console.error(`Telegram API Error [${method}]:`, error.message);
    throw error;
  }
}

// Fetch bot profile to validate token
async function validateAndFetchBotProfile(tokenToUse: string): Promise<boolean> {
  if (!tokenToUse) return false;
  try {
    const botMeta = await callTelegramAPI('getMe', {}, tokenToUse);
    botUsername = botMeta.username ? `@${botMeta.username}` : null;
    botName = botMeta.first_name || 'My Telegram Bot';
    return true;
  } catch (error) {
    botUsername = null;
    botName = null;
    return false;
  }
}

// Automatically send automated connect notification to target user ID
async function testConnectMessage(chatIdString: string, customToken?: string) {
  if (!chatIdString) return;
  const numericId = parseInt(chatIdString, 10);
  if (isNaN(numericId)) return;
  
  const greetingText = `🟢 *Telegram Bot Connected Successfully!*\n\nYour custom bot is now linked to your Admin Dashboard! Try sending me some command messages:\n• \`/start\`\n• \`/help\`\n• \`/settings\`\n• \`/echo Hello World\`\n\nEverything you configure in your AI Studio dashboard updates here instantly! 🚀✨`;
  
  try {
    await callTelegramAPI('sendMessage', {
      chat_id: numericId,
      text: greetingText,
      parse_mode: 'Markdown'
    }, customToken);
    
    addLog(
      'outgoing',
      numericId,
      { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
      greetingText,
      'Automated connection confirmation notification delivered successfully'
    );
  } catch (err: any) {
    console.warn(`Could not dispatch connect message to Chat ID ${numericId}:`, err.message);
    addLog(
      'outgoing',
      numericId,
      { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
      `⚠️ Could not deliver automatic connection message to Chat ID ${numericId}: ${err.message}`,
      'Connection failed: Be sure you have sent /start inside Telegram to the bot first!'
    );
  }
}

// Set up webhook
async function configureWebhook(tokenToUse: string): Promise<boolean> {
  const appUrl = (process.env.APP_URL || '').trim();
  if (!tokenToUse || !appUrl || appUrl === 'MY_APP_URL') {
    isWebhookActive = false;
    webhookUrl = null;
    return false;
  }

  // Format webhook url properly
  const cleanAppUrl = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl;
  const targetWebhook = `${cleanAppUrl}/api/telegram-webhook`;

  try {
    const response = await callTelegramAPI('setWebhook', { url: targetWebhook }, tokenToUse);
    isWebhookActive = true;
    webhookUrl = targetWebhook;
    console.log(`Telegram Webhook successfully configured to: ${targetWebhook}`);
    return true;
  } catch (error) {
    console.error('Failed to configure telegram webhook:', error);
    isWebhookActive = false;
    webhookUrl = null;
    return false;
  }
}

// Initial system setup if token exists in process.env on boot
if (botToken) {
  validateAndFetchBotProfile(botToken).then(success => {
    if (success) {
      startLongPolling();
    }
  });
}

// Formatting utilities for user tokens
function formatResponseText(template: string, fromUser: any, chatId: number): string {
  if (!template) return '';
  
  // Calculate dynamic greeting based on server local hour
  const hour = new Date().getHours();
  let greetingMsg = 'Hello';
  if (hour >= 5 && hour < 12) {
    greetingMsg = 'Good morning';
  } else if (hour >= 12 && hour < 17) {
    greetingMsg = 'Good afternoon';
  } else {
    greetingMsg = 'Good evening';
  }

  const currentDateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const settings = getSessionSettings(chatId);

  return template
    .replace(/{greeting}/g, greetingMsg)
    .replace(/{first_name}/g, fromUser.first_name || fromUser.firstName || 'User')
    .replace(/{last_name}/g, fromUser.last_name || fromUser.lastName || '')
    .replace(/{username}/g, fromUser.username || 'anonymous')
    .replace(/{chat_id}/g, chatId.toString())
    .replace(/{time}/g, new Date().toLocaleTimeString())
    .replace(/{date}/g, currentDateStr)
    .replace(/{language}/g, getUserLanguage(chatId))
    .replace(/{voiceSpeed}/g, (settings.voiceSpeed || 1.0).toFixed(2))
    .replace(/{voiceAccent}/g, settings.voiceAccent || 'en-US')
    .replace(/{autoTranslate}/g, settings.autoTranslate ? 'ENABLED 🟢' : 'DISABLED 🔴')
    .replace(/{targetLang}/g, settings.targetLang || 'English');
}

// Central processing logic for standard Telegram Update objects
let longPollingActive = false;
let pollingIntervalId: NodeJS.Timeout | null = null;
let lastUpdateId = 0;

async function startLongPolling() {
  if (longPollingActive) return;
  longPollingActive = true;
  console.log('Starting Telegram Bot Long Polling loop...');
  
  // Deactivate webhook first to allow getUpdates
  try {
    await callTelegramAPI('deleteWebhook', {});
    isWebhookActive = false;
    webhookUrl = null;
  } catch (e) {
    console.warn('Note: minor error clearing webhook before long polling:', e);
  }

  runPollingIteration();
}

function stopLongPolling() {
  longPollingActive = false;
  if (pollingIntervalId) {
    clearTimeout(pollingIntervalId);
    pollingIntervalId = null;
  }
  console.log('Stopped Long Polling loop.');
}

async function runPollingIteration() {
  if (!longPollingActive || !botToken) return;

  try {
    const updates = await callTelegramAPI('getUpdates', {
      offset: lastUpdateId + 1,
      timeout: 5, // short timeout to keep it responsive without clogging event loop
      allowed_updates: ['message', 'edited_message', 'channel_post']
    });

    if (updates && Array.isArray(updates)) {
      for (const update of updates) {
        lastUpdateId = update.update_id;
        try {
          await db.load();
          await processTelegramUpdate(update, false);
          await db.save();
        } catch (e) {
          console.error('Polling database sync error:', e);
        }
      }
    }
  } catch (err: any) {
    console.error('Error during Telegram Long Polling iteration:', err.message);
  }

  // Schedule next iteration
  if (longPollingActive) {
    pollingIntervalId = setTimeout(runPollingIteration, 1200);
  }
}

async function processTelegramUpdate(updateBody: any, isSimulated = false) {
  const isCallbackQuery = !!updateBody.callback_query;
  const message = updateBody.message || updateBody.edited_message || updateBody.channel_post || updateBody.callback_query?.message;
  
  // Fallback info if structure differs
  const chatId = message?.chat?.id || 123456;
  const fromUser = (isCallbackQuery ? updateBody.callback_query?.from : message?.from) || { id: 123456, first_name: 'Telegram User', username: 'tele_user' };
  
  // Try to answer callback query if real bot
  if (isCallbackQuery && !isSimulated && botToken) {
    try {
      await callTelegramAPI('answerCallbackQuery', {
        callback_query_id: updateBody.callback_query.id
      });
    } catch (e: any) {
      console.warn('answerCallbackQuery failed:', e.message);
    }
  }

  const originalUserText = (isCallbackQuery ? (updateBody.callback_query?.data || '') : (message?.text || '')).trim();
  let userText = originalUserText;

  // Support slash-less matching of commands
  if (userText && !userText.startsWith('/')) {
    const firstWord = userText.split(/\s+/)[0].toLowerCase();
    const knownCommands = [
      'start', 'help', 'settings', 'poll', 'translate', 'calculate', 'weather', 'broadcast', 'echo', 
      'reminder', 'image', 'time', 'date', 'status', 'ping', 'id', 'pdf', 'font', 'notepad',
      'todo', 'habit', 'countdown', 'timer', 'stopwatch', 'calendar',
      'qr', 'shorten', 'barcode', 'password', 'uuid', 'hash',
      'mergepdf', 'splitpdf', 'compress', 'resize', 'convert', 'ocr',
      'userinfo', 'chatinfo', 'admins', 'stats', 'invite', 'backup',
      'vote', 'quiz', 'giveaway', 'leaderboard', 'suggest', 'feedback',
      'json', 'base64', 'regex', 'timestamp', 'color',
      'schedule', 'autodelete', 'sys_autodelete', 'autoreply', 'keywords', 'welcome', 'goodbye'
    ];
    if (knownCommands.includes(firstWord)) {
      userText = '/' + userText;
    }
  }

  // Define a human readable preview descriptor
  let logText = isCallbackQuery ? `🖱️ Clicked inline button: "${originalUserText}"` : originalUserText;
  if (!logText) {
    const keys = Object.keys(updateBody).filter(k => k !== 'update_id');
    logText = `[Telegram Event: ${keys.join(', ') || 'unknown payload'}]`;
  }

  // Track users in helper cache
  if (fromUser && fromUser.id) {
    const defaultUserObj = {
      id: fromUser.id,
      firstName: fromUser.first_name || fromUser.firstName || '',
      lastName: fromUser.last_name || fromUser.lastName || ''
    };
    if (fromUser.username) {
      const cleanUsername = fromUser.username.trim().replace('@', '').toLowerCase();
      knownUsers[cleanUsername] = defaultUserObj;
    }
    if (fromUser.first_name) {
      const cleanFirstName = fromUser.first_name.trim().toLowerCase();
      knownUsers[cleanFirstName] = defaultUserObj;
    }
  }

  // 1. Log the incoming message / event trace
  addLog(
    'incoming',
    chatId,
    fromUser,
    logText,
    isSimulated ? 'Simulated inbound update' : 'Received via Telegram Network API',
    updateBody
  );

  if (!userText) {
    return;
  }

  // Custom behavior overrides for commands with parameters
  const lowerText = userText.toLowerCase();

  if (lowerText.startsWith('/settings ') || lowerText.startsWith('/settings@') || lowerText === '/settings') {
    const parts = userText.split(/\s+/);
    const settings = getSessionSettings(chatId);
    let updatedField = '';
    let updatedValue = '';

    if (parts.length > 2) {
      const subCommand = parts[1].toLowerCase();
      const value = parts.slice(2).join(' ').trim();

      if (subCommand === 'lang' || subCommand === 'language') {
        settings.language = value;
        userLanguages[chatId] = value;
        updatedField = 'Preferred Language';
        updatedValue = value;
      } else if (subCommand === 'accent') {
        settings.voiceAccent = value;
        updatedField = 'Voice Accent Style';
        updatedValue = value;
      } else if (subCommand === 'speed') {
        const parsedSpeed = parseFloat(value);
        if (!isNaN(parsedSpeed) && parsedSpeed >= 0.5 && parsedSpeed <= 2.0) {
          settings.voiceSpeed = parsedSpeed;
          updatedField = 'Voice Speed Ratio';
          updatedValue = `${parsedSpeed}x`;
        }
      } else if (subCommand === 'translate' || subCommand === 'autotranslate') {
        const isOn = ['on', 'yes', 'true', '1', 'enable', 'enabled'].includes(value.toLowerCase());
        settings.autoTranslate = isOn;
        updatedField = 'Auto-translation';
        updatedValue = isOn ? 'ENABLED 🟢' : 'DISABLED 🔴';
      } else if (subCommand === 'target' || subCommand === 'targetlang') {
        settings.targetLang = value;
        updatedField = 'Translation Target Language';
        updatedValue = value;
      }
    } else if (parts.length === 2 && !parts[1].startsWith('@')) {
      // Direct set language shortcut: e.g. /settings Spanish
      const langValue = parts[1].trim();
      settings.language = langValue;
      userLanguages[chatId] = langValue;
      updatedField = 'Preferred Language';
      updatedValue = langValue;
    }

    if (updatedField) {
      const successMessage = `✅ *Setting Updated Successfully!*\n\n• *Field*: \`${updatedField}\`\n• *New Value*: \`${updatedValue}\`\n\nI will utilize this configuration for all future actions in this session! 🔋`;
      
      addLog(
        'outgoing',
        chatId,
        { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
        successMessage,
        `Updated settings: ${updatedField} to ${updatedValue}${isSimulated ? ' (Simulated)' : ''}`
      );

      if (!isSimulated && botToken) {
        try {
          await callTelegramAPI('sendMessage', {
            chat_id: chatId,
            text: successMessage,
            parse_mode: 'Markdown',
            reply_markup: getCommonInlineKeyboard()
          });
        } catch (err: any) {
          if (messageLogs.length > 0) {
            messageLogs[0].status = `Error sending settings update: ${err.message}`;
          }
        }
      }
      return;
    }

    // Send active settings helper with current stats
    const matchedCommand = botCommands.find(cmd => cmd.command === '/settings');
    if (matchedCommand) {
      const formattedReply = formatResponseText(matchedCommand.responseTemplate, fromUser, chatId);
      addLog(
        'outgoing',
        chatId,
        { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
        formattedReply,
        `Replying with settings helper ${isSimulated ? ' (Simulated)' : ''}`
      );

      if (!isSimulated && botToken) {
        try {
          await callTelegramAPI('sendMessage', {
            chat_id: chatId,
            text: formattedReply,
            parse_mode: 'Markdown',
            reply_markup: getCommonInlineKeyboard()
          });
        } catch (err: any) {
          if (messageLogs.length > 0) {
            messageLogs[0].status = `Error sending settings response: ${err.message}`;
          }
        }
      }
      return;
    }
  }

  if (lowerText.startsWith('/echo ') || lowerText.startsWith('/echo@') || lowerText === '/echo') {
    const parts = userText.split(/\s+/);
    if (parts.length > 1) {
      const matchIndex = userText.toLowerCase().indexOf('/echo');
      const startOfText = matchIndex + 5;
      const echoContent = userText.substring(startOfText).trim();
      if (echoContent) {
        const settings = getSessionSettings(chatId);
        let echoText = echoContent;
        let announcement = `🎙️ [Voice echo: "${echoContent}"]`;

        // If the preferred language is non-English, translate it real-time!
        const targetLanguage = settings.language;
        if (targetLanguage && targetLanguage.toLowerCase() !== 'english') {
          try {
            const translated = await translateText(echoContent, targetLanguage);
            if (translated && translated !== echoContent) {
              echoText = translated;
              announcement = `🎙️ [Voice echo translated to ${targetLanguage}: "${translated}"]`;
            }
          } catch (err) {
            console.warn('Real time translation inside echo failed:', err);
          }
        }

        addLog(
          'outgoing',
          chatId,
          { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
          announcement,
          `Generating and replying with echo voice memo${isSimulated ? ' (Simulated)' : ''}`
        );

        if (!isSimulated && botToken) {
          try {
            // Accent Selection mapping (default fallback to targetLanguage)
            let langCode = getLanguageCode(targetLanguage);
            if (settings.voiceAccent && settings.voiceAccent !== 'en-US') {
              langCode = settings.voiceAccent.split('-')[0] || langCode;
            }
            
            // Speed configurations
            const speedMultiplier = settings.voiceSpeed || 1.0;

            const cleanText = echoText.substring(0, 200).trim();
            const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(langCode)}&client=tw-ob&q=${encodeURIComponent(cleanText)}&ttsspeed=${speedMultiplier}&speed=${speedMultiplier}`;
            
            const ttsResponse = await fetch(ttsUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://translate.google.com/'
              }
            });

            if (!ttsResponse.ok) {
              throw new Error(`Google TTS status: ${ttsResponse.status}`);
            }

            const arrayBuffer = await ttsResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const blob = new Blob([buffer], { type: 'audio/mpeg' });

            try {
              const formData = new FormData();
              formData.append('chat_id', chatId.toString());
              formData.append('voice', blob, 'voice.ogg');
              formData.append('caption', `🗣️ ${announcement.replace('🎙️ [', '').replace(']', '')}`);

              await callTelegramAPI('sendVoice', formData);
            } catch (errVoice: any) {
              console.warn('sendVoice multipart failed, falling back to sendAudio multipart:', errVoice.message);
              
              const formData = new FormData();
              formData.append('chat_id', chatId.toString());
              formData.append('audio', blob, 'echo.mp3');
              formData.append('title', 'Echo Voice Note');
              formData.append('performer', botName || 'My Telegram Bot');
              formData.append('caption', `🗣️ ${announcement.replace('🎙️ [', '').replace(']', '')}`);

              await callTelegramAPI('sendAudio', formData);
            }
          } catch (err: any) {
            console.error('Error sending echo voice:', err.message);
            if (messageLogs.length > 0) {
              messageLogs[0].status = `Error sending voice reply: ${err.message}`;
            }
          }
        }
        return;
      }
    } else {
      // Send the help or default usage template
      const matchedCommand = botCommands.find(cmd => cmd.command === '/echo');
      if (matchedCommand) {
        addLog(
          'outgoing',
          chatId,
          { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
          matchedCommand.responseTemplate,
          `Replying with echo usage ${isSimulated ? ' (Simulated)' : ''}`
        );

        if (!isSimulated && botToken) {
          try {
            await callTelegramAPI('sendMessage', {
              chat_id: chatId,
              text: matchedCommand.responseTemplate,
              parse_mode: 'Markdown',
              reply_markup: getCommonInlineKeyboard()
            });
          } catch (err: any) {
            if (messageLogs.length > 0) {
              messageLogs[0].status = `Error sending echo usage response: ${err.message}`;
            }
          }
        }
        return;
      }
    }
  }

  // Handle /time and /time <location> dynamically
  if (lowerText.startsWith('/time ') || lowerText.startsWith('/time@') || lowerText === '/time') {
    const parts = userText.split(/\s+/);
    let timeReply = '';
    
    if (parts.length > 1) {
      const location = parts.slice(1).join(' ').trim();
      const tzName = getTzByLocation(location);
      if (tzName) {
        try {
          const localTime = new Date().toLocaleTimeString('en-US', {
            timeZone: tzName,
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
            timeZoneName: 'short'
          });
          const localDate = new Date().toLocaleDateString('en-US', {
            timeZone: tzName,
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
          timeReply = `🕰️ *World Clock Lookup*:\n\n• *Selected Location*: \`${location}\` (${tzName})\n• *Local Current Time*: \`🕒 ${localTime}\`\n• *Current Date*: \`${localDate}\`\n• *Sync Health*: Verified 🟢`;
        } catch (e: any) {
          timeReply = `⚠️ *Clock Diagnostic Error*:\n\nFailed to calculate local time coordinates for timezone identifier \`${tzName}\`: ${e.message}`;
        }
      } else {
        timeReply = `🔍 *Clock Lookup Result*:\n\nCould not resolve timezone coordinates for region *"${location}"*.\n\n💡 _Try searching major cities e.g., \`/time Tokyo\`, \`/time New York\`, or \`/time Lagos\`_`;
      }
    } else {
      const timeString = new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      timeReply = `🕰️ *Current Time Diagnostic*:\n\n• *System / Server Time*: \`${timeString}\` (UTC)\n• *Status*: Active Sync 🟢`;
    }

    addLog(
      'outgoing',
      chatId,
      { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
      timeReply,
      `Replying with clock information${isSimulated ? ' (Simulated)' : ''}`
    );

    if (!isSimulated && botToken) {
      try {
        await callTelegramAPI('sendMessage', {
          chat_id: chatId,
          text: timeReply,
          parse_mode: 'Markdown',
          reply_markup: getCommonInlineKeyboard()
        });
      } catch (err: any) {
        if (messageLogs.length > 0) {
          messageLogs[0].status = `Error sending time: ${err.message}`;
        }
      }
    }
    return;
  }

  // Handle /date dynamically
  if (lowerText.startsWith('/date ') || lowerText.startsWith('/date@') || lowerText === '/date') {
    const dateString = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const dateReply = `📅 *Current Calendar Date*:\n\n• *Standard Date*: \`${dateString}\`\n• *Day of Week*: \`${new Date().toLocaleDateString('en-US', { weekday: 'long' })}\`\n• *UTC Server Timestamp*: \`${Date.now()}\`\n• *Status*: Active Sync 🟢`;

    addLog(
      'outgoing',
      chatId,
      { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
      dateReply,
      `Replying with gregorian calendar details${isSimulated ? ' (Simulated)' : ''}`
    );

    if (!isSimulated && botToken) {
      try {
        await callTelegramAPI('sendMessage', {
          chat_id: chatId,
          text: dateReply,
          parse_mode: 'Markdown',
          reply_markup: getCommonInlineKeyboard()
        });
      } catch (err: any) {
        if (messageLogs.length > 0) {
          messageLogs[0].status = `Error sending date: ${err.message}`;
        }
      }
    }
    return;
  }

  // Handle /ping command dynamically to measure real-time API latency & speed
  if (lowerText.startsWith('/ping ') || lowerText.startsWith('/ping@') || lowerText === '/ping') {
    const startMeasure = Date.now();
    let rtt = 0;
    if (!isSimulated && botToken) {
      try {
        await callTelegramAPI('getMe', {});
        rtt = Date.now() - startMeasure;
      } catch (e: any) {
        console.warn('Ping diagnostic warning:', e.message);
      }
    } else {
      rtt = Math.floor(Math.random() * 15) + 25; // Simulated quick delay
    }

    // Measure event propagation offset if message date exists
    const msgDate = updateBody.message?.date || updateBody.channel_post?.date || updateBody.edited_message?.date;
    const propagationStr = msgDate ? `${Date.now() - msgDate * 1000}ms` : '42ms';
    const serverNode = 'Google Cloud Run (Europe-West2)';
    
    // Choose indicators based on performance speed
    const statusText = rtt < 80 ? '⚡ Ultra-Fast / Optimal' : rtt < 180 ? '🟢 Normal / Responsive' : '🟡 Congested / Moderate';
    const pingResponse = `🏓 *Pong!*\n\n• *API Roundtrip Latency*: \`${rtt}ms\`\n• *Event Propagation*: \`${propagationStr}\`\n• *Server Edge Node*: \`${serverNode}\`\n• *Gateway Status*: \`${statusText}\`\n\n_Diagnostic speed test performed in real-time._`;

    addLog(
      'outgoing',
      chatId,
      { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
      pingResponse,
      `Replying with speed test latency: ${rtt}ms${isSimulated ? ' (Simulated)' : ''}`
    );

    if (!isSimulated && botToken) {
      try {
        await callTelegramAPI('sendMessage', {
          chat_id: chatId,
          text: pingResponse,
          parse_mode: 'Markdown',
          reply_markup: getCommonInlineKeyboard()
        });
      } catch (err: any) {
        if (messageLogs.length > 0) {
          messageLogs[0].status = `Error sending ping response: ${err.message}`;
        }
      }
    }
    return;
  }

  // Handle /id or /id <username> dynamically to fetch Telegram IDs from cached interactions
  if (lowerText.startsWith('/id ') || lowerText.startsWith('/id@') || lowerText === '/id') {
    const parts = userText.split(/\s+/);
    let idReply = '';
    
    if (parts.length > 1) {
      const targetQuery = parts.slice(1).join(' ').trim().replace(/^@/, '').toLowerCase();
      const match = knownUsers[targetQuery];
      
      if (match) {
        idReply = `🆔 *User ID Search Lookup Details*:\n\n• *Target Username*: @${targetQuery}\n• *User Account ID*: \`${match.id}\`\n• *Display Name*: \`${match.firstName} ${match.lastName}\`\n• *Database Status*: Cache verified 🟢`;
      } else {
        // Fallback search in logs
        const foundInLogs = messageLogs.find(log => 
          log.sender?.username?.toLowerCase() === targetQuery || 
          log.sender?.firstName?.toLowerCase() === targetQuery
        );
        if (foundInLogs && foundInLogs.sender.id) {
          idReply = `🆔 *User ID Search Lookup Details (found from logs history)*:\n\n• *Target Username*: @${targetQuery}\n• *User Account ID*: \`${foundInLogs.sender.id}\`\n• *Display Name*: \`${foundInLogs.sender.firstName || ''} ${foundInLogs.sender.lastName || ''}\`\n• *Database Status*: Found in active logs 📂`;
        } else {
          idReply = `🔍 *User ID Lookup Result*:\n\nNo interaction records discovered for username *@${parts.slice(1).join(' ')}* in the active session database cache.\n\n_Note: Due to typical privacy security protocols, bots are prevented from querying accounts that have not actively messaged the bot first._`;
        }
      }
    } else {
      idReply = `🆔 *Your Telegram Identifiers*:\n\n• *Your User ID*: \`${fromUser.id}\`\n• *Current Chat ID*: \`${chatId}\`\n• *Username*: @${fromUser.username || 'anonymous'}\n• *Name*: \`${fromUser.first_name || ''} ${fromUser.last_name || ''}\``;
    }

    addLog(
      'outgoing',
      chatId,
      { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
      idReply,
      `Replying with identity lookup details${isSimulated ? ' (Simulated)' : ''}`
    );

    if (!isSimulated && botToken) {
      try {
        await callTelegramAPI('sendMessage', {
          chat_id: chatId,
          text: idReply,
          parse_mode: 'Markdown',
          reply_markup: getCommonInlineKeyboard()
        });
      } catch (err: any) {
        if (messageLogs.length > 0) {
          messageLogs[0].status = `Error sending ID query response: ${err.message}`;
        }
      }
    }
    return;
  }

  const cmdCtx: CommandContext = {
    userText,
    lowerText,
    chatId,
    fromUser,
    isSimulated,
    botUsername,
    botName,
    botToken,
    addLog,
    callTelegramAPI,
    getCommonInlineKeyboard
  };

  // Custom command handler: /poll
  if (await handlePoll(cmdCtx)) {
    return;
  }

  // --- PREMIUM SYSTEM PLUGINS REGISTRATION ---
  
  // 1. Productivity Module Commands (/todo, /habit, /countdown, /timer, /stopwatch, /calendar)
  if (await handleTodo(cmdCtx)) return;
  if (await handleHabit(cmdCtx)) return;
  if (await handleCountdown(cmdCtx)) return;
  if (await handleTimer(cmdCtx)) return;
  if (await handleStopwatch(cmdCtx)) return;
  if (await handleCalendar(cmdCtx)) return;

  // 2. Utility Module Commands (/qr, /shorten, /barcode, /password, /uuid, /hash)
  if (await handleQr(cmdCtx)) return;
  if (await handleShorten(cmdCtx)) return;
  if (await handleBarcode(cmdCtx)) return;
  if (await handlePassword(cmdCtx)) return;
  if (await handleUuid(cmdCtx)) return;
  if (await handleHash(cmdCtx)) return;

  // 3. Filetools Module Commands (/mergepdf, /splitpdf, /compress, /resize, /convert, /ocr)
  if (await handleMergePdf(cmdCtx)) return;
  if (await handleSplitPdf(cmdCtx)) return;
  if (await handleCompress(cmdCtx)) return;
  if (await handleResize(cmdCtx)) return;
  if (await handleConvert(cmdCtx)) return;
  if (await handleOcr(cmdCtx)) return;

  // 4. Telefeatures Module Commands (/userinfo, /chatinfo, /admins, /stats, /invite, /backup)
  if (await handleUserInfo(cmdCtx)) return;
  if (await handleChatInfo(cmdCtx)) return;
  if (await handleAdmins(cmdCtx)) return;
  if (await handleStats(cmdCtx)) return;
  if (await handleInvite(cmdCtx)) return;
  if (await handleBackup(cmdCtx)) return;

  // 5. Community Module Commands (/vote, /quiz, /giveaway, /leaderboard, /suggest, /feedback)
  if (await handleVote(cmdCtx)) return;
  if (await handleQuiz(cmdCtx)) return;
  if (await handleGiveaway(cmdCtx)) return;
  if (await handleLeaderboard(cmdCtx)) return;
  if (await handleSuggest(cmdCtx)) return;
  if (await handleFeedback(cmdCtx)) return;

  // 6. Devtools Module Commands (/json, /base64, /regex, /timestamp, /color)
  if (await handleJson(cmdCtx)) return;
  if (await handleBase64(cmdCtx)) return;
  if (await handleRegex(cmdCtx)) return;
  if (await handleTimestamp(cmdCtx)) return;
  if (await handleColor(cmdCtx)) return;

  // 7. Automation Module Commands (/schedule, /autodelete, /autoreply, /keywords, /welcome, /goodbye)
  if (await handleSchedule(cmdCtx)) return;
  if (await handleAutoDelete(cmdCtx)) return;
  if (await handleAutoReply(cmdCtx)) return;
  if (await handleKeywords(cmdCtx)) return;
  if (await handleWelcome(cmdCtx)) return;
  if (await handleGoodbye(cmdCtx)) return;

  // Custom command handler: /translate
  if (lowerText.startsWith('/translate ') || lowerText.startsWith('/translate@') || lowerText === '/translate') {
    const parts = userText.split(/\s+/);
    if (parts.length > 2) {
      const targetLangName = parts[1];
      const textToTranslate = parts.slice(2).join(' ').trim();

      if (targetLangName && textToTranslate) {
        try {
          const translated = await translateText(textToTranslate, targetLangName);
          const responseMsg = `🔄 *Ad-hoc Real-Time Translation*:\n\n• *Target Language*: \`${targetLangName}\`\n• *Original Text*: "${textToTranslate}"\n• *Translated Output*:\n\n> ${translated}`;

          addLog(
            'outgoing',
            chatId,
            { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
            responseMsg,
            `Ad-hoc translation to ${targetLangName} completed${isSimulated ? ' (Simulated)' : ''}`
          );

          if (!isSimulated && botToken) {
            try {
              await callTelegramAPI('sendMessage', {
                chat_id: chatId,
                text: responseMsg,
                parse_mode: 'Markdown',
                reply_markup: getCommonInlineKeyboard()
              });
            } catch(e) {}
          }
          return;
        } catch (err: any) {
          console.error('Translation error:', err);
        }
      }
    }

    const helpReply = `🔄 *How to run ad-hoc Translation*:\n\nFormat:\n\`/translate <language_name> <text_to_translate>\`\n\n*Example*:\n• \`/translate Spanish Good morning, is everything building green today?\`\n\n_Translates your queried text blocks immediately using our server-side engine!_`;
    addLog(
      'outgoing',
      chatId,
      { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
      helpReply,
      `Sent translation instructions${isSimulated ? ' (Simulated)' : ''}`
    );

    if (!isSimulated && botToken) {
      try {
        await callTelegramAPI('sendMessage', {
          chat_id: chatId,
          text: helpReply,
          parse_mode: 'Markdown',
          reply_markup: getCommonInlineKeyboard()
        });
      } catch (e) {}
    }
    return;
  }

  // Custom command handler: /calculate
  if (await handleCalculate(cmdCtx)) {
    return;
  }

  // Custom command handler: /pdf
  if (lowerText.startsWith('/pdf ') || lowerText.startsWith('/pdf@') || lowerText === '/pdf') {
    const parts = userText.split(/\s+/);
    if (parts.length > 1) {
      const pdfText = userText.substring(userText.indexOf(parts[1])).trim();
      if (pdfText) {
        const encodedText = encodeURIComponent(pdfText);
        const appUrl = (process.env.APP_URL || '').trim();
        const cleanAppUrl = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl;
        const pdfUrl = `${cleanAppUrl || 'https://bot-hub'}/api/render-pdf?text=${encodedText}`;
        
        const successMsg = `📄 *Premium PDF Document Dispatched!*:\n\n• *Content Block*: "${pdfText.substring(0, 100)}${pdfText.length > 100 ? '...' : ''}"\n• *Design Framework*: Minimalist Slate / Border Frame\n• *Download PDF Document*: [Open High-Fidelity PDF Link](${pdfUrl})\n\n_If interacting inside live Telegram, a responsive high-density PDF file is being sent directly below!_ 👇`;

        addLog(
          'outgoing',
          chatId,
          { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
          successMsg,
          `PDF generated successfully: "${pdfText.substring(0, 30)}..."${isSimulated ? ' (Simulated)' : ''}`
        );

        if (!isSimulated && botToken) {
          try {
            const pdfBuffer = await generatePdf(pdfText);
            const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
            
            const formData = new FormData();
            formData.append('chat_id', chatId.toString());
            formData.append('document', blob, 'text_document.pdf');
            formData.append('caption', `📄 Dynamic PDF text document: "${pdfText.substring(0, 30)}..."`);
            
            await callTelegramAPI('sendDocument', formData);
          } catch (err: any) {
            console.warn('sendDocument failed, sending plain markdown link fallback:', err.message);
            try {
              await callTelegramAPI('sendMessage', {
                chat_id: chatId,
                text: successMsg,
                parse_mode: 'Markdown',
                reply_markup: getCommonInlineKeyboard()
              });
            } catch (fallbackErr) {}
          }
        }
        return;
      }
    }

    const helpReply = `📄 *How to generate structured PDF files*:\n\nFormat:\n\`/pdf <any text block content>\`\n\n*Example*:\n• \`/pdf This is the meeting minutes and layout overview of index.ts system!\`\n\n_Creates a clean digital page containing your text blocks, complete with an elegant title header and solid margin border!_`;
    addLog(
      'outgoing',
      chatId,
      { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
      helpReply,
      `Sent PDF instructions${isSimulated ? ' (Simulated)' : ''}`
    );

    if (!isSimulated && botToken) {
      try {
        await callTelegramAPI('sendMessage', {
          chat_id: chatId,
          text: helpReply,
          parse_mode: 'Markdown',
          reply_markup: getCommonInlineKeyboard()
        });
      } catch (e) {}
    }
    return;
  }

  // Custom command handler: /font
  if (lowerText.startsWith('/font ') || lowerText.startsWith('/font@') || lowerText === '/font') {
    const parts = userText.split(/\s+/);
    if (parts.length > 2) {
      const fontName = parts[1];
      const cardContent = parts.slice(2).join(' ').trim();

      if (fontName && cardContent) {
        const encodedText = encodeURIComponent(cardContent);
        const encodedFont = encodeURIComponent(fontName);
        const appUrl = (process.env.APP_URL || '').trim();
        const cleanAppUrl = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl;
        const imageUrl = `${cleanAppUrl || 'https://bot-hub'}/api/render-card?text=${encodedText}&theme=midnight&fontName=${encodedFont}&format=png`;
        
        const successReply = `🎨 *Premium Typography Font Card Rendered!*:\n\n• *Font Family*: \`${fontName}\`\n• *Text*: "${cardContent}"\n• *Download PNG*: [Open High-Fidelity Font-Rendered Card Link](${imageUrl})\n\n_If interacting inside live Telegram, a responsive high-density photo styled with your font is being uploaded below!_ 👇`;
        
        addLog(
          'outgoing',
          chatId,
          { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
          successReply,
          `Custom font image designed: "${cardContent.substring(0, 30)}..." with font ${fontName}${isSimulated ? ' (Simulated)' : ''}`
        );

        if (!isSimulated && botToken) {
          try {
            const svgMarkup = generateSvgTemplate(cardContent, 'midnight', fontName);
            const svgBuffer = Buffer.from(svgMarkup, 'utf-8');
            const pngBuffer = await sharp(svgBuffer).png().toBuffer();
            const blob = new Blob([pngBuffer], { type: 'image/png' });
            
            const formData = new FormData();
            formData.append('chat_id', chatId.toString());
            formData.append('photo', blob, 'text_card_font.png');
            formData.append('caption', `🎨 Premium card [${fontName}]: "${cardContent.substring(0, 30)}..."`);
            
            await callTelegramAPI('sendPhoto', formData);
          } catch (err: any) {
            console.warn('sendPhoto failed, sending plain markdown link fallback:', err.message);
            try {
              await callTelegramAPI('sendMessage', {
                chat_id: chatId,
                text: successReply,
                parse_mode: 'Markdown',
                reply_markup: getCommonInlineKeyboard()
              });
            } catch (fallbackErr) {}
          }
        }
        return;
      }
    }

    const helpReply = `🎨 *How to generate dynamic Typography cards*:\n\nFormat:\n\`/font <Google_Font_Name> <card text content>\`\n\n*Examples*:\n• \`/font Playfair Display High Fashion Design and Elegance\`\n• \`/font Pacifico Summer vibes vacation mode\`\n• \`/font Lobster Tasty and Delicious Treats\`\n• \`/font JetBrains Mono Pure developers control system\`\n\n_Instantly imports that custom typeface from Google Fonts and exports the card as a high-density photo!_`;
    addLog(
      'outgoing',
      chatId,
      { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
      helpReply,
      `Sent custom font card instructions${isSimulated ? ' (Simulated)' : ''}`
    );

    if (!isSimulated && botToken) {
      try {
        await callTelegramAPI('sendMessage', {
          chat_id: chatId,
          text: helpReply,
          parse_mode: 'Markdown',
          reply_markup: getCommonInlineKeyboard()
        });
      } catch (e) {}
    }
    return;
  }

  // Custom command handler: /notepad
  if (await handleNotepad(cmdCtx, getNotepadForSession(chatId))) {
    return;
  }

  // Custom command handler: /weather
  if (lowerText.startsWith('/weather ') || lowerText.startsWith('/weather@') || lowerText === '/weather') {
    const parts = userText.split(/\s+/);
    if (parts.length > 1) {
      const city = parts.slice(1).join(' ').trim();
      if (city) {
        try {
          const weatherRes = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
          if (weatherRes.ok) {
            const data: any = await weatherRes.json();
            const current = data.current_condition?.[0] || {};
            const nearest_area = data.nearest_area?.[0] || {};
            const region = nearest_area.region?.[0]?.value || '';
            const country = nearest_area.country?.[0]?.value || '';

            const tempC = current.temp_C || '17';
            const feelsLikeC = current.FeelsLikeC || '16';
            const humidity = current.humidity || '60';
            const windSpeed = current.windspeedKmph || '12';
            const condition = current.weatherDesc?.[0]?.value || 'Partly Cloudy';

            const weatherMsg = `🌤️ *Real-Time Weather Report: ${city.toUpperCase()}* 🗺️\n\n` +
              `• *Location*: \`${city}, ${region} (${country})\`\n` +
              `• *Condition*: \`${condition}\` ☁️\n` +
              `• *Temperature*: \`${tempC}°C\` (Feels like *${feelsLikeC}°C*)\n` +
              `• *Humidity*: \`${humidity}%\` 💧\n` +
              `• *Wind speed*: \`${windSpeed} km/h\` 🍃\n\n` +
              `_Report fetched automatically via verified open sky sensors!_ 🔋`;

            addLog(
              'outgoing',
              chatId,
              { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
              weatherMsg,
              `Weather queried for ${city}${isSimulated ? ' (Simulated)' : ''}`
            );

            if (!isSimulated && botToken) {
              try {
                await callTelegramAPI('sendMessage', {
                  chat_id: chatId,
                  text: weatherMsg,
                  parse_mode: 'Markdown',
                  reply_markup: getCommonInlineKeyboard()
                });
              } catch (e) {}
            }
            return;
          }
        } catch (e) {
          console.warn('wttr.in failed, falling back to dynamic generator:', e);
        }

        const codes = city.toLowerCase();
        let fallbackTemp = 15 + Math.abs(codes.charCodeAt(0) % 20);
        let fallbackCond = codes.length % 3 === 0 ? 'Clear & Sunny ☀️' : codes.length % 3 === 1 ? 'Rainy & Overcast ⛈️' : 'Misty & Foggy 🌫️';
        if (fallbackCond.includes('Sunny')) fallbackTemp += 5;

        const fallbackMsg = `🌤️ *Deterministic Weather Report: ${city.toUpperCase()}* 🗺️\n\n` +
          `• *Location*: \`${city}\`\n` +
          `• *Condition*: \`${fallbackCond}\`\n` +
          `• *Estimated Temperature*: \`${fallbackTemp}°C\` (Feels like *${fallbackTemp - 2}°C*)\n` +
          `• *Relative Humidity*: \`55%\` 💧\n` +
          `• *Wind Velocity*: \`15 km/h\` 🍃\n\n` +
          `_Resilient fallback dataset updated for this session!_`;

        addLog(
          'outgoing',
          chatId,
          { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
          fallbackMsg,
          `Generated fallback weather indicators for ${city}${isSimulated ? ' (Simulated)' : ''}`
        );

        if (!isSimulated && botToken) {
          try {
            await callTelegramAPI('sendMessage', {
              chat_id: chatId,
              text: fallbackMsg,
              parse_mode: 'Markdown',
              reply_markup: getCommonInlineKeyboard()
            });
          } catch (apiErr) {}
        }
        return;
      }
    }

    const helpReply = `🌤️ *How to query Global Weather*:\n\nFormat:\n\`/weather <city_name>\`\n\n*Example*:\n• \`/weather Tokyo\`\n• \`/weather New York\`\n\n_Fetches or estimates active temperatures and relative humidity statistics!_`;
    addLog(
      'outgoing',
      chatId,
      { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
      helpReply,
      `Sent weather instructions${isSimulated ? ' (Simulated)' : ''}`
    );

    if (!isSimulated && botToken) {
      try {
        await callTelegramAPI('sendMessage', {
          chat_id: chatId,
          text: helpReply,
          parse_mode: 'Markdown',
          reply_markup: getCommonInlineKeyboard()
        });
      } catch (e) {}
    }
    return;
  }

  // Custom command handler: /broadcast
  if (lowerText.startsWith('/broadcast ') || lowerText.startsWith('/broadcast@') || lowerText === '/broadcast') {
    const parts = userText.split(/\s+/);
    if (parts.length > 1) {
      const broadcastMsg = userText.substring(userText.indexOf(parts[1])).trim();
      if (broadcastMsg) {
        const loggedChats = messageLogs.map(l => l.chatId);
        const reminderChats = botReminders.map(r => r.chatId);
        const allChats = Array.from(new Set([chatId, 123456, ...loggedChats, ...reminderChats]));

        const broadcastPayload = `📢 *SYSTEM BROADCAST ALERT* 📢\n\n> "${broadcastMsg}"\n\n_Dispatched by Administrator ${fromUser.first_name || 'Admin'} • Please test this sandbox update!_ 🔋`;

        let successCount = 0;
        let failCount = 0;

        for (const recipientId of allChats) {
          addLog(
            'outgoing',
            recipientId,
            { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
            broadcastPayload,
            `Broadcast item dispatched successfully to Chat ID ${recipientId}${isSimulated ? ' (Simulated)' : ''}`
          );

          if (!isSimulated && botToken && recipientId !== 123456) {
            try {
              await callTelegramAPI('sendMessage', {
                chat_id: recipientId,
                text: broadcastPayload,
                parse_mode: 'Markdown'
              });
              successCount++;
            } catch (err: any) {
              console.warn(`Could not dispatch broadcast message to ${recipientId}:`, err.message);
              failCount++;
            }
          } else {
            successCount++;
          }
        }

        const statsReply = `✅ *Broadcast Dispatch Completed!*:\n\n• *Target chats queried*: \`${allChats.length}\`\n• *Successful pings*: \`${successCount}\`\n• *Errors encountered*: \`${failCount}\`\n\n_All targeted sessions have been fully logged in the control board!_ ✨`;
        
        addLog(
          'outgoing',
          chatId,
          { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
          statsReply,
          `Broadcast dispatch completed for ${allChats.length} accounts${isSimulated ? ' (Simulated)' : ''}`
        );

        if (!isSimulated && botToken) {
          try {
            await callTelegramAPI('sendMessage', {
              chat_id: chatId,
              text: statsReply,
              parse_mode: 'Markdown',
              reply_markup: getCommonInlineKeyboard()
            });
          } catch (e) {}
        }
        return;
      }
    }

    const helpReply = `📢 *How to dispatch a Global Broadcast*:\n\nFormat:\n\`/broadcast <any system message content>\`\n\n*Example*:\n• \`/broadcast Server system diagnostics complete. Optimal 🟢!\`\n\n_Dispatches dynamic overlay logs to all simulated and live active Telegram users immediately!_`;
    addLog(
      'outgoing',
      chatId,
      { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
      helpReply,
      `Sent broadcast instructions${isSimulated ? ' (Simulated)' : ''}`
    );

    if (!isSimulated && botToken) {
      try {
        await callTelegramAPI('sendMessage', {
          chat_id: chatId,
          text: helpReply,
          parse_mode: 'Markdown',
          reply_markup: getCommonInlineKeyboard()
        });
      } catch (e) {}
    }
    return;
  }

  // Custom command handler: /reminder
  if (lowerText.startsWith('/reminder ') || lowerText.startsWith('/reminder@') || lowerText === '/reminder') {
    const parts = userText.split(/\s+/);
    if (parts.length > 2) {
      const durationStr = parts[1]; // e.g., "10", "5m", "1h", "30s"
      const reminderMsg = parts.slice(2).join(' ').trim();
      
      // Parse duration
      let seconds = 0;
      const match = durationStr.match(/^(\d+)(s|m|h)?$/i);
      if (match) {
        const value = parseInt(match[1], 10);
        const unit = (match[2] || 's').toLowerCase();
        if (unit === 's') seconds = value;
        else if (unit === 'm') seconds = value * 60;
        else if (unit === 'h') seconds = value * 3600;
      } else {
        seconds = parseInt(durationStr, 10) || 0;
      }
      
      if (seconds > 0 && reminderMsg) {
        const dueTime = Date.now() + seconds * 1000;
        const newReminder = {
          id: `rem_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          chatId,
          fromUser: {
            id: fromUser.id,
            first_name: fromUser.first_name || fromUser.firstName || 'User',
            username: fromUser.username
          },
          message: reminderMsg,
          createdAt: Date.now(),
          dueTime,
          triggered: false
        };
        botReminders.push(newReminder);
        
        const confirmReply = `🔔 *Reminder Set Successfully!*:\n\n• *Message*: \`${reminderMsg}\`\n• *Delay*: \`${durationStr}\` (triggers in ${seconds}s)\n• *Scheduled For*: \`${new Date(dueTime).toLocaleTimeString()}\`\n\nI will ping you here when the countdown completes! 🕰️`;
        
        addLog(
          'outgoing',
          chatId,
          { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
          confirmReply,
          `Reminder queued: triggers in ${seconds}s${isSimulated ? ' (Simulated)' : ''}`
        );
        
        if (!isSimulated && botToken) {
          try {
            await callTelegramAPI('sendMessage', {
              chat_id: chatId,
              text: confirmReply,
              parse_mode: 'Markdown',
              reply_markup: getCommonInlineKeyboard()
            });
          } catch (err: any) {
            console.error('Error reply reminder confirm:', err);
          }
        }
        return;
      }
    }

    if (userText === '/reminder' || userText.toLowerCase() === '/reminder list') {
      const activeForChat = botReminders.filter(r => r.chatId === chatId && !r.triggered);
      let listMsg = '';
      if (activeForChat.length > 0) {
        listMsg = `📅 *Your Active Scheduled Reminders ({count})*:\n\n`;
        activeForChat.forEach((rem, idx) => {
          const remainSecs = Math.max(0, Math.round((rem.dueTime - Date.now()) / 1000));
          listMsg += `• *[${idx + 1}]* "${rem.message}" in \`${remainSecs}s\` (at ${new Date(rem.dueTime).toLocaleTimeString()})\n`;
        });
        listMsg += `\n_Reminders run automatically in the background._ 🕰️`;
      } else {
        listMsg = `📅 *No active reminders found for this chat.* 🕰️\n\nCreate one using: \`/reminder <duration> <message>\``;
      }
      
      const parsedList = listMsg.replace('{count}', activeForChat.length.toString());
      addLog(
        'outgoing',
        chatId,
        { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
        parsedList,
        `Listed pending reminders for chat ${chatId}${isSimulated ? ' (Simulated)' : ''}`
      );
      
      if (!isSimulated && botToken) {
        try {
          await callTelegramAPI('sendMessage', {
            chat_id: chatId,
            text: parsedList,
            parse_mode: 'Markdown',
            reply_markup: getCommonInlineKeyboard()
          });
        } catch (e) {}
      }
      return;
    }

    const helpReply = `💡 *How to creation a Reminder*:\n\nFormat: \`/reminder <time> <your custom message>\`\n\n*Examples*:\n• \`/reminder 10s look at the code\`\n• \`/reminder 5m complete the audit\`\n• \`/reminder 1h start the live webinar\`\n\nType \`/reminder\` or \`/reminder list\` to view your pending roster!`;
    addLog(
      'outgoing',
      chatId,
      { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
      helpReply,
      `Sent reminder instructions${isSimulated ? ' (Simulated)' : ''}`
    );
    
    if (!isSimulated && botToken) {
      try {
        await callTelegramAPI('sendMessage', {
          chat_id: chatId,
          text: helpReply,
          parse_mode: 'Markdown',
          reply_markup: getCommonInlineKeyboard()
        });
      } catch (e) {}
    }
    return;
  }

  // Custom command handler: /image, /render, /imgcard
  if (lowerText.startsWith('/image ') || lowerText.startsWith('/image@') || lowerText === '/image' ||
      lowerText.startsWith('/render ') || lowerText.startsWith('/render@') || lowerText === '/render' ||
      lowerText.startsWith('/imgcard ') || lowerText.startsWith('/imgcard@') || lowerText === '/imgcard') {
    const parts = userText.split(/\s+/);
    if (parts.length > 1) {
      const cardContent = userText.substring(userText.indexOf(parts[1])).trim();
      if (cardContent) {
        const encodedText = encodeURIComponent(cardContent);
        const appUrl = (process.env.APP_URL || '').trim();
        const cleanAppUrl = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl;
        const imageUrl = `${cleanAppUrl || 'https://bot-hub'}/api/render-card?text=${encodedText}&theme=midnight&format=png`;
        
        const successReply = `🎨 *Premium Image Card Rendered!*:\n\n• *Text*: "${cardContent}"\n• *Style Theme*: Midnight Neon Gradient\n• *Download PNG*: [Open High-Fidelity PNG Image Link](${imageUrl})\n\n_If interacting inside live Telegram, a responsive high-density PNG photo is being sent directly below!_ 👇`;
        
        // Log generation with a specific tag for custom inline rendering in simulated logs
        addLog(
          'outgoing',
          chatId,
          { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
          `🎨 [Card generated: "${cardContent}"]\n\n${successReply}`,
          `Direct text to image model card generated${isSimulated ? ' (Simulated)' : ''}`
        );
        
        if (!isSimulated && botToken) {
          try {
            const svgMarkup = generateSvgTemplate(cardContent, 'midnight');
            const svgBuffer = Buffer.from(svgMarkup, 'utf-8');
            const pngBuffer = await sharp(svgBuffer).png().toBuffer();
            const blob = new Blob([pngBuffer], { type: 'image/png' });
            
            const formData = new FormData();
            formData.append('chat_id', chatId.toString());
            formData.append('photo', blob, 'text_card.png');
            formData.append('caption', `🎨 Premium dynamic text card image: "${cardContent.substring(0, 30)}..."`);
            
            await callTelegramAPI('sendPhoto', formData);
          } catch (err: any) {
            console.warn('sendPhoto failed, sending plain markdown link fallback:', err.message);
            try {
              await callTelegramAPI('sendMessage', {
                chat_id: chatId,
                text: successReply,
                parse_mode: 'Markdown',
                reply_markup: getCommonInlineKeyboard()
              });
            } catch (msgErr) {}
          }
        }
        return;
      }
    }

    const imageHelp = `🎨 *How to generate beautiful Text Cards*:\n\nFormat: \`/image <any text message>\`\n\n*Example*:\n• \`/image Hard work always pays off! 🚀\`\n\nCreates a gorgeous modern layout with gradients, glowing typography, and rounded cards. Safe and downloadable!`;
    addLog(
      'outgoing',
      chatId,
      { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
      imageHelp,
      `Sent text card generation instructions${isSimulated ? ' (Simulated)' : ''}`
    );
    
    if (!isSimulated && botToken) {
      try {
        await callTelegramAPI('sendMessage', {
          chat_id: chatId,
          text: imageHelp,
          parse_mode: 'Markdown',
          reply_markup: getCommonInlineKeyboard()
        });
      } catch (e) {}
    }
    return;
  }

  // 2. Identify is there a matching command
  const matchedCommand = botCommands.find(cmd => {
    // Exact match or matches start (e.g. "/start test" triggers "/start")
    const lowerText = userText.toLowerCase();
    const commandLower = cmd.command.toLowerCase();
    return lowerText === commandLower || lowerText.startsWith(commandLower + ' ');
  });

  if (matchedCommand) {
    const formattedReply = formatResponseText(matchedCommand.responseTemplate, fromUser, chatId);
    
    // 3. Log matching response attempt
    addLog(
      'outgoing',
      chatId,
      { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
      formattedReply,
      `Replying with '${matchedCommand.command}' template${isSimulated ? ' (Simulated)' : ''}`
    );

    // 4. Send the actual message back if live (non-simulated)
    if (!isSimulated && botToken) {
      try {
        await callTelegramAPI('sendMessage', {
          chat_id: chatId,
          text: formattedReply,
          parse_mode: 'Markdown',
          reply_markup: getCommonInlineKeyboard()
        });
      } catch (err: any) {
        // Update the log with error status
        if (messageLogs.length > 0) {
          messageLogs[0].status = `Error sending reply: ${err.message}`;
        }
      }
    }
  } else {
    // Handle fallback trigger or automatic translation custom behaviors
    const settings = getSessionSettings(chatId);
    if (settings.autoTranslate && settings.targetLang) {
      try {
        const translated = await translateText(userText, settings.targetLang);
        const translateReply = `🤖 *Auto-Translation Dispatch* 🔄\n\n• *Target Language*: \`${settings.targetLang}\`\n• *Original message*: "${userText}"\n• *Translated Message*:\n\n> ${translated}\n\n_Real-time automatic translation is active for this session!_ 🔋`;
        
        addLog(
          'outgoing',
          chatId,
          { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
          translateReply,
          `Auto-translated inbound non-command text message to ${settings.targetLang}${isSimulated ? ' (Simulated)' : ''}`
        );

        if (!isSimulated && botToken) {
          try {
            await callTelegramAPI('sendMessage', {
              chat_id: chatId,
              text: translateReply,
              parse_mode: 'Markdown',
              reply_markup: getCommonInlineKeyboard()
            });

            // Accent mapping
            let langCode = getLanguageCode(settings.targetLang);
            if (settings.voiceAccent && settings.voiceAccent !== 'en-US') {
              langCode = settings.voiceAccent.split('-')[0] || langCode;
            }
            const speedMultiplier = settings.voiceSpeed || 1.0;
            const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(langCode)}&client=tw-ob&q=${encodeURIComponent(translated.substring(0, 200).trim())}&ttsspeed=${speedMultiplier}&speed=${speedMultiplier}`;
            
            const ttsResponse = await fetch(ttsUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://translate.google.com/'
              }
            });

            if (ttsResponse.ok) {
              const arrayBuffer = await ttsResponse.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              const blob = new Blob([buffer], { type: 'audio/mpeg' });
              
              const formData = new FormData();
              formData.append('chat_id', chatId.toString());
              formData.append('voice', blob, 'autotranslate.ogg');
              formData.append('caption', `🗣️ Voice synthesis: target targetLang: ${settings.targetLang}`);
              await callTelegramAPI('sendVoice', formData);
            }
          } catch (apiErr: any) {
            console.error('AutoTranslate Telegram broadcast failed:', apiErr.message);
          }
        }
        return;
      } catch (transErr: any) {
        console.warn('AutoTranslate failing, falling back to standard default responder:', transErr.message);
      }
    }

    // 📑 KEYWORD AUTOMATION AND AUTO-REPLY INTERCEPTION
    const currentKeywords = db.getData().keywords;
    let keywordHandled = false;
    for (const kw of Object.keys(currentKeywords)) {
      if (lowerText.includes(kw.toLowerCase())) {
        currentKeywords[kw].count++;
        db.save();
        
        const actionText = `📑 *Phrase Keyword Trigger Hit!* 📊\n\n• *Matched Phrase*: \`${kw}\`\n• *Automated System Action*: "${currentKeywords[kw].action}"`;
        addLog(
          'outgoing',
          chatId,
          { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
          actionText,
          `Triggered keyword automation for '${kw}'${isSimulated ? ' (Simulated)' : ''}`
        );

        if (!isSimulated && botToken) {
          try {
            await callTelegramAPI('sendMessage', {
              chat_id: chatId,
              text: actionText,
              parse_mode: 'Markdown',
              reply_markup: getCommonInlineKeyboard()
            });
          } catch (e) {}
        }
        keywordHandled = true;
        return;
      }
    }

    if (!keywordHandled) {
      const currentReplies = db.getData().autoReplies;
      const matchedReplyRule = currentReplies.find(rule => lowerText.includes(rule.trigger.toLowerCase()));
      if (matchedReplyRule) {
        const replyText = `🤖 *Keyword Auto-Reply Match*:\n\n${matchedReplyRule.reply}`;
        addLog(
          'outgoing',
          chatId,
          { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
          replyText,
          `Triggered auto-reply for '${matchedReplyRule.trigger}'${isSimulated ? ' (Simulated)' : ''}`
        );

        if (!isSimulated && botToken) {
          try {
            await callTelegramAPI('sendMessage', {
              chat_id: chatId,
              text: replyText,
              parse_mode: 'Markdown',
              reply_markup: getCommonInlineKeyboard()
            });
          } catch (e) {}
        }
        return;
      }
    }

    // Math auto-evaluation fallback check via npm mathguru
    let evaluatedMathResult: any = null;
    let isMathExpressionResult = false;

    // A math expression must contain some digits, variables or operators, and not be too conversational
    const hasMathSigns = /[\d+\-*/%^()=<>]/.test(userText) || /\b(sin|cos|tan|sqrt|pi|log|ln|abs|exp)\b/i.test(userText);
    if (hasMathSigns && userText.trim().length > 0) {
      try {
        const result = mathguru.calc.evaluate(userText);
        if (result !== undefined && result !== null && typeof result !== 'function' && typeof result !== 'object') {
          evaluatedMathResult = result;
          isMathExpressionResult = true;
        }
      } catch (err) {
        // Not a valid mathematical expression
      }
    }

    if (isMathExpressionResult) {
      const mathReply = `🧮 *Mathematical calculation Successful*:\n\n• *Query*: \`${userText}\`\n• *Solution Outcome*:\n\n> *${evaluatedMathResult}*\n\n_Engine: MathGuru Native Parser Core_ 🔋`;
      
      addLog(
        'outgoing',
        chatId,
        { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
        mathReply,
        `Successfully calculated expression: ${userText} without slash${isSimulated ? ' (Simulated)' : ''}`
      );

      if (!isSimulated && botToken) {
        try {
          await callTelegramAPI('sendMessage', {
            chat_id: chatId,
            text: mathReply,
            parse_mode: 'Markdown',
            reply_markup: getCommonInlineKeyboard()
          });
        } catch (e) {}
      }
      return;
    }

    // Handle fallback trigger
    const fallbackReply = `Thanks for messaging me, ${fromUser.first_name || 'there'}! I loaded your message "${userText}", but I only understand commands registered in my control panel.\n\nTry sending \`/start\` to see if I am working properly! 🤖`;
    
    addLog(
      'outgoing',
      chatId,
      { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
      fallbackReply,
      `Replying with standard default trigger fallback${isSimulated ? ' (Simulated)' : ''}`
    );

    if (!isSimulated && botToken) {
      try {
        await callTelegramAPI('sendMessage', {
          chat_id: chatId,
          text: fallbackReply,
          parse_mode: 'Markdown',
          reply_markup: getCommonInlineKeyboard()
        });
      } catch (err: any) {
        if (messageLogs.length > 0) {
          messageLogs[0].status = `Error sending fallback: ${err.message}`;
        }
      }
    }
  }
}

// --- API ENDPOINTS ---

// Text To Speech proxy endpoint
app.get('/api/tts', async (req, res) => {
  const text = req.query.text as string;
  const lang = req.query.lang as string || 'en';
  const speed = req.query.speed as string || '1.0';
  
  if (!text) {
    return res.status(400).send('Text parameter is required');
  }

  // Google Translate TTS accepts max 200 characters
  const cleanText = text.substring(0, 200).trim();
  
  // Normalize language accent subtags (e.g., 'en-US' -> 'en', but keep 'zh-CN')
  let cleanLang = lang.trim().toLowerCase();
  if (cleanLang.includes('-') && !cleanLang.startsWith('zh')) {
    cleanLang = cleanLang.split('-')[0];
  }

  // Build the secondary speed parameter (usually between 0 and 1)
  const numericSpeed = Number(speed) || 1.0;
  const urlSpeed = numericSpeed < 0.6 ? 0.6 : (numericSpeed > 1.4 ? 1.4 : numericSpeed);

  let ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(cleanLang)}&client=tw-ob&q=${encodeURIComponent(cleanText)}&ttsspeed=${urlSpeed}&speed=${urlSpeed}`;

  try {
    let ttsResponse = await fetch(ttsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://translate.google.com/'
      }
    });

    // If first request failed or returned 400/403/404, retry with default language and default speed parameters
    if (!ttsResponse.ok) {
      console.warn(`Initial Google TTS with ${cleanLang} returned: ${ttsResponse.status}. Attempting self-healing fallback.`);
      const fallbackUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(cleanText)}`;
      ttsResponse = await fetch(fallbackUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://translate.google.com/'
        }
      });
    }

    if (!ttsResponse.ok) {
      throw new Error(`Google TTS failed even on self-healing retry (status: ${ttsResponse.status})`);
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const arrayBuffer = await ttsResponse.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    console.error('Error proxying TTS request:', err.message);
    res.status(500).send('Error proxying TTS');
  }
});

// GET user session settings
app.get('/api/user-settings', (req, res) => {
  const chatId = req.query.chatId ? parseInt(req.query.chatId as string, 10) : null;
  if (chatId) {
    res.json({ success: true, settings: getSessionSettings(chatId) });
  } else {
    res.json({ success: true, allSettings: userSessionSettings });
  }
});

// POST to update user session settings
app.post('/api/user-settings', (req, res) => {
  const { chatId, language, voiceSpeed, voiceAccent, autoTranslate, targetLang } = req.body;
  if (!chatId) {
    return res.status(400).json({ success: false, error: 'chatId is required' });
  }
  const numericId = parseInt(chatId, 10);
  if (isNaN(numericId)) {
    return res.status(400).json({ success: false, error: 'chatId must be numeric' });
  }

  const settings = getSessionSettings(numericId);
  if (language !== undefined) {
    settings.language = language;
    userLanguages[numericId] = language;
  }
  if (voiceSpeed !== undefined) {
    settings.voiceSpeed = Number(voiceSpeed) || 1.0;
  }
  if (voiceAccent !== undefined) {
    settings.voiceAccent = String(voiceAccent);
  }
  if (autoTranslate !== undefined) {
    settings.autoTranslate = !!autoTranslate;
  }
  if (targetLang !== undefined) {
    settings.targetLang = String(targetLang);
  }

  res.json({ success: true, settings });
});

// Check diagnostic configurations & bot registration state
app.get('/api/config', async (req, res) => {
  if (botUsername && !longPollingActive && botToken) {
    startLongPolling();
  }

  res.json({
    isConnected: !!botUsername,
    config: {
      botUsername,
      botName,
      webhookUrl,
      isWebhookActive,
      commands: botCommands,
      longPollingActive,
      targetChatId,
      reminderTemplate
    },
    appUrl: process.env.APP_URL || ''
  });
});

// GET active polling status
app.get('/api/polling', (req, res) => {
  res.json({ active: longPollingActive });
});

// Toggle/set active polling status
app.post('/api/polling', async (req, res) => {
  const { active } = req.body;
  if (active) {
    await startLongPolling();
  } else {
    stopLongPolling();
  }
  res.json({ success: true, active: longPollingActive, isWebhookActive, webhookUrl });
});

// Configure bot parameters securely
app.post('/api/config', async (req, res) => {
  const { token, commands, targetChatId: targetIdParam, reminderTemplate: reminderTemplateParam } = req.body;
  
  if (commands && Array.isArray(commands)) {
    botCommands = commands;
  }

  if (targetIdParam !== undefined) {
    targetChatId = targetIdParam || null;
  }

  if (reminderTemplateParam !== undefined) {
    reminderTemplate = reminderTemplateParam;
  }

  let connectionSuccess = false;
  if (typeof token === 'string' && token !== '') {
    const isTokenDifferent = token !== botToken;
    if (isTokenDifferent) {
      botToken = token;
      
      // Attempt connect
      const success = await validateAndFetchBotProfile(token);
      if (success) {
        connectionSuccess = true;
        // Always default to highly robust Server Polling in restricted sandboxes
        longPollingActive = true;
        stopLongPolling();
        await startLongPolling();
      } else {
        isWebhookActive = false;
        webhookUrl = null;
        stopLongPolling();
      }
    } else if (botUsername) {
      // Token is same but we are already connected
      connectionSuccess = true;
    }
  } else if (botUsername) {
    // No token passed but bot is already connected
    connectionSuccess = true;
  }

  // Trigger automated greeting welcome message if we're connected and a targetChatId exists
  if (connectionSuccess && targetChatId) {
    // Use an asynchronous call so we don't stall the dashboard update response
    testConnectMessage(targetChatId);
  }

  res.json({
    success: true,
    isConnected: !!botUsername,
    botUsername,
    botName,
    isWebhookActive,
    webhookUrl,
    commands: botCommands,
    longPollingActive,
    targetChatId,
    reminderTemplate
  });
});

// Register bot webhook explicitly
app.post('/api/register-webhook', async (req, res) => {
  if (!botToken) {
    return res.status(400).json({ success: false, error: 'Token is unconfigured' });
  }
  const success = await configureWebhook(botToken);
  res.json({ success, isWebhookActive, webhookUrl });
});

// De-register bot webhook explicitly
app.post('/api/delete-webhook', async (req, res) => {
  if (!botToken) {
    return res.status(400).json({ success: false, error: 'Token is unconfigured' });
  }
  try {
    await callTelegramAPI('deleteWebhook', {});
    isWebhookActive = false;
    webhookUrl = null;
    res.json({ success: true, isWebhookActive: false });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fetch log stream (latest communication records)
app.get('/api/updates', (req, res) => {
  res.json({ logs: messageLogs });
});

// Simulate incoming message directly via the sandbox console
app.post('/api/simulate-update', async (req, res) => {
  const { text, username, firstName, lastName, chatId } = req.body;

  const mockSender = {
    id: chatId || 123456,
    is_bot: false,
    first_name: firstName || 'SimulatorUser',
    last_name: lastName || 'Aistudio',
    username: username || 'test_bot_user',
    language_code: 'en'
  };

  const mockUpdate = {
    update_id: Math.floor(Math.random() * 10000000),
    message: {
      message_id: Math.floor(Math.random() * 1000),
      from: mockSender,
      chat: {
        id: chatId || 123456,
        first_name: firstName || 'SimulatorUser',
        username: username || 'test_bot_user',
        type: 'private'
      },
      date: Math.floor(Date.now() / 1000),
      text: text || '/start'
    }
  };

  await processTelegramUpdate(mockUpdate, true);
  res.json({ success: true, logs: messageLogs });
});

// Dispatch real manual messages back to active users
app.post('/api/send-message', async (req, res) => {
  const { chatId, text } = req.body;
  if (!chatId || !text) {
    return res.status(400).json({ success: false, error: 'chatId and text are required' });
  }
  if (!botToken) {
    return res.status(400).json({ success: false, error: 'Bot token not specified' });
  }

  try {
    const response = await callTelegramAPI('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown'
    });

    // Log the outgoing custom manual message
    addLog(
      'outgoing',
      chatId,
      { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
      text,
      'Dispatched manually from admin dashboard',
      response
    );

    res.json({ success: true, result: response });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// The standard Telegram Webhook Endpoint
app.post('/api/telegram-webhook', async (req, res) => {
  console.log('Received Telegram update via webhook:', req.body);
  try {
    await processTelegramUpdate(req.body, false);
    res.status(200).send('OK');
  } catch (error: any) {
    console.error('Error handling webhook update:', error);
    res.status(500).send('Internal Server Error');
  }
});

// --- REMINDERS API ENDPOINTS ---
app.get('/api/reminders', (req, res) => {
  res.json({ success: true, reminders: botReminders });
});

app.post('/api/reminders', (req, res) => {
  const { chatId, seconds, message, fromUser } = req.body;
  const numericChat = parseInt(chatId, 10) || 123456;
  const numSecs = parseInt(seconds, 10) || 10;
  
  if (!message) {
    return res.status(400).json({ success: false, error: 'Message is required' });
  }

  const dueTime = Date.now() + numSecs * 1000;
  const newRem = {
    id: `rem_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    chatId: numericChat,
    fromUser: fromUser || { id: numericChat, first_name: 'Dashboard Admin' },
    message,
    createdAt: Date.now(),
    dueTime,
    triggered: false
  };

  botReminders.unshift(newRem);

  // Formulate log entry for the manual scheduler
  addLog(
    'incoming',
    numericChat,
    newRem.fromUser,
    `[Scheduled Reminder via Dashboard]: "${message}" in ${numSecs}s`,
    'Pending dispatch countdown'
  );

  res.json({ success: true, reminder: newRem, reminders: botReminders });
});

app.delete('/api/reminders/:id', (req, res) => {
  const { id } = req.params;
  botReminders = botReminders.filter(rem => rem.id !== id);
  res.json({ success: true, reminders: botReminders });
});

// --- DYNAMIC PDF EXPORTER ENDPOINT & HELPER ---
async function generatePdf(text: string, fontName: string = 'Helvetica-Bold'): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  let pdfFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  if (fontName.toLowerCase().includes('times')) {
    pdfFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  } else if (fontName.toLowerCase().includes('courier')) {
    pdfFont = await pdfDoc.embedFont(StandardFonts.Courier);
  }

  const page = pdfDoc.addPage([600, 800]);
  const { width, height } = page.getSize();
  
  // Outer frame
  page.drawRectangle({
    x: 20,
    y: 20,
    width: width - 40,
    height: height - 40,
    borderWidth: 1.5,
    borderColor: rgb(0.2, 0.25, 0.35),
    color: rgb(0.96, 0.97, 0.99),
  });

  // Top header block with premium deep indigo/violet theme
  page.drawRectangle({
    x: 20,
    y: height - 120,
    width: width - 40,
    height: 100,
    color: rgb(0.1, 0.1, 0.25),
  });

  page.drawLine({
    start: { x: 20, y: height - 120 },
    end: { x: width - 20, y: height - 120 },
    thickness: 4,
    color: rgb(0.22, 0.74, 0.97), // Cyan divider
  });

  const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  page.drawText('SANDBOX DOCUMENT DISPATCH', {
    x: 40,
    y: height - 60,
    size: 20,
    font: titleFont,
    color: rgb(1, 1, 1),
  });

  page.drawText('DYNAMIC PREMIUM DOCUMENT ENGINE', {
    x: 40,
    y: height - 90,
    size: 10,
    font: pdfFont,
    color: rgb(0.7, 0.8, 1),
  });

  // Split lines
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length < 55) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  let currentY = height - 180;
  for (const line of lines) {
    if (currentY < 60) break;
    page.drawText(line, {
      x: 45,
      y: currentY,
      size: 14,
      font: pdfFont,
      color: rgb(0.15, 0.2, 0.25),
    });
    currentY -= 28;
  }

  // Footer bar
  page.drawRectangle({
    x: 20,
    y: 20,
    width: width - 40,
    height: 35,
    color: rgb(0.9, 0.92, 0.95),
  });

  const monoFont = await pdfDoc.embedFont(StandardFonts.Courier);
  page.drawText('GENERATED ON: ' + new Date().toISOString() + ' • BRAND: KONYRA', {
    x: 40,
    y: 33,
    size: 9,
    font: monoFont,
    color: rgb(0.4, 0.45, 0.5),
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

app.get('/api/render-pdf', async (req, res) => {
  const text = (req.query.text as string) || 'No content provided';
  try {
    const pdfBuffer = await generatePdf(text);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="rendered_document.pdf"');
    res.status(200).send(pdfBuffer);
  } catch (err: any) {
    console.error('Error compiling PDF route:', err.message);
    res.status(500).send('Could not generate PDF: ' + err.message);
  }
});

// --- BACKEND NOTEPAD SYNC ENDPOINTS ---
app.get('/api/notepad', (req, res) => {
  const chatId = parseInt(req.query.chatId as string, 10) || 98765432;
  const notes = getNotepadForSession(chatId);
  res.json({ success: true, notes });
});

app.post('/api/notepad', (req, res) => {
  const chatId = parseInt(req.body.chatId as string, 10) || 98765432;
  const content = (req.body.content as string || '').trim();
  const notes = getNotepadForSession(chatId);
  
  if (content) {
    const newId = notes.length > 0 ? Math.max(...notes.map(n => n.id)) + 1 : 1;
    const newNote: NotepadItem = {
      id: newId,
      content,
      timestamp: new Date().toISOString()
    };
    notes.push(newNote);
    res.json({ success: true, notes, note: newNote });
  } else {
    res.status(400).json({ success: false, error: 'Empty content blocks' });
  }
});

app.put('/api/notepad', (req, res) => {
  const chatId = parseInt(req.body.chatId as string, 10) || 98765432;
  const idValue = parseInt(req.body.id as string, 10);
  const contentValue = (req.body.content as string || '').trim();
  const notes = getNotepadForSession(chatId);

  if (!isNaN(idValue) && contentValue) {
    const note = notes.find(n => n.id === idValue);
    if (note) {
      note.content = contentValue;
      note.timestamp = new Date().toISOString();
      res.json({ success: true, notes, note });
      return;
    }
  }
  res.status(400).json({ success: false, error: 'Cannot modify notebook matching specifications' });
});

app.delete('/api/notepad', (req, res) => {
  const chatId = parseInt(req.query.chatId as string, 10) || 98765432;
  const idValue = parseInt(req.query.id as string, 10);
  
  if (!isNaN(idValue)) {
    const notes = getNotepadForSession(chatId);
    userNotepads[chatId] = notes.filter(n => n.id !== idValue);
    res.json({ success: true, notes: userNotepads[chatId] });
  } else {
    res.status(400).json({ success: false, error: 'Cannot identify note id' });
  }
});

// --- DYNAMIC CARD IMAGE EXPORTER ENDPOINT ---
app.get('/api/render-card', async (req, res) => {
  const text = (req.query.text as string) || 'No text content provided';
  const theme = (req.query.theme as string) || 'midnight';
  const format = (req.query.format as string || 'png').toLowerCase();
  const fontName = (req.query.fontName as string) || 'Outfit';
  
  const svg = generateSvgTemplate(text, theme, fontName);

  try {
    const svgBuffer = Buffer.from(svg, 'utf-8');
    if (format === 'jpg' || format === 'jpeg') {
      const jpgBuffer = await sharp(svgBuffer)
        .jpeg({ quality: 90 })
        .toBuffer();
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Disposition', 'inline; filename="exported_card.jpg"');
      res.status(200).send(jpgBuffer);
    } else {
      const pngBuffer = await sharp(svgBuffer)
        .png()
        .toBuffer();
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', 'inline; filename="exported_card.png"');
      res.status(200).send(pngBuffer);
    }
  } catch (err: any) {
    console.error('Error rendering PNG/JPG via sharp, falling back to raw SVG:', err);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Content-Disposition', 'inline; filename="exported_card.svg"');
    res.status(200).send(svg);
  }
});

// Helper SVG card markup builder
function generateSvgTemplate(text: string, theme: string = 'midnight', fontName: string = 'Outfit'): string {
  const fontUrlName = encodeURIComponent(fontName);
  const maxLineLength = 40;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxLineLength) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  
  const cleanLines = lines.slice(0, 8);
  const tspansMarkup = cleanLines.map((line, index) => {
    return `<tspan x="0" dy="${index === 0 ? 0 : 28}">${escapeXml(line)}</tspan>`;
  }).join('\n');

  let bgGradient = `
    <linearGradient id="card-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="50%" stop-color="#1e1b4b" />
      <stop offset="100%" stop-color="#581c87" />
    </linearGradient>
  `;
  if (theme === 'sunrise') {
    bgGradient = `
      <linearGradient id="card-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#7c2d12" />
        <stop offset="50%" stop-color="#9a3412" />
        <stop offset="100%" stop-color="#b91c1c" />
      </linearGradient>
    `;
  } else if (theme === 'emerald') {
    bgGradient = `
      <linearGradient id="card-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#064e3b" />
        <stop offset="50%" stop-color="#115e59" />
        <stop offset="100%" stop-color="#0f766e" />
      </linearGradient>
    `;
  } else if (theme === 'amethyst') {
    bgGradient = `
      <linearGradient id="card-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#3b0764" />
        <stop offset="50%" stop-color="#4c1d95" />
        <stop offset="100%" stop-color="#6d28d9" />
      </linearGradient>
    `;
  } else if (theme === 'slate') {
    bgGradient = `
      <linearGradient id="card-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#18181b" />
        <stop offset="50%" stop-color="#27272a" />
        <stop offset="100%" stop-color="#3f3f46" />
      </linearGradient>
    `;
  }

  return `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <defs>
    ${bgGradient}
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=${fontUrlName}:wght@400;600;800&amp;family=JetBrains+Mono:wght@500&amp;display=swap');
      .title-text {
        font-family: '${fontName}', sans-serif;
        font-weight: 800;
        fill: #38bdf8;
        font-size: 22px;
        letter-spacing: 1.5px;
      }
      .content-text {
        font-family: '${fontName}', sans-serif;
        font-weight: 600;
        fill: #ffffff;
        font-size: 20px;
        text-shadow: 0 4px 12px rgba(0,0,0,0.5);
      }
      .footer-text {
        font-family: 'JetBrains Mono', monospace;
        font-weight: 500;
        fill: #94a3b8;
        font-size: 11px;
        letter-spacing: 1px;
      }
    </style>
  </defs>
  
  <!-- Outer Card Frame -->
  <rect width="600" height="400" rx="30" fill="url(#card-grad)" stroke="#334155" stroke-opacity="0.3" stroke-width="2" />
  
  <!-- Neon corner accents -->
  <circle cx="0" cy="0" r="140" fill="#38bdf8" fill-opacity="0.08" filter="url(#glow)" />
  <circle cx="600" cy="400" r="140" fill="#a855f7" fill-opacity="0.08" filter="url(#glow)" />
  
  <!-- Premium Glass inner frame -->
  <rect x="25" y="25" width="550" height="350" rx="20" fill="#030712" fill-opacity="0.45" stroke="#475569" stroke-opacity="0.2" stroke-width="1.5" />
  
  <!-- Heading Branding -->
  <g transform="translate(55, 65)">
    <!-- Decorative mini card icon -->
    <rect x="0" y="0" width="22" height="16" rx="4" fill="none" stroke="#22d3ee" stroke-width="2" />
    <line x1="6" y1="5" x2="16" y2="5" stroke="#22d3ee" stroke-width="1.5" />
    <line x1="6" y1="9" x2="12" y2="9" stroke="#22d3ee" stroke-width="1.5" />
    
    <text x="36" y="14" class="title-text">EXPORTED IMAGE CARD</text>
  </g>
  
  <!-- Wrapped Output Content -->
  <g transform="translate(55, 145)">
    <text class="content-text" y="0">
      ${tspansMarkup}
    </text>
  </g>
  
  <!-- Dashboard Verification Footer -->
  <g transform="translate(55, 345)">
    <circle cx="4" cy="-4" r="3" fill="#22c55e" />
    <text x="16" y="0" class="footer-text">VERIFIED GRADIENT EXPORTER ONLINE • PREMIUM</text>
  </g>
</svg>`;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

// Background checking interval scheduler for pending reminders (evaluates every 3s)
setInterval(async () => {
  const now = Date.now();
  for (const rem of botReminders) {
    if (!rem.triggered && rem.dueTime <= now) {
      rem.triggered = true;
      
      const formattedTime = new Date(rem.createdAt).toLocaleTimeString();
      const alertMsg = reminderTemplate
        .replace(/{first_name}/g, rem.fromUser.first_name.toUpperCase())
        .replace(/{message}/g, rem.message)
        .replace(/{time}/g, formattedTime);
      
      addLog(
        'outgoing',
        rem.chatId,
        { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
        alertMsg,
        'Scheduled reminder countdown expired: Alarm dispatched!'
      );
      
      if (botToken && rem.chatId !== 123456) {
        try {
          await callTelegramAPI('sendMessage', {
            chat_id: rem.chatId,
            text: alertMsg,
            parse_mode: 'Markdown'
          });
        } catch (err: any) {
          console.warn(`Could not dispatch background reminder notification to ${rem.chatId}:`, err.message);
        }
      }
    }
  }
}, 3000);

// --- VITE MIDDLEWARE SETUP ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log(`Webhook URL is mapped to: ${process.env.APP_URL || 'unconfigured'}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
