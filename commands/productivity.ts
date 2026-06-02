import { CommandContext } from './types.js';
import { db, TodoItem, HabitItem, CountdownItem, TimerItem, StopwatchItem, CalendarEvent } from '../src/db.js';

/**
 * Handle /todo command
 */
export async function handleTodo(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText, chatId, fromUser, isSimulated, botUsername, botName, botToken, addLog, callTelegramAPI } = ctx;

  if (lowerText.startsWith('/todo ') || lowerText.startsWith('/todo@') || lowerText === '/todo') {
    const parts = userText.split(/\s+/);
    const userIdString = fromUser.id.toString();
    const nowStr = new Date().toISOString();

    // Fetch user todos from db
    const todos = db.getData().todos;
    const userTodos = todos.filter(t => t.userId === userIdString);

    if (parts.length > 1) {
      const sub = parts[1].toLowerCase();

      // /todo add <task> [due YYYY-MM-DD]
      if (sub === 'add' || sub === 'new' || sub === 'create') {
        let taskPart = parts.slice(2).join(' ').trim();
        let dueDate: string | undefined;

        const dueIndex = taskPart.toLowerCase().lastIndexOf('due ');
        if (dueIndex !== -1) {
          const possibleDate = taskPart.substring(dueIndex + 4).trim();
          if (possibleDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            dueDate = possibleDate;
            taskPart = taskPart.substring(0, dueIndex).trim();
          }
        }

        if (!taskPart) {
          const msg = '⚠️ Please specify a task description. Example: `/todo add Buy groceries due 2026-06-15`';
          await sendMsg(ctx, msg);
          return true;
        }

        const newId = `todo_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
        const newItem: TodoItem = {
          id: newId,
          userId: userIdString,
          task: taskPart,
          completed: false,
          dueDate,
          createdAt: nowStr
        };

        todos.push(newItem);
        db.save();

        let resp = `✅ *Task Added Successfully!*\n\n• *Task*: ${taskPart}\n• *Status*: 🔴 Pending`;
        if (dueDate) resp += `\n• *Due*: \`${dueDate}\``;
        resp += `\n\n_Indexed inside database core._`;

        await sendMsg(ctx, resp);
        return true;
      }

      // /todo list [all/pending/completed]
      if (sub === 'list') {
        const filter = parts[2]?.toLowerCase() || 'pending';
        let filtered = userTodos;
        if (filter === 'pending') filtered = userTodos.filter(t => !t.completed);
        else if (filter === 'completed') filtered = userTodos.filter(t => t.completed);

        let listMsg = `📝 *Your Todo List (${filter.toUpperCase()})*:\n\n`;
        if (filtered.length === 0) {
          listMsg += `_No ${filter} tasks found. Type \`/todo add <task>\` to begin!_`;
        } else {
          listMsg += filtered.map((t, idx) => {
            const statusIcon = t.completed ? '🟢 [DONE]' : '🔴 [PENDING]';
            const dueText = t.dueDate ? ` (Due: \`${t.dueDate}\`)` : '';
            return `*${idx + 1}.* \`${t.id.split('_')[2]}\` — ${t.task} ${statusIcon}${dueText}`;
          }).join('\n\n');
        }

        await sendMsg(ctx, listMsg);
        return true;
      }

      // /todo done <id>
      if (sub === 'done' || sub === 'complete') {
        const targetId = parts[2]?.toLowerCase();
        const found = todos.find(t => t.userId === userIdString && (t.id.endsWith(targetId) || t.id === targetId));
        if (found) {
          found.completed = true;
          db.save();
          await sendMsg(ctx, `🟢 *Task completed!*\n\n• *Task*: "${found.task}"\n• *Status*: Completed successfully.`);
        } else {
          await sendMsg(ctx, `⚠️ Task with partial ID \`${targetId}\` not found in your list.`);
        }
        return true;
      }

      // /todo delete <id>
      if (sub === 'delete' || sub === 'remove') {
        const targetId = parts[2]?.toLowerCase();
        const idx = todos.findIndex(t => t.userId === userIdString && (t.id.endsWith(targetId) || t.id === targetId));
        if (idx !== -1) {
          const removed = todos.splice(idx, 1)[0];
          db.save();
          await sendMsg(ctx, `🗑️ *Task Purged!*\n\n• *Task*: "${removed.task}"已被永久删除.`);
        } else {
          await sendMsg(ctx, `⚠️ Task with partial ID \`${targetId}\` not found.`);
        }
        return true;
      }
    }

    const usage = `📝 *Personal Todo Management*:\n\n` +
      `• \`/todo add <task> [due YYYY-MM-DD]\` — Log a task\n` +
      `• \`/todo list [all|pending|completed]\` — Retrieve tasks\n` +
      `• \`/todo done <partial_id>\` — Mark task completed\n` +
      `• \`/todo delete <partial_id>\` — Delete task\n\n` +
      `*Active Quick View*:\n` +
      (userTodos.length === 0 ? '_No active tasks recorded._' : `_You have ${userTodos.filter(t => !t.completed).length} pending tasks._`);

    await sendMsg(ctx, usage);
    return true;
  }
  return false;
}

