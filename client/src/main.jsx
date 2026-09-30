import React, { useEffect, useMemo, useState } from "react";

import { createRoot } from "react-dom/client";

import * as XLSX from "xlsx";

import { saveAs } from "file-saver";

import jsPDF from "jspdf";

import autoTable from "jspdf-autotable";

import "./styles.css";



const API = "http://localhost:4000/api";

const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];



async function api(path, options = {}) {

  const token = localStorage.getItem("msk_token");

  const res = await fetch(API + path, {

    ...options,

    headers: {

      "Content-Type": "application/json",

      ...(token ? { Authorization: `Bearer ${token}` } : {}),

      ...(options.headers || {})

    }

  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data.message || "Request failed");

  return data;

}



function downloadExcel(filename, rows) {

  const ws = XLSX.utils.json_to_sheet(rows);

  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, ws, "MSK Youth Club");

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });

  saveAs(new Blob([out], { type: "application/octet-stream" }), filename);

}



function downloadPdf(title, columns, rows, filename) {

  const doc = new jsPDF();

  doc.setFontSize(18);

  doc.text(title, 14, 18);

  autoTable(doc, { startY: 26, head: [columns], body: rows });

  doc.save(filename);

}



function Login({ onLogin }) {

  const [form, setForm] = useState({ email:"", password:"" });

  const [error, setError] = useState("");



  async function submit(e) {

    e.preventDefault();

    setError("");

    try {

      const data = await api("/auth/login", { method:"POST", body:JSON.stringify(form) });

      localStorage.setItem("msk_token", data.token);

      localStorage.setItem("msk_user", JSON.stringify(data.user));

      onLogin(data.user);

    } catch (e) { setError(e.message); }

  }



  return <div className="login-page">

    <form className="login-card" onSubmit={submit}>

      <div className="logo">MSK</div>

      <h1>MSK Youth Club</h1>

      <p>Member & Admin Login</p>

      {error && <div className="error">{error}</div>}

      <input placeholder="Email" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required />

      <input placeholder="Password" type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required />

      <button className="primary">Login</button>

    </form>

  </div>

}



function Layout({ user, onLogout, children }) {

  return <div>

    <header className="topbar">

      <div><strong>MSK Youth Club</strong><span className="role">{user.role === "admin" ? "ADMIN" : "MEMBER"}</span></div>

      <button onClick={onLogout} className="logout">Logout</button>

    </header>

    <main className="container">{children}</main>

  </div>

}



function Stat({ title, value }) {

  return <div className="stat"><small>{title}</small><strong>{value}</strong></div>

}



function MemberDashboard() {

  const [data, setData] = useState(null);

  const [error, setError] = useState("");
  async function load() {

    try { setData(await api("/member/overview")); }

    catch(e) { setError(e.message); }

  }

  useEffect(()=>{ load(); },[]);



  if (error) return <div className="error">{error}</div>;

  if (!data) return <p>Loading...</p>;



  const rows = data.payments.map(p => ({

    Member: data.member.name,

    Month: months[p.month-1],

    Year: p.year,

    Amount: p.amount,

    PaidDate: new Date(p.paidAt).toLocaleDateString("en-IN"),

    Note: p.note || ""

  }));



  return <section>

    <div className="page-title">

      <div><h1>Welcome, {data.member.name}</h1><p>Your MSK Youth Club payment overview</p></div>

      <div className="download-actions">

        <button onClick={()=>downloadExcel("my-payments.xlsx", rows)}>Excel</button>

        <button onClick={()=>downloadPdf("MSK Youth Club - Payment Report",["Month","Year","Amount","Paid Date"],data.payments.map(p=>[months[p.month-1],p.year,`₹${p.amount}`,new Date(p.paidAt).toLocaleDateString("en-IN")]),"my-payment-report.pdf")}>PDF</button>

      </div>

    </div>

    <div className="stats">

      <Stat title="Total Paid" value={`₹${data.totalPaid.toLocaleString("en-IN")}`} />

      <Stat title="Payments" value={data.paymentCount} />

      <Stat title="Status" value={data.member.active ? "Active" : "Inactive"} />

    </div>

    <div className="card">

      <h2>Payment History</h2>

      <div className="table-wrap"><table><thead><tr><th>Month</th><th>Year</th><th>Amount</th><th>Paid Date</th><th>Note</th></tr></thead>

      <tbody>{data.payments.map(p=><tr key={p._id}><td>{months[p.month-1]}</td><td>{p.year}</td><td>₹{p.amount}</td><td>{new Date(p.paidAt).toLocaleDateString("en-IN")}</td><td>{p.note || "-"}</td></tr>)}</tbody></table></div>

    </div>

  </section>

}



