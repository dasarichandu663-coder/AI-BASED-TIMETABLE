/**
 * ChronosAI - Smart Timetable Generator & Absence Rescheduling Engine
 * NEP 2020 Intelligent Scheduling System with Full Bell Timings & Durations
 */

/* ==========================================================================
   State & Global Database
   ========================================================================== */

let classes = [];
let teachers = [];
let rooms = [];
let subjects = [];
let timetable = [];
let changes = [];
let absenceLog = [];

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/* ==========================================================================
   Initialization & Event Listeners
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    setupTabNavigation();
    setupEventListeners();
    
    // Set default absence date to today
    const dateInput = document.getElementById("absenceDate");
    if (dateInput) {
        dateInput.value = new Date().toISOString().split("T")[0];
    }

    // Try loading saved data or initialize defaults
    if (!loadFromLocalStorage()) {
        loadDemoData(false); // Load sample data silently on first run
    } else {
        updateAll();
        if (timetable.length > 0) {
            renderTimetable();
            renderAnalytics();
        }
    }

    // Initialize Role-Based Authentication Portal
    initAuth();
});

function setupEventListeners() {
    // Theme toggle
    const themeBtn = document.getElementById("btnThemeToggle");
    if (themeBtn) {
        themeBtn.addEventListener("click", toggleTheme);
    }

    // Load demo data button
    const demoBtn = document.getElementById("btnLoadDemo");
    if (demoBtn) {
        demoBtn.addEventListener("click", () => loadDemoData(true));
    }

    // Quick generate button in header
    const quickGenBtn = document.getElementById("btnQuickGenerate");
    if (quickGenBtn) {
        quickGenBtn.addEventListener("click", () => {
            generateTimetable();
            switchTab("scheduleTab");
        });
    }

    // Global institutional timing & constraint change listeners
    const timingInputs = [
        "collegeStartTime",
        "periodDuration",
        "lunchDuration",
        "workingDays",
        "periodsPerDay",
        "lunchPeriodSelect"
    ];

    timingInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("change", () => {
                renderBellSchedulePreview();
                generateTimetable();
            });
        }
    });
}

/* ==========================================================================
   Timing Calculation Engine (Bell Schedule)
   ========================================================================== */

function getTimingSchedule() {
    const startTimeStr = document.getElementById("collegeStartTime")?.value || "09:00";
    const periodDuration = parseInt(document.getElementById("periodDuration")?.value, 10) || 50;
    const lunchDuration = parseInt(document.getElementById("lunchDuration")?.value, 10) || 50;
    const periods = parseInt(document.getElementById("periodsPerDay")?.value, 10) || 6;
    const lunchAfter = parseInt(document.getElementById("lunchPeriodSelect")?.value, 10) || 3;

    const parts = startTimeStr.split(":").map(Number);
    const startH = isNaN(parts[0]) ? 9 : parts[0];
    const startM = isNaN(parts[1]) ? 0 : parts[1];

    let curMin = (startH * 60) + startM;
    const timeline = [];

    for (let p = 0; p < periods; p++) {
        // If lunch break is scheduled after period p (e.g. after Period 3, when p == 3)
        if (p === lunchAfter) {
            const sMin = curMin;
            const eMin = curMin + lunchDuration;
            timeline.push({
                isLunch: true,
                periodIndex: -1,
                periodNumber: null,
                label: "🍱 Lunch Recess",
                shortLabel: "Lunch",
                startStr: formatMinutesToTime(sMin),
                endStr: formatMinutesToTime(eMin),
                rangeStr: `${formatMinutesToTime(sMin)} - ${formatMinutesToTime(eMin)}`,
                duration: lunchDuration
            });
            curMin += lunchDuration;
        }

        const sMin = curMin;
        const eMin = curMin + periodDuration;
        timeline.push({
            isLunch: false,
            periodIndex: p,
            periodNumber: p + 1,
            label: `Period ${p + 1}`,
            shortLabel: `P${p + 1}`,
            startStr: formatMinutesToTime(sMin),
            endStr: formatMinutesToTime(eMin),
            rangeStr: `${formatMinutesToTime(sMin)} - ${formatMinutesToTime(eMin)}`,
            duration: periodDuration
        });
        curMin += periodDuration;
    }

    return timeline;
}

function getTeachingPeriodTiming(periodIndex) {
    const timeline = getTimingSchedule();
    const slot = timeline.find(item => !item.isLunch && item.periodIndex === periodIndex);
    return slot || { rangeStr: "", label: `Period ${periodIndex + 1}` };
}

function formatMinutesToTime(totalMin) {
    const hours24 = Math.floor(totalMin / 60) % 24;
    const mins = totalMin % 60;
    const ampm = hours24 >= 12 ? "PM" : "AM";
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    const hh = String(hours12).padStart(2, "0");
    const mm = String(mins).padStart(2, "0");
    return `${hh}:${mm} ${ampm}`;
}

function renderBellSchedulePreview() {
    const container = document.getElementById("bellSchedulePreview");
    if (!container) return;

    const schedule = getTimingSchedule();
    container.innerHTML = schedule.map(slot => `
        <div class="bell-pill ${slot.isLunch ? 'lunch' : ''}">
            <div class="bell-pill-name">
                ${slot.isLunch ? '🍱' : '⏱️'} ${slot.label}
            </div>
            <div class="bell-pill-time">
                ${slot.rangeStr}
            </div>
        </div>
    `).join("");
}

/* ==========================================================================
   Theme Management
   ========================================================================== */

function initTheme() {
    const savedTheme = localStorage.getItem("chronos_theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
    updateThemeIcons(savedTheme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("chronos_theme", next);
    updateThemeIcons(next);
    showToast(`Switched to ${next} theme`, "info");
}

function updateThemeIcons(theme) {
    const sun = document.querySelector(".sun-icon");
    const moon = document.querySelector(".moon-icon");
    if (!sun || !moon) return;
    if (theme === "dark") {
        sun.style.display = "none";
        moon.style.display = "block";
    } else {
        sun.style.display = "block";
        moon.style.display = "none";
    }
}

/* ==========================================================================
   Tab Navigation System
   ========================================================================== */

function setupTabNavigation() {
    const tabButtons = document.querySelectorAll(".tab-btn");
    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetId = btn.getAttribute("data-tab");
            switchTab(targetId);
        });
    });
}

function switchTab(targetId) {
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-tab") === targetId);
    });
    document.querySelectorAll(".tab-pane").forEach(pane => {
        pane.classList.toggle("active", pane.id === targetId);
    });

    if (targetId === "scheduleTab") {
        if (timetable.length === 0) {
            generateTimetable();
        } else {
            updateFilterTargetDropdown();
            renderTimetable();
        }
    } else if (targetId === "adminTab") {
        renderAdminDashboard();
    } else if (targetId === "analyticsTab") {
        renderAnalytics();
    }
}

/* ==========================================================================
   Class / Batch Management
   ========================================================================== */

function addClass() {
    const input = document.getElementById("className");
    const name = input.value.trim();

    if (!name) {
        showToast("Please enter a valid class/section name", "warning");
        return;
    }

    if (classes.some(c => c.name.toLowerCase() === name.toLowerCase())) {
        showToast("A class with this name already exists", "warning");
        return;
    }

    classes.push({
        id: Date.now(),
        name: name
    });

    input.value = "";
    updateAll();
    saveToLocalStorage();
    showToast(`Added class: ${name}`, "success");
}

function deleteClass(id) {
    const cls = classes.find(c => c.id === id);
    classes = classes.filter(c => c.id !== id);
    subjects = subjects.filter(s => s.classId !== id);
    timetable = timetable.filter(t => t.classId !== id);

    updateAll();
    renderTimetable();
    renderAnalytics();
    saveToLocalStorage();
    showToast(`Deleted class ${cls ? cls.name : ""}`, "info");
}

function updateClassList() {
    const list = document.getElementById("classList");
    if (!list) return;

    if (classes.length === 0) {
        list.innerHTML = `<p class="text-muted small-text py-2">No classes registered yet.</p>`;
        return;
    }

    list.innerHTML = classes.map((c, index) => `
        <div class="entity-item">
            <div>
                <span class="entity-title">${index + 1}. ${escapeHtml(c.name)}</span>
            </div>
            <button class="btn-delete-item" onclick="deleteClass(${c.id})" title="Delete Class">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
        </div>
    `).join("");
}

/* ==========================================================================
   Faculty / Instructor Management
   ========================================================================== */

function addTeacher() {
    const nameInput = document.getElementById("teacherName");
    const emailInput = document.getElementById("teacherEmail");
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();

    if (!name || !email) {
        showToast("Please enter professor name and email address", "warning");
        return;
    }

    teachers.push({
        id: Date.now(),
        name: name,
        email: email,
        absent: false
    });

    nameInput.value = "";
    emailInput.value = "";
    updateAll();
    saveToLocalStorage();
    showToast(`Added faculty member: ${name}`, "success");
}

function toggleTeacherStatus(id) {
    const teacher = teachers.find(t => t.id === id);
    if (!teacher) return;

    teacher.absent = !teacher.absent;
    updateAll();
    saveToLocalStorage();
    showToast(`Updated status for ${teacher.name}: ${teacher.absent ? "Absent" : "Active"}`, "info");
}

function deleteTeacher(id) {
    const teacher = teachers.find(t => t.id === id);
    teachers = teachers.filter(t => t.id !== id);
    subjects = subjects.filter(s => s.teacherId !== id);
    timetable = timetable.filter(t => t.teacherId !== id);

    updateAll();
    renderTimetable();
    renderAnalytics();
    saveToLocalStorage();
    showToast(`Deleted faculty member: ${teacher ? teacher.name : ""}`, "info");
}

