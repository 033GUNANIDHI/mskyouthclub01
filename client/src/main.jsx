import React, { useEffect, useState, useMemo } from "react";
import { createRoot } from "react-dom/client";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { api, API_URL, setAuth, clearAuth, getUser } from "./api.js";
import "./styles.css";

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function money(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function dateText(value) {
  return value ? new Date(value).toLocaleDateString("en-IN") : "-";
}

function cleanPhone(phone) {
  if (!phone) return "";
  let digits = String(phone).replace(/\D/g, "");
  if (digits.length === 10) {
    digits = "91" + digits;
  }
  return digits;
}

function openWhatsAppReminder(member, monthName, year, balance) {
  const phone = cleanPhone(member.phone);
  if (!phone) {
    alert(`No phone number available for ${member.name}. Please edit the member profile and add their mobile number.`);
    return;
  }
  const text = `வணக்கம் ${member.name},\n\nMSK Youth Club மாத சந்தா விவரம்:\nமாதம்: ${monthName} ${year}\nபாக்கி தொகை: ₹${Number(balance).toLocaleString("en-IN")}\n\nதயவுசெய்து விரைவில் செலுத்தவும்.\nநன்றி!\n- MSK Youth Club`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
}

function openWhatsAppReceipt(p, memberName, phoneNum) {
  const phone = cleanPhone(phoneNum);
  const text = `வணக்கம் ${memberName},\n\nMSK Youth Club சந்தா ரசீது:\nரசீது எண்: #${String(p._id).slice(-8).toUpperCase()}\nமாதம்: ${months[p.month - 1]} ${p.year}\nசெலுத்திய தொகை: ₹${Number(p.amount).toLocaleString("en-IN")}\nதேதி: ${dateText(p.paidAt)}\n\nதொகை பெறப்பட்டது. நன்றி!\n- MSK Youth Club`;
  if (phone) {
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }
}

function downloadExcel(filename, rows) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "MSK Youth Club");
  const output = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(
    new Blob([output], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }),
    filename
  );
}

function downloadPdf(title, columns, rows, filename) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 18);
  autoTable(doc, {
    startY: 25,
    head: [columns],
    body: rows,
    styles: { fontSize: 8.5 }
  });
  doc.save(filename);
}

function downloadReceiptPdf(p, memberName) {
  const doc = new jsPDF();
  const receiptId = String(p._id || "").slice(-8).toUpperCase() || "REC-" + Date.now().toString().slice(-6);

  // Top header banner
  doc.setFillColor(14, 26, 46);
  doc.rect(0, 0, 210, 36, "F");

  doc.setTextColor(212, 160, 52);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("MSK YOUTH CLUB", 14, 18);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10.5);
  doc.setFont("helvetica", "normal");
  doc.text("OFFICIAL PAYMENT RECEIPT", 14, 27);

  doc.setFontSize(9.5);
  doc.text(`Receipt: #${receiptId}`, 150, 18);
  doc.text(`Date: ${dateText(p.paidAt || new Date())}`, 150, 26);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.text("Received with thanks from:", 14, 50);

  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text(memberName || p.member?.name || "Club Member", 14, 58);

  autoTable(doc, {
    startY: 66,
    head: [["Description", "Period", "Payment Date", "Amount Paid"]],
    body: [
      [
        "Monthly Membership Subscription",
        `${months[p.month - 1]} ${p.year}`,
        dateText(p.paidAt),
        money(p.amount)
      ]
    ],
    theme: "striped",
    headStyles: { fillColor: [14, 26, 46], textColor: [255, 255, 255], fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 6 }
  });

  const finalY = doc.lastAutoTable?.finalY || 105;

  if (p.note) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Note: ${p.note}`, 14, finalY + 12);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(14, 26, 46);
  doc.text("Authorized Signature", 145, finalY + 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("MSK Youth Club Management", 145, finalY + 38);

  doc.save(`MSK-Receipt-${receiptId}.pdf`);
}

function downloadStatementPdf(member, statement) {
  const doc = new jsPDF();

  doc.setFillColor(14, 26, 46);
  doc.rect(0, 0, 210, 36, "F");

  doc.setTextColor(212, 160, 52);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("MSK YOUTH CLUB", 14, 18);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("MEMBER ACCOUNT STATEMENT", 14, 26);
  doc.text(`Date: ${new Date().toLocaleDateString("en-IN")}`, 150, 26);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(`Member: ${member.name}`, 14, 46);

  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`Email: ${member.email}  |  Phone: ${member.phone || "N/A"}  |  Monthly Fee: ${money(member.monthlyAmount)}`, 14, 53);
  doc.text(`Total Paid: ${money(statement.totalPaid)}  |  Total Pending: ${money(statement.pendingAmount)}  |  Pending Months: ${statement.pendingMonths}`, 14, 60);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(14, 26, 46);
  doc.text("Pending Months Dues", 14, 72);

  const pendingRows = (statement.pendingMonthList || []).map(p => [
    months[p.month - 1],
    String(p.year),
    money(p.monthlyAmount),
    money(p.paidAmount),
    money(p.remainingAmount)
  ]);

  autoTable(doc, {
    startY: 76,
    head: [["Month", "Year", "Monthly Fee", "Paid", "Balance"]],
    body: pendingRows.length ? pendingRows : [["All dues cleared!", "-", "-", "-", "-"]],
    theme: "striped",
    headStyles: { fillColor: [14, 26, 46], textColor: [255, 255, 255] },
    styles: { fontSize: 8.5 }
  });

  const nextY = (doc.lastAutoTable?.finalY || 120) + 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(14, 26, 46);
  doc.text("Payment History", 14, nextY);

  const paymentRows = (statement.payments || []).map(p => [
    months[p.month - 1],
    String(p.year),
    money(p.amount),
    dateText(p.paidAt),
    p.note || "-"
  ]);

  autoTable(doc, {
    startY: nextY + 4,
    head: [["Month", "Year", "Amount Paid", "Paid Date", "Note"]],
    body: paymentRows.length ? paymentRows : [["No payments recorded", "-", "-", "-", "-"]],
    theme: "striped",
    headStyles: { fillColor: [8, 127, 140], textColor: [255, 255, 255] },
    styles: { fontSize: 8.5 }
  });

  doc.save(`MSK-Statement-${member.name.replace(/\s+/g, "_")}.pdf`);
}

/* ==========================================================================
   Toast Notification Component
   ========================================================================== */
function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type || "success"}`}>
          <span>
            {t.type === "error" ? "⚠️ " : t.type === "info" ? "ℹ️ " : "✓ "}
            {t.message}
          </span>
          <button className="toast-close" onClick={() => removeToast(t.id)} aria-label="Close">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

/* ==========================================================================
   Modals
   ========================================================================== */
