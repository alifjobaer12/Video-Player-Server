import { useState } from "react";

export default function AdminImport() {
  const [authorized, setAuthorized] = useState(
    localStorage.getItem("admin_auth") === "true",
  );
  const [password, setPassword] = useState("");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("");

  const login = () => {
    if (!password) return;

    localStorage.setItem("admin_auth", "true");
    localStorage.setItem("admin_key", password);
    setAuthorized(true);
  };

  const handleImport = async () => {
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
  };

  /* 🔒 LOCK SCREEN */
  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="bg-neutral-900 p-8 rounded-xl w-[400px] space-y-5 text-center">
          <h1 className="text-xl font-semibold">Admin Access</h1>

          <input
            type="password"
            placeholder="Enter admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 bg-neutral-800 rounded"
          />

          <button onClick={login} className="w-full bg-green-600 p-3 rounded">
            Enter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="bg-neutral-900 p-8 rounded-xl w-[500px] space-y-5">
        <h1 className="text-xl text-center font-semibold">Series Importer</h1>

        <input
          type="text"
          placeholder="Paste kmhd link..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full p-3 bg-neutral-800 rounded"
        />

        <button
          onClick={handleImport}
          className="w-full bg-green-600 p-3 rounded"
        >
          Import
        </button>

        <p className="text-center whitespace-pre-line text-sm">{status}</p>
      </div>
    </div>
  );
}