/**
 * Handle /habit command
 */
export async function handleHabit(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText, chatId, fromUser } = ctx;

  if (lowerText.startsWith('/habit ') || lowerText.startsWith('/habit@') || lowerText === '/habit') {
    const parts = userText.split(/\s+/);
    const userIdString = fromUser.id.toString();
    const habits = db.getData().habits;
    const userHabits = habits.filter(h => h.userId === userIdString);

    if (parts.length > 1) {
      const sub = parts[1].toLowerCase();

      // /habit create <habit_name>
      if (sub === 'create' || sub === 'new' || sub === 'add') {
        const name = parts.slice(2).join(' ').trim();
        if (!name) {
          await sendMsg(ctx, '⚠️ Usage: \`/habit create <habit_name>\`');
          return true;
        }

        const newId = `habit_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
        const newItem: HabitItem = {
          id: newId,
          userId: userIdString,
          name,
          streak: 0,
          logs: [],
          createdAt: new Date().toISOString()
        };

        habits.push(newItem);
        db.save();
        await sendMsg(ctx, `🌸 *New Habit Routine Registered!*\n\n• *Name*: "${name}"\n• *Current Streak*: \`0 days\`\n\n_Start daily check-ins using \`/habit check <id>\`!_`);
        return true;
      }

      // /habit list
      if (sub === 'list') {
        let msg = `🌸 *Your Active Habits Tracker*:\n\n`;
        if (userHabits.length === 0) {
          msg += `_You are not tracking any habits yet._`;
        } else {
          msg += userHabits.map((h, idx) => {
            const shortId = h.id.split('_')[2];
            return `*${idx + 1}.* \`${shortId}\` — *${h.name}*\n  • Streak: \`${h.streak} days\`\n  • Checked days: \`${h.logs.length}\``;
          }).join('\n\n');
        }
        await sendMsg(ctx, msg);
        return true;
      }

      // /habit check <id>
      if (sub === 'check' || sub === 'done') {
        const targetId = parts[2]?.toLowerCase();
        const found = habits.find(h => h.userId === userIdString && (h.id.endsWith(targetId) || h.id === targetId));
        if (found) {
          const todayStr = new Date().toISOString().split('T')[0];
          if (found.logs.includes(todayStr)) {
            await sendMsg(ctx, `🌟 You have already checked in for *${found.name}* today!`);
            return true;
          }

          // Check if yesterday was completed to preserve streak
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];

          found.logs.push(todayStr);
          if (found.logs.includes(yesterdayStr) || found.streak === 0) {
            found.streak += 1;
          } else {
            found.streak = 1; // reset streak
          }
          db.save();

          await sendMsg(ctx, `🎉 *Habit Checked In!* 🟢\n\n• *Routine*: "${found.name}"\n• *Date*: ${todayStr}\n• *Current Streak*: 🔥 \`${found.streak} days\`!`);
        } else {
          await sendMsg(ctx, `⚠️ Active habit with ID \`${targetId}\` not found.`);
        }
        return true;
      }

      // /habit report
      if (sub === 'report') {
        let report = `📊 *Weekly Habit Integrity Audit*:\n\n`;
        if (userHabits.length === 0) {
          report += `_No tracked routines detected._`;
        } else {
          report += userHabits.map(h => {
            const completions = h.logs.length;
            const completionRate = h.logs.length > 0 ? Math.round((completions / 7) * 100) : 0;
            return `• *${h.name}*:\n  Streak: \`${h.streak} days\` | Total completions: \`${completions}\` | Score: \`${Math.min(100, completionRate)}%\``;
          }).join('\n\n');
        }
        await sendMsg(ctx, report);
        return true;
      }
    }

    const manual = `🌸 *Habit Tracker sandboxed core*:\n\n` +
      `• \`/habit create <habit_name>\` — Define a custom daily habit\n` +
      `• \`/habit list\` — Return active registration index\n` +
      `• \`/habit check <partial_id>\` — Pin today's integrity trace\n` +
      `• \`/habit report\` — Retrieve week progress analytics`;
    await sendMsg(ctx, manual);
    return true;
  }
  return false;
}

