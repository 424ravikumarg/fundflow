# Fundflow — Smart Cash Flow & Financial Intelligence

**Fundflow** is a modern personal finance tracking application built with Next.js, React, TypeScript, Tailwind CSS, PostgreSQL (AWS RDS), and an encrypted AWS S3 document vault.

---

## ✨ Key Features

* **Real-Time Cash Flow Analytics**: Area charts visualizing income vs. spending trends and donut charts breaking down expenses by category.
* **Recurring Finances & Subscriptions**: Track monthly and annual run-rates, upcoming billing reminders, and export `.ics` calendars.
* **Smart Categorization Rules**: Automated merchant keyword matching and rule execution engine.
* **Multi-Format Document Vault**: Ingest bank statements in **PDF, Excel (`.xlsx`, `.xls`), Word (`.docx`), and CSV** with automated transaction extraction into PostgreSQL.
* **Budget Caps & Pacing**: Category spending limits with pacing alerts and projected month-end burn rates.
* **Financial Goals**: Milestone tracking with visual progress indicators and target date calculations.
* **Global Currency Selection**: Choose from 10 major global currencies (USD `$`, INR `₹`, EUR `€`, GBP `£`, CAD `CA$`, AUD `A$`, JPY `¥`, etc.) with instant database and UI synchronization.

---

## 🚀 Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to view Fundflow.
