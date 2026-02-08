import { useState } from "react";

export default function AdminImport() {
  const [authorized, setAuthorized] = useState(
    localStorage.getItem("admin_auth") === "true",
  );
  const [password, setPassword] = useState("");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const login = () => {
    if (!password) return;

    localStorage.setItem("admin_auth", "true");
    localStorage.setItem("admin_key", password);
    setAuthorized(true);
  };

  const handleImport = async () => {
    setLoading(true);
    setStatus("Importing...");

    try {
      const res = await fetch("http://localhost:4000/api/import-series", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": localStorage.getItem("admin_key"),
          "x-route-token": "my_super_hidden_token_987",
        },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (data.success) {
        if (data.type === "new") {
          setStatus(`New Series Added\nEpisodes: ${data.addedEpisodes}`);
        } else {
          setStatus(
            `Updated\nNew Episodes: ${data.addedEpisodes}\nTotal Episodes: ${data.updated}`,
          );
        }
      } else {
        setStatus(data.error || "Failed");
      }
    } catch {
      setStatus("Server error");
    }

    setLoading(false);
  };

  /* 🔒 LOCK SCREEN */
  if (!authorized) {
    return (
      <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden
      bg-gradient-to-br from-[#0b141a] via-[#111c24] to-[#0f2027] text-white">

        {/* background glow */}
        <div className="absolute w-[450px] h-[450px] bg-emerald-500/20 blur-[160px] rounded-full top-[-100px] left-[-100px]" />
        <div className="absolute w-[350px] h-[350px] bg-cyan-400/20 blur-[150px] rounded-full bottom-[-80px] right-[-80px]" />

        <div className="w-full max-w-sm
          backdrop-blur-xl
          bg-white/10
          border border-white/20
          shadow-2xl
          rounded-2xl
          p-8 space-y-6">

          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold tracking-wide">Admin Access</h1>
            <p className="text-white/60 text-sm">Authorized personnel only</p>
          </div>

          <input
            type="password"
            placeholder="Enter admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            className="w-full p-3 rounded-xl
            bg-white/5 border border-white/20
            focus:outline-none focus:ring-2 focus:ring-emerald-400
            placeholder:text-white/40 transition"
          />

          <button
            onClick={login}
            className="w-full p-3 rounded-xl font-semibold
            bg-emerald-500 hover:bg-emerald-400
            active:scale-95 transition-all
            shadow-lg shadow-emerald-500/30"
          >
            Enter Dashboard
          </button>
        </div>
      </div>
    );
  }

  /* 🔓 IMPORT SCREEN */
  const statusColor =
    status.includes("New Series")
      ? "text-emerald-400"
      : status.includes("Updated")
      ? "text-yellow-400"
      : status.includes("error") || status.includes("Failed")
      ? "text-red-400"
      : "text-white/80";

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden
    bg-gradient-to-br from-[#0f2027] via-[#1b2d38] to-[#2c5364] text-white">

      {/* glow effects */}
      <div className="absolute w-[420px] h-[420px] bg-emerald-500/20 blur-[150px] rounded-full left-[-120px] top-[-120px]" />
      <div className="absolute w-[350px] h-[350px] bg-cyan-400/20 blur-[150px] rounded-full right-[-120px] bottom-[-120px]" />

      <div className="w-full max-w-md
        backdrop-blur-xl
        bg-white/10
        border border-white/20
        shadow-2xl
        rounded-2xl
        p-8 space-y-6">

        {/* header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-wide">
            Series Importer
          </h1>
          <p className="text-sm text-white/60">
            Import or update KMHD series automatically
          </p>
        </div>

        {/* URL input */}
        <div className="space-y-2">
          <label className="text-sm text-white/70">Series URL</label>
          <input
            type="text"
            placeholder="https://kmhd.com/series/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleImport()}
            className="w-full p-3 rounded-xl
            bg-white/5 border border-white/20
            focus:outline-none focus:ring-2 focus:ring-emerald-400
            focus:border-emerald-400
            placeholder:text-white/40 transition"
          />
        </div>

        {/* import button */}
        <button
          onClick={handleImport}
          disabled={loading}
          className="relative w-full p-3 rounded-xl font-semibold
          bg-emerald-500 hover:bg-emerald-400
          active:scale-95 transition-all duration-200
          shadow-lg shadow-emerald-500/30
          disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Importing...
            </span>
          ) : (
            "Import Series"
          )}
        </button>

        {/* status */}
        <div className={`text-center text-sm whitespace-pre-line
          bg-black/30 rounded-xl p-4 border border-white/10
          transition-all duration-300 ${statusColor}`}>
          {status || "Waiting for import..."}
        </div>
      </div>
    </div>
  );
}