function AdminDashboard() {

  const [summary,setSummary]=useState(null);

  const [members,setMembers]=useState([]);

  const [payments,setPayments]=useState([]);

  const [expenses,setExpenses]=useState([]);

  const [tab,setTab]=useState("overview");

  const [msg,setMsg]=useState("");

  const [selectedMonth, setSelectedMonth] = useState(

  new Date().getMonth() + 1

);



const [selectedYear, setSelectedYear] = useState(

  new Date().getFullYear()

);



const [monthlyStatus, setMonthlyStatus] = useState(null);

const [monthlyLoading, setMonthlyLoading] = useState(false);



  const [memberForm,setMemberForm]=useState({name:"",email:"",phone:"",password:"",monthlyAmount:""});

  const [paymentForm,setPaymentForm]=useState({memberId:"",month:new Date().getMonth()+1,year:new Date().getFullYear(),amount:"",note:""});

  const [expenseForm,setExpenseForm]=useState({title:"",amount:"",category:"General",date:new Date().toISOString().slice(0,10),note:""});



  async function loadMonthlyStatus() {
    try {
      setMonthlyLoading(true);
      setMsg("");
      const data = await api(`/admin/monthly-status?month=${selectedMonth}&year=${selectedYear}`);
      setMonthlyStatus(data);
    } catch (e) {
      console.error("Monthly status error:", e);
      setMsg(e.message);
    } finally {
      setMonthlyLoading(false);
    }
  }

  async function load() {

    const [s,m,p,e] = await Promise.all([

      api("/admin/summary"), api("/admin/members"), api("/admin/payments"), api("/admin/expenses")

    ]);

    setSummary(s); setMembers(m); setPayments(p); setExpenses(e);

    if (!paymentForm.memberId && m[0]) setPaymentForm(f=>({...f,memberId:m[0]._id}));

  }

  useEffect(()=>{load().catch(e=>setMsg(e.message));},[]);

  useEffect(() => {
    if (tab === "overview") loadMonthlyStatus();
  }, [selectedMonth, selectedYear, tab]);



  async function addMember(e) {

    e.preventDefault(); setMsg("");

    try {

      await api("/admin/members",{method:"POST",body:JSON.stringify(memberForm)});

      setMemberForm({name:"",email:"",phone:"",password:"",monthlyAmount:""});

      setMsg("Member added successfully");

      await load();

    } catch(e){setMsg(e.message);}

  }



  async function addPayment(e) {

    e.preventDefault(); setMsg("");

    try {

      await api("/admin/payments",{method:"POST",body:JSON.stringify(paymentForm)});

      setMsg("Payment recorded");

      setPaymentForm(f=>({...f,amount:"",note:""}));

      await load();

    } catch(e){setMsg(e.message);}

  }



  async function addExpense(e) {

    e.preventDefault(); setMsg("");

    try {

      await api("/admin/expenses",{method:"POST",body:JSON.stringify(expenseForm)});

      setMsg("Expense added");

      setExpenseForm({title:"",amount:"",category:"General",date:new Date().toISOString().slice(0,10),note:""});

      await load();

    } catch(e){setMsg(e.message);}

  }



  async function toggleMember(m) {

    try { await api(`/admin/members/${m._id}/status`,{method:"PATCH",body:JSON.stringify({active:!m.active})}); await load(); }

    catch(e){setMsg(e.message);}

  }



  async function deleteMember(m) {

    if (!confirm(`Delete ${m.name}? This also removes payment records.`)) return;

    try { await api(`/admin/members/${m._id}`,{method:"DELETE"}); await load(); }

    catch(e){setMsg(e.message);}

  }



  const paymentRows = payments.map(p=>({

    Member:p.member?.name || "", Email:p.member?.email || "", Month:months[p.month-1], Year:p.year, Amount:p.amount,

    PaidDate:new Date(p.paidAt).toLocaleDateString("en-IN")

  }));

  const expenseRows = expenses.map(x=>({

    Title:x.title, Category:x.category, Amount:x.amount, Date:new Date(x.date).toLocaleDateString("en-IN"), Note:x.note || ""

  }));



  return <section>

    <div className="page-title"><div><h1>Admin Dashboard</h1><p>Manage members, monthly collections and expenses</p></div></div>

    {msg && <div className="notice">{msg}</div>}

    <nav className="tabs">

      {["overview","members","payments","expenses","reports"].map(t=><button className={tab===t?"active":""} onClick={()=>setTab(t)} key={t}>{t}</button>)}

    </nav>



    {tab==="overview" && summary && <div>
      <div className="stats">
        <Stat title="Members" value={summary.members}/>
        <Stat title="Total Collection" value={`₹${summary.income.toLocaleString("en-IN")}`}/>
        <Stat title="Total Expense" value={`₹${summary.expense.toLocaleString("en-IN")}`}/>
        <Stat title="Balance" value={`₹${summary.balance.toLocaleString("en-IN")}`}/>
      </div>

      <div className="card monthly-selector">
        <div>
          <h2>Monthly Payment Status</h2>
          <p>Check paid and pending members month-wise.</p>
        </div>
        <div className="month-controls">
          <select value={selectedMonth} onChange={e=>setSelectedMonth(Number(e.target.value))}>
            {months.map((month,index)=><option key={month} value={index+1}>{month}</option>)}
          </select>
          <select value={selectedYear} onChange={e=>setSelectedYear(Number(e.target.value))}>
            {[2024,2025,2026,2027,2028,2029,2030].map(year=><option key={year} value={year}>{year}</option>)}
          </select>
          <button className="primary" onClick={loadMonthlyStatus}>View</button>
        </div>
      </div>

      {monthlyLoading && <div className="card"><p>Loading monthly payment details...</p></div>}

      {monthlyStatus && !monthlyLoading && <>
        <div className="stats">
          <Stat title="Month Members" value={monthlyStatus.totalMembers}/>
          <Stat title="Paid" value={monthlyStatus.paidCount}/>
          <Stat title="Pending" value={monthlyStatus.pendingCount}/>
          <Stat title="Month Collection" value={`₹${monthlyStatus.totalPaidAmount.toLocaleString("en-IN")}`}/>
        </div>

        <div className="monthly-grid">
          <div className="card">
            <div className="card-head">
              <div><h2>✅ Paid Members</h2><p>{months[selectedMonth-1]} {selectedYear}</p></div>
              <span className="count-badge paid-count">{monthlyStatus.paidCount}</span>
            </div>
            <div className="table-wrap"><table>
              <thead><tr><th>#</th><th>Member</th><th>Phone</th><th>Amount</th><th>Paid Date</th></tr></thead>
              <tbody>
                {monthlyStatus.paid.length===0 ? <tr><td colSpan="5">No payments found.</td></tr> : monthlyStatus.paid.map((member,index)=><tr key={member.id}>
                  <td>{index+1}</td><td><strong>{member.name}</strong><br/><small>{member.email}</small></td><td>{member.phone||"-"}</td>
                  <td><strong>₹{Number(member.amount).toLocaleString("en-IN")}</strong></td><td>{new Date(member.paidAt).toLocaleDateString("en-IN")}</td>
                </tr>)}
              </tbody>
            </table></div>
          </div>

          <div className="card">
            <div className="card-head">
              <div><h2>⏳ Pending Members</h2><p>{months[selectedMonth-1]} {selectedYear}</p></div>
              <span className="count-badge pending-count">{monthlyStatus.pendingCount}</span>
            </div>
            <div className="table-wrap"><table>
              <thead><tr><th>#</th><th>Member</th><th>Phone</th><th>Status</th></tr></thead>
              <tbody>
                {monthlyStatus.pending.length===0 ? <tr><td colSpan="4">🎉 All active members have paid!</td></tr> : monthlyStatus.pending.map((member,index)=><tr key={member.id}>
                  <td>{index+1}</td><td><strong>{member.name}</strong><br/><small>{member.email}</small></td><td>{member.phone||"-"}</td>
                  <td><span className="badge pending">Pending</span></td>
                </tr>)}
              </tbody>
            </table></div>
          </div>
        </div>

        <div className="card">
          <h2>Download {months[selectedMonth-1]} {selectedYear} Report</h2>
          <div className="report-buttons">
            <button onClick={()=>{
              const rows=[
                ...monthlyStatus.paid.map(m=>({Name:m.name,Email:m.email,Phone:m.phone||"",Status:"Paid",Amount:m.amount,Date:new Date(m.paidAt).toLocaleDateString("en-IN")})),
                ...monthlyStatus.pending.map(m=>({Name:m.name,Email:m.email,Phone:m.phone||"",Status:"Pending",Amount:0,Date:"-"}))
              ];
              downloadExcel(`MSK-${months[selectedMonth-1]}-${selectedYear}.xlsx`,rows);
            }}>📗 Download Excel</button>
            <button onClick={()=>{
              const rows=[
                ...monthlyStatus.paid.map(m=>[m.name,m.phone||"-","Paid",`₹${m.amount}`,new Date(m.paidAt).toLocaleDateString("en-IN")]),
                ...monthlyStatus.pending.map(m=>[m.name,m.phone||"-","Pending","₹0","-"])
              ];
              downloadPdf(`MSK Youth Club - ${months[selectedMonth-1]} ${selectedYear}`,["Member","Phone","Status","Amount","Paid Date"],rows,`MSK-${months[selectedMonth-1]}-${selectedYear}.pdf`);
            }}>📄 Download PDF</button>
          </div>
        </div>
      </>}
    </div>}

    {tab==="members" && <div className="grid2">

      <form className="card form" onSubmit={addMember}><h2>Add Member</h2>

        <input placeholder="Member name" value={memberForm.name} onChange={e=>setMemberForm({...memberForm,name:e.target.value})} required/>

        <input placeholder="Email" type="email" value={memberForm.email} onChange={e=>setMemberForm({...memberForm,email:e.target.value})} required/>

        <input placeholder="Phone" value={memberForm.phone} onChange={e=>setMemberForm({...memberForm,phone:e.target.value})}/>

        <input placeholder="Login password" type="password" value={memberForm.password} onChange={e=>setMemberForm({...memberForm,password:e.target.value})} required/>

        <input placeholder="Monthly amount" type="number" value={memberForm.monthlyAmount} onChange={e=>setMemberForm({...memberForm,monthlyAmount:e.target.value})}/>

        <button className="primary">Create Member Login</button>

      </form>

      <div className="card"><h2>Members ({members.length})</h2>

        <div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th>Action</th></tr></thead>

        <tbody>{members.map(m=><tr key={m._id}><td>{m.name}</td><td>{m.email}</td><td>{m.phone||"-"}</td><td><span className={m.active?"badge paid":"badge pending"}>{m.active?"Active":"Inactive"}</span></td><td><button onClick={()=>toggleMember(m)}>{m.active?"Deactivate":"Activate"}</button> <button className="danger" onClick={()=>deleteMember(m)}>Delete</button></td></tr>)}</tbody></table></div>

      </div>

    </div>}



    {tab==="payments" && <div className="grid2">

      <form className="card form" onSubmit={addPayment}><h2>Record Monthly Payment</h2>

        <select value={paymentForm.memberId} onChange={e=>setPaymentForm({...paymentForm,memberId:e.target.value})} required>

          <option value="">Select member</option>{members.filter(m=>m.active).map(m=><option key={m._id} value={m._id}>{m.name}</option>)}

        </select>

        <select value={paymentForm.month} onChange={e=>setPaymentForm({...paymentForm,month:Number(e.target.value)})}>{months.map((m,i)=><option key={m} value={i+1}>{m}</option>)}</select>

        <input type="number" value={paymentForm.year} onChange={e=>setPaymentForm({...paymentForm,year:Number(e.target.value)})}/>

        <input type="number" placeholder="Amount" value={paymentForm.amount} onChange={e=>setPaymentForm({...paymentForm,amount:e.target.value})} required/>

        <input placeholder="Note" value={paymentForm.note} onChange={e=>setPaymentForm({...paymentForm,note:e.target.value})}/>

        <button className="primary">Mark Paid</button>

      </form>

      <div className="card"><div className="card-head"><h2>Collection History</h2><div><button onClick={()=>downloadExcel("msk-payments.xlsx",paymentRows)}>Excel</button> <button onClick={()=>downloadPdf("MSK Youth Club - Collection Report",["Member","Month","Year","Amount","Paid Date"],payments.map(p=>[p.member?.name||"",months[p.month-1],p.year,`₹${p.amount}`,new Date(p.paidAt).toLocaleDateString("en-IN")]),"msk-collection-report.pdf")}>PDF</button></div></div>

        <div className="table-wrap"><table><thead><tr><th>Member</th><th>Month</th><th>Year</th><th>Amount</th><th>Date</th></tr></thead><tbody>{payments.map(p=><tr key={p._id}><td>{p.member?.name}</td><td>{months[p.month-1]}</td><td>{p.year}</td><td>₹{p.amount}</td><td>{new Date(p.paidAt).toLocaleDateString("en-IN")}</td></tr>)}</tbody></table></div>

      </div>

    </div>}



    {tab==="expenses" && <div className="grid2">

      <form className="card form" onSubmit={addExpense}><h2>Add Expense</h2>

        <input placeholder="Expense title" value={expenseForm.title} onChange={e=>setExpenseForm({...expenseForm,title:e.target.value})} required/>

        <input type="number" placeholder="Amount" value={expenseForm.amount} onChange={e=>setExpenseForm({...expenseForm,amount:e.target.value})} required/>

        <input placeholder="Category" value={expenseForm.category} onChange={e=>setExpenseForm({...expenseForm,category:e.target.value})}/>

        <input type="date" value={expenseForm.date} onChange={e=>setExpenseForm({...expenseForm,date:e.target.value})}/>

        <input placeholder="Note" value={expenseForm.note} onChange={e=>setExpenseForm({...expenseForm,note:e.target.value})}/>

        <button className="primary">Add Expense</button>

      </form>

      <div className="card"><div className="card-head"><h2>Expense History</h2><div><button onClick={()=>downloadExcel("msk-expenses.xlsx",expenseRows)}>Excel</button> <button onClick={()=>downloadPdf("MSK Youth Club - Expense Report",["Title","Category","Amount","Date"],expenses.map(x=>[x.title,x.category,`₹${x.amount}`,new Date(x.date).toLocaleDateString("en-IN")]),"msk-expense-report.pdf")}>PDF</button></div></div>

        <div className="table-wrap"><table><thead><tr><th>Title</th><th>Category</th><th>Amount</th><th>Date</th></tr></thead><tbody>{expenses.map(x=><tr key={x._id}><td>{x.title}</td><td>{x.category}</td><td>₹{x.amount}</td><td>{new Date(x.date).toLocaleDateString("en-IN")}</td></tr>)}</tbody></table></div>

      </div>

    </div>}



    {tab==="reports" && <div className="card"><h2>Download Reports</h2><p>Download the club records in Excel or PDF format.</p>

      <div className="report-buttons">

        <button onClick={()=>downloadExcel("msk-members.xlsx",members.map(m=>({Name:m.name,Email:m.email,Phone:m.phone,Status:m.active?"Active":"Inactive",Joined:new Date(m.joinedAt).toLocaleDateString("en-IN")})))}>Members Excel</button>

        <button onClick={()=>downloadExcel("msk-payments.xlsx",paymentRows)}>Payments Excel</button>

        <button onClick={()=>downloadExcel("msk-expenses.xlsx",expenseRows)}>Expenses Excel</button>

        <button onClick={()=>downloadPdf("MSK Youth Club - Members",["Name","Email","Phone","Status"],members.map(m=>[m.name,m.email,m.phone||"",m.active?"Active":"Inactive"]),"members.pdf")}>Members PDF</button>

        <button onClick={()=>downloadPdf("MSK Youth Club - Payments",["Member","Month","Year","Amount"],payments.map(p=>[p.member?.name||"",months[p.month-1],p.year,`₹${p.amount}`]),"payments.pdf")}>Payments PDF</button>

        <button onClick={()=>downloadPdf("MSK Youth Club - Expenses",["Title","Category","Amount","Date"],expenses.map(x=>[x.title,x.category,`₹${x.amount}`,new Date(x.date).toLocaleDateString("en-IN")]),"expenses.pdf")}>Expenses PDF</button>

      </div>

    </div>}

  </section>

}



function App() {

  const [user,setUser]=useState(()=>JSON.parse(localStorage.getItem("msk_user")||"null"));

  function logout(){localStorage.removeItem("msk_token");localStorage.removeItem("msk_user");setUser(null);}

  if (!user) return <Login onLogin={setUser}/>;

  return <Layout user={user} onLogout={logout}>{user.role==="admin"?<AdminDashboard/>:<MemberDashboard/>}</Layout>

}


createRoot(document.getElementById("root")).render(<App />);
