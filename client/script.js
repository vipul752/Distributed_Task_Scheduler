const API_BASE = "http://localhost:3000/api";

// State
let currentPage = 1;
let totalPages = 1;
let selectedJobIds = new Set();

// Initialize
const now = new Date();
now.setMinutes(now.getMinutes() + 2);

const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, "0");
const day = String(now.getDate()).padStart(2, "0");
const hours = String(now.getHours()).padStart(2, "0");
const minutes = String(now.getMinutes()).padStart(2, "0");
document.getElementById("scheduleTime").value =
  `${year}-${month}-${day}T${hours}:${minutes}`;

// ============ TABS ============

function showTab(tabName) {
  document
    .querySelectorAll(".tab-content")
    .forEach((tab) => tab.classList.remove("active"));
  document
    .querySelectorAll(".tab-btn")
    .forEach((btn) => btn.classList.remove("active"));

  document.getElementById(`${tabName}-tab`).classList.add("active");
  event.target.classList.add("active");

  if (tabName === "stats") loadStats();
  if (tabName === "templates") loadTemplates();
}

// ============ HELPERS ============

function getColor(status) {
  if (status === "completed") return "green";
  if (status === "running") return "orange";
  if (status === "failed") return "red";
  if (status === "cancelled") return "gray";
  return "blue";
}

function getCountdown(scheduledAt, status) {
  if (status !== "pending") return "-";
  const remaining = new Date(scheduledAt) - new Date();
  if (remaining <= 0) return "Due";
  const seconds = Math.floor(remaining / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

function formatIST(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
  });
}

// ============ JOB ACTIONS ============

async function retryJob(id) {
  await fetch(`${API_BASE}/retry/${id}`, { method: "POST" });
  loadJobs();
}

async function cancelJob(id) {
  await fetch(`${API_BASE}/cancel/${id}`, { method: "POST" });
  loadJobs();
}

