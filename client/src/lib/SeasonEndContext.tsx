import { createContext, useContext } from "react";

interface SeasonEndContextType {
  showSeasonEnd: boolean;
}

export const SeasonEndContext = createContext<SeasonEndContextType>({
  showSeasonEnd: false,
});

export function useSeasonEnd() {
  return useContext(SeasonEndContext);
}
