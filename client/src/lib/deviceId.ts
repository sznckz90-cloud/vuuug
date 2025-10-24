export function generateDeviceId(): string {
  const storageKey = 'device_id';
  
  let deviceId = localStorage.getItem(storageKey);
  
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(storageKey, deviceId);
  }
  
  return deviceId;
}

export function getDeviceFingerprint() {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

export function setupDeviceTracking() {
  const deviceId = generateDeviceId();
  const fingerprint = getDeviceFingerprint();
  
  return {
    deviceId,
    fingerprint
  };
}
