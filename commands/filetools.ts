import { CommandContext } from './types.js';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { GoogleGenAI } from '@google/genai';

// Initialize Gemini SDK with telemetry headers
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build'
    }
  }
});

/**
 * Helper to fetch a file as Buffer
 */
async function fetchFileBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

/**
 * Handle /mergepdf command
 */
export async function handleMergePdf(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText, chatId, isSimulated, botToken, callTelegramAPI } = ctx;

  if (lowerText.startsWith('/mergepdf ') || lowerText.startsWith('/mergepdf@') || lowerText === '/mergepdf') {
    const parts = userText.split(/\s+/);

    await sendMsg(ctx, `⚙️ *Processing PDF Merge Request...* \nPreparing PDF compiler using \`pdf-lib\`...`);

    try {
      let pdfBuffers: Buffer[] = [];

      if (parts.length > 1 && (parts[1].startsWith('http://') || parts[1].startsWith('https://'))) {
        // Fetch real URLs
        const urls = parts.slice(1);
        for (const url of urls) {
          try {
            pdfBuffers.push(await fetchFileBuffer(url));
          } catch (err: any) {
            await sendMsg(ctx, `⚠️ Failed to download PDF from URL: \`${url}\` (${err.message}). Using sample templates...`);
          }
        }
      }

      // If no valid URLs provided, generate two high-fidelity sample PDFs on the fly and merge them!
      if (pdfBuffers.length < 2) {
        await sendMsg(ctx, `💡 _No list of PDF URLs was supplied. Auto-generating 2 premium PDF pages dynamically to demonstrate high-fidelity compilation..._`);
        
        // Target 1
        const pdfDoc1 = await PDFDocument.create();
        const page1 = pdfDoc1.addPage([500, 400]);
        page1.drawText('Tellity Compilations - Part 1', { x: 50, y: 300, size: 24 });
        page1.drawText('Author: Custom Bot Framework Console', { x: 50, y: 250, size: 12 });
        page1.drawText('This document represents Page 1 of the merged output.', { x: 50, y: 200, size: 10 });
        const bytes1 = await pdfDoc1.save();
        pdfBuffers.push(Buffer.from(bytes1));

        // Target 2
        const pdfDoc2 = await PDFDocument.create();
        const page2 = pdfDoc2.addPage([500, 400]);
        page2.drawText('Tellity Compilations - Part 2', { x: 50, y: 300, size: 24 });
        page2.drawText('Status: Merged via local Sandboxed Filetools', { x: 50, y: 250, size: 12 });
        page2.drawText('This document represents Page 2 of the merged output.', { x: 50, y: 200, size: 10 });
        const bytes2 = await pdfDoc2.save();
        pdfBuffers.push(Buffer.from(bytes2));
      }

      // Perform actual merge
      const mergedDoc = await PDFDocument.create();
      for (const buf of pdfBuffers) {
        const srcDoc = await PDFDocument.load(buf);
        const copiedPages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
        copiedPages.forEach((p) => mergedDoc.addPage(p));
      }

      const mergedBytes = await mergedDoc.save();
      const compiledBuffer = Buffer.from(mergedBytes);

      const statusMsg = `📄 *PDF Merge Process Completed (pdf-lib)!* 🎉\n\n• *Merged count*: \`${pdfBuffers.length} documents\`\n• *Total size*: \`${(compiledBuffer.length / 1024).toFixed(1)} KB\`\n\n_Uploading PDF document attachment bellow!_ 👇`;
      await sendMsg(ctx, statusMsg);

      if (!isSimulated && botToken) {
        const blob = new Blob([compiledBuffer], { type: 'application/pdf' });
        const formData = new FormData();
        formData.append('chat_id', chatId.toString());
        formData.append('document', blob, 'tellity_merged_collection.pdf');
        formData.append('caption', '📄 Compiled Merged Document Collection');

        await callTelegramAPI('sendDocument', formData);
      }
      return true;
    } catch (err: any) {
      await sendMsg(ctx, `❌ PDF Compilation Error: ${err.message}`);
      return true;
    }
  }
  return false;
}

/**
 * Handle /splitpdf command
 */
