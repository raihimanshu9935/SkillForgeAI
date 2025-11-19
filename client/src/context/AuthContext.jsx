import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // prevent UI flicker

  // ✅ Utility — safe JWT decode function
  const decodeJWT = (token) => {
    try {
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      return JSON.parse(jsonPayload);
    } catch (err) {
      console.error("❌ JWT decode failed:", err);
      return null;
    }
  };

  /* ---------------------------------------------
     🔄 Auto-Login on Refresh or OAuth Redirect
  --------------------------------------------- */
  useEffect(() => {
    const savedUser = localStorage.getItem("skillforge_user");
    const savedToken = localStorage.getItem("token");

    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setLoading(false);
        return;
      } catch {
        console.warn("⚠️ Invalid saved user data");
      }
    }

    // 🧩 Handle GitHub redirect with ?token=...
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");

    if (token) {
      localStorage.setItem("token", token);
      const payload = decodeJWT(token);
      if (payload) {
        const newUser = { id: payload.id, email: payload.email, token };
        localStorage.setItem("skillforge_user", JSON.stringify(newUser));
        setUser(newUser);

        // 🧭 Clean up URL after login
        window.history.replaceState({}, "", "/dashboard");
      }
    } else if (savedToken) {
      // 🧠 Rehydrate user from saved token
      const payload = decodeJWT(savedToken);
      if (payload) {
        setUser({ id: payload.id, email: payload.email, token: savedToken });
      }
    }

    setLoading(false);
  }, []);

  /* ---------------------------------------------
     🟢 Login Function
  --------------------------------------------- */
  const login = (userData) => {
    localStorage.setItem("skillforge_user", JSON.stringify(userData));
    if (userData.token) localStorage.setItem("token", userData.token);
    setUser(userData);
  };

  /* ---------------------------------------------
     🔴 Logout Function
  --------------------------------------------- */
  const logout = () => {
    localStorage.removeItem("skillforge_user");
    localStorage.removeItem("token");
    setUser(null);
  };

  /* ---------------------------------------------
     🕐 Loading Screen while restoring session
  --------------------------------------------- */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 text-gray-600 font-medium">
        Restoring your session...
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);



