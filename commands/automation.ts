import { CommandContext } from './types.js';
import { db, ScheduleItem, AutoReplyRule } from '../src/db.js';

/**
 * Handle /schedule command
 */
export async function handleSchedule(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText, chatId } = ctx;

  if (lowerText.startsWith('/schedule ') || lowerText.startsWith('/schedule@') || lowerText === '/schedule') {
    const parts = userText.split(/\s+/);
    const schedules = db.getData().schedules;

    if (parts.length > 1) {
      const sub = parts[1].toLowerCase();

      // /schedule add <minutes> <message>
      if (sub === 'add' || sub === 'new') {
        const offsetMinStr = parts[2];
        const textMessage = parts.slice(3).join(' ').trim();

        const offsetMin = parseInt(offsetMinStr);
        if (isNaN(offsetMin) || offsetMin <= 0) {
          await sendMsg(ctx, '⚠️ Please provide a valid scheduling offset in minutes. Example: `/schedule add 10 Server diagnostic warning!`');
          return true;
        }

        if (!textMessage) {
          await sendMsg(ctx, '⚠️ Please specify the automated message text description.');
          return true;
        }

        const runTime = new Date(Date.now() + offsetMin * 60000).toISOString();
        const shortId = `sch_${Date.now()}`;

        const newSch: ScheduleItem = {
          id: shortId,
          chatId,
          text: textMessage,
          runAt: runTime,
          type: 'onetime'
        };

        schedules.push(newSch);
        db.save();

        const out = `⏰ *Automated Dispatch scheduled successfully!* 🛎️\n\n• *Target Time*: \`${runTime}\` (In \`${offsetMin} minutes\`)\n• *Scheduled payload*: "${textMessage}"\n\n_I will trigger and fire this update across your chat logs when due!_`;
        await sendMsg(ctx, out);
        return true;
      }

      // /schedule list
      if (sub === 'list') {
        const userSch = schedules.filter(s => s.chatId === chatId);

        if (userSch.length === 0) {
          await sendMsg(ctx, '⏰ No matching scheduled tasks registered on this session.');
          return true;
        }

        let listBytes = `⏰ *Your Scheduled Automated Alerts Logs*:\n\n`;
        userSch.forEach((s, idx) => {
          listBytes += `*${idx + 1}.* \`${s.id.split('_')[1]}\` — Due: \`${s.runAt.substring(11, 16)}\` | Msg: "${s.text}"\n`;
        });
        await sendMsg(ctx, listBytes);
        return true;
      }

      // /schedule delete
      if (sub === 'delete' || sub === 'remove') {
        const targetId = parts[2]?.toLowerCase();
        const idx = schedules.findIndex(s => s.chatId === chatId && (s.id.endsWith(targetId) || s.id === targetId));

        if (idx !== -1) {
          schedules.splice(idx, 1);
          db.save();
          await sendMsg(ctx, `🗑️ Scheduled dispatch sequence deleted successfully.`);
        } else {
          await sendMsg(ctx, `⚠️ No matching element found.`);
        }
        return true;
      }
    }

    const usage = `⏰ *Background Message Dispatcher Controls*:\n\n` +
      `• \`/schedule add <minutes_from_now> <message>\` — Register automatic future alert\n` +
      `• \`/schedule list\` — Read all registered alerts\n` +
      `• \`/schedule delete <partial_id>\` — Clear pending task`;

    await sendMsg(ctx, usage);
    return true;
  }
  return false;
}

/**
 * Handle /autodelete command
 */