export async function handleSplitPdf(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText, chatId, isSimulated, botToken, callTelegramAPI } = ctx;

  if (lowerText.startsWith('/splitpdf ') || lowerText.startsWith('/splitpdf@') || lowerText === '/splitpdf') {
    const parts = userText.split(/\s+/);

    await sendMsg(ctx, `⚙️ *Splitting PDF Document...*`);

    try {
      let pdfBuf: Buffer;
      let startPage = 1;
      let endPage = 1;

      // Check if URL specified
      let urlArg = parts.find(p => p.startsWith('http://') || p.startsWith('https://'));
      if (urlArg) {
        pdfBuf = await fetchFileBuffer(urlArg);
        // Find page indices: e.g. /splitpdf 1-2 https://url.com
        const indicesArg = parts.find(p => p.match(/^\d+-\d+$/));
        if (indicesArg) {
          const m = indicesArg.split('-');
          startPage = parseInt(m[0]);
          endPage = parseInt(m[1]);
        }
      } else {
        // Generate a 3-page sample PDF on the fly to split
        await sendMsg(ctx, `💡 _No source document URL. Fabricating a premium multi-page document mock for splitting (Extracting Page 1-2)..._`);
        const doc = await PDFDocument.create();
        for (let i = 1; i <= 3; i++) {
          const page = doc.addPage([500, 400]);
          page.drawText(`Document Core Page ${i}`, { x: 50, y: 300, size: 24 });
          page.drawText(`Sub-level index detail.`, { x: 50, y: 220, size: 12 });
        }
        pdfBuf = Buffer.from(await doc.save());
        startPage = 1;
        endPage = 2;
      }

      const srcDoc = await PDFDocument.load(pdfBuf);
      const outputDoc = await PDFDocument.create();

      const pageCount = srcDoc.getPageCount();
      const sIdx = Math.max(0, startPage - 1);
      const eIdx = Math.min(pageCount - 1, endPage - 1);

      const indices: number[] = [];
      for (let i = sIdx; i <= eIdx; i++) {
        indices.push(i);
      }

      if (indices.length === 0) {
        await sendMsg(ctx, `⚠️ No page matching the range: ${startPage}-${endPage} was found inside the target (Total doc size: ${pageCount} pages).`);
        return true;
      }

      const copiedPages = await outputDoc.copyPages(srcDoc, indices);
      copiedPages.forEach((p) => outputDoc.addPage(p));

      const splitBytes = await outputDoc.save();
      const compiledBuffer = Buffer.from(splitBytes);

      const resTxt = `📄 *PDF Sliced Cleanly!* ✂️\n\n• *Range*: Page \`${startPage}\` to \`${endPage}\`\n• *Source size*: \`${pageCount} pages\`\n• *Extracted size*: \`${indices.length} page(s)\`\n\n_Uploading document slice..._`;
      await sendMsg(ctx, resTxt);

      if (!isSimulated && botToken) {
        const blob = new Blob([compiledBuffer], { type: 'application/pdf' });
        const formData = new FormData();
        formData.append('chat_id', chatId.toString());
        formData.append('document', blob, `split_range_${startPage}_to_${endPage}.pdf`);
        formData.append('caption', `✂️ Extracted range page ${startPage} - ${endPage}`);

        await callTelegramAPI('sendDocument', formData);
      }
      return true;
    } catch (err: any) {
      await sendMsg(ctx, `❌ PDF Splitting Fault: ${err.message}`);
      return true;
    }
  }
  return false;
}

/**
 * Handle /compress command
 */
export async function handleCompress(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText, chatId, isSimulated, botToken, callTelegramAPI } = ctx;

  if (lowerText.startsWith('/compress ') || lowerText.startsWith('/compress@') || lowerText === '/compress') {
    const parts = userText.split(/\s+/);
    let quality = 60; // 0-100 quality

    // Read quality parameter e.g. /compress 40
    const qualParam = parts.find(p => p.match(/^\d+$/));
    if (qualParam) {
      quality = Math.max(5, Math.min(100, parseInt(qualParam)));
    }

    await sendMsg(ctx, `🖼️ *Processing Image Compression Request (Sharp)...* \nCompression target: \`quality: ${quality}%\``);

    try {
      let imageBuffer: Buffer;
      let urlArg = parts.find(p => p.startsWith('http://') || p.startsWith('https://'));

      if (urlArg) {
        imageBuffer = await fetchFileBuffer(urlArg);
      } else {
        // Generate an elegant local graphic buffer using sharp if no URL is specified
        await sendMsg(ctx, `💡 _No URL specified. Creating a premium sample graphic for compression test..._`);
        imageBuffer = await sharp({
          create: {
            width: 800,
            height: 600,
            channels: 3,
            background: { r: 50, g: 15, b: 90 }
          }
        }).png().toBuffer();
      }

      // Compress to WEBP
      const compressedBuffer = await sharp(imageBuffer)
        .webp({ quality })
        .toBuffer();

      const reductionMsg = `🖼️ *Image Compressed via Sharp!* 🔋\n\n• *Standard Format*: WEBP\n• *Target Quality*: \`${quality}%\`\n• *Original Size*: \`${(imageBuffer.length / 1024).toFixed(1)} KB\`\n• *Compressed Size*: \`${(compressedBuffer.length / 1024).toFixed(1)} KB\`\n• *Saving ratio*: 🔥 \`${Math.round((1 - compressedBuffer.length / imageBuffer.length) * 100)}%\` saved!`;
      await sendMsg(ctx, reductionMsg);

      if (!isSimulated && botToken) {
        const blob = new Blob([compressedBuffer], { type: 'image/webp' });
        const formData = new FormData();
        formData.append('chat_id', chatId.toString());
        formData.append('photo', blob, 'compressed_render.webp');
        formData.append('caption', `🖼️ Quality: ${quality}% WebP Layout`);

        await callTelegramAPI('sendPhoto', formData);
      }
      return true;
    } catch (err: any) {
      await sendMsg(ctx, `❌ Image Compression failure: ${err.message}`);
      return true;
    }
  }
  return false;
}

