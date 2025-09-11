import { useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

interface WebSocketMessage {
  type: string;
  message?: string;
  amount?: string;
  timestamp?: string;
  data?: any;
}

export function useWebSocket() {
  const { user } = useAuth() as { user: any };
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSessionToken = async (): Promise<string | null> => {
    try {
      const response = await fetch('/api/auth/session-token', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        console.error('Failed to fetch session token:', response.status);
        return null;
      }
      
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
              toast({
                title: "Connection Error",
                description: "Failed to authenticate real-time connection",
                variant: "destructive"
              });
              break;
              
            case 'ad_reward':
              toast({
                title: "Ad Reward Earned! 💰",
                description: `You earned $${message.amount}`,
              });
              break;
              
            case 'withdrawal_requested':
              toast({
                title: "Withdrawal Requested ⏳", 
                description: `Withdrawal of $${message.amount} submitted`,
              });
              break;
              
            case 'withdrawal_approved':
              toast({
                title: "Withdrawal Approved! ✅",
                description: `Your withdrawal of $${message.amount} has been approved`,
              });
              break;
              
            case 'referral_bonus':
              toast({
                title: "Referral Bonus! 🎉",
                description: `You earned $${message.amount} from a referral`,
              });
              break;
              
            default:
              if (message.message) {
                toast({
                  title: "Update",
                  description: message.message,
                });
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