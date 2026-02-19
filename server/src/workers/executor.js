// src/workers/executor.js
const { Worker } = require("bullmq");
const pool = require("../config/db");
const fs = require("fs");
const nodemailer = require("nodemailer");
const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);

console.log("Executor started....");

async function executeTask(task) {
  const { type, data } = task;

  switch (type) {
    case "create_folder":
      if (!fs.existsSync(data.path)) {
        fs.mkdirSync(data.path);
        console.log("📁 Folder created:", data.path);
      }
      break;

    case "write_file":
      fs.writeFileSync(data.path, data.content);
      console.log("📄 File written:", data.path);
      break;

    case "send_email":
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: "vipulvipul65845@gmail.com",
          pass: "tiih ferm gqen nasv",
        },
      });

      await transporter.sendMail({
        from: "vipulvipul65845@gmail.com",
        to: data.to,
        subject: data.subject,
        text: data.message,
      });

      console.log("📧 Email sent to:", data.to);
      break;

    case "http_request":
      const response = await fetch(data.url, {
        method: data.method || "GET",
        headers: data.headers || {},
        body: data.body ? JSON.stringify(data.body) : undefined,
      });
      const responseData = await response.text();
      console.log(
        `🌐 HTTP ${data.method || "GET"} ${data.url} - Status: ${response.status}`,
      );
      console.log("📥 Response:", responseData.substring(0, 200));
      if (!response.ok) {
        throw new Error(`HTTP request failed with status ${response.status}`);
      }
      break;

    case "run_script":
      const { stdout, stderr } = await execPromise(data.command, {
        cwd: data.cwd || process.cwd(),
        timeout: data.timeout || 30000,
        maxBuffer: 1024 * 1024,
      });
      console.log("💻 Script executed:", data.command);
      if (stdout) console.log("📤 Output:", stdout.substring(0, 500));
      if (stderr) console.log("⚠️ Stderr:", stderr.substring(0, 500));
      break;

    default:
      console.log("Unknown task:", type);
  }
}

const worker = new Worker(
  "jobs",
  async (job) => {
    const dbJob = job.data;

    console.log("🚀 Start job:", dbJob.id);

    await pool.query(
      "UPDATE jobs SET started_at = NOW(), status = 'running' WHERE id = $1",
      [dbJob.id],
    );

    try {
      await executeTask(dbJob.task);

      await pool.query(
        "UPDATE jobs SET completed_at = NOW(), status = 'completed' WHERE id = $1",
        [dbJob.id],
      );

      console.log("✅ Completed job:", dbJob.id);
    } catch (err) {
      console.error("❌ Failed job:", dbJob.id);

      await pool.query("UPDATE jobs SET status = 'failed' WHERE id = $1", [
        dbJob.id,
      ]);

      throw err;
    }
  },
  {
    connection: { host: "127.0.0.1", port: 6379 },
  },
);
