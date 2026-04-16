# Project Improvement Roadmap

Items are grouped by priority. Completed items are checked off.

---

## ✅ Done (This Session)

- [x] **Frontend only rendered 4 of 8 AI response fields** — Added Duration, Contraindications, Side Effects, Confidence Score per medication + new Additional Tests section
- [x] **Monolithic AI prompt** — Replaced with agentic two-agent pipeline (Agent 1: Diagnosis → Agent 2: Treatment) using Jinja2 templates
- [x] **max_tokens cap at 3000** — Raised to 4096 to prevent mid-JSON truncation
- [x] **JSON parse fragility** — Added `response_format: json_object` to eliminate regex fallback parsing

---

## 🔴 High Priority

- [ ] **Dashboard stats are hardcoded**
  - Wire up a `/api/v1/stats` endpoint that returns real counts from the DB (total patients, analyses today, reports generated)
  - Replace mock data in `Dashboard.tsx` with a live `useQuery` call

- [ ] **History page only shows Conditions & Risk Factors**
  - The full `AnalysisResult` is already fetched — just render medications, additional tests, confidence, and treatment notes too (same cards as the Analysis result view)

- [ ] **No Lab Results input on the frontend**
  - The backend AI prompt uses `lab_results` but the form has no field for it
  - Add a key-value table widget to the Analysis form (e.g. "Glucose: 13.2 mmol/L")

- [ ] **Every analysis creates a new patient (no returning patient flow)**
  - Patient ID is auto-generated UUID every form submit
  - Add a "Search existing patient" step before the form — if found, pre-fill from DB; if not, create new

---

## 🟡 Medium Priority

- [ ] **No print/export on the result screen**
  - Add "Export PDF" or "Print" button to the Analysis result view
  - Can use `window.print()` with a print-specific CSS class as a quick win

- [ ] **Batch upload gives no row-level error feedback**
  - The backend tracks per-row errors in `BatchStatus.errors` already
  - Surface this in `BatchUpload.tsx` so failed rows are visible with a reason

- [ ] **No input validation beyond `required` fields**
  - Add sensible range guards: age 1–120, temp 34–43°C, HR 20–300, SpO2 50–100%
  - Show inline validation messages before the form submits

- [ ] **Severity-based model escalation**
  - When severity is "Critical", switch `model` from `gpt-4o-mini` → `gpt-4o` for higher accuracy
  - Simple conditional in `_run_pipeline()` based on the severity field

---

## 🟢 Nice to Have

- [ ] **No authentication on the frontend**
  - The backend has subscription/auth endpoints — the frontend has no login flow yet
  - Add a login page and route guards so unauthenticated users are redirected

- [ ] **No loading skeletons**
  - History, Dashboard fetch data with no visual feedback during load
  - Add skeleton placeholder cards while queries are pending

- [ ] **Prompt specialisation by medical specialty**
  - The template system now makes this easy — add `cardiology.j2`, `respiratory.j2`, `endocrinology.j2` variants
  - Add a "Specialty" dropdown to the Analysis form that selects the template to use

- [ ] **Analysis result comparison**
  - Allow viewing two past analyses side-by-side from the History page to track patient progress over time

---

## 💡 Future / Bigger Ideas

- [ ] **Wearable dataset integration** — The CSV in the repo suggests wearable data is planned; connect it to the analysis pipeline as a data source for vitals
- [ ] **Doctor report auto-generation** — After a single analysis completes, offer a one-click "Generate Doctor Report" button
- [ ] **Notification on batch completion** — Send an email/webhook when a batch CSV finishes processing