/**
 * Handle /countdown command
 */
export async function handleCountdown(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText, fromUser } = ctx;

  if (lowerText.startsWith('/countdown ') || lowerText.startsWith('/countdown@') || lowerText === '/countdown') {
    const parts = userText.split(/\s+/);
    const userIdString = fromUser.id.toString();
    const countdowns = db.getData().countdowns;
    const userCountdowns = countdowns.filter(c => c.userId === userIdString);

    if (parts.length > 1) {
      const sub = parts[1].toLowerCase();

      // /countdown new <YYYY-MM-DD> <event_name>
      if (sub === 'new' || sub === 'add' || sub === 'create') {
        const dateArg = parts[2];
        const eventName = parts.slice(3).join(' ').trim();

        if (!dateArg || !dateArg.match(/^\d{4}-\d{2}-\d{2}$/) || !eventName) {
          await sendMsg(ctx, '⚠️ Usage: \`/countdown new <YYYY-MM-DD> <event_name>\`\nExample: \`/countdown new 2026-12-25 Christmas\`');
          return true;
        }

        const newId = `cd_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
        const newItem: CountdownItem = {
          id: newId,
          userId: userIdString,
          name: eventName,
          eventDate: new Date(dateArg + 'T00:00:00Z').toISOString(),
          createdAt: new Date().toISOString()
        };

        countdowns.push(newItem);
        db.save();

        await sendMsg(ctx, `⏰ *Countdown Registered Successfully!*\n\n• *Event*: "${eventName}"\n• *Target Date*: \`${dateArg}\``);
        return true;
      }

      // /countdown list
      if (sub === 'list') {
        if (userCountdowns.length === 0) {
          await sendMsg(ctx, '⏰ No active countdown alerts registered yet.');
          return true;
        }

        let resp = `⏳ *Active Countdowns Audit*:\n\n`;
        const now = Date.now();
        userCountdowns.forEach((c, idx) => {
          const shortId = c.id.split('_')[2];
          const diffMs = new Date(c.eventDate).getTime() - now;

          if (diffMs <= 0) {
            resp += `*${idx + 1}.* \`${shortId}\` — *${c.name}* (PASSED ✅)\n`;
          } else {
            const totalSec = Math.floor(diffMs / 1000);
            const days = Math.floor(totalSec / (24 * 3600));
            const hours = Math.floor((totalSec % (24 * 3600)) / 3600);
            const minutes = Math.floor((totalSec % 3600) / 60);
            const seconds = totalSec % 60;

            resp += `*${idx + 1}.* \`${shortId}\` — *${c.name}*\n  • Date: \`${c.eventDate.split('T')[0]}\`\n  • Details: \`${days}d ${hours}h ${minutes}m ${seconds}s\` remaining!\n\n`;
          }
        });
        await sendMsg(ctx, resp);
        return true;
      }

      // /countdown delete <id>
      if (sub === 'delete' || sub === 'remove') {
        const targetId = parts[2]?.toLowerCase();
        const index = countdowns.findIndex(c => c.userId === userIdString && (c.id.endsWith(targetId) || c.id === targetId));
        if (index !== -1) {
          countdowns.splice(index, 1);
          db.save();
          await sendMsg(ctx, `🗑️ Countdown entry permanently retracted.`);
        } else {
          await sendMsg(ctx, `⚠️ No matching event with ID \`${targetId}\` found.`);
        }
        return true;
      }
    }

    const manual = `⏳ *Event Countdown Manager*:\n\n` +
      `• \`/countdown new <YYYY-MM-DD> <name>\` — Log a standard target countdown\n` +
      `• \`/countdown list\` — List active timers with precise metrics\n` +
      `• \`/countdown delete <partial_id>\` — Delete countdown event`;
    await sendMsg(ctx, manual);
    return true;
  }
  return false;
}

