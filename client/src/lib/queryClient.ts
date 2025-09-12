import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Helper function to get Telegram data with enhanced detection
const getTelegramInitData = (): string | null => {
  if (typeof window !== 'undefined') {
    // First try to get from Telegram WebApp
    if (window.Telegram?.WebApp?.initData) {
      const initData = window.Telegram.WebApp.initData;
      if (initData && initData.trim() !== '') {
        console.log('✅ Found Telegram WebApp initData:', initData.substring(0, 50) + '...');
        console.log('🔐 Telegram WebApp Info:', {
          version: (window.Telegram.WebApp as any).version,
          platform: (window.Telegram.WebApp as any).platform,
          isExpanded: (window.Telegram.WebApp as any).isExpanded,
          viewportHeight: (window.Telegram.WebApp as any).viewportHeight,
          colorScheme: (window.Telegram.WebApp as any).colorScheme
        });
        return initData;
      }
    }
    
    // Check if we're in Telegram environment but initData is missing
    if (window.Telegram?.WebApp) {
      console.warn('⚠️ Telegram WebApp detected but initData is empty');
      console.log('🔍 WebApp state:', {
        initData: window.Telegram.WebApp.initData,
        initDataUnsafe: window.Telegram.WebApp.initDataUnsafe,
        version: (window.Telegram.WebApp as any).version,
        ready: typeof window.Telegram.WebApp.ready === 'function'
      });
    } else {
      console.log('❌ No Telegram WebApp object found');
      console.log('🔍 Environment info:', {
        userAgent: navigator.userAgent,
        hasTelegram: !!window.Telegram,
        location: window.location.href,
        isLocalhost: window.location.hostname === 'localhost',
        isReplit: window.location.hostname.includes('replit')
      });
    }
    
    // Fallback: try to get from URL params (for testing)
    const urlParams = new URLSearchParams(window.location.search);
    const tgData = urlParams.get('tgData');
    if (tgData) {
      console.log('✅ Found Telegram data from URL params (testing mode)');
      return tgData;
    }
    
    // Check for development environment and inform about dev mode
    if (window.location.hostname === 'localhost' || window.location.hostname.includes('replit')) {
      console.log('🔧 Development environment detected - backend will use development mode authentication');
      console.log('ℹ️ In development, authentication bypasses Telegram requirements');
    } else {
      console.log('❌ Production environment: Telegram WebApp authentication required');
    }
  }
  return null;
};

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {};
  
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  // Add Telegram authentication data to headers
  const telegramData = getTelegramInitData();
  if (telegramData) {
    headers["x-telegram-data"] = telegramData;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers: Record<string, string> = {};
    
    // Add Telegram authentication data to headers for queries too
    const telegramData = getTelegramInitData();
    if (telegramData) {
      headers["x-telegram-data"] = telegramData;
    }

    const res = await fetch(queryKey.join("/") as string, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