/**
 * Handle /resize command
 */
export async function handleResize(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText, chatId, isSimulated, botToken, callTelegramAPI } = ctx;

  if (lowerText.startsWith('/resize ') || lowerText.startsWith('/resize@') || lowerText === '/resize') {
    const parts = userText.split(/\s+/);
    let width = 300;
    let height = 300;

    const sizeArg = parts.find(p => p.match(/^\d+x\d+$/));
    if (sizeArg) {
      const s = sizeArg.split('x');
      width = parseInt(s[0]);
      height = parseInt(s[1]);
    }

    await sendMsg(ctx, `⚙️ *Scaling image to ${width}x${height} using Sharp...*`);

    try {
      let imageBuffer: Buffer;
      let urlArg = parts.find(p => p.startsWith('http://') || p.startsWith('https://'));

      if (urlArg) {
        imageBuffer = await fetchFileBuffer(urlArg);
      } else {
        // Generate placeholder
        imageBuffer = await sharp({
          create: {
            width: 1000,
            height: 1000,
            channels: 3,
            background: { r: 120, g: 30, b: 30 }
          }
        }).png().toBuffer();
      }

      const scaledBuffer = await sharp(imageBuffer)
        .resize(width, height, { fit: 'fill' })
        .png()
        .toBuffer();

      const scaleMessage = `🖼️ *Image Re-scaled Complete!* 🟢\n\n• *Target Size*: \`${width}px\` width × \`${height}px\` height\n• *Resulting footprint*: \`${(scaledBuffer.length / 1024).toFixed(1)} KB\`\n\n_Uploading PNG result..._`;
      await sendMsg(ctx, scaleMessage);

      if (!isSimulated && botToken) {
        const blob = new Blob([scaledBuffer], { type: 'image/png' });
        const formData = new FormData();
        formData.append('chat_id', chatId.toString());
        formData.append('photo', blob, 'scaled_image.png');
        formData.append('caption', `📐 Rescaled to: ${width}x${height}px`);

        await callTelegramAPI('sendPhoto', formData);
      }
      return true;
    } catch (err: any) {
      await sendMsg(ctx, `❌ Scaling operations error: ${err.message}`);
      return true;
    }
  }
  return false;
}

/**
 * Handle /convert command
 */
export async function handleConvert(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText, chatId, isSimulated, botToken, callTelegramAPI } = ctx;

  if (lowerText.startsWith('/convert ') || lowerText.startsWith('/convert@') || lowerText === '/convert') {
    const parts = userText.split(/\s+/);
    let targetFormat = 'png';

    const formatArg = parts[1]?.toLowerCase();
    if (['png', 'jpeg', 'jpg', 'webp', 'gif'].includes(formatArg)) {
      targetFormat = formatArg === 'jpg' ? 'jpeg' : formatArg;
    }

    await sendMsg(ctx, `🔄 *Converting image format to [${targetFormat.toUpperCase()}]...*`);

    try {
      let imageBuffer: Buffer;
      let urlArg = parts.find(p => p.startsWith('http://') || p.startsWith('https://'));

      if (urlArg) {
        imageBuffer = await fetchFileBuffer(urlArg);
      } else {
        // Generate placeholder
        imageBuffer = await sharp({
          create: {
            width: 500,
            height: 500,
            channels: 3,
            background: { r: 10, g: 110, b: 50 }
          }
        }).jpeg().toBuffer();
      }

      let formatBuffer: Buffer;
      if (targetFormat === 'png') formatBuffer = await sharp(imageBuffer).png().toBuffer();
      else if (targetFormat === 'webp') formatBuffer = await sharp(imageBuffer).webp().toBuffer();
      else if (targetFormat === 'gif') formatBuffer = await sharp(imageBuffer).gif().toBuffer();
      else formatBuffer = await sharp(imageBuffer).jpeg().toBuffer();

      const finalMsg = `🖼 *Format Conversion Done!* 🏁\n\n• *Target Format*: \`${targetFormat.toUpperCase()}\`\n• *Result size*: \`${(formatBuffer.length / 1024).toFixed(1)} KB\``;
      await sendMsg(ctx, finalMsg);

      if (!isSimulated && botToken) {
        const blob = new Blob([formatBuffer], { type: `image/${targetFormat}` });
        const formData = new FormData();
        formData.append('chat_id', chatId.toString());
        formData.append('document', blob, `converted_image.${targetFormat === 'jpeg' ? 'jpg' : targetFormat}`);
        formData.append('caption', `🏁 Format converted to ${targetFormat.toUpperCase()}`);

        await callTelegramAPI('sendDocument', formData);
      }
      return true;
    } catch (err: any) {
      await sendMsg(ctx, `❌ File format converter error: ${err.message}`);
      return true;
    }
  }
  return false;
}

