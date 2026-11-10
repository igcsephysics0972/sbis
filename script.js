
const main = document.getElementById("main");
let page = "dashboard";

let db = {
  students: [],
  grades: [],
  subjects: [],
  teachers: [],
  mocks: []
};

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);

const normalize = value =>
  String(value ?? "").trim().toLowerCase();

const heading = (title, description) =>
  `<div class="heading"><div><h2>${title}</h2>
  <p>${description}</p></div></div>`;

const yearOptions = [10, 11, 12]
  .map(y => `<option value="${y}">Year ${y}</option>`)
  .join("");

const studentOptions = () => db.students.map(s =>
  `<option value="${esc(s.id)}">${esc(s.name)}
  (Year ${s.year})</option>`
).join("");

function notifyError(error) {
  console.error(error);
  alert(error.message || String(error));
}

async function loadData() {
  const tables = [
    "students", "subjects", "teachers", "mocks", "grades"
  ];

  const results = await Promise.all(
    tables.map(table =>
      supabaseClient.from(table).select("*")
        .limit(10000)
    )
  );

  results.forEach((result, i) => {
    if (result.error) throw result.error;
  });

  const [students, subjects, teachers, mocks, grades] =
    results.map(r => r.data);

  db.students = students.map(s => ({
    id: s.id,
    name: s.student_name,
    year: s.year_group,
    academic: s.academic_year,
    code: s.student_code || ""
  }));

  db.subjects = subjects;
  db.teachers = teachers;
  db.mocks = mocks;

  db.grades = grades.map(g => {
    const mock = mocks.find(m => m.id === g.mock_id);
    const subject = subjects.find(
      s => s.id === mock?.subject_id
    );
    const teacher = teachers.find(
      t => t.id === mock?.teacher_id
    );

    return {
      id: g.id,
      studentId: g.student_id,
      mockId: g.mock_id,
      subject: subject?.subject_name || "Unknown",
      mock: mock?.mock_name || "Unknown",
      teacher: teacher?.teacher_name || "",
      score: g.score,
      total: g.max_score
    };
  });

  render();
}

async function refresh() {
  await loadData();
}

function go(nextPage) {
  page = nextPage;

  document.querySelectorAll("#nav button").forEach(b =>
    b.classList.toggle(
      "active", b.dataset.page === page
    )
  );

  render();
}

document.querySelectorAll("#nav button").forEach(b => {
  b.onclick = () => go(b.dataset.page);
});

function render() {
  if (page === "dashboard") renderDashboard();
  if (page === "students") renderStudents();
  if (page === "grades") renderGrades();
  if (page === "import") renderImport();
  if (page === "reports") renderReports();
}

// DASHBOARD

function renderDashboard() {
  main.innerHTML =
    heading(
      "Dashboard",
      "Manage student mock examination results"
    ) +
    `<div class="cards">
      <div class="card">
        <div class="metric">${db.students.length}</div>
        Students
      </div>
      <div class="card">
        <div class="metric">${db.subjects.length}</div>
        Subjects
      </div>
      <div class="card">
        <div class="metric">${db.grades.length}</div>
        Recorded Results
      </div>
    </div>

    <div class="panel">
      <h3>Quick Actions</h3>
      <div class="actions">
        <button class="primary" onclick="go('students')">
          Manage Students
        </button>
        <button class="primary" onclick="go('grades')">
          Enter Grades
        </button>
        <button class="secondary" onclick="go('import')">
          Import Spreadsheet
        </button>
        <button class="secondary" onclick="go('reports')">
          Generate Reports
        </button>
      </div>
    </div>`;
}

// STUDENTS

