import { CommandContext } from './types.js';
import { db, PollItem, FeedbackItem, SuggestionItem } from '../src/db.js';

/**
 * Handle /vote command
 */
export async function handleVote(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText, chatId, fromUser } = ctx;

  if (lowerText.startsWith('/vote ') || lowerText.startsWith('/vote@') || lowerText === '/vote') {
    const parts = userText.split(/\s+/);
    const polls = db.getData().polls;

    if (parts.length > 1) {
      const sub = parts[1].toLowerCase();

      // /vote create <question>|<opt1>|<opt2>
      if (sub === 'create' || sub === 'new') {
        const payload = parts.slice(2).join(' ');
        const splitParts = payload.split('|');
        const question = splitParts[0]?.trim();
        const options = splitParts.slice(1).map(o => o.trim()).filter(Boolean);

        if (!question || options.length < 2) {
          await sendMsg(ctx, '⚠️ Usage: \`/vote create <question>|<option1>|<option2>...\`\nExample: \`/vote create Which project is better?|Option A|Option B\`');
          return true;
        }

        const newId = `poll_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
        const newItem: PollItem = {
          id: newId,
          chatId,
          question,
          options,
          votes: options.reduce((acc, _, idx) => ({ ...acc, [idx]: 0 }), {}),
          votedUserIds: {},
          active: true,
          anonymous: true
        };

        polls.push(newItem);
        db.save();

        let resp = `📊 *New Community Voting Session Opened!* 🗳️\n\n• *Question*: *${question}*\n\n` +
          options.map((opt, idx) => `  *${idx + 1}.* ${opt}`).join('\n') +
          `\n\n_Type \`/vote cast <partial_id> <option_number>\` to commit your anonymous ballot!_`;

        await sendMsg(ctx, resp);
        return true;
      }

      // /vote cast <partial_id> <option_number>
      if (sub === 'cast' || sub === 'select') {
        const pollId = parts[2]?.toLowerCase();
        const optionIdxStr = parts[3];

        const optionIdx = parseInt(optionIdxStr) - 1;

        const found = polls.find(p => p.chatId === chatId && p.active && (p.id.endsWith(pollId) || p.id === pollId));
        if (!found) {
          await sendMsg(ctx, `⚠️ No active voting sessions matching partial ID \`${pollId}\` was found.`);
          return true;
        }

        if (isNaN(optionIdx) || optionIdx < 0 || optionIdx >= found.options.length) {
          await sendMsg(ctx, `⚠️ Invalid option number select: ${optionIdxStr}. Please choose between 1 and ${found.options.length}.`);
          return true;
        }

        const userIdString = fromUser.id.toString();
        if (found.votedUserIds[userIdString] !== undefined) {
          await sendMsg(ctx, `🚫 You have already committed your ballot on this voting board!`);
          return true;
        }

        found.votes[optionIdx] = (found.votes[optionIdx] || 0) + 1;
        found.votedUserIds[userIdString] = optionIdx;
        db.save();

        await sendMsg(ctx, `🗳️ *Your Ballot Confirmed and Committed anonymously!*`);
        return true;
      }

      // /vote close <id>
      if (sub === 'close' || sub === 'end') {
        const pollId = parts[2]?.toLowerCase();
        const found = polls.find(p => p.chatId === chatId && p.active && (p.id.endsWith(pollId) || p.id === pollId));

        if (found) {
          found.active = false;
          db.save();

          let results = `📊 *Voting Session Concluded Results* 🏁\n\n• *Question*: *${found.question}*\n\n`;
          found.options.forEach((opt, idx) => {
            const count = found.votes[idx] || 0;
            results += `  • *${opt}*: \`${count} vote(s)\`\n`;
          });
          await sendMsg(ctx, results);
        } else {
          await sendMsg(ctx, `⚠️ Voting session ID not found.`);
        }
        return true;
      }
    }

    const usage = `🗳️ *Community Voting Board Simulator*:\n\n` +
      `• \`/vote create <question>|<opt1>|<opt2>\` — Start structural poll\n` +
      `• \`/vote cast <partial_id> <index>\` — Commit anonymous selection\n` +
      `• \`/vote close <partial_id>\` — Conclude voting session and compute results`;
    await sendMsg(ctx, usage);
    return true;
  }
  return false;
}

/**
 * Handle /quiz command
 */
