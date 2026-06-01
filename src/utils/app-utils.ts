export type FontOption = 'sans' | 'space' | 'outfit' | 'playfair' | 'mono';

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function getFontClass(font: FontOption): string {
  if (font === 'space') return 'font-space';
  if (font === 'outfit') return 'font-outfit';
  if (font === 'playfair') return 'font-playfair';
  if (font === 'mono') return 'font-mono';
  return 'font-sans';
}