/**
 * Handle /timer command
 */
export async function handleTimer(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText, chatId, fromUser } = ctx;

  if (lowerText.startsWith('/timer ') || lowerText.startsWith('/timer@') || lowerText === '/timer') {
    const parts = userText.split(/\s+/);
    const userIdString = fromUser.id.toString();
    const timers = db.getData().timers;
    const userTimers = timers.filter(t => t.userId === userIdString);

    if (parts.length > 1) {
      const sub = parts[1].toLowerCase();

      // /timer start <duration> [message]
      if (sub === 'start' || sub === 'new' || sub === 'add') {
        const durStr = parts[2];
        const msg = parts.slice(3).join(' ') || 'Timer Completed!';

        if (!durStr) {
          await sendMsg(ctx, '⚠️ Usage: \`/timer start <seconds|m|h> [message]\`\nExample: \`/timer start 30s Drink water\`');
          return true;
        }

        const match = durStr.match(/^(\d+)(s|m|h)?$/i);
        if (!match) {
          await sendMsg(ctx, '⚠️ Invalid duration format. Examples: `60s`, `10m`, `2h`.');
          return true;
        }

        const val = parseInt(match[1]);
        const unit = (match[2] || 's').toLowerCase();
        let seconds = val;
        if (unit === 'm') seconds = val * 60;
        else if (unit === 'h') seconds = val * 3600;

        const newId = `tm_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
        const newItem: TimerItem = {
          id: newId,
          userId: userIdString,
          durationSec: seconds,
          remainingSec: seconds,
          status: 'running',
          createdAt: new Date().toISOString(),
          lastTickAt: Date.now()
        };

        timers.push(newItem);
        db.save();

        await sendMsg(ctx, `⌛ *Background Timer Triggered!*\n\n• *Duration*: \`${seconds} seconds\` (${durStr})\n• *Notification Alert*: "${msg}"\n\n_I will alert you with the message when the countdown reaches 0 seconds!_`);
        return true;
      }

      // /timer list
      if (sub === 'list') {
        if (userTimers.length === 0) {
          await sendMsg(ctx, '⌛ No active workspace timers found.');
          return true;
        }

        let resp = `⌛ *Active Sandboxed Timers*:\n\n`;
        userTimers.forEach((t, idx) => {
          resp += `*${idx + 1}.* \`${t.id.split('_')[2]}\` — Remaining: \`${t.remainingSec}s\` / \`${t.durationSec}s\` (${t.status.toUpperCase()})\n`;
        });
        await sendMsg(ctx, resp);
        return true;
      }

      // /timer pause/resume/cancel
      const targetId = parts[2]?.toLowerCase();
      const matchedIdx = timers.findIndex(t => t.userId === userIdString && (t.id.endsWith(targetId) || t.id === targetId));
      if (matchedIdx !== -1) {
        const timer = timers[matchedIdx];
        if (sub === 'pause') {
          timer.status = 'paused';
          db.save();
          await sendMsg(ctx, `⏸️ Timer \`${timer.id.split('_')[2]}\` has been paused.`);
        } else if (sub === 'resume') {
          timer.status = 'running';
          timer.lastTickAt = Date.now();
          db.save();
          await sendMsg(ctx, `▶️ Timer \`${timer.id.split('_')[2]}\` has resumed counting.`);
        } else if (sub === 'cancel' || sub === 'delete') {
          timers.splice(matchedIdx, 1);
          db.save();
          await sendMsg(ctx, `🗑️ Timer \`${timer.id.split('_')[2]}\` canceled successfully.`);
        }
        return true;
      }
    }

    const manual = `⌛ *Core Countdown Timer Utility*:\n\n` +
      `• \`/timer start <duration> [alert_msg]\` — Launch an active background alarm\n` +
      `• \`/timer list\` — Retrieve running system alarms\n` +
      `• \`/timer pause <partial_id>\` — Pause countdown tick\n` +
      `• \`/timer resume <partial_id>\` — Restart paused countdown\n` +
      `• \`/timer cancel <partial_id>\` — Terminate timer sequence`;
    await sendMsg(ctx, manual);
    return true;
  }
  return false;
}

