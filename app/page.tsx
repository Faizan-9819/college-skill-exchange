"use client";

import { useEffect, useState, useMemo } from "react";

type User = {
  _id: string;
  name: string;
  email: string;
  password?: string;
  department?: string;
  year?: number;
};

type Skill = {
  _id: string;
  name: string;
  user: User;
};

type ExchangeRequest = {
  _id: string;
  sender: User;
  receiver: User;
  skill: Skill;
  message: string;
  status: "Pending" | "Accepted" | "Rejected" | "Completed";
  createdAt?: string;
  updatedAt?: string;
};

export default function Home() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [exchangeRequests, setExchangeRequests] = useState<ExchangeRequest[]>([]);
  const [view, setView] = useState<"home" | "requests" | "profile" | "discover">("home");
  const [requestsTab, setRequestsTab] = useState<"received" | "sent">("received");
  const [authMode, setAuthMode] = useState<"register" | "login">("register");
  const [userSearch, setUserSearch] = useState("");
  const [discoverSearch, setDiscoverSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [connectModal, setConnectModal] = useState<{
    open: boolean;
    skill: Skill | null;
    message: string;
  }>({
    open: false,
    skill: null,
    message: "",
  });
  const [editSkillModal, setEditSkillModal] = useState<{
    open: boolean;
    id: string;
    name: string;
  }>({
    open: false,
    id: "",
    name: "",
  });
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Broadcast helper for real-time cross-tab synchronization
  const broadcastSync = (type: string) => {
    try {
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        const channel = new BroadcastChannel("skill_exchange_sync");
        channel.postMessage({ type, timestamp: Date.now() });
        channel.close();
      }
    } catch {}
  };

  // Forms
  const [registerForm, setRegisterForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  const [skillForm, setSkillForm] = useState({
    name: "",
  });

  const showToast = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Fetch all core data
  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users");
      const data = await response.json();
      if (Array.isArray(data)) {
        setUsers(data);
      }
    } catch {
      console.error("Failed to fetch users");
    }
  };

  const fetchSkills = async () => {
    try {
      const response = await fetch(`/api/skills?_t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        setSkills(data);
      }
    } catch {
      console.error("Failed to fetch skills");
    }
  };

  const fetchExchangeRequests = async () => {
    try {
      const response = await fetch(`/api/exchange-requests?_t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        setExchangeRequests(data);
      }
    } catch {
      console.error("Failed to fetch exchange requests");
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem("skillExchangeUser");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?._id) {
          setCurrentUser(parsed);
        }
      }
    } catch {}
    fetchUsers();
    fetchSkills();
    fetchExchangeRequests();

    // Cross-tab real-time sync via BroadcastChannel
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        channel = new BroadcastChannel("skill_exchange_sync");
        channel.onmessage = () => {
          fetchExchangeRequests();
          fetchSkills();
        };
      }
    } catch {}

    const handleActiveSync = () => {
      fetchExchangeRequests();
      fetchSkills();
    };

    window.addEventListener("focus", handleActiveSync);
    document.addEventListener("visibilitychange", handleActiveSync);

    // Live background polling (every 2.5s) for real-time updates without manual refresh
    const pollTimer = setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "visible"
      ) {
        fetchExchangeRequests();
        fetchSkills();
      }
    }, 2500);

    return () => {
      if (channel) {
        try {
          channel.close();
        } catch {}
      }
      window.removeEventListener("focus", handleActiveSync);
      document.removeEventListener("visibilitychange", handleActiveSync);
      clearInterval(pollTimer);
    };
  }, []);

  // Register user (only Full Name, Email, Password)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !registerForm.name.trim() ||
      !registerForm.email.trim() ||
      !registerForm.password.trim()
    ) {
      showToast("error", "Please fill in full name, email, and password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: registerForm.name.trim(),
          email: registerForm.email.trim(),
          password: registerForm.password.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to create account");
      }

      setCurrentUser(data);
      try {
        localStorage.setItem("skillExchangeUser", JSON.stringify(data));
      } catch {}
      setRegisterForm({ name: "", email: "", password: "" });
      await fetchUsers();
      await fetchSkills();
      await fetchExchangeRequests();
      setView("profile");
      showToast(
        "success",
        `Welcome aboard, ${data.name}! Let's set up your skills.`,
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error creating user account";
      showToast("error", msg);
    } finally {
      setLoading(false);
    }
  };

  // Login user (check matching email/username with password)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginForm.email.trim() || !loginForm.password.trim()) {
      showToast("error", "Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginForm.email.trim(),
          password: loginForm.password.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      setCurrentUser(data);
      try {
        localStorage.setItem("skillExchangeUser", JSON.stringify(data));
      } catch {}
      setLoginForm({ email: "", password: "" });
      await fetchUsers();
      await fetchSkills();
      await fetchExchangeRequests();
      setView("home");
      showToast("success", `Welcome back, ${data.name}!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login failed";
      showToast("error", msg);
    } finally {
      setLoading(false);
    }
  };

  // Add skill (Student Skills)
  const addSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setActionLoading(true);
    try {
      const response = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: skillForm.name.trim(),
          user: currentUser._id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Failed to add skill");
      }

      setSkillForm({ name: "" });
      await fetchSkills();
      broadcastSync("SKILL_ADDED");
      showToast("success", "Skill added successfully!");
    } catch (err: any) {
      console.error("Error adding skill:", err);
      showToast(
        "error",
        err.message || "Failed to add skill. Please try again.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Edit skill
  const handleUpdateSkill = async () => {
    if (!editSkillModal.id || !editSkillModal.name.trim()) {
      showToast("error", "Skill name cannot be empty");
      return;
    }

    const trimmedName = editSkillModal.name.trim();
    const skillId = editSkillModal.id;

    // Optimistically update local skills state for instant UI update
    setSkills((prev) =>
      prev.map((s) => (s._id === skillId ? { ...s, name: trimmedName } : s)),
    );

    setActionLoading(true);
    try {
      const response = await fetch(`/api/skills/${skillId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Failed to update skill");
      }

      const updatedSkill = await response.json();
      if (updatedSkill?._id) {
        setSkills((prev) =>
          prev.map((s) => (s._id === skillId ? updatedSkill : s)),
        );
      }

      broadcastSync("SKILL_UPDATED");
      showToast("success", "Skill updated successfully!");
      setEditSkillModal({ open: false, id: "", name: "" });
    } catch (err: any) {
      console.error("Error updating skill:", err);
      showToast("error", err.message || "Failed to update skill");
      await fetchSkills();
    } finally {
      setActionLoading(false);
    }
  };

  // Delete skill
  const deleteSkill = async (id: string) => {
    if (!confirm("Are you sure you want to remove this skill?")) return;
    // Optimistically remove from skills
    setSkills((prev) => prev.filter((s) => s._id !== id));
    try {
      const response = await fetch(`/api/skills/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        broadcastSync("SKILL_DELETED");
        showToast("success", "Skill removed");
      } else {
        await fetchSkills();
        showToast("error", "Failed to remove skill");
      }
    } catch {
      await fetchSkills();
      showToast("error", "Failed to remove skill");
    }
  };

  // Send exchange connection request
  const sendExchangeRequest = async () => {
    if (!currentUser || !connectModal.skill) return;
    setActionLoading(true);

    try {
      const response = await fetch("/api/exchange-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: currentUser._id,
          receiver: connectModal.skill.user._id,
          skill: connectModal.skill._id,
          message:
            connectModal.message.trim() ||
            `Hi ${connectModal.skill.user.name}, I would love to connect and exchange skills!`,
        }),
      });

      if (!response.ok) {
        throw new Error("Could not send exchange request");
      }

      showToast(
        "success",
        `Exchange request sent to ${connectModal.skill.user.name}!`,
      );
      setConnectModal({ open: false, skill: null, message: "" });
      await fetchExchangeRequests();
      broadcastSync("REQUEST_SENT");
    } catch {
      showToast("error", "Could not send exchange request");
    } finally {
      setActionLoading(false);
    }
  };

  // Accept or Decline exchange request
  const updateRequestStatus = async (
    requestId: string,
    status: "Accepted" | "Rejected",
  ) => {
    // Instant optimistic update: state changes with 0ms delay so no refresh is needed
    setExchangeRequests((prev) =>
      prev.map((r) => (r._id === requestId ? { ...r, status } : r)),
    );

    setActionLoading(true);
    try {
      const response = await fetch(`/api/exchange-requests/${requestId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error("Failed to update request status");
      }

      const updated = await response.json();
      if (updated?._id) {
        setExchangeRequests((prev) =>
          prev.map((r) => (r._id === requestId ? updated : r)),
        );
      }

      broadcastSync("REQUEST_STATUS_UPDATED");

      showToast(
        "success",
        status === "Accepted"
          ? "🎉 Request accepted! Reach out to your peer to coordinate."
          : "Exchange request declined.",
      );
    } catch {
      await fetchExchangeRequests();
      showToast("error", "Failed to update request status");
    } finally {
      setActionLoading(false);
    }
  };

  // Cancel sent exchange request
  const cancelExchangeRequest = async (requestId: string) => {
    if (!confirm("Are you sure you want to cancel this request?")) return;
    // Optimistic removal
    setExchangeRequests((prev) => prev.filter((r) => r._id !== requestId));
    setActionLoading(true);
    try {
      const response = await fetch(`/api/exchange-requests/${requestId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to cancel request");
      }

      broadcastSync("REQUEST_CANCELLED");
      showToast("success", "Exchange request cancelled");
    } catch {
      await fetchExchangeRequests();
      showToast("error", "Failed to cancel request");
    } finally {
      setActionLoading(false);
    }
  };

  // User helper maps
  const userSkills = useMemo(
    () => skills.filter((s) => s.user?._id === currentUser?._id),
    [skills, currentUser],
  );

  // Exchange requests helpers
  const receivedRequests = useMemo(
    () => exchangeRequests.filter((r) => r.receiver?._id === currentUser?._id),
    [exchangeRequests, currentUser],
  );

  const sentRequests = useMemo(
    () => exchangeRequests.filter((r) => r.sender?._id === currentUser?._id),
    [exchangeRequests, currentUser],
  );

  const pendingReceivedCount = useMemo(
    () => receivedRequests.filter((r) => r.status === "Pending").length,
    [receivedRequests],
  );

  // Helper to fetch skills offered by a specific user
  const getSkillsForUser = (userId: string) =>
    skills.filter((s) => s.user?._id === userId);

  // Filtered users for "Already Registered User Login"
  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users;
    const query = userSearch.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query),
    );
  }, [users, userSearch]);

  // Discover skills (exclude current user)
  const discoverSkills = useMemo(() => {
    return skills.filter((s) => {
      const isOtherUser = s.user?._id !== currentUser?._id;
      const matchesSearch =
        !discoverSearch.trim() ||
        s.name.toLowerCase().includes(discoverSearch.toLowerCase()) ||
        s.user?.name.toLowerCase().includes(discoverSearch.toLowerCase());
      return isOtherUser && matchesSearch;
    });
  }, [skills, currentUser, discoverSearch]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-5 right-5 z-50 animate-bounce">
          <div
            className={`px-5 py-3 rounded-xl shadow-lg border text-sm font-medium flex items-center gap-2.5 ${
              notification.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            <span>{notification.type === "success" ? "✅" : "⚠️"}</span>
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Global Header */}
      <header className="glass-header sticky top-0 z-40">
        <div className="container-custom py-3.5 sm:py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Logo */}
            <div
              onClick={() => currentUser && setView("home")}
              className={`flex items-center gap-3 ${
                currentUser ? "cursor-pointer" : ""
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-sm shadow-blue-500/20 text-lg font-bold">
                🎓
              </div>
              <div>
                <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 block leading-tight">
                  SkillExchange
                </span>
                <span className="text-xs text-slate-500 font-medium hidden sm:inline-block">
                  Peer-to-Peer Campus Learning
                </span>
              </div>
            </div>

            {/* Logged-in Header Controls */}
            {currentUser ? (
              <div className="flex items-center gap-3 sm:gap-6">
                {/* Desktop Nav Tabs */}
                <nav className="hidden md:flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200/80">
                  <button
                    onClick={() => setView("home")}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                      view === "home"
                        ? "bg-white text-blue-600 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => {
                      setView("requests");
                      setRequestsTab("received");
                    }}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
                      view === "requests"
                        ? "bg-white text-blue-600 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>Requests</span>
                    {pendingReceivedCount > 0 && (
                      <span className="min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center animate-pulse">
                        {pendingReceivedCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setView("profile")}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                      view === "profile"
                        ? "bg-white text-blue-600 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    My Profile
                  </button>
                  <button
                    onClick={() => setView("discover")}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                      view === "discover"
                        ? "bg-white text-blue-600 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Discover
                  </button>
                </nav>

                {/* User Status & Logout */}
                <div className="flex items-center gap-3 pl-2 sm:border-l sm:border-slate-200">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold text-slate-800 leading-tight">
                      {currentUser.name}
                    </p>
                    <span className="text-xs font-medium text-blue-600">
                      Year {currentUser.year || 1}
                    </span>
                  </div>

                  <div className="w-9 h-9 rounded-full bg-linear-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>

                  <button
                    onClick={() => {
                      setCurrentUser(null);
                      setView("home");
                      setAuthMode("login");
                    }}
                    className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium flex items-center gap-1.5"
                    title="Switch Account or Logout"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    <span className="hidden lg:inline">Logout</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAuthMode("register")}
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    authMode === "register"
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Register
                </button>
                <button
                  onClick={() => setAuthMode("login")}
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    authMode === "login"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Login
                </button>
              </div>
            )}
          </div>

          {/* Mobile Navigation Tabs */}
          {currentUser && (
            <nav className="flex md:hidden items-center justify-around gap-1 mt-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setView("home")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold text-center transition-all ${
                  view === "home"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => {
                  setView("requests");
                  setRequestsTab("received");
                }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold text-center transition-all flex items-center justify-center gap-1 ${
                  view === "requests"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span>Requests</span>
                {pendingReceivedCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {pendingReceivedCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setView("profile")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold text-center transition-all ${
                  view === "profile"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                My Profile
              </button>
              <button
                onClick={() => setView("discover")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold text-center transition-all ${
                  view === "discover"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Discover
              </button>
            </nav>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main
        className={`flex-1 flex flex-col ${
          !currentUser
            ? "justify-center items-center p-6 sm:p-10 md:p-14 min-h-[calc(100vh-9.5rem)]"
            : "container-custom py-[70px]"
        }`}
      >
        {!currentUser ? (
          /*
             AUTHENTICATION / WELCOME SCREEN
             */
          <div className="w-full max-w-md my-auto flex flex-col justify-center">
            {/* Dual Mode Card: Register vs Login */}
            <div className="w-full bg-white rounded-2xl border border-slate-200/90 shadow-xl overflow-hidden">
              {/* Card Mode Tabs */}
              <div className="grid grid-cols-2 bg-slate-100/90 p-1.5 border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => setAuthMode("register")}
                  className={`py-3 text-sm font-semibold rounded-xl transition-all ${
                    authMode === "register"
                      ? "bg-white text-blue-600 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Create Account
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode("login")}
                  className={`py-3 text-sm font-semibold rounded-xl transition-all ${
                    authMode === "login"
                      ? "bg-white text-blue-600 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Login
                </button>
              </div>

              <div className="pt-8 px-6 pb-6 sm:pt-10 sm:px-8 sm:pb-8">
                {authMode === "register" ? (
                  /* ================= Register Form ================= */
                  <div>
                    <div className="mb-6 text-center">
                      <h3 className="text-2xl sm:text-[1.65rem] font-extrabold text-slate-900 tracking-tight">
                        Join SkillExchange
                      </h3>
                      <p className="text-sm text-slate-500 mt-2">
                        Create your account to get started
                      </p>
                    </div>

                    <form onSubmit={handleRegister} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
                          Full Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., Alex Morgan"
                          value={registerForm.name}
                          onChange={(e) =>
                            setRegisterForm({
                              ...registerForm,
                              name: e.target.value,
                            })
                          }
                          className="input-field"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
                          Email
                        </label>
                        <input
                          type="email"
                          placeholder="alex@college.edu"
                          value={registerForm.email}
                          onChange={(e) =>
                            setRegisterForm({
                              ...registerForm,
                              email: e.target.value,
                            })
                          }
                          className="input-field"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
                          Password
                        </label>
                        <input
                          type="password"
                          placeholder="••••••••"
                          value={registerForm.password}
                          onChange={(e) =>
                            setRegisterForm({
                              ...registerForm,
                              password: e.target.value,
                            })
                          }
                          className="input-field"
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary w-full mt-4 py-3"
                      >
                        {loading
                          ? "Creating Account..."
                          : "Create Account & Get Started"}
                      </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                      <p className="text-sm text-slate-600">
                        Already have an account?{" "}
                        <button
                          type="button"
                          onClick={() => setAuthMode("login")}
                          className="text-blue-600 font-bold hover:underline ml-1"
                        >
                          Login →
                        </button>
                      </p>
                    </div>
                  </div>
                ) : (
                  /* ================= Login Form ================= */
                  <div>
                    <div className="mb-6 text-center">
                      <h3 className="text-2xl sm:text-[1.65rem] font-extrabold text-slate-900 tracking-tight">
                        Welcome Back
                      </h3>
                      <p className="text-sm text-slate-500 mt-2">
                        Enter your email and password to log in
                      </p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
                          Email
                        </label>
                        <input
                          type="email"
                          placeholder="alex@college.edu"
                          value={loginForm.email}
                          onChange={(e) =>
                            setLoginForm({
                              ...loginForm,
                              email: e.target.value,
                            })
                          }
                          className="input-field"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
                          Password
                        </label>
                        <input
                          type="password"
                          placeholder="••••••••"
                          value={loginForm.password}
                          onChange={(e) =>
                            setLoginForm({
                              ...loginForm,
                              password: e.target.value,
                            })
                          }
                          className="input-field"
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary w-full mt-4 py-3"
                      >
                        {loading ? "Signing In..." : "Login"}
                      </button>
                    </form>

                    <div className="mt-8! pt-6! border-t border-slate-100 text-center">
                      <p className="text-sm text-slate-600">
                        New student?{" "}
                        <button
                          type="button"
                          onClick={() => setAuthMode("register")}
                          className="text-blue-600 font-bold hover:underline ml-1"
                        >
                          Create an account →
                        </button>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : view === "home" ? (
          // /* DASHBOARD VIEW*/
          <div className="space-y-8">
            <div className="bg-linear-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 sm:p-8 text-white shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold mb-3">
                  <span>👋</span> Student Dashboard
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  Welcome back, {currentUser.name}!
                </h2>
                <p className="mt-1 text-blue-100 text-sm sm:text-base max-w-xl">
                  Here are your peer exchange opportunities today.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setView("profile")}
                  className="bg-white text-blue-700 hover:bg-blue-50 font-semibold px-4 py-2.5 rounded-xl text-sm transition-all shadow-xs"
                >
                  + Add Skills
                </button>
                <button
                  onClick={() => setView("discover")}
                  className="bg-blue-500/50 hover:bg-blue-500/70 border border-white/20 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all"
                >
                  Explore All Skills
                </button>
              </div>
            </div>

            {/* Pending Requests Alert Banner */}
            {pendingReceivedCount > 0 && (
              <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-amber-500 text-white flex items-center justify-center text-xl font-bold shrink-0 shadow-xs">
                    📬
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-base">
                      You have {pendingReceivedCount} pending skill exchange request{pendingReceivedCount > 1 ? "s" : ""}!
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                      Fellow campus peers want to learn from you. Accept below to connect.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setView("requests");
                    setRequestsTab("received");
                  }}
                  className="btn-primary text-xs py-2 px-4 shrink-0 bg-linear-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800"
                >
                  Manage Requests →
                </button>
              </div>
            )}

            {/* Stats Cards - Desktop 4 Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              <div className="card flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    My Skills
                  </span>
                  <p className="text-3xl font-extrabold text-blue-600 mt-1.5">
                    {userSkills.length}
                  </p>
                  <span className="text-xs text-slate-400 mt-0.5 block">
                    Skills I can teach
                  </span>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl shrink-0">
                  🎯
                </div>
              </div>

              <div
                onClick={() => {
                  setView("requests");
                  setRequestsTab("received");
                }}
                className="card flex items-center justify-between cursor-pointer hover:border-amber-300 transition-all group"
              >
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider group-hover:text-amber-600 transition-colors">
                    Exchange Requests
                  </span>
                  <p className="text-3xl font-extrabold text-amber-600 mt-1.5">
                    {receivedRequests.length}
                  </p>
                  <span className="text-xs text-amber-600 font-medium mt-0.5 block">
                    {pendingReceivedCount > 0 ? `${pendingReceivedCount} pending review` : "All reviewed"}
                  </span>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform">
                  📬
                </div>
              </div>

              <div className="card flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    All Skills
                  </span>
                  <p className="text-3xl font-extrabold text-emerald-600 mt-1.5">
                    {skills.length}
                  </p>
                  <span className="text-xs text-slate-400 mt-0.5 block">
                    Available on campus
                  </span>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shrink-0">
                  📚
                </div>
              </div>

              <div className="card flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Students
                  </span>
                  <p className="text-3xl font-extrabold text-indigo-600 mt-1.5">
                    {users.length}
                  </p>
                  <span className="text-xs text-slate-400 mt-0.5 block">
                    Active students
                  </span>
                </div>
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl shrink-0">
                  👥
                </div>
              </div>
            </div>

            {/* Incoming Requests Section on Dashboard */}
            <div className="card">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <span>🤝</span> Incoming Skill Requests
                    {pendingReceivedCount > 0 && (
                      <span className="badge bg-rose-50 text-rose-700 border-rose-200 text-xs px-2.5 py-0.5 ml-1 font-bold">
                        {pendingReceivedCount} pending
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Students who want to connect and learn from you
                  </p>
                </div>
                {receivedRequests.length > 0 && (
                  <button
                    onClick={() => {
                      setView("requests");
                      setRequestsTab("received");
                    }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 self-start sm:self-auto"
                  >
                    View All ({receivedRequests.length}) →
                  </button>
                )}
              </div>

              {receivedRequests.length === 0 ? (
                <div className="text-center py-10 px-4 max-w-md mx-auto">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl mx-auto mb-3">
                    📬
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mb-1">
                    No requests received yet
                  </h4>
                  <p className="text-xs text-slate-500">
                    When other students discover your teaching skills and request an exchange, you will see and accept them here!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {receivedRequests.slice(0, 4).map((request) => (
                    <div
                      key={request._id}
                      className="p-4 sm:p-5 rounded-xl border border-slate-200/90 bg-white hover:border-blue-300 transition-all shadow-xs flex flex-col justify-between gap-3.5"
                    >
                      <div>
                        {/* Header: Sender Info & Status */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-full bg-linear-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                              {request.sender?.name?.charAt(0).toUpperCase() || "?"}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 text-sm truncate">
                                {request.sender?.name || "Student"}
                              </p>
                              <p className="text-xs text-slate-500 truncate">
                                {request.sender?.email} • Year {request.sender?.year || 1}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`badge text-xs shrink-0 ${
                              request.status === "Accepted"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : request.status === "Rejected"
                                  ? "bg-rose-50 text-rose-700 border-rose-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            {request.status === "Accepted"
                              ? "✅ Accepted"
                              : request.status === "Rejected"
                                ? "✕ Declined"
                                : "⏳ Pending"}
                          </span>
                        </div>

                        {/* Skill info */}
                        <div className="mt-3 flex items-center gap-1.5 text-xs">
                          <span className="text-slate-500 font-medium">
                            Wants to learn:
                          </span>
                          <span className="badge badge-skill text-[11px] font-semibold py-0.5 px-2">
                            {request.skill?.name || "Skill"}
                          </span>
                        </div>

                        {/* Message */}
                        {request.message && (
                          <div className="mt-2.5 p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-700 italic">
                            &ldquo;{request.message}&rdquo;
                          </div>
                        )}
                      </div>

                      {/* Action buttons / Accepted details */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                        {request.status === "Pending" ? (
                          <>
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() =>
                                updateRequestStatus(request._id, "Rejected")
                              }
                              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-xs font-semibold transition-colors"
                            >
                              Decline
                            </button>
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() =>
                                updateRequestStatus(request._id, "Accepted")
                              }
                              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors shadow-xs"
                            >
                              ✓ Accept Request
                            </button>
                          </>
                        ) : request.status === "Accepted" ? (
                          <p className="text-xs text-emerald-700 font-medium w-full text-right">
                            🎉 Connected! Email:{" "}
                            <span className="font-semibold underline">
                              {request.sender?.email}
                            </span>
                          </p>
                        ) : (
                          <span className="text-xs text-slate-400">
                            Request declined
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Skills Section */}
            <div className="card">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <span>📚</span> Recent Skills Added
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Latest skills shared by campus students
                  </p>
                </div>
              </div>

              {skills.length === 0 ? (
                <div className="text-center py-12 px-4 max-w-md mx-auto">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-3xl mx-auto mb-4">
                    📚
                  </div>
                  <h4 className="text-base font-bold text-slate-900 mb-1">
                    No skills added yet
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-500 mb-5">
                    Be the first to add a skill you can teach!
                  </p>
                  <button
                    onClick={() => setView("profile")}
                    className="btn-primary text-sm"
                  >
                    Add Your First Skill
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {skills.slice(0, 6).map((skill) => (
                    <div
                      key={skill._id}
                      className="card-interactive p-5 flex flex-col"
                    >
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-lg mb-3">
                          {skill.name}
                        </h4>

                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-linear-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                              {skill.user.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 text-sm">
                                {skill.user.name}
                              </p>
                              <span className="text-xs text-slate-500">
                                Year {skill.user.year || 1}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {skill.user?._id !== currentUser?._id ? (
                        <button
                          onClick={() =>
                            setConnectModal({
                              open: true,
                              skill: skill,
                              message: `Hi ${skill.user.name}, I saw that you have expertise in ${skill.name}. I would love to connect and learn from you!`,
                            })
                          }
                          className="btn-primary text-xs py-2 px-4 mt-4 w-full"
                        >
                          🤝 Connect
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            setEditSkillModal({
                              open: true,
                              id: skill._id,
                              name: skill.name,
                            })
                          }
                          className="btn-secondary text-xs py-2 px-4 mt-4 w-full flex items-center justify-center gap-1.5"
                        >
                          ✏️ Edit Your Skill
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : view === "requests" ? (
          /*
             REQUESTS VIEW: INCOMING & SENT REQUESTS
          */
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Skill Exchange Requests
                </h2>
                <p className="text-slate-600 text-sm sm:text-base mt-1">
                  Manage incoming requests from students and track your outgoing requests.
                </p>
              </div>

              <button
                onClick={() => setView("discover")}
                className="btn-secondary text-xs self-start sm:self-auto"
              >
                + Find More Skills to Learn
              </button>
            </div>

            {/* Sub-navigation Tabs */}
            <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
              <button
                type="button"
                onClick={() => setRequestsTab("received")}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                  requestsTab === "received"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span>📬 Received Requests</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    requestsTab === "received"
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {receivedRequests.length}
                </span>
                {pendingReceivedCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setRequestsTab("sent")}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                  requestsTab === "sent"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span>📤 Sent Requests</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    requestsTab === "sent"
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {sentRequests.length}
                </span>
              </button>
            </div>

            {/* Tab Content */}
            {requestsTab === "received" ? (
              receivedRequests.length === 0 ? (
                <div className="card text-center py-16 px-4">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-3xl mx-auto mb-4">
                    📬
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">
                    No received requests yet
                  </h3>
                  <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                    When other students ask to learn skills you teach, their requests will appear here for you to accept.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {receivedRequests.map((request) => (
                    <div
                      key={request._id}
                      className="card-interactive p-6 flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-full bg-linear-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-base shrink-0">
                              {request.sender?.name?.charAt(0).toUpperCase() || "?"}
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900 text-base leading-tight">
                                {request.sender?.name || "Student"}
                              </h4>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {request.sender?.email} • Year {request.sender?.year || 1}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`badge text-xs shrink-0 ${
                              request.status === "Accepted"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 font-bold"
                                : request.status === "Rejected"
                                  ? "bg-rose-50 text-rose-700 border-rose-200 font-bold"
                                  : "bg-amber-50 text-amber-700 border-amber-200 font-bold"
                            }`}
                          >
                            {request.status === "Accepted"
                              ? "✅ Accepted"
                              : request.status === "Rejected"
                                ? "✕ Declined"
                                : "⏳ Pending Your Review"}
                          </span>
                        </div>

                        {/* Skill requested */}
                        <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center justify-between text-xs">
                          <span className="text-slate-600 font-medium">
                            Requested Skill to Learn:
                          </span>
                          <span className="badge badge-skill text-xs font-bold py-0.5 px-2.5">
                            {request.skill?.name || "Skill"}
                          </span>
                        </div>

                        {/* Message from sender */}
                        {request.message && (
                          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs sm:text-sm text-slate-700">
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                              Message from peer:
                            </p>
                            <p className="italic">&ldquo;{request.message}&rdquo;</p>
                          </div>
                        )}
                      </div>

                      {/* Action footer */}
                      <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                        {request.status === "Pending" ? (
                          <>
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() =>
                                updateRequestStatus(request._id, "Rejected")
                              }
                              className="btn-secondary text-xs py-2 px-4 text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                            >
                              ✕ Decline
                            </button>
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() =>
                                updateRequestStatus(request._id, "Accepted")
                              }
                              className="btn-primary text-xs py-2 px-5 bg-emerald-600 hover:bg-emerald-700"
                            >
                              ✓ Accept Request
                            </button>
                          </>
                        ) : request.status === "Accepted" ? (
                          <div className="w-full p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between gap-2">
                            <span>
                              🎉 You accepted! Contact peer at:{" "}
                              <strong>{request.sender?.email}</strong>
                            </span>
                            <a
                              href={`mailto:${request.sender?.email}`}
                              className="text-xs font-bold underline hover:text-emerald-950 shrink-0"
                            >
                              Email Student →
                            </a>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">
                            This request was declined
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              /* Tab 2: Sent Requests */
              sentRequests.length === 0 ? (
                <div className="card text-center py-16 px-4">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-3xl mx-auto mb-4">
                    📤
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">
                    No sent requests yet
                  </h3>
                  <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                    Find skills you want to learn in the Discover section and connect with student peers!
                  </p>
                  <button
                    onClick={() => setView("discover")}
                    className="btn-primary text-xs mt-4"
                  >
                    Discover Campus Skills
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {sentRequests.map((request) => (
                    <div
                      key={request._id}
                      className="card-interactive p-6 flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-full bg-linear-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-base shrink-0">
                              {request.receiver?.name?.charAt(0).toUpperCase() || "?"}
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900 text-base leading-tight">
                                {request.receiver?.name || "Student"}
                              </h4>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {request.receiver?.email} • Year {request.receiver?.year || 1}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`badge text-xs shrink-0 ${
                              request.status === "Accepted"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 font-bold"
                                : request.status === "Rejected"
                                  ? "bg-rose-50 text-rose-700 border-rose-200 font-bold"
                                  : "bg-amber-50 text-amber-700 border-amber-200 font-bold"
                            }`}
                          >
                            {request.status === "Accepted"
                              ? "✅ Accepted"
                              : request.status === "Rejected"
                                ? "✕ Declined"
                                : "⏳ Pending"}
                          </span>
                        </div>

                        {/* Skill requested */}
                        <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 flex items-center justify-between text-xs">
                          <span className="text-slate-600 font-medium">
                            Skill You Asked to Learn:
                          </span>
                          <span className="badge badge-skill text-xs font-bold py-0.5 px-2.5">
                            {request.skill?.name || "Skill"}
                          </span>
                        </div>

                        {/* Message sent */}
                        {request.message && (
                          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs sm:text-sm text-slate-700">
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                              Your message:
                            </p>
                            <p className="italic">&ldquo;{request.message}&rdquo;</p>
                          </div>
                        )}
                      </div>

                      {/* Action footer */}
                      <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                        {request.status === "Pending" ? (
                          <div className="flex items-center justify-between w-full">
                            <span className="text-xs text-amber-700 font-medium">
                              ⏳ Awaiting response from {request.receiver?.name}
                            </span>
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => cancelExchangeRequest(request._id)}
                              className="text-xs text-slate-400 hover:text-rose-600 font-semibold transition-colors"
                            >
                              Cancel Request
                            </button>
                          </div>
                        ) : request.status === "Accepted" ? (
                          <div className="w-full p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between gap-2">
                            <span>
                              🎉 {request.receiver?.name} accepted! Email:{" "}
                              <strong>{request.receiver?.email}</strong>
                            </span>
                            <a
                              href={`mailto:${request.receiver?.email}`}
                              className="text-xs font-bold underline hover:text-emerald-950 shrink-0"
                            >
                              Email Student →
                            </a>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">
                            Request was declined
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        ) : view === "profile" ? (
          /*
             PROFILE VIEW
             */
          <div className="space-y-8">
            {/* Header description */}
            <div className="max-w-3xl">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                My Skills Profile
              </h2>
              <p className="text-slate-600 text-sm sm:text-base mt-1">
                Keep your profile updated with the skills you can teach to
                others.
              </p>
            </div>

            {/* Single Column for Skills */}
            <div className="max-w-2xl">
              {/* ================= Student Skills ================= */}
              <div className="card space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">✨</span>
                    <h3 className="text-xl font-bold text-slate-900">
                      My Skills (What You Can Teach)
                    </h3>
                  </div>
                </div>

                <form onSubmit={addSkill} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                      Skill Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., React, Python, Data Science, Guitar"
                      value={skillForm.name}
                      onChange={(e) => setSkillForm({ name: e.target.value })}
                      className="input-field"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="btn-primary w-full"
                  >
                    {actionLoading ? "Adding..." : "+ Add Student Skill"}
                  </button>
                </form>

                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-slate-800 text-sm">
                      Your Listed Teaching Skills ({userSkills.length})
                    </h4>
                  </div>

                  {userSkills.length === 0 ? (
                    <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <p className="text-xs text-slate-500">
                        No teaching skills added yet. Add what you know above!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                      {userSkills.map((skill) => (
                        <div
                          key={skill._id}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-blue-300 transition-colors"
                        >
                          <div>
                            <p className="font-bold text-slate-900 text-sm">
                              {skill.name}
                            </p>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setEditSkillModal({
                                  open: true,
                                  id: skill._id,
                                  name: skill.name,
                                })
                              }
                              className="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                              title="Edit Skill"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                            </button>

                            <button
                              type="button"
                              onClick={() => deleteSkill(skill._id)}
                              className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                              title="Remove Skill"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /*
             DISCOVER VIEW: CAMPUS-WIDE SKILLS GRID
             */
          <div className="space-y-8">
            {/* Discover Header */}
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Discover All Campus Skills
              </h2>
              <p className="text-slate-600 text-sm sm:text-base mt-1">
                Explore skills taught by students across campus and connect to
                start learning.
              </p>
            </div>

            {/* Search & Filter Bar */}
            <div className="card p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="🔍 Search by skill name or student..."
                  value={discoverSearch}
                  onChange={(e) => setDiscoverSearch(e.target.value)}
                  className="input-field text-sm pl-4"
                />
              </div>
            </div>

            {/* 3-Column Desktop Grid */}
            {discoverSkills.length === 0 ? (
              <div className="card text-center py-16 px-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-3xl mx-auto mb-4">
                  🔍
                </div>
                <h3 className="text-lg font-bold text-slate-800">
                  No skills match your search
                </h3>
                <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                  Try adjusting your search query.
                </p>
                {discoverSearch && (
                  <button
                    onClick={() => {
                      setDiscoverSearch("");
                    }}
                    className="btn-secondary text-xs mt-4"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {discoverSkills.map((skill) => {
                  const peerOfferedSkills = getSkillsForUser(skill.user._id);

                  return (
                    <div
                      key={skill._id}
                      className="card-interactive p-5 flex flex-col justify-between"
                    >
                      <div>
                        {/* Skill Header */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div>
                            <h4 className="font-extrabold text-slate-900 text-lg group-hover:text-blue-600 transition-colors">
                              {skill.name}
                            </h4>
                          </div>
                        </div>

                        {/* Student Details */}
                        <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-full bg-linear-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                              {skill.user.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 text-sm">
                                {skill.user.name}
                              </p>
                              <span className="text-xs text-slate-500">
                                Year {skill.user.year || 1}
                              </span>
                            </div>
                          </div>

                          {/* Student Skills Tags */}
                          {peerOfferedSkills.length > 1 && (
                            <div className="mt-3 pt-2.5 border-t border-slate-200/60 space-y-1.5 text-xs">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-slate-600 text-[11px]">
                                  Also teaches:
                                </span>
                                {peerOfferedSkills
                                  .filter((s) => s._id !== skill._id)
                                  .slice(0, 2)
                                  .map((s) => (
                                    <span
                                      key={s._id}
                                      className="badge badge-skill text-[10px] py-0 px-2"
                                    >
                                      {s.name}
                                    </span>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Connect / Edit Button */}
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
                        {skill.user?._id !== currentUser?._id ? (
                          <button
                            onClick={() =>
                              setConnectModal({
                                open: true,
                                skill: skill,
                                message: `Hi ${skill.user.name}, I'm interested in learning ${skill.name} from you!`,
                              })
                            }
                            className="btn-primary text-xs py-2 px-4 w-full"
                          >
                            🤝 Connect / Request Exchange
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              setEditSkillModal({
                                open: true,
                                id: skill._id,
                                name: skill.name,
                              })
                            }
                            className="btn-secondary text-xs py-2 px-4 w-full flex items-center justify-center gap-1.5"
                          >
                            ✏️ Edit Your Skill
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Connect Modal */}
      {connectModal.open && connectModal.skill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-8 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2.5">
                <span>🤝</span> Request Skill Exchange
              </h3>
              <button
                onClick={() =>
                  setConnectModal({ open: false, skill: null, message: "" })
                }
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="my-5 p-4 bg-blue-50/70 rounded-xl border border-blue-100/90">
              <p className="text-xs text-blue-700 font-semibold uppercase tracking-wider">
                You are connecting with:
              </p>
              <p className="text-base font-bold text-slate-900 mt-1">
                {connectModal.skill.user.name} (Year{" "}
                {connectModal.skill.user.year || 1})
              </p>
              <p className="text-xs text-slate-600 mt-1.5">
                Skill:{" "}
                <span className="font-semibold text-slate-800">
                  {connectModal.skill.name}
                </span>
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Message to Peer
              </label>
              <textarea
                rows={3}
                value={connectModal.message}
                onChange={(e) =>
                  setConnectModal({ ...connectModal, message: e.target.value })
                }
                className="input-field text-sm"
                placeholder="Introduce yourself and mention what skills you can also offer..."
              />
            </div>

            <div className="mt-6 pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() =>
                  setConnectModal({ open: false, skill: null, message: "" })
                }
                className="btn-secondary text-xs py-2.5 px-4"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={sendExchangeRequest}
                className="btn-primary text-xs py-2.5 px-6"
              >
                {actionLoading ? "Sending..." : "Send Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Skill Modal */}
      {editSkillModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 sm:p-8 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2.5">
                <span>✏️</span> Edit Teaching Skill
              </h3>
              <button
                type="button"
                onClick={() =>
                  setEditSkillModal({ open: false, id: "", name: "" })
                }
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUpdateSkill();
              }}
              className="mt-5 space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Skill Name
                </label>
                <input
                  type="text"
                  value={editSkillModal.name}
                  onChange={(e) =>
                    setEditSkillModal({
                      ...editSkillModal,
                      name: e.target.value,
                    })
                  }
                  placeholder="e.g., React, Python, Data Science"
                  className="input-field"
                  autoFocus
                  required
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    setEditSkillModal({ open: false, id: "", name: "" })
                  }
                  className="btn-secondary text-xs py-2 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !editSkillModal.name.trim()}
                  className="btn-primary text-xs py-2 px-5"
                >
                  {actionLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 sm:py-9 mt-12 sm:mt-16">
        <div className="container-custom flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            © {new Date().getFullYear()} SkillExchange — Campus Peer Learning
            Platform
          </p>
          <div className="flex items-center gap-4">
            <span>Consistent Spacing &amp; Clean Layout</span>
            <span>•</span>
            <span>Student Skills Exchange</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
