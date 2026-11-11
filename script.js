
const main = document.getElementById("main");
let page = "dashboard";

let db = {
  students: [],
  grades: [],
  subjects: [],
  teachers: [],
  mocks: []
};

const esc = value =>
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
  `<div class="heading"><div><h2>${esc(title)}</h2>
  <p>${esc(description)}</p></div></div>`;

const yearOptions = [10, 11, 12]
  .map(y => `<option value="${y}">Year ${y}</option>`)
  .join("");

const studentOptions = () => db.students.map(s =>
  `<option value="${esc(s.id)}">${esc(s.name)}
  (Year ${s.year})</option>`
).join("");

const statusOptions = `
  <option value="Recorded">Recorded</option>
  <option value="Absent">Absent</option>
  <option value="Pending">Pending</option>
  <option value="N/A">N/A - No assessment held</option>
`;

const today = () => new Date().toLocaleDateString("en-CA");

function notifyError(error) {
  console.error(error);
  alert(error.message || String(error));
}

function formatDate(value) {
  if (!value) return "Not specified";
  const date = new Date(value + "T12:00:00");
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString("en-GB");
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const date = new Date(value + "T12:00:00Z");
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

async function loadData() {
  const tables = [
    "students", "subjects", "teachers", "mocks", "grades"
  ];

  const results = await Promise.all(
    tables.map(table =>
      supabaseClient.from(table).select("*").limit(10000)
    )
  );

  results.forEach(result => {
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

  const subjectMap = new Map(subjects.map(s => [s.id, s]));
  const teacherMap = new Map(teachers.map(t => [t.id, t]));
  const mockMap = new Map(mocks.map(m => [m.id, m]));

  db.grades = grades.map(g => {
    const mock = mockMap.get(g.mock_id);
    const subject = subjectMap.get(mock?.subject_id);
    const teacher = teacherMap.get(mock?.teacher_id);

    return {
      id: g.id,
      studentId: g.student_id,
      mockId: g.mock_id,
      subject: subject?.subject_name || "Unknown",
      mock: mock?.mock_name || "Unknown",
      teacher: teacher?.teacher_name || "",
      type: mock?.assessment_type || "Mock",
      date: mock?.assessment_date || "",
      status: g.assessment_status || "Recorded",
      score: g.score,
      total: g.max_score,
      equivalent: g.equivalent_grade ?? ""
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
    b.classList.toggle("active", b.dataset.page === page)
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
      "Manage student assessments and academic results"
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
          <input name="name" required placeholder="Full name">
        </div>
        <div>
          <label>Year group</label>
          <select name="year">${yearOptions}</select>
        </div>
        <div>
          <label>Academic year</label>
          <input name="academic" value="2026–2027" required>
        </div>
        <div>
          <label>Student ID (optional)</label>
          <input name="code" placeholder="Unique school ID">
        </div>
        <div style="align-self:end">
          <button class="primary">Add Student</button>
        </div>
      </form>
    </div>

    <div class="panel">
      <h3>Student List</h3>
      <div class="table-wrap">
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

  document.getElementById("student-form").onsubmit = addStudent;
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
  if (!confirm("Remove student and all their grades?")) return;

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
      "Record Mocks, Quizzes and assessment results"
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
          <input name="teacher" placeholder="Teacher">
        </div>

        <div>
          <label>Assessment Type</label>
          <select name="type" required>
            <option value="Mock">Mock</option>
            <option value="Quiz">Quiz</option>
          </select>
        </div>

        <div>
          <label>Assessment Name</label>
          <input name="mock"
            placeholder="e.g. Mock 1 or Quiz 2" required>
        </div>

        <div>
          <label>Assessment Date</label>
          <input name="date" type="date"
            value="${today()}" required>
        </div>

        <div>
          <label>Assessment Status</label>
          <select name="status" id="grade-status">
            ${statusOptions}
          </select>
        </div>

        <div>
          <label>Score</label>
          <input name="score" type="number"
            min="0" step="0.01">
        </div>

        <div>
          <label>Out of</label>
          <input name="total" type="number"
            min="0.01" step="0.01">
        </div>

        <div>
          <label>Equivalent Grade (optional)</label>
          <input name="equivalent"
            placeholder="e.g. 9, 8, A*, A">
        </div>

        <div style="align-self:end">
          <button class="primary">Save Grade</button>
        </div>
      </form>
      <p class="hint">
        Use Recorded for numeric marks, Absent if the student
        missed an assessment, Pending if marks are not available,
        and N/A if no assessment was held.
      </p>
    </div>

    <div class="panel">
      <h3>Saved Results</h3>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Subject</th>
              <th>Type</th>
              <th>Assessment</th>
              <th>Date</th>
              <th>Result</th>
              <th>Equivalent</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${db.grades.map(g => `
              <tr>
                <td>${esc(db.students.find(
                  s => s.id === g.studentId
                )?.name || "Unknown")}</td>
                <td>${esc(g.subject)}</td>
                <td>${esc(g.type)}</td>
                <td>${esc(g.mock)}</td>
                <td>${esc(formatDate(g.date))}</td>
                <td>${esc(resultText(g))}</td>
                <td>${esc(g.equivalent || "—")}</td>
                <td>
                  <button class="secondary"
                    onclick="removeGrade('${g.id}')">
                    Delete
                  </button>
                </td>
              </tr>
            `).join("") ||
              '<tr><td colspan="8">No grades yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;

  const form = document.getElementById("grade-form");
  form.onsubmit = saveGradeForm;

  const status = form.elements.status;

  function updateFields() {
    const recorded = status.value === "Recorded";
    form.elements.score.disabled = !recorded;
    form.elements.total.disabled = !recorded;
    form.elements.equivalent.disabled = !recorded;
    form.elements.score.required = recorded;
    form.elements.total.required = recorded;

    if (!recorded) {
      form.elements.score.value = "";
      form.elements.total.value = "";
      form.elements.equivalent.value = "";
    }
  }

  status.onchange = updateFields;
  updateFields();
}

function resultText(g) {
  return g.status === "Recorded"
    ? `${g.score} / ${g.total}`
    : g.status;
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

  db[table].push({ id: data.id, [column]: name });
  return data.id;
}

async function saveGrade(d) {
  const student = db.students.find(
    s => s.id === d.studentId
  );

  if (!student) throw new Error("Student not found.");

  const type = d.type || "Mock";
  const status = d.status || "Recorded";
  const date = d.date || "";

  if (!["Mock", "Quiz"].includes(type))
    throw new Error("Invalid assessment type.");

  if (!["Recorded", "Absent", "Pending", "N/A"].includes(status))
    throw new Error("Invalid assessment status.");

  if (!isValidDate(date))
    throw new Error("A valid assessment date is required.");

  if (!d.subject?.trim() || !d.mock?.trim())
    throw new Error("Subject and assessment name are required.");

  let score = null;
  let total = null;
  let equivalent = null;

  if (status === "Recorded") {
    if (
      d.score === "" || d.score == null ||
      d.total === "" || d.total == null
    ) {
      throw new Error("Score and maximum are required.");
    }

    score = Number(d.score);
    total = Number(d.total);

    if (
      !Number.isFinite(score) ||
      !Number.isFinite(total) ||
      score < 0 ||
      total <= 0 ||
      score > total
    ) {
      throw new Error("Invalid score or maximum score.");
    }

    equivalent = String(d.equivalent ?? "").trim() || null;
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
    (m.assessment_type || "Mock") === type &&
    m.assessment_date === date &&
    Number(m.year_group) === Number(student.year) &&
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
        academic_year: student.academic,
        assessment_type: type,
        assessment_date: date
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
      max_score: total,
      equivalent_grade: equivalent,
      assessment_status: status
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

// EXCEL / CSV IMPORT

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
    "mock", "mock name", "exam", "exam name",
    "assessment", "assessment name", "test"
  ],
  type: ["assessment type", "type", "exam type"],
  date: ["assessment date", "exam date", "date", "test date"],
  status: ["assessment status", "status"],
  score: ["score", "mark", "marks", "result"],
  total: [
    "total", "out of", "maximum",
    "max score", "full mark", "max marks"
  ],
  equivalent: [
    "equivalent", "equivalent grade",
    "igcse grade", "grade equivalent"
  ]
};

const importFields = [
  "name", "code", "subject", "teacher",
  "mock", "type", "date", "status",
  "score", "total", "equivalent"
];

const normalizeHeader = value =>
  normalize(value).replace(/[^a-z0-9]+/g, " ").trim();

function renderImport() {
  main.innerHTML =
    heading(
      "Import Spreadsheet",
      "Import Mocks and Quizzes for multiple students"
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

  document.getElementById("upload").onchange = handleImport;
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
      { type: "array", cellDates: true }
    );

    importedRows = XLSX.utils.sheet_to_json(
      workbook.Sheets[workbook.SheetNames[0]],
      { defval: "", raw: false, dateNF: "yyyy-mm-dd" }
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

  const options =
    '<option value="">Not included / use default</option>' +
    keys.map((key, i) =>
      `<option value="${i}">${esc(key)}</option>`
    ).join("");

  document.getElementById("preview").innerHTML =
    `<h3>Match Spreadsheet Columns</h3>
    <p>Confirm detected columns or choose manually.</p>

    <div class="grid">
      ${importFields.map(field => `
        <div>
          <label>${esc(field.toUpperCase())}</label>
          <select id="map-${field}">
            ${options}
          </select>
        </div>
      `).join("")}
    </div>

    <h3 style="margin-top:22px">Default Values</h3>
    <div class="grid">
      <div>
        <label>Default Subject</label>
        <input id="default-subject">
      </div>
      <div>
        <label>Default Assessment Name</label>
        <input id="default-mock">
      </div>
      <div>
        <label>Default Type</label>
        <select id="default-type">
          <option value="Mock">Mock</option>
          <option value="Quiz">Quiz</option>
        </select>
      </div>
      <div>
        <label>Default Assessment Date</label>
        <input id="default-date" type="date" value="${today()}">
      </div>
      <div>
        <label>Default Status</label>
        <select id="default-status">${statusOptions}</select>
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

  importFields.forEach(field => {
    const index = keys.findIndex(key =>
      aliases[field].includes(normalizeHeader(key))
    );

    if (index >= 0)
      document.getElementById("map-" + field).value =
        String(index);
  });

  window.importColumnKeys = keys;
}

function parseImportDate(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  if (isValidDate(raw)) return raw;

  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const date = `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    return isValidDate(date) ? date : "";
  }

  return "";
}

function canonicalStatus(value) {
  const v = normalize(value);

  if (!v || ["recorded", "complete", "completed"].includes(v))
    return "Recorded";
  if (["absent", "missing"].includes(v))
    return "Absent";
  if (["pending", "awaiting"].includes(v))
    return "Pending";
  if (["n/a", "na", "not held", "no assessment held"].includes(v))
    return "N/A";

  return null;
}

function previewMappedImport() {
  const map = {};

  importFields.forEach(field => {
    const index = document.getElementById(
      "map-" + field
    ).value;

    map[field] = index === ""
      ? null
      : window.importColumnKeys[Number(index)];
  });

  const defaults = {
    subject: document.getElementById("default-subject").value.trim(),
    mock: document.getElementById("default-mock").value.trim(),
    type: document.getElementById("default-type").value,
    date: document.getElementById("default-date").value,
    status: document.getElementById("default-status").value,
    total: document.getElementById("default-total").value.trim(),
    teacher: document.getElementById("default-teacher").value.trim()
  };

  pending = importedRows.map((row, i) => {
    const get = field => map[field] === null
      ? ""
      : String(row[map[field]] ?? "").trim();

    const name = get("name");
    const code = get("code");
    const subject = get("subject") || defaults.subject;
    const mock = get("mock") || defaults.mock;
    const teacher = get("teacher") || defaults.teacher;
    const type = get("type") || defaults.type;
    const date = parseImportDate(get("date") || defaults.date);
    const status = canonicalStatus(get("status") || defaults.status);
    const equivalent = get("equivalent");

    let rawScore = get("score");
    let rawTotal = get("total") || defaults.total;

    const pair = rawScore.match(
      /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/
    );

    if (pair) {
      rawScore = pair[1];
      if (!rawTotal) rawTotal = pair[2];
    }

    const score = rawScore === "" ? null : Number(rawScore);
    const total = rawTotal === "" ? null : Number(rawTotal);

    const matches = db.students.filter(s =>
      code
        ? normalize(s.code) === normalize(code)
        : normalize(s.name) === normalize(name)
    );

    let reason = "";

    if (matches.length !== 1) {
      reason = "Student not uniquely matched";
    } else if (!subject || !mock) {
      reason = "Missing subject or assessment name";
    } else if (!["Mock", "Quiz"].includes(type)) {
      reason = "Invalid assessment type";
    } else if (!date) {
      reason = "Invalid assessment date";
    } else if (!status) {
      reason = "Invalid assessment status";
    } else if (
      status === "Recorded" &&
      (
        score === null || total === null ||
        !Number.isFinite(score) ||
        !Number.isFinite(total) ||
        score < 0 || total <= 0 || score > total
      )
    ) {
      reason = "Invalid score or maximum";
    } else if (
      status !== "Recorded" &&
      (rawScore !== "" || equivalent !== "")
    ) {
      reason = "Non-recorded results cannot contain marks or equivalent";
    }

    return {
      row: i + 2,
      name,
      subject,
      mock,
      teacher,
      type,
      date,
      status,
      score: status === "Recorded" ? score : null,
      total: status === "Recorded" ? total : null,
      equivalent: status === "Recorded" ? equivalent : "",
      studentId: matches[0]?.id,
      valid: !reason,
      reason
    };
  });

  const good = pending.filter(r => r.valid).length;

  document.getElementById("preview").innerHTML =
    `<h3>Import Preview</h3>
    <p>${good} ready · ${pending.length - good} need review</p>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Row</th>
            <th>Student</th>
            <th>Subject</th>
            <th>Type</th>
            <th>Assessment</th>
            <th>Date</th>
            <th>Result</th>
            <th>Equivalent</th>
            <th>Import Status</th>
          </tr>
        </thead>
        <tbody>
          ${pending.slice(0, 150).map(r => `
            <tr>
              <td>${r.row}</td>
              <td>${esc(r.name)}</td>
              <td>${esc(r.subject)}</td>
              <td>${esc(r.type)}</td>
              <td>${esc(r.mock)}</td>
              <td>${esc(formatDate(r.date))}</td>
              <td>${esc(resultText(r))}</td>
              <td>${esc(r.equivalent || "—")}</td>
              <td>${r.valid ? "Ready" : esc(r.reason)}</td>
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
      failures.push(`Row ${row.row}: ${error.message}`);
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
  const rows = [
    [
      "Student ID", "Student Name", "Subject",
      "Assessment Type", "Assessment Name",
      "Assessment Date", "Assessment Status",
      "Score", "Total", "Equivalent Grade", "Teacher"
    ],
    [
      "", "Example Student", "Chemistry",
      "Mock", "Mock 1", "2026-11-11",
      "Recorded", "35", "40", "9", "Example Teacher"
    ],
    [
      "", "Example Student", "Physics",
      "Quiz", "Quiz 1", "2026-11-12",
      "Absent", "", "", "", "Example Teacher"
    ]
  ];

  const csv = rows.map(row =>
    row.map(value =>
      `"${String(value).replace(/"/g, '""')}"`
    ).join(",")
  ).join("\r\n");

  downloadBlob(
    new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8"
    }),
    "sbis-import-template.csv"
  );
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// REPORTS

function renderReports() {
  main.innerHTML =
    heading(
      "Generate Reports",
      "Download student assessment reports as PDF"
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

        <div>
          <label>From Date</label>
          <input id="report-from" type="date">
        </div>

        <div>
          <label>To Date</label>
          <input id="report-to" type="date">
        </div>
      </div>

      <p class="hint">
        Leave both dates empty to include all assessments.
        Only assessments within the selected date range
        will appear in the PDF.
      </p>

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

function reportFilters() {
  const from = document.getElementById("report-from").value;
  const to = document.getElementById("report-to").value;

  if (from && to && from > to)
    throw new Error("From Date must not be after To Date.");

  return { from, to };
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
            document.getElementById('selected-student').value
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

function filteredStudentGrades(student, filters) {
  return db.grades
    .filter(g =>
      g.studentId === student.id &&
      (!filters.from || (g.date && g.date >= filters.from)) &&
      (!filters.to || (g.date && g.date <= filters.to))
    )
    .sort((a, b) =>
      (a.date || "").localeCompare(b.date || "") ||
      a.subject.localeCompare(b.subject)
    );
}

function reportHTML(student, filters) {
  const grades = filteredStudentGrades(student, filters);
  const subjects = [...new Set(grades.map(g => g.subject))];

  const period = filters.from || filters.to
    ? `${filters.from ? formatDate(filters.from) : "Start"} to
       ${filters.to ? formatDate(filters.to) : "Present"}`
    : "All assessment dates";

  return `
    <section class="report report-page">
      <div class="report-head">
        <img src="logo-transparent.png" alt="SBIS Logo">
        <div>
          <h2>Student Academic Report</h2>
          <div>IG Department · Year ${esc(student.year)}</div>
          <div>Academic Year ${esc(student.academic)}</div>
          <div>Reporting Period: ${esc(period)}</div>
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
              <th>Type</th>
              <th>Assessment</th>
              <th>Date</th>
              <th>Result</th>
              <th>Equivalent</th>
            </tr>
          </thead>
          <tbody>
            ${grades.filter(g => g.subject === subject)
              .map(g => `
                <tr>
                  <td>${esc(g.type)}</td>
                  <td>${esc(g.mock)}</td>
                  <td>${esc(formatDate(g.date))}</td>
                  <td>${esc(resultText(g))}</td>
                  <td>${esc(g.equivalent || "—")}</td>
                </tr>
              `).join("")}
          </tbody>
        </table>
      `).join("") ||
        "<p>N/A — No assessment results recorded for this period.</p>"}

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
      if (img.naturalWidth === 0)
        return Promise.reject(
          new Error("Report logo could not load.")
        );

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
  let filters;

  try {
    filters = reportFilters();
  } catch (error) {
    notifyError(error);
    return;
  }

  const students = ids
    .map(id => db.students.find(s => s.id === id))
    .filter(Boolean);

  if (!students.length) {
    alert("No students selected.");
    return;
  }

  if (!window.html2canvas || !window.jspdf?.jsPDF) {
    alert("PDF libraries are not loaded.");
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

    container = document.createElement("div");

    Object.assign(container.style, {
      position: "absolute",
      left: "0",
      top: "0",
      width: "794px",
      background: "#ffffff",
      opacity: "1",
      pointerEvents: "none",
      zIndex: "-1"
    });

    document.body.appendChild(container);

    for (let i = 0; i < students.length; i++) {
      container.innerHTML = reportHTML(students[i], filters);

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

      if (document.fonts?.ready)
        await document.fonts.ready;

      const canvas = await html2canvas(report, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        windowWidth: 1100,
        scrollX: 0,
        scrollY: 0
      });

      const imageData = canvas.toDataURL("image/jpeg", 0.92);
      const imageHeight =
        canvas.height * usableWidth / canvas.width;

      if (i > 0) pdf.addPage();

      let renderedHeight = 0;

      while (renderedHeight < imageHeight) {
        if (renderedHeight > 0) pdf.addPage();

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
    notifyError(error);
  } finally {
    if (container) container.remove();

    if (originalText !== null) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}
