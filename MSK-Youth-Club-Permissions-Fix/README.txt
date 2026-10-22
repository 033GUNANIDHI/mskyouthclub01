MSK Youth Club - Member Permissions UI + API route fix

WHAT CHANGED
- Members table now has a short Permissions button instead of a long permission editor in every row.
- Clicking Permissions opens a compact dialog with Payment access and Varavu-Selavu View/Add/Edit/Update controls.
- Updated backend source contains the /api/admin/members/:id/permissions PATCH route and /api/admin/audit route.

REPLACE FILES
1. Backup your current project first.
2. Replace client/src/main.jsx with main.jsx.
3. Replace client/src/styles.css with styles.css.
4. Replace server/src/server.js with server.js.
5. Keep your existing .env files and MongoDB URI unchanged.

IMPORTANT FOR THE 404 ERROR
Run the backend from the server folder so the correct source file is used:
  cd server
  npm install
  npm start

Expected backend message: API running on http://localhost:4000 (unless PORT is configured differently).
Keep frontend VITE_API_URL set to http://localhost:4000 in client/.env for local development.
Restart Vite after editing client files, then hard-refresh the browser (Ctrl+Shift+R).

TEST STATUS
- Backend JavaScript syntax check passed.
- Frontend production build could not be verified because the local Vite installation is incomplete (missing vite/bin/vite.js). Run npm install inside client, then npm run build.
- Do not deploy to production until local login, member permissions save, payments, Varavu/Selavu and existing records are tested.
