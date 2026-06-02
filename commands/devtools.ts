import { CommandContext } from './types.js';
import sharp from 'sharp';

/**
 * Handle /json command
 */
export async function handleJson(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText } = ctx;

  if (lowerText.startsWith('/json ') || lowerText.startsWith('/json@') || lowerText === '/json') {
    const parts = userText.split(/\s+/);
    if (parts.length > 1) {
      const jsonPayload = userText.substring(userText.indexOf(parts[1])).trim();

      try {
        const parsed = JSON.parse(jsonPayload);
        const formatted = JSON.stringify(parsed, null, 2);

        const okMsg = `❇️ *JSON Integrity Validator: VALID* ✅\n\n\`\`\`json\n${formatted}\n\`\`\``;
        await sendMsg(ctx, okMsg);
      } catch (err: any) {
        const errorMsg = `❌ *JSON Syntax Error*:\n\n• *Diagnostics*: \`${err.message}\`\n\nYour inputs are invalid. Check parameters.`;
        await sendMsg(ctx, errorMsg);
      }
      return true;
    }

    const help = `❇️ *Advanced JSON Beautifier & Structural Linter*:\n\nFormat:\n\`/json <raw_json_string>\`\n\nExample:\n• \`/json {"name":"Tellity","tier":"premium"}\``;
    await sendMsg(ctx, help);
    return true;
  }
  return false;
}

/**
 * Handle /base64 command
 */
export async function handleBase64(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText } = ctx;

  if (lowerText.startsWith('/base64 ') || lowerText.startsWith('/base64@') || lowerText === '/base64') {
    const parts = userText.split(/\s+/);

    if (parts.length > 2) {
      const mode = parts[1].toLowerCase();
      const content = parts.slice(2).join(' ').trim();

      if (mode === 'encode' || mode === 'enc') {
        const encoded = Buffer.from(content).toString('base64');
        await sendMsg(ctx, `🔒 *Base64 Encoder translation completed*:\n\n\`\`\`\n${encoded}\n\`\`\``);
        return true;
      } else if (mode === 'decode' || mode === 'dec') {
        try {
          const decoded = Buffer.from(content, 'base64').toString('utf-8');
          await sendMsg(ctx, `🔓 *Base64 Decoder translation completed*:\n\n\`\`\`\n${decoded}\n\`\`\``);
        } catch (e: any) {
          await sendMsg(ctx, `⚠️ Decoding fault: Corrupt base64 string provided.`);
        }
        return true;
      }
    }

    const help = `🔒 *Base64 Encoder & Decoder Core*:\n\nFormat:\n\`/base64 <encode|decode> <text>\`\n\nExamples:\n• \`/base64 encode MySecretMessage\`\n• \`/base64 decode TXlTZWNyZXRNZXNzYWdl\``;
    await sendMsg(ctx, help);
    return true;
  }
  return false;
}

/**
 * Handle /regex command
 */
export async function handleRegex(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText } = ctx;

  if (lowerText.startsWith('/regex ') || lowerText.startsWith('/regex@') || lowerText === '/regex') {
    const parts = userText.split(/\s+/);

    if (parts.length > 2) {
      const regexPattern = parts[1];
      const testContent = parts.slice(2).join(' ').trim();

      try {
        // Strip leading and trailing slashes if they exist
        let cleanPattern = regexPattern;
        let flags = 'g';

        if (regexPattern.startsWith('/')) {
          const lastSlash = regexPattern.lastIndexOf('/');
          cleanPattern = regexPattern.substring(1, lastSlash);
          flags = regexPattern.substring(lastSlash + 1) || 'g';
        }

        const matcher = new RegExp(cleanPattern, flags);
        const matches: string[] = [];
        let mat: RegExpExecArray | null;

        // Prevent infinite loops on empty regexes
        if (cleanPattern === '') {
          await sendMsg(ctx, '⚠️ Pattern text is empty!');
          return true;
        }

        let safetyCounter = 0;
        while ((mat = matcher.exec(testContent)) !== null && safetyCounter < 50) {
          matches.push(`• Match: \`${mat[0]}\` index: \`${mat.index}\` (Group 1: \`${mat[1] || 'N/A'}\`)`);
          safetyCounter++;
          if (!matcher.global) break;
        }

        let resp = `🔬 *Regular Expression Pattern Tester*:\n\n` +
          `• *Pattern*: \`/${cleanPattern}/${flags}\`\n` +
          `• *Test Text*: "${testContent}"\n\n` +
          `📦 *Matching Traces (${matches.length} found)*:\n`;

        if (matches.length === 0) {
          resp += `_No matching positions detected inside test string._`;
        } else {
          resp += matches.join('\n');
        }

        await sendMsg(ctx, resp);
        return true;
      } catch (err: any) {
        await sendMsg(ctx, `❌ Regex Compiler error: \`${err.message}\`. Please clarify syntax rules.`);
        return true;
      }
    }

    const help = `🔬 *Regex Capture Tester Console*:\n\nFormat:\n\`/regex <pattern_with_or_without_slashes> <test_sentence>\`\n\nExample:\n• \`/regex /\\d+/ Total price was 99 dollars\`\n• \`/regex /(\\w+@\\w+\\.\\w+)/ Mail to info@google.com\``;
    await sendMsg(ctx, help);
    return true;
  }
  return false;
}

/**
 * Handle /timestamp command
 */
