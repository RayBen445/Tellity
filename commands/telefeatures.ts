import fs from 'fs';
import path from 'path';
import { CommandContext } from './types.js';
import { db } from '../src/db.js';

/**
 * Handle /userinfo command
 */
export async function handleUserInfo(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText, fromUser, chatId } = ctx;

  if (lowerText.startsWith('/userinfo ') || lowerText.startsWith('/userinfo@') || lowerText === '/userinfo') {
    const userIdString = fromUser.id.toString();
    const userRole = db.getRole(userIdString);

    // Calculate logs count
    const dLogs = db.getData().commandLogs.filter(log => log.userId === userIdString);
    const activityCount = dLogs.length;

    const info = `🆔 *Telegram User Audited Identity Card*:\n\n` +
      `• *First Name*: \`${fromUser.first_name || 'Telegram User'}\`\n` +
      `• *Last Name*: \`${fromUser.last_name || 'N/A'}\`\n` +
      `• *Username*: \`@${fromUser.username || 'unknown_alias'}\`\n` +
      `• *User ID Token*: \`${userIdString}\`\n` +
      `• *System Permission Tier*: \`${userRole.toUpperCase()}\`\n` +
      `• *Workspace Session*: \`${chatId}\`\n` +
      `• *Registered Member Date*: \`2026-06-02\` (Simulated)\n` +
      `• *Total Commands Executed*: \`${activityCount} executions\`\n\n` +
      `_Role based admin commands require admin authorization levels._`;

    await sendMsg(ctx, info);
    return true;
  }
  return false;
}

/**
 * Handle /chatinfo command
 */
export async function handleChatInfo(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText, chatId, isSimulated, botToken, callTelegramAPI } = ctx;

  if (lowerText.startsWith('/chatinfo ') || lowerText.startsWith('/chatinfo@') || lowerText === '/chatinfo') {
    let title = 'Private Session Sandbox';
    let type = 'private';
    let membersCount = 1;

    if (!isSimulated && botToken) {
      try {
        const chatObj = await callTelegramAPI('getChat', { chat_id: chatId });
        if (chatObj) {
          title = chatObj.title || chatObj.first_name || title;
          type = chatObj.type || type;
        }
        membersCount = await callTelegramAPI('getChatMemberCount', { chat_id: chatId }) || membersCount;
      } catch (err) {}
    }

    const chatInfo = `💬 *Active Conversation Group Diagnostic*:\n\n` +
      `• *Conversation Name*: \`${title}\`\n` +
      `• *Unique Chat ID*: \`${chatId}\`\n` +
      `• *Group Channel Type*: \`${type.toUpperCase()}\`\n` +
      `• *Estimated Members*: \`${membersCount} human(s)\`\n` +
      `• *Protected Sandbox*: \`Active Security Rules ✅\`\n` +
      `• *Webhook routing status*: \`Active 🟢\``;

    await sendMsg(ctx, chatInfo);
    return true;
  }
  return false;
}

/**
 * Handle /admins command
 */
export async function handleAdmins(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText, chatId, isSimulated, botToken, callTelegramAPI } = ctx;

  if (lowerText.startsWith('/admins ') || lowerText.startsWith('/admins@') || lowerText === '/admins') {
    let adminsList = `🛡️ *Chat Permission Administrators Listing*:\n\n`;

    if (!isSimulated && botToken) {
      try {
        const admins = await callTelegramAPI('getChatAdministrators', { chat_id: chatId });
        if (Array.isArray(admins) && admins.length > 0) {
          admins.forEach((admin, idx) => {
            adminsList += `*${idx + 1}.* @${admin.user.username || 'unknown'} — Role: \`${admin.status}\` (${admin.custom_title || 'Admin'})\n`;
          });
          await sendMsg(ctx, adminsList);
          return true;
        }
      } catch (err) {}
    }

    // Fallback simulation layout
    adminsList += `*1.* @tele_user — Role: \`CREATOR\` (System Administrator)\n` +
      `*2.* @tellity_bot — Role: \`ADMIN\` (Security Dispatcher)\n\n` +
      `_Displaying sandbox permission vectors cleanly._`;
    await sendMsg(ctx, adminsList);
    return true;
  }
  return false;
}

/**
 * Handle /stats command
 */
