import { CommandContext } from './types.js';
import * as mathguru from 'mathguru';

export async function handleCalculate(ctx: CommandContext): Promise<boolean> {
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

  if (lowerText.startsWith('/calculate ') || lowerText.startsWith('/calculate@') || lowerText === '/calculate') {
    const parts = userText.split(/\s+/);
    if (parts.length > 1) {
      const expression = userText.substring(userText.indexOf(parts[1])).trim();
      let resultMsg = '';
      
      try {
        if (expression.toLowerCase().startsWith('plot ') || expression.toLowerCase().startsWith('graph ')) {
          const functionStr = expression.substring(5).trim();
          const asciiGraph = mathguru.graph.plot(functionStr, { size: '40x12' });
          resultMsg = `📈 *Advanced Math Plot Grid*:\n\n• *Function*: \`${functionStr}\`\n• *Plot Output*:\n\n\`\`\`\n${asciiGraph}\n\`\`\`\n\n_Rendered dynamically using MathGuru Sandbox Graphics!_ ⚡`;
        } else if (expression.toLowerCase() === 'list' || expression.toLowerCase() === 'formulas') {
          const list = mathguru.formulas.list().slice(0, 8);
          resultMsg = `🧮 *MathGuru Built-in Formulas Register*:\n\n` + 
            list.map(f => `• *${f.name}* (${f.category}): \`${f.formula}\`\n  _${f.description}_`).join('\n\n') +
            `\n\n_Type \`/calculate explain <name>\` to parse derivation step sequences!_ 🧪`;
        } else if (expression.toLowerCase().startsWith('explain ')) {
          const searchArg = expression.substring(8).trim();
          const explanation = mathguru.formulas.explain(searchArg);
          resultMsg = `🧪 *Diagnostic Formula Derivation*:\n\n${explanation}\n\n_Analyzed using MathGuru Analytical Engines!_`;
        } else {
          // Standard mathematical calculation
          const calculated = mathguru.calc.evaluate(expression);
          resultMsg = `🧮 *Mathematical calculation Successful*:\n\n• *Query*: \`${expression}\`\n• *Solution Outcome*:\n\n> *${calculated}*\n\n_Engine: MathGuru Native Parser Core_ 🔋`;
        }

        addLog(
          'outgoing',
          chatId,
          { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
          resultMsg,
          `Successfully calculated expression: ${expression}${isSimulated ? ' (Simulated)' : ''}`
        );

        if (!isSimulated && botToken) {
          try {
            await callTelegramAPI('sendMessage', {
              chat_id: chatId,
              text: resultMsg,
              parse_mode: 'Markdown',
              reply_markup: getCommonInlineKeyboard()
            });
          } catch (e) {}
        }
        return true;
      } catch (err: any) {
        console.warn('MathGuru compilation failure, falling back to basic calculator:', err.message);
        const safeExpr = expression.replace(/[^0-9+\-*/%().\s^]/g, '').replace(/\^/g, '**');
        if (safeExpr) {
          try {
            const result = new Function(`return (${safeExpr})`)();
            if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
              const fallbackMsg = `🧮 *Calculation (Basic Fallback)*:\n\n• *Expression*: \`${expression}\`\n• *Result*: *${result}*\n• *Status*: Basic Local Engine fallback`;
              addLog(
                'outgoing',
                chatId,
                { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
                fallbackMsg,
                `Calculated basic expression step as fallback${isSimulated ? ' (Simulated)' : ''}`
              );

              if (!isSimulated && botToken) {
                try {
                  await callTelegramAPI('sendMessage', {
                    chat_id: chatId,
                    text: fallbackMsg,
                    parse_mode: 'Markdown'
                  });
                } catch (e) {}
              }
              return true;
            }
          } catch (basicErr) {}
        }
      }

      const errMsg = `⚠ *Calculation Failed*:\n\nCould not evaluate expression: \`${expression}\`.\nPlease double check formula layout and parameters.`;
      addLog(
        'outgoing',
        chatId,
        { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
        errMsg,
        `Failed to calculate: ${expression}${isSimulated ? ' (Simulated)' : ''}`
      );
      if (!isSimulated && botToken) {
        try {
          await callTelegramAPI('sendMessage', {
            chat_id: chatId,
            text: errMsg,
            parse_mode: 'Markdown'
          });
        } catch (e) {}
      }
      return true;
    }

    const helpReply = `🧮 *How to use Sandbox Calculator*:\n\nFormat:\n\`/calculate <mathematical expression>\`\n\n*Examples*:\n• \`/calculate 12 * (45 - 20) / 5\`\n• \`/calculate plot sin(x)\` _(Plots math graphs!)_\n• \`/calculate formulas\` _(Lists custom recipes)_`;
    addLog(
      'outgoing',
      chatId,
      { id: 0, username: botUsername?.replace('@', '') || 'Bot', first_name: botName || 'Bot' },
      helpReply,
      `Sent calculator instructions${isSimulated ? ' (Simulated)' : ''}`
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
