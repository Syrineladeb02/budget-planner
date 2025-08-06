import React from "react";
import { FaFacebook, FaInstagram, FaLinkedin, FaLink } from "react-icons/fa";
import "./Footer.css"


const Footer = () => {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <p className="footer-text"> Attijari Budget Planner </p>
        <div className="social-icons">
          <a href="https://www.facebook.com/AttijariBankTunisie/?locale=fr_FR" target="_blank" rel="noreferrer">
            <FaFacebook />
          </a>
          <a href="https://www.instagram.com/attijari_bank_tunisie/?hl=fr" target="_blank" rel="noreferrer">
            <FaInstagram />
          </a>
          <a href="https://www.linkedin.com/company/attijari-bank-tunisie/?originalSubdomain=tn" target="_blank" rel="noreferrer">
            <FaLinkedin />
          </a>
          <a href="https://www.attijaribank.com.tn/fr" target="_blank" rel="noreferrer">
            <FaLink />
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
