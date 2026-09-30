# MSK Youth Club - Updated

Features:
- Admin and member login
- Admin can add, activate/deactivate and delete members
- Monthly payment recording
- Admin dashboard with month-wise Paid and Pending member lists
- Month/year selector
- Month-wise Excel and PDF report download
- Member payment overview with Excel/PDF download
- Varavu/Selavu expense tracking
- MongoDB + Express + React + JWT

## Run

1. Copy `server/.env.example` to `server/.env`.
2. Start MongoDB.
3. From the project root:

```bash
npm install
npm run install:all
npm run dev
```

Frontend: `http://localhost:5173`
Backend: `http://localhost:4000`

Admin:
- Email: `admin@mskyouthclub.local`
- Password: `123456`

Change the admin password before using the project for real data.
