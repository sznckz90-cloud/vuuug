import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

// LocalStorage keys for caching
const AUTH_CACHE_KEY = 'cashwatch_user_cache';
const AUTH_TIMESTAMP_KEY = 'cashwatch_auth_timestamp';

// Function to get Telegram WebApp initData
const getTelegramInitData = (): string | null => {
  if (typeof window !== 'undefined') {
    // First try to get from Telegram WebApp
    if (window.Telegram?.WebApp?.initData) {
      console.log('✅ Telegram WebApp initData found:', window.Telegram.WebApp.initData.substring(0, 30) + '...');
      return window.Telegram.WebApp.initData;
    }
    
    // Fallback: try to get from URL params (for testing)
    const urlParams = new URLSearchParams(window.location.search);
    const tgData = urlParams.get('tgData');
    if (tgData) {
      console.log('✅ Found Telegram data from URL params');
      return tgData;
    }
    
    console.log('⚠️ Telegram WebApp not available or no initData');
  }
  return null;
};

// Get cached user data from localStorage
const getCachedUserData = () => {
  try {
    const cached = localStorage.getItem(AUTH_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.warn('Failed to get cached user data:', error);
  }
  return null;
};

// Save user data to localStorage
const cacheUserData = (userData: any) => {
  try {
    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(userData));
    localStorage.setItem(AUTH_TIMESTAMP_KEY, new Date().toISOString());
  } catch (error) {
    console.warn('Failed to cache user data:', error);
  }
};

// Check if user was recently authenticated (within last 24 hours)
const wasRecentlyAuthenticated = (): boolean => {
  try {
    const timestamp = localStorage.getItem(AUTH_TIMESTAMP_KEY);
    if (!timestamp) return false;
    
    const lastAuth = new Date(timestamp);
    const now = new Date();
    const hoursSinceAuth = (now.getTime() - lastAuth.getTime()) / (1000 * 60 * 60);
    
    return hoursSinceAuth < 24; // Consider recent if within 24 hours
  } catch (error) {
    return false;
  }
};

// Function to authenticate with Telegram
const authenticateWithTelegram = async (initData: string) => {
  console.log('📨 Telegram initData received:', initData?.slice(0, 30) + '...');
  
  const response = await fetch('/api/auth/telegram', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ initData }),
  });
  
  console.log(`📡 Auth response status: ${response.status}`);
  
  if (!response.ok) {
    throw new Error('Telegram authentication failed');
  }
  
  const data = await response.json();
  console.log('✅ Authentication successful for user:', data.id);
  return data;
};

export function useAuth() {
  const queryClient = useQueryClient();
  const hasAttemptedAuth = useRef(false);
  
  // Try to use cached data first for instant loading
  const cachedData = getCachedUserData();
  
  const { data: user, isLoading, isFetched, isInitialData } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    // Use cached data as initial data for instant rendering
    initialData: cachedData,
    // CRITICAL FIX: Always refetch from database on mount to ensure fresh data
    refetchOnMount: true,
    // Force refetch to ensure we always get fresh data from database
    staleTime: 0,
  });

  // Update localStorage cache ONLY when data comes from successful server fetch (not from initialData)
  useEffect(() => {
    // Only cache if data was fetched from server (not initial cached data)
    if (user && isFetched && !isLoading && !isInitialData) {
      cacheUserData(user);
    }
  }, [user, isLoading, isFetched, isInitialData]);

  const telegramAuthMutation = useMutation({
    mutationFn: authenticateWithTelegram,
    onSuccess: (userData) => {
      console.log('✅ User authenticated successfully:', userData.username || userData.id);
      // Update the user query cache with the authenticated user
      queryClient.setQueryData(["/api/auth/user"], userData);
      // Cache user data for offline/quick loading
      cacheUserData(userData);
    },
    onError: (error) => {
      console.error('❌ Authentication error:', error);
      // Don't block the app - user is already in Telegram WebApp
    },
  });

  // One-time authentication on first app load
  useEffect(() => {
    // Skip if already attempted authentication
    if (hasAttemptedAuth.current) {
      return;
    }
    
    // Initialize Telegram WebApp
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      console.log('🚀 Telegram WebApp initialized');
    }
    
    // Attempt authentication once
    const initData = getTelegramInitData();
    if (initData) {
      console.log('🔐 Performing one-time Telegram authentication...');
      hasAttemptedAuth.current = true;
      
      // Don't await - let it run in background
      telegramAuthMutation.mutate(initData);
    } else {
      console.log('ℹ️ No Telegram initData - will use backend session if available');
      hasAttemptedAuth.current = true;
    }
  }, []); // Run once on mount

  const authenticateWithTelegramWebApp = () => {
    const initData = getTelegramInitData();
    if (initData) {
      telegramAuthMutation.mutate(initData);
    } else {
      console.error('Telegram WebApp initData not available');
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    authenticateWithTelegramWebApp,
    isTelegramAuthenticating: telegramAuthMutation.isPending,
    telegramAuthError: telegramAuthMutation.error,
  };
}
