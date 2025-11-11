import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    try {
      const json = JSON.parse(text);
      throw new Error(json.message || text);
    } catch (parseError) {
      throw new Error(text);
    }
  }
}

// Helper function to get Telegram data with proper WebApp detection
const getTelegramInitData = (): string | null => {
  if (typeof window !== 'undefined') {
    // Check if we're in development environment first
    const hostname = window.location.hostname;
    const isDev = hostname === 'localhost' || 
                  hostname.includes('replit.app') || 
                  hostname.includes('replit.dev') ||
                  hostname.includes('127.0.0.1');
    
    // For development, check URL params fallback
    if (isDev) {
      const urlParams = new URLSearchParams(window.location.search);
      const tgData = urlParams.get('tgData');
      if (tgData) {
        console.log('✅ Found Telegram data from URL params (testing mode)');
        return tgData;
      }
      console.log('🔧 Development environment detected - backend will use development mode authentication');
      console.log('ℹ️ In development, authentication bypasses Telegram requirements');
      return null;
    }
    
    // Production: Strictly require valid Telegram WebApp initData
    if (window.Telegram?.WebApp?.initData) {
      const initData = window.Telegram.WebApp.initData;
      if (initData && initData.trim() !== '') {
        console.log('✅ Found Telegram WebApp initData:', initData.substring(0, 50) + '...');
        console.log('🔐 Telegram WebApp Info:', {
          version: (window.Telegram.WebApp as any).version,
          platform: (window.Telegram.WebApp as any).platform,
          ready: typeof window.Telegram.WebApp.ready === 'function'
        });
        return initData;
      }
    }
    
    // In production, if no valid initData found, log environment info for debugging
    if (window.Telegram?.WebApp) {
      console.warn('⚠️ Telegram WebApp detected but initData is empty - this may require opening in official Telegram app');
      console.log('🔍 WebApp state:', {
        hasInitData: !!window.Telegram.WebApp.initData,
        initDataLength: window.Telegram.WebApp.initData?.length || 0,
        version: (window.Telegram.WebApp as any).version,
        ready: typeof window.Telegram.WebApp.ready === 'function'
      });
    } else {
      console.log('❌ No Telegram WebApp object found - please open this app inside Telegram');
      console.log('🔍 Environment info:', {
        userAgent: navigator.userAgent,
        hasTelegram: !!window.Telegram,
        location: window.location.href
      });
    }
    
    // No valid data found in production
    console.log('❌ Production environment: Valid Telegram WebApp authentication required');
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
  },
});