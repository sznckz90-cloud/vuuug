// Telegram integration utilities

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
    chat_type?: string;
    auth_date: number;
    hash: string;
  };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
  };
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  isClosingConfirmationEnabled: boolean;
  headerColor: string;
  backgroundColor: string;
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    show(): void;
    hide(): void;
    enable(): void;
    disable(): void;
    setText(text: string): void;
    onClick(callback: () => void): void;
    offClick(callback: () => void): void;
  };
  BackButton: {
    isVisible: boolean;
    show(): void;
    hide(): void;
    onClick(callback: () => void): void;
    offClick(callback: () => void): void;
  };
  HapticFeedback: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
    selectionChanged(): void;
  };
  ready(): void;
  expand(): void;
  close(): void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp & {
        initDataUnsafe: { user: TelegramUser }
        ready: () => void
        onEvent: (event: string, callback: () => void) => void
      }
    };
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
}

export function getTelegramUser(): TelegramUser {
  const tg = window.Telegram?.WebApp
  if (!tg) {
    throw new Error("Not in Telegram WebApp environment")
  }
  
  const { user } = tg.initDataUnsafe
  if (!user) {
    throw new Error("Telegram user data not found")
  }

  console.log('Retrieved Telegram user:', { id: user.id, username: user.username, first_name: user.first_name });
  
  return {
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name || "",
    username: user.username || "",
    language_code: user.language_code || "en",
    is_premium: user.is_premium || false,
  }
}

export function isTelegramEnvironment(): boolean {
  return !!window.Telegram?.WebApp?.initDataUnsafe?.user
}

// Mock user for development
export function getMockTelegramUser(): TelegramUser {
  return {
    id: Number(import.meta.env.VITE_DEV_TELEGRAM_ID) || 123456789,
    first_name: "Dev",
    last_name: "User",
    username: "dev_user",
    language_code: "en",
    is_premium: false,
  };
}

export function initializeTelegramWebApp(): void {
  const webApp = getTelegramWebApp();
  if (webApp) {
    webApp.ready();
    webApp.expand();
    
    // Set theme colors
    webApp.headerColor = '#000000';
    webApp.backgroundColor = '#000000';
    
    // Configure haptic feedback for better UX
    if (webApp.HapticFeedback) {
      // Add haptic feedback to buttons when needed
    }
  }
}

export function shareToTelegram(message: string, url?: string): void {
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(url || 'https://t.me/LightingSatsBot')}&text=${encodeURIComponent(message)}`;
  
  if (isTelegramEnvironment()) {
    // In Telegram environment, use the native sharing
    window.open(telegramUrl, '_blank');
  } else {
    // Fallback for web browsers
    window.open(telegramUrl, '_blank', 'width=600,height=400');
  }
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  } else {
    // Fallback for older browsers
    return new Promise((resolve, reject) => {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand('copy');
        textArea.remove();
        resolve();
      } catch (error) {
        textArea.remove();
        reject(error);
      }
    });
  }
}