async function duplicateJob(id) {
  const scheduledAt = prompt("Schedule time (leave empty for +1 minute):");
  const body = scheduledAt ? { scheduled_at: scheduledAt } : {};

  await fetch(`${API_BASE}/duplicate/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  alert("Job duplicated!");
  loadJobs();
}

// ============ CREATE JOB ============

function buildTask() {
  const type = document.getElementById("taskType").value;
  const input1 = document.getElementById("input1").value;
  const input2 = document.getElementById("input2").value;
  const input3 = document.getElementById("input3").value;

  if (type === "create_folder") {
    return { type, data: { path: input1 } };
  }
  if (type === "write_file") {
    return { type, data: { path: input1, content: input2 } };
  }
  if (type === "send_email") {
    return { type, data: { to: input1, subject: input2, message: input3 } };
  }
  if (type === "http_request") {
    return {
      type,
      data: {
        url: input1,
        method: input2 || "GET",
        headers: input3 ? JSON.parse(input3) : {},
      },
    };
  }
  if (type === "run_script") {
    return {
      type,
      data: {
        command: input1,
        cwd: input2 || undefined,
        timeout: input3 ? parseInt(input3) : 30000,
      },
    };
  }
  return null;
}

function updatePlaceholders() {
  const type = document.getElementById("taskType").value;
  const input1 = document.getElementById("input1");
  const input2 = document.getElementById("input2");
  const input3 = document.getElementById("input3");
  const label1 = document.getElementById("label1");
  const label2 = document.getElementById("label2");
  const label3 = document.getElementById("label3");
  const group2 = document.getElementById("inputGroup2");
  const group3 = document.getElementById("inputGroup3");

  // Reset visibility
  group2.style.display = "block";
  group3.style.display = "block";

  switch (type) {
    case "create_folder":
      label1.textContent = "📁 Folder Path";
      input1.placeholder = "e.g., /tmp/my-folder";
      group2.style.display = "none";
      group3.style.display = "none";
      break;
    case "write_file":
      label1.textContent = "📄 File Path";
      input1.placeholder = "e.g., /tmp/hello.txt";
      label2.textContent = "📝 Content";
      input2.placeholder = "File content to write...";
      group3.style.display = "none";
      break;
    case "send_email":
      label1.textContent = "📧 Email Address";
      input1.placeholder = "recipient@example.com";
      label2.textContent = "📋 Subject";
      input2.placeholder = "Email subject";
      label3.textContent = "💬 Message";
      input3.placeholder = "Email body message...";
      break;
    case "http_request":
      label1.textContent = "🔗 URL";
      input1.placeholder = "https://api.example.com/endpoint";
      label2.textContent = "📤 Method";
      input2.placeholder = "GET, POST, PUT, DELETE";
      label3.textContent = "📋 Headers (JSON)";
      input3.placeholder = '{"Authorization": "Bearer token"}';
      break;
    case "run_script":
      label1.textContent = "💻 Command";
      input1.placeholder = "ls -la && echo 'done'";
      label2.textContent = "📂 Working Directory";
      input2.placeholder = "/home/user (optional)";
      label3.textContent = "⏱️ Timeout (ms)";
      input3.placeholder = "30000";
      break;
  }
}

function selectTaskType(type) {
  // Update hidden input
  document.getElementById("taskType").value = type;

  // Update card styles
  document.querySelectorAll(".task-card").forEach((card) => {
    card.classList.remove("active");
    if (card.dataset.type === type) {
      card.classList.add("active");
    }
  });

  // Clear inputs and update placeholders
  document.getElementById("input1").value = "";
  document.getElementById("input2").value = "";
  document.getElementById("input3").value = "";
  updatePlaceholders();
}

function quickSchedule(minutesFromNow) {
  const date = new Date();
  date.setMinutes(date.getMinutes() + minutesFromNow);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const mins = String(date.getMinutes()).padStart(2, "0");

  document.getElementById("scheduleTime").value =
    `${year}-${month}-${day}T${hours}:${mins}`;
}

function clearForm() {
  document.getElementById("input1").value = "";
  document.getElementById("input2").value = "";
  document.getElementById("input3").value = "";
  selectTaskType("create_folder");
  quickSchedule(2);
}

async function createJob() {
  const scheduleTime = document.getElementById("scheduleTime").value;
  if (!scheduleTime) {
    alert("Please select schedule time");
    return;
  }

  const task = buildTask();
  const scheduled_at = scheduleTime + ":00";

  await fetch(`${API_BASE}/job`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task, scheduled_at }),
  });

  alert("Job scheduled!");
  loadJobs();
}

// ============ LOAD JOBS WITH FILTERS & PAGINATION ============

async function loadJobs() {
  const search = document.getElementById("searchInput").value;
  const status = document.getElementById("statusFilter").value;
  const taskType = document.getElementById("taskTypeFilter").value;
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;
  const limit = document.getElementById("limitSelect").value;

  const params = new URLSearchParams({
    page: currentPage,
    limit,
    ...(search && { search }),
    ...(status !== "all" && { status }),
    ...(taskType !== "all" && { taskType }),
    ...(startDate && { startDate }),
    ...(endDate && { endDate }),
  });

  const res = await fetch(`${API_BASE}/jobs?${params}`);
  const data = await res.json();

  totalPages = data.pagination.totalPages || 1;
  updatePaginationUI();

  const tableBody = document.getElementById("jobsTableBody");
  tableBody.innerHTML = "";

  data.jobs.forEach((job) => {
    const isSelected = selectedJobIds.has(job.id);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><input type="checkbox" class="job-checkbox" data-id="${job.id}" ${isSelected ? "checked" : ""} onchange="toggleJobSelection(${job.id})" /></td>
      <td>${job.id}</td>
      <td>${job.task.type}</td>
      <td>${formatIST(job.scheduled_at)}</td>
      <td>${getCountdown(job.scheduled_at, job.status)}</td>
      <td>${formatIST(job.picked_at)}</td>
      <td>${formatIST(job.started_at)}</td>
      <td>${formatIST(job.completed_at)}</td>
      <td style="color:${getColor(job.status)}">${job.status}</td>
      <td>
        <button onclick="duplicateJob(${job.id})" class="small">Duplicate</button>
        ${job.status === "failed" ? `<button onclick="retryJob(${job.id})" class="small">Retry</button>` : ""}
        ${job.status === "pending" ? `<button onclick="cancelJob(${job.id})" class="small danger">Cancel</button>` : ""}
      </td>
    `;
    tableBody.appendChild(row);
  });
}

