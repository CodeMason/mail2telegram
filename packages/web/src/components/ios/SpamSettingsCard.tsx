// packages/web/src/components/SpamSettingsCard.tsx
import React, { useState, useEffect } from "react";

export function SpamSettingsCard() {
  const [keywords, setKeywords] = useState<Record<string, number>>({});
  const [newPattern, setNewPattern] = useState("");
  const [newWeight, setNewWeight] = useState(3);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/spam-keywords")
      .then((res) => res.json())
      .then((res: any) => {
        if (res.success) setKeywords(res.data);
      })
      .catch((err) => console.error("Failed to load spam rules:", err));
  }, []);

  const syncWithDatabase = async (updatedMap: Record<string, number>) => {
    setLoading(true);
    try {
      const res = await fetch("/api/spam-keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: updatedMap }),
      });
      if (res.ok) setKeywords(updatedMap);
    } catch (e) {
      console.error("Network sync error:", e);
    } finally {
      setLoading(false);
    }
  };

  const addRule = () => {
    if (!newPattern.trim()) return;
    const updated = { ...keywords, [newPattern.trim()]: Number(newWeight) };
    syncWithDatabase(updated);
    setNewPattern("");
  };

  const deleteRule = (pattern: string) => {
    const updated = { ...keywords };
    delete updated[pattern];
    syncWithDatabase(updated);
  };

  return (
    <div style={{ background: "#ffffff", padding: "16px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", marginTop: "16px" }}>
      <h3 style={{ margin: "0 0 12px 0", color: "#333" }}>Header Spam Filter Rules</h3>
      
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <input 
          type="text" 
          placeholder="Regex (e.g. bitcoin)" 
          value={newPattern} 
          onChange={(e) => setNewPattern(e.target.value)}
          style={{ flex: 1, padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
        />
        <input 
          type="number" 
          min="1" 
          max="5" 
          value={newWeight} 
          onChange={(e) => setNewWeight(Number(e.target.value))}
          style={{ width: "60px", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
        />
        <button 
          onClick={addRule} 
          disabled={loading}
          style={{ padding: "8px 16px", backgroundColor: "#0088cc", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}
        >
          Add
        </button>
      </div>

      <div style={{ maxHeight: "200px", overflowY: "auto" }}>
        {Object.entries(keywords).length === 0 ? (
          <p style={{ color: "#777", margin: 0, fontSize: "14px" }}>No custom keyword filters created yet.</p>
        ) : (
          Object.entries(keywords).map(([pattern, weight]) => (
            <div key={pattern} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #f0f0f0" }}>
              <span style={{ fontFamily: "monospace", fontSize: "14px", backgroundColor: "#f5f5f5", padding: "2px 6px", borderRadius: "4px" }}>
                {pattern}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "13px", color: "#666" }}>Weight: {weight}</span>
                <button 
                  onClick={() => deleteRule(pattern)} 
                  disabled={loading}
                  style={{ background: "none", border: "none", color: "#ff4d4f", cursor: "pointer", fontSize: "13px" }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
