import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";

export type NotificationType = "success" | "error" | "info";

interface NotificationData {
  message: string;
  type?: NotificationType;
  amount?: number;
}

let notificationQueue: NotificationData[] = [];
let isDisplaying = false;
let recentNotifications: Map<string, number> = new Map();

const DUPLICATE_PREVENTION_WINDOW = 2000; // 2 seconds

export default function AppNotification() {
  const [isVisible, setIsVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [type, setType] = useState<NotificationType>("success");

  const showNextNotification = () => {
    if (notificationQueue.length === 0 || isDisplaying) {
      return;
    }

    isDisplaying = true;
    const notification = notificationQueue.shift()!;
    
    setMessage(notification.message);
    setType(notification.type || "success");
    setIsVisible(true);

    setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        isDisplaying = false;
        showNextNotification();
      }, 300);
    }, 2000);
  };

  useEffect(() => {
    const handleNotification = (event: CustomEvent<NotificationData>) => {
      const { message: msg, type: notifType, amount } = event.detail;
      
      let finalMessage = msg;
      if (amount !== undefined) {
        finalMessage = `${msg} +${formatCurrency(amount, false)}`;
      }
      
      // Check for duplicate notification
      const notificationKey = `${finalMessage}-${notifType}`;
      const now = Date.now();
      const lastShown = recentNotifications.get(notificationKey);
      
      if (lastShown && (now - lastShown) < DUPLICATE_PREVENTION_WINDOW) {
        // Skip duplicate notification within the prevention window
        return;
      }
      
      // Track this notification
      recentNotifications.set(notificationKey, now);
      
      // Clean up old entries (older than 5 seconds)
      for (const [key, timestamp] of Array.from(recentNotifications.entries())) {
        if (now - timestamp > 5000) {
          recentNotifications.delete(key);
        }
      }
      
      notificationQueue.push({ message: finalMessage, type: notifType });
      showNextNotification();
    };

    window.addEventListener('appNotification', handleNotification as EventListener);
    
    return () => {
      window.removeEventListener('appNotification', handleNotification as EventListener);
    };
  }, []);

  if (!isVisible) return null;

  const getBackgroundColor = () => {
    switch (type) {
      case "success":
        return "bg-gradient-to-r from-purple-600 to-purple-500";
      case "error":
        return "bg-gradient-to-r from-red-600 to-red-500";
      case "info":
        return "bg-gradient-to-r from-blue-600 to-blue-500";
      default:
        return "bg-gradient-to-r from-purple-600 to-purple-500";
    }
  };

  const getIcon = () => {
    switch (type) {
      case "success":
        return "✓";
      case "error":
        return "✕";
      case "info":
        return "ℹ";
      default:
        return "✓";
    }
  };

  return (
    <div 
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-4 py-3 rounded-xl shadow-2xl ${getBackgroundColor()} text-white font-medium text-sm flex items-center gap-2 animate-slideDown max-w-[90vw]`}
      style={{
        animation: isVisible ? "slideDown 0.3s ease-out" : "slideUp 0.3s ease-out"
      }}
    >
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20 flex-shrink-0">
        {getIcon()}
      </div>
      <span className="whitespace-nowrap">{message}</span>
    </div>
  );
}

export function showNotification(message: string, type: NotificationType = "success", amount?: number) {
  const event = new CustomEvent('appNotification', { 
    detail: { message, type, amount } 
  });
  window.dispatchEvent(event);
}
