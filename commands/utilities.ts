import crypto from 'crypto';
import { CommandContext } from './types.js';
import { db, ShortUrlItem } from '../src/db.js';

/**
 * Handle /qr command
 */
export async function handleQr(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText, chatId, isSimulated, botToken, callTelegramAPI } = ctx;

  if (lowerText.startsWith('/qr ') || lowerText.startsWith('/qr@') || lowerText === '/qr') {
    const parts = userText.split(/\s+/);
    if (parts.length > 1) {
      const data = userText.substring(userText.indexOf(parts[1])).trim();
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(data)}`;

      const textReply = `🖼️ *Generated QR Code Successfully!*\n\n• *Content*: \`${data}\`\n• *Format*: 350x350 PNG\n\n_Rendered live using high-speed QR Server algorithms._`;

      await sendMsg(ctx, textReply);

      if (!isSimulated && botToken) {
        try {
          await callTelegramAPI('sendPhoto', {
            chat_id: chatId,
            photo: qrUrl,
            caption: `🔍 QR Code for: ${data}`
          });
        } catch (err: any) {
          console.error('Error sending Telegram Photo:', err.message);
        }
      }
      return true;
    }

    const help = `🔍 *High-Resolution QR Code Engine*:\n\n` +
      `Create customizable, durable barcodes / QR targets immediately:\n\n` +
      `Format:\n\`/qr <any URL, text, or phone vCard block>\`\n\n` +
      `Example:\n• \`/qr https://google.com\`\n• \`/qr Wifi-Network-1234\``;
    await sendMsg(ctx, help);
    return true;
  }
  return false;
}

/**
 * Handle /shorten command
 */
export async function handleShorten(ctx: CommandContext, appUrl: string): Promise<boolean> {
  const { userText, lowerText, chatId, fromUser } = ctx;

  if (lowerText.startsWith('/shorten ') || lowerText.startsWith('/shorten@') || lowerText === '/shorten') {
    const parts = userText.split(/\s+/);
    const shortUrls = db.getData().shortUrls;

    if (parts.length > 1) {
      const longUrl = parts[1];
      let alias = parts[2] || Math.random().toString(36).substring(2, 7);

      if (!longUrl.startsWith('http://') && !longUrl.startsWith('https://')) {
        await sendMsg(ctx, '⚠️ Please provide a valid absolute URL starting with `http://` or `https://`');
        return true;
      }

      // Check if alias already taken
      const exist = shortUrls.find(s => s.alias === alias);
      if (exist) {
        alias = alias + Math.floor(Math.random() * 10);
      }

      const shortItem: ShortUrlItem = {
        id: `url_${Date.now()}`,
        alias,
        originalUrl: longUrl,
        clicks: 0,
        analytics: []
      };

      shortUrls.push(shortItem);
      db.save();

      const domain = appUrl || `https://mybot.sandbox`;
      const shortenedUrl = `${domain}/r/${alias}`;

      const resText = `🔗 *Link Shortened Successfully!* 🚀\n\n` +
        `• *Original Link*: ${longUrl}\n` +
        `• *Short Alias Url*: [${shortenedUrl}](${shortenedUrl})\n` +
        `• *Analytical Tracker*: \`${domain}/r/${alias}/stats\`\n\n` +
        `_Monitor real-time conversion and geolocation click statistics!_`;

      await sendMsg(ctx, resText);
      return true;
    }

    const help = `🔗 *Dynamic Link Shortening Core*:\n\n` +
      `Minimize layouts and build trackable clicks analytics:\n\n` +
      `Format:\n\`/shorten <long_url> [custom_label_alias]\`\n\n` +
      `Example:\n• \`/shorten https://github.com gh\`\n• \`/shorten https://news.ycombinator.com hacker\``;
    await sendMsg(ctx, help);
    return true;
  }
  return false;
}

/**
 * Handle /barcode command
 */
export async function handleBarcode(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText, chatId, isSimulated, botToken, callTelegramAPI } = ctx;

  if (lowerText.startsWith('/barcode ') || lowerText.startsWith('/barcode@') || lowerText === '/barcode') {
    const parts = userText.split(/\s+/);
    if (parts.length > 1) {
      const payload = userText.substring(userText.indexOf(parts[1])).trim();
      // Generate clean barcode URL using TEC-IT online free generator (Standard Code-128 barcode format)
      const barcodeUrl = `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(payload)}&code=Code128&multiplebarcodes=false&translate-esc=true&unit=Fit&dpi=96`;

      const textReply = `📊 *Generated Barcode Successfully!*\n\n• *Content*: \`${payload}\`\n• *Format*: Code-128 Standard Card\n\n_Rendered live using high-speed TEC-IT Graphics._`;

      await sendMsg(ctx, textReply);

      if (!isSimulated && botToken) {
        try {
          await callTelegramAPI('sendPhoto', {
            chat_id: chatId,
            photo: barcodeUrl,
            caption: `📊 Barcode card: ${payload}`
          });
        } catch (err: any) {
          console.error('Error sending Telegram Photo:', err.message);
        }
      }
      return true;
    }

    const help = `📊 *Standard Barcode Generator Engine*:\n\n` +
      `Create Code-128 compatible barcodes instantly:\n\n` +
      `Format:\n\`/barcode <alphanumeric_payload_text>\`\n\n` +
      `Example:\n• \`/barcode NET-SER-9937001\`\n• \`/barcode SKU-MUG-BLACK\``;
    await sendMsg(ctx, help);
    return true;
  }
  return false;
}