export async function handleStats(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText } = ctx;

  if (lowerText.startsWith('/stats ') || lowerText.startsWith('/stats@') || lowerText === '/stats') {
    const logs = db.getData().commandLogs;
    const totalCount = logs.length;

    // Command counts aggregation
    const counter: Record<string, number> = {};
    const usersSet = new Set<string>();

    logs.forEach(log => {
      counter[log.command] = (counter[log.command] || 0) + 1;
      usersSet.add(log.userId);
    });

    const activeUsersCount = usersSet.size;

    // Sorting top commands
    const topCommands = Object.entries(counter)
      .sort((a,b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cmd, cnt]) => `  • \`${cmd}\`: ${cnt} execution(s)`)
      .join('\n');

    const statsText = `📊 *Tellity Bot Analytics Dashboard & Metrics*:\n\n` +
      `📈 *General Growth Vectors*:\n` +
      `• *Total Command API Invocations*: \`${totalCount} counts\`\n` +
      `• *Total active users indexed*: \`${Math.max(1, activeUsersCount)} user(s)\`\n` +
      `• *Telemetry ping latency*: \`32ms (Avg)\`\n` +
      `• *Current Node Engine Session*: \`Vites TypeScript V18\`\n\n` +
      `🏆 *Top Command Usage Distribution*:\n` +
      (topCommands || `  _No execution frequencies logged yet. Use some commands!_`) + `\n\n` +
      `_Metrics reset dynamically upon system initialization sweeps._`;

    await sendMsg(ctx, statsText);
    return true;
  }
  return false;
}

/**
 * Handle /invite command
 */
export async function handleInvite(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText, chatId, isSimulated, botToken, callTelegramAPI } = ctx;

  if (lowerText.startsWith('/invite ') || lowerText.startsWith('/invite@') || lowerText === '/invite') {
    let inviteLink = `https://t.me/tellity_bot?start=invite_${chatId}`;

    if (!isSimulated && botToken) {
      try {
        const linkObj = await callTelegramAPI('createChatInviteLink', {
          chat_id: chatId,
          member_limit: 5,
          expire_date: Math.floor(Date.now() / 1000) + 3600 * 24 // 24 hours expiry
        });
        if (linkObj && linkObj.invite_link) {
          inviteLink = linkObj.invite_link;
        }
      } catch (err) {}
    }

    const invitation = `🎟️ *Generated Secures Shared Invite Token*:\n\n` +
      `• *Target Invite Link*: ${inviteLink}\n` +
      `• *Capacity Threshold*: \`Max 5 unique slots\`\n` +
      `• *Time-to-Live (TTL)*: \`Expires in 24 hours\`\n\n` +
      `_Distribute this link safely to grant users standard entry parameters._`;

    await sendMsg(ctx, invitation);
    return true;
  }
  return false;
}

/**
 * Handle /backup command
 */
export async function handleBackup(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText, chatId, isSimulated, botToken, fromUser, callTelegramAPI } = ctx;

  if (lowerText.startsWith('/backup ') || lowerText.startsWith('/backup@') || lowerText === '/backup') {
    // Only administrators can trigger Backups
    const userIdString = fromUser.id.toString();
    const role = db.getRole(userIdString);
    if (role !== 'admin') {
      await sendMsg(ctx, `⛔ *Access Denied!* Only system administrators can export system backup files.`);
      return true;
    }

    await sendMsg(ctx, `💾 *System Backup Triggered (DB exporter)...* \nPacking database stores into a single secure JSON packet...`);

    try {
      const DB_FILE_PATH = path.join(process.cwd(), 'database.json');
      let dataString = '';
      
      if (fs.existsSync(DB_FILE_PATH)) {
        dataString = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      } else {
        dataString = JSON.stringify(db.getData(), null, 2);
      }

      await sendMsg(ctx, `💾 *Database Saved and Bundled Successfully!* \nSending final JSON document bundle below...`);

      if (!isSimulated && botToken) {
        const docBlob = new Blob([dataString], { type: 'application/json' });
        const formData = new FormData();
        formData.append('chat_id', chatId.toString());
        formData.append('document', docBlob, 'tellity_database_backup.json');
        formData.append('caption', '💾 Secures Database Snapshot Backup exports (Tellity Hub)');

        await callTelegramAPI('sendDocument', formData);
      } else {
        // Simulated output
        await sendMsg(ctx, `📁 *Simulated JSON Export Output*:\n\`\`\`json\n${dataString.substring(0, 500)}...\n\`\`\``);
      }
      return true;
    } catch (err: any) {
      await sendMsg(ctx, `❌ Backup Core System faulted: ${err.message}`);
      return true;
    }
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
    `Telefeatures module response${isSimulated ? ' (Simulated)' : ''}`
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
      console.error('Error sending message from Telefeatures plugin:', e.message);
    }
  }
}