export async function handleTimestamp(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText } = ctx;

  if (lowerText.startsWith('/timestamp ') || lowerText.startsWith('/timestamp@') || lowerText === '/timestamp') {
    const parts = userText.split(/\s+/);

    if (parts.length > 1) {
      const arg = parts[1];

      // If it looks like a number, treat as unix timestamp
      if (arg.match(/^\d+$/)) {
        let tsValue = parseInt(arg);
        // handle millisecond ts as well
        if (tsValue > 9999999999) {
          tsValue = Math.floor(tsValue / 1000);
        }

        const dateObj = new Date(tsValue * 1000);
        const respText = `🕰️ *Unix Epoch to Human Gregorian Converter*:\n\n` +
          `• *Input Unix Timestamp*: \`${tsValue}\` (seconds)\n` +
          `• *Greenwich UTC Time*: \`${dateObj.toUTCString()}\`\n` +
          `• *ISO Date Format*: \`${dateObj.toISOString()}\``;
        
        await sendMsg(ctx, respText);
        return true;
      } else {
        // Try parsing string to date
        const dateStr = parts.slice(1).join(' ').trim();
        const parsedMs = Date.parse(dateStr);

        if (!isNaN(parsedMs)) {
          const respText = `🕰️ *ISO Date String to Unix Epoch Converter*:\n\n` +
            `• *Input Date String*: \`${dateStr}\`\n` +
            `• *Computed Epoch (Seconds)*: \`${Math.floor(parsedMs / 1000)}\`\n` +
            `• *Computed Epoch (Milliseconds)*: \`${parsedMs}\` ms`;
          
          await sendMsg(ctx, respText);
        } else {
          await sendMsg(ctx, `⚠️ Date parser failed. Ensure string is an RFC2822 or ISO-8601 compatible value.`);
        }
        return true;
      }
    }

    // Default current time
    const epochSec = Math.floor(Date.now() / 1000);
    const dateNow = new Date();
    const currMsg = `🕰️ *Universal Master Timestamp Utility*:\n\n` +
      `• *Current Unix Timestamp*: \`${epochSec}\` (Seconds)\n` +
      `• *Current Millisecond Time*: \`${Date.now()}\` ms\n` +
      `• *Human UTC Time*: \`${dateNow.toUTCString()}\`\n\n` +
      `💡 *Dynamic conversions from chat*:\n` +
      `• Type \`/timestamp <unix_value>\` -> Gregorian Date\n` +
      `• Type \`/timestamp <date_string>\` -> Unix Epoch`;

    await sendMsg(ctx, currMsg);
    return true;
  }
  return false;
}

/**
 * Handle /color command
 */
export async function handleColor(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText, chatId, isSimulated, botToken, callTelegramAPI } = ctx;

  if (lowerText.startsWith('/color ') || lowerText.startsWith('/color@') || lowerText === '/color') {
    const parts = userText.split(/\s+/);

    if (parts.length > 1) {
      let hex = parts[1].toUpperCase();
      if (!hex.startsWith('#')) hex = '#' + hex;

      // Validate HEX
      if (!hex.match(/^#[0-9A-F]{6}$/)) {
        await sendMsg(ctx, '⚠️ Invalid HEX notation value provided. Ensure formatting matches standard 6-digit hex notation (e.g. #FF5500).');
        return true;
      }

      // Convert hex to rgb
      const r = parseInt(hex.substring(1,3), 16);
      const g = parseInt(hex.substring(3,5), 16);
      const b = parseInt(hex.substring(5,7), 16);

      // Convert rgb to hsl
      const rRatio = r / 255;
      const gRatio = g / 255;
      const bRatio = b / 255;

      const max = Math.max(rRatio, gRatio, bRatio);
      const min = Math.min(rRatio, gRatio, bRatio);
      let h = 0;
      let s = 0;
      const l = (max + min) / 2;

      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case rRatio: h = (gRatio - bRatio) / d + (gRatio < bRatio ? 6 : 0); break;
          case gRatio: h = (bRatio - rRatio) / d + 2; break;
          case bRatio: h = (rRatio - gRatio) / d + 4; break;
        }
        h /= 6;
      }

      const hDeg = Math.round(h * 360);
      const sPct = Math.round(s * 100);
      const lPct = Math.round(l * 100);

      const colorData = `🎨 *Interactive Hex Color Spectrum decoder*:\n\n` +
        `• *Input HEX Color*: \`${hex}\`\n` +
        `• *RGB equivalent*: \`rgb(${r}, ${g}, ${b})\`\n` +
        `• *HSL equivalent*: \`hsl(${hDeg}, ${sPct}%, ${lPct}%)\`\n\n` +
        `_Generating and uploading a clean visual solid color block swatch PNG..._`;

      await sendMsg(ctx, colorData);

      try {
        // Build 200x200 solid color card using sharp!
        const colorCardBuffer = await sharp({
          create: {
            width: 200,
            height: 200,
            channels: 3,
            background: { r, g, b }
          }
        }).png().toBuffer();

        if (!isSimulated && botToken) {
          const blob = new Blob([colorCardBuffer], { type: 'image/png' });
          const formData = new FormData();
          formData.append('chat_id', chatId.toString());
          formData.append('photo', blob, `color_${hex.replace('#','')}.png`);
          formData.append('caption', `🎨 Color card palette for: ${hex}`);

          await callTelegramAPI('sendPhoto', formData);
        }
      } catch (e: any) {
        console.error('Error rendering color card:', e.message);
      }
      return true;
    }

    const help = `🎨 *HEX Spectrum Color Analyst*:\n\nFormat:\n\`/color <HEX_CODE>\`\n\nExample:\n• \`/color #4f46e5\`\n• \`/color #ff5500\``;
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
    `Devtools module response${isSimulated ? ' (Simulated)' : ''}`
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
      console.error('Error sending message from Devtools plugin:', e.message);
    }
  }
}