function Modal({ title, subtitle, isOpen, onClose, children, footer, isLarge }) {
  if (!isOpen) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal-box ${isLarge ? "modal-lg" : ""}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

function ChangePasswordModal({ isOpen, onClose, showToast }) {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      showToast("New passwords do not match", "error");
      return;
    }
    if (form.newPassword.length < 6) {
      showToast("New password must be at least 6 characters", "error");
      return;
    }
    setLoading(true);
    try {
      await api("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword
        })
      });
      showToast("Password updated successfully!", "success");
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      onClose();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title="🔑 Change Password"
      subtitle="Update your MSK Youth Club account password"
      isOpen={isOpen}
      onClose={onClose}
    >
      <form onSubmit={submit} className="form">
        <label>
          Current Password
          <input
            type="password"
            value={form.currentPassword}
            onChange={e => setForm({ ...form, currentPassword: e.target.value })}
            required
            placeholder="Enter current password"
          />
        </label>
        <label>
          New Password (min 6 characters)
          <input
            type="password"
            value={form.newPassword}
            onChange={e => setForm({ ...form, newPassword: e.target.value })}
            required
            placeholder="Enter new password"
          />
        </label>
        <label>
          Confirm New Password
          <input
            type="password"
            value={form.confirmPassword}
            onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
            required
            placeholder="Re-type new password"
          />
        </label>
        <div className="button-row" style={{ marginTop: "14px", justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} className="secondary">Cancel</button>
          <button type="submit" className="primary" disabled={loading}>
            {loading ? "Updating..." : "Update Password"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditMemberModal({ member, isOpen, onClose, onUpdated, showToast }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", monthlyAmount: "", password: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (member) {
      setForm({
        name: member.name || "",
        email: member.email || "",
        phone: member.phone || "",
        monthlyAmount: member.monthlyAmount ?? 0,
        password: ""
      });
    }
  }, [member]);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        monthlyAmount: Number(form.monthlyAmount || 0)
      };
      if (form.password.trim()) {
        payload.password = form.password.trim();
      }
      await api(`/admin/members/${member._id}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      showToast(`Member ${payload.name} updated successfully`, "success");
      onUpdated();
      onClose();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title="✏️ Edit Member Profile"
      subtitle={`Update details for ${member?.name || "member"}`}
      isOpen={isOpen}
      onClose={onClose}
    >
      <form onSubmit={submit} className="form">
        <label>
          Full Name
          <input
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            required
          />
        </label>
        <label>
          Email (Username for login)
          <input
            type="email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            required
          />
        </label>
        <label>
          Phone Number (for WhatsApp reminders)
          <input
            placeholder="e.g. 9876543210"
            value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })}
          />
        </label>
        <label>
          Monthly Contribution Amount (₹)
          <input
            type="number"
            min="0"
            value={form.monthlyAmount}
            onChange={e => setForm({ ...form, monthlyAmount: e.target.value })}
            required
          />
        </label>
        <label>
          Reset Password (leave empty to keep current)
          <input
            type="password"
            placeholder="New password (optional)"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
          />
        </label>
        <div className="button-row" style={{ marginTop: "14px", justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} className="secondary">Cancel</button>
          <button type="submit" className="primary" disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function MemberStatementModal({ member, isOpen, onClose, showToast }) {
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && member) {
      setLoading(true);
      api(`/admin/members/${member._id}/statement`)
        .then(data => setStatement(data))
        .catch(err => showToast(err.message, "error"))
        .finally(() => setLoading(false));
    } else {
      setStatement(null);
    }
  }, [isOpen, member]);

  return (
    <Modal
      title={`📋 Member Statement: ${member?.name || ""}`}
      subtitle={`Lifetime payment summary and dues breakdown`}
      isOpen={isOpen}
      onClose={onClose}
      isLarge
      footer={
        statement ? (
          <div className="button-row">
            <button
              className="wa-btn"
              onClick={() => {
                const pending = statement.pendingAmount || 0;
                const text = `வணக்கம் ${member.name},\n\nMSK Youth Club கணக்கு விவரம்:\nமொத்த செலுத்திய தொகை: ${money(statement.totalPaid)}\nபாக்கி தொகை: ${money(pending)}\nபாக்கி மாதங்கள்: ${statement.pendingMonths}\n\nநன்றி!\n- MSK Youth Club`;
                const phone = cleanPhone(member.phone);
                if (phone) {
                  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
                } else {
                  alert("Please add a phone number for this member to send via WhatsApp.");
                }
              }}
            >
              💬 Send WhatsApp Statement
            </button>
            <button
              className="primary"
              onClick={() => downloadStatementPdf(member, statement)}
            >
              📄 Download Statement PDF
            </button>
          </div>
        ) : null
      }
    >
      {loading ? (
        <p>Loading member statement...</p>
      ) : statement ? (
        <div>
          <div className="stats" style={{ marginBottom: "18px" }}>
            <div className="stat stat-emerald">
              <small>Total Paid</small>
              <strong>{money(statement.totalPaid)}</strong>
            </div>
            <div className="stat stat-rose">
              <small>Total Pending</small>
              <strong>{money(statement.pendingAmount)}</strong>
            </div>
            <div className="stat">
              <small>Pending Months</small>
              <strong>{statement.pendingMonths}</strong>
            </div>
            <div className="stat stat-gold">
              <small>Monthly Fee</small>
              <strong>{money(member.monthlyAmount)}</strong>
            </div>
          </div>

          <h3 style={{ margin: "18px 0 8px", fontSize: "16px" }}>Pending Months Breakdown</h3>
          <div className="table-wrap" style={{ maxHeight: "200px" }}>
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Year</th>
                  <th>Monthly Fee</th>
                  <th>Paid</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {(statement.pendingMonthList || []).length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: "center", color: "#10b981", fontWeight: 700 }}>🎉 No pending dues! All months cleared.</td></tr>
                ) : (
                  statement.pendingMonthList.map(item => (
                    <tr key={`${item.year}-${item.month}`}>
                      <td>{months[item.month - 1]}</td>
                      <td>{item.year}</td>
                      <td>{money(item.monthlyAmount)}</td>
                      <td>{money(item.paidAmount)}</td>
                      <td><span className="badge badge-pending">{money(item.remainingAmount)}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <h3 style={{ margin: "22px 0 8px", fontSize: "16px" }}>Payment Records ({statement.payments.length})</h3>
          <div className="table-wrap" style={{ maxHeight: "220px" }}>
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Year</th>
                  <th>Amount</th>
                  <th>Paid Date</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {statement.payments.length === 0 ? (
                  <tr><td colSpan="5">No payment history yet.</td></tr>
                ) : (
                  statement.payments.map(p => (
                    <tr key={p._id}>
                      <td>{months[p.month - 1]}</td>
                      <td>{p.year}</td>
                      <td><strong>{money(p.amount)}</strong></td>
                      <td>{dateText(p.paidAt)}</td>
                      <td>{p.note || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p>No statement data available.</p>
      )}
    </Modal>
  );
}

function EditPaymentModal({ payment, members, isOpen, onClose, onUpdated, showToast }) {
  const [form, setForm] = useState({
    memberId: "",
    month: 1,
    year: new Date().getFullYear(),
    amount: "",
    paidAt: "",
    note: ""
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (payment) {
      setForm({
        memberId: payment.member?._id || payment.member || "",
        month: payment.month,
        year: payment.year,
        amount: String(payment.amount),
        paidAt: payment.paidAt ? new Date(payment.paidAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        note: payment.note || ""
      });
    }
  }, [payment]);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api(`/admin/payments/${payment._id}`, {
        method: "PATCH",
        body: JSON.stringify({
          memberId: form.memberId,
          month: Number(form.month),
          year: Number(form.year),
          amount: Number(form.amount),
          paidAt: form.paidAt,
          note: form.note || ""
        })
      });
      showToast("Payment record updated successfully", "success");
      onUpdated();
      onClose();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title="✏️ Edit Payment Record"
      subtitle="Modify payment details or set to ₹0 to mark as pending"
      isOpen={isOpen}
      onClose={onClose}
    >
      <form onSubmit={submit} className="form">
        <label>
          Member
          <select value={form.memberId} onChange={e => setForm({ ...form, memberId: e.target.value })} required>
            {members.map(m => (
              <option key={m._id} value={m._id}>{m.name}</option>
            ))}
          </select>
        </label>
        <div className="form-grid-2">
          <label>
            Month
            <select value={form.month} onChange={e => setForm({ ...form, month: Number(e.target.value) })}>
              {months.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </label>
          <label>
            Year
            <input
              type="number"
              value={form.year}
              onChange={e => setForm({ ...form, year: Number(e.target.value) })}
              required
            />
          </label>
        </div>
        <label>
          Amount (₹)
          <input
            type="number"
            min="0"
            value={form.amount}
            onChange={e => setForm({ ...form, amount: e.target.value })}
            required
          />
        </label>
        <label>
          Paid Date
          <input
            type="date"
            value={form.paidAt}
            onChange={e => setForm({ ...form, paidAt: e.target.value })}
            required
          />
        </label>
        <label>
          Note (optional)
          <input
            value={form.note}
            onChange={e => setForm({ ...form, note: e.target.value })}
            placeholder="e.g. GPay / Cash"
          />
        </label>
        <div className="button-row" style={{ marginTop: "14px", justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} className="secondary">Cancel</button>
          <button type="submit" className="primary" disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditFinanceModal({ item, type, isOpen, onClose, onUpdated, showToast }) {
  const [form, setForm] = useState({ title: "", amount: "", category: "General", date: "", note: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (item) {
      setForm({
        title: item.title || "",
        amount: String(item.amount || ""),
        category: item.category || "General",
        date: item.date ? new Date(item.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        note: item.note || ""
      });
    }
  }, [item]);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    const endpoint = type === "income" ? `/admin/incomes/${item._id}` : `/admin/expenses/${item._id}`;
    try {
      await api(endpoint, {
        method: "PATCH",
        body: JSON.stringify({
          title: form.title.trim(),
          amount: Number(form.amount),
          category: form.category.trim() || "General",
          date: form.date,
          note: form.note.trim()
        })
      });
      showToast(`${type === "income" ? "Varavu" : "Selavu"} updated successfully`, "success");
      onUpdated();
      onClose();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title={type === "income" ? "✏️ Edit Varavu (Income)" : "✏️ Edit Selavu (Expense)"}
      subtitle="Update entry details"
      isOpen={isOpen}
      onClose={onClose}
    >
      <form onSubmit={submit} className="form">
        <label>
          Title
          <input
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            required
          />
        </label>
        <label>
          Amount (₹)
          <input
            type="number"
            min="0"
            value={form.amount}
            onChange={e => setForm({ ...form, amount: e.target.value })}
            required
          />
        </label>
        <label>
          Category
          <input
            value={form.category}
            onChange={e => setForm({ ...form, category: e.target.value })}
          />
        </label>
        <label>
          Date
          <input
            type="date"
            value={form.date}
            onChange={e => setForm({ ...form, date: e.target.value })}
            required
          />
        </label>
        <label>
          Note (optional)
          <input
            value={form.note}
            onChange={e => setForm({ ...form, note: e.target.value })}
          />
        </label>
        <div className="button-row" style={{ marginTop: "14px", justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} className="secondary">Cancel</button>
          <button type="submit" className="primary" disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ==========================================================================
   PWA Installation & Social Share Helpers
   ========================================================================== */
async function shareApp(showToast) {
  const url = window.location.origin;
  const shareText = `வணக்கம் தோழர்களே! 🌟\n\nநமது MSK Youth Club அதிகாரப்பூர்வ மொபைல் போர்ட்டல் & ஆப்!\nமாத சந்தா விவரங்கள், வரவு-செலவு கணக்குகள் மற்றும் ரசீதுகளை எளிதாக பார்க்க:\n🔗 ${url}\n\n(இணைப்பை திறந்து 'Install App' கொடுத்து உங்கள் போனில் ஆப் போல வைத்துக் கொள்ளலாம்!)\n- MSK Youth Club`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: "MSK Youth Club Portal",
        text: shareText,
        url: url
      });
      if (showToast) showToast("Link shared successfully!", "success");
      return;
    } catch (err) {
      if (err.name !== "AbortError") {
        console.log("Share failed:", err);
      }
    }
  }

  // Fallback directly to WhatsApp
  window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
}

function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) {
      setIsInstalled(true);
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function install() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setDeferredPrompt(null);
      }
    } else {
      alert("📲 MSK Club App-ஐ Install செய்ய:\n\n• Android Chrome: மூன்று புள்ளிகளை (⋮) தொட்டு 'Add to Home Screen' அல்லது 'Install App' கொடுக்கவும்.\n\n• iPhone Safari: கீழே உள்ள Share (⎋) ஐகானை தொட்டு 'Add to Home Screen' (+) கொடுக்கவும்.");
    }
  }

  return { install, canInstall: !isInstalled, isInstalled };
}

/* ==========================================================================
   Header & Navigation
   ========================================================================== */
function Layout({ user, onLogout, showToast, children }) {
  const [pwModal, setPwModal] = useState(false);
  const { install, canInstall } = usePwaInstall();

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo top-logo" src="/msk-logo.jfif" alt="MSK Youth Club Logo" />
          <div className="brand-text">
            <span className="brand-title">MSK Youth Club</span>
            <span className="brand-subtitle">Financial & Member Portal</span>
          </div>
        </div>

        <div className="topbar-actions">
          <div className="user-badge">
            <div className="user-avatar">{user.name?.charAt(0).toUpperCase() || "U"}</div>
            <div className="user-info">
              <span className="user-name">{user.name}</span>
              <span className="role-pill">{user.role}</span>
            </div>
          </div>

          {canInstall && (
            <button
              className="topbar-btn install-btn"
              onClick={install}
              title="Install MSK Club App on your device"
            >
              📲 App
            </button>
          )}

          <button
            className="topbar-btn"
            onClick={() => shareApp(showToast)}
            title="Share App on WhatsApp, Telegram, etc."
          >
            📤 Share
          </button>

          <button
            className="topbar-btn"
            onClick={() => setPwModal(true)}
            title="Change Password"
          >
            🔑 Password
          </button>

          <button onClick={onLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </header>

      <main className="container">{children}</main>

      <ChangePasswordModal
        isOpen={pwModal}
        onClose={() => setPwModal(false)}
        showToast={showToast}
      />
    </>
  );
}

/* ==========================================================================
   Login Component
   ========================================================================== */
function Login({ onLogin, showToast }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { install, canInstall } = usePwaInstall();

  async function submit(e) {
    e.preventDefault();
    if (loading) return;

    setError("");
    setLoading(true);

    try {
      const email = form.email.trim().toLowerCase();
      const password = form.password;
      const data = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });

      if (!data?.token || !data?.user) {
        throw new Error("Login response is incomplete. Please try again.");
      }

      setAuth(data.token, data.user);
      showToast(`Welcome back, ${data.user.name}!`, "success");
      onLogin(data.user);
    } catch (err) {
      const msg = err?.message || "Unable to log in. Please try again.";
      setError(
        msg === "Failed to fetch"
          ? "Server-ai connect panna mudiyavillai. Internet connection-um backend API status-um check pannunga."
          : msg
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <img className="brand-logo login-logo" src="/msk-logo.jfif" alt="MSK Youth Club Logo" />
        <h1>MSK Youth Club</h1>
        <p>Member & Admin Management Portal</p>

        {error && <div className="toast-error" style={{ padding: "10px", borderRadius: "10px", marginBottom: "12px", fontSize: "13px" }}>{error}</div>}

        <label>
          Email ID
          <input
            placeholder="admin@mskyouthclub.local or member email"
            type="email"
            autoComplete="username"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            required
            disabled={loading}
          />
        </label>

        <label style={{ marginTop: "8px" }}>
          Password
          <input
            placeholder="Enter password"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            required
            disabled={loading}
          />
        </label>

        <button className="primary full" type="submit" disabled={loading} style={{ marginTop: "16px" }}>
          {loading ? "Signing in..." : "Sign In to MSK Youth Club"}
        </button>

        {canInstall && (
          <button
            type="button"
            className="secondary full"
            onClick={install}
            style={{ marginTop: "10px", borderColor: "rgba(212, 160, 52, 0.4)", color: "var(--msk-navy)", fontWeight: 650 }}
          >
            📲 Install MSK Club App on Phone
          </button>
        )}

        <button
          type="button"
          className="wa-btn full"
          onClick={() => shareApp(showToast)}
          style={{ marginTop: "10px" }}
        >
          💬 Share App Link via WhatsApp
        </button>
      </form>
    </div>
  );
}

/* ==========================================================================
   Member Dashboard
   ========================================================================== */
function MemberDashboard({ showToast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      const overview = await api("/member/overview");
      const myId = String(overview.member?.id || "");
      setData({
        ...overview,
        payments: (overview.payments || []).filter(p => String(p.member?._id || p.member) === myId)
      });
    } catch (e) {
      setError(e.message);
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "60px" }}>
        <p style={{ fontSize: "16px", color: "var(--msk-muted)" }}>Loading your member dashboard...</p>
      </div>
    );
  }

  if (error) return <div className="toast-error" style={{ padding: "14px", borderRadius: "12px" }}>{error}</div>;
  if (!data) return null;

  const paymentRows = data.payments.map(p => ({
    Month: months[p.month - 1],
    Year: p.year,
    Amount: p.amount,
    "Paid Date": dateText(p.paidAt),
    Note: p.note || ""
  }));

  const duesPercent = data.expectedAmount > 0
    ? Math.min(100, Math.round((data.totalPaid / data.expectedAmount) * 100))
    : 100;

  return (
    <section>
      <div className="page-title">
        <div>
          <h1>Welcome, {data.member.name} 👋</h1>
          <p>Your MSK Youth Club membership overview and dues status</p>
        </div>

        <div className="download-actions">
          <button className="secondary" onClick={() => downloadExcel("my-payments.xlsx", paymentRows)}>
            📗 Export Excel
          </button>
          <button className="primary" onClick={() =>
            downloadPdf(
              "MSK Youth Club - My Payment History",
              ["Month", "Year", "Amount", "Paid Date", "Note"],
              data.payments.map(p => [
                months[p.month - 1],
                p.year,
                money(p.amount),
                dateText(p.paidAt),
                p.note || "-"
              ]),
              "my-payment-history.pdf"
            )
          }>
            📄 Download Statement PDF
          </button>
        </div>
      </div>

      <div className="stats">
        <div className="stat stat-emerald">
          <small>My Total Paid</small>
          <strong>{money(data.totalPaid)}</strong>
          <span className="stat-desc">Lifetime payments cleared</span>
        </div>
        <div className="stat stat-rose">
          <small>My Pending Dues</small>
          <strong>{money(data.pendingAmount)}</strong>
          <span className="stat-desc">{data.pendingMonths} month{data.pendingMonths === 1 ? "" : "s"} due</span>
        </div>
        <div className="stat stat-gold">
          <small>Monthly Subscription</small>
          <strong>{money(data.member.monthlyAmount)}</strong>
          <span className="stat-desc">Regular monthly amount</span>
        </div>
        <div className="stat">
          <small>Dues Cleared</small>
          <strong>{duesPercent}%</strong>
          <span className="stat-desc">Contribution progress</span>
        </div>
      </div>

      {/* Dues Progress Bar */}
      <div className="card">
        <div className="progress-header">
          <span>Membership Contribution Clearance</span>
          <span style={{ color: duesPercent >= 100 ? "#10b981" : "#f59e0b", fontWeight: 700 }}>
            {duesPercent >= 100 ? "🎉 Fully Cleared" : `${money(data.totalPaid)} of ${money(data.expectedAmount)} paid (${duesPercent}%)`}
          </span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${duesPercent}%` }}></div>
        </div>
      </div>

      {/* Month-wise Pending Table */}
      <div className="card">
        <div className="card-head">
          <div>
            <h2>⏳ Month-wise Pending Dues</h2>
            <p>Months requiring subscription payment. ₹0 or partial payment remains pending until cleared.</p>
          </div>
          {data.pendingMonths > 0 && (
            <span className="count-badge pending-count">{data.pendingMonths}</span>
          )}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Year</th>
                <th>Monthly Fee</th>
                <th>Amount Paid</th>
                <th>Balance Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(data.pendingMonthList || []).length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center", padding: "24px", color: "#10b981", fontWeight: 700 }}>
                    🎉 No pending dues! You are completely up to date. Thank you for supporting MSK Youth Club!
                  </td>
                </tr>
              ) : (
                data.pendingMonthList.map(item => (
                  <tr key={`${item.year}-${item.month}`}>
                    <td><strong>{months[item.month - 1]}</strong></td>
                    <td>{item.year}</td>
                    <td>{money(item.monthlyAmount)}</td>
                    <td>{money(item.paidAmount)}</td>
                    <td><strong style={{ color: "#e11d48" }}>{money(item.remainingAmount)}</strong></td>
                    <td>
                      <span className={`badge ${item.paidAmount > 0 ? "badge-partial" : "badge-pending"}`}>
                        {item.paidAmount > 0 ? "Partial" : "Pending"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* My Payment History */}
      <div className="card">
        <div className="card-head">
          <div>
            <h2>💳 My Payment History</h2>
            <p>All recorded payments with date, amount and official receipt download</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Year</th>
                <th>Amount</th>
                <th>Paid Date</th>
                <th>Note</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.length === 0 ? (
                <tr><td colSpan="6">No payments recorded yet.</td></tr>
              ) : (
                data.payments.map(p => (
                  <tr key={p._id}>
                    <td>{months[p.month - 1]}</td>
                    <td>{p.year}</td>
                    <td><strong>{money(p.amount)}</strong></td>
                    <td>{dateText(p.paidAt)}</td>
                    <td>{p.note || "-"}</td>
                    <td>
                      <button
                        className="btn-sm secondary"
                        onClick={() => downloadReceiptPdf(p, data.member.name)}
                      >
                        📄 Download Receipt
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Club Financial Transparency */}
      <div className="page-title" style={{ marginTop: "36px" }}>
        <div>
          <h2>🏛️ Club Financial Transparency</h2>
          <p>Total club income, expenditure and balance open to all members</p>
        </div>
      </div>

      <div className="stats">
        <div className="stat stat-emerald">
          <small>Club Total Varavu (Income)</small>
          <strong>{money(data.totalIncome)}</strong>
          <span className="stat-desc">Members: {money(data.clubPaymentIncome)} | Other: {money(data.clubOtherIncome)}</span>
        </div>
        <div className="stat stat-rose">
          <small>Club Total Selavu (Expense)</small>
          <strong>{money(data.totalExpense)}</strong>
          <span className="stat-desc">All club expenditures</span>
        </div>
        <div className="stat stat-gold">
          <small>Club Current Balance</small>
          <strong>{money(data.clubBalance)}</strong>
          <span className="stat-desc">Net available funds</span>
        </div>
      </div>

      {/* Share App Card */}
      <div className="card" style={{ background: "linear-gradient(135deg, rgba(8,127,140,0.06), rgba(212,160,52,0.08))", border: "1px solid rgba(212,160,52,0.3)", marginTop: "20px" }}>
        <div className="card-head" style={{ marginBottom: 0 }}>
          <div>
            <h3 style={{ margin: "0 0 4px", fontSize: "16px" }}>📤 Share MSK Club App with Club Members</h3>
            <p style={{ margin: 0, fontSize: "13px" }}>Share this portal link to WhatsApp groups or friends</p>
          </div>
          <button className="wa-btn" onClick={() => shareApp(showToast)}>
            💬 Share on WhatsApp
          </button>
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
   Admin Dashboard
   ========================================================================== */
function AdminDashboard({ showToast }) {
  const [summary, setSummary] = useState(null);
  const [members, setMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberFilter, setMemberFilter] = useState("all");
  const [auditLogs, setAuditLogs] = useState([]);
  const [payments, setPayments] = useState([]);
  const [paymentSearch, setPaymentSearch] = useState("");
  const [incomes, setIncomes] = useState([]);
  const [incomeSearch, setIncomeSearch] = useState("");
  const [incomeCategory, setIncomeCategory] = useState("all");
  const [expenses, setExpenses] = useState([]);
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("all");
  const [tab, setTab] = useState("overview");

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [monthlyStatus, setMonthlyStatus] = useState(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  // Modals state
  const [statementMember, setStatementMember] = useState(null);
  const [editingMember, setEditingMember] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const [editingIncome, setEditingIncome] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);

  // Forms
  const [memberForm, setMemberForm] = useState({
    name: "", email: "", phone: "", password: "", monthlyAmount: ""
  });

  const [paymentForm, setPaymentForm] = useState({
    memberId: "", month: new Date().getMonth() + 1,
    year: new Date().getFullYear(), amount: "", note: ""
  });

  const [incomeForm, setIncomeForm] = useState({
    title: "", amount: "", category: "General",
    date: new Date().toISOString().slice(0, 10), note: ""
  });

  const [expenseForm, setExpenseForm] = useState({
    title: "", amount: "", category: "General",
    date: new Date().toISOString().slice(0, 10), note: ""
  });

  const [historyMonth, setHistoryMonth] = useState("all");
  const [historyYear, setHistoryYear] = useState(String(new Date().getFullYear()));
  const [historyPage, setHistoryPage] = useState(1);
  const historyPageSize = 10;

  async function load() {
    try {
      const [s, m, p, i, e] = await Promise.all([
        api("/admin/summary"),
        api("/admin/members"),
        api("/admin/payments"),
        api("/admin/incomes"),
        api("/admin/expenses")
      ]);
      setSummary(s);
      setMembers(m);
      setPayments(p);
      setIncomes(i);
      setExpenses(e);

      if (!paymentForm.memberId && m[0]) {
        setPaymentForm(f => ({ ...f, memberId: m[0]._id }));
      }
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function loadMonthlyStatus() {
    try {
      setMonthlyLoading(true);
      const data = await api(`/admin/monthly-status?month=${selectedMonth}&year=${selectedYear}`);
      setMonthlyStatus(data);
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setMonthlyLoading(false);
    }
  }

  async function loadAuditLogs() {
    try {
      const logs = await api("/admin/audit");
      setAuditLogs(logs);
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (tab === "overview") {
      loadMonthlyStatus();
    } else if (tab === "audit") {
      loadAuditLogs();
    }
  }, [selectedMonth, selectedYear, tab]);

  // Form Submissions
  async function addMember(e) {
    e.preventDefault();
    try {
      await api("/admin/members", {
        method: "POST",
        body: JSON.stringify(memberForm)
      });
      setMemberForm({ name: "", email: "", phone: "", password: "", monthlyAmount: "" });
      showToast("Member created successfully!", "success");
      await load();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function toggleMember(m) {
    try {
      await api(`/admin/members/${m._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ active: !m.active })
      });
      showToast(`Member ${m.name} is now ${!m.active ? "Active" : "Inactive"}`, "info");
      await load();
      await loadMonthlyStatus();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function deleteMember(m) {
    if (!confirm(`Archive ${m.name}? Login will be disabled, but all payment history will be preserved.`)) return;
    try {
      await api(`/admin/members/${m._id}`, { method: "DELETE" });
      showToast(`Member ${m.name} archived successfully`, "info");
      await load();
      await loadMonthlyStatus();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function addPayment(e) {
    e.preventDefault();
    try {
      await api("/admin/payments", {
        method: "POST",
        body: JSON.stringify(paymentForm)
      });
      setPaymentForm(f => ({ ...f, amount: "", note: "" }));
      showToast("Payment recorded successfully!", "success");
      await load();
      await loadMonthlyStatus();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function deletePayment(p) {
    if (!confirm(`Are you sure you want to delete the payment for ${p.member?.name || "member"} (${months[p.month - 1]} ${p.year} - ₹${p.amount})?`)) return;
    try {
      await api(`/admin/payments/${p._id}`, { method: "DELETE" });
      showToast("Payment deleted successfully", "info");
      await load();
      await loadMonthlyStatus();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function addIncome(e) {
    e.preventDefault();
    try {
      await api("/admin/incomes", {
        method: "POST",
        body: JSON.stringify(incomeForm)
      });
      setIncomeForm({
        title: "", amount: "", category: "General",
        date: new Date().toISOString().slice(0, 10), note: ""
      });
      showToast("Varavu added successfully!", "success");
      await load();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function deleteIncome(id) {
    if (!confirm("Are you sure you want to delete this Varavu entry?")) return;
    try {
      await api(`/admin/incomes/${id}`, { method: "DELETE" });
      showToast("Varavu deleted", "info");
      await load();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function addExpense(e) {
    e.preventDefault();
    try {
      await api("/admin/expenses", {
        method: "POST",
        body: JSON.stringify(expenseForm)
      });
      setExpenseForm({
        title: "", amount: "", category: "General",
        date: new Date().toISOString().slice(0, 10), note: ""
      });
      showToast("Selavu added successfully!", "success");
      await load();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function deleteExpense(id) {
    if (!confirm("Are you sure you want to delete this Selavu entry?")) return;
    try {
      await api(`/admin/expenses/${id}`, { method: "DELETE" });
      showToast("Selavu deleted", "info");
      await load();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  // Filtered Collections & Searches
  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const matchSearch = `${m.name} ${m.email} ${m.phone || ""}`.toLowerCase().includes(memberSearch.toLowerCase().trim());
      const matchFilter = memberFilter === "all" || (memberFilter === "active" ? m.active : !m.active);
      return matchSearch && matchFilter;
    });
  }, [members, memberSearch, memberFilter]);

  const filteredHistoryPayments = useMemo(() => {
    return payments.filter(p => {
      const matchMonth = historyMonth === "all" || Number(p.month) === Number(historyMonth);
      const matchYear = historyYear === "all" || Number(p.year) === Number(historyYear);
      const matchSearch = !paymentSearch.trim() || `${p.member?.name || ""} ${p.member?.phone || ""}`.toLowerCase().includes(paymentSearch.toLowerCase().trim());
      return matchMonth && matchYear && matchSearch;
    }).sort((a, b) => Number(b.year) - Number(a.year) || Number(b.month) - Number(a.month) || new Date(b.paidAt || 0) - new Date(a.paidAt || 0));
  }, [payments, historyMonth, historyYear, paymentSearch]);

  const historyTotalPages = Math.max(1, Math.ceil(filteredHistoryPayments.length / historyPageSize));
  const visibleHistoryPayments = filteredHistoryPayments.slice((historyPage - 1) * historyPageSize, historyPage * historyPageSize);
  const historyCollectionTotal = filteredHistoryPayments.reduce((sum, p) => sum + Math.max(0, Number(p.amount) || 0), 0);

  const filteredIncomes = useMemo(() => {
    return incomes.filter(i => {
      const matchSearch = `${i.title} ${i.note || ""}`.toLowerCase().includes(incomeSearch.toLowerCase().trim());
      const matchCat = incomeCategory === "all" || i.category === incomeCategory;
      return matchSearch && matchCat;
    });
  }, [incomes, incomeSearch, incomeCategory]);

  const incomeCategories = useMemo(() => {
    return ["all", ...new Set(incomes.map(i => i.category || "General").filter(Boolean))];
  }, [incomes]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchSearch = `${e.title} ${e.note || ""}`.toLowerCase().includes(expenseSearch.toLowerCase().trim());
      const matchCat = expenseCategory === "all" || e.category === expenseCategory;
      return matchSearch && matchCat;
    });
  }, [expenses, expenseSearch, expenseCategory]);

  const expenseCategories = useMemo(() => {
    return ["all", ...new Set(expenses.map(e => e.category || "General").filter(Boolean))];
  }, [expenses]);

  // Target collection percentage for current selected month
  const targetMonthlyDues = monthlyStatus ? (monthlyStatus.totalPaidAmount + monthlyStatus.pendingAmount) : 0;
  const targetMonthlyPercent = targetMonthlyDues > 0
    ? Math.min(100, Math.round((monthlyStatus.totalPaidAmount / targetMonthlyDues) * 100))
    : 0;

  return (
    <section>
      <div className="page-title">
        <div>
          <h1>Admin Control Center</h1>
          <p>Member management, monthly collections, Varavu and Selavu</p>
        </div>
      </div>

      {/* Tabs */}
      <nav className="tabs">
        {[
          { key: "overview", label: "📊 Overview" },
          { key: "members", label: "👥 Members", badge: members.length },
          { key: "payments", label: "💳 Collections", badge: payments.length },
          { key: "varavu", label: "💰 Varavu", badge: incomes.length },
          { key: "selavu", label: "💸 Selavu", badge: expenses.length },
          { key: "reports", label: "📄 Reports" },
          { key: "audit", label: "🛡️ Audit History" }
        ].map(t => (
          <button
            key={t.key}
            className={tab === t.key ? "active" : ""}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.badge !== undefined && <span className="tab-badge">{t.badge}</span>}
          </button>
        ))}
      </nav>

      {/* OVERVIEW TAB */}
      {tab === "overview" && summary && (
        <div>
          <div className="stats">
            <div className="stat">
              <small>Club Members</small>
              <strong>{summary.members}</strong>
              <span className="stat-desc">Active youth club members</span>
            </div>
            <div className="stat stat-emerald">
              <small>Member Collections</small>
              <strong>{money(summary.paymentIncome)}</strong>
              <span className="stat-desc">Monthly fees collected</span>
            </div>
            <div className="stat stat-gold">
              <small>Other Varavu</small>
              <strong>{money(summary.otherIncome)}</strong>
              <span className="stat-desc">Donations & sponsorships</span>
            </div>
            <div className="stat stat-emerald">
              <small>Total Varavu (Income)</small>
              <strong>{money(summary.income)}</strong>
              <span className="stat-desc">Combined club revenue</span>
            </div>
            <div className="stat stat-rose">
              <small>Total Selavu (Expense)</small>
              <strong>{money(summary.expense)}</strong>
              <span className="stat-desc">Club expenditure</span>
            </div>
            <div className="stat stat-gold">
              <small>Net Club Balance</small>
              <strong>{money(summary.balance)}</strong>
              <span className="stat-desc">Available club funds</span>
            </div>
          </div>

          {/* Visual Financial Snapshot */}
          <div className="card chart-card">
            <div className="card-head">
              <div>
                <h2>📈 Financial Breakdown</h2>
                <p>Visual overview of current club income, expenditure and balance</p>
              </div>
            </div>
            {[
              { label: "Member Collections", value: summary.paymentIncome, color: "teal" },
              { label: "Other Varavu", value: summary.otherIncome, color: "gold" },
              { label: "Total Selavu", value: summary.expense, color: "coral" },
              { label: "Net Balance", value: Math.max(0, summary.balance), color: "navy" }
            ].map(item => {
              const max = Math.max(1, summary.income, summary.expense);
              const pct = Math.min(100, Math.round((Math.max(0, item.value) / max) * 100));
              return (
                <div className="chart-row" key={item.label}>
                  <div>
                    <span>{item.label}</span>
                    <strong>{money(item.value)}</strong>
                  </div>
                  <div className="chart-track">
                    <div className={`chart-fill ${item.color}`} style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Monthly Payment Status Selector */}
          <div className="card monthly-selector">
            <div>
              <h2>🗓️ Monthly Collection Status</h2>
              <p>Review paid and pending members for any month with one-click WhatsApp reminders</p>
            </div>
            <div className="month-controls">
              <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
                {months.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
              <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
                {[2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button
                className="secondary"
                onClick={() => {
                  setSelectedMonth(new Date().getMonth() + 1);
                  setSelectedYear(new Date().getFullYear());
                }}
              >
                Current Month
              </button>
              <button className="primary" onClick={loadMonthlyStatus}>Refresh</button>
            </div>
          </div>

          {monthlyLoading && (
            <div className="card" style={{ textAlign: "center", padding: "40px" }}>
              <p>Loading monthly collection data...</p>
            </div>
          )}

          {monthlyStatus && !monthlyLoading && (
            <>
              {/* Monthly Progress Tracker */}
              <div className="card">
                <div className="progress-header">
                  <span>
                    Collection Progress for {months[selectedMonth - 1]} {selectedYear}:{" "}
                    <strong>{money(monthlyStatus.totalPaidAmount)}</strong> of {money(targetMonthlyDues)}
                  </span>
                  <span style={{ color: targetMonthlyPercent >= 80 ? "#10b981" : "#f59e0b", fontWeight: 700 }}>
                    {targetMonthlyPercent}% Collected
                  </span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${targetMonthlyPercent}%` }}></div>
                </div>
              </div>

              <div className="stats">
                <div className="stat">
                  <small>Total Members</small>
                  <strong>{monthlyStatus.totalMembers}</strong>
                </div>
                <div className="stat stat-emerald">
                  <small>Paid Members</small>
                  <strong>{monthlyStatus.paidCount}</strong>
                </div>
                <div className="stat stat-rose">
                  <small>Pending Members</small>
                  <strong>{monthlyStatus.pendingCount}</strong>
                </div>
                <div className="stat stat-emerald">
                  <small>Collected Amount</small>
                  <strong>{money(monthlyStatus.totalPaidAmount)}</strong>
                </div>
                <div className="stat stat-rose">
                  <small>Pending Amount</small>
                  <strong>{money(monthlyStatus.pendingAmount)}</strong>
                </div>
              </div>

              <div className="monthly-grid">
                {/* PAID MEMBERS TABLE */}
                <div className="card">
                  <div className="card-head">
                    <div>
                      <h2>✅ Paid Members</h2>
                      <p>{months[selectedMonth - 1]} {selectedYear}</p>
                    </div>
                    <span className="count-badge paid-count">{monthlyStatus.paidCount}</span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Member</th>
                          <th>Amount</th>
                          <th>Paid Date</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyStatus.paid.length === 0 ? (
                          <tr><td colSpan="5">No paid members yet.</td></tr>
                        ) : (
                          monthlyStatus.paid.map((m, i) => (
                            <tr key={m.id}>
                              <td>{i + 1}</td>
                              <td>
                                <strong>{m.name}</strong><br />
                                <small style={{ color: "#64748b" }}>{m.phone || m.email}</small>
                              </td>
                              <td><strong>{money(m.amount)}</strong></td>
                              <td>{dateText(m.paidAt)}</td>
                              <td>
                                <button
                                  className="btn-sm wa-btn"
                                  onClick={() => openWhatsAppReceipt(m, m.name, m.phone)}
                                  title="Send Receipt via WhatsApp"
                                >
                                  💬 WhatsApp
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* PENDING MEMBERS TABLE WITH ONE-CLICK WHATSAPP */}
                <div className="card">
                  <div className="card-head">
                    <div>
                      <h2>⏳ Pending Members</h2>
                      <p>{months[selectedMonth - 1]} {selectedYear}</p>
                    </div>
                    <span className="count-badge pending-count">{monthlyStatus.pendingCount}</span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Member</th>
                          <th>Balance</th>
                          <th>Status</th>
                          <th>Reminder</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyStatus.pending.length === 0 ? (
                          <tr><td colSpan="5" style={{ textAlign: "center", color: "#10b981", fontWeight: 700 }}>🎉 All active members have paid!</td></tr>
                        ) : (
                          monthlyStatus.pending.map((m, i) => (
                            <tr key={m.id}>
                              <td>{i + 1}</td>
                              <td>
                                <strong>{m.name}</strong><br />
                                <small style={{ color: "#64748b" }}>{m.phone || m.email}</small>
                              </td>
                              <td><strong style={{ color: "#e11d48" }}>{money(m.remainingAmount ?? m.monthlyAmount)}</strong></td>
                              <td>
                                <span className={`badge ${m.paidAmount > 0 ? "badge-partial" : "badge-pending"}`}>
                                  {m.paidAmount > 0 ? "Partial" : "Pending"}
                                </span>
                              </td>
                              <td>
                                <button
                                  className="btn-sm wa-btn"
                                  onClick={() => openWhatsAppReminder(m, months[selectedMonth - 1], selectedYear, m.remainingAmount ?? m.monthlyAmount)}
                                  title="Send WhatsApp payment reminder"
                                >
                                  🟢 WhatsApp
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Monthly Export Buttons */}
              <div className="card">
                <div className="card-head">
                  <div>
                    <h2>📥 Export Monthly Report</h2>
                    <p>Download complete paid and pending statement for {months[selectedMonth - 1]} {selectedYear}</p>
                  </div>
                  <div className="button-row">
                    <button
                      className="secondary"
                      onClick={() => {
                        const rows = [
                          ...monthlyStatus.paid.map(m => ({
                            Name: m.name, Email: m.email, Phone: m.phone || "",
                            Status: "Paid", Amount: m.amount, Date: dateText(m.paidAt)
                          })),
                          ...monthlyStatus.pending.map(m => ({
                            Name: m.name, Email: m.email, Phone: m.phone || "",
                            Status: m.paidAmount > 0 ? "Partial" : "Pending",
                            Paid: m.paidAmount || 0,
                            Balance: m.remainingAmount ?? m.monthlyAmount,
                            Date: "-"
                          }))
                        ];
                        downloadExcel(`MSK-${months[selectedMonth - 1]}-${selectedYear}.xlsx`, rows);
                      }}
                    >
                      📗 Export Excel
                    </button>
                    <button
                      className="primary"
                      onClick={() => {
                        const rows = [
                          ...monthlyStatus.paid.map(m => [
                            m.name, m.phone || "-", "Paid", money(m.amount), dateText(m.paidAt)
                          ]),
                          ...monthlyStatus.pending.map(m => [
                            m.name, m.phone || "-", m.paidAmount > 0 ? "Partial" : "Pending", money(m.paidAmount || 0), "-"
                          ])
                        ];
                        downloadPdf(
                          `MSK Youth Club - ${months[selectedMonth - 1]} ${selectedYear}`,
                          ["Member", "Phone", "Status", "Amount", "Paid Date"],
                          rows,
                          `MSK-${months[selectedMonth - 1]}-${selectedYear}.pdf`
                        );
                      }}
                    >
                      📄 Export PDF
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* MEMBERS TAB */}
      {tab === "members" && (
        <div className="grid2">
          {/* Add Member Card */}
          <form className="card form" onSubmit={addMember}>
            <h2>➕ Add New Member</h2>
            <label>
              Full Name
              <input
                placeholder="e.g. Ramesh Kumar"
                value={memberForm.name}
                onChange={e => setMemberForm({ ...memberForm, name: e.target.value })}
                required
              />
            </label>
            <label>
              Email (User ID for login)
              <input
                placeholder="member@gmail.com"
                type="email"
                value={memberForm.email}
                onChange={e => setMemberForm({ ...memberForm, email: e.target.value })}
                required
              />
            </label>
            <label>
              Mobile / WhatsApp Number
              <input
                placeholder="e.g. 9876543210"
                value={memberForm.phone}
                onChange={e => setMemberForm({ ...memberForm, phone: e.target.value })}
              />
            </label>
            <label>
              Login Password
              <input
                placeholder="Initial password"
                type="password"
                value={memberForm.password}
                onChange={e => setMemberForm({ ...memberForm, password: e.target.value })}
                required
              />
            </label>
            <label>
              Monthly Contribution Fee (₹)
              <input
                placeholder="e.g. 200"
                type="number"
                min="0"
                value={memberForm.monthlyAmount}
                onChange={e => setMemberForm({ ...memberForm, monthlyAmount: e.target.value })}
              />
            </label>
            <button className="primary" style={{ marginTop: "6px" }}>Create Member Account</button>
          </form>

          {/* Members List */}
          <div className="card">
            <div className="card-head">
              <div>
                <h2>Members Directory ({filteredMembers.length})</h2>
                <p>Manage member profiles, view statements, and edit subscription amounts</p>
              </div>
            </div>

            <div className="filter-bar">
              <div className="search-input-wrap">
                <span className="search-icon">🔍</span>
                <input
                  placeholder="Search by name, email or phone..."
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                />
              </div>
              <select
                className="filter-select"
                value={memberFilter}
                onChange={e => setMemberFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Member Details</th>
                    <th>Phone</th>
                    <th>Monthly Fee</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.length === 0 ? (
                    <tr><td colSpan="5">No members found matching your search.</td></tr>
                  ) : (
                    filteredMembers.map(m => (
                      <tr key={m._id}>
                        <td>
                          <strong>{m.name}</strong><br />
                          <small style={{ color: "#64748b" }}>{m.email}</small>
                        </td>
                        <td>{m.phone || "-"}</td>
                        <td><strong>{money(m.monthlyAmount)}</strong></td>
                        <td>
                          <span className={`badge ${m.active ? "badge-paid" : "badge-inactive"}`}>
                            {m.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          <div className="button-row">
                            <button
                              className="btn-sm secondary"
                              onClick={() => setStatementMember(m)}
                              title="View Dues & Statement"
                            >
                              📋 Statement
                            </button>
                            <button
                              className="btn-sm secondary"
                              onClick={() => setEditingMember(m)}
                              title="Edit Member Profile"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              className="btn-sm secondary"
                              onClick={() => toggleMember(m)}
                            >
                              {m.active ? "Deactivate" : "Activate"}
                            </button>
                            <button
                              className="btn-sm danger"
                              onClick={() => deleteMember(m)}
                              title="Archive member while keeping payment history"
                            >
                              Archive
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENTS TAB */}
      {tab === "payments" && (
        <div className="grid2">
          {/* Record Monthly Payment Form */}
          <form className="card form" onSubmit={addPayment}>
            <h2>💳 Record Monthly Payment</h2>
            <label>
              Select Member
              <select
                value={paymentForm.memberId}
                onChange={e => setPaymentForm({ ...paymentForm, memberId: e.target.value })}
                required
              >
                <option value="">-- Choose Member --</option>
                {members.filter(m => m.active).map(m => (
                  <option key={m._id} value={m._id}>
                    {m.name} {m.monthlyAmount ? `(₹${m.monthlyAmount}/mo)` : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="form-grid-2">
              <label>
                Month
                <select
                  value={paymentForm.month}
                  onChange={e => setPaymentForm({ ...paymentForm, month: Number(e.target.value) })}
                >
                  {months.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
              </label>

              <label>
                Year
                <input
                  type="number"
                  value={paymentForm.year}
                  onChange={e => setPaymentForm({ ...paymentForm, year: Number(e.target.value) })}
                  required
                />
              </label>
            </div>

            <label>
              Amount (₹)
              <input
                type="number"
                min="0"
                placeholder="Amount paid"
                value={paymentForm.amount}
                onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                required
              />
            </label>

            <label>
              Note / Reference (optional)
              <input
                placeholder="e.g. Cash, GPay, UPI Ref"
                value={paymentForm.note}
                onChange={e => setPaymentForm({ ...paymentForm, note: e.target.value })}
              />
            </label>

            <button className="primary" style={{ marginTop: "6px" }}>Record Payment</button>
          </form>

          {/* Collection History */}
          <div className="card">
            <div className="card-head">
              <div>
                <h2>Collection History</h2>
                <p>Filter collections by member name, month and year</p>
              </div>
              <div className="button-row">
                <button
                  className="secondary"
                  onClick={() => downloadExcel("msk-collections.xlsx", filteredHistoryPayments.map(p => ({
                    Member: p.member?.name || "",
                    Email: p.member?.email || "",
                    Month: months[p.month - 1],
                    Year: p.year,
                    Amount: p.amount,
                    PaidDate: dateText(p.paidAt),
                    Note: p.note || ""
                  })))}
                >
                  📗 Excel
                </button>
                <button
                  className="primary"
                  onClick={() => downloadPdf(
                    "MSK Youth Club - Collection History",
                    ["Member", "Month", "Year", "Amount", "Paid Date", "Note"],
                    filteredHistoryPayments.map(p => [
                      p.member?.name || "",
                      months[p.month - 1],
                      p.year,
                      money(p.amount),
                      dateText(p.paidAt),
                      p.note || "-"
                    ]),
                    "msk-collection-history.pdf"
                  )}
                >
                  📄 PDF
                </button>
              </div>
            </div>

            <div className="collection-filters">
              <label>
                Month:
                <select value={historyMonth} onChange={e => { setHistoryMonth(e.target.value); setHistoryPage(1); }}>
                  <option value="all">All Months</option>
                  {months.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
              </label>

              <label>
                Year:
                <select value={historyYear} onChange={e => { setHistoryYear(e.target.value); setHistoryPage(1); }}>
                  <option value="all">All Years</option>
                  {[...new Set([new Date().getFullYear(), ...payments.map(p => Number(p.year)).filter(Boolean)])].sort((a, b) => b - a).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </label>

              <div style={{ flex: 1, minWidth: "180px" }}>
                <input
                  placeholder="Search member..."
                  value={paymentSearch}
                  onChange={e => { setPaymentSearch(e.target.value); setHistoryPage(1); }}
                />
              </div>

              <div className="collection-total">
                <span>Filtered Total</span>
                <strong>{money(historyCollectionTotal)}</strong>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Period</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Note</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleHistoryPayments.length === 0 ? (
                    <tr><td colSpan="6">No payment records match this filter.</td></tr>
                  ) : (
                    visibleHistoryPayments.map(p => (
                      <tr key={p._id}>
                        <td>
                          <strong>{p.member?.name || "-"}</strong><br />
                          <small style={{ color: "#64748b" }}>{p.member?.phone || ""}</small>
                        </td>
                        <td>{months[p.month - 1]} {p.year}</td>
                        <td><strong>{money(p.amount)}</strong></td>
                        <td>{dateText(p.paidAt)}</td>
                        <td>{p.note || "-"}</td>
                        <td>
                          <div className="button-row">
                            <button
                              className="btn-sm secondary"
                              onClick={() => downloadReceiptPdf(p, p.member?.name)}
                              title="Download PDF Receipt"
                            >
                              📄 Receipt
                            </button>
                            <button
                              className="btn-sm wa-btn"
                              onClick={() => openWhatsAppReceipt(p, p.member?.name, p.member?.phone)}
                              title="Share Receipt on WhatsApp"
                            >
                              💬 WhatsApp
                            </button>
                            <button
                              className="btn-sm secondary"
                              onClick={() => setEditingPayment(p)}
                              title="Edit payment"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              className="btn-sm danger"
                              onClick={() => deletePayment(p)}
                              title="Delete payment"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {filteredHistoryPayments.length > 0 && (
              <div className="history-pagination">
                <span>
                  Showing {(historyPage - 1) * historyPageSize + 1}–{Math.min(historyPage * historyPageSize, filteredHistoryPayments.length)} of {filteredHistoryPayments.length}
                </span>
                <div className="button-row">
                  <button
                    disabled={historyPage === 1}
                    onClick={() => setHistoryPage(page => Math.max(1, page - 1))}
                  >
                    Previous
                  </button>
                  <span>Page {historyPage} of {historyTotalPages}</span>
                  <button
                    disabled={historyPage >= historyTotalPages}
                    onClick={() => setHistoryPage(page => Math.min(historyTotalPages, page + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VARAVU (INCOME) TAB */}
      {tab === "varavu" && (
        <div className="grid2">
          <form className="card form" onSubmit={addIncome}>
            <h2>➕ Add Varavu (Income)</h2>
            <label>
              Income Title
              <input
                placeholder="e.g. Festival Donation, Ground Booking"
                value={incomeForm.title}
                onChange={e => setIncomeForm({ ...incomeForm, title: e.target.value })}
                required
              />
            </label>
            <label>
              Amount (₹)
              <input
                type="number"
                min="0"
                placeholder="Amount"
                value={incomeForm.amount}
                onChange={e => setIncomeForm({ ...incomeForm, amount: e.target.value })}
                required
              />
            </label>
            <label>
              Category
              <input
                placeholder="e.g. Donation, Event, Sponsor"
                value={incomeForm.category}
                onChange={e => setIncomeForm({ ...incomeForm, category: e.target.value })}
              />
            </label>
            <label>
              Date
              <input
                type="date"
                value={incomeForm.date}
                onChange={e => setIncomeForm({ ...incomeForm, date: e.target.value })}
                required
              />
            </label>
            <label>
              Note (optional)
              <input
                placeholder="Additional notes"
                value={incomeForm.note}
                onChange={e => setIncomeForm({ ...incomeForm, note: e.target.value })}
              />
            </label>
            <button className="primary" style={{ marginTop: "6px" }}>Add Varavu</button>
          </form>

          <div className="card">
            <div className="card-head">
              <div>
                <h2>Varavu Records ({filteredIncomes.length})</h2>
                <p>Total Filtered: {money(filteredIncomes.reduce((s, i) => s + Number(i.amount || 0), 0))}</p>
              </div>
              <div className="button-row">
                <button
                  className="secondary"
                  onClick={() => downloadExcel("msk-varavu.xlsx", filteredIncomes.map(i => ({
                    Title: i.title, Category: i.category, Amount: i.amount,
                    Date: dateText(i.date), Note: i.note || ""
                  })))}
                >
                  📗 Excel
                </button>
                <button
                  className="primary"
                  onClick={() => downloadPdf(
                    "MSK Youth Club - Varavu Records",
                    ["Title", "Category", "Amount", "Date", "Note"],
                    filteredIncomes.map(i => [i.title, i.category, money(i.amount), dateText(i.date), i.note || "-"]),
                    "msk-varavu.pdf"
                  )}
                >
                  📄 PDF
                </button>
              </div>
            </div>

            <div className="filter-bar">
              <div className="search-input-wrap">
                <span className="search-icon">🔍</span>
                <input
                  placeholder="Search Varavu entries..."
                  value={incomeSearch}
                  onChange={e => setIncomeSearch(e.target.value)}
                />
              </div>
              <select
                className="filter-select"
                value={incomeCategory}
                onChange={e => setIncomeCategory(e.target.value)}
              >
                {incomeCategories.map(c => (
                  <option key={c} value={c}>{c === "all" ? "All Categories" : c}</option>
                ))}
              </select>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIncomes.length === 0 ? (
                    <tr><td colSpan="5">No Varavu entries found.</td></tr>
                  ) : (
                    filteredIncomes.map(i => (
                      <tr key={i._id}>
                        <td>
                          <strong>{i.title}</strong><br />
                          <small style={{ color: "#64748b" }}>{i.note || ""}</small>
                        </td>
                        <td><span className="badge badge-paid">{i.category || "General"}</span></td>
                        <td><strong>{money(i.amount)}</strong></td>
                        <td>{dateText(i.date)}</td>
                        <td>
                          <div className="button-row">
                            <button className="btn-sm secondary" onClick={() => setEditingIncome(i)}>✏️ Edit</button>
                            <button className="btn-sm danger" onClick={() => deleteIncome(i._id)}>🗑️</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SELAVU (EXPENSE) TAB */}
      {tab === "selavu" && (
        <div className="grid2">
          <form className="card form" onSubmit={addExpense}>
            <h2>➕ Add Selavu (Expense)</h2>
            <label>
              Expense Title
              <input
                placeholder="e.g. Ground Maintenance, Electricity Bill"
                value={expenseForm.title}
                onChange={e => setExpenseForm({ ...expenseForm, title: e.target.value })}
                required
              />
            </label>
            <label>
              Amount (₹)
              <input
                type="number"
                min="0"
                placeholder="Amount"
                value={expenseForm.amount}
                onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                required
              />
            </label>
            <label>
              Category
              <input
                placeholder="e.g. Sports, Maintenance, Event"
                value={expenseForm.category}
                onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}
              />
            </label>
            <label>
              Date
              <input
                type="date"
                value={expenseForm.date}
                onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })}
                required
              />
            </label>
            <label>
              Note (optional)
              <input
                placeholder="Additional notes"
                value={expenseForm.note}
                onChange={e => setExpenseForm({ ...expenseForm, note: e.target.value })}
              />
            </label>
            <button className="primary" style={{ marginTop: "6px" }}>Add Selavu</button>
          </form>

          <div className="card">
            <div className="card-head">
              <div>
                <h2>Selavu Records ({filteredExpenses.length})</h2>
                <p>Total Filtered: {money(filteredExpenses.reduce((s, e) => s + Number(e.amount || 0), 0))}</p>
              </div>
              <div className="button-row">
                <button
                  className="secondary"
                  onClick={() => downloadExcel("msk-selavu.xlsx", filteredExpenses.map(e => ({
                    Title: e.title, Category: e.category, Amount: e.amount,
                    Date: dateText(e.date), Note: e.note || ""
                  })))}
                >
                  📗 Excel
                </button>
                <button
                  className="primary"
                  onClick={() => downloadPdf(
                    "MSK Youth Club - Selavu Records",
                    ["Title", "Category", "Amount", "Date", "Note"],
                    filteredExpenses.map(e => [e.title, e.category, money(e.amount), dateText(e.date), e.note || "-"]),
                    "msk-selavu.pdf"
                  )}
                >
                  📄 PDF
                </button>
              </div>
            </div>

            <div className="filter-bar">
              <div className="search-input-wrap">
                <span className="search-icon">🔍</span>
                <input
                  placeholder="Search Selavu entries..."
                  value={expenseSearch}
                  onChange={e => setExpenseSearch(e.target.value)}
                />
              </div>
              <select
                className="filter-select"
                value={expenseCategory}
                onChange={e => setExpenseCategory(e.target.value)}
              >
                {expenseCategories.map(c => (
                  <option key={c} value={c}>{c === "all" ? "All Categories" : c}</option>
                ))}
              </select>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.length === 0 ? (
                    <tr><td colSpan="5">No Selavu entries found.</td></tr>
                  ) : (
                    filteredExpenses.map(e => (
                      <tr key={e._id}>
                        <td>
                          <strong>{e.title}</strong><br />
                          <small style={{ color: "#64748b" }}>{e.note || ""}</small>
                        </td>
                        <td><span className="badge badge-pending">{e.category || "General"}</span></td>
                        <td><strong style={{ color: "#e11d48" }}>{money(e.amount)}</strong></td>
                        <td>{dateText(e.date)}</td>
                        <td>
                          <div className="button-row">
                            <button className="btn-sm secondary" onClick={() => setEditingExpense(e)}>✏️ Edit</button>
                            <button className="btn-sm danger" onClick={() => deleteExpense(e._id)}>🗑️</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* REPORTS TAB */}
      {tab === "reports" && (
        <div className="card">
          <div className="card-head">
            <div>
              <h2>📥 Club Financial Statements & Reports</h2>
              <p>Export complete data sets in Excel and PDF formats for auditing and general body meetings</p>
            </div>
          </div>

          <div className="report-buttons" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
            <div style={{ padding: "16px", border: "1px solid var(--msk-line)", borderRadius: "12px", background: "#fafbfc" }}>
              <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>👥 Members Directory</h3>
              <p style={{ fontSize: "13px", color: "var(--msk-muted)", marginBottom: "14px" }}>Full member list with contact numbers and monthly subscription fees.</p>
              <div className="button-row">
                <button
                  className="secondary full"
                  onClick={() => downloadExcel("msk-members.xlsx", members.map(m => ({
                    Name: m.name, Email: m.email, Phone: m.phone,
                    MonthlyAmount: m.monthlyAmount, Status: m.active ? "Active" : "Inactive",
                    Joined: dateText(m.joinedAt)
                  })))}
                >
                  📗 Members Excel
                </button>
              </div>
            </div>

            <div style={{ padding: "16px", border: "1px solid var(--msk-line)", borderRadius: "12px", background: "#fafbfc" }}>
              <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>💳 Payment Collections</h3>
              <p style={{ fontSize: "13px", color: "var(--msk-muted)", marginBottom: "14px" }}>Complete member payment history across all months and years.</p>
              <div className="button-row">
                <button
                  className="secondary full"
                  onClick={() => downloadExcel("msk-payments.xlsx", payments.map(p => ({
                    Member: p.member?.name || "", Month: months[p.month - 1], Year: p.year,
                    Amount: p.amount, Date: dateText(p.paidAt), Note: p.note || ""
                  })))}
                >
                  📗 Payments Excel
                </button>
                <button
                  className="primary full"
                  onClick={() => downloadPdf(
                    "MSK Youth Club - All Payments",
                    ["Member", "Month", "Year", "Amount", "Date"],
                    payments.map(p => [p.member?.name || "", months[p.month - 1], p.year, money(p.amount), dateText(p.paidAt)]),
                    "payments.pdf"
                  )}
                >
                  📄 Payments PDF
                </button>
              </div>
            </div>

            <div style={{ padding: "16px", border: "1px solid var(--msk-line)", borderRadius: "12px", background: "#fafbfc" }}>
              <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>💰 Varavu (Income)</h3>
              <p style={{ fontSize: "13px", color: "var(--msk-muted)", marginBottom: "14px" }}>All sponsorships, donations, and other income entries.</p>
              <div className="button-row">
                <button
                  className="secondary full"
                  onClick={() => downloadExcel("msk-varavu.xlsx", incomes.map(i => ({
                    Title: i.title, Category: i.category, Amount: i.amount, Date: dateText(i.date), Note: i.note || ""
                  })))}
                >
                  📗 Varavu Excel
                </button>
                <button
                  className="primary full"
                  onClick={() => downloadPdf(
                    "MSK Youth Club - Varavu",
                    ["Title", "Category", "Amount", "Date"],
                    incomes.map(i => [i.title, i.category, money(i.amount), dateText(i.date)]),
                    "varavu.pdf"
                  )}
                >
                  📄 Varavu PDF
                </button>
              </div>
            </div>

            <div style={{ padding: "16px", border: "1px solid var(--msk-line)", borderRadius: "12px", background: "#fafbfc" }}>
              <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>💸 Selavu (Expense)</h3>
              <p style={{ fontSize: "13px", color: "var(--msk-muted)", marginBottom: "14px" }}>Complete itemized expenditure records for club activities.</p>
              <div className="button-row">
                <button
                  className="secondary full"
                  onClick={() => downloadExcel("msk-selavu.xlsx", expenses.map(e => ({
                    Title: e.title, Category: e.category, Amount: e.amount, Date: dateText(e.date), Note: e.note || ""
                  })))}
                >
                  📗 Selavu Excel
                </button>
                <button
                  className="primary full"
                  onClick={() => downloadPdf(
                    "MSK Youth Club - Selavu",
                    ["Title", "Category", "Amount", "Date"],
                    expenses.map(e => [e.title, e.category, money(e.amount), dateText(e.date)]),
                    "selavu.pdf"
                  )}
                >
                  📄 Selavu PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AUDIT LOGS TAB */}
      {tab === "audit" && (
        <div className="card">
          <div className="card-head">
            <div>
              <h2>🛡️ System Audit Trail</h2>
              <p>Chronological record of all administrative actions, payments, and modifications</p>
            </div>
            <button className="secondary" onClick={loadAuditLogs}>Refresh</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Admin Actor</th>
                  <th>Action</th>
                  <th>Record Type</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr><td colSpan="5">No audit logs recorded yet.</td></tr>
                ) : (
                  auditLogs.map(log => (
                    <tr key={log._id}>
                      <td>
                        {dateText(log.createdAt)}{" "}
                        <small style={{ color: "#64748b" }}>
                          {log.createdAt ? new Date(log.createdAt).toLocaleTimeString("en-IN") : ""}
                        </small>
                      </td>
                      <td><strong>{log.actorEmail || "Admin"}</strong></td>
                      <td><span className="badge badge-paid">{log.action}</span></td>
                      <td>{log.entity || "-"}</td>
                      <td>{log.details || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Active Modals */}
      <MemberStatementModal
        member={statementMember}
        isOpen={Boolean(statementMember)}
        onClose={() => setStatementMember(null)}
        showToast={showToast}
      />

      <EditMemberModal
        member={editingMember}
        isOpen={Boolean(editingMember)}
        onClose={() => setEditingMember(null)}
        onUpdated={load}
        showToast={showToast}
      />

      <EditPaymentModal
        payment={editingPayment}
        members={members}
        isOpen={Boolean(editingPayment)}
        onClose={() => setEditingPayment(null)}
        onUpdated={() => { load(); loadMonthlyStatus(); }}
        showToast={showToast}
      />

      <EditFinanceModal
        item={editingIncome}
        type="income"
        isOpen={Boolean(editingIncome)}
        onClose={() => setEditingIncome(null)}
        onUpdated={load}
        showToast={showToast}
      />

      <EditFinanceModal
        item={editingExpense}
        type="expense"
        isOpen={Boolean(editingExpense)}
        onClose={() => setEditingExpense(null)}
        onUpdated={load}
        showToast={showToast}
      />
    </section>
  );
}

/* ==========================================================================
   Root Application
   ========================================================================== */
function App() {
  const [user, setUser] = useState(() => getUser());
  const [toasts, setToasts] = useState([]);

  function showToast(message, type = "success") {
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }

  function removeToast(id) {
    setToasts(prev => prev.filter(t => t.id !== id));
  }

  function logout() {
    clearAuth();
    setUser(null);
    showToast("Signed out successfully", "info");
  }

  return (
    <>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {!user ? (
        <Login onLogin={setUser} showToast={showToast} />
      ) : (
        <Layout user={user} onLogout={logout} showToast={showToast}>
          {user.role === "admin" ? (
            <AdminDashboard showToast={showToast} />
          ) : (
            <MemberDashboard showToast={showToast} />
          )}
        </Layout>
      )}
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
