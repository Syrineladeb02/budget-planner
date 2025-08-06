import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import './Navbar.css';
import axios from 'axios';

function Navbar() {
  const [notifCount, setNotifCount] = useState(0);
  const userId = 1; // Replace with real user ID if needed

  useEffect(() => {
    async function fetchNotifCount() {
      try {
        const res = await axios.get(`http://localhost:5000/api/notifications/${userId}`);
        if (Array.isArray(res.data)) {
          setNotifCount(res.data.length);
        }
      } catch (err) {
        console.error("Error fetching notification count:", err);
      }
    }

    fetchNotifCount();
  }, [userId]);

  return (
    <nav className="navbar">
      <ul className="navbar-links">
        <li><NavLink to="/" end>Dashboard</NavLink></li>
        <li><NavLink to="/transactions">Transactions</NavLink></li>
        <li><NavLink to="/set-budget">Set Budget</NavLink></li>
        <li><NavLink to="/reports">Reports</NavLink></li>

        <li className="notification-wrapper">
          <NavLink to="/notification" className="notification-link">⚠️</NavLink>
          {notifCount > 0 && <span className="notif-badge">{notifCount}</span>}
        </li>
      </ul>
    </nav>
  );
}

export default Navbar;
