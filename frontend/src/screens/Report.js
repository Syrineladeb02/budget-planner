import React, { useRef, useEffect, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { ArrowDownToLine } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import './Report.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function Report() {
  const reportRef = useRef();
  const [reportData, setReportData] = useState([]);

  useEffect(() => {
    fetch("/api/report/1") // Replace with dynamic user ID if needed
      .then((res) => res.json())
      .then((data) => setReportData(data))
      .catch((err) => console.error("Failed to fetch report:", err));
  }, []);

  const chartData = {
    labels: reportData.map((d) => d.category),
    datasets: [
      {
        label: "Budget",
        data: reportData.map((d) => d.budget),
        backgroundColor: "#d3d3d3",
      },
      {
        label: "Spent",
        data: reportData.map((d) => d.spent),
        backgroundColor: "#ff5e3a",
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: "Budget vs Spending - June 2025",
        font: {
          size: 18,
        },
      },
    },
    scales: {
      x: {
        type: "category",
        title: {
          display: true,
          text: "Category",
        },
      },
      y: {
        type: "linear",
        beginAtZero: true,
        title: {
          display: true,
          text: "Amount (dt)",
        },
      },
    },
  };

  function getAdviceClass(advice) {
    if (advice.includes("reduce")) return "red";
    if (advice.includes("close")) return "orange";
    return "green";
  }

  const handleDownloadPDF = () => {
    const input = reportRef.current;
    html2canvas(input, { scale: 2 }).then((canvas) => {
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save("Monthly_Report_June_2025.pdf");
    });
  };

  return (
    <div className="report-container" ref={reportRef}>
      <div className="report-header">
        <h2>📈 Monthly Report - June 2025</h2>
        <button className="download-btn" onClick={handleDownloadPDF}>
          <ArrowDownToLine size={18} /> Download Report
        </button>
      </div>

      <div className="report-chart">
        <Bar data={chartData} options={chartOptions} />
      </div>

      <div className="advice-section">
        {reportData.map((item, idx) => (
          <div className="advice-card" key={idx}>
            <div className="advice-left">
              <h4>{item.category}</h4>
              <p><strong>Budget:</strong> {item.budget} dt</p>
              <p><strong>Spent:</strong> {item.spent} dt</p>
            </div>
            <p className={`advice-tag ${getAdviceClass(item.advice)}`}>{item.advice}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Report;
