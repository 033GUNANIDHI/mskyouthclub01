import express from "express";

import cors from "cors";

import dotenv from "dotenv";

import mongoose from "mongoose";

import bcrypt from "bcryptjs";

import jwt from "jsonwebtoken";



dotenv.config();



const app = express();

app.use(cors());

app.use(express.json());



const { PORT = 4000, MONGO_URI, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;



const userSchema = new mongoose.Schema({

  name: { type: String, required: true, trim: true },

  email: { type: String, required: true, unique: true, lowercase: true, trim: true },

  phone: { type: String, default: "" },

  password: { type: String, required: true },

  role: { type: String, enum: ["admin", "member"], default: "member" },

  active: { type: Boolean, default: true },

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



const expenseSchema = new mongoose.Schema({

  title: { type: String, required: true, trim: true },

  amount: { type: Number, required: true, min: 0 },

  category: { type: String, default: "General" },

  date: { type: Date, default: Date.now },

  note: { type: String, default: "" }

}, { timestamps: true });



const User = mongoose.model("User", userSchema);

const Payment = mongoose.model("Payment", paymentSchema);

const Expense = mongoose.model("Expense", expenseSchema);



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

      if (!user || !user.active) return res.status(401).json({ message: "Account inactive or not found" });

      if (requiredRole && user.role !== requiredRole) return res.status(403).json({ message: "Admin access required" });



      req.user = user;

      next();

    } catch {

      res.status(401).json({ message: "Invalid or expired token" });

    }

  };

}



app.get("/api/health", (req, res) => res.json({ ok: true, service: "MSK Youth Club API" }));



app.post("/api/auth/login", async (req, res) => {

  try {

    const { email, password } = req.body;

    const user = await User.findOne({ email: String(email || "").toLowerCase().trim() });

    if (!user) return res.status(401).json({ message: "Invalid email or password" });

    if (!user.active) return res.status(403).json({ message: "Your account is inactive" });



    const ok = await bcrypt.compare(password || "", user.password);

    if (!ok) return res.status(401).json({ message: "Invalid email or password" });



    res.json({ token: tokenFor(user), user: safeUser(user) });

  } catch (e) {

    res.status(500).json({ message: e.message });

  }

});



app.get("/api/me", auth(), async (req, res) => {

  res.json({ user: safeUser(req.user) });

});



// ADMIN: members

app.get("/api/admin/members", auth("admin"), async (req, res) => {

  const members = await User.find({ role: "member" }).sort({ createdAt: -1 }).select("-password");

  res.json(members);

});



app.post("/api/admin/members", auth("admin"), async (req, res) => {

  try {

    const { name, email, phone, password, monthlyAmount } = req.body;

    if (!name || !email || !password) {

      return res.status(400).json({ message: "Name, email and password are required" });

    }

    const exists = await User.findOne({ email: email.toLowerCase().trim() });

    if (exists) return res.status(409).json({ message: "Email already exists" });



    const hash = await bcrypt.hash(password, 10);

    const member = await User.create({

      name,

      email: email.toLowerCase().trim(),

      phone: phone || "",

      password: hash,

      role: "member"

    });



    res.status(201).json({

      message: "Member created",

      member: { ...safeUser(member), monthlyAmount: Number(monthlyAmount || 0) }

    });

  } catch (e) {

    res.status(500).json({ message: e.message });

  }

});



app.patch("/api/admin/members/:id/status", auth("admin"), async (req, res) => {

  const member = await User.findOne({ _id: req.params.id, role: "member" });

  if (!member) return res.status(404).json({ message: "Member not found" });

  member.active = Boolean(req.body.active);

  await member.save();

  res.json({ message: "Member status updated", member: safeUser(member) });

});



app.delete("/api/admin/members/:id", auth("admin"), async (req, res) => {

  const member = await User.findOneAndDelete({ _id: req.params.id, role: "member" });

  if (!member) return res.status(404).json({ message: "Member not found" });

  await Payment.deleteMany({ member: member._id });

  res.json({ message: "Member deleted" });

});



// PAYMENTS

