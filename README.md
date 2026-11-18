# MSK Youth Club - Modern Full-Featured Version 3.0

Professional web portal for MSK Youth Club to manage club members, monthly subscription collections, additional Varavu (income), Selavu (expenses), detailed statements, and reports.

---

## 🌟 Key Features & Updates

### 1. 🟢 One-Click WhatsApp Integration
- **WhatsApp Reminder for Pending Dues**: In Admin > Overview > Monthly Collection Status, admins can click the **🟢 WhatsApp** button next to any pending member to instantly launch WhatsApp with a pre-filled, personalized reminder in Tamil & English:
  `வணக்கம் [Member], MSK Youth Club [Month] [Year] மாத சந்தா பாக்கி தொகை ₹[Amount] செலுத்த வேண்டியுள்ளது. நன்றி!`
- **WhatsApp Payment Receipts**: In Admin > Collections, click **💬 WhatsApp** to instantly send the payment receipt details directly to the member's mobile number.

### 2. 📋 Comprehensive Member Management & Statements
- **Member Edit Profile**: Admins can edit member Name, Email, Phone, and Monthly Contribution Fee, and reset the member's password directly from the UI.
- **Member Account Statement**: Click **Statement** on any member to view their lifetime dues, pending months breakdown, and complete payment history, with one-click **PDF Statement Download** and WhatsApp share.
- **Member Directory Filter & Search**: Instant live search by name, email, or phone number, with Active/Inactive filters.

### 3. 💳 Advanced Payment & Collection Management
- **Searchable Collection History**: Filter payments by month, year, and search by member name or phone.
- **Official PDF Payment Receipts**: Generates a verified MSK Youth Club receipt with receipt number, period, payment date, and authorized management footer.
- **Delete & Edit Payments**: Admins can modify past records or delete erroneous payments with full audit tracking.
- **Monthly Target Progress Bar**: Displays live progress indicator of collected funds vs total expected monthly dues.

### 4. 💰 Varavu (Income) & 💸 Selavu (Expense) Management
- Full category tracking (Donation, Event, Maintenance, Sports, Ground, etc.).
- Live search by title or notes + category filtering.
- Dynamic total sum recalculation for filtered results.
- Edit and delete actions with confirmation dialogs.

### 5. 👥 Member Self-Service Portal
- Personalized welcome dashboard with key stat metrics.
- Visual Contribution Clearance progress bar (% dues cleared).
- Month-by-month pending dues table.
- My Payment History with individual PDF receipt downloads for every past payment.
- Full transparency into club finances (Total Varavu, Selavu, and Balance).

### 6. 🔒 Security & User Experience
- **🔑 Change Password Modal**: Available in the top navigation bar for both Admin and Members.
- **✨ Animated Toast Notifications**: Replaces disruptive static banners with smooth, floating auto-dismissing toast alerts (Success, Error, Info).
- **🎨 Modern Luxury Navy, Gold & Teal Glassmorphism**: Smooth tab transitions, micro-interactions, hover effects, modal zoom animations, and responsive mobile layout.

---

## 🚀 Setup & Local Development

### 1. Requirements
- Node.js (v18+)
- MongoDB Atlas or Local MongoDB

### 2. Server Configuration
Verify `server/.env`:
```env
PORT=4000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key_at_least_32_characters
ADMIN_EMAIL=admin@mskyouthclub.local
ADMIN_PASSWORD=your_secure_password
```

### 3. Client Configuration
Verify `client/.env`:
```env
VITE_API_URL=https://mskyouthclub01-1.onrender.com
# For local server development:
# VITE_API_URL=http://localhost:4000
```

### 4. Running Locally
From the project root:
```bash
# Install dependencies
npm run install:all

# Start both backend and frontend concurrently
npm run dev
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4000`

---

## 🚢 Deploy to Production

1. **GitHub**:
   ```bash
   git add .
   git commit -m "Upgrade to v3.0: Add WhatsApp reminders, member statements, password change, and smooth UI animations"
   git push origin main
   ```
2. **Render (Backend)**:
   Deploy the updated `server` repository.
3. **Vercel (Frontend)**:
   Trigger a new deployment or push to main. Ensure `VITE_API_URL` points to your active Render backend service.
