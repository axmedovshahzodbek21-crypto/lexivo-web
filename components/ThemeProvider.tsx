'use client';
import { useEffect } from 'react';
import { applyStoredTheme } from '@/lib/theme';
import { getSettings } from '@/lib/storage';

export default function ThemeProvider() {
  useEffect(() => {
    applyStoredTheme();
    const { fontSize, reduceMotion } = getSettings();
    if (fontSize !== 'normal') {
      document.documentElement.dataset.fontSize = fontSize;
    }
    if (reduceMotion) {
      document.documentElement.dataset.reduceMotion = 'true';
    }
  }, []);
  return null;
}
