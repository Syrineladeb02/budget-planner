import React, { useEffect, useState, useRef } from "react";
import "./Notification.css";
import { BellRing } from "lucide-react";
import axios from "axios";

function Notifications() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [popupAlert, setPopupAlert] = useState(null);
  const popupTimeout = useRef(null);

  // TODO: Replace this with actual logged-in user ID from auth context or props
  const userId = 1;

  useEffect(() => {
    async function fetchAlerts() {
      try {
        const response = await axios.get(`http://localhost:5000/api/notifications/${userId}`);
        setAlerts(response.data);

        // Show popup alert if any category >= 100% budget used
        const urgent = response.data.find(alert => alert.percent_used >= 100);
        if (urgent) {
          setPopupAlert(urgent.message);

          if (popupTimeout.current) clearTimeout(popupTimeout.current);
          popupTimeout.current = setTimeout(() => {
            setPopupAlert(null);
            popupTimeout.current = null;
          }, 5000);
        }
      } catch (err) {
        console.error("Error fetching notifications:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchAlerts();

    const interval = setInterval(fetchAlerts, 10000); // Poll every 10 seconds

    return () => {
      clearInterval(interval);
      if (popupTimeout.current) clearTimeout(popupTimeout.current);
    };
  }, [userId]);

  return (
    <>
      {/* Popup alert banner */}
      {popupAlert && (
        <div className="popup-alert" role="alert">
          🚨 {popupAlert}
          <button
            onClick={() => setPopupAlert(null)}
            aria-label="Close alert"
          >
            ✖
          </button>
        </div>
      )}

      {/* Main notification panel */}
      <div className="notifications-container">
        <div className="notif-header">
          <h2>
            <BellRing size={28} style={{ marginRight: "10px" }} />
            Budget Notifications
          </h2>
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : alerts.length > 0 ? (
          <div className="notif-list">
            {alerts.map((item, idx) => {
              const over = item.percent_used - 100;
              return (
                <div key={idx} className="notif-card">
                  <div className="notif-top">
                    <h3>{item.category}</h3>
                    <span className="overspent">+{Math.round(over)}%</span>
                  </div>
                  <p className="notif-message">{item.message}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="notif-happy">
            🎉 You're within your budget for all categories. Keep it up!
          </div>
        )}
      </div>
    </>
  );
}

export default Notifications;
