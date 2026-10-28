import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
const allowedOrigins = (process.env.CLIENT_ORIGIN || "").split(",").map(v => v.trim()).filter(Boolean);
app.use(cors({ origin(origin, callback) {
  if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return callback(null, true);
  return callback(new Error("Origin not allowed by CORS"));
} }));
app.use(express.json({ limit: "1mb" }));

const {
  PORT = 4000,
  MONGO_URI,
  MONGODB_URI,
  MONGO_URL,
  JWT_SECRET,
  ADMIN_EMAIL,
  ADMIN_PASSWORD
} = process.env;

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, default: "" },
  password: { type: String, required: true },
  role: { type: String, enum: ["admin", "member"], default: "member" },
  active: { type: Boolean, default: true },
  monthlyAmount: { type: Number, default: 0, min: 0 },
  joinedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const paymentSchema = new mongoose.Schema({
  member: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true },
  amount: { type: Number, required: true, min: 0 },
  paidAt: { type: Date, default: Date.now },
  note: { type: String, default: "" }
}, { timestamps: true });

paymentSchema.index({ member: 1, month: 1, year: 1 }, { unique: true });

const incomeSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  category: { type: String, default: "General" },
  date: { type: Date, default: Date.now },
  note: { type: String, default: "" }
}, { timestamps: true });

const expenseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  category: { type: String, default: "General" },
  date: { type: Date, default: Date.now },
  note: { type: String, default: "" }
}, { timestamps: true });

const auditSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  actorEmail: { type: String, default: "admin" },
  action: { type: String, required: true },
  entity: { type: String, default: "" },
  entityId: { type: String, default: "" },
  details: { type: String, default: "" }
}, { timestamps: true });
auditSchema.index({ createdAt: -1 });

const User = mongoose.model("User", userSchema);
const Payment = mongoose.model("Payment", paymentSchema);
const Income = mongoose.model("Income", incomeSchema);
const Expense = mongoose.model("Expense", expenseSchema);
const AuditLog = mongoose.model("AuditLog", auditSchema);

async function writeAudit(req, action, entity, entityId = "", details = "") {
  try { await AuditLog.create({ actor: req.user?._id, actorEmail: req.user?.email || "admin", action, entity, entityId: String(entityId || ""), details: String(details || "").slice(0, 500) }); }
  catch (error) { console.error("Audit log write failed:", error.message); }
}

function tokenFor(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function safeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    active: user.active,
    monthlyAmount: user.monthlyAmount || 0,
    joinedAt: user.joinedAt
  };
}

function auth(requiredRole = null) {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization || "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : null;
      if (!token) return res.status(401).json({ message: "Login required" });

      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user || !user.active) {
        return res.status(401).json({ message: "Account inactive or not found" });
      }
      if (requiredRole && user.role !== requiredRole) {
        return res.status(403).json({ message: "Admin access required" });
      }

      req.user = user;
      next();
    } catch {
      res.status(401).json({ message: "Invalid or expired token" });
    }
  };
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "MSK Youth Club API" });
});

// AUTH
app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    const password = String(req.body.password || "");
    const user = await User.findOne({ email });

    if (!user) return res.status(401).json({ message: "Invalid email or password" });
    if (!user.active) return res.status(403).json({ message: "Your account is inactive" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: "Invalid email or password" });

    res.json({ token: tokenFor(user), user: safeUser(user) });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.get("/api/me", auth(), async (req, res) => {
  res.json({ user: safeUser(req.user) });
});


// ADMIN MEMBERS
app.get("/api/admin/members", auth("admin"), async (req, res) => {
  const members = await User.find({ role: "member" })
    .sort({ createdAt: -1 })
    .select("-password");
  res.json(members);
});

