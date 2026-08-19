import OneSignal from 'react-onesignal';

export function linkUser(userId: string) {
  return OneSignal.login(userId);
}

export function unlinkUser() {
  return OneSignal.logout();
}

export function requestPush(): Promise<boolean> {
  return OneSignal.Notifications.requestPermission();
}

export function isPushSupported(): boolean {
  return OneSignal.Notifications.isPushSupported();
}

export function isPushGranted(): boolean {
  return OneSignal.Notifications.permission;
}
