'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import OneSignal from 'react-onesignal';

export default function OneSignalProvider() {
  const router = useRouter();

  useEffect(() => {
    OneSignal.init({
      appId: '518b5974-bbf8-4fbf-8c0c-4e434a2f49eb',
    });

    // Read by send-push/index.ts, which attaches class_id/class_name/
    // is_teacher as the notification's data — jump straight to the class
    // instead of leaving the tab on whatever page it already had open.
    OneSignal.Notifications.addEventListener('click', (event) => {
      const data = event.notification.additionalData as Record<string, unknown> | undefined;
      const classId = data?.class_id as string | undefined;
      if (classId) router.push(`/classes/${classId}`);
    });
  }, [router]);

  return null;
}