export async function handleAutoDelete(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText, chatId } = ctx;

  if (lowerText.startsWith('/autodelete ') || lowerText.startsWith('/autodelete@') || lowerText === '/autodelete') {
    const parts = userText.split(/\s+/);
    const autodeleteSettings = db.getData().autodeleteSettings;

    if (parts.length > 1) {
      const sub = parts[1].toLowerCase();

      if (sub === 'on' || sub === 'enable') {
        const secStr = parts[2] || '30';
        const seconds = parseInt(secStr);

        if (isNaN(seconds) || seconds < 3) {
          await sendMsg(ctx, '⚠️ Please provide a valid duration in seconds (Minimum 3 seconds).');
          return true;
        }

        autodeleteSettings[chatId] = seconds;
        db.save();

        await sendMsg(ctx, `🛡️ *Auto-Delete System ACTIVATED!* ⏱️\n\n• *Duration*: \`${seconds} seconds\`\n\n_All future outbound messages from this bot in this chat will be auto-purged from memory and client view structures after the designated seconds have elapsed!_`);
        return true;
      }

      if (sub === 'off' || sub === 'disable') {
        autodeleteSettings[chatId] = 0;
        db.save();

        await sendMsg(ctx, `🛡️ *Auto-Delete System DEACTIVATED!* Outbound updates will persist indefinitely.`);
        return true;
      }
    }

    const currentDur = autodeleteSettings[chatId] || 0;
    const statsText = `⏱️ *Message Self-Destruct / Clean-Up Core* 🛡️:\n\n` +
      `• *Current state*: \`${currentDur > 0 ? `Active: ${currentDur}s` : 'DEACTIVATED'}\`\n\n` +
      `💡 *Control parameters*:\n` +
      `• \`/autodelete on <seconds_threshold>\` (e.g., \`/autodelete on 10\`)\n` +
      `• \`/autodelete off\``;

    await sendMsg(ctx, statsText);
    return true;
  }
  return false;
}

/**
 * Handle /autoreply command
 */
export async function handleAutoReply(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText } = ctx;

  if (lowerText.startsWith('/autoreply ') || lowerText.startsWith('/autoreply@') || lowerText === '/autoreply') {
    const parts = userText.split(/\s+/);
    const autoReplies = db.getData().autoReplies;

    if (parts.length > 1) {
      const sub = parts[1].toLowerCase();

      // /autoreply add <keyword>|<reply>
      if (sub === 'add' || sub === 'new') {
        const payload = parts.slice(2).join(' ');
        const m = payload.split('|');
        const trigger = m[0]?.trim()?.toLowerCase();
        const reply = m[1]?.trim();

        if (!trigger || !reply) {
          await sendMsg(ctx, '⚠️ Format is invalid. Usage:\n`/autoreply add trigger_word|response message text`');
          return true;
        }

        const freshId = `rule_${Date.now()}`;
        autoReplies.push({
          id: freshId,
          trigger,
          reply
        });
        db.save();

        await sendMsg(ctx, `⚙️ *Keyword Auto-Responders Rule Added!* 🤖\n\n• *Trigger Word*: \`${trigger}\`\n• *Preset Response*: "${reply}"`);
        return true;
      }

      // /autoreply list
      if (sub === 'list') {
        if (autoReplies.length === 0) {
          await sendMsg(ctx, '🤖 No custom keyword triggers indexed in database.');
          return true;
        }

        let listMsg = `🤖 *Active Keyword Auto-Responders*:\n\n`;
        autoReplies.forEach((rule, idx) => {
          listMsg += `*${idx + 1}.* \`${rule.trigger}\` ➔ "${rule.reply}" (Rule ID: \`${rule.id.split('_')[1]}\`)\n`;
        });
        await sendMsg(ctx, listMsg);
        return true;
      }

      // /autoreply delete
      if (sub === 'delete' || sub === 'remove') {
        const targetId = parts[2]?.toLowerCase();
        const index = autoReplies.findIndex(rule => rule.id.endsWith(targetId) || rule.id === targetId);

        if (index !== -1) {
          autoReplies.splice(index, 1);
          db.save();
          await sendMsg(ctx, `🗑️ Automapped responder rule retracted successfully.`);
        } else {
          await sendMsg(ctx, `⚠️ No matching rule ID \`${targetId}\` found.`);
        }
        return true;
      }
    }

    const usage = `🤖 *Custom Event Keyword Responders*:\n\n` +
      `• \`/autoreply add <query>|<reply_text>\` — Log matched query response rule\n` +
      `• \`/autoreply list\` — Display active query matching structures\n` +
      `• \`/autoreply delete <rule_id>\` — Clear keyword response rule`;

    await sendMsg(ctx, usage);
    return true;
  }
  return false;
}

/**
 * Handle /keywords command
 */
