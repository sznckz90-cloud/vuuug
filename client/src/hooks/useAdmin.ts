import { useAuth } from "./useAuth";

export function useAdmin() {
  const { user, isLoading } = useAuth();
  
  // Check if current user is admin based on their Telegram ID
  const isAdmin = (user as any)?.id === "6653616672";
  
  return {
    isAdmin,
    isLoading,
    user
  };
}