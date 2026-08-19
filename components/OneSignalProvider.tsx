'use client';
import { useEffect } from 'react';
import OneSignal from 'react-onesignal';

export default function OneSignalProvider() {
  useEffect(() => {
    OneSignal.init({
      appId: '518b5974-bbf8-4fbf-8c0c-4e434a2f49eb',
    });
  }, []);

  return null;
}
