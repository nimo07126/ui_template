/** Languages the picker offers and the sample message with its translations. */

export type AiTranslateLanguageCode = "en" | "de" | "fr" | "es" | "ja" | "pt";

export interface AiTranslateLanguage {
  code: AiTranslateLanguageCode;
  /** Name in the language itself, shown in the picker. */
  native: string;
  /** English name, used for status lines and the detected chip. */
  english: string;
}

export const aiTranslateLanguages: AiTranslateLanguage[] = [
  { code: "en", native: "English", english: "English" },
  { code: "de", native: "Deutsch", english: "German" },
  { code: "fr", native: "Français", english: "French" },
  { code: "es", native: "Español", english: "Spanish" },
  { code: "ja", native: "日本語", english: "Japanese" },
  { code: "pt", native: "Português", english: "Portuguese" },
];

export const languageByCode = (code: AiTranslateLanguageCode) => aiTranslateLanguages.find(language => language.code === code) ?? aiTranslateLanguages[0];

/** A release note from a mobile lead in Lyon, written in French, with one aligned translation per language. */
export const aiTranslateSample = {
  author: { name: "Chloé Nguyen", role: "Mobile lead, Lyon", avatar: "/media/people/chloe-nguyen.svg" },
  timestamp: "Oct 27, 09:14",
  sourceLanguage: "fr" as AiTranslateLanguageCode,
  text: "Bonjour à toute l'équipe ! La version 4.2 de l'app iOS est partie en revue chez Apple hier soir, avec le nouveau mode hors ligne. Les premiers retours de la bêta sont très bons : la synchronisation passe de 9 à 3 secondes en moyenne. Pouvez-vous vérifier les traductions des écrans de paiement avant jeudi ? Merci d'avance, et bravo pour ce sprint.",
  translations: {
    en: "Hi everyone! Version 4.2 of the iOS app went into Apple review last night, with the new offline mode. Early beta feedback is very good: sync time drops from 9 to 3 seconds on average. Could you check the translations on the payment screens before Thursday? Thanks in advance, and great work on this sprint.",
    de: "Hallo zusammen! Version 4.2 der iOS-App ist gestern Abend mit dem neuen Offline-Modus in die Prüfung bei Apple gegangen. Die ersten Rückmeldungen aus der Beta sind sehr gut: Die Synchronisierung dauert im Schnitt nur noch 3 statt 9 Sekunden. Könnt ihr die Übersetzungen der Bezahlbildschirme bis Donnerstag prüfen? Danke im Voraus und großartige Arbeit in diesem Sprint.",
    es: "¡Hola a todo el equipo! La versión 4.2 de la app de iOS entró anoche en revisión de Apple, con el nuevo modo sin conexión. Los primeros comentarios de la beta son muy buenos: la sincronización baja de 9 a 3 segundos de media. ¿Podéis revisar las traducciones de las pantallas de pago antes del jueves? Gracias de antemano, y enhorabuena por este sprint.",
    ja: "チームの皆さん、こんにちは！iOSアプリのバージョン4.2を、新しいオフラインモードと一緒に昨夜Appleの審査に提出しました。ベータ版の初期フィードバックはとても好評で、同期時間は平均9秒から3秒に短縮されています。木曜日までに決済画面の翻訳を確認していただけますか？いつもありがとうございます、今回のスプリントもお疲れさまでした。",
    pt: "Olá a todos! A versão 4.2 do app para iOS entrou ontem à noite na revisão da Apple, com o novo modo offline. Os primeiros comentários da beta são muito bons: a sincronização caiu de 9 para 3 segundos, em média. Vocês podem revisar as traduções das telas de pagamento até quinta-feira? Obrigada desde já, e parabéns por este sprint.",
  } as Partial<Record<AiTranslateLanguageCode, string>>,
};

/* Light stopword detection for the six languages, used only when no sourceLanguage is passed. */
const stopwords: Record<Exclude<AiTranslateLanguageCode, "ja">, string[]> = {
  en: ["the", "and", "is", "you", "of", "to", "with", "for", "this", "that", "on"],
  de: ["der", "die", "das", "und", "ist", "nicht", "mit", "ihr", "für", "zu", "sind", "auf"],
  fr: ["le", "la", "les", "et", "est", "pour", "avec", "une", "des", "vous", "de", "ce"],
  es: ["el", "la", "los", "las", "y", "es", "para", "con", "una", "del", "por", "este"],
  pt: ["o", "a", "os", "as", "e", "é", "para", "com", "uma", "do", "da", "não", "este"],
};

export function detectLanguage(text: string): AiTranslateLanguageCode {
  if (/[぀-ヿ一-龯]/.test(text)) return "ja";
  const words = text.toLowerCase().match(/[\p{L}']+/gu) ?? [];
  let best: AiTranslateLanguageCode = "en", bestScore = 0;
  for (const [code, list] of Object.entries(stopwords) as [Exclude<AiTranslateLanguageCode, "ja">, string[]][]) {
    const score = words.filter(word => list.includes(word)).length;
    if (score > bestScore) { best = code; bestScore = score; }
  }
  return best;
}

/** Splits text into sentences and keeps each sentence's trailing space, so joining them restores the text exactly. "4.2" stays whole. */
export function splitSentences(text: string): string[] {
  return text.match(/[\s\S]+?(?:[.!?…]+["'»”’)]*(?=\s|$)|[。！？]+|$)\s*/g)?.filter(Boolean) ?? [];
}

/** How many sentences of a streaming text are already complete. */
export const completedSentences = (text: string) => (text.match(/[.!?…]+["'»”’)]*(?=\s)|[。！？]+/g) ?? []).length;

/** Breaks a finished translation into stream chunks: 3 to 6 words, or about 10 characters for scripts without spaces. */
export function chunkText(text: string): string[] {
  const pattern = [4, 3, 5, 6, 4, 5, 3, 6];
  if (!/\s/.test(text.trim()) || /[぀-ヿ一-龯]/.test(text)) {
    const chunks: string[] = [];
    for (let index = 0, step = 0; index < text.length; step++) {
      const size = pattern[step % pattern.length] * 2 + 2;
      chunks.push(text.slice(index, index + size));
      index += size;
    }
    return chunks;
  }
  const words = text.match(/\S+\s*/g) ?? [];
  const chunks: string[] = [];
  for (let index = 0, step = 0; index < words.length; step++) {
    const size = pattern[step % pattern.length];
    chunks.push(words.slice(index, index + size).join(""));
    index += size;
  }
  return chunks;
}
