import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const { login, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // 🧩 JWT Decoder (safe Base64URL)
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
    } catch {
      return null;
    }
  };

  // ⚙️ Handle GitHub Redirect ?token=
  useEffect(() => {
    const checkToken = () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      if (!token) return;

      const payload = decodeJWT(token);
      if (payload?.id && payload?.email) {
        localStorage.setItem("token", token);
        setUser({ id: payload.id, email: payload.email });
        toast.success("GitHub login successful!");
        window.history.replaceState({}, document.title, "/dashboard");
        setTimeout(() => navigate("/dashboard"), 300);
      } else {
        toast.error("GitHub login failed — invalid token");
      }
    };
    const timeout = setTimeout(checkToken, 300);
    return () => clearTimeout(timeout);
  }, [navigate, setUser, location.search]);

  // ✉️ Manual Login
  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post("/auth/login", form);
      login({ token: res.data.token, ...res.data.user });
      localStorage.setItem("token", res.data.token);
      toast.success("Login successful!");
      navigate("/dashboard");
    } catch (err) {
      const msg = err.response?.data?.message || "Login failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // 🎨 UI
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-500 via-blue-600 to-violet-700 px-4"
    >
      <motion.div
        initial={{ y: 50, scale: 0.9, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md p-8 bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20"
      >
        <h1 className="text-3xl font-semibold text-center text-white mb-2 tracking-wide">
          SkillForge <span className="text-emerald-300">AI</span>
        </h1>
        <p className="text-center text-gray-200 mb-8 text-sm">
          Empower your dev journey ⚙️ — Log in to continue
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="relative"
          >
            <input
              type="email"
              name="email"
              placeholder="Email address"
              value={form.email}
              onChange={handleChange}
              className="w-full bg-white/5 text-white placeholder-gray-300 border border-white/20 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
              required
            />
          </motion.div>

          {/* Password */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="relative"
          >
            <input
              type={showPass ? "text" : "password"}
              name="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              className="w-full bg-white/5 text-white placeholder-gray-300 border border-white/20 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              required
            />
            <span
              onClick={() => setShowPass(!showPass)}
              className="absolute right-4 top-3.5 text-gray-300 cursor-pointer select-none text-sm"
            >
              {showPass ? "🙈" : "👁️"}
            </span>
          </motion.div>

          {/* Error */}
          {error && (
            <p className="text-red-400 text-sm text-center animate-pulse">
              {error}
            </p>
          )}

          {/* Remember me + Forgot */}
          <div className="flex items-center justify-between text-gray-300 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="accent-emerald-400" />
              Remember me
            </label>
            <a href="#" className="hover:underline">
              Forgot password?
            </a>
          </div>

          {/* Login Button */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-400 to-blue-500 text-white py-3 rounded-lg font-medium shadow-lg hover:shadow-emerald-500/30 transition duration-300"
          >
            {loading ? "Logging in..." : "Login"}
          </motion.button>

          {/* Divider */}
          <div className="flex items-center justify-center gap-2 text-gray-400 text-sm mt-2">
            <span className="h-px w-16 bg-gray-500" /> or{" "}
            <span className="h-px w-16 bg-gray-500" />
          </div>

          {/* GitHub Login */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() =>
              (window.location.href = `${import.meta.env.VITE_API_URL || "http://localhost:4000"}/auth/github`)
            }
            type="button"
            className="w-full bg-gray-900 text-white py-3 rounded-lg mt-2 flex items-center justify-center gap-3 hover:bg-gray-800 transition"
          >
            <img
              src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg"
              alt="GitHub"
              className="w-5 h-5"
            />
            Login with GitHub
          </motion.button>
        </form>

        <p className="text-center text-xs text-gray-300 mt-6">
          © {new Date().getFullYear()} SkillForge AI — All Rights Reserved
        </p>
      </motion.div>
    </motion.div>
  );
}



