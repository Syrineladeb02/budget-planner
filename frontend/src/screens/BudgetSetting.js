import React, { useState, useEffect } from "react";
import "./BudgetSetting.css";

function getRemainingDaysInMonth() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const lastDay = new Date(year, month + 1, 0);
  const diffTime = lastDay - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function BudgetSetting() {
  const userId = 1;
  const today = new Date();
  const currentMonth = today.toISOString().slice(0, 7);
  const [isLocked, setIsLocked] = useState(false);

  const [categories, setCategories] = useState([]);
  const [budgets, setBudgets] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const remainingDays = getRemainingDaysInMonth();

  const allFilled = categories.length > 0 && categories.every(cat => {
    const val = parseFloat(budgets[cat.name]);
    return !isNaN(val) && val > 0;
  });

  // Fetch categories and existing budgets
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [catRes, budgetRes] = await Promise.all([
          fetch("/api/budgets/categories"),
          fetch(`/api/budgets/${userId}/${currentMonth}`)
        ]);

        if (!catRes.ok || !budgetRes.ok) throw new Error("Failed to load data");

        const catData = await catRes.json();
        setCategories(catData);

        const budgetData = await budgetRes.json();
        const budgetObj = {};
budgetData.forEach(({ category_name, amount }) => {
  budgetObj[category_name] = Number(amount).toFixed(2);
});
setBudgets(budgetObj);

// 👉 Verrouille si au moins un budget existe déjà pour ce mois
setIsLocked(budgetData.length > 0);

        setBudgets(budgetObj);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, currentMonth]);

  const handleChange = (category, value) => {
    if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
      setBudgets(prev => ({ ...prev, [category]: value }));
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const filteredBudgets = {};
    Object.entries(budgets).forEach(([key, val]) => {
      const num = parseFloat(val);
      if (!isNaN(num) && num > 0) {
        filteredBudgets[key] = parseFloat(num.toFixed(2));
      }
    });

    if (Object.keys(filteredBudgets).length === 0) {
      setError("Please enter at least one budget amount.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/budgets/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          month: currentMonth,
          budgets: filteredBudgets,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to save budgets.");

      setSuccessMsg("Budgets saved successfully!");
      setError(null);
    } catch (err) {
      setError(err.message);
      setSuccessMsg(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (successMsg || error) {
      const timer = setTimeout(() => {
        setSuccessMsg(null);
        setError(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg, error]);

  return (
    <div className="budget-container" aria-live="polite" aria-busy={loading}>
      <div className="budget-header">
        <h2>📊 Set Your Monthly Budgets</h2>
      </div>

  <div className="budget-notification" role="alert">
    {allFilled ? (
      <span style={{ color: "green" }}>
        ✅ All categories are filled! You're ready for this month.
      </span>
    ) : (
      <>
        📅 Only <strong>{remainingDays} day{remainingDays !== 1 ? "s" : ""}</strong> left!
        Set your budgets to plan ahead.
      </>
    )}
  </div>



      {loading && <p>Loading...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      {successMsg && <p style={{ color: "green" }}>{successMsg}</p>}

      <div className="budget-list">
        {categories.map(({ name, icon }, index) => (
          <div className="budget-card" key={index}>
            <div className="left">
              <span className="icon">{icon}</span>
              <h4>{name}</h4>
            </div>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00 dt"
              value={budgets[name] || ""}
              onChange={(e) => handleChange(name, e.target.value)}
              disabled={loading || isLocked}
              aria-label={`Budget input for ${name}`}
            />
          </div>
        ))}
      </div>

        <button
        className="save-btn"
        onClick={handleSave}
        disabled={loading} // no more isLocked
        aria-disabled={loading}
        aria-live="polite"
      >
        {loading ? "Saving..." : "Save Budget"}
      </button>

    </div>
  );
}

export default BudgetSetting;
