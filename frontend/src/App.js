import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './screens/Navbar';
import Dashboard from './screens/Dashboard';
import Transactions from './screens/Transactions';
import Reports from './screens/Report';
import BudgetSetting from './screens/BudgetSetting';
import logo from './assets/logo.png';
import { FaSignOutAlt } from "react-icons/fa";
import "./App.css";
import Notification from './screens/Notification';
import 'bootstrap/dist/css/bootstrap.min.css';
import Footer from './screens/Footer'

function App() {
  return (
    
    <Router>
     <div className="header-top">
  <img src={logo} alt="Logo" className="logo" />
  <button className="syrine-btn"><FaSignOutAlt /> Sign out</button>
</div>


      <Navbar />
            <div className="container">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/set-budget" element={<BudgetSetting />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/notification" element={<Notification />} />

        </Routes>
      </div>
   <Footer/>

    </Router>
  );
}

export default App;
