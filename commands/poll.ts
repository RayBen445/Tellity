import { CommandContext } from './types.js';

export async function handlePoll(ctx: CommandContext): Promise<boolean> {
  const {
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
  } = ctx;

  if (lowerText.startsWith('/poll ') || lowerText.startsWith('/poll@') || lowerText === '/poll') {
    const parts = userText.split(/\s+/);
    if (parts.length > 1) {
      const remainingArgs = userText.substring(userText.indexOf(parts[1])).trim();
      let seconds = 60;
      let pollContent = remainingArgs;

      const firstWord = parts[1];
      const match = firstWord.match(/^(\d+)(s|m|h)?$/i);
      if (match) {
        const value = parseInt(match[1], 10);
        const unit = (match[2] || 's').toLowerCase();
        if (unit === 's') seconds = value;
        else if (unit === 'm') seconds = value * 60;
        else if (unit === 'h') seconds = value * 3600;
        
        pollContent = remainingArgs.substring(firstWord.length).trim();
      }

      const pollParts = pollContent.split('|').map(x => x.trim()).filter(Boolean);
      if (pollParts.length >= 3) {
        const question = pollParts[0];
        const options = pollParts.slice(1);

        const pollMessage = `📊 *Dynamic Sandbox Poll Started!* 🗳️\n\n*Question*: "${question}"\n\n` +
          options.map((opt, idx) => `  *Option ${idx+1}*: ${opt}`).join('\n') +
          `\n\n_Active Timer countdown: \`${seconds}s\`._\n_This poll is fully integrated live inside Telegram!_`;

        addLog(
          'outgoing',
          chatId,
          { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
          pollMessage,
          `Poll started: "${question}" with ${options.length} options for ${seconds}s${isSimulated ? ' (Simulated)' : ''}`
        );

        if (!isSimulated && botToken) {
          try {
            await callTelegramAPI('sendPoll', {
              chat_id: chatId,
              question: question,
              options: JSON.stringify(options),
              is_anonymous: false
            });
          } catch (err: any) {
            console.error('Error sending Telegram poll API call, falling back to message:', err);
            try {
              await callTelegramAPI('sendMessage', {
                chat_id: chatId,
                text: pollMessage,
                parse_mode: 'Markdown',
                reply_markup: getCommonInlineKeyboard()
              });
            } catch (fallbackErr) {}
          }
        }
        return true;
      }
    }

    const helpReply = `📊 *How to schedule an Interactive Poll*:\n\nFormat:\n\`/poll <optional_seconds> <question>|<opt1>|<opt2>...\`\n\n*Example*:\n• \`/poll 30 Which theme is best?|Midnight Neon|Emerald Magic|Sunrise Glow\`\n\n_Sends a native interactive Telegram poll directly into your chat!_`;
    addLog(
      'outgoing',
      chatId,
      { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
      helpReply,
      `Sent poll instructions${isSimulated ? ' (Simulated)' : ''}`
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
    return true;
  }

  return false;
}