export async function handleQuiz(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText, chatId, fromUser } = ctx;

  if (lowerText.startsWith('/quiz ') || lowerText.startsWith('/quiz@') || lowerText === '/quiz') {
    const parts = userText.split(/\s+/);
    const qSessions = db.getData().quizSessions;
    const userIdString = fromUser.id.toString();
    const userDisplayName = fromUser.username ? `@${fromUser.username}` : fromUser.first_name;

    let session = qSessions[chatId];
    if (!session) {
      session = { currentQuestionIdx: 0, score: 0, scoreHistory: {} };
      qSessions[chatId] = session;
    }

    // Static Premium Trivia questions bank
    const questions = [
      {
        q: 'Which protocol is responsible for securing data transmitted across World Wide Web requests?',
        opts: ['HTTP', 'FTP', 'HTTPS', 'LDAP'],
        answerIdx: 2
      },
      {
        q: 'Which cloud database system excels at unstructured key-value JSON entries scalability?',
        opts: ['Relational MySQL', 'MongoDB / Firestore', 'PostgreSQL', 'SQLite'],
        answerIdx: 1
      },
      {
        q: 'Who was the developer of the React UI rendering engine?',
        opts: ['Google Engineering', 'Oracle', 'Facebook (Meta)', 'Microsoft Devs'],
        answerIdx: 2
      }
    ];

    if (parts.length > 1) {
      const sub = parts[1].toLowerCase();

      if (sub === 'answers' || sub === 'answer') {
        const chosen = parseInt(parts[2]) - 1;
        const curQ = questions[session.currentQuestionIdx];

        if (isNaN(chosen) || chosen < 0 || chosen > 3) {
          await sendMsg(ctx, `⚠️ Choose a valid answer number between 1 and 4.`);
          return true;
        }

        let isCorrect = chosen === curQ.answerIdx;
        let points = 0;

        if (isCorrect) {
          points = 100;
          session.scoreHistory[userIdString] = (session.scoreHistory[userIdString] || 0) + points;
          db.save();

          await sendMsg(ctx, `🎉 *Correct Answer!* 🧠\n\n• *Reward*: +100 Units added to your profile scorecard!\n• *Answer*: "${curQ.opts[curQ.answerIdx]}"`);
        } else {
          await sendMsg(ctx, `❌ *Incorrect Answer!* Better luck next round.\n\n• *Correct Answer*: "${curQ.opts[curQ.answerIdx]}"`);
        }

        // Advance question pointer
        session.currentQuestionIdx = (session.currentQuestionIdx + 1) % questions.length;
        db.save();
        return true;
      }
    }

    const activeQ = questions[session.currentQuestionIdx];
    const quizDisplay = `💡 *Trivia Interactive Quiz Round!* 🧠\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `• *Question*: *${activeQ.q}*\n\n` +
      activeQ.opts.map((opt, i) => `  *${i + 1}.* \`${opt}\``).join('\n') + `\n\n` +
      `👉 *Type* \`/quiz answer <option_number>\` to submit your answer!\n\n` +
      `🏆 *Current Player*: ${userDisplayName} | *Session Score*: \`${session.scoreHistory[userIdString] || 0} pts\``;

    await sendMsg(ctx, quizDisplay);
    return true;
  }
  return false;
}

/**
 * Handle /giveaway command
 */
export async function handleGiveaway(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText } = ctx;

  if (lowerText.startsWith('/giveaway ') || lowerText.startsWith('/giveaway@') || lowerText === '/giveaway') {
    const parts = userText.split(/\s+/);

    if (parts.length > 1) {
      const sub = parts[1].toLowerCase();

      // /giveaway schedule <item>|@user1|@user2|@user3
      if (sub === 'pick' || sub === 'draw' || sub === 'roll') {
        const payload = parts.slice(2).join(' ');
        const split = payload.split('|');
        const item = split[0]?.trim() || 'Premium Developer Pack';
        const entries = split.slice(1).map(e => e.trim()).filter(Boolean);

        if (entries.length === 0) {
          await sendMsg(ctx, '⚠️ Usage: \`/giveaway draw <item_name>|@user1|@user2|@user3...\`\nExample: \`/giveaway draw Premium License Key|@bob|@alice|@charlie\`');
          return true;
        }

        const winnerIdx = Math.floor(Math.random() * entries.length);
        const winner = entries[winnerIdx];

        const outputMsg = `🎁 *TRIPWIRE GIVEAWAY CONTROLLER DRAW!* 🎊\n\n` +
          `• *Giveaway Item*: 🟢 *${item}*\n` +
          `• *Total Valid Entrants*: \`${entries.length} participants\`\n` +
          `• *RNG Validation Sweep*: Authorized & Sealed ✅\n\n` +
          `🏆 *LUCKY WINNER TARGET PARTICIPANT*:\n` +
          `👉 🔥 *${winner}* 🔥 🥳\n\n` +
          `_Congratulations! Your reward parameters have locked in user database records!_`;

        await sendMsg(ctx, outputMsg);
        return true;
      }
    }

    const manual = `🎁 *Automated Giveaway & Raffle picker*:\n\n` +
      `Format:\n\`/giveaway draw <item>|<entrant1>|<entrant2>...\`\n\n` +
      `Example:\n• \`/giveaway draw Amazon Voucher $50|@user_alpha|@user_beta|@user_delta\``;
    await sendMsg(ctx, manual);
    return true;
  }
  return false;
}

