import { useContext } from "react";
import { AuthContext, AuthContextValue } from "../contexts/AuthContext";

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}

export type { AuthContextValue, User } from "../contexts/AuthContext";
