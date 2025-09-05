import { useAuth } from "./useAuth";

export function useAdmin() {
  const { user, isLoading } = useAuth();
  
  // Check if current user is admin based on their Telegram ID
  // In development mode, allow test user to be admin
  const isAdmin = (user as any)?.id === "6653616672" || 
                  ((user as any)?.id === "123456789" && import.meta.env.DEV);
  
  return {
    isAdmin,
    isLoading,
    user
  };
}