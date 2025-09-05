import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Function to get Telegram WebApp initData
const getTelegramInitData = (): string | null => {
  if (typeof window !== 'undefined') {
    // First try to get from Telegram WebApp
    if (window.Telegram?.WebApp?.initData) {
      console.log('✅ Telegram WebApp initData found:', window.Telegram.WebApp.initData.substring(0, 50) + '...');
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

// Function to authenticate with Telegram
const authenticateWithTelegram = async (initData: string) => {
  const response = await fetch('/api/auth/telegram', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ initData }),
  });
  
  if (!response.ok) {
    throw new Error('Telegram authentication failed');
  }
  
  return response.json();
};

export function useAuth() {
  const queryClient = useQueryClient();
  
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  const telegramAuthMutation = useMutation({
    mutationFn: authenticateWithTelegram,
    onSuccess: (userData) => {
      // Update the user query cache with the authenticated user
      queryClient.setQueryData(["/api/auth/user"], userData);
    },
  });

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
