import { useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { showNotification } from '@/components/AppNotification';
import { apiRequest } from '@/lib/queryClient';
import { useQueryClient } from '@tanstack/react-query';

interface WebSocketMessage {
  type: string;
  message?: string;
  amount?: string;
  timestamp?: string;
  data?: any;
}

export function useWebSocket() {
  const { user } = useAuth() as { user: any };
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSessionToken = async (): Promise<string | null> => {
    try {
      const response = await apiRequest('GET', '/api/auth/session-token');
      const data = await response.json();
      return data.sessionToken;
    } catch (error) {
      console.error('Error fetching session token:', error);
      return null;
    }
  };

  const connect = async () => {
    if (!user?.id) return;

    // Fetch session token before connecting
    const sessionToken = await fetchSessionToken();
    if (!sessionToken) {
      console.error('❌ Failed to obtain session token, cannot connect WebSocket');
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('🔌 WebSocket connected');
        setIsConnected(true);
        
        // Authenticate with session token
        ws.send(JSON.stringify({
          type: 'auth',
          sessionToken: sessionToken
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setMessages(prev => [...prev.slice(-9), message]); // Keep last 10 messages

          // Handle different message types
          switch (message.type) {
            case 'connected':
              // Silently handle connection confirmation without showing toast
              console.log('✅ WebSocket authenticated successfully');
              break;
              
            case 'auth_error':
              console.error('❌ WebSocket authentication error:', message.message);
              showNotification("⚠️ Connection error", "error");
              break;
              
            case 'ad_reward':
              showNotification("🎉 Reward added!", "success", parseFloat(message.amount || '0'));
              break;
              
            case 'withdrawal_requested':
              showNotification("⏳ Withdrawal requested", "info");
              break;
              
            case 'withdrawal_approved':
              showNotification("✅ Withdrawal approved!", "success");
              // Invalidate withdrawal queries to update UI immediately
              queryClient.invalidateQueries({ queryKey: ['/api/withdrawals'] });
              queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
              queryClient.invalidateQueries({ queryKey: ['/api/user/stats'] });
              break;
              
            case 'withdrawal_rejected':
              showNotification("❌ Withdrawal rejected", "error");
              // Invalidate withdrawal queries to update UI immediately
              queryClient.invalidateQueries({ queryKey: ['/api/withdrawals'] });
              queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
              queryClient.invalidateQueries({ queryKey: ['/api/user/stats'] });
              break;
              
            case 'referral_bonus':
              showNotification("🎉 Referral bonus!", "success", parseFloat(message.amount || '0'));
              break;
              
            case 'balance_update':
              showNotification("🎉 Balance updated!", "success", parseFloat((message as any).delta || message.amount || '0'));
              break;
              
            case 'promotion_approved':
              showNotification("✅ Promotion approved!", "success");
              break;
              
            case 'promotion_rejected':
              showNotification("❌ Promotion rejected", "error");
              break;
              
            case 'task_deleted':
              showNotification("🗑️ Task deleted", "error");
              break;
              
            case 'task_removed':
              // Broadcast event for real-time task list updates
              const taskRemovedEvent = new CustomEvent('taskRemoved', { 
                detail: { promotionId: (message as any).promotionId } 
              });
              window.dispatchEvent(taskRemovedEvent);
              break;
              
            default:
              // Remove default black notifications to prevent duplicates
              // Only log unhandled messages for debugging
              if (message.message) {
                console.log('📬 Unhandled WebSocket message:', message);
              }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        setIsConnected(false);
        
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setIsConnected(false);
      };
    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
    }
  };

  useEffect(() => {
    if (user?.id) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [user?.id]);

  const sendMessage = (message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  return {
    isConnected,
    messages,
    sendMessage
  };
}