function updatePaginationUI() {
  const pageInfo = `Page ${currentPage} of ${totalPages}`;
  document.getElementById("pageInfo").textContent = pageInfo;
  document.getElementById("pageInfo2").textContent = pageInfo;

  const prevDisabled = currentPage <= 1;
  const nextDisabled = currentPage >= totalPages;

  document.getElementById("prevBtn").disabled = prevDisabled;
  document.getElementById("prevBtn2").disabled = prevDisabled;
  document.getElementById("nextBtn").disabled = nextDisabled;
  document.getElementById("nextBtn2").disabled = nextDisabled;
}

function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    loadJobs();
  }
}

function nextPage() {
  if (currentPage < totalPages) {
    currentPage++;
    loadJobs();
  }
}

function clearFilters() {
  document.getElementById("searchInput").value = "";
  document.getElementById("statusFilter").value = "all";
  document.getElementById("taskTypeFilter").value = "all";
  document.getElementById("startDate").value = "";
  document.getElementById("endDate").value = "";
  currentPage = 1;
  loadJobs();
}

// ============ BULK OPERATIONS ============

function toggleJobSelection(id) {
  if (selectedJobIds.has(id)) {
    selectedJobIds.delete(id);
  } else {
    selectedJobIds.add(id);
  }
}

function toggleSelectAll() {
  const checkboxes = document.querySelectorAll(".job-checkbox");
  const selectAllChecked = document.getElementById("selectAllCheckbox").checked;

  checkboxes.forEach((cb) => {
    cb.checked = selectAllChecked;
    const id = parseInt(cb.dataset.id);
    if (selectAllChecked) {
      selectedJobIds.add(id);
    } else {
      selectedJobIds.delete(id);
    }
  });
}

function selectAll() {
  document.getElementById("selectAllCheckbox").checked = true;
  toggleSelectAll();
}

function deselectAll() {
  document.getElementById("selectAllCheckbox").checked = false;
  toggleSelectAll();
  selectedJobIds.clear();
}

async function bulkCancel() {
  if (selectedJobIds.size === 0) {
    alert("No jobs selected");
    return;
  }

  const ids = Array.from(selectedJobIds);
  const res = await fetch(`${API_BASE}/bulk/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });

  const data = await res.json();
  alert(data.message);
  selectedJobIds.clear();
  loadJobs();
}

async function bulkRetry() {
  if (selectedJobIds.size === 0) {
    alert("No jobs selected");
    return;
  }

  const ids = Array.from(selectedJobIds);
  const res = await fetch(`${API_BASE}/bulk/retry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });

  const data = await res.json();
  alert(data.message);
  selectedJobIds.clear();
  loadJobs();
}

// ============ EXPORT CSV ============

function exportCSV() {
  const status = document.getElementById("statusFilter").value;
  const taskType = document.getElementById("taskTypeFilter").value;
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;

  const params = new URLSearchParams({
    ...(status !== "all" && { status }),
    ...(taskType !== "all" && { taskType }),
    ...(startDate && { startDate }),
    ...(endDate && { endDate }),
  });

  window.location.href = `${API_BASE}/jobs/export?${params}`;
}

// ============ STATISTICS ============