function updateTeacherList() {
    const list = document.getElementById("teacherList");
    if (!list) return;

    if (teachers.length === 0) {
        list.innerHTML = `<p class="text-muted small-text py-2">No faculty members registered yet.</p>`;
        return;
    }

    list.innerHTML = teachers.map(t => {
        const isAbsent = t.absent;
        return `
            <div class="entity-item">
                <div>
                    <span class="entity-title">${escapeHtml(t.name)}</span>
                    <div class="entity-meta">${escapeHtml(t.email)}</div>
                </div>
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span class="status-badge ${isAbsent ? 'status-absent' : 'status-present'}">
                        ${isAbsent ? 'Absent' : 'Present'}
                    </span>
                    <button class="btn-toggle-status" onclick="toggleTeacherStatus(${t.id})">
                        ${isAbsent ? 'Mark Active' : 'Mark Absent'}
                    </button>
                    <button class="btn-delete-item" onclick="deleteTeacher(${t.id})" title="Delete Faculty">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

/* ==========================================================================
   Room & Infrastructure Management
   ========================================================================== */

function addRoom() {
    const nameInput = document.getElementById("roomName");
    const typeSelect = document.getElementById("roomType");
    const name = nameInput.value.trim();
    const type = typeSelect.value;

    if (!name) {
        showToast("Please enter a room/lab name", "warning");
        return;
    }

    rooms.push({
        id: Date.now(),
        name: name,
        type: type
    });

    nameInput.value = "";
    updateAll();
    saveToLocalStorage();
    showToast(`Added facility: ${name} (${type})`, "success");
}

function deleteRoom(id) {
    const room = rooms.find(r => r.id === id);
    rooms = rooms.filter(r => r.id !== id);
    timetable = timetable.filter(t => t.roomId !== id);

    updateAll();
    renderTimetable();
    renderAnalytics();
    saveToLocalStorage();
    showToast(`Deleted room: ${room ? room.name : ""}`, "info");
}

function updateRoomList() {
    const list = document.getElementById("roomList");
    if (!list) return;

    if (rooms.length === 0) {
        list.innerHTML = `<p class="text-muted small-text py-2">No classrooms or laboratories added yet.</p>`;
        return;
    }

    list.innerHTML = rooms.map((r, index) => `
        <div class="entity-item">
            <div>
                <span class="entity-title">${index + 1}. ${escapeHtml(r.name)}</span>
                <span class="entity-meta"> &bull; ${r.type === 'lab' ? '🔬 Laboratory' : '🏛️ Classroom'}</span>
            </div>
            <button class="btn-delete-item" onclick="deleteRoom(${r.id})" title="Delete Room">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
        </div>
    `).join("");
}

/* ==========================================================================
   Course / Subject Management
   ========================================================================== */

function addSubject() {
    const classId = parseInt(document.getElementById("subjectClass").value, 10);
    const teacherId = parseInt(document.getElementById("subjectTeacher").value, 10);
    const name = document.getElementById("subjectName").value.trim();
    const periods = parseInt(document.getElementById("subjectPeriods").value, 10);
    const type = document.getElementById("subjectType").value;

    if (!classId || !teacherId || !name || isNaN(periods) || periods < 1) {
        showToast("Please complete all subject fields properly", "warning");
        return;
    }

    const teacher = teachers.find(t => t.id === teacherId);

    subjects.push({
        id: Date.now(),
        classId: classId,
        teacherId: teacherId,
        teacher: teacher ? teacher.name : "Unassigned",
        name: name,
        periods: periods,
        type: type
    });

    document.getElementById("subjectName").value = "";
    updateAll();
    saveToLocalStorage();
    showToast(`Added course: ${name} (${periods} periods/wk)`, "success");
}

function deleteSubject(id) {
    const subj = subjects.find(s => s.id === id);
    subjects = subjects.filter(s => s.id !== id);
    timetable = timetable.filter(t => t.subjectId !== id);

    updateAll();
    renderTimetable();
    renderAnalytics();
    saveToLocalStorage();
    showToast(`Deleted course: ${subj ? subj.name : ""}`, "info");
}

function updateSubjectList() {
    const list = document.getElementById("subjectList");
    if (!list) return;

    if (subjects.length === 0) {
        list.innerHTML = `<p class="text-muted small-text py-2">No courses allocated yet.</p>`;
        return;
    }

    list.innerHTML = subjects.map(s => {
        const cls = classes.find(c => c.id === s.classId);
        return `
            <div class="entity-item">
                <div>
                    <span class="entity-title">${escapeHtml(s.name)}</span>
                    <div class="entity-meta">
                        <strong>${cls ? escapeHtml(cls.name) : 'Unknown'}</strong> &bull; 
                        ${escapeHtml(s.teacher)} &bull; 
                        ${s.periods} hrs/wk &bull; 
                        <span style="text-transform:capitalize;">${s.type}</span>
                    </div>
                </div>
                <button class="btn-delete-item" onclick="deleteSubject(${s.id})" title="Delete Course">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `;
    }).join("");
}

/* ==========================================================================
   Dropdowns & Statistics Synchronization
   ========================================================================== */

function updateDropdowns() {
    const subjectClass = document.getElementById("subjectClass");
    if (subjectClass) {
        const curVal = subjectClass.value;
        subjectClass.innerHTML = `<option value="">Select Class</option>` +
            classes.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
        if (curVal) subjectClass.value = curVal;
    }

    const subjectTeacher = document.getElementById("subjectTeacher");
    if (subjectTeacher) {
        const curVal = subjectTeacher.value;
        subjectTeacher.innerHTML = `<option value="">Select Teacher</option>` +
            teachers.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("");
        if (curVal) subjectTeacher.value = curVal;
    }

    const absentTeacher = document.getElementById("absentTeacher");
    if (absentTeacher) {
        const curVal = absentTeacher.value;
        absentTeacher.innerHTML = `<option value="">Select Absent Teacher</option>` +
            teachers.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("");
        if (curVal) absentTeacher.value = curVal;
    }

    updateFilterTargetDropdown();
}

function updateFilterTargetDropdown() {
    const viewMode = document.getElementById("viewMode") ? document.getElementById("viewMode").value : "class";
    const filterContainer = document.getElementById("filterTargetContainer");
    const filterSelect = document.getElementById("filterTarget");
    const filterLabel = document.getElementById("filterTargetLabel");

    if (!filterContainer || !filterSelect || !filterLabel) return;

    if (viewMode === "master") {
        filterContainer.style.display = "none";
        return;
    }

    filterContainer.style.display = "flex";

    if (viewMode === "class") {
        filterLabel.innerText = "Select Class / Section";
        filterSelect.innerHTML = `<option value="all">-- All Classes --</option>` +
            classes.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
    } else if (viewMode === "teacher") {
        filterLabel.innerText = "Select Faculty Member";
        filterSelect.innerHTML = `<option value="all">-- All Faculty Members --</option>` +
            teachers.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("");
    } else if (viewMode === "room") {
        filterLabel.innerText = "Select Facility / Laboratory";
        filterSelect.innerHTML = `<option value="all">-- All Rooms & Labs --</option>` +
            rooms.map(r => `<option value="${r.id}">${escapeHtml(r.name)} (${r.type})</option>`).join("");
    }
}

function updateStats() {
    const classCountEl = document.getElementById("classCount");
    const teacherCountEl = document.getElementById("teacherCount");
    const roomCountEl = document.getElementById("roomCount");
    const subjectCountEl = document.getElementById("subjectCount");
    const changeCountEl = document.getElementById("changeCount");

    if (classCountEl) classCountEl.innerText = classes.length;
    if (teacherCountEl) teacherCountEl.innerText = teachers.length;
    if (roomCountEl) roomCountEl.innerText = rooms.length;
    if (subjectCountEl) subjectCountEl.innerText = subjects.length;
    if (changeCountEl) changeCountEl.innerText = changes.length;
}

function updateAll() {
    updateClassList();
    updateTeacherList();
    updateRoomList();
    updateSubjectList();
    updateDropdowns();
    updateStats();
    renderBellSchedulePreview();
    renderAdminDashboard();
}

/* ==========================================================================
   AI Timetable Solver Engine (Multi-Constraint CSP)
   ========================================================================== */

function generateTimetable() {
    if (classes.length === 0 || teachers.length === 0 || rooms.length === 0 || subjects.length === 0) {
        showToast("No academic structure found. Auto-loading autonomous collegiate dataset...", "info");
        loadDemoData(false);
        return;
    }

    const days = parseInt(document.getElementById("workingDays")?.value, 10) || 6;
    const periods = parseInt(document.getElementById("periodsPerDay")?.value, 10) || 6;

    timetable = [];
    changes = [];

    const teacherBusy = new Set();
    const roomBusy = new Set();
    const classBusy = new Set();

    let unassignedCount = 0;

    // Process each class / student cohort
    classes.forEach(cls => {
        const classSubjects = subjects.filter(s => s.classId === cls.id);
        const labSubjects = classSubjects.filter(s => s.type === "lab");
        const theorySubjects = classSubjects.filter(s => s.type !== "lab");

        // 1. ALLOCATE LAB SESSIONS IN CONTINUOUS BLOCKS (e.g. 2-period or 3-period blocks)
        labSubjects.forEach(lab => {
            let needed = lab.periods;
            while (needed > 0) {
                const blockSize = Math.min(needed, (periods >= 6 && needed >= 3) ? 3 : 2);
                let labPlaced = false;

                const dayOrder = smartShuffle([...Array(days).keys()]);
                for (const day of dayOrder) {
                    // Standard lab sessions occur in afternoon blocks or morning blocks
                    const possibleStarts = periods >= 6 ? [3, 4, 0, 1] : [0, 2];

                    for (const startP of possibleStarts) {
                        if (startP + blockSize > periods) continue;

                        let canFitBlock = true;
                        let selectedRoom = null;

                        const suitableLabRooms = rooms.filter(r => r.type === "lab");
                        const searchRooms = suitableLabRooms.length > 0 ? suitableLabRooms : rooms;

                        for (const r of searchRooms) {
                            let roomFree = true;
                            for (let p = startP; p < startP + blockSize; p++) {
                                const classKey = `${cls.id}-${day}-${p}`;
                                const teacherKey = `${lab.teacherId}-${day}-${p}`;
                                const roomKey = `${r.id}-${day}-${p}`;

                                if (classBusy.has(classKey) || teacherBusy.has(teacherKey) || roomBusy.has(roomKey)) {
                                    roomFree = false;
                                    break;
                                }
                            }
                            if (roomFree) {
                                selectedRoom = r;
                                break;
                            }
                        }

                        if (selectedRoom) {
                            for (let p = startP; p < startP + blockSize; p++) {
                                const classKey = `${cls.id}-${day}-${p}`;
                                const teacherKey = `${lab.teacherId}-${day}-${p}`;
                                const roomKey = `${selectedRoom.id}-${day}-${p}`;

                                classBusy.add(classKey);
                                teacherBusy.add(teacherKey);
                                roomBusy.add(roomKey);

                                timetable.push({
                                    id: Date.now() + Math.random(),
                                    classId: cls.id,
                                    className: cls.name,
                                    subjectId: lab.id,
                                    subject: lab.name,
                                    teacherId: lab.teacherId,
                                    teacher: lab.teacher,
                                    roomId: selectedRoom.id,
                                    room: selectedRoom.name,
                                    roomType: selectedRoom.type,
                                    day: day,
                                    period: p,
                                    type: "lab",
                                    changed: false
                                });
                            }
                            needed -= blockSize;
                            labPlaced = true;
                            break;
                        }
                    }
                    if (labPlaced) break;
                }

                if (!labPlaced) break;
            }
        });

        // 2. ALLOCATE THEORY & STANDARD COURSES (Dispersed across all days)
        let theoryPool = [];
        theorySubjects.forEach(s => {
            for (let i = 0; i < s.periods; i++) {
                theoryPool.push({ ...s });
            }
        });
        theoryPool = smartShuffle(theoryPool);

        const classSubjectDailyCount = {};

        for (let day = 0; day < days; day++) {
            for (let period = 0; period < periods; period++) {
                const classKey = `${cls.id}-${day}-${period}`;
                if (classBusy.has(classKey)) continue;

                for (let i = 0; i < theoryPool.length; i++) {
                    const candidate = theoryPool[i];
                    const dailyKey = `${candidate.id}-${day}`;
                    const timesToday = classSubjectDailyCount[dailyKey] || 0;

                    // Allow max 1 period per day (or 2 if high weekly volume)
                    if (timesToday >= (candidate.periods > 4 ? 2 : 1)) continue;

                    const teacherKey = `${candidate.teacherId}-${day}-${period}`;
                    if (teacherBusy.has(teacherKey)) continue;

                    const suitableRoom = rooms.find(r => {
                        if (r.type === "lab") return false;
                        const roomKey = `${r.id}-${day}-${period}`;
                        return !roomBusy.has(roomKey);
                    }) || rooms.find(r => !roomBusy.has(`${r.id}-${day}-${period}`));

                    if (suitableRoom) {
                        const roomKey = `${suitableRoom.id}-${day}-${period}`;
                        teacherBusy.add(teacherKey);
                        roomBusy.add(roomKey);
                        classBusy.add(classKey);

                        classSubjectDailyCount[dailyKey] = timesToday + 1;

                        timetable.push({
                            id: Date.now() + Math.random(),
                            classId: cls.id,
                            className: cls.name,
                            subjectId: candidate.id,
                            subject: candidate.name,
                            teacherId: candidate.teacherId,
                            teacher: candidate.teacher,
                            roomId: suitableRoom.id,
                            room: suitableRoom.name,
                            roomType: suitableRoom.type,
                            day: day,
                            period: period,
                            type: candidate.type || "theory",
                            changed: false
                        });

                        theoryPool.splice(i, 1);
                        break;
                    }
                }
            }
        }

        // 3. AUTONOMOUS COLLEGE GAP-FILLER:
        // Ensure every single day has full lectures without leaving empty gaps or whole days free
        const institutionalActivities = [
            { name: "Library & Research Reading", teacher: teachers[0]?.name || "Faculty Mentor", teacherId: teachers[0]?.id || 201 },
            { name: "Technical Seminar & Soft Skills", teacher: teachers[1]?.name || "Faculty Mentor", teacherId: teachers[1]?.id || 202 },
            { name: "Mini-Project / Coding Practice", teacher: teachers[2]?.name || "Lab Incharge", teacherId: teachers[2]?.id || 203 },
            { name: "Mentoring & Remedial Session", teacher: teachers[3]?.name || "Class Coordinator", teacherId: teachers[3]?.id || 204 },
            { name: "Sports & Co-Curricular Activity", teacher: teachers[4]?.name || "Physical Director", teacherId: teachers[4]?.id || 205 }
        ];

        let actIdx = 0;
        for (let day = 0; day < days; day++) {
            for (let period = 0; period < periods; period++) {
                const classKey = `${cls.id}-${day}-${period}`;
                if (classBusy.has(classKey)) continue;

                // Try placing any remaining unallocated theory subjects first
                let filled = false;
                for (let i = 0; i < theoryPool.length; i++) {
                    const candidate = theoryPool[i];
                    const teacherKey = `${candidate.teacherId}-${day}-${period}`;
                    if (teacherBusy.has(teacherKey)) continue;

                    const suitableRoom = rooms.find(r => !roomBusy.has(`${r.id}-${day}-${period}`));
                    if (suitableRoom) {
                        const roomKey = `${suitableRoom.id}-${day}-${period}`;
                        teacherBusy.add(teacherKey);
                        roomBusy.add(roomKey);
                        classBusy.add(classKey);

                        timetable.push({
                            id: Date.now() + Math.random(),
                            classId: cls.id,
                            className: cls.name,
                            subjectId: candidate.id,
                            subject: candidate.name,
                            teacherId: candidate.teacherId,
                            teacher: candidate.teacher,
                            roomId: suitableRoom.id,
                            room: suitableRoom.name,
                            roomType: suitableRoom.type,
                            day: day,
                            period: period,
                            type: candidate.type || "theory",
                            changed: false
                        });

                        theoryPool.splice(i, 1);
                        filled = true;
                        break;
                    }
                }

                if (!filled) {
                    const act = institutionalActivities[actIdx % institutionalActivities.length];
                    actIdx++;
                    const defaultRoom = rooms[0] || { id: 301, name: "Lecture Hall", type: "classroom" };

                    classBusy.add(classKey);
                    timetable.push({
                        id: Date.now() + Math.random(),
                        classId: cls.id,
                        className: cls.name,
                        subjectId: 900 + actIdx,
                        subject: act.name,
                        teacherId: act.teacherId,
                        teacher: act.teacher,
                        roomId: defaultRoom.id,
                        room: defaultRoom.name,
                        roomType: defaultRoom.type,
                        day: day,
                        period: period,
                        type: "theory",
                        changed: false
                    });
                }
            }
        }
    });

    renderTimetable();
    renderAnalytics();
    renderAdminDashboard();
    updateStats();
    saveToLocalStorage();

    const banner = document.getElementById("generateMessage");
    if (banner) {
        banner.style.display = "block";
        banner.className = "status-banner success";
        banner.innerHTML = `✅ Autonomous College Timetable generated! 100% full daily schedules with blocked laboratory sessions and balanced subject dispersion.`;
    }

    showToast("Autonomous College Timetable generated successfully!", "success");
}

function smartShuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

/* ==========================================================================
   Teacher Absence Management & Automated Rescheduling
   ========================================================================== */

function markTeacherAbsent() {
    if (timetable.length === 0) {
        showToast("Please generate a timetable first", "warning");
        return;
    }

    const absentSelect = document.getElementById("absentTeacher");
    const dateInput = document.getElementById("absenceDate");

    const teacherId = parseInt(absentSelect.value, 10);
    const dateStr = dateInput.value;

    if (!teacherId || !dateStr) {
        showToast("Please select the absent faculty member and effective date", "warning");
        return;
    }

    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) return;

    teacher.absent = true;

    const affectedSlots = timetable.filter(slot => slot.teacherId === teacherId);

    if (affectedSlots.length === 0) {
        showStatusBanner("absenceMessage", `No active scheduled classes found for ${teacher.name}.`, "warning");
        updateAll();
        return;
    }

    const timingSchedule = getTimingSchedule();
    let rescheduledCount = 0;
    let emailDispatches = [];

    affectedSlots.forEach(slot => {
        const replacement = findReplacement(slot, teacherId);

        if (replacement) {
            const oldTeacher = slot.teacher;
            const oldRoom = slot.room;
            const oldPeriod = slot.period;

            slot.teacher = replacement.teacher.name;
            slot.teacherId = replacement.teacher.id;
            slot.room = replacement.room.name;
            slot.roomId = replacement.room.id;
            slot.day = replacement.day;
            slot.period = replacement.period;
            slot.changed = true;

            const timeSlotObj = getTeachingPeriodTiming(replacement.period);

            changes.push({
                className: slot.className,
                subject: slot.subject,
                oldTeacher: oldTeacher,
                newTeacher: replacement.teacher.name,
                oldPeriod: oldPeriod + 1,
                newPeriod: replacement.period + 1,
                timing: timeSlotObj.rangeStr,
                oldRoom: oldRoom,
                newRoom: replacement.room.name,
                date: dateStr
            });

            rescheduledCount++;

            emailDispatches.push({
                toName: replacement.teacher.name,
                toEmail: replacement.teacher.email,
                subject: `[ChronosAI Notice] Class Substitution Assignment - ${dateStr}`,
                body: `Dear Prof. ${replacement.teacher.name},

Please be informed that you have been assigned as a substitute instructor due to the leave of Prof. ${oldTeacher}.

Assignment Details:
------------------------------------------
Date:             ${dateStr} (${DAY_NAMES[replacement.day]})
Class/Cohort:     ${slot.className}
Course/Subject:   ${slot.subject} (${slot.type.toUpperCase()})
Scheduled Time:   Period ${replacement.period + 1} [ ${timeSlotObj.rangeStr} ]
Assigned Room:    ${replacement.room.name}

Kindly report to the assigned facility on time.

Generated automatically by ChronosAI NEP 2020 Timetable System.`
            });
        }
    });

    renderTimetable();
    renderAnalytics();
    displayGeneratedEmails(emailDispatches);
    updateAll();
    saveToLocalStorage();

    showStatusBanner(
        "absenceMessage",
        `✓ Marked ${teacher.name} absent. ${rescheduledCount} of ${affectedSlots.length} affected slots successfully rescheduled with peer substitutions.`,
        rescheduledCount === affectedSlots.length ? "success" : "warning"
    );

    showToast(`Rescheduled ${rescheduledCount} class slots for absent faculty`, "success");
}

function findReplacement(slot, absentTeacherId) {
    const days = parseInt(document.getElementById("workingDays").value, 10) || 6;
    const periods = parseInt(document.getElementById("periodsPerDay").value, 10) || 6;

    for (const teacher of teachers) {
        if (teacher.id === absentTeacherId || teacher.absent) continue;

        const daysToTry = [slot.day, ...Array.from({ length: days }, (_, i) => i).filter(d => d !== slot.day)];

        for (const day of daysToTry) {
            for (let period = 0; period < periods; period++) {

                const isTeacherBusy = timetable.some(t =>
                    t.teacherId === teacher.id &&
                    t.day === day &&
                    t.period === period &&
                    t.id !== slot.id
                );
                if (isTeacherBusy) continue;

                const isClassBusy = timetable.some(t =>
                    t.classId === slot.classId &&
                    t.day === day &&
                    t.period === period &&
                    t.id !== slot.id
                );
                if (isClassBusy) continue;

                for (const room of rooms) {
                    if (slot.type === "lab" && room.type !== "lab") continue;
                    if (slot.type === "theory" && room.type === "lab") continue;

                    const isRoomBusy = timetable.some(t =>
                        t.roomId === room.id &&
                        t.day === day &&
                        t.period === period &&
                        t.id !== slot.id
                    );
                    if (isRoomBusy) continue;

                    return {
                        teacher: teacher,
                        room: room,
                        day: day,
                        period: period
                    };
                }
            }
        }
    }

    return null;
}

function displayGeneratedEmails(emails) {
    const card = document.getElementById("emailCard");
    const list = document.getElementById("emailList");

    // Always sync to admin cache (accumulate new emails)
    if (emails.length > 0) {
        adminEmailCache = [...adminEmailCache, ...emails];
        renderAdminEmails();
    }

    if (!card || !list) return;

    if (emails.length === 0) {
        card.style.display = "none";
        return;
    }

    card.style.display = "block";
    list.innerHTML = emails.map(email => `
        <div class="email-card-item">
            <div class="email-header-info">
                <div>
                    <strong>To:</strong> ${escapeHtml(email.toName)} &lt;${escapeHtml(email.toEmail)}&gt;
                    <div class="text-muted small-text">Subject: ${escapeHtml(email.subject)}</div>
                </div>
                <span class="admin-dispatch-badge">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Email Prepared Automatically
                </span>
            </div>
            <pre class="email-body-text">${escapeHtml(email.body)}</pre>
        </div>
    `).join("");
}

function copyAllEmails() {
    // Build text from adminEmailCache (source of truth)
    const textParts = adminEmailCache.map(e =>
        `To: ${e.toName} <${e.toEmail}>\nSubject: ${e.subject}\n\n${e.body}`
    ).join("\n\n" + "-".repeat(50) + "\n\n");

    const textToCopy = textParts || (document.getElementById("emailList")?.innerText || "");
    if (!textToCopy.trim()) {
        showToast("No email notices to copy", "warning");
        return;
    }

    navigator.clipboard.writeText(textToCopy).then(() => {
        showToast("Copied all email notices to clipboard", "success");
    }).catch(() => {
        showToast("Unable to copy to clipboard", "warning");
    });
}

/* ==========================================================================
   Multi-View Timetable Renderer with Bell Timings
   ========================================================================== */

function renderTimetable() {
    const days = parseInt(document.getElementById("workingDays")?.value, 10) || 6;
    const viewMode = document.getElementById("viewMode") ? document.getElementById("viewMode").value : "class";
    const filterVal = document.getElementById("filterTarget") ? document.getElementById("filterTarget").value : "all";

    const thead = document.getElementById("tableHeader");
    const tbody = document.getElementById("tableBody");

    if (!thead || !tbody) return;

    const timeline = getTimingSchedule();

    if (timetable.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="${days + 2}" class="text-center py-5 text-muted">
                    <p>No timetable generated yet. Click <strong>"Generate AI Schedule"</strong> or <strong>"Load Demo Data"</strong> to begin.</p>
                </td>
            </tr>
        `;
        return;
    }

    // Build Header
    let headerHtml = `<th>Entity / Context</th><th>Period & Time</th>`;
    for (let d = 0; d < days; d++) {
        headerHtml += `<th>${DAY_NAMES[d]}</th>`;
    }
    thead.innerHTML = headerHtml;

    // Filter Entities according to View Mode
    let entitiesToRender = [];

    if (viewMode === "class") {
        entitiesToRender = filterVal === "all" ? classes : classes.filter(c => c.id === parseInt(filterVal, 10));
    } else if (viewMode === "teacher") {
        entitiesToRender = filterVal === "all" ? teachers : teachers.filter(t => t.id === parseInt(filterVal, 10));
    } else if (viewMode === "room") {
        entitiesToRender = filterVal === "all" ? rooms : rooms.filter(r => r.id === parseInt(filterVal, 10));
    } else {
        entitiesToRender = classes;
    }

    let bodyHtml = "";

    entitiesToRender.forEach(entity => {
        timeline.forEach((slotInfo, timelineIndex) => {
            let row = `<tr>`;
            
            // First cell: entity name spanning full timeline rows
            if (timelineIndex === 0) {
                row += `<td rowspan="${timeline.length}" class="period-col" style="font-size:0.95rem; font-weight:800; background:var(--surface-subtle);">
                    ${escapeHtml(entity.name)}
                </td>`;
            }

            // Period & Timing cell
            row += `<td class="period-col ${slotInfo.isLunch ? 'lunch-period-col' : ''}">
                <div class="period-title">${escapeHtml(slotInfo.label)}</div>
                <div class="period-time-badge">${escapeHtml(slotInfo.rangeStr)}</div>
            </td>`;

            for (let day = 0; day < days; day++) {
                if (slotInfo.isLunch) {
                    row += `<td class="cell-lunch">
                        <div class="lunch-badge-title">🍱 Lunch Recess</div>
                        <div class="lunch-badge-time">${escapeHtml(slotInfo.rangeStr)}</div>
                    </td>`;
                    continue;
                }

                const period = slotInfo.periodIndex;

                // Find slot according to view mode
                let slot = null;
                if (viewMode === "class" || viewMode === "master") {
                    slot = timetable.find(t => t.classId === entity.id && t.day === day && t.period === period);
                } else if (viewMode === "teacher") {
                    slot = timetable.find(t => t.teacherId === entity.id && t.day === day && t.period === period);
                } else if (viewMode === "room") {
                    slot = timetable.find(t => t.roomId === entity.id && t.day === day && t.period === period);
                }

                if (slot) {
                    const badgeClass = slot.changed ? "rescheduled" : (slot.type === "lab" ? "lab" : "theory");
                    const subtitle = viewMode === "teacher" ? `🏫 ${slot.className} &bull; 🚪 ${slot.room}` :
                                     viewMode === "room" ? `🎓 ${slot.className} &bull; 👨‍🏫 ${slot.teacher}` :
                                     `👨‍🏫 ${slot.teacher} &bull; 🚪 ${slot.room}`;

                    row += `
                        <td>
                            <div class="slot-badge ${badgeClass}" onclick="openSlotModal(${slot.id})" title="Click to view full slot details">
                                <div class="slot-time-pill">🕒 ${escapeHtml(slotInfo.rangeStr)}</div>
                                <div class="slot-title">${escapeHtml(slot.subject)}</div>
                                <div class="slot-detail">${escapeHtml(subtitle)}</div>
                                ${slot.changed ? `<div class="slot-rescheduled-tag">🔄 Substitute</div>` : ''}
                            </div>
                        </td>
                    `;
                } else {
                    row += `<td class="cell-free">Free</td>`;
                }
            }

            row += `</tr>`;
            bodyHtml += row;
        });
    });

    tbody.innerHTML = bodyHtml;
}

/* ==========================================================================
   Analytics & Workload Charts
   ========================================================================== */

function renderAnalytics() {
    const facultyList = document.getElementById("facultyWorkloadList");
    const roomList = document.getElementById("roomUtilizationList");
    const days = parseInt(document.getElementById("workingDays").value, 10) || 6;
    const periods = parseInt(document.getElementById("periodsPerDay").value, 10) || 6;

    const totalAvailableSlotsPerWeek = days * periods;

    if (facultyList) {
        if (teachers.length === 0 || timetable.length === 0) {
            facultyList.innerHTML = `<p class="text-muted text-center py-4">Generate schedule to view faculty analytics.</p>`;
        } else {
            facultyList.innerHTML = teachers.map(t => {
                const taughtPeriods = timetable.filter(slot => slot.teacherId === t.id).length;
                const standardMax = 20;
                const pct = Math.min(100, Math.round((taughtPeriods / standardMax) * 100));
                
                return `
                    <div class="analytics-bar-item">
                        <div class="bar-meta">
                            <span><strong>${escapeHtml(t.name)}</strong> (${t.absent ? 'On Leave' : 'Active'})</span>
                            <span>${taughtPeriods} / ${standardMax} hrs/wk (${pct}%)</span>
                        </div>
                        <div class="progress-track">
                            <div class="progress-fill" style="width: ${pct}%; background: ${pct > 90 ? 'var(--danger)' : 'linear-gradient(90deg, var(--primary), #8b5cf6)'};"></div>
                        </div>
                    </div>
                `;
            }).join("");
        }
    }

    if (roomList) {
        if (rooms.length === 0 || timetable.length === 0) {
            roomList.innerHTML = `<p class="text-muted text-center py-4">Generate schedule to view room analytics.</p>`;
        } else {
            roomList.innerHTML = rooms.map(r => {
                const occupiedSlots = timetable.filter(slot => slot.roomId === r.id).length;
                const pct = Math.min(100, Math.round((occupiedSlots / totalAvailableSlotsPerWeek) * 100));

                return `
                    <div class="analytics-bar-item">
                        <div class="bar-meta">
                            <span><strong>${escapeHtml(r.name)}</strong> (${r.type === 'lab' ? 'Laboratory' : 'Lecture Hall'})</span>
                            <span>${occupiedSlots} slots used (${pct}% occupancy)</span>
                        </div>
                        <div class="progress-track">
                            <div class="progress-fill" style="width: ${pct}%; background: ${pct > 80 ? '#10b981' : 'linear-gradient(90deg, #3b82f6, #10b981)'};"></div>
                        </div>
                    </div>
                `;
            }).join("");
        }
    }
}

/* ==========================================================================
   Slot Inspector Modal
   ========================================================================== */

function openSlotModal(slotId) {
    const slot = timetable.find(s => s.id === slotId);
    if (!slot) return;

    const modal = document.getElementById("slotModal");
    const content = document.getElementById("modalContent");
    if (!modal || !content) return;

    const timeSlot = getTeachingPeriodTiming(slot.period);

    content.innerHTML = `
        <div class="modal-detail-row">
            <span class="modal-detail-label">Subject / Course</span>
            <span class="modal-detail-val">${escapeHtml(slot.subject)}</span>
        </div>
        <div class="modal-detail-row">
            <span class="modal-detail-label">Course Category</span>
            <span class="modal-detail-val" style="text-transform: capitalize;">${slot.type === 'lab' ? '🔬 Practical / Laboratory' : '📖 Theory Lecture'}</span>
        </div>
        <div class="modal-detail-row">
            <span class="modal-detail-label">Class Cohort</span>
            <span class="modal-detail-val">${escapeHtml(slot.className)}</span>
        </div>
        <div class="modal-detail-row">
            <span class="modal-detail-label">Assigned Professor</span>
            <span class="modal-detail-val">👨‍🏫 ${escapeHtml(slot.teacher)}</span>
        </div>
        <div class="modal-detail-row">
            <span class="modal-detail-label">Allocated Facility</span>
            <span class="modal-detail-val">🚪 ${escapeHtml(slot.room)} (${slot.roomType})</span>
        </div>
        <div class="modal-detail-row">
            <span class="modal-detail-label">Scheduled Period</span>
            <span class="modal-detail-val">${DAY_NAMES[slot.day]}, Period ${slot.period + 1}</span>
        </div>
        <div class="modal-detail-row">
            <span class="modal-detail-label">⏰ Bell Timings</span>
            <span class="modal-detail-val" style="font-family:'JetBrains Mono',monospace; color:var(--primary);">${escapeHtml(timeSlot.rangeStr)}</span>
        </div>
        <div class="modal-detail-row">
            <span class="modal-detail-label">Scheduling Status</span>
            <span class="modal-detail-val">${slot.changed ? '🔄 Rescheduled via Peer Substitution' : '✓ Normal Active Allocation'}</span>
        </div>
    `;

    modal.style.display = "flex";
}

function closeModal() {
    const modal = document.getElementById("slotModal");
    if (modal) modal.style.display = "none";
}

window.addEventListener("click", (e) => {
    const modal = document.getElementById("slotModal");
    if (e.target === modal) {
        closeModal();
    }
});

/* ==========================================================================
   Export & Backup Utilities
   ========================================================================== */

function exportCSV() {
    if (timetable.length === 0) {
        showToast("Please generate a timetable before exporting", "warning");
        return;
    }

    let csvContent = "Class,Day,Period,Timing,Subject,Teacher,Room,Type,Status\n";

    timetable.forEach(slot => {
        const timeSlot = getTeachingPeriodTiming(slot.period);
        const row = [
            `"${slot.className.replace(/"/g, '""')}"`,
            `"${DAY_NAMES[slot.day]}"`,
            `"Period ${slot.period + 1}"`,
            `"${timeSlot.rangeStr}"`,
            `"${slot.subject.replace(/"/g, '""')}"`,
            `"${slot.teacher.replace(/"/g, '""')}"`,
            `"${slot.room.replace(/"/g, '""')}"`,
            `"${slot.type}"`,
            `"${slot.changed ? "Rescheduled" : "Standard"}"`
        ];
        csvContent += row.join(",") + "\n";
    });

    downloadBlob(csvContent, "ChronosAI_Academic_Timetable.csv", "text/csv;charset=utf-8;");
    showToast("Downloaded timetable CSV with timings", "success");
}

function exportJSON() {
    const exportData = {
        app: "ChronosAI",
        version: "2.0",
        date: new Date().toISOString(),
        config: {
            collegeStartTime: document.getElementById("collegeStartTime")?.value || "09:00",
            periodDuration: document.getElementById("periodDuration")?.value || "50",
            lunchDuration: document.getElementById("lunchDuration")?.value || "50",
            workingDays: document.getElementById("workingDays")?.value || "6",
            periodsPerDay: document.getElementById("periodsPerDay")?.value || "6",
            lunchPeriod: document.getElementById("lunchPeriodSelect")?.value || "3"
        },
        classes,
        teachers,
        rooms,
        subjects,
        timetable,
        changes
    };

    downloadBlob(JSON.stringify(exportData, null, 2), "ChronosAI_Backup.json", "application/json");
    showToast("Exported configuration JSON", "success");
}

function printTimetable() {
    if (timetable.length === 0) {
        showToast("Generating schedule for print...", "info");
        generateTimetable();
    }
    renderTimetable();
    
    // Give browser a moment to paint the table before opening print dialog
    setTimeout(() => {
        window.print();
    }, 150);
}

function downloadBlob(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/* ==========================================================================
   Local Storage Persistence
   ========================================================================== */

function saveToLocalStorage() {
    try {
        const payload = {
            classes,
            teachers,
            rooms,
            subjects,
            timetable,
            changes,
            collegeStartTime: document.getElementById("collegeStartTime")?.value || "09:00",
            periodDuration: document.getElementById("periodDuration")?.value || "50",
            lunchDuration: document.getElementById("lunchDuration")?.value || "50",
            workingDays: document.getElementById("workingDays")?.value || "6",
            periodsPerDay: document.getElementById("periodsPerDay")?.value || "6",
            lunchPeriod: document.getElementById("lunchPeriodSelect")?.value || "3"
        };
        localStorage.setItem("chronos_timetable_data", JSON.stringify(payload));
    } catch (e) {
        console.warn("Could not save to localStorage", e);
    }
}

function loadFromLocalStorage() {
    try {
        const raw = localStorage.getItem("chronos_timetable_data");
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (data && data.classes && data.teachers) {
            classes = data.classes || [];
            teachers = data.teachers || [];
            rooms = data.rooms || [];
            subjects = data.subjects || [];
            timetable = data.timetable || [];
            changes = data.changes || [];

            if (data.collegeStartTime && document.getElementById("collegeStartTime")) {
                document.getElementById("collegeStartTime").value = data.collegeStartTime;
            }
            if (data.periodDuration && document.getElementById("periodDuration")) {
                document.getElementById("periodDuration").value = data.periodDuration;
            }
            if (data.lunchDuration && document.getElementById("lunchDuration")) {
                document.getElementById("lunchDuration").value = data.lunchDuration;
            }
            if (data.workingDays && document.getElementById("workingDays")) {
                document.getElementById("workingDays").value = data.workingDays;
            }
            if (data.periodsPerDay && document.getElementById("periodsPerDay")) {
                document.getElementById("periodsPerDay").value = data.periodsPerDay;
            }
            if (data.lunchPeriod && document.getElementById("lunchPeriodSelect")) {
                document.getElementById("lunchPeriodSelect").value = data.lunchPeriod;
            }

            const days = parseInt(data.workingDays || 6, 10);
            const periods = parseInt(data.periodsPerDay || 6, 10);
            const expectedTotalSlots = (classes.length) * days * periods;

            // Auto-upgrade legacy cache with partial subjects or empty slots to full autonomous college load
            if (subjects.length < 30 || timetable.length < expectedTotalSlots) {
                loadDemoData(false);
            }

            return true;
        }
    } catch (e) {
        console.warn("Error parsing localStorage data", e);
    }
    return false;
}

/* ==========================================================================
   Realistic Autonomous Engineering College Dataset (Full Weekly Load)
   ========================================================================== */

function loadDemoData(showNotification = true) {
    classes = [
        { id: 101, name: "B.Tech CSE - 4th Sem (Sec A)" },
        { id: 102, name: "B.Tech AI & Data Science - 2nd Sem" },
        { id: 103, name: "B.Tech ECE - 4th Sem" }
    ];

    teachers = [
        { id: 201, name: "Dr. Ravi Sharma", email: "ravi.sharma@univ.edu", absent: false },
        { id: 202, name: "Prof. Priya Nair", email: "priya.nair@univ.edu", absent: false },
        { id: 203, name: "Dr. Amit Verma", email: "amit.verma@univ.edu", absent: false },
        { id: 204, name: "Dr. Sneha Roy", email: "sneha.roy@univ.edu", absent: false },
        { id: 205, name: "Prof. K. Venkatesh", email: "k.venkatesh@univ.edu", absent: false },
        { id: 206, name: "Dr. Ananya Mukherjee", email: "ananya.m@univ.edu", absent: false },
        { id: 207, name: "Dr. Rajesh Khanna", email: "rajesh.khanna@univ.edu", absent: false },
        { id: 208, name: "Prof. Meera Swaminathan", email: "meera.s@univ.edu", absent: false },
        { id: 209, name: "Dr. Vikram Aditya", email: "vikram.aditya@univ.edu", absent: false },
        { id: 210, name: "Prof. Sunita Rao", email: "sunita.rao@univ.edu", absent: false }
    ];

    rooms = [
        { id: 301, name: "LH-101 (Smart Lecture Hall - CSE)", type: "classroom" },
        { id: 302, name: "LH-102 (Auditorium Hall - AI & DS)", type: "classroom" },
        { id: 303, name: "LH-103 (Standard Classroom - ECE)", type: "classroom" },
        { id: 304, name: "LH-104 (Lecture Hall 4)", type: "classroom" },
        { id: 305, name: "Lab-A (Advanced AI & Systems Lab)", type: "lab" },
        { id: 306, name: "Lab-B (Microprocessors & IoT Lab)", type: "lab" },
        { id: 307, name: "Lab-C (Data Science & Networks Lab)", type: "lab" },
        { id: 308, name: "Seminar Hall & Activity Arena", type: "classroom" }
    ];

    subjects = [
        // ==========================================
        // B.Tech CSE - 4th Sem (Autonomous - 36 periods/week)
        // ==========================================
        { id: 401, classId: 101, teacherId: 201, teacher: "Dr. Ravi Sharma", name: "Operating Systems & Kernels", periods: 4, type: "theory" },
        { id: 402, classId: 101, teacherId: 202, teacher: "Prof. Priya Nair", name: "Database Management Systems", periods: 4, type: "theory" },
        { id: 403, classId: 101, teacherId: 203, teacher: "Dr. Amit Verma", name: "Design & Analysis of Algorithms", periods: 4, type: "theory" },
        { id: 404, classId: 101, teacherId: 207, teacher: "Dr. Rajesh Khanna", name: "Computer Networks & Protocols", periods: 4, type: "theory" },
        { id: 405, classId: 101, teacherId: 208, teacher: "Prof. Meera Swaminathan", name: "Software Engineering & Agile", periods: 4, type: "theory" },
        { id: 406, classId: 101, teacherId: 206, teacher: "Dr. Ananya Mukherjee", name: "Discrete Mathematical Structures", periods: 4, type: "theory" },
        { id: 407, classId: 101, teacherId: 201, teacher: "Dr. Ravi Sharma", name: "OS & Linux Internals Practical Lab", periods: 3, type: "lab" },
        { id: 408, classId: 101, teacherId: 202, teacher: "Prof. Priya Nair", name: "DBMS SQL Practical Lab", periods: 3, type: "lab" },
        { id: 409, classId: 101, teacherId: 203, teacher: "Dr. Amit Verma", name: "Algorithms & Competitive Coding Lab", periods: 2, type: "lab" },
        { id: 410, classId: 101, teacherId: 208, teacher: "Prof. Meera Swaminathan", name: "Technical Seminar & Soft Skills", periods: 2, type: "theory" },
        { id: 411, classId: 101, teacherId: 207, teacher: "Dr. Rajesh Khanna", name: "Library & Research Reading", periods: 1, type: "theory" },
        { id: 412, classId: 101, teacherId: 201, teacher: "Dr. Ravi Sharma", name: "Sports & Co-Curricular Activity", periods: 1, type: "theory" },

        // ==========================================
        // B.Tech AI & Data Science - 2nd Sem (Autonomous - 36 periods/week)
        // ==========================================
        { id: 413, classId: 102, teacherId: 204, teacher: "Dr. Sneha Roy", name: "Foundations of Machine Learning", periods: 4, type: "theory" },
        { id: 414, classId: 102, teacherId: 205, teacher: "Prof. K. Venkatesh", name: "Probability & Linear Algebra", periods: 4, type: "theory" },
        { id: 415, classId: 102, teacherId: 206, teacher: "Dr. Ananya Mukherjee", name: "Python for Data Science & Analytics", periods: 4, type: "theory" },
        { id: 416, classId: 102, teacherId: 203, teacher: "Dr. Amit Verma", name: "Data Structures & Applications", periods: 4, type: "theory" },
        { id: 417, classId: 102, teacherId: 209, teacher: "Dr. Vikram Aditya", name: "Digital Logic & Computer Org.", periods: 4, type: "theory" },
        { id: 418, classId: 102, teacherId: 210, teacher: "Prof. Sunita Rao", name: "Environmental Science & Elective", periods: 4, type: "theory" },
        { id: 419, classId: 102, teacherId: 204, teacher: "Dr. Sneha Roy", name: "Machine Learning & Python Lab", periods: 3, type: "lab" },
        { id: 420, classId: 102, teacherId: 203, teacher: "Dr. Amit Verma", name: "Data Structures Practical Lab", periods: 3, type: "lab" },
        { id: 421, classId: 102, teacherId: 206, teacher: "Dr. Ananya Mukherjee", name: "AI Mini-Project Laboratory", periods: 2, type: "lab" },
        { id: 422, classId: 102, teacherId: 210, teacher: "Prof. Sunita Rao", name: "Technical Communication & Writing", periods: 2, type: "theory" },
        { id: 423, classId: 102, teacherId: 204, teacher: "Dr. Sneha Roy", name: "Library & Mentoring Hour", periods: 1, type: "theory" },
        { id: 424, classId: 102, teacherId: 205, teacher: "Prof. K. Venkatesh", name: "Sports & Yoga Activity", periods: 1, type: "theory" },

        // ==========================================
        // B.Tech ECE - 4th Sem (Autonomous - 36 periods/week)
        // ==========================================
        { id: 425, classId: 103, teacherId: 205, teacher: "Prof. K. Venkatesh", name: "Signals & Digital Processing", periods: 4, type: "theory" },
        { id: 426, classId: 103, teacherId: 209, teacher: "Dr. Vikram Aditya", name: "Microcontrollers & Embedded Systems", periods: 4, type: "theory" },
        { id: 427, classId: 103, teacherId: 210, teacher: "Prof. Sunita Rao", name: "Electromagnetic Waves & Transmission", periods: 4, type: "theory" },
        { id: 428, classId: 103, teacherId: 208, teacher: "Prof. Meera Swaminathan", name: "Analog Circuits & Linear ICs", periods: 4, type: "theory" },
        { id: 429, classId: 103, teacherId: 207, teacher: "Dr. Rajesh Khanna", name: "Control Systems Engineering", periods: 4, type: "theory" },
        { id: 430, classId: 103, teacherId: 201, teacher: "Dr. Ravi Sharma", name: "Analog & Digital Communication", periods: 4, type: "theory" },
        { id: 431, classId: 103, teacherId: 205, teacher: "Prof. K. Venkatesh", name: "DSP & MATLAB Simulation Lab", periods: 3, type: "lab" },
        { id: 432, classId: 103, teacherId: 209, teacher: "Dr. Vikram Aditya", name: "Microcontrollers & IoT Hardware Lab", periods: 3, type: "lab" },
        { id: 433, classId: 103, teacherId: 210, teacher: "Prof. Sunita Rao", name: "Analog Circuits Practical Lab", periods: 2, type: "lab" },
        { id: 434, classId: 103, teacherId: 209, teacher: "Dr. Vikram Aditya", name: "Mini-Project & Hardware Seminar", periods: 2, type: "theory" },
        { id: 435, classId: 103, teacherId: 207, teacher: "Dr. Rajesh Khanna", name: "Library & Career Guidance", periods: 1, type: "theory" },
        { id: 436, classId: 103, teacherId: 205, teacher: "Prof. K. Venkatesh", name: "Physical Education & Sports", periods: 1, type: "theory" }
    ];

    timetable = [];
    changes = [];

    updateAll();
    generateTimetable();
    saveToLocalStorage();

    if (showNotification) {
        showToast("Loaded full Autonomous College curriculum & generated schedule!", "success");
    }
}

/* ==========================================================================
   UI Helpers: Toasts, Status Banners, Escaping
   ========================================================================== */

function showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast";
    
    let icon = "ℹ️";
    if (type === "success") icon = "✅";
    if (type === "warning") icon = "⚠️";
    if (type === "danger") icon = "🚨";

    toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
        toast.style.transition = "all 0.3s ease";
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function showStatusBanner(elementId, text, type = "info") {
    const banner = document.getElementById(elementId);
    if (!banner) return;
    banner.innerText = text;
    banner.className = `status-banner ${type}`;
    banner.style.display = "block";
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* ==========================================================================
   Admin Dashboard Logic
   ========================================================================== */

// Global list of drafted email dispatches for admin panel
let adminEmailCache = [];

function renderAdminDashboard() {
    // Update KPI cards
    const el = (id, val) => { const e = document.getElementById(id); if (e) e.innerText = val; };
    const activeFaculty = teachers.filter(t => !t.absent).length;
    const absentFaculty = teachers.filter(t => t.absent).length;
    const rescheduledCount = timetable.filter(t => t.changed).length;

    el("adminClassCount", classes.length);
    el("adminActiveFaculty", activeFaculty);
    el("adminAbsentFaculty", absentFaculty);
    el("adminTotalSlots", timetable.length);
    el("adminRescheduled", rescheduledCount);
    el("adminRoomCount", rooms.length);

    // Faculty Status Table
    const tbody = document.getElementById("adminFacultyTableBody");
    if (tbody) {
        if (teachers.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No faculty registered yet.</td></tr>`;
        } else {
            const timingSchedule = typeof getTimingSchedule === 'function' ? getTimingSchedule() : [];
            tbody.innerHTML = teachers.map((t, i) => {
                const periodsAssigned = timetable.filter(slot => slot.teacherId === t.id).length;
                const initials = t.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
                const statusBadge = t.absent
                    ? `<span class="status-badge status-absent">On Leave</span>`
                    : `<span class="status-badge status-present">Active</span>`;
                return `
                    <tr>
                        <td><strong>${i + 1}</strong></td>
                        <td>
                            <div class="admin-faculty-cell">
                                <span class="admin-faculty-avatar">${escapeHtml(initials)}</span>
                                <span style="font-weight:600;">${escapeHtml(t.name)}</span>
                            </div>
                        </td>
                        <td style="color:var(--text-muted); font-size:0.82rem;">${escapeHtml(t.email)}</td>
                        <td>
                            <strong>${periodsAssigned}</strong>
                            <span style="color:var(--text-muted); font-size:0.78rem;"> / 20 hrs</span>
                        </td>
                        <td>${statusBadge}</td>
                        <td>
                            <button class="btn-toggle-status" onclick="toggleTeacherStatus(${t.id}); renderAdminDashboard();">
                                ${t.absent ? 'Mark Active' : 'Mark Absent'}
                            </button>
                        </td>
                    </tr>
                `;
            }).join("");
        }
    }

    // Rescheduling Activity Log
    const logBody = document.getElementById("adminRescheduleLog");
    if (logBody) {
        if (changes.length === 0) {
            logBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No rescheduling activity yet.</td></tr>`;
        } else {
            logBody.innerHTML = [...changes].reverse().map((c, i) => `
                <tr>
                    <td><strong>${escapeHtml(c.className)}</strong></td>
                    <td>${escapeHtml(c.subject)}</td>
                    <td style="color:var(--danger-text);">${escapeHtml(c.oldTeacher)}</td>
                    <td style="color:var(--success-text); font-weight:600;">${escapeHtml(c.newTeacher)}</td>
                    <td>
                        <span style="color:var(--text-muted); text-decoration:line-through;">P${c.oldPeriod}</span>
                        → <strong>P${c.newPeriod}</strong>
                        ${c.timing ? `<div style="font-size:0.73rem; color:var(--primary); font-family:monospace;">${escapeHtml(c.timing)}</div>` : ''}
                    </td>
                    <td><span class="log-badge-rescheduled">🔄 Substituted</span></td>
                </tr>
            `).join("");
        }
    }

    // Sync email dispatch panel in admin tab
    renderAdminEmails();
}

function renderAdminEmails() {
    const adminList = document.getElementById("adminEmailList");
    if (!adminList) return;

    if (adminEmailCache.length === 0) {
        adminList.innerHTML = `<p class="text-muted text-center py-4">No notifications generated yet. Mark a faculty member absent to trigger auto-rescheduling.</p>`;
        return;
    }

    adminList.innerHTML = adminEmailCache.map((email, idx) => {
        const st = email.sendStatus || "pending";
        const statusHtml = {
            pending: `<span class="email-status-badge pending">⏳ Not Sent</span>`,
            sending: `<span class="email-status-badge sending">📤 Sending…</span>`,
            sent:    `<span class="email-status-badge sent">✓ Sent Successfully</span>`,
            failed:  `<span class="email-status-badge failed">✗ Failed — Retry</span>`
        }[st] || "";

        const isConnected = !!ejsConfig.publicKey;
        const btnDisabled = (!isConnected || st === "sending" || st === "sent") ? "disabled" : "";
        const btnLabel = st === "sent" ? "✓ Sent" : st === "sending" ? "Sending…" : "Send Email";

        return `
        <div class="email-card-item" id="emailCard_${idx}">
            <div class="email-header-info">
                <div>
                    <strong>To:</strong> ${escapeHtml(email.toName)} &lt;${escapeHtml(email.toEmail)}&gt;
                    <div class="text-muted small-text">Subject: ${escapeHtml(email.subject)}</div>
                </div>
                <span class="admin-dispatch-badge">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Email Prepared Automatically
                </span>
            </div>
            <pre class="email-body-text">${escapeHtml(email.body)}</pre>
            <div class="email-send-row">
                ${statusHtml}
                <button class="email-send-btn" onclick="sendSingleEmail(${idx})" ${btnDisabled}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    ${btnLabel}
                </button>
            </div>
        </div>`;
    }).join("");
}

function clearAllData() {
    if (!confirm("⚠️ This will permanently reset ALL data (classes, faculty, rooms, subjects, timetable). This action cannot be undone.\n\nProceed with full reset?")) return;

    classes = [];
    teachers = [];
    rooms = [];
    subjects = [];
    timetable = [];
    changes = [];
    absenceLog = [];
    adminEmailCache = [];

    localStorage.removeItem("chronos_timetable_data");

    updateAll();
    renderTimetable();
    renderAnalytics();
    renderAdminDashboard();

    const emailCard = document.getElementById("emailCard");
    if (emailCard) emailCard.style.display = "none";

    showToast("All data has been reset successfully.", "info");
}

/* ==========================================================================
   EmailJS — Direct Email Sending (no backend required)
   ========================================================================== */

// EmailJS config state (persisted in localStorage)
let ejsConfig = { serviceId: "", templateId: "", publicKey: "" };

function loadEmailjsConfig() {
    try {
        const raw = localStorage.getItem("chronos_ejs_config");
        if (raw) {
            ejsConfig = JSON.parse(raw);
            // Pre-fill form fields
            const si = document.getElementById("ejsServiceId");
            const ti = document.getElementById("ejsTemplateId");
            const pk = document.getElementById("ejsPublicKey");
            if (si) si.value = ejsConfig.serviceId || "";
            if (ti) ti.value = ejsConfig.templateId || "";
            if (pk) pk.value = ejsConfig.publicKey || "";
            // Initialize EmailJS SDK
            if (ejsConfig.publicKey) {
                if (typeof emailjs !== "undefined") {
                    emailjs.init({ publicKey: ejsConfig.publicKey });
                }
                updateEmailjsUIState(true);
            }
        }
    } catch (e) { console.warn("Could not load EmailJS config", e); }
}

function saveEmailjsConfig() {
    const serviceId = document.getElementById("ejsServiceId")?.value.trim();
    const templateId = document.getElementById("ejsTemplateId")?.value.trim();
    const publicKey = document.getElementById("ejsPublicKey")?.value.trim();

    if (!serviceId || !templateId || !publicKey) {
        showToast("Please fill in all three EmailJS fields", "warning");
        return;
    }

    ejsConfig = { serviceId, templateId, publicKey };
    localStorage.setItem("chronos_ejs_config", JSON.stringify(ejsConfig));

    // Initialize EmailJS SDK
    if (typeof emailjs !== "undefined") {
        emailjs.init({ publicKey });
        updateEmailjsUIState(true);
        showConnectionStatus("✓ Saved & Connected! EmailJS is ready to send emails.", "connected");
        showToast("EmailJS configured successfully!", "success");
    } else {
        showConnectionStatus("⚠️ EmailJS SDK not loaded. Check your internet connection.", "error");
        showToast("EmailJS SDK not loaded", "warning");
    }

    // Refresh admin email list so Send buttons appear
    renderAdminEmails();
}

function toggleEmailConfig() {
    const body = document.getElementById("emailjsConfigBody");
    const label = document.getElementById("emailConfigToggleLabel");
    if (!body) return;
    const isHidden = body.style.display === "none";
    body.style.display = isHidden ? "block" : "none";
    if (label) label.textContent = isHidden ? "Hide Setup" : "Show Setup";
}

function updateEmailjsUIState(connected) {
    const badge = document.getElementById("ejsConnectedBadge");
    const sendAllBtn = document.getElementById("btnSendAll");
    if (badge) badge.style.display = connected ? "inline-flex" : "none";
    if (sendAllBtn) sendAllBtn.style.display = connected ? "inline-flex" : "none";
}

function showConnectionStatus(message, type) {
    const el = document.getElementById("ejsConnectionStatus");
    if (!el) return;
    el.style.display = "inline-flex";
    el.className = `emailjs-status-pill ${type}`;
    el.textContent = message;
}

async function testEmailjsConnection() {
    if (!ejsConfig.publicKey) {
        showToast("Please save your EmailJS configuration first", "warning");
        return;
    }

    const adminEmail = teachers.length > 0 ? teachers[0].email : "";
    if (!adminEmail) {
        showToast("Add at least one faculty member first (their email is used for the test)", "warning");
        return;
    }

    showConnectionStatus("📤 Sending test email…", "testing");
    showToast("Sending test email…", "info");

    try {
        await emailjs.send(ejsConfig.serviceId, ejsConfig.templateId, {
            to_name: teachers[0].name,
            to_email: adminEmail,
            subject: "[ChronosAI] Test Email — Connection Verified",
            message: "This is a test email from ChronosAI to verify your EmailJS configuration is working correctly.\n\nIf you received this, your email dispatch system is set up and ready!"
        });
        showConnectionStatus("✓ Test email sent successfully!", "connected");
        showToast("Test email sent successfully to " + adminEmail, "success");
    } catch (err) {
        console.error("EmailJS test error:", err);
        showConnectionStatus("✗ Failed: " + (err?.text || err?.message || "Unknown error"), "error");
        showToast("Test email failed. Check your EmailJS credentials.", "danger");
    }
}

async function sendSingleEmail(idx) {
    if (!ejsConfig.publicKey) {
        showToast("Connect EmailJS first (Admin Dashboard → Email Service Configuration)", "warning");
        return;
    }

    const email = adminEmailCache[idx];
    if (!email) return;

    // Update status → sending
    adminEmailCache[idx].sendStatus = "sending";
    renderAdminEmails();

    try {
        await emailjs.send(ejsConfig.serviceId, ejsConfig.templateId, {
            to_name: email.toName,
            to_email: email.toEmail,
            subject: email.subject,
            message: email.body
        });
        adminEmailCache[idx].sendStatus = "sent";
        showToast(`✓ Email sent to ${email.toName} (${email.toEmail})`, "success");
    } catch (err) {
        console.error("EmailJS send error:", err);
        adminEmailCache[idx].sendStatus = "failed";
        showToast(`✗ Failed to send to ${email.toEmail}: ${err?.text || err?.message || "Unknown error"}`, "danger");
    }

    renderAdminEmails();
}

async function sendAllEmails() {
    if (!ejsConfig.publicKey) {
        showToast("Connect EmailJS first (Admin Dashboard → Email Service Configuration)", "warning");
        return;
    }

    const pending = adminEmailCache.filter(e => e.sendStatus !== "sent");
    if (pending.length === 0) {
        showToast("All emails have already been sent!", "info");
        return;
    }

    showToast(`Sending ${pending.length} email(s)…`, "info");

    for (let i = 0; i < adminEmailCache.length; i++) {
        const email = adminEmailCache[i];
        if (email.sendStatus === "sent") continue;

        adminEmailCache[i].sendStatus = "sending";
        renderAdminEmails();

        try {
            await emailjs.send(ejsConfig.serviceId, ejsConfig.templateId, {
                to_name: email.toName,
                to_email: email.toEmail,
                subject: email.subject,
                message: email.body
            });
            adminEmailCache[i].sendStatus = "sent";
        } catch (err) {
            console.error("EmailJS batch send error:", err);
            adminEmailCache[i].sendStatus = "failed";
        }

        renderAdminEmails();
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 600));
    }

    const sentCount = adminEmailCache.filter(e => e.sendStatus === "sent").length;
    const failCount = adminEmailCache.filter(e => e.sendStatus === "failed").length;

    if (failCount === 0) {
        showToast(`✓ All ${sentCount} emails sent successfully!`, "success");
    } else {
        showToast(`Sent: ${sentCount} ✓  |  Failed: ${failCount} ✗ — Check the dispatch center.`, "warning");
    }
}

// Initialize EmailJS config on page load
document.addEventListener("DOMContentLoaded", () => {
    loadEmailjsConfig();
});

/* ==========================================================================
   Role-Based Authentication & Session Management
   ========================================================================== */

let currentUser = null;
let currentAuthRole = "admin";

function initAuth() {
    renderQuickLoginButtons("admin");

    const savedSession = localStorage.getItem("chronos_user_session");
    if (savedSession) {
        try {
            const user = JSON.parse(savedSession);
            if (user && user.role) {
                applyLoginSession(user, false);
                return;
            }
        } catch (e) {
            console.warn("Invalid saved auth session", e);
        }
    }

    // Show login screen if no active session
    const authScreen = document.getElementById("authScreen");
    if (authScreen) {
        authScreen.classList.remove("hidden");
    }
}

function selectAuthRole(role) {
    currentAuthRole = role;

    document.querySelectorAll(".auth-role-btn").forEach(btn => btn.classList.remove("active"));
    const activeBtn = document.getElementById(role === 'admin' ? 'roleBtnAdmin' : (role === 'teacher' ? 'roleBtnTeacher' : 'roleBtnStudent'));
    if (activeBtn) activeBtn.classList.add("active");

    const identityLabel = document.getElementById("authIdentityLabel");
    const identityInput = document.getElementById("authUsername");
    const passwordInput = document.getElementById("authPassword");

    if (identityInput) {
        identityInput.value = "";
    }
    if (passwordInput) {
        passwordInput.value = "";
    }

    if (role === "admin") {
        if (identityLabel) identityLabel.innerText = "Administrator Official Email";
        if (identityInput) identityInput.placeholder = "e.g. admin@univ.edu";
    } else if (role === "teacher") {
        if (identityLabel) identityLabel.innerText = "Faculty Official Email / Employee ID";
        if (identityInput) identityInput.placeholder = "e.g. ravi.sharma@univ.edu";
    } else if (role === "student") {
        if (identityLabel) identityLabel.innerText = "Student Roll Number / Admission ID";
        if (identityInput) identityInput.placeholder = "e.g. 22CSE-401";
    }

    renderQuickLoginButtons(role);
}

function renderQuickLoginButtons(role) {
    const container = document.getElementById("quickLoginButtons");
    if (!container) return;

    if (role === "admin") {
        container.innerHTML = `
            <button type="button" class="quick-demo-pill" onclick="quickLogin('admin', 'Dean / Academic Admin', 'dean.office@univ.edu')">
                <span>👨‍💼 <strong>Dean / Institutional Admin</strong></span>
                <span class="pill-meta">Full Access & AI Engine →</span>
            </button>
            <button type="button" class="quick-demo-pill" onclick="quickLogin('admin', 'Academic HOD (CSE)', 'cse.hod@univ.edu')">
                <span>⚡ <strong>HOD / Academic Controller</strong></span>
                <span class="pill-meta">Department Management →</span>
            </button>
        `;
    } else if (role === "teacher") {
        const teacherOptions = (teachers && teachers.length > 0) ? teachers.slice(0, 3) : [
            { id: 201, name: "Dr. Ravi Sharma", email: "ravi.sharma@univ.edu" },
            { id: 202, name: "Prof. Priya Nair", email: "priya.nair@univ.edu" },
            { id: 204, name: "Dr. Sneha Roy", email: "sneha.roy@univ.edu" }
        ];

        container.innerHTML = teacherOptions.map(t => `
            <button type="button" class="quick-demo-pill" onclick="quickLogin('teacher', '${escapeHtml(t.name)}', '${escapeHtml(t.email)}', ${t.id})">
                <span>👨‍🏫 <strong>${escapeHtml(t.name)}</strong></span>
                <span class="pill-meta">${escapeHtml(t.email)} →</span>
            </button>
        `).join("");
    } else if (role === "student") {
        const classOptions = (classes && classes.length > 0) ? classes.slice(0, 3) : [
            { id: 101, name: "B.Tech CSE - 4th Sem (Sec A)" },
            { id: 102, name: "B.Tech AI & Data Science - 2nd Sem" },
            { id: 103, name: "B.Tech ECE - 4th Sem" }
        ];

        container.innerHTML = classOptions.map(c => `
            <button type="button" class="quick-demo-pill" onclick="quickLogin('student', 'Student (${escapeHtml(c.name)})', 'student@univ.edu', null, ${c.id})">
                <span>🎓 <strong>${escapeHtml(c.name)}</strong></span>
                <span class="pill-meta">View Daily Timetable →</span>
            </button>
        `).join("");
    }
}

function quickLogin(role, name, email, teacherId = null, classId = null) {
    const user = {
        role,
        name,
        email,
        teacherId,
        classId
    };
    applyLoginSession(user, true);
}

function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const wrapper = input.closest(".password-input-wrapper");
    const eyeOpen = wrapper ? wrapper.querySelector(".eye-open") : null;
    const eyeClosed = wrapper ? wrapper.querySelector(".eye-closed") : null;

    if (input.type === "password") {
        input.type = "text";
        if (eyeOpen) eyeOpen.style.display = "none";
        if (eyeClosed) eyeClosed.style.display = "block";
    } else {
        input.type = "password";
        if (eyeOpen) eyeOpen.style.display = "block";
        if (eyeClosed) eyeClosed.style.display = "none";
    }
}

