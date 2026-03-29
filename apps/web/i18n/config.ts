export const locales = ['en', 'am', 'sw', 'ar', 'fr', 'or', 'sm', 'tg'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeLabels: Record<Locale, string> = {
  en: 'English',
  am: 'አማርኛ', // Amharic
  sw: 'Kiswahili', // Swahili
  ar: 'العربية', // Arabic
  fr: 'Français', // French
  or: 'Afaan Oromoo', // Oromo
  sm: 'Soomaali', // Somali
  tg: 'ትግርኛ', // Tigrinya
};
