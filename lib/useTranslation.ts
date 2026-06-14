'use client';
import { useState, useLayoutEffect } from 'react';
import { getSettings } from './storage';
import { translations, type Translations } from './i18n';

function getLang(): 'en' | 'uz' {
  return (getSettings().uiLanguage as 'en' | 'uz') ?? 'en';
}

export function useTranslation(): Translations {
  const [t, setT] = useState<Translations>(translations.en);

  useLayoutEffect(() => {
    const update = () => setT(translations[getLang()] ?? translations.en);
    update();
    window.addEventListener('lexivo-lang-change', update);
    window.addEventListener('lexivo-sync', update);
    return () => {
      window.removeEventListener('lexivo-lang-change', update);
      window.removeEventListener('lexivo-sync', update);
    };
  }, []);

  return t;
}