function renderStudents() {
  main.innerHTML =
    heading(
      "Students",
      "Manage Year 10, Year 11 and Year 12 students"
    ) +
    `<div class="panel">
      <h3>Add Student</h3>

      <form id="student-form" class="grid">
        <div>
          <label>Student name</label>
          <input name="name" required
            placeholder="Full name">
        </div>

        <div>
          <label>Year group</label>
          <select name="year">${yearOptions}</select>
        </div>

        <div>
          <label>Academic year</label>
          <input name="academic"
            value="2026–2027" required>
        </div>

        <div>
          <label>Student ID (optional)</label>
          <input name="code"
            placeholder="Unique school ID">
        </div>

        <div style="align-self:end">
          <button class="primary">Add Student</button>
        </div>
      </form>
    </div>

    <div class="panel">
      <h3>Student List</h3>
      <div style="overflow-x:auto">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Year</th>
              <th>Academic Year</th>
              <th>Student ID</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${db.students.map(s => `
              <tr>
                <td>${esc(s.name)}</td>
                <td>${esc(s.year)}</td>
                <td>${esc(s.academic)}</td>
                <td>${esc(s.code)}</td>
                <td>
                  <button class="secondary"
                    onclick="removeStudent('${s.id}')">
                    Remove
                  </button>
                </td>
              </tr>
            `).join("") ||
              '<tr><td colspan="5">No students yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;

  document.getElementById("student-form").onsubmit =
    addStudent;
}

async function addStudent(event) {
  event.preventDefault();

  const form = event.target;
  const button = form.querySelector("button");
  button.disabled = true;

  const d = Object.fromEntries(new FormData(form));

  try {
    const { error } = await supabaseClient
      .from("students")
      .insert({
        student_name: d.name.trim(),
        year_group: Number(d.year),
        academic_year: d.academic.trim(),
        student_code: d.code.trim() || null
      });

    if (error) throw error;

    await refresh();
  } catch (error) {
    notifyError(error);
  } finally {
    button.disabled = false;
  }
}

async function removeStudent(id) {
  if (!confirm("Remove student and all their grades?"))
    return;

  try {
    const { error } = await supabaseClient
      .from("students")
      .delete()
      .eq("id", id);

    if (error) throw error;
    await refresh();
  } catch (error) {
    notifyError(error);
  }
}

// GRADES

function renderGrades() {
  main.innerHTML =
    heading(
      "Enter Grades",
      "Record or update mock exam scores"
    ) +
    `<div class="panel">
      <form id="grade-form" class="grid">

        <div>
          <label>Student</label>
          <select name="studentId" required>
            ${studentOptions()}
          </select>
        </div>

        <div>
          <label>Subject</label>
          <input name="subject"
            placeholder="e.g. Chemistry" required>
        </div>

        <div>
          <label>Teacher name (optional)</label>
          <input name="teacher"
            placeholder="Teacher">
        </div>

        <div>
          <label>Mock exam</label>
          <input name="mock"
            placeholder="e.g. Mock 1" required>
        </div>

        <div>
          <label>Score</label>
          <input name="score" type="number"
            min="0" step="0.01" required>
        </div>

        <div>
          <label>Out of</label>
          <input name="total" type="number"
            min="0.01" step="0.01" required>
        </div>

        <div style="align-self:end">
          <button class="primary">Save Grade</button>
        </div>
      </form>
    </div>

    <div class="panel">
      <h3>Saved Results</h3>
      <div style="overflow-x:auto">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Subject</th>
              <th>Mock</th>
              <th>Score</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${db.grades.map(g => `
              <tr>
                <td>${esc(
                  db.students.find(
                    s => s.id === g.studentId
                  )?.name || "Unknown"
                )}</td>
                <td>${esc(g.subject)}</td>
                <td>${esc(g.mock)}</td>
                <td>${esc(g.score)} / ${esc(g.total)}</td>
                <td>
                  <button class="secondary"
                    onclick="removeGrade('${g.id}')">
                    Delete
                  </button>
                </td>
              </tr>
            `).join("") ||
              '<tr><td colspan="5">No grades yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;

  document.getElementById("grade-form").onsubmit =
    saveGradeForm;
}

async function findOrCreate(table, column, value) {
  const name = value.trim();

  const existing = db[table].find(
    item => normalize(item[column]) === normalize(name)
  );

  if (existing) return existing.id;

  const { data, error } = await supabaseClient
    .from(table)
    .insert({ [column]: name })
    .select("id")
    .single();

  if (error) {
    // Another admin may have inserted the same subject.
    if (error.code === "23505") {
      const result = await supabaseClient
        .from(table)
        .select("id")
        .ilike(column, name)
        .limit(1)
        .maybeSingle();

      if (!result.error && result.data)
        return result.data.id;
    }

    throw error;
  }

  db[table].push({
    id: data.id,
    [column]: name
  });

  return data.id;
}

async function saveGrade(d) {
  const student = db.students.find(
    s => s.id === d.studentId
  );

  if (!student)
    throw new Error("Student not found.");

  const score = Number(d.score);
  const total = Number(d.total);

  if (
    !Number.isFinite(score) ||
    !Number.isFinite(total) ||
    score < 0 ||
    total <= 0 ||
    score > total
  ) {
    throw new Error("Invalid score or maximum score.");
  }

  if (!d.subject?.trim() || !d.mock?.trim()) {
    throw new Error("Subject and mock are required.");
  }

  const subjectId = await findOrCreate(
    "subjects", "subject_name", d.subject
  );

  let teacherId = null;

  if (d.teacher?.trim()) {
    teacherId = await findOrCreate(
      "teachers", "teacher_name", d.teacher
    );
  }

  let mock = db.mocks.find(m =>
    m.subject_id === subjectId &&
    normalize(m.mock_name) === normalize(d.mock) &&
    m.year_group === Number(student.year) &&
    m.academic_year === student.academic &&
    (m.teacher_id || null) === teacherId
  );

  if (!mock) {
    const { data, error } = await supabaseClient
      .from("mocks")
      .insert({
        mock_name: d.mock.trim(),
        subject_id: subjectId,
        teacher_id: teacherId,
        year_group: Number(student.year),
        academic_year: student.academic
      })
      .select("*")
      .single();

    if (error) throw error;

    mock = data;
    db.mocks.push(mock);
  }

  const { error } = await supabaseClient
    .from("grades")
    .upsert({
      student_id: student.id,
      mock_id: mock.id,
      score,
      max_score: total
    }, {
      onConflict: "student_id,mock_id"
    });

  if (error) throw error;
}

async function saveGradeForm(event) {
  event.preventDefault();

  const form = event.target;
  const button = form.querySelector("button");
  button.disabled = true;

  try {
    const d = Object.fromEntries(new FormData(form));
    await saveGrade(d);
    await refresh();
  } catch (error) {
    notifyError(error);
  } finally {
    button.disabled = false;
  }
}

async function removeGrade(id) {
  if (!confirm("Delete this grade?")) return;

  try {
    const { error } = await supabaseClient
      .from("grades")
      .delete()
      .eq("id", id);

    if (error) throw error;
    await refresh();
  } catch (error) {
    notifyError(error);
  }
}

// EXCEL IMPORT

let importedRows = [];
let pending = [];

const aliases = {
  name: [
    "student name", "student", "name",
    "full name", "learner", "pupil"
  ],
  code: ["student id", "id", "student code"],
  subject: ["subject", "course", "subject name"],
  teacher: ["teacher", "teacher name", "instructor"],
  mock: [
    "mock", "mock name", "exam",
    "exam name", "assessment", "test"
  ],
  score: ["score", "mark", "marks", "grade", "result"],
  total: [
    "total", "out of", "maximum",
    "max score", "full mark", "max marks"
  ]
};

const normalizeHeader = value =>
  normalize(value).replace(/[^a-z0-9]+/g, " ").trim();

function renderImport() {
  main.innerHTML =
    heading(
      "Import Spreadsheet",
      "Import scores for multiple students at once"
    ) +
    `<div class="panel">
      <h3>Upload Excel or CSV</h3>
      <p>
        Upload a spreadsheet and match its columns.
        Students must already exist in the system.
      </p>

      <div class="grid">
        <div>
          <label>Spreadsheet file</label>
          <input type="file" id="upload"
            accept=".xlsx,.xls,.csv">
        </div>
        <div style="align-self:end">
          <button class="secondary"
            onclick="downloadTemplate()">
            Download CSV Template
          </button>
        </div>
      </div>

      <div id="preview"></div>
    </div>`;

  document.getElementById("upload").onchange =
    handleImport;
}

async function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!window.XLSX) {
    alert("Excel reader could not load.");
    return;
  }

  try {
    const workbook = XLSX.read(
      await file.arrayBuffer(),
      { type: "array" }
    );

    importedRows = XLSX.utils.sheet_to_json(
      workbook.Sheets[workbook.SheetNames[0]],
      { defval: "" }
    );

    if (!importedRows.length)
      throw new Error("Spreadsheet is empty.");

    showColumnMapping();
  } catch (error) {
    notifyError(error);
  }
}

