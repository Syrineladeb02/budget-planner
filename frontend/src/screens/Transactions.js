import React, { useState, useEffect } from "react";
import "./Transactions.css";
import { FaPlus, FaEdit } from "react-icons/fa";
import Modal from "react-bootstrap/Modal";
import axios from "axios";
import Select from "react-select";
import { FaCloudUploadAlt } from "react-icons/fa";

function Transactions() {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1; // Ex: juillet → 7
  const userId = 1;

  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(String(currentMonth).padStart(2, "0"));
  const [uploadFile, setUploadFile] = useState(null);
  const [selectedFileName, setSelectedFileName] = useState("");

  const [isCashBreakdownModalOpen, setIsCashBreakdownModalOpen] = useState(false);
  const [cashBreakdownTransactionId, setCashBreakdownTransactionId] = useState(null);
  const [cashBreakdownEntries, setCashBreakdownEntries] = useState([{ category_id: null, amount: "" }]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formMessage, setFormMessage] = useState(null);
  const [modalMode, setModalMode] = useState("add"); // "add" or "edit"
  const [editIndex, setEditIndex] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    date: "",
    category: null,
    amount: ""
  });

  const [isExternalModalOpen, setIsExternalModalOpen] = useState(false);
  const [externalFormData, setExternalFormData] = useState({
    merchant_name: "",
    date: "",
    amount: ""
  });

  const monthsFr = [
    { label: "Janvier", value: "01" },
    { label: "Février", value: "02" },
    { label: "Mars", value: "03" },
    { label: "Avril", value: "04" },
    { label: "Mai", value: "05" },
    { label: "Juin", value: "06" },
    { label: "Juillet", value: "07" },
    { label: "Août", value: "08" },
    { label: "Septembre", value: "09" },
    { label: "Octobre", value: "10" },
    { label: "Novembre", value: "11" },
    { label: "Décembre", value: "12" }
  ];

  useEffect(() => {
    fetchCategories();
    fetchTransactions();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/transactions/categories");
      setCategories(res.data);
    } catch (err) {
      console.error("Erreur chargement catégories:", err);
    }
  };

  // **Fix here: wrap URL string in backticks for template literal**
  const fetchTransactions = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/transactions/user/${userId}`);
      const formatted = res.data.map((txn) => ({
        id: txn.id,
        merchant_name: txn.merchant_name,
        date: txn.date,
        final_category_id: txn.final_category_id,
        // Fix here: amount needs to be a string with " dt" appended, use template literal inside backticks:
        amount: `${txn.amount} dt`
      }));
      setTransactions(formatted);
    } catch (err) {
      console.error("Erreur chargement transactions:", err);
    }
  };

  const openEditModal = (index) => {
    setModalMode("edit");
    setEditIndex(index);
    const t = transactions[index];
    setFormData({
      name: t.merchant_name,
      date: t.date,
      category: t.final_category_id,
      amount: t.amount.replace(" dt", "")
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData({ name: "", date: "", category: null, amount: "" });
    setEditIndex(null);
    setFormMessage(null); // also clear message on close
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCategoryChange = (selectedOption) => {
    setFormData({ ...formData, category: selectedOption ? selectedOption.value : null });
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    const payload = {
      user_id: userId,
      merchant_name: formData.name,
      date: formData.date,
      amount: parseFloat(formData.amount),
      source: "manual",
      final_category_id: formData.category
    };
    try {
      await axios.post("http://localhost:5000/api/transactions/", payload);
      await fetchTransactions();
      handleCloseModal();
    } catch (err) {
      console.error("Erreur ajout:", err.response ? err.response.data : err.message);
    }
  };

  // **Fix URL string in axios.put**
  const handleEditExpense = async (e) => {
    e.preventDefault();
    const transactionId = transactions[editIndex]?.id;

    try {
      const res = await axios.put(`http://localhost:5000/api/transactions/${transactionId}`, {
        final_category_id: formData.category
      });

      setFormMessage({ type: "success", text: res.data.message || "Enregistré avec succès !" });
      await fetchTransactions();

      setTimeout(() => {
        setFormMessage(null);
        handleCloseModal();
      }, 2000);
    } catch (err) {
      setFormMessage({
        type: "error",
        text: "Erreur lors de la mise à jour : " + (err.response?.data?.error || err.message)
      });
      console.error("Erreur update:", err);
    }
  };

  const openExternalModal = () => {
    setExternalFormData({ merchant_name: "", date: "", amount: "" });
    setIsExternalModalOpen(true);
  };

  const closeExternalModal = () => {
    setIsExternalModalOpen(false);
  };

  const handleExternalChange = (e) => {
    setExternalFormData({ ...externalFormData, [e.target.name]: e.target.value });
  };

  const handleExternalSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      user_id: userId,
      merchant_name: externalFormData.merchant_name,
      date: externalFormData.date,
      amount: parseFloat(externalFormData.amount)
    };
    try {
      // Fix alert template literal here: wrap string in backticks
      const res = await axios.post("http://localhost:5000/api/transactions/incoming-transaction", payload);
      alert(`Transaction ajoutée avec catégorie prédite : ${res.data.predicted_category}`);

      if (res.data.needs_cash_detail) {
        setCashBreakdownTransactionId(res.data.transaction_id);
        setCashBreakdownEntries([{ category_id: null, amount: "" }]);
        setIsCashBreakdownModalOpen(true);
      } else {
        await fetchTransactions();
      }

      closeExternalModal();
    } catch (err) {
      console.error("Erreur ajout externe:", err.response ? err.response.data : err.message);
    }
  };

  const filteredTransactions = transactions.filter((t) => {
    const month = new Date(t.date).getMonth() + 1;
    return String(month).padStart(2, "0") === selectedMonth;
  });

  const handleFileChange = (e) => {
    console.log("File selected:", e.target.files[0]);
    setUploadFile(e.target.files[0]);
  };

  const handleFileUpload = async () => {
    console.log("Uploading...");

    if (!uploadFile) {
      alert("Veuillez sélectionner un fichier Excel.");
      return;
    }

    const formData = new FormData();
    formData.append("file", uploadFile);

    try {
      const res = await axios.post(
        "http://localhost:5000/api/transactions/bulk-predict-merchants",
        formData,
        { responseType: "blob" }
      );

      console.log("✅ Upload response:", res);

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;

      // Fix template literal here for file name (wrap in backticks)
      link.setAttribute("download", `predictions_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("❌ Erreur upload fichier:", err);
      alert("Erreur lors du traitement du fichier");
    }
  };

  const handleCashBreakdownChange = (index, field, value) => {
    const updatedEntries = [...cashBreakdownEntries];
    updatedEntries[index][field] = value;
    setCashBreakdownEntries(updatedEntries);
  };

  const addCashBreakdownEntry = () => {
    setCashBreakdownEntries([...cashBreakdownEntries, { category_id: null, amount: "" }]);
  };

  const removeCashBreakdownEntry = (index) => {
    const updatedEntries = [...cashBreakdownEntries];
    updatedEntries.splice(index, 1);
    setCashBreakdownEntries(updatedEntries);
  };

  const handleCashBreakdownSubmit = async (e) => {
    e.preventDefault();

    const validEntries = cashBreakdownEntries.filter(
      (entry) => entry.category_id && parseFloat(entry.amount) > 0
    );

    if (validEntries.length === 0) {
      alert("Veuillez entrer au moins une catégorie valide et un montant supérieur à 0.");
      return;
    }

    try {
      // Fix URL string with backticks
      await axios.post(
        `http://localhost:5000/api/transactions/${cashBreakdownTransactionId}/cash-details`,
        validEntries
      );

      alert("Décomposition enregistrée avec succès !");
      setIsCashBreakdownModalOpen(false);
      setCashBreakdownTransactionId(null);
      setCashBreakdownEntries([{ category_id: null, amount: "" }]);
      await fetchTransactions();
    } catch (err) {
      alert("Erreur lors de l'enregistrement : " + (err.response?.data?.error || err.message));
      console.error("Erreur décomposition:", err);
    }
  };

  return (
    <div className="transactions-container">
      <div className="header">
        <h2>💳 Transactions</h2>
        <div className="filter-container">
          <label htmlFor="month-select" className="filter-label">Mois :</label>
          <select
            id="month-select"
            className="month-select"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            {monthsFr.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <h3 className="title">{monthsFr.find(m => m.value === selectedMonth)?.label}</h3>
      {selectedMonth !== String(currentMonth).padStart(2, "0") && (
        <p style={{ color: "#b00", textAlign: "center", marginBottom: "1rem" }}>
          ⚠️ Vous ne pouvez modifier que les transactions du mois actuel.
        </p>
      )}
      <div className="upload-actions-row">
        <div className="left-side">
          <label htmlFor="excel-file" className="upload-box">
            <FaCloudUploadAlt className="upload-icon" />
            <div className="upload-subtext">Formats acceptés : .xlsx, .xls</div>
            <input
              type="file"
              id="excel-file"
              accept=".xlsx, .xls"
              onChange={(e) => {
                setSelectedFileName(e.target.files[0]?.name || "");
                setUploadFile(e.target.files[0]);
              }}
            />
            {selectedFileName && (
              <div className="upload-file-name">📄 {selectedFileName}</div>
            )}
          </label>

          <button
            onClick={handleFileUpload}
            className="upload-button"
            disabled={!uploadFile}
          >
            📂 Importer le fichier
          </button>
        </div>

        <div className="right-side">
          <button
            className="add-btn"
            onClick={openExternalModal}
            disabled={selectedMonth !== String(currentMonth).padStart(2, "0")}
            title="Ajouter transaction via API externe"
          >
            <FaPlus /> Ajouter (API externe)
          </button>
        </div>
      </div>

      <div className="transaction-list">
        {filteredTransactions.length > 0 ? (
          filteredTransactions.map((t, index) => {
            const categoryObj = categories.find(cat => cat.id === t.final_category_id);
            return (
              <div className="transaction-card" key={t.id || index}>
                <div>
                  <h4>{t.merchant_name}</h4>
                  <p>{t.date}</p>
                </div>
                <div className="right">
                  <span className="category">
                    {categoryObj ? categoryObj.name : "Non défini"}
                  </span>
                  <strong className="amount">{t.amount}</strong>
                  <button
                    className="edit-btn"
                    onClick={() => openEditModal(index)}
                    disabled={selectedMonth !== String(currentMonth).padStart(2, "0")}
                    style={{
                      opacity: selectedMonth !== String(currentMonth).padStart(2, "0") ? 0.5 : 1,
                      cursor: selectedMonth !== String(currentMonth).padStart(2, "0") ? "not-allowed" : "pointer"
                    }}
                  >
                    <FaEdit />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <p style={{ textAlign: "center", color: "#999" }}>
            Aucune transaction ce mois.
          </p>
        )}
      </div>

      {/* Modal for manual add/edit */}
      <Modal show={isModalOpen} onHide={handleCloseModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {modalMode === "add" ? "Ajouter une dépense" : "Modifier la catégorie"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <form onSubmit={modalMode === "add" ? handleAddExpense : handleEditExpense}>
            {modalMode === "add" && (
              <>
                <input
                  type="text"
                  name="name"
                  placeholder="Nom du commerçant"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                />
                <input
                  type="number"
                  name="amount"
                  placeholder="Montant (ex: 50)"
                  value={formData.amount}
                  onChange={handleChange}
                  required
                />
              </>
            )}

            <Select
              options={categories.map(cat => ({ value: cat.id, label: cat.name }))}
              value={categories.find(cat => cat.id === formData.category) ? { value: formData.category, label: categories.find(cat => cat.id === formData.category).name } : null}
              onChange={handleCategoryChange}
              placeholder="Choisir une catégorie"
              isClearable
              required
            />

            <button type="submit" className="submit-btn">
              {modalMode === "add" ? "Ajouter" : "Enregistrer"}
            </button>
            {/* Fix here: use backticks for className expression and proper JSX syntax */}
            {formMessage && (
              <div className={`form-message ${formMessage.type}`}>
                {formMessage.text}
              </div>
            )}
          </form>
        </Modal.Body>
      </Modal>

      {/* Modal for external API add */}
      <Modal show={isExternalModalOpen} onHide={closeExternalModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Ajouter une transaction externe</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <form onSubmit={handleExternalSubmit}>
            <input
              type="text"
              name="merchant_name"
              placeholder="Nom du commerçant"
              value={externalFormData.merchant_name}
              onChange={handleExternalChange}
              required
            />
            <input
              type="date"
              name="date"
              value={externalFormData.date}
              onChange={handleExternalChange}
              required
            />
            <input
              type="number"
              name="amount"
              placeholder="Montant (ex: 50)"
              value={externalFormData.amount}
              onChange={handleExternalChange}
              required
            />
            <button type="submit" className="submit-btn">Envoyer</button>
          </form>
        </Modal.Body>
      </Modal>

      {/* Modal for cash breakdown */}
      <Modal show={isCashBreakdownModalOpen} onHide={() => setIsCashBreakdownModalOpen(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Décomposition de l'argent retiré</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <form onSubmit={handleCashBreakdownSubmit}>
            {cashBreakdownEntries.map((entry, index) => (
              <div key={index} className="cash-breakdown-entry">
                <Select
                  options={categories.map(cat => ({ value: cat.id, label: cat.name }))}
                  value={categories.find(cat => cat.id === entry.category_id) ? { value: entry.category_id, label: categories.find(cat => cat.id === entry.category_id).name } : null}
                  onChange={(selectedOption) => handleCashBreakdownChange(index, 'category_id', selectedOption ? selectedOption.value : null)}
                  placeholder="Catégorie"
                  isClearable
                  required
                  styles={{ container: base => ({ ...base, flex: 2 }) }}
                />
                <input
                  type="number"
                  placeholder="Montant"
                  value={entry.amount}
                  onChange={(e) => handleCashBreakdownChange(index, 'amount', e.target.value)}
                  required
                  min="0.01"
                  step="0.01"
                />
                {cashBreakdownEntries.length > 1 && (
                  <button type="button" onClick={() => removeCashBreakdownEntry(index)}>×</button>
                )}
              </div>
            ))}

            <button type="button" onClick={addCashBreakdownEntry} className="cash-breakdown-add-btn">
              + Ajouter une catégorie
            </button>

            <button type="submit" className="submit-btn">Enregistrer la décomposition</button>
          </form>
        </Modal.Body>
      </Modal>
    </div>
  );
}

export default Transactions;
