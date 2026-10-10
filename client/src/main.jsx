import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./styles.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:4000";
const months = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

async function api(path, options = {}) {
  const token = localStorage.getItem("msk_token");

  const response = await fetch(API + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

function money(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function dateText(value) {
  return value ? new Date(value).toLocaleDateString("en-IN") : "-";
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
  doc.setFontSize(17);
  doc.text(title, 14, 18);
  autoTable(doc, {
    startY: 26,
    head: [columns],
    body: rows,
    styles: { fontSize: 8 }
  });
  doc.save(filename);
}

function Login({ onLogin }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");

    try {
      const data = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify(form)
      });

      localStorage.setItem("msk_token", data.token);
      localStorage.setItem("msk_user", JSON.stringify(data.user));
      onLogin(data.user);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <img className="brand-logo login-logo" src="/msk-logo.jfif" alt="MSK Youth Club Logo" />
        <h1>MSK Youth Club</h1>
        <p>Member & Admin Login</p>

        {error && <div className="error">{error}</div>}

        <input
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={e => setForm({ ...form, email: e.target.value })}
          required
        />

        <input
          placeholder="Password"
          type="password"
          value={form.password}
          onChange={e => setForm({ ...form, password: e.target.value })}
          required
        />

        <button className="primary full">Login</button>
      </form>
    </div>
  );
}

function Layout({ user, onLogout, children }) {
  return (
    <>
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo top-logo" src="/msk-logo.jfif" alt="MSK Youth Club Logo" />
          <div className="brand-text">
            <strong>MSK Youth Club</strong>
            <span className="role">
              {user.role === "admin" ? "ADMIN" : "MEMBER"}
            </span>
          </div>
        </div>
        <button onClick={onLogout} className="logout">Logout</button>
      </header>
      <main className="container">{children}</main>
    </>
  );
}

function Stat({ title, value }) {
  return (
    <div className="stat">
      <small>{title}</small>
      <strong>{value}</strong>
    </div>
  );
}

function MemberDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      setData(await api("/member/overview"));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!data) return <p>Loading...</p>;

  const paymentRows = data.payments.map(p => ({
    Month: months[p.month - 1],
    Year: p.year,
    Amount: p.amount,
    "Paid Date": dateText(p.paidAt),
    Note: p.note || ""
  }));

  const financeRows = [
    ...data.incomes.map(i => ({
      Type: "Varavu",
      Title: i.title,
      Category: i.category,
      Amount: i.amount,
      Date: dateText(i.date),
      Note: i.note || ""
    })),
    ...data.expenses.map(e => ({
      Type: "Selavu",
      Title: e.title,
      Category: e.category,
      Amount: e.amount,
      Date: dateText(e.date),
      Note: e.note || ""
    }))
  ];

  return (
    <section>
      <div className="page-title">
        <div>
          <h1>Welcome, {data.member.name}</h1>
          <p>Your MSK Youth Club overview</p>
        </div>

        <div className="download-actions">
          <button onClick={() => downloadExcel("my-payments.xlsx", paymentRows)}>
            📗 Payment Excel
          </button>
          <button onClick={() =>
            downloadPdf(
              "MSK Youth Club - My Payment Report",
              ["Month","Year","Amount","Paid Date"],
              data.payments.map(p => [
                months[p.month - 1],
                p.year,
                money(p.amount),
                dateText(p.paidAt)
              ]),
              "my-payment-report.pdf"
            )
          }>
            📄 Payment PDF
          </button>
        </div>
      </div>

      <div className="stats">
        <Stat title="My Total Paid" value={money(data.totalPaid)} />
        <Stat title="My Pending" value={money(data.pendingAmount)} />
        <Stat title="Pending Months" value={data.pendingMonths} />
        <Stat title="Monthly Amount" value={money(data.member.monthlyAmount)} />
      </div>

      <div className="stats">
        <Stat title="Club Varavu" value={money(data.totalIncome)} />
        <Stat title="Club Selavu" value={money(data.totalExpense)} />
        <Stat title="Club Balance" value={money(data.clubBalance)} />
        <Stat title="Club Payment Collection" value={money(data.clubPaymentIncome)} />
      </div>

      <div className="card">
        <h2>My Payment History</h2>
        <div className="table-wrap">
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
              {data.payments.length === 0 ? (
                <tr><td colSpan="5">No payments recorded.</td></tr>
              ) : (
                data.payments.map(p => (
                  <tr key={p._id}>
                    <td>{months[p.month - 1]}</td>
                    <td>{p.year}</td>
                    <td>{money(p.amount)}</td>
                    <td>{dateText(p.paidAt)}</td>
                    <td>{p.note || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="finance-grid">
        <div className="card">
          <div className="card-head">
            <div>
              <h2>💰 Club Varavu</h2>
              <p>Income entries visible to members</p>
            </div>
            <button onClick={() => downloadExcel("club-varavu.xlsx", data.incomes.map(i => ({
              Title: i.title, Category: i.category, Amount: i.amount,
              Date: dateText(i.date), Note: i.note || ""
            })))}>
              Excel
            </button>
          </div>

          <div className="table-wrap">
            <table>
              <thead><tr><th>Title</th><th>Category</th><th>Amount</th><th>Date</th></tr></thead>
              <tbody>
                {data.incomes.length === 0 ? (
                  <tr><td colSpan="4">No income entries.</td></tr>
                ) : data.incomes.map(i => (
                  <tr key={i._id}>
                    <td>{i.title}</td>
                    <td>{i.category}</td>
                    <td>{money(i.amount)}</td>
                    <td>{dateText(i.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <h2>💸 Club Selavu</h2>
              <p>Expense entries visible to members</p>
            </div>
            <button onClick={() => downloadExcel("club-selavu.xlsx", data.expenses.map(e => ({
              Title: e.title, Category: e.category, Amount: e.amount,
              Date: dateText(e.date), Note: e.note || ""
            })))}>
              Excel
            </button>
          </div>

          <div className="table-wrap">
            <table>
              <thead><tr><th>Title</th><th>Category</th><th>Amount</th><th>Date</th></tr></thead>
              <tbody>
                {data.expenses.length === 0 ? (
                  <tr><td colSpan="4">No expense entries.</td></tr>
                ) : data.expenses.map(e => (
                  <tr key={e._id}>
                    <td>{e.title}</td>
                    <td>{e.category}</td>
                    <td>{money(e.amount)}</td>
                    <td>{dateText(e.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>📊 Club Finance Summary</h2>
            <p>Current overall club financial position</p>
          </div>
          <button onClick={() => downloadExcel("club-finance.xlsx", financeRows)}>
            📗 Download Excel
          </button>
        </div>

        <div className="finance-summary">
          <div><span>Total Varavu</span><strong>{money(data.totalIncome)}</strong></div>
          <div><span>Total Selavu</span><strong>{money(data.totalExpense)}</strong></div>
          <div><span>Balance</span><strong>{money(data.clubBalance)}</strong></div>
        </div>
      </div>
    </section>
  );
}

function AdminDashboard() {
  const [summary, setSummary] = useState(null);
  const [members, setMembers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [tab, setTab] = useState("overview");
  const [msg, setMsg] = useState("");

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [monthlyStatus, setMonthlyStatus] = useState(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

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

  const [editingIncome, setEditingIncome] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);

  async function load() {
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
  }

  async function loadMonthlyStatus() {
    try {
      setMonthlyLoading(true);
      const data = await api(
        `/admin/monthly-status?month=${selectedMonth}&year=${selectedYear}`
      );
      setMonthlyStatus(data);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setMonthlyLoading(false);
    }
  }

  useEffect(() => {
    load().catch(e => setMsg(e.message));
  }, []);

  useEffect(() => {
    if (tab === "overview") {
      loadMonthlyStatus();
    }
  }, [selectedMonth, selectedYear, tab]);

  async function addMember(e) {
    e.preventDefault();
    try {
      await api("/admin/members", {
        method: "POST",
        body: JSON.stringify(memberForm)
      });
      setMemberForm({ name:"", email:"", phone:"", password:"", monthlyAmount:"" });
      setMsg("Member added successfully");
      await load();
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function addPayment(e) {
    e.preventDefault();
    try {
      await api("/admin/payments", {
        method: "POST",
        body: JSON.stringify(paymentForm)
      });
      setPaymentForm(f => ({ ...f, amount:"", note:"" }));
      setMsg("Payment recorded");
      await load();
      await loadMonthlyStatus();
    } catch (e) {
      setMsg(e.message);
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
        title:"", amount:"", category:"General",
        date:new Date().toISOString().slice(0,10), note:""
      });
      setMsg("Varavu added successfully");
      await load();
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function saveIncome(e) {
    e.preventDefault();
    try {
      await api(`/admin/incomes/${editingIncome._id}`, {
        method: "PATCH",
        body: JSON.stringify(editingIncome)
      });
      setEditingIncome(null);
      setMsg("Varavu updated successfully");
      await load();
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function deleteIncome(id) {
    if (!confirm("Delete this income entry?")) return;
    try {
      await api(`/admin/incomes/${id}`, { method:"DELETE" });
      setMsg("Varavu deleted");
      await load();
    } catch (e) {
      setMsg(e.message);
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
        title:"", amount:"", category:"General",
        date:new Date().toISOString().slice(0,10), note:""
      });
      setMsg("Selavu added successfully");
      await load();
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function saveExpense(e) {
    e.preventDefault();
    try {
      await api(`/admin/expenses/${editingExpense._id}`, {
        method: "PATCH",
        body: JSON.stringify(editingExpense)
      });
      setEditingExpense(null);
      setMsg("Selavu updated successfully");
      await load();
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function deleteExpense(id) {
    if (!confirm("Delete this expense entry?")) return;
    try {
      await api(`/admin/expenses/${id}`, { method:"DELETE" });
      setMsg("Selavu deleted");
      await load();
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function toggleMember(m) {
    try {
      await api(`/admin/members/${m._id}/status`, {
        method:"PATCH",
        body:JSON.stringify({ active:!m.active })
      });
      await load();
      await loadMonthlyStatus();
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function deleteMember(m) {
    if (!confirm(`Delete ${m.name}? Payment records will also be deleted.`)) return;
    try {
      await api(`/admin/members/${m._id}`, { method:"DELETE" });
      await load();
      await loadMonthlyStatus();
    } catch (e) {
      setMsg(e.message);
    }
  }

  const paymentRows = payments.map(p => ({
    Member:p.member?.name || "",
    Email:p.member?.email || "",
    Month:months[p.month-1],
    Year:p.year,
    Amount:p.amount,
    PaidDate:dateText(p.paidAt)
  }));

  const incomeRows = incomes.map(i => ({
    Title:i.title, Category:i.category, Amount:i.amount,
    Date:dateText(i.date), Note:i.note || ""
  }));

  const expenseRows = expenses.map(e => ({
    Title:e.title, Category:e.category, Amount:e.amount,
    Date:dateText(e.date), Note:e.note || ""
  }));

  return (
    <section>
      <div className="page-title">
        <div>
          <h1>Admin Dashboard</h1>
          <p>Members, monthly collection, varavu and selavu</p>
        </div>
      </div>

      {msg && <div className="notice">{msg}</div>}

      <nav className="tabs">
        {["overview","members","payments","varavu","selavu","reports"].map(t => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t === "varavu" ? "Varavu" : t === "selavu" ? "Selavu" : t}
          </button>
        ))}
      </nav>

      {tab === "overview" && summary && (
        <div>
          <div className="stats">
            <Stat title="Members" value={summary.members}/>
            <Stat title="Member Collection" value={money(summary.paymentIncome)}/>
            <Stat title="Other Varavu" value={money(summary.otherIncome)}/>
            <Stat title="Total Varavu" value={money(summary.income)}/>
            <Stat title="Total Selavu" value={money(summary.expense)}/>
            <Stat title="Balance" value={money(summary.balance)}/>
          </div>

          <div className="card monthly-selector">
            <div>
              <h2>Monthly Payment Status</h2>
              <p>Paid and pending members for selected month.</p>
            </div>
            <div className="month-controls">
              <select value={selectedMonth} onChange={e=>setSelectedMonth(Number(e.target.value))}>
                {months.map((m,i)=><option key={m} value={i+1}>{m}</option>)}
              </select>
              <select value={selectedYear} onChange={e=>setSelectedYear(Number(e.target.value))}>
                {[2025,2026,2027,2028,2029,2030].map(y=><option key={y} value={y}>{y}</option>)}
              </select>
              <button className="primary" onClick={loadMonthlyStatus}>View</button>
            </div>
          </div>

          {monthlyLoading && <div className="card"><p>Loading monthly status...</p></div>}

          {monthlyStatus && !monthlyLoading && (
            <>
              <div className="stats">
                <Stat title="Month Members" value={monthlyStatus.totalMembers}/>
                <Stat title="Paid" value={monthlyStatus.paidCount}/>
                <Stat title="Pending" value={monthlyStatus.pendingCount}/>
                <Stat title="Month Collection" value={money(monthlyStatus.totalPaidAmount)}/>
                <Stat title="Pending Amount" value={money(monthlyStatus.pendingAmount)}/>
              </div>

              <div className="monthly-grid">
                <div className="card">
                  <div className="card-head">
                    <div>
                      <h2>✅ Paid Members</h2>
                      <p>{months[selectedMonth-1]} {selectedYear}</p>
                    </div>
                    <span className="count-badge paid-count">{monthlyStatus.paidCount}</span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>#</th><th>Member</th><th>Phone</th><th>Amount</th><th>Date</th></tr></thead>
                      <tbody>
                        {monthlyStatus.paid.length === 0
                          ? <tr><td colSpan="5">No paid members.</td></tr>
                          : monthlyStatus.paid.map((m,i)=>
                            <tr key={m.id}>
                              <td>{i+1}</td>
                              <td><strong>{m.name}</strong><br/><small>{m.email}</small></td>
                              <td>{m.phone || "-"}</td>
                              <td>{money(m.amount)}</td>
                              <td>{dateText(m.paidAt)}</td>
                            </tr>
                          )
                        }
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card">
                  <div className="card-head">
                    <div>
                      <h2>⏳ Pending Members</h2>
                      <p>{months[selectedMonth-1]} {selectedYear}</p>
                    </div>
                    <span className="count-badge pending-count">{monthlyStatus.pendingCount}</span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>#</th><th>Member</th><th>Monthly</th><th>Status</th></tr></thead>
                      <tbody>
                        {monthlyStatus.pending.length === 0
                          ? <tr><td colSpan="4">🎉 All active members have paid!</td></tr>
                          : monthlyStatus.pending.map((m,i)=>
                            <tr key={m.id}>
                              <td>{i+1}</td>
                              <td><strong>{m.name}</strong><br/><small>{m.phone || m.email}</small></td>
                              <td>{money(m.monthlyAmount)}</td>
                              <td><span className="badge pending">Pending</span></td>
                            </tr>
                          )
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="card">
                <h2>Monthly Report</h2>
                <div className="report-buttons">
                  <button onClick={()=>{
                    const rows = [
                      ...monthlyStatus.paid.map(m=>({
                        Name:m.name, Email:m.email, Phone:m.phone || "",
                        Status:"Paid", Amount:m.amount, Date:dateText(m.paidAt)
                      })),
                      ...monthlyStatus.pending.map(m=>({
                        Name:m.name, Email:m.email, Phone:m.phone || "",
                        Status:"Pending", Amount:0, Date:"-"
                      }))
                    ];
                    downloadExcel(`MSK-${months[selectedMonth-1]}-${selectedYear}.xlsx`, rows);
                  }}>📗 Excel</button>

                  <button onClick={()=>{
                    const rows = [
                      ...monthlyStatus.paid.map(m=>[
                        m.name,m.phone || "-","Paid",money(m.amount),dateText(m.paidAt)
                      ]),
                      ...monthlyStatus.pending.map(m=>[
                        m.name,m.phone || "-","Pending",money(0),"-"
                      ])
                    ];
                    downloadPdf(
                      `MSK Youth Club - ${months[selectedMonth-1]} ${selectedYear}`,
                      ["Member","Phone","Status","Amount","Paid Date"],
                      rows,
                      `MSK-${months[selectedMonth-1]}-${selectedYear}.pdf`
                    );
                  }}>📄 PDF</button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "members" && (
        <div className="grid2">
          <form className="card form" onSubmit={addMember}>
            <h2>Add Member</h2>
            <input placeholder="Member name" value={memberForm.name} onChange={e=>setMemberForm({...memberForm,name:e.target.value})} required/>
            <input placeholder="Email" type="email" value={memberForm.email} onChange={e=>setMemberForm({...memberForm,email:e.target.value})} required/>
            <input placeholder="Phone" value={memberForm.phone} onChange={e=>setMemberForm({...memberForm,phone:e.target.value})}/>
            <input placeholder="Login password" type="password" value={memberForm.password} onChange={e=>setMemberForm({...memberForm,password:e.target.value})} required/>
            <input placeholder="Monthly amount" type="number" value={memberForm.monthlyAmount} onChange={e=>setMemberForm({...memberForm,monthlyAmount:e.target.value})}/>
            <button className="primary">Create Member Login</button>
          </form>

          <div className="card">
            <h2>Members ({members.length})</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Phone</th><th>Monthly</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {members.map(m=>(
                    <tr key={m._id}>
                      <td>{m.name}<br/><small>{m.email}</small></td>
                      <td>{m.phone || "-"}</td>
                      <td>{money(m.monthlyAmount)}</td>
                      <td><span className={m.active ? "badge paid":"badge pending"}>{m.active?"Active":"Inactive"}</span></td>
                      <td>
                        <button onClick={()=>toggleMember(m)}>{m.active?"Deactivate":"Activate"}</button>
                        {" "}
                        <button className="danger" onClick={()=>deleteMember(m)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "payments" && (
        <div className="grid2">
          <form className="card form" onSubmit={addPayment}>
            <h2>Record Monthly Payment</h2>
            <select value={paymentForm.memberId} onChange={e=>setPaymentForm({...paymentForm,memberId:e.target.value})} required>
              <option value="">Select member</option>
              {members.filter(m=>m.active).map(m=><option key={m._id} value={m._id}>{m.name}</option>)}
            </select>
            <select value={paymentForm.month} onChange={e=>setPaymentForm({...paymentForm,month:Number(e.target.value)})}>
              {months.map((m,i)=><option key={m} value={i+1}>{m}</option>)}
            </select>
            <input type="number" value={paymentForm.year} onChange={e=>setPaymentForm({...paymentForm,year:Number(e.target.value)})}/>
            <input type="number" placeholder="Amount" value={paymentForm.amount} onChange={e=>setPaymentForm({...paymentForm,amount:e.target.value})} required/>
            <input placeholder="Note" value={paymentForm.note} onChange={e=>setPaymentForm({...paymentForm,note:e.target.value})}/>
            <button className="primary">Mark Paid</button>
          </form>

          <div className="card">
            <div className="card-head">
              <h2>Collection History</h2>
              <div className="button-row">
                <button onClick={()=>downloadExcel("msk-payments.xlsx",paymentRows)}>Excel</button>
                <button onClick={()=>downloadPdf(
                  "MSK Youth Club - Collection Report",
                  ["Member","Month","Year","Amount","Date"],
                  payments.map(p=>[p.member?.name || "",months[p.month-1],p.year,money(p.amount),dateText(p.paidAt)]),
                  "msk-collection-report.pdf"
                )}>PDF</button>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead><tr><th>Member</th><th>Month</th><th>Year</th><th>Amount</th><th>Date</th></tr></thead>
                <tbody>
                  {payments.map(p=><tr key={p._id}>
                    <td>{p.member?.name || "-"}</td>
                    <td>{months[p.month-1]}</td>
                    <td>{p.year}</td>
                    <td>{money(p.amount)}</td>
                    <td>{dateText(p.paidAt)}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "varavu" && (
        <div className="grid2">
          <form className="card form" onSubmit={addIncome}>
            <h2>➕ Add Varavu / Income</h2>
            <input placeholder="Income title" value={incomeForm.title} onChange={e=>setIncomeForm({...incomeForm,title:e.target.value})} required/>
            <input type="number" placeholder="Amount" value={incomeForm.amount} onChange={e=>setIncomeForm({...incomeForm,amount:e.target.value})} required/>
            <input placeholder="Category" value={incomeForm.category} onChange={e=>setIncomeForm({...incomeForm,category:e.target.value})}/>
            <input type="date" value={incomeForm.date} onChange={e=>setIncomeForm({...incomeForm,date:e.target.value})}/>
            <input placeholder="Note" value={incomeForm.note} onChange={e=>setIncomeForm({...incomeForm,note:e.target.value})}/>
            <button className="primary">Add Varavu</button>
          </form>

          <div className="card">
            <div className="card-head">
              <div><h2>Varavu History</h2><p>Total: {money(summary?.otherIncome)}</p></div>
              <div className="button-row">
                <button onClick={()=>downloadExcel("msk-varavu.xlsx",incomeRows)}>Excel</button>
                <button onClick={()=>downloadPdf("MSK Youth Club - Varavu",["Title","Category","Amount","Date"],incomes.map(i=>[i.title,i.category,money(i.amount),dateText(i.date)]),"msk-varavu.pdf")}>PDF</button>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead><tr><th>Title</th><th>Category</th><th>Amount</th><th>Date</th><th>Actions</th></tr></thead>
                <tbody>
                  {incomes.map(i=>(
                    <tr key={i._id}>
                      <td>{i.title}<br/><small>{i.note || ""}</small></td>
                      <td>{i.category}</td>
                      <td>{money(i.amount)}</td>
                      <td>{dateText(i.date)}</td>
                      <td>
                        <button onClick={()=>setEditingIncome({...i,date:new Date(i.date).toISOString().slice(0,10)})}>Edit</button>{" "}
                        <button className="danger" onClick={()=>deleteIncome(i._id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {editingIncome && (
            <div className="card edit-card">
              <h2>Edit Varavu</h2>
              <form className="form" onSubmit={saveIncome}>
                <input value={editingIncome.title} onChange={e=>setEditingIncome({...editingIncome,title:e.target.value})} required/>
                <input type="number" value={editingIncome.amount} onChange={e=>setEditingIncome({...editingIncome,amount:e.target.value})} required/>
                <input value={editingIncome.category} onChange={e=>setEditingIncome({...editingIncome,category:e.target.value})}/>
                <input type="date" value={editingIncome.date} onChange={e=>setEditingIncome({...editingIncome,date:e.target.value})}/>
                <input value={editingIncome.note || ""} onChange={e=>setEditingIncome({...editingIncome,note:e.target.value})}/>
                <div className="button-row">
                  <button className="primary">Save Changes</button>
                  <button type="button" onClick={()=>setEditingIncome(null)}>Cancel</button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {tab === "selavu" && (
        <div className="grid2">
          <form className="card form" onSubmit={addExpense}>
            <h2>➕ Add Selavu / Expense</h2>
            <input placeholder="Expense title" value={expenseForm.title} onChange={e=>setExpenseForm({...expenseForm,title:e.target.value})} required/>
            <input type="number" placeholder="Amount" value={expenseForm.amount} onChange={e=>setExpenseForm({...expenseForm,amount:e.target.value})} required/>
            <input placeholder="Category" value={expenseForm.category} onChange={e=>setExpenseForm({...expenseForm,category:e.target.value})}/>
            <input type="date" value={expenseForm.date} onChange={e=>setExpenseForm({...expenseForm,date:e.target.value})}/>
            <input placeholder="Note" value={expenseForm.note} onChange={e=>setExpenseForm({...expenseForm,note:e.target.value})}/>
            <button className="primary">Add Selavu</button>
          </form>

          <div className="card">
            <div className="card-head">
              <div><h2>Selavu History</h2><p>Total: {money(summary?.expense)}</p></div>
              <div className="button-row">
                <button onClick={()=>downloadExcel("msk-selavu.xlsx",expenseRows)}>Excel</button>
                <button onClick={()=>downloadPdf("MSK Youth Club - Selavu",["Title","Category","Amount","Date"],expenses.map(e=>[e.title,e.category,money(e.amount),dateText(e.date)]),"msk-selavu.pdf")}>PDF</button>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead><tr><th>Title</th><th>Category</th><th>Amount</th><th>Date</th><th>Actions</th></tr></thead>
                <tbody>
                  {expenses.map(e=>(
                    <tr key={e._id}>
                      <td>{e.title}<br/><small>{e.note || ""}</small></td>
                      <td>{e.category}</td>
                      <td>{money(e.amount)}</td>
                      <td>{dateText(e.date)}</td>
                      <td>
                        <button onClick={()=>setEditingExpense({...e,date:new Date(e.date).toISOString().slice(0,10)})}>Edit</button>{" "}
                        <button className="danger" onClick={()=>deleteExpense(e._id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {editingExpense && (
            <div className="card edit-card">
              <h2>Edit Selavu</h2>
              <form className="form" onSubmit={saveExpense}>
                <input value={editingExpense.title} onChange={e=>setEditingExpense({...editingExpense,title:e.target.value})} required/>
                <input type="number" value={editingExpense.amount} onChange={e=>setEditingExpense({...editingExpense,amount:e.target.value})} required/>
                <input value={editingExpense.category} onChange={e=>setEditingExpense({...editingExpense,category:e.target.value})}/>
                <input type="date" value={editingExpense.date} onChange={e=>setEditingExpense({...editingExpense,date:e.target.value})}/>
                <input value={editingExpense.note || ""} onChange={e=>setEditingExpense({...editingExpense,note:e.target.value})}/>
                <div className="button-row">
                  <button className="primary">Save Changes</button>
                  <button type="button" onClick={()=>setEditingExpense(null)}>Cancel</button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {tab === "reports" && (
        <div className="card">
          <h2>Download Reports</h2>
          <div className="report-buttons">
            <button onClick={()=>downloadExcel("msk-members.xlsx",members.map(m=>({
              Name:m.name,Email:m.email,Phone:m.phone,
              MonthlyAmount:m.monthlyAmount,Status:m.active?"Active":"Inactive",
              Joined:dateText(m.joinedAt)
            })))}>Members Excel</button>

            <button onClick={()=>downloadExcel("msk-payments.xlsx",paymentRows)}>Payments Excel</button>
            <button onClick={()=>downloadExcel("msk-varavu.xlsx",incomeRows)}>Varavu Excel</button>
            <button onClick={()=>downloadExcel("msk-selavu.xlsx",expenseRows)}>Selavu Excel</button>

            <button onClick={()=>downloadPdf(
              "MSK Youth Club - Varavu",
              ["Title","Category","Amount","Date"],
              incomes.map(i=>[i.title,i.category,money(i.amount),dateText(i.date)]),
              "varavu.pdf"
            )}>Varavu PDF</button>

            <button onClick={()=>downloadPdf(
              "MSK Youth Club - Selavu",
              ["Title","Category","Amount","Date"],
              expenses.map(e=>[e.title,e.category,money(e.amount),dateText(e.date)]),
              "selavu.pdf"
            )}>Selavu PDF</button>

            <button onClick={()=>downloadPdf(
              "MSK Youth Club - Payments",
              ["Member","Month","Year","Amount"],
              payments.map(p=>[p.member?.name || "",months[p.month-1],p.year,money(p.amount)]),
              "payments.pdf"
            )}>Payments PDF</button>
          </div>
        </div>
      )}
    </section>
  );
}

function App() {
  const [user, setUser] = useState(
    () => JSON.parse(localStorage.getItem("msk_user") || "null")
  );

  function logout() {
    localStorage.removeItem("msk_token");
    localStorage.removeItem("msk_user");
    setUser(null);
  }

  if (!user) return <Login onLogin={setUser}/>;

  return (
    <Layout user={user} onLogout={logout}>
      {user.role === "admin" ? <AdminDashboard/> : <MemberDashboard/>}
    </Layout>
  );
}

createRoot(document.getElementById("root")).render(<App/>);
