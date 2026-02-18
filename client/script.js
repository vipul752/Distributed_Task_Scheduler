const now = new Date();
now.setMinutes(now.getMinutes() + 2);

const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, "0");
const day = String(now.getDate()).padStart(2, "0");
const hours = String(now.getHours()).padStart(2, "0");
const minutes = String(now.getMinutes()).padStart(2, "0");
document.getElementById("scheduleTime").value =
  `${year}-${month}-${day}T${hours}:${minutes}`;

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

async function retryJob(id) {
  await fetch(`http://localhost:3000/api/retry/${id}`, { method: "POST" });
  loadJobs();
}

async function cancelJob(id) {
  await fetch(`http://localhost:3000/api/cancel/${id}`, { method: "POST" });
  loadJobs();
}

async function createJob() {
  const type = document.getElementById("taskType").value;
  const input1 = document.getElementById("input1").value;
  const input2 = document.getElementById("input2").value;
  const input3 = document.getElementById("input3").value;
  const scheduleTime = document.getElementById("scheduleTime").value;

  if (!scheduleTime) {
    alert("Please select schedule time");
    return;
  }

  let task;

  if (type === "create_folder") {
    task = {
      type,
      data: { path: input1 },
    };
  }

  if (type === "write_file") {
    task = {
      type,
      data: {
        path: input1,
        content: input2,
      },
    };
  }

  if (type === "send_email") {
    task = {
      type,
      data: {
        to: input1,
        subject: input2,
        message: input3,
      },
    };
  }

  // Send local time directly (PostgreSQL stores without timezone)
  const scheduled_at = scheduleTime + ":00";

  await fetch("http://localhost:3000/api/job", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      task,
      scheduled_at,
    }),
  });

  alert("Job scheduled!");
  loadJobs();
}

// Format date to IST
function formatIST(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
  });
}

async function loadJobs() {
  const res = await fetch("http://localhost:3000/api/jobs");
  const jobs = await res.json();

  const tableBody = document.getElementById("jobsTableBody");
  tableBody.innerHTML = "";
  jobs.forEach((job) => {
    const row = document.createElement("tr");
    row.innerHTML = `
            <td>${job.id}</td>
            <td>${job.task.type}</td>
            <td>${formatIST(job.scheduled_at)}</td>
            <td>${getCountdown(job.scheduled_at, job.status)}</td>
            <td>${formatIST(job.picked_at)}</td>
            <td>${formatIST(job.started_at)}</td>
            <td>${formatIST(job.completed_at)}</td>
            <td style="color:${getColor(job.status)}">${job.status}</td>
            <td>
              ${job.status === "failed" ? `<button onclick="retryJob(${job.id})">Retry</button>` : ""}
              ${job.status === "pending" ? `<button onclick="cancelJob(${job.id})">Cancel</button>` : ""}
            </td>
        `;
    tableBody.appendChild(row);
  });
}

loadJobs();

setInterval(loadJobs, 5000);
