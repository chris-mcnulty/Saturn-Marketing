import React, { createContext, useContext, useEffect } from "react";
import { useGetMe, AuthResponse, Market } from "@workspace/api-client-react";
import { useLocation } from "wouter";

interface AuthContextType {
  user: AuthResponse["user"] | null;
  tenant: AuthResponse["tenant"] | null;
  markets: Market[];
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  tenant: null,
  markets: [],
  isLoading: true,
  isAuthenticated: false,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [location, setLocation] = useLocation();
  const { data, isLoading, error } = useGetMe({
    query: {
      retry: false,
      staleTime: 5 * 60 * 1000,
    },
  });

  const isAuthRoute = location === "/login" || location === "/register";

  useEffect(() => {
    if (!isLoading) {
      if (error && !isAuthRoute) {
        setLocation("/login");
      } else if (data && isAuthRoute) {
        setLocation("/");
      }
    }
  }, [isLoading, error, data, location, setLocation, isAuthRoute]);

  return (
    <AuthContext.Provider
      value={{
        user: data?.user || null,
        tenant: data?.tenant || null,
        markets: data?.markets || [],
        isLoading,
        isAuthenticated: !!data,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