export async function handleKeywords(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText } = ctx;

  if (lowerText.startsWith('/keywords ') || lowerText.startsWith('/keywords@') || lowerText === '/keywords') {
    const parts = userText.split(/\s+/);
    const keywords = db.getData().keywords;

    if (parts.length > 1) {
      const sub = parts[1].toLowerCase();

      // /keywords add <phrase>|<automated_action>
      if (sub === 'add' || sub === 'new') {
        const payload = parts.slice(2).join(' ');
        const spl = payload.split('|');
        const kw = spl[0]?.trim()?.toLowerCase();
        const action = spl[1]?.trim();

        if (!kw || !action) {
          await sendMsg(ctx, '⚠️ Usage: \`/keywords add phrase|action_description\`');
          return true;
        }

        keywords[kw] = { action, count: 0 };
        db.save();

        await sendMsg(ctx, `📑 *Keyword Automating Phrase registered!* \n\n• *Phrase*: \`${kw}\`\n• *Automated action*: "${action}"`);
        return true;
      }

      // /keywords list
      if (sub === 'list') {
        const entries = Object.entries(keywords);
        if (entries.length === 0) {
          await sendMsg(ctx, '📑 Keyword Automation lists are empty.');
          return true;
        }

        let out = `📑 *Phrase Keyword Analytics Tracker List*:\n\n`;
        entries.forEach(([phrase, obj], idx) => {
          out += `*${idx + 1}.* \`${phrase}\` ➔ Act: "${obj.action}" (Inbound Hit count: \`${obj.count} hits\`)\n`;
        });
        await sendMsg(ctx, out);
        return true;
      }
    }

    const help = `📑 *Advanced Analytical Phrase Trigger System*:\n\n` +
      `• \`/keywords add <phrase>|<action>\` — Start monitoring a target keyword / sentence\n` +
      `• \`/keywords list\` — View execution counts and triggers statistics`;

    await sendMsg(ctx, help);
    return true;
  }
  return false;
}

/**
 * Handle /welcome command
 */
export async function handleWelcome(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText, chatId } = ctx;

  if (lowerText.startsWith('/welcome ') || lowerText.startsWith('/welcome@') || lowerText === '/welcome') {
    const parts = userText.split(/\s+/);
    const welcomes = db.getData().welcomes;

    if (parts.length > 1) {
      const msg = parts.slice(1).join(' ').trim();
      welcomes[chatId] = msg;
      db.save();

      await sendMsg(ctx, `🟢 *Custom Welcome Message configured!*\n\n• *Message Template*:\n"${msg}"\n\n_I will play this automated greeting whenever a user enters this chat zone!_`);
      return true;
    }

    const activeMsg = welcomes[chatId] || 'Welcome to our premium discussion channel! 👋';
    const report = `👋 *Custom Join Greeting Manager*:\n\n` +
      `• *Active Template*: "${activeMsg}"\n\n` +
      `💡 *Configure custom style*:\n` +
      `• \`/welcome Welcome {first_name} to our community hubs! ✨\``;

    await sendMsg(ctx, report);
    return true;
  }
  return false;
}

/**
 * Handle /goodbye command
 */
export async function handleGoodbye(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText, chatId } = ctx;

  if (lowerText.startsWith('/goodbye ') || lowerText.startsWith('/goodbye@') || lowerText === '/goodbye') {
    const parts = userText.split(/\s+/);
    const goodbyes = db.getData().goodbyes;

    if (parts.length > 1) {
      const msg = parts.slice(1).join(' ').trim();
      goodbyes[chatId] = msg;
      db.save();

      await sendMsg(ctx, `🔴 *Custom Goodbye Message configured!*\n\n• *Message Template*:\n"${msg}"\n\n_Farewells are processed automatically when participants leave memory registers._`);
      return true;
    }

    const activeMsg = goodbyes[chatId] || 'Farewell! Wishing you success outside our chat space.';
    const report = `🚪 *Personalised Departure Message calibration*:\n\n` +
      `• *Active Template*: "${activeMsg}"\n\n` +
      `💡 *Configure custom style*:\n` +
      `• \`/goodbye Farewell {first_name}! Catch you later! 🚀\``;

    await sendMsg(ctx, report);
    return true;
  }
  return false;
}

// Utility message sender
async function sendMsg(ctx: CommandContext, text: string) {
  const { chatId, isSimulated, botToken, botUsername, botName, addLog, callTelegramAPI, getCommonInlineKeyboard } = ctx;
  addLog(
    'outgoing',
    chatId,
    { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
    text,
    `Automation module response${isSimulated ? ' (Simulated)' : ''}`
  );

  if (!isSimulated && botToken) {
    try {
      await callTelegramAPI('sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        reply_markup: getCommonInlineKeyboard()
      });
    } catch (e: any) {
      console.error('Error sending message from Automation plugin:', e.message);
    }
  }
}