app.post("/api/admin/payments", auth("admin"), async (req, res) => {

  try {

    const { memberId, month, year, amount, note } = req.body;

    const payment = await Payment.create({

      member: memberId,

      month: Number(month),

      year: Number(year),

      amount: Number(amount),

      note: note || ""

    });

    res.status(201).json(payment);

  } catch (e) {

    if (e.code === 11000) return res.status(409).json({ message: "Payment already recorded for this member/month/year" });

    res.status(500).json({ message: e.message });

  }

});



app.get("/api/admin/payments", auth("admin"), async (req, res) => {

  const payments = await Payment.find()

    .populate("member", "name email phone")

    .sort({ year: -1, month: -1, paidAt: -1 });

  res.json(payments);

});



app.get("/api/member/payments", auth("member"), async (req, res) => {

  const payments = await Payment.find({ member: req.user._id }).sort({ year: -1, month: -1 });

  res.json(payments);

});



// EXPENSES

app.post("/api/admin/expenses", auth("admin"), async (req, res) => {

  try {

    const expense = await Expense.create({

      title: req.body.title,

      amount: Number(req.body.amount),

      category: req.body.category || "General",

      date: req.body.date || new Date(),

      note: req.body.note || ""

    });

    res.status(201).json(expense);

  } catch (e) {

    res.status(500).json({ message: e.message });

  }

});



app.get("/api/admin/expenses", auth("admin"), async (req, res) => {

  const expenses = await Expense.find().sort({ date: -1 });

  res.json(expenses);

});

// MONTH-WISE PAID / PENDING LIST

app.get("/api/admin/monthly-status", auth("admin"), async (req, res) => {

  try {

    const month = Number(req.query.month);

    const year = Number(req.query.year);



    if (!month || !year || month < 1 || month > 12) {

      return res.status(400).json({

        message: "Valid month and year are required"

      });

    }



    // Get all active members

    const members = await User.find({

      role: "member",

      active: true

    }).select("-password");



    // Get payments for selected month/year

    const payments = await Payment.find({

      month,

      year

    }).populate("member", "name email phone");



    const paidMemberIds = new Set(

      payments.map(p => p.member?._id?.toString())

    );



    const paid = payments.map(p => ({

      id: p.member?._id,

      name: p.member?.name,

      email: p.member?.email,

      phone: p.member?.phone,

      amount: p.amount,

      paidAt: p.paidAt,

      note: p.note

    }));



    const pending = members

      .filter(member => !paidMemberIds.has(member._id.toString()))

      .map(member => ({

        id: member._id,

        name: member.name,

        email: member.email,

        phone: member.phone

      }));



    const totalPaidAmount = paid.reduce(

      (total, item) => total + Number(item.amount || 0),

      0

    );



    res.json({

      month,

      year,

      totalMembers: members.length,

      paidCount: paid.length,

      pendingCount: pending.length,

      totalPaidAmount,

      paid,

      pending

    });



  } catch (error) {

    console.error(error);

    res.status(500).json({

      message: error.message

    });

  }

});

// REPORTS / OVERVIEW

app.get("/api/admin/summary", auth("admin"), async (req, res) => {

  const [members, payments, expenses] = await Promise.all([

    User.countDocuments({ role: "member" }),

    Payment.find(),

    Expense.find()

  ]);

  const income = payments.reduce((s, p) => s + p.amount, 0);

  const expense = expenses.reduce((s, e) => s + e.amount, 0);

  res.json({

    members,

    payments: payments.length,

    income,

    expense,

    balance: income - expense

  });

});



app.get("/api/member/overview", auth("member"), async (req, res) => {

  const payments = await Payment.find({ member: req.user._id }).sort({ year: -1, month: -1 });

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

  res.json({

    member: safeUser(req.user),

    payments,

    totalPaid,

    paymentCount: payments.length

  });

});



async function ensureAdmin() {

  const existing = await User.findOne({ email: ADMIN_EMAIL?.toLowerCase() });

  if (!existing) {

    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    await User.create({

      name: "MSK Youth Club Admin",

      email: ADMIN_EMAIL.toLowerCase(),

      password: hash,

      role: "admin"

    });

    console.log("Admin account created:", ADMIN_EMAIL);

  }

}



mongoose.connect(MONGO_URI)

  .then(async () => {

    console.log("MongoDB connected");

    await ensureAdmin();

    app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));

  })

  .catch(err => {

    console.error("MongoDB connection failed:", err.message);

    process.exit(1);

  });