/**
 * Handle /stopwatch command
 */
export async function handleStopwatch(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText, fromUser } = ctx;

  if (lowerText.startsWith('/stopwatch ') || lowerText.startsWith('/stopwatch@') || lowerText === '/stopwatch') {
    const parts = userText.split(/\s+/);
    const userIdString = fromUser.id.toString();
    const stopwatches = db.getData().stopwatches;

    let sw = stopwatches[userIdString];
    if (!sw) {
      sw = { userId: userIdString, elapsedSec: 0, status: 'idle' };
      stopwatches[userIdString] = sw;
    }

    if (parts.length > 1) {
      const sub = parts[1].toLowerCase();

      if (sub === 'start') {
        if (sw.status === 'running') {
          await sendMsg(ctx, '⏱️ Stopwatch is already running!');
          return true;
        }
        sw.status = 'running';
        sw.startAt = Date.now();
        db.save();
        await sendMsg(ctx, `⏱️ *Stopwatch Started!* 🟢\n\nElapsed Time: \`${sw.elapsedSec}s\`.`);
        return true;
      }

      if (sub === 'pause' || sub === 'stop') {
        if (sw.status === 'running' && sw.startAt) {
          const deltaSec = (Date.now() - sw.startAt) / 1000;
          sw.elapsedSec += Math.round(deltaSec);
          sw.status = 'paused';
          delete sw.startAt;
          db.save();
          await sendMsg(ctx, `⏸️ *Stopwatch Paused!*\n\nElapsed Time: \`${sw.elapsedSec.toFixed(1)} seconds\`.`);
        } else {
          await sendMsg(ctx, '⚠️ Stopwatch is not running currently.');
        }
        return true;
      }

      if (sub === 'resume') {
        if (sw.status !== 'paused') {
          await sendMsg(ctx, '⚠️ Stopwatch is not paused.');
          return true;
        }
        sw.status = 'running';
        sw.startAt = Date.now();
        db.save();
        await sendMsg(ctx, `▶️ *Stopwatch Resumed!*\n\nElapsed Time: \`${sw.elapsedSec.toFixed(1)}s\`.`);
        return true;
      }

      if (sub === 'reset') {
        sw.status = 'idle';
        sw.elapsedSec = 0;
        delete sw.startAt;
        db.save();
        await sendMsg(ctx, '⏱️ Stopwatch has been completely reset to `0.0s`.');
        return true;
      }
    }

    // Get current elapsed time if active
    let currentElapsed = sw.elapsedSec;
    if (sw.status === 'running' && sw.startAt) {
      currentElapsed += (Date.now() - sw.startAt) / 1000;
    }

    const report = `⏱️ *Stopwatch Core Diagnostic*:\n\n` +
      `• *Status*: ${sw.status.toUpperCase()}\n` +
      `• *Running Session Time*: \`${currentElapsed.toFixed(1)} seconds\`\n\n` +
      `💡 *Control Commands*:\n` +
      `• \`/stopwatch start\`\n` +
      `• \`/stopwatch pause\`\n` +
      `• \`/stopwatch resume\`\n` +
      `• \`/stopwatch reset\``;

    await sendMsg(ctx, report);
    return true;
  }
  return false;
}

