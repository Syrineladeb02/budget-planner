import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import "./Dashboard.css";

function getRemainingDaysInMonth() {
  const today = new Date();
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const diffTime = lastDay - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

const Dashboard = () => {
  const userId = 1;
  const navigate = useNavigate();
  const remainingDays = getRemainingDaysInMonth();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Calculate totals safely
  const totalBudget = categories.reduce((sum, cat) => sum + (cat.budget || 0), 0);
  const totalSpent = categories.reduce((sum, cat) => sum + (cat.spent || 0), 0);

  // Calculate total percent used (number, not string)
  const totalUsedPercent = totalBudget > 0
    ? Math.min(100, (totalSpent / totalBudget) * 100)
    : 0;

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/dashboard/${userId}`);
        if (!res.ok) throw new Error("Failed to load dashboard data");
        const data = await res.json();
        setCategories(data);
        setError(null);
      } catch (err) {
        setError(err.message);
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [userId]);

  return (
    <div className="dashboard-container">
      <header className="month-header">
        <h4>📅 {new Date().toLocaleString("default", { month: "long" })}</h4>
        <p>{remainingDays} day{remainingDays > 1 ? "s" : ""} remaining</p>
      </header>

      <h2 className="welcome">Welcome, Syrine 👋</h2>
      <h4 className="track">Track your spending</h4>

      {loading && <p>Loading dashboard...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && !error && (
        <main className="dashboard-main">
          {/* Left summary panel */}
          <section className="summary-panel">
            <div className="circle-progress-glow">
              <CircularProgressbar
                value={totalUsedPercent}
                text={`${totalUsedPercent.toFixed(2)}%`}
                styles={buildStyles({
                  pathColor: "url(#attijariGradient)",
                  trailColor: "#eee",
                  textColor: "#1e1e1e",
                  textSize: "24px",
                  pathTransitionDuration: 1,
                })}
              />
              <svg style={{ height: 0 }}>
                <defs>
                  <linearGradient id="attijariGradient" gradientTransform="rotate(90)">
                    <stop offset="0%" stopColor="#ff5e3a" />
                    <stop offset="100%" stopColor="#ffae00" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="summary-details">
              <p className="spent-amount">{totalSpent.toFixed(2)} dt spent</p>
              <p className="budget-amount">of {totalBudget.toFixed(2)} dt budget</p>
              <p className="progress-note">Total monthly spending</p>
            </div>
          </section>

          {/* Right category breakdown */}
          <section className="right-panel">
            <div className="category-bars">
              {categories.map((cat, idx) => {
                // Calculate category percentage used correctly (number)
                const percentUsed = cat.budget > 0
                  ? Math.min(100, (cat.spent / cat.budget) * 100)
                  : 0;

                return (
                  <div
                    className="category-item"
                    key={idx}
                    title={`Spent ${cat.spent.toFixed(2)} dt of ${cat.budget.toFixed(2)} dt`}
                  >
                    <span className="name">{cat.icon} {cat.category}</span>
                    <div className="bar">
                      <div
                        className={`fill ${percentUsed > 100 ? "over" : ""}`}
                        style={{ width: `${percentUsed}%` }}
                      />
                    </div>
                    <div className="amounts">
                      <span className="spent">{cat.spent.toFixed(2)} dt</span> /{" "}
                      <span className="budget">{cat.budget.toFixed(2)} dt</span>{" "}
                      <span className="percent-used">({percentUsed.toFixed(2)}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="generate-buttons">
              <button className="generate-btn" onClick={() => navigate("/reports")}>
                Generate Report
              </button>
              <button className="budget-btn" onClick={() => navigate("/set-budget")}>
                Set Budget
              </button>
            </div>
          </section>
        </main>
      )}
    </div>
  );
};

export default Dashboard;