function showColumnMapping() {
  const keys = [...new Set(
    importedRows.flatMap(row => Object.keys(row))
  )];

  const fields = [
    "name", "code", "subject",
    "teacher", "mock", "score", "total"
  ];

  const options =
    '<option value="">Not included / use default</option>' +
    keys.map((key, i) =>
      `<option value="${i}">${esc(key)}</option>`
    ).join("");

  document.getElementById("preview").innerHTML =
    `<h3>Match Spreadsheet Columns</h3>
    <p>Confirm the detected columns or choose manually.</p>

    <div class="grid">
      ${fields.map(field => `
        <div>
          <label>${esc(field.toUpperCase())}</label>
          <select id="map-${field}">
            ${options}
          </select>
        </div>
      `).join("")}
    </div>

    <div class="grid" style="margin-top:14px">
      <div>
        <label>Default Subject</label>
        <input id="default-subject">
      </div>
      <div>
        <label>Default Mock</label>
        <input id="default-mock">
      </div>
      <div>
        <label>Default Maximum Score</label>
        <input id="default-total" type="number"
          min="0.01" step="0.01">
      </div>
      <div>
        <label>Default Teacher</label>
        <input id="default-teacher">
      </div>
    </div>

    <div class="actions">
      <button class="primary"
        onclick="previewMappedImport()">
        Preview Grades
      </button>
    </div>`;

  fields.forEach(field => {
    const index = keys.findIndex(key =>
      aliases[field].includes(normalizeHeader(key))
    );

    if (index >= 0)
      document.getElementById("map-" + field).value =
        String(index);
  });

  window.importColumnKeys = keys;
}

