# MSK Youth Club - Full Updated Version

## Included
- Admin and Member login
- Add member with monthly contribution amount
- Month-wise paid/pending list
- Member pending amount and pending months
- Monthly collection
- Varavu / Income add, edit, delete
- Selavu / Expense add, edit, delete
- Club total income, expense and balance
- Member can view club Varavu/Selavu and totals
- Member payment history
- Excel and PDF reports
- Mobile responsive UI
- MongoDB + Express + React + JWT

## Setup

1. Install Node.js.
2. Copy `server/.env.example` to `server/.env` (the `.env` file must be inside the `server` folder).
3. Set `MONGO_URI` in `server/.env`.
   - **MongoDB Atlas:** In Atlas, open your cluster > Connect > Drivers and copy the current connection string. Replace `<db_password>` with the password for a **Database Access** user (not your Atlas website login). Do not include the angle brackets. If the password contains characters such as `@`, `:`, `/`, `?`, `#`, or `%`, URL-encode them. Confirm the hostname matches the URI copied from Atlas.
   - In Atlas **Network Access**, allow your current public IP address. Do not use `0.0.0.0/0` permanently unless you understand the security risk.
   - If the error says `querySrv ECONNREFUSED`, it usually indicates a DNS/network issue before authentication. Check internet access, try another network, VPN/proxy settings, or a different DNS resolver. In PowerShell you can test the SRV record with `nslookup -type=SRV _mongodb._tcp.cluster0.pp0g4fw.mongodb.net`. Use the exact cluster hostname from your own Atlas URI.
   - **Local MongoDB:** use `MONGO_URI=mongodb://127.0.0.1:27017/msk-youth-club` and make sure the local MongoDB service is running.
   The server also accepts `MONGODB_URI` or `MONGO_URL`.
4. From project root:

```bash
npm install
npm run install:all
npm run dev
```

Frontend: http://localhost:5173
Backend: http://localhost:4000

Default admin from the example `.env`:
Email: admin@mskyouthclub.local
Password: 123456

Change the password before using the application seriously.

## Finance logic

Member monthly payment is stored separately as a Payment.
Admin-entered additional Varavu is stored in Income.
Admin-entered Selavu is stored in Expense.

Club total Varavu =
member payment collection + additional Varavu.

Club balance =
total Varavu - total Selavu.

Member pending amount =
expected monthly contribution from the member's join month through the current month minus the member's recorded payments.


### Latest UI update
- Added the provided MSK Youth Club logo to the login page, top navigation, and browser favicon.
- Added a more distinctive gold/navy visual style while keeping the mobile-responsive layout.


## Latest payment updates
- Admin can edit an existing payment from Admin > Payments > Collection History. Member, month, year, amount, paid date and note can be updated. Setting the amount to ₹0 makes that month pending again.
- Member dashboard includes a month-wise pending table with monthly fee, amount paid, balance and status.
- A month with no payment or a ₹0 payment is counted as pending, including when the member's configured monthly amount is ₹0.

## Deploy the update
1. Replace the corresponding project files with these updated files and test locally.
2. Push the changes to GitHub (`git add .`, `git commit -m "Add payment editing and month-wise pending dues"`, `git push`).
3. Render: deploy the updated `server` service from the connected GitHub repository. No new environment variable is required.
4. Vercel: deploy the updated frontend from the same repository (Root Directory: `client`). Keep `VITE_API_URL` set to `https://mskyouthclub01-1.onrender.com` if that is your active Render backend.
5. Test an existing payment by editing its amount to 0, then log in as that member and verify the month appears in Month-wise Pending Payments.
