# MSK Youth Club — Updated Project

React + Vite frontend, Express API, MongoDB, JWT authentication.

## Features
- Admin and member login with role-protected API routes.
- Member management, search by name/email/phone, activation and archive.
- Archiving a member disables login while preserving historical payment records.
- Month-wise payment status and pending dues; partial and zero-amount entries remain visible as pending.
- Payment edit/correction, month/year-filtered collection history, and downloadable PDF receipts.
- Varavu (income) and Selavu (expense) add/edit/delete workflows.
- Excel/PDF reports, finance snapshot chart, responsive styling, animations, reduced-motion support.
- Admin audit history for payment, member and income/expense changes.

## Run locally
1. Install Node.js LTS.
2. Copy `server/.env.example` to `server/.env` and enter your own MongoDB URI, strong JWT secret (32+ characters), and admin credentials.
3. Copy `client/.env.example` to `client/.env` (default is local API).
4. In the project root run:
   ```bash
   npm install
   npm run install:all
   npm run dev
   ```
5. Frontend: `http://localhost:5173`; API health check: `http://localhost:4000/api/health`.

## Deploy
- Frontend environment variable: `VITE_API_URL=https://YOUR-BACKEND.onrender.com`.
- Backend environment variables: `MONGO_URI`, `JWT_SECRET` (32+ random characters), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and optionally `CLIENT_ORIGIN` with your frontend origin.
- Keep production `.env` values in the hosting provider's secret/environment settings. Never commit them.
- Before deployment, take a MongoDB Atlas backup/snapshot and test on a staging database. This update intentionally does not reset collections or drop old data.

## Data-preservation notes
- No database reset, collection drop, or migration is run at startup.
- Existing users and payments remain in place.
- Member archive is now a soft-disable operation; it preserves linked payment history.
- Audit history starts recording supported changes after this version is deployed; it cannot reconstruct actions from before deployment.

## Important security note
The original uploaded archive contained a populated `server/.env` with database credentials and authentication secrets. Those values have been removed from this package. Rotate the MongoDB database-user password and JWT/admin secrets in your hosting provider before using the updated project. Never paste production secrets into source files or commit them to GitHub.
