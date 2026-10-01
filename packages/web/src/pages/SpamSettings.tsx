import React, { useState, useEffect } from "react";

export default function SpamSettings() {
  const [keywords, setKeywords] = useState<Record<string, number>>({});
  const [newKey, setNewKey] = useState("");
  const [newWeight, setNewWeight] = useState(3);

  useEffect(() => {
    fetch("/api/spam-keywords")
      .then((res) => res.json())
      .then((res) => { if (res.success) setKeywords(res.data); });
  }, []);

  const handleSave = async (updated: Record<string, number>) => {
    const res = await fetch("/api/spam-keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords: updated })
    });
    if (res.ok) setKeywords(updated);
  };

  const addKeyword = () => {
    if (!newKey) return;
    const updated = { ...keywords, [newKey]: Number(newWeight) };
    handleSave(updated);
    setNewKey("");
  };

  const removeKeyword = (key: string) => {
    const updated = { ...keywords };
    delete updated[key];
    handleSave(updated);
  };

  return (
    <div style={{ padding: "16px", fontFamily: "sans-serif" }}>
      <h3>Smart Header Spam Filter Settings</h3>
      
      <div style={{ marginBottom: "16px", display: "flex", gap: "8px" }}>
        <input type="text" placeholder="Regex Pattern" value={newKey} onChange={e => setNewKey(e.target.value)} />
        <input type="number" min="1" max="5" value={newWeight} onChange={e => setNewWeight(Number(e.target.value))} />
        <button onClick={addKeyword}>Add</button>
      </div>

      <ul>
        {Object.entries(keywords).map(([key, val]) => (
          <li key={key} style={{ margin: "8px 0" }}>
            <code>{key}</code> (Weight: {val})
            <button onClick={() => removeKeyword(key)} style={{ marginLeft: "12px", color: "red" }}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