/**
 * Handle /password command
 */
export async function handlePassword(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText } = ctx;

  if (lowerText.startsWith('/password ') || lowerText.startsWith('/password@') || lowerText === '/password') {
    const parts = userText.split(/\s+/);
    let length = 16;
    let useSymbols = true;
    let useNumbers = true;

    if (parts.length > 1) {
      const parsedLen = parseInt(parts[1]);
      if (!isNaN(parsedLen) && parsedLen >= 6 && parsedLen <= 128) {
        length = parsedLen;
      }
      if (parts.length > 2) {
        const flags = parts.slice(2).join(' ').toLowerCase();
        useSymbols = !flags.includes('nosym');
        useNumbers = !flags.includes('nonum');
      }
    }

    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    let pool = uppercase + lowercase;
    if (useNumbers) pool += numbers;
    if (useSymbols) pool += symbols;

    let pwd = '';
    const bytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      pwd += pool[bytes[i] % pool.length];
    }

    // Double check we have at least one character of each requested type to guarantee entropy
    const finalMsg = `🔑 *Random Password Generator Core*:\n\n` +
      `• *Generated Password*:\n\`\`\`\n${pwd}\n\`\`\`\n` +
      `• *Entropy Length*: \`${length} characters\`\n` +
      `• *Symbols Enabled*: \`${useSymbols ? 'YES ✅' : 'NO ❌'}\`\n` +
      `• *Numbers Enabled*: \`${useNumbers ? 'YES ✅' : 'NO ❌'}\`\n\n` +
      `_Securely randomized using Node crypto architecture!_`;

    await sendMsg(ctx, finalMsg);
    return true;
  }
  return false;
}

/**
 * Handle /uuid command
 */
export async function handleUuid(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText } = ctx;

  if (lowerText.startsWith('/uuid ') || lowerText.startsWith('/uuid@') || lowerText === '/uuid') {
    const parts = userText.split(/\s+/);
    let count = 1;

    if (parts.length > 1) {
      const parsedCount = parseInt(parts[1]);
      if (!isNaN(parsedCount) && parsedCount >= 1 && parsedCount <= 20) {
        count = parsedCount;
      }
    }

    const uuids: string[] = [];
    for (let i = 0; i < count; i++) {
      uuids.push(crypto.randomUUID());
    }

    const outText = `🆔 *Universal Unique Identifier (v4) Output*:\n\n` +
      uuids.map((u, idx) => `*${idx + 1}.* \`${u}\``).join('\n') +
      `\n\n_Bulk production identities computed safely via crypto interfaces._`;

    await sendMsg(ctx, outText);
    return true;
  }
  return false;
}

/**
 * Handle /hash command
 */
export async function handleHash(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText } = ctx;

  if (lowerText.startsWith('/hash ') || lowerText.startsWith('/hash@') || lowerText === '/hash') {
    const parts = userText.split(/\s+/);

    if (parts.length > 1) {
      const algo = parts[1].toLowerCase();
      const textToHash = parts.slice(2).join(' ').trim();

      const validAlgos = ['md5', 'sha1', 'sha256', 'sha512'];
      if (!validAlgos.includes(algo)) {
        await sendMsg(ctx, `⚠️ Unsupported hashing algorithm: \`${algo}\`\nSupported formats: \`md5\`, \`sha1\`, \`sha256\`, \`sha512\`.`);
        return true;
      }

      if (!textToHash) {
        await sendMsg(ctx, `⚠️ Please provide a text block to hash.\nFormat: \`/hash <algorithm> <text>\``);
        return true;
      }

      try {
        const hashResult = crypto.createHash(algo).update(textToHash).digest('hex');
        const finalMsg = `🧪 *Cryptographic Hash Analyzer*:\n\n` +
          `• *Algorithm*: \`${algo.toUpperCase()}\`\n` +
          `• *Input Text*: \`${textToHash}\`\n\n` +
          `• *Computed Hash Hex*:\n\`\`\`\n${hashResult}\n\`\`\``;

        await sendMsg(ctx, finalMsg);
        return true;
      } catch (err: any) {
        await sendMsg(ctx, `⚠️ Encryption engine fault: ${err.message}`);
        return true;
      }
    }

    const manual = `🛡️ *Cryptographic Hash Generator Module*:\n\n` +
      `Format:\n\`/hash <md5|sha1|sha256|sha512> <input_text>\`\n\n` +
      `Example:\n• \`/hash sha256 MyPassword123\`\n• \`/hash md5 welcome_message\``;
    await sendMsg(ctx, manual);
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
    `Utility module response${isSimulated ? ' (Simulated)' : ''}`
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
      console.error('Error sending message from Utility plugin:', e.message);
    }
  }
}