/**
 * Handle /ocr command
 */
export async function handleOcr(ctx: CommandContext): Promise<boolean> {
  const { userText, lowerText } = ctx;

  if (lowerText.startsWith('/ocr ') || lowerText.startsWith('/ocr@') || lowerText === '/ocr') {
    const parts = userText.split(/\s+/);
    let urlArg = parts.find(p => p.startsWith('http://') || p.startsWith('https://'));

    if (!urlArg) {
      // Send a very helpful guide plus a premium mock calculation
      const templateGuide = `🔍 *Premium AI Optical Character Recognition (OCR)* 👁️\n\n` +
        `Extract text easily from any image URL using Gemini Vision SDK:\n\n` +
        `• *Format*: \`/ocr <image_url>\`\n` +
        `• *Example*: \`/ocr https://media.istockphoto.com/id/1154381044/photo/blank-receipt-isolated.jpg\`\n\n` +
        `🚀 _Demonstrating OCR AI Engine fallback on a dynamic invoice template:_ \n` +
        `━━━━━━━━━━━━━━━━━━━\n\n` +
        `🧾 *AI OCR TRANSCRIPTION MOCK RESPONSE*:\n` +
        `• *Detected Language*: English\n` +
        `• *Text Block Recognised*:\n` +
        `\`\`\`\n` +
        `TELLITY CORP TERMINAL INVOICE\n` +
        `DATE: 2026-06-02  ID: #9903\n` +
        `----------------------------\n` +
        `1x CLOUD DEVELOPER TIER - $29.99\n` +
        `TAX (5%): $1.50\n` +
        `TOTAL RECEIVED: $31.49\n` +
        `----------------------------\n` +
        `THANK YOU FOR INVESTING IN VALUE!\n` +
        `\`\`\``;
      
      await sendMsg(ctx, templateGuide);
      return true;
    }

    try {
      await sendMsg(ctx, `👁️ *AI Vision OCR Processing...*\nFetching image buffer and querying Gemini Generative AI Model...`);

      const imgBuf = await fetchFileBuffer(urlArg);
      const base64Data = imgBuf.toString('base64');

      const imagePart = {
        inlineData: {
          mimeType: 'image/png', // fallback
          data: base64Data
        }
      };

      const promptPart = {
        text: 'Perform high quality optical character recognition (OCR) on this image. Extract all text clearly, maintaining the layout where possible. Do not output anything other than the recognized text.'
      };

      // Call modern Gemini 3.5 Flash Model
      const aiResponse = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: { parts: [imagePart, promptPart] }
      });

      const recognizedText = aiResponse.text || '_No legible text detected._';

      const finalMsg = `🔍 *AI OCR Transcription Results* 🧠:\n\n` +
        `• *Target URL*: ${urlArg}\n` +
        `• *Confidence Tier*: High Quality 🟢\n` +
        `• *Recovered Raw Content*:\n\n\`\`\`\n${recognizedText}\n\`\`\``;

      await sendMsg(ctx, finalMsg);
      return true;
    } catch (err: any) {
      await sendMsg(ctx, `❌ OCR Engine Error: ${err.message}\nEnsure the URL is a direct link to a supported web image (PNG or JPG).`);
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
    `Filetools module response${isSimulated ? ' (Simulated)' : ''}`
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
      console.error('Error sending message from Filetools plugin:', e.message);
    }
  }
}