/**
 * Handle /leaderboard command
 */
export async function handleLeaderboard(ctx: CommandContext): Promise<boolean> {
  const { lowerText, chatId } = ctx;

  if (lowerText.startsWith('/leaderboard') || lowerText === '/leaderboard') {
    const session = db.getData().quizSessions[chatId];
    let lbTxt = `🏆 *Interactive Trivia Champion Leaderboard* 🏅\n\n`;

    if (!session || Object.keys(session.scoreHistory).length === 0) {
      lbTxt += `_Score records are empty currently on this chat session. Play the trivia using \`/quiz\` to score points!_`;
      await sendMsg(ctx, lbTxt);
      return true;
    }

    const sortedHistory = Object.entries(session.scoreHistory)
      .sort((a,b) => b[1] - a[1]);

    sortedHistory.forEach(([userId, score], idx) => {
      let medal = '•';
      if (idx === 0) medal = '🥇';
      else if (idx === 1) medal = '🥈';
      else if (idx === 2) medal = '🥉';

      lbTxt += `${medal} *ID: \`${userId}\`* — \`${score} Points\` (Verified Master)\n`;
    });

    await sendMsg(ctx, lbTxt);
    return true;
  }
  return false;
}

/**
 * Handle /suggest command
 */
export async function handleSuggest(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText, fromUser } = ctx;

  if (lowerText.startsWith('/suggest ') || lowerText.startsWith('/suggest@') || lowerText === '/suggest') {
    const parts = userText.split(/\s+/);
    const suggestions = db.getData().suggestions;

    if (parts.length > 1) {
      const text = userText.substring(userText.indexOf(parts[1])).trim();
      const newId = `sug_${Date.now()}`;

      const suggestionItem: SuggestionItem = {
        id: newId,
        userId: fromUser.id.toString(),
        username: fromUser.username || fromUser.first_name || 'unknown',
        text,
        status: 'pending',
        timestamp: new Date().toISOString()
      };

      suggestions.push(suggestionItem);
      db.save();

      const success = `📬 *Suggestion Logged/Dispatched successfully!* \n\n• *Content*: "${text}"\n• *Review panels status*: ⏳ Pending Admin Review\n\n_Thank you! Your feedback accelerates bot development._`;
      await sendMsg(ctx, success);
      return true;
    }

    const help = `📬 *Suggestion Vault Mailbox*:\n\nFormat:\n\`/suggest <your suggestion description>\`\n\nExample:\n• \`/suggest Enable crypto wallet triggers!\``;
    await sendMsg(ctx, help);
    return true;
  }
  return false;
}

/**
 * Handle /feedback command
 */
export async function handleFeedback(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText, fromUser } = ctx;

  if (lowerText.startsWith('/feedback ') || lowerText.startsWith('/feedback@') || lowerText === '/feedback') {
    const parts = userText.split(/\s+/);
    const feedbacks = db.getData().feedbacks;

    if (parts.length > 1) {
      const ratingStr = parts[1];
      const rating = parseInt(ratingStr);
      const text = parts.slice(2).join(' ').trim();

      if (isNaN(rating) || rating < 1 || rating > 5) {
        await sendMsg(ctx, '⚠️ Please provide a valid rating score between 1 and 5. Example: `/feedback 5 Excellent services!`');
        return true;
      }

      const freshId = `fb_${Date.now()}`;
      const newFeedback: FeedbackItem = {
        id: freshId,
        userId: fromUser.id.toString(),
        username: fromUser.username || fromUser.first_name || 'unknown_user',
        text: text || 'No comments left.',
        rating,
        timestamp: new Date().toISOString()
      };

      feedbacks.push(newFeedback);
      db.save();

      const stars = '⭐'.repeat(rating);
      const scoreMsg = `⭐ *Your Feedback Submitted!* ${stars}\n\n• *Rating Score*: \`${rating}/5 Stars\`\n• *Comment*: "${text || 'No comments.'}"\n\n_Registered inside Tellity telemetry diagnostics review sweeps!_`;

      await sendMsg(ctx, scoreMsg);
      return true;
    }

    const help = `⭐ *Core Performance Feedback & Review Panel*:\n\nFormat:\n\`/feedback <1-5 rating> [your detailed review text]\`\n\nExample:\n• \`/feedback 5 Absolutely incredible responsiveness!\``;
    await sendMsg(ctx, help);
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
    `Community module response${isSimulated ? ' (Simulated)' : ''}`
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
      console.error('Error sending message from Community plugin:', e.message);
    }
  }
}