async function loadStats() {
  const res = await fetch(`${API_BASE}/stats`);
  const stats = await res.json();

  // Status Distribution
  let statusHtml = "<ul>";
  for (const [status, count] of Object.entries(stats.statusCounts)) {
    statusHtml += `<li><span style="color:${getColor(status)}">${status}</span>: ${count}</li>`;
  }
  statusHtml += "</ul>";
  document.getElementById("statusStats").innerHTML = statusHtml;

  // Task Types
  let taskHtml = "<ul>";
  for (const [type, count] of Object.entries(stats.taskTypeCounts)) {
    taskHtml += `<li>${type}: ${count}</li>`;
  }
  taskHtml += "</ul>";
  document.getElementById("taskTypeStats").innerHTML = taskHtml;

  // Recent Activity
  const recent = stats.recentActivity;
  document.getElementById("recentStats").innerHTML = `
    <ul>
      <li>Last Hour: ${recent.last_hour}</li>
      <li>Last 24 Hours: ${recent.last_24h}</li>
      <li>Last 7 Days: ${recent.last_7d}</li>
    </ul>
  `;

  // Performance
  const avgTime = stats.avgExecutionTime
    ? stats.avgExecutionTime.toFixed(2)
    : 0;
  document.getElementById("perfStats").innerHTML = `
    <ul>
      <li>Avg Execution Time: ${avgTime}s</li>
    </ul>
  `;

  // Daily Jobs
  let dailyHtml = "<table><tr><th>Date</th><th>Jobs</th></tr>";
  stats.dailyJobs.forEach((day) => {
    dailyHtml += `<tr><td>${day.date}</td><td>${day.count}</td></tr>`;
  });
  dailyHtml += "</table>";
  document.getElementById("dailyStats").innerHTML = dailyHtml;
}

// ============ TEMPLATES ============

async function loadTemplates() {
  const res = await fetch(`${API_BASE}/templates`);
  const templates = await res.json();

  const tableBody = document.getElementById("templatesTableBody");
  tableBody.innerHTML = "";

  templates.forEach((template) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${template.id}</td>
      <td>${template.name}</td>
      <td>${template.task.type}</td>
      <td>${JSON.stringify(template.task.data)}</td>
      <td>
        <button onclick="useTemplate(${template.id})" class="small">Use</button>
        <button onclick="deleteTemplate(${template.id})" class="small danger">Delete</button>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

function saveAsTemplate() {
  document.getElementById("templateModal").style.display = "flex";
}

function closeModal() {
  document.getElementById("templateModal").style.display = "none";
  document.getElementById("templateName").value = "";
}

async function confirmSaveTemplate() {
  const name = document.getElementById("templateName").value;
  if (!name) {
    alert("Please enter a template name");
    return;
  }

  const task = buildTask();

  await fetch(`${API_BASE}/templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, task }),
  });

  alert("Template saved!");
  closeModal();
}

function useTemplate(id) {
  document.getElementById("selectedTemplateId").value = id;

  const now = new Date();
  now.setMinutes(now.getMinutes() + 2);
  const formatted = now.toISOString().slice(0, 16);
  document.getElementById("templateScheduleTime").value = formatted;

  document.getElementById("useTemplateModal").style.display = "flex";
}

function closeUseTemplateModal() {
  document.getElementById("useTemplateModal").style.display = "none";
}

async function confirmUseTemplate() {
  const id = document.getElementById("selectedTemplateId").value;
  const scheduled_at =
    document.getElementById("templateScheduleTime").value + ":00";

  await fetch(`${API_BASE}/templates/${id}/use`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scheduled_at }),
  });

  alert("Job created from template!");
  closeUseTemplateModal();
  showTab("jobs");
  loadJobs();
}

async function deleteTemplate(id) {
  if (!confirm("Delete this template?")) return;

  await fetch(`${API_BASE}/templates/${id}`, { method: "DELETE" });
  loadTemplates();
}

// ============ INIT ============

updatePlaceholders();
loadJobs();
setInterval(loadJobs, 5000);