function previewMappedImport() {
  const fields = [
    "name", "code", "subject",
    "teacher", "mock", "score", "total"
  ];

  const map = {};

  fields.forEach(field => {
    const index = document.getElementById(
      "map-" + field
    ).value;

    map[field] = index === ""
      ? null
      : window.importColumnKeys[Number(index)];
  });

  const defaults = {
    subject: document.getElementById(
      "default-subject"
    ).value.trim(),
    mock: document.getElementById(
      "default-mock"
    ).value.trim(),
    total: document.getElementById(
      "default-total"
    ).value.trim(),
    teacher: document.getElementById(
      "default-teacher"
    ).value.trim()
  };

  pending = importedRows.map((row, i) => {
    const get = field =>
      map[field] === null
        ? ""
        : String(row[map[field]] ?? "").trim();

    const name = get("name");
    const code = get("code");
    const subject = get("subject") || defaults.subject;
    const mock = get("mock") || defaults.mock;
    const teacher = get("teacher") || defaults.teacher;

    let rawScore = get("score");
    let rawTotal = get("total") || defaults.total;

    const pair = rawScore.match(
      /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/
    );

    if (pair) {
      rawScore = pair[1];
      if (!rawTotal) rawTotal = pair[2];
    }

    const score = Number(rawScore);
    const total = Number(rawTotal);

    const matches = db.students.filter(s =>
      code
        ? normalize(s.code) === normalize(code)
        : normalize(s.name) === normalize(name)
    );

    const valid = (
      matches.length === 1 &&
      !!subject &&
      !!mock &&
      rawScore !== "" &&
      rawTotal !== "" &&
      Number.isFinite(score) &&
      Number.isFinite(total) &&
      score >= 0 &&
      total > 0 &&
      score <= total
    );

    return {
      row: i + 2,
      name,
      subject,
      mock,
      teacher,
      score,
      total,
      studentId: matches[0]?.id,
      valid,
      reason: matches.length !== 1
        ? "Student not uniquely matched"
        : "Missing or invalid fields"
    };
  });

  const good = pending.filter(r => r.valid).length;

  document.getElementById("preview").innerHTML =
    `<h3>Import Preview</h3>
    <p>${good} ready ·
    ${pending.length - good} need review</p>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Row</th>
            <th>Student</th>
            <th>Subject</th>
            <th>Mock</th>
            <th>Score</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${pending.slice(0, 150).map(r => `
            <tr>
              <td>${r.row}</td>
              <td>${esc(r.name)}</td>
              <td>${esc(r.subject)}</td>
              <td>${esc(r.mock)}</td>
              <td>${esc(r.score)} / ${esc(r.total)}</td>
              <td>${r.valid
                ? "Ready"
                : esc(r.reason)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>

    <div class="actions">
      <button class="primary"
        onclick="commitImport()"
        ${good ? "" : "disabled"}>
        Import ${good} Valid Rows
      </button>

      <button class="secondary"
        onclick="showColumnMapping()">
        Change Column Mapping
      </button>
    </div>`;
}

async function commitImport() {
  const good = pending.filter(r => r.valid);

  if (!good.length) return;

  let completed = 0;
  const failures = [];

  for (const row of good) {
    try {
      await saveGrade(row);
      completed++;
    } catch (error) {
      failures.push(
        `Row ${row.row}: ${error.message}`
      );
    }
  }

  pending = [];
  await refresh();

  alert(
    `${completed} grades saved.\n` +
    (failures.length
      ? `${failures.length} failed:\n` +
        failures.slice(0, 10).join("\n")
      : "")
  );
}

function downloadTemplate() {
  const csv =
    "Student ID,Student Name,Subject,Mock,Score,Total,Teacher\n" +
    ",Example Student,Chemistry,Mock 1,35,40,Example Teacher\n";

  downloadBlob(
    new Blob([csv], { type: "text/csv" }),
    "sbis-import-template.csv"
  );
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}


 // REPORTS — DIRECT PDF DOWNLOAD

function renderReports() {
  main.innerHTML =
    heading(
      "Generate Reports",
      "Download branded student mock exam reports as PDF"
    ) +
    `<div class="panel">
      <div class="grid">
        <div>
          <label>Academic Year</label>
          <input id="report-academic" value="2026–2027">
        </div>

        <div>
          <label>Year Group</label>
          <select id="report-year">
            ${yearOptions}
          </select>
        </div>
      </div>

      <div class="actions">
        <button class="primary"
          onclick="showReportOptions('one')">
          Generate One Student
        </button>

        <button class="primary gold"
          onclick="showReportOptions('all')">
          Generate All Students
        </button>
      </div>

      <div id="report-options"
        style="margin-top:20px"></div>
    </div>`;
}

function selectedReportStudents() {
  const year = Number(
    document.getElementById("report-year").value
  );

  const academic = document.getElementById(
    "report-academic"
  ).value.trim();

  return db.students.filter(s =>
    Number(s.year) === year &&
    s.academic === academic
  );
}

function showReportOptions(mode) {
  const students = selectedReportStudents();
  const el = document.getElementById("report-options");

  if (!students.length) {
    el.innerHTML =
      '<p class="notice">No students found.</p>';
    return;
  }

  if (mode === "one") {
    el.innerHTML = `
      <label>Select Student</label>
      <select id="selected-student">
        ${students.map(s => `
          <option value="${esc(s.id)}">
            ${esc(s.name)}
          </option>
        `).join("")}
      </select>

      <div class="actions">
        <button class="primary"
          onclick="printStudents([
            document.getElementById(
              'selected-student'
            ).value
          ])">
          Download Student PDF
        </button>
      </div>`;
  } else {
    el.innerHTML = `
      <h3>Download All Reports</h3>
      <p>
        Download one combined PDF containing
        all selected students.
      </p>

      <div class="actions">
        <button class="primary"
          onclick="bulkReports()">
          Download Combined PDF
        </button>
      </div>`;
  }
}

function bulkReports() {
  return printStudents(
    selectedReportStudents().map(s => s.id)
  );
}

function reportHTML(student) {
  const grades = db.grades.filter(
    g => g.studentId === student.id
  );

  const subjects = [
    ...new Set(grades.map(g => g.subject))
  ];

  return `
    <section class="report report-page">
      <div class="report-head">
        <img src="logo-transparent.png"
          alt="SBIS Logo">

        <div>
          <h2>Student Academic Report</h2>
          <div>
            IG Department · Year ${esc(student.year)}
          </div>
          <div>
            Academic Year ${esc(student.academic)}
          </div>
        </div>
      </div>

      <h3>Student: ${esc(student.name)}</h3>

      ${student.code
        ? `<p>Student ID: ${esc(student.code)}</p>`
        : ""}

      ${subjects.map(subject => `
        <h3>${esc(subject)}</h3>

        <table>
          <thead>
            <tr>
              <th>Mock Examination</th>
              <th>Score</th>
              <th>Maximum</th>
            </tr>
          </thead>

          <tbody>
            ${grades.filter(
              g => g.subject === subject
            ).map(g => `
              <tr>
                <td>${esc(g.mock)}</td>
                <td>${esc(g.score)}</td>
                <td>${esc(g.total)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `).join("") ||
        "<p>No mock results recorded yet.</p>"}

      <div class="report-foot">
        Sun of Knowledge British International School ·
        Generated ${new Date().toLocaleDateString("en-GB")}
      </div>
    </section>`;
}

function safePDFName(value) {
  return String(value)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 90);
}

async function waitForReportImages(element) {
  const images = [...element.querySelectorAll("img")];

  await Promise.all(images.map(img => {
    if (img.complete) {
      if (img.naturalWidth === 0) {
        return Promise.reject(
          new Error("Report logo could not load.")
        );
      }
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(
        new Error("Report logo could not load.")
      );
    });
  }));
}

