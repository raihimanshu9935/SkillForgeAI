import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // ✅ Redirect to login if user missing
  useEffect(() => {
    if (!user) {
      toast.error("Session expired — please login again.");
      navigate("/login", { replace: true });
    }
  }, [user, navigate]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen text-lg font-medium">
        Loading user data...
      </div>
    );
  }

  // 🧩 Derive username safely
  const displayName =
    user.name ||
    user.email?.split("@")[0] ||
    "Developer";

  const emailDisplay = user.email || "GitHub User";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 px-6 text-center">
      {/* 👋 Welcome */}
      <h1 className="text-3xl font-semibold mb-4 text-gray-800">
        Welcome, {displayName} 👋
      </h1>

      {/* 📧 Email Display */}
      <p className="text-gray-600 mb-6">
        You are logged in as:{" "}
        <span className="font-mono bg-gray-200 px-2 py-1 rounded">
          {emailDisplay}
        </span>
      </p>

      {/* 🔹 Buttons */}
      <div className="flex flex-col md:flex-row gap-4">
        <Link
          to="/assistant"
          className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-medium shadow hover:shadow-lg transition"
        >
          Open SkillForge Assistant 💬
        </Link>

        <button
          onClick={() => {
            logout();
            navigate("/login");
            toast.success("Logged out successfully!");
          }}
          className="bg-red-500 text-white px-6 py-3 rounded-xl hover:bg-red-600 transition shadow"
        >
          Logout
        </button>
      </div>

      {/* 💡 Info */}
      <div className="mt-8 text-sm text-gray-500">
        Need help? Ask <strong>“How to start this project?”</strong> in the SkillForge AI Assistant.
      </div>
    </div>
  );
}



