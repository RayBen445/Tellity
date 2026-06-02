import { CommandContext } from './types.js';

export interface NotepadItem {
  id: number;
  content: string;
  timestamp: string;
}

export async function handleNotepad(ctx: CommandContext, notes: NotepadItem[]): Promise<boolean> {
  const {
    userText,
    lowerText,
    chatId,
    isSimulated,
    botUsername,
    botName,
    botToken,
    addLog,
    callTelegramAPI,
    getCommonInlineKeyboard
  } = ctx;

  if (lowerText.startsWith('/notepad ') || lowerText.startsWith('/notepad@') || lowerText === '/notepad') {
    const parts = userText.split(/\s+/);

    if (parts.length > 1) {
      const subCommand = parts[1].toLowerCase();

      if (subCommand === 'new' || subCommand === 'add' || subCommand === 'create') {
        const content = parts.slice(2).join(' ').trim();
        if (content) {
          const newId = notes.length > 0 ? Math.max(...notes.map(n => n.id)) + 1 : 1;
          const newNote: NotepadItem = {
            id: newId,
            content,
            timestamp: new Date().toISOString()
          };
          notes.push(newNote);

          const successMsg = `📓 *Notepad item Added successfully*:\n\n• *ID*: \`${newId}\`\n• *Content*: "${content}"\n• *Timestamp*: \`${new Date().toLocaleTimeString()}\`\n\n_Your notes are fully persistent across live simulated and physical Telegram environments!_ 🔋`;
          addLog(
            'outgoing',
            chatId,
            { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
            successMsg,
            `Created notepad item ID ${newId}${isSimulated ? ' (Simulated)' : ''}`
          );

          if (!isSimulated && botToken) {
            try {
              await callTelegramAPI('sendMessage', {
                chat_id: chatId,
                text: successMsg,
                parse_mode: 'Markdown',
                reply_markup: getCommonInlineKeyboard()
              });
            } catch (e) {}
          }
          return true;
        }
      } else if (subCommand === 'list') {
        let listMsg = `📓 *Your Shared Workspace Notepad*:\n\n`;
        if (notes.length === 0) {
          listMsg += `_Your notebook is completely empty._\n\nType \`/notepad new <content>\` to pin your first item!`;
        } else {
          listMsg += notes.map(n => `• *[ID: ${n.id}]* — ${n.content}\n  _Created: ${new Date(n.timestamp).toLocaleTimeString()}_`).join('\n\n');
        }

        addLog(
          'outgoing',
          chatId,
          { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
          listMsg,
          `Listed notepad entries for chat ${chatId}${isSimulated ? ' (Simulated)' : ''}`
        );

        if (!isSimulated && botToken) {
          try {
            await callTelegramAPI('sendMessage', {
              chat_id: chatId,
              text: listMsg,
              parse_mode: 'Markdown',
              reply_markup: getCommonInlineKeyboard()
            });
          } catch (e) {}
        }
        return true;
      } else if (subCommand === 'edit') {
        const idArg = parseInt(parts[2], 10);
        const newContent = parts.slice(3).join(' ').trim();

        if (!isNaN(idArg) && newContent) {
          const matchedNote = notes.find(n => n.id === idArg);
          if (matchedNote) {
            matchedNote.content = newContent;
            matchedNote.timestamp = new Date().toISOString();

            const successMsg = `📓 *Notepad item ${idArg} Updated Successfully*:\n\n• *New Content*: "${newContent}"\n• *Updated at*: \`${new Date().toLocaleTimeString()}\``;
            addLog(
              'outgoing',
              chatId,
              { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
              successMsg,
              `Updated notepad item ID ${idArg}${isSimulated ? ' (Simulated)' : ''}`
            );

            if (!isSimulated && botToken) {
              try {
                await callTelegramAPI('sendMessage', {
                  chat_id: chatId,
                  text: successMsg,
                  parse_mode: 'Markdown',
                  reply_markup: getCommonInlineKeyboard()
                });
              } catch (e) {}
            }
            return true;
          }
        }
      } else if (subCommand === 'delete' || subCommand === 'remove' || subCommand === 'erase') {
        const idArg = parseInt(parts[2], 10);
        if (!isNaN(idArg)) {
          const idx = notes.findIndex(n => n.id === idArg);
          if (idx !== -1) {
            notes.splice(idx, 1);
            const successMsg = `📓 *Notepad item ${idArg} Deleted Successfully*`;
            addLog(
              'outgoing',
              chatId,
              { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
              successMsg,
              `Deleted notepad item ID ${idArg}${isSimulated ? ' (Simulated)' : ''}`
            );

            if (!isSimulated && botToken) {
              try {
                await callTelegramAPI('sendMessage', {
                  chat_id: chatId,
                  text: successMsg,
                  parse_mode: 'Markdown',
                  reply_markup: getCommonInlineKeyboard()
                });
              } catch (e) {}
            }
            return true;
          }
        }
      }
    }

    const helpReply = `📓 *How to use persistent Notepad Ledger*:\n\nFormat:\n• \`/notepad list\` — Fetch your total shared ledger notes\n• \`/notepad new <your notes content>\` — Append a new note entry\n• \`/notepad edit <id> <new text>\` — Modify an existing note\n• \`/notepad delete <id>\` — Erase a note permanently`;
    addLog(
      'outgoing',
      chatId,
      { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
      helpReply,
      `Sent notepad helper instructions${isSimulated ? ' (Simulated)' : ''}`
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
