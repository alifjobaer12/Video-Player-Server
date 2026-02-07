import { useState } from "react";

export default function AdminImport() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("");

  const handleImport = async () => {
    setStatus("Importing...");

    try {
      const res = await fetch("/api/import-series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (data.success) {
        setStatus(
          data.type === "new"
            ? `New Series Added\nEpisodes: ${data.addedEpisodes}`
            : `Updated\nNew Episodes: ${data.addedEpisodes}\nUpdated Links: ${data.updated}`,
        );
      } else setStatus("Failed");
    } catch {
      setStatus("Server error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="bg-neutral-900 p-8 rounded-xl w-[500px] space-y-5">
        <h1 className="text-xl text-center font-semibold">Series Importer</h1>

        <input
          className="w-full p-3 bg-neutral-800 rounded"
          placeholder="Paste kmhd link..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
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