/**
 * Handle /calendar command
 */
export async function handleCalendar(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText, fromUser } = ctx;

  if (lowerText.startsWith('/calendar ') || lowerText.startsWith('/calendar@') || lowerText === '/calendar') {
    const parts = userText.split(/\s+/);
    const userIdString = fromUser.id.toString();
    const calendarEvents = db.getData().calendarEvents;
    const userEvents = calendarEvents.filter(e => e.userId === userIdString);

    if (parts.length > 1) {
      const sub = parts[1].toLowerCase();

      // /calendar add <YYYY-MM-DD> <event_name>
      if (sub === 'add' || sub === 'new' || sub === 'create') {
        const dateArg = parts[2];
        const eventName = parts.slice(3).join(' ').trim();

        if (!dateArg || !dateArg.match(/^\d{4}-\d{2}-\d{2}$/) || !eventName) {
          await sendMsg(ctx, '⚠️ Usage: \`/calendar add <YYYY-MM-DD> <event_name>\`\nExample: \`/calendar add 2026-06-10 Sprint Review\`');
          return true;
        }

        const newId = `cal_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
        calendarEvents.push({
          id: newId,
          userId: userIdString,
          date: dateArg,
          eventName
        });
        db.save();

        await sendMsg(ctx, `📅 *Calendar Event Logged successfully!*\n\n• *Date*: \`${dateArg}\`\n• *Event*: "${eventName}"`);
        return true;
      }

      // /calendar list
      if (sub === 'list') {
        if (userEvents.length === 0) {
          await sendMsg(ctx, '📅 No events scheduled on your calendar ledger.');
          return true;
        }

        let resp = `📅 *Your Calendar Ledger Events*:\n\n`;
        // Sort events chronologically
        const sorted = [...userEvents].sort((a,b) => a.date.localeCompare(b.date));
        sorted.forEach((e, idx) => {
          resp += `*${idx + 1}.* \`${e.date}\` — *${e.eventName}* (ID: \`${e.id.split('_')[2]}\`)\n`;
        });
        await sendMsg(ctx, resp);
        return true;
      }
    }

    // Render visual ASCII Calendar for current Month
    const date = new Date();
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth(); // 0-indexed
    const monthName = date.toLocaleString('default', { month: 'long' });

    // Build standard ASCII calendar matrix
    const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    let calGrid = `📅 *${monthName} ${year} System Calendar*:\n\n`;
    calGrid += `\`\`\`\nSu Mo Tu We Th Fr Sa\n`;
    
    // Spaces leading up to first day
    let currentLine = '';
    for (let u = 0; u < firstDay; u++) {
      currentLine += '   ';
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = day.toString().padStart(2, ' ');
      currentLine += dayStr + ' ';
      
      if ((firstDay + day) % 7 === 0 || day === daysInMonth) {
        calGrid += currentLine.trimEnd() + '\n';
        currentLine = '';
      }
    }
    calGrid += `\`\`\`\n`;

    // Overlap events on actual matrix or append
    const currentMonthPrefix = `${year}-${(month + 1).toString().padStart(2, '0')}`;
    const monthEvents = userEvents.filter(e => e.date.startsWith(currentMonthPrefix));

    if (monthEvents.length > 0) {
      calGrid += `*Events for this month*:\n`;
      monthEvents.forEach(e => {
        calGrid += `• \`${e.date}\`: ${e.eventName}\n`;
      });
    } else {
      calGrid += `_No events booked for ${monthName}._\n`;
    }

    calGrid += `\n*Calendar Actions*:\n` +
      `• \`/calendar add <YYYY-MM-DD> <event>\` — Log an event\n` +
      `• \`/calendar list\` — Get all historical active events`;

    await sendMsg(ctx, calGrid);
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
    `Productivity module response${isSimulated ? ' (Simulated)' : ''}`
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
      console.error('Error sending message from Productivity plugin:', e.message);
    }
  }
}
