'use client';
import { useState, useEffect } from 'react';
import { getSettings } from './storage';
import { translations, type Translations } from './i18n';

export function useTranslation(): Translations {
  const [t, setT] = useState<Translations>(translations.en);

  useEffect(() => {
    const lang = getSettings().uiLanguage ?? 'en';
    setT(translations[lang as 'en' | 'uz'] ?? translations.en);
  }, []);

  return t;
}
