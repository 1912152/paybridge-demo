# Bank Payroll Advance Service — Demo Portal

A full localhost demo of the Payroll Advance Service (Advance Salary + EWA) with 4-role workflow.

---

## DISCLAIMER
This is a demonstration system only. It does not contain any real bank names, brand names, or financial data. All names, amounts, and records are fictional and for demo purposes only.

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
```

### 3. Open in Browser
```
http://localhost:3000
```

---

## Demo Credentials

| Role               | Email                 | Password     | Portal    |
|--------------------|-----------------------|--------------|-----------|
| Corporate Maker    | maker@bank.com        | maker123     | Corporate |
| Corporate Checker  | checker@bank.com      | checker123   | Corporate |
| Banker (Reviewer)  | banker@bank.com       | banker123    | Bank      |
| Banker Approver    | approver@bank.com     | approver123  | Bank      |

> Tip: Click on any credential card on the login page to auto-fill.

---

## Full Demo Workflow

### Step 1 — Corporate Maker
1. Login as `maker@bank.com`
2. Go to **"New Advance Salary"** in the sidebar
3. Download the Excel template (optional) or use your own `.xlsx` file with columns:
   - `Employee Name`, `Employee ID`, `CNIC`, `Account Number`, `Net Salary`, `Gross Salary`, `Month`
4. Upload the file → System validates and shows preview
5. Click **"Validate & Submit to Checker"**
6. Batch is now in status: `Pending Checker Review`

### Step 2 — Corporate Checker
1. Login as `checker@bank.com`
2. Go to **"Pending Review"** — see the batch from the Maker
3. Review employee data, amounts, service charge
4. Click **"Approve — Send to Bank"** (or Reject with remarks)
5. Batch moves to: `Pending Bank Review`

### Step 3 — Banker (Reviewer)
1. Login as `banker@bank.com`
2. Go to **"Incoming Batches"** — see the checker-approved batch
3. Review all financials and employee data
4. Click **"Recommend for Final Approval"** (or Reject)
5. Batch moves to: `Pending Final Approval`

### Step 4 — Banker Approver
1. Login as `approver@bank.com`
2. Go to **"Final Approval Queue"** — see the batch ready for final sign-off
3. Click **"Final Approve — Trigger Disbursement"**
4. 🎉 Batch is **Disbursed** — all employees paid!

---

## EWA Workflow
Same 4-step process but use **"New EWA Request"** in the Maker portal.

EWA Excel Template columns:
- `Employee Name`, `Employee ID`, `CNIC`, `Account Number`, `Monthly Salary`, `EWA Days`, `Month`

EWA Days = max 15 days. System auto-calculates: `(Monthly Salary ÷ 30) × Days`

---

## Features
- ✅ Real session-based login (4 separate users, 2 portals)
- ✅ Excel upload with server-side validation
- ✅ Live batch state flows through all 4 stages
- ✅ Rejection with remarks at any stage
- ✅ In-app notifications (per user, polled every 15s)
- ✅ Corporate management (Banker can add/view corporates)
- ✅ Approval chain visual on every batch
- ✅ Timeline audit trail per batch
- ✅ Downloadable Excel templates (AS and EWA)
- ✅ All data persists in-memory during the session

---

## Project Structure
```
paybridge/
├── server.js              ← Express server, all API routes, in-memory data
├── package.json
├── public/
│   ├── login.html         ← Login page
│   ├── dashboard.html     ← Dashboard shell
│   ├── css/
│   │   └── dashboard.css  ← All styles
│   └── js/
│       └── dashboard.js   ← All frontend logic (all 4 roles)
└── README.md
```

---

## Notes
- Data resets on server restart (in-memory, no database)
- For a persistent version, integrate MongoDB or SQLite
- Run multiple browser tabs/windows to simulate different users simultaneously