app.post("/api/admin/members", auth("admin"), async (req, res) => {
  try {
    const { name, email, phone, password, monthlyAmount } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required"
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(409).json({ message: "Email already exists" });

    const hash = await bcrypt.hash(password, 10);

    const member = await User.create({
      name,
      email: normalizedEmail,
      phone: phone || "",
      password: hash,
      role: "member",
      monthlyAmount: Number(monthlyAmount || 0)
    });

    await writeAudit(req, "MEMBER_CREATED", "Member", member._id, `Created member ${member.name}`);
    res.status(201).json({
      message: "Member created",
      member: safeUser(member)
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.patch("/api/admin/members/:id", auth("admin"), async (req, res) => {
  try {
    const member = await User.findOne({
      _id: req.params.id,
      role: "member"
    });
    if (!member) return res.status(404).json({ message: "Member not found" });

    const { name, phone, monthlyAmount, password } = req.body;
    if (name !== undefined) member.name = name;
    if (phone !== undefined) member.phone = phone;
    if (monthlyAmount !== undefined) member.monthlyAmount = Number(monthlyAmount || 0);
    if (password) member.password = await bcrypt.hash(password, 10);

    await member.save();
    await writeAudit(req, "MEMBER_UPDATED", "Member", member._id, `Updated member ${member.name}`);
    res.json({ message: "Member updated", member: safeUser(member) });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.patch("/api/admin/members/:id/status", auth("admin"), async (req, res) => {
  const member = await User.findOne({ _id: req.params.id, role: "member" });
  if (!member) return res.status(404).json({ message: "Member not found" });

  member.active = Boolean(req.body.active);
  await member.save();
  await writeAudit(req, member.active ? "MEMBER_ACTIVATED" : "MEMBER_DEACTIVATED", "Member", member._id, `${member.name} active=${member.active}`);

  res.json({ message: "Member status updated", member: safeUser(member) });
});

app.delete("/api/admin/members/:id", auth("admin"), async (req, res) => {
  const member = await User.findOne({ _id: req.params.id, role: "member" });
  if (!member) return res.status(404).json({ message: "Member not found" });
  member.active = false;
  await member.save();
  await writeAudit(req, "MEMBER_ARCHIVED", "Member", member._id, `Archived ${member.name}; payment history preserved`);
  res.json({ message: "Member archived; payment history preserved", member: safeUser(member) });
});

// MONTHLY PAYMENTS
app.post("/api/admin/payments", auth("admin"), async (req, res) => {
  try {
    const payment = await Payment.create({
      member: req.body.memberId,
      month: Number(req.body.month),
      year: Number(req.body.year),
      amount: Number(req.body.amount),
      note: req.body.note || ""
    });

    await writeAudit(req, "PAYMENT_CREATED", "Payment", payment._id, `${payment.month}/${payment.year} amount ₹${payment.amount}`);
    res.status(201).json(payment);
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({
        message: "Payment already recorded for this member/month/year"
      });
    }
    res.status(500).json({ message: e.message });
  }
});


app.patch("/api/admin/payments/:id", auth("admin"), async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        message: "Payment record not found"
      });
    }

    const { memberId, month, year, amount, note, paidAt } = req.body;

    if (memberId !== undefined) payment.member = memberId;
    if (month !== undefined) payment.month = Number(month);
    if (year !== undefined) payment.year = Number(year);
    if (amount !== undefined) payment.amount = Number(amount);
    if (note !== undefined) payment.note = note;
    if (paidAt !== undefined) payment.paidAt = new Date(paidAt);

    await payment.save();
    await writeAudit(req, "PAYMENT_UPDATED", "Payment", payment._id, `${payment.month}/${payment.year} amount ₹${payment.amount}`);

    res.json({
      message: "Payment updated successfully",
      payment
    });
  } catch (error) {
    console.error("Payment update failed:", error);
    res.status(500).json({
      message: "Failed to update payment"
    });
  }
});


app.get("/api/admin/payments", auth("admin"), async (req, res) => {
  const payments = await Payment.find()
    .populate("member", "name email phone monthlyAmount")
    .sort({ year: -1, month: -1, paidAt: -1 });

  res.json(payments);
});

app.get("/api/member/payments", auth("member"), async (req, res) => {
  const payments = await Payment.find({ member: req.user._id })
    .sort({ year: -1, month: -1 });

  res.json(payments);
});

// MONTH-WISE PAID / PENDING
app.get("/api/admin/monthly-status", auth("admin"), async (req, res) => {
  try {
    const month = Number(req.query.month);
    const year = Number(req.query.year);

    if (!month || !year || month < 1 || month > 12) {
      return res.status(400).json({ message: "Valid month and year are required" });
    }

    const members = await User.find({
      role: "member",
      active: true
    }).select("-password");

    const payments = await Payment.find({ month, year }).populate("member", "name email phone monthlyAmount");
    const paymentByMember = new Map(payments.filter(p => p.member).map(p => [p.member._id.toString(), p]));
    const paid = [];
    const pending = [];

    for (const member of members) {
      const payment = paymentByMember.get(member._id.toString());
      const monthlyAmount = Number(member.monthlyAmount || 0);
      const amountPaid = Math.max(0, Number(payment?.amount || 0));
      const isPaid = payment && amountPaid > 0 && (monthlyAmount === 0 || amountPaid >= monthlyAmount);
      if (isPaid) {
        paid.push({ id: member._id, name: member.name, email: member.email, phone: member.phone, amount: amountPaid, paidAt: payment.paidAt, note: payment.note });
      } else {
        pending.push({ id: member._id, name: member.name, email: member.email, phone: member.phone, monthlyAmount, paidAmount: amountPaid, remainingAmount: Math.max(0, monthlyAmount - amountPaid) });
      }
    }

    const totalPaidAmount = payments.reduce((sum, p) => sum + Math.max(0, Number(p.amount || 0)), 0);
    const pendingAmount = pending.reduce((sum, p) => sum + Number(p.remainingAmount || 0), 0);

    res.json({
      month,
      year,
      totalMembers: members.length,
      paidCount: paid.length,
      pendingCount: pending.length,
      totalPaidAmount,
      pendingAmount,
      paid,
      pending
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// INCOME / VARAVU
app.post("/api/admin/incomes", auth("admin"), async (req, res) => {
  try {
    const income = await Income.create({
      title: req.body.title,
      amount: Number(req.body.amount),
      category: req.body.category || "General",
      date: req.body.date || new Date(),
      note: req.body.note || ""
    });

    await writeAudit(req, "INCOME_CREATED", "Income", income._id, `${income.title}: ₹${income.amount}`);
    res.status(201).json(income);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.get("/api/admin/incomes", auth("admin"), async (req, res) => {
  const incomes = await Income.find().sort({ date: -1, createdAt: -1 });
  res.json(incomes);
});

app.patch("/api/admin/incomes/:id", auth("admin"), async (req, res) => {
  try {
    const income = await Income.findById(req.params.id);
    if (!income) return res.status(404).json({ message: "Income not found" });

    income.title = req.body.title;
    income.amount = Number(req.body.amount);
    income.category = req.body.category || "General";
    income.date = req.body.date || income.date;
    income.note = req.body.note || "";

    await income.save();
    await writeAudit(req, "INCOME_UPDATED", "Income", income._id, `${income.title}: ₹${income.amount}`);
    res.json({ message: "Income updated", income });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.delete("/api/admin/incomes/:id", auth("admin"), async (req, res) => {
  const income = await Income.findByIdAndDelete(req.params.id);
  if (!income) return res.status(404).json({ message: "Income not found" });
  await writeAudit(req, "INCOME_DELETED", "Income", income._id, `${income.title}: ₹${income.amount}`);
  res.json({ message: "Income deleted" });
});

// EXPENSE / SELAVU
app.post("/api/admin/expenses", auth("admin"), async (req, res) => {
  try {
    const expense = await Expense.create({
      title: req.body.title,
      amount: Number(req.body.amount),
      category: req.body.category || "General",
      date: req.body.date || new Date(),
      note: req.body.note || ""
    });

    await writeAudit(req, "EXPENSE_CREATED", "Expense", expense._id, `${expense.title}: ₹${expense.amount}`);
    res.status(201).json(expense);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.get("/api/admin/expenses", auth("admin"), async (req, res) => {
  const expenses = await Expense.find().sort({ date: -1, createdAt: -1 });
  res.json(expenses);
});

app.patch("/api/admin/expenses/:id", auth("admin"), async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: "Expense not found" });

    expense.title = req.body.title;
    expense.amount = Number(req.body.amount);
    expense.category = req.body.category || "General";
    expense.date = req.body.date || expense.date;
    expense.note = req.body.note || "";

    await expense.save();
    await writeAudit(req, "EXPENSE_UPDATED", "Expense", expense._id, `${expense.title}: ₹${expense.amount}`);
    res.json({ message: "Expense updated", expense });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.delete("/api/admin/expenses/:id", auth("admin"), async (req, res) => {
  const expense = await Expense.findByIdAndDelete(req.params.id);
  if (!expense) return res.status(404).json({ message: "Expense not found" });
  await writeAudit(req, "EXPENSE_DELETED", "Expense", expense._id, `${expense.title}: ₹${expense.amount}`);
  res.json({ message: "Expense deleted" });
});

// ADMIN SUMMARY
app.get("/api/admin/summary", auth("admin"), async (req, res) => {
  const [members, payments, incomes, expenses] = await Promise.all([
    User.countDocuments({ role: "member" }),
    Payment.find(),
    Income.find(),
    Expense.find()
  ]);

  const paymentIncome = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const otherIncome = incomes.reduce((s, i) => s + Number(i.amount || 0), 0);
  const income = paymentIncome + otherIncome;
  const expense = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  res.json({
    members,
    payments: payments.length,
    paymentIncome,
    otherIncome,
    income,
    expense,
    balance: income - expense
  });
});

// MEMBER OVERVIEW
app.get("/api/member/overview", auth("member"), async (req, res) => {
  const [myPayments, incomes, expenses, clubPaymentAgg] = await Promise.all([
    Payment.find({ member: req.user._id }).sort({ year: -1, month: -1 }),
    Income.find().sort({ date: -1, createdAt: -1 }),
    Expense.find().sort({ date: -1, createdAt: -1 }),
    Payment.aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }])
  ]);

  // Pending / total paid are ALWAYS the member's own numbers.
  const payments = myPayments;
  const totalPaid = myPayments.reduce((s, p) => s + Number(p.amount || 0), 0);

  // Club overview (default for every member): totals only, no other member's details.
  const paymentIncome = clubPaymentAgg[0]?.total || 0;
  const otherIncome = incomes.reduce((s, i) => s + Number(i.amount || 0), 0);
  const totalIncome = paymentIncome + otherIncome;
  const totalExpense = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const clubBalance = totalIncome - totalExpense;

  // Calculate dues from the member's join month through current month.
  // Existing future-dated records are not counted.
  const now = new Date();
  const joined = new Date(req.user.joinedAt);
  const startYear = joined.getFullYear();
  const startMonth = joined.getMonth() + 1;
  const endYear = now.getFullYear();
  const endMonth = now.getMonth() + 1;

  let expectedMonths = 0;
  let cursorYear = startYear;
  let cursorMonth = startMonth;

  while (
    cursorYear < endYear ||
    (cursorYear === endYear && cursorMonth <= endMonth)
  ) {
    expectedMonths++;
    cursorMonth++;
    if (cursorMonth === 13) {
      cursorMonth = 1;
      cursorYear++;
    }
    if (expectedMonths > 240) break;
  }

const monthlyAmount = Number(req.user.monthlyAmount || 0);
const expectedAmount = expectedMonths * monthlyAmount;


  const paymentByMonth = new Map(payments.map(p => [`${p.year}-${p.month}`, Number(p.amount || 0)]));
  const pendingMonthList = [];
  cursorYear = startYear;
  cursorMonth = startMonth;
  let checkedMonths = 0;
  while (cursorYear < endYear || (cursorYear === endYear && cursorMonth <= endMonth)) {
    const key = `${cursorYear}-${cursorMonth}`;
    const amountPaidForMonth = paymentByMonth.get(key) || 0;
    // A zero-amount record is not a paid month. A month is pending until its monthly fee is covered.
    if (amountPaidForMonth <= 0 || (monthlyAmount > 0 && amountPaidForMonth < monthlyAmount)) {
      pendingMonthList.push({
        month: cursorMonth,
        year: cursorYear,
        monthlyAmount,
        paidAmount: amountPaidForMonth,
        remainingAmount: Math.max(monthlyAmount - amountPaidForMonth, 0)
      });
    }
    cursorMonth++;
    if (cursorMonth === 13) { cursorMonth = 1; cursorYear++; }
    if (++checkedMonths > 240) break;
  }
  const pendingAmount = pendingMonthList.reduce((sum, item) => sum + item.remainingAmount, 0);
  const pendingMonths = pendingMonthList.length;

  res.json({
    member: safeUser(req.user),
    payments,
    incomes,
    expenses,
    totalPaid,
    expectedAmount,
    pendingAmount,
    pendingMonths,
    pendingMonthList,
    clubPaymentIncome: paymentIncome,
    clubOtherIncome: otherIncome,
    totalIncome,
    totalExpense,
    clubBalance
  });
});

// ADMIN AUDIT HISTORY
app.get("/api/admin/audit", auth("admin"), async (req, res) => {
  const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(250).lean();
  res.json(logs);
});

// ADMIN REPORT DATA
app.get("/api/admin/finance", auth("admin"), async (req, res) => {
  const [incomes, expenses] = await Promise.all([
    Income.find().sort({ date: -1 }),
    Expense.find().sort({ date: -1 })
  ]);
  res.json({ incomes, expenses });
});

async function ensureAdmin() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required in .env");
  }

  const email = ADMIN_EMAIL.toLowerCase();
  const existing = await User.findOne({ email });

  if (!existing) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    await User.create({
      name: "MSK Youth Club Admin",
      email,
      password: hash,
      role: "admin",
      active: true
    });

    console.log("Admin account created:", email);
  }
}

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error("JWT_SECRET must be configured with at least 32 characters in server/.env");
  process.exit(1);
}

const mongoUri = MONGO_URI || MONGODB_URI || MONGO_URL;

if (!mongoUri) {
  console.error(
    "MongoDB connection failed: missing connection string. Add MONGO_URI=mongodb://127.0.0.1:27017/msk-youth-club to server/.env (or use MONGODB_URI / MONGO_URL)."
  );
  process.exit(1);
}

mongoose.connect(mongoUri)
  .then(async () => {
    console.log("MongoDB connected");
    await ensureAdmin();

    app.listen(PORT, () => {
      console.log(`API running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error("MongoDB connection failed:", err.message);
    if (err.message?.includes("querySrv") || err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
      console.error("Atlas DNS/network tip: verify the cluster hostname copied from Atlas > Connect > Drivers, check your internet/DNS, and try another network or DNS resolver. This error is usually not a database-password error.");
    }
    if (err.message?.includes("Authentication failed")) {
      console.error("Atlas authentication tip: check the Database Access username/password. URL-encode special characters in the password.");
    }
    process.exit(1);
  });