async function printStudents(ids) {
  const students = ids
    .map(id => db.students.find(s => s.id === id))
    .filter(Boolean);

  if (!students.length) {
    alert("No students selected.");
    return;
  }

  if (
    !window.html2canvas ||
    !window.jspdf?.jsPDF
  ) {
    alert(
      "PDF libraries are not loaded. " +
      "Check the script tags in index.html."
    );
    return;
  }

  const button = document.activeElement;
  const originalText =
    button instanceof HTMLButtonElement
      ? button.textContent
      : null;

  if (originalText !== null) {
    button.disabled = true;
    button.textContent = "Generating PDF...";
  }

  let container = null;

  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const margin = 10;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;

    // Render reports off-screen, without opening a new tab.
    container = document.createElement("div");

    Object.assign(container.style, {
      position: "fixed",
      left: "-10000px",
      top: "0",
      width: "794px",
      background: "#ffffff",
      zIndex: "-1",
      pointerEvents: "none"
    });

    document.body.appendChild(container);

    for (let i = 0; i < students.length; i++) {
      const student = students[i];

      container.innerHTML = reportHTML(student);

      const report = container.querySelector(".report");

      Object.assign(report.style, {
        width: "794px",
        maxWidth: "none",
        margin: "0",
        padding: "38px",
        background: "#ffffff",
        boxSizing: "border-box",
        boxShadow: "none"
      });

      await waitForReportImages(report);

      // Wait for fonts before capturing the report.
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      const canvas = await html2canvas(report, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        windowWidth: 1100
      });

      const imageData = canvas.toDataURL(
        "image/jpeg",
        0.92
      );

      const imageHeight =
        canvas.height * usableWidth / canvas.width;

      // Each student's report starts on a new PDF page.
      if (i > 0) {
        pdf.addPage();
      }

      // Short reports fit on one A4 page.
      // Long reports continue onto additional pages.
      let renderedHeight = 0;

      while (renderedHeight < imageHeight) {
        if (renderedHeight > 0) {
          pdf.addPage();
        }

        pdf.addImage(
          imageData,
          "JPEG",
          margin,
          margin - renderedHeight,
          usableWidth,
          imageHeight
        );

        renderedHeight += usableHeight;
      }
    }

    const filename = students.length === 1
      ? `SBIS-${safePDFName(students[0].name)}-Report.pdf`
      : `SBIS-Combined-Reports-${students.length}-Students.pdf`;

    pdf.save(filename);

  } catch (error) {
    console.error("PDF generation failed:", error);
    alert(
      "Could not generate the PDF: " +
      (error.message || String(error))
    );
  } finally {
    if (container) {
      container.remove();
    }

    if (originalText !== null) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}
