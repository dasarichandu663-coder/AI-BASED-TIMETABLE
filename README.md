# 🤖 ChronosAI - Smart Timetable Generator & Absence Rescheduling Engine
### NEP 2020 Intelligent Scheduling System • Multi-Constraint Solver • Automated Faculty Substitution

ChronosAI is an academic timetable generation and faculty absence management platform designed in alignment with **NEP 2020** recommendations.

---

## 🌟 Key Features

1. **Institutional Bell Timings & Duration Controls**:
   - **Custom College Start Time**: Configurable (e.g. 09:00 AM).
   - **Flexible Lecture Durations**: Configurable (40, 45, 50, 55, 60 minutes).
   - **Dedicated Lunch Duration & Slot**: Configurable recess (30, 45, 50, 60 minutes).
   - **Live Bell Schedule Timeline**: Visual preview showing start-to-end times for all daily periods.
   - **Timetable Period Timestamps**: Every period row, lunch recess, and subject card includes formatted time ranges (e.g. `09:00 AM - 09:50 AM`).

2. **AI Constraint-Satisfaction Scheduling Engine (Zero Conflicts)**:
   - **Faculty Non-Overlap**: Guarantees no instructor is double-booked across sections.
   - **Infrastructure Verification**: Lecture halls vs. specialized laboratories (AI lab, Hardware lab, etc.) are matched with course types.
   - **Classroom Clash Prevention**: 100% collision-free room assignments.
   - **Protected Lunch Intervals**: Configurable common dining/lunch recess period across all batches.
   - **Workload Dispersion**: Distributes weekly contact hours across weekdays to avoid subject clustering.

2. **Automated Teacher Absence & Peer Substitution**:
   - Mark an instructor on leave for a specific date.
   - The engine automatically locates qualified, unassigned peer faculty members with compatible free slots.
   - Preserves facility allocations or relocates seamlessly.
   - Drafts official notification dispatch emails for assigned substitute professors with one-click copy.

3. **Multi-Dimensional Timetable Views**:
   - 🎓 **Class / Section View**: Cohort-specific weekly schedule.
   - 👨‍🏫 **Faculty Workload View**: Individual professor's weekly schedule & free periods.
   - 🚪 **Room / Lab Occupancy View**: Laboratory and lecture hall utilization timeline.
   - 📊 **Master Schedule Matrix**: Full institutional matrix.

4. **Analytics & Faculty Workload Monitoring**:
   - Visual progress bars comparing assigned teaching hours against standard UGC/NEP maximum thresholds (18–22 hrs/week).
   - Facility occupancy rate calculations.

5. **Data Management & Export**:
   - ⚡ **1-Click Demo Data Loader**: Pre-loads a collegiate department dataset with courses, professors, labs, and cohorts.
   - 💾 **Local Storage Persistence**: Automatically saves all edits, custom subjects, and generated timetables.
   - 📊 **Export to CSV**: Formatted spreadsheet output for Microsoft Excel & Google Sheets.
   - 💾 **Export JSON**: Full institutional backup and restoration.
   - 🖨️ **Print & PDF Mode**: Clean print stylesheet for issuing official physical schedules.
   - 🌓 **Dark / Light Mode**: Smooth theme toggling.

---

## 🚀 How to Run Locally

1. Open `index.html` in any modern web browser (Google Chrome, Microsoft Edge, Firefox, Safari, Brave).
2. Or use a local web server (e.g. VS Code Live Server or Python):
   ```bash
   python -m http.server 8000
   ```
   Then navigate to `http://localhost:8000`.

---

## 📁 File Structure

- [index.html](file:///c:/Users/dasar/OneDrive/Desktop/cc/index.html) - Semantic, accessible structure with responsive cards, tabs, and modals.
- [style.css](file:///c:/Users/dasar/OneDrive/Desktop/cc/style.css) - Modern design system, HSL color tokens, dark/light theme, and `@media print` rules.
- [app.js](file:///c:/Users/dasar/OneDrive/Desktop/cc/app.js) - Constraint solver, absence reallocator, slot inspector, analytics, and LocalStorage engine.
- [README.md](file:///c:/Users/dasar/OneDrive/Desktop/cc/README.md) - Project documentation.