function handleManualLogin() {
    const email = document.getElementById("authUsername")?.value.trim();
    const password = document.getElementById("authPassword")?.value;

    if (!email) {
        showToast("Please enter your official email address", "warning");
        return;
    }
    if (!password || password.length === 0) {
        showToast("Please enter your account password", "warning");
        return;
    }

    let teacherId = null;
    let classId = null;
    let displayName = email;

    if (currentAuthRole === "admin") {
        displayName = "Institutional Administrator";
    } else if (currentAuthRole === "teacher") {
        const found = teachers.find(t => t.email.toLowerCase() === email.toLowerCase() || t.name.toLowerCase().includes(email.toLowerCase()));
        if (found) {
            teacherId = found.id;
            displayName = found.name;
        } else {
            teacherId = teachers[0]?.id || 201;
            displayName = email.split("@")[0].replace(".", " ");
        }
    } else if (currentAuthRole === "student") {
        classId = classes[0]?.id || 101;
        displayName = `Student (${email.split("@")[0]})`;
    }

    const user = {
        role: currentAuthRole,
        name: displayName,
        email: email,
        teacherId,
        classId
    };

    applyLoginSession(user, true);
}

function applyLoginSession(user, showToastMessage = true) {
    currentUser = user;
    localStorage.setItem("chronos_user_session", JSON.stringify(user));

    // Update body classes for role-based CSS restrictions
    document.body.classList.remove("role-admin", "role-teacher", "role-student");
    document.body.classList.add(`role-${user.role}`);

    // Update User Profile Badge in Header
    const badge = document.getElementById("userProfileBadge");
    const avatar = document.getElementById("userAvatar");
    const nameEl = document.getElementById("userName");
    const roleTag = document.getElementById("userRoleTag");

    if (badge && avatar && nameEl && roleTag) {
        badge.style.display = "flex";
        avatar.innerText = user.name.charAt(0).toUpperCase();
        nameEl.innerText = user.name;
        roleTag.innerText = user.role.toUpperCase();
    }

    // Hide login modal
    const authScreen = document.getElementById("authScreen");
    if (authScreen) {
        authScreen.classList.add("hidden");
    }

    // Navigate to appropriate role-specific view
    if (user.role === "admin") {
        switchTab("adminTab");
    } else if (user.role === "teacher") {
        switchTab("scheduleTab");
        const viewSelect = document.getElementById("viewMode");
        if (viewSelect) {
            viewSelect.value = "teacher";
            updateFilterTargetDropdown();
            if (user.teacherId) {
                const targetSelect = document.getElementById("filterTarget");
                if (targetSelect) targetSelect.value = user.teacherId;
            }
            renderTimetable();
        }
    } else if (user.role === "student") {
        switchTab("scheduleTab");
        const viewSelect = document.getElementById("viewMode");
        if (viewSelect) {
            viewSelect.value = "class";
            updateFilterTargetDropdown();
            if (user.classId) {
                const targetSelect = document.getElementById("filterTarget");
                if (targetSelect) targetSelect.value = user.classId;
            }
            renderTimetable();
        }
    }

    if (showToastMessage) {
        showToast(`Welcome back, ${user.name}! (${user.role.toUpperCase()} Portal)`, "success");
    }
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem("chronos_user_session");

    document.body.classList.remove("role-admin", "role-teacher", "role-student");

    const badge = document.getElementById("userProfileBadge");
    if (badge) badge.style.display = "none";

    const authScreen = document.getElementById("authScreen");
    if (authScreen) {
        authScreen.classList.remove("hidden");
    }

    selectAuthRole("admin");
    showToast("Signed out of portal. Select role to log in.", "info");
}
