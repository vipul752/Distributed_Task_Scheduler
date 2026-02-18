// Set default schedule time to current time + 2 minutes
const now = new Date();
now.setMinutes(now.getMinutes() + 2);

// Format for datetime-local input (YYYY-MM-DDTHH:mm in local time)
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, "0");
const day = String(now.getDate()).padStart(2, "0");
const hours = String(now.getHours()).padStart(2, "0");
const minutes = String(now.getMinutes()).padStart(2, "0");
document.getElementById("scheduleTime").value =
  `${year}-${month}-${day}T${hours}:${minutes}`;

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
            <td>${formatIST(job.picked_at)}</td>
            <td>${formatIST(job.started_at)}</td>
            <td>${formatIST(job.completed_at)}</td>
            <td>${job.status}</td>
        `;
    tableBody.appendChild(row);
  });
}

loadJobs();
