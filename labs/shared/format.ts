// Números y duraciones con el formato del idioma de la página (es-MX o en-US).

export type Lang = 'es' | 'en';

const LOCALES: Record<Lang, string> = { es: 'es-MX', en: 'en-US' };

/** Idioma de la página según `<html lang>`: inglés si empieza con "en"; si no, español. */
export function pageLang(htmlLang: string = document.documentElement.lang): Lang {
  return htmlLang.toLowerCase().startsWith('en') ? 'en' : 'es';
}

/** Número con separador de miles: 1234567 → "1,234,567" (igual en es-MX y en-US). */
export function formatNumber(value: number, lang: Lang, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(LOCALES[lang], { maximumFractionDigits }).format(value);
}

/** Duración simulada: con decimales por debajo de 1 ms, en ms hasta un segundo y luego en s. */
export function formatDuration(ms: number, lang: Lang): string {
  if (ms < 1) return `${formatNumber(ms, lang, 2)} ms`;
  if (Math.round(ms) < 1000) return `${formatNumber(ms, lang)} ms`;
  return `${formatNumber(ms / 1000, lang, 1)} s`;
}
