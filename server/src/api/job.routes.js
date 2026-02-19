const express = require("express");
const pool = require("../config/db");

const router = express.Router();

// ============ JOB CRUD ============

router.post("/job", async (req, res) => {
  try {
    const { task, scheduled_at } = req.body;

    if (!scheduled_at) {
      return res.status(400).json({ error: "scheduled_at required" });
    }

    const result = await pool.query(
      `INSERT INTO jobs (task, scheduled_at)
       VALUES ($1, $2)
       RETURNING *`,
      [task, scheduled_at],
    );

    res.json({
      message: "Job scheduled successfully",
      job: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error creating job" });
  }
});

// Jobs with search, filter, pagination
router.get("/jobs", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      taskType,
      search,
      startDate,
      endDate,
    } = req.query;

    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Filter by status
    if (status && status !== "all") {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    // Filter by task type
    if (taskType && taskType !== "all") {
      conditions.push(`task->>'type' = $${paramIndex++}`);
      params.push(taskType);
    }

    // Search in task data
    if (search) {
      conditions.push(`task::text ILIKE $${paramIndex++}`);
      params.push(`%${search}%`);
    }

    // Filter by date range
    if (startDate) {
      conditions.push(`scheduled_at >= $${paramIndex++}`);
      params.push(startDate);
    }
    if (endDate) {
      conditions.push(`scheduled_at <= $${paramIndex++}`);
      params.push(endDate);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM jobs ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    const result = await pool.query(
      `SELECT * FROM jobs ${whereClause} 
       ORDER BY id DESC 
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, parseInt(limit), parseInt(offset)],
    );

    res.json({
      jobs: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching jobs" });
  }
});

// ============ JOB STATISTICS ============

router.get("/stats", async (req, res) => {
  try {
    // Status counts
    const statusResult = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM jobs 
      GROUP BY status
    `);

    // Task type counts
    const taskTypeResult = await pool.query(`
      SELECT task->>'type' as type, COUNT(*) as count 
      FROM jobs 
      GROUP BY task->>'type'
    `);

    // Jobs per day (last 7 days)
    const dailyResult = await pool.query(`
      SELECT DATE(scheduled_at) as date, COUNT(*) as count
      FROM jobs
      WHERE scheduled_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(scheduled_at)
      ORDER BY date DESC
    `);

    // Average execution time (for completed jobs)
    const avgTimeResult = await pool.query(`
      SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_seconds
      FROM jobs
      WHERE status = 'completed' AND started_at IS NOT NULL AND completed_at IS NOT NULL
    `);

    // Recent activity
    const recentResult = await pool.query(`
      SELECT COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour') as last_hour,
             COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as last_24h,
             COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as last_7d
      FROM jobs
    `);

    const statusCounts = {};
    statusResult.rows.forEach((row) => {
      statusCounts[row.status] = parseInt(row.count);
    });

    const taskTypeCounts = {};
    taskTypeResult.rows.forEach((row) => {
      taskTypeCounts[row.type] = parseInt(row.count);
    });

    res.json({
      statusCounts,
      taskTypeCounts,
      dailyJobs: dailyResult.rows,
      avgExecutionTime: avgTimeResult.rows[0]?.avg_seconds || 0,
      recentActivity: recentResult.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching stats" });
  }
});

// ============ EXPORT TO CSV ============

router.get("/jobs/export", async (req, res) => {
  try {
    const { status, taskType, startDate, endDate } = req.query;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (status && status !== "all") {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }
    if (taskType && taskType !== "all") {
      conditions.push(`task->>'type' = $${paramIndex++}`);
      params.push(taskType);
    }
    if (startDate) {
      conditions.push(`scheduled_at >= $${paramIndex++}`);
      params.push(startDate);
    }
    if (endDate) {
      conditions.push(`scheduled_at <= $${paramIndex++}`);
      params.push(endDate);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT * FROM jobs ${whereClause} ORDER BY id DESC`,
      params,
    );

    // Generate CSV
    const headers = [
      "id",
      "task_type",
      "task_data",
      "status",
      "scheduled_at",
      "picked_at",
      "started_at",
      "completed_at",
    ];
    const csvRows = [headers.join(",")];

    result.rows.forEach((job) => {
      const row = [
        job.id,
        `"${job.task?.type || ""}"`,
        `"${JSON.stringify(job.task?.data || {}).replace(/"/g, '""')}"`,
        job.status,
        job.scheduled_at || "",
        job.picked_at || "",
        job.started_at || "",
        job.completed_at || "",
      ];
      csvRows.push(row.join(","));
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=jobs_export.csv",
    );
    res.send(csvRows.join("\n"));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error exporting jobs" });
  }
});

// ============ DUPLICATE JOB ============

router.post("/duplicate/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduled_at } = req.body;

    // Get original job
    const original = await pool.query("SELECT * FROM jobs WHERE id = $1", [id]);

    if (original.rows.length === 0) {
      return res.status(404).json({ error: "Job not found" });
    }

    const job = original.rows[0];
    const newScheduledAt =
      scheduled_at || new Date(Date.now() + 60000).toISOString();

    // Create duplicate
    const result = await pool.query(
      `INSERT INTO jobs (task, scheduled_at)
       VALUES ($1, $2)
       RETURNING *`,
      [job.task, newScheduledAt],
    );

    res.json({
      message: "Job duplicated successfully",
      job: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error duplicating job" });
  }
});

// ============ BULK OPERATIONS ============

router.post("/bulk/cancel", async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids array required" });
    }

    const result = await pool.query(
      `UPDATE jobs SET status = 'cancelled'
       WHERE id = ANY($1) AND status IN ('pending', 'picked')
       RETURNING id`,
      [ids],
    );

    res.json({
      message: `${result.rowCount} jobs cancelled`,
      cancelledIds: result.rows.map((r) => r.id),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error cancelling jobs" });
  }
});

router.post("/bulk/retry", async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids array required" });
    }

    const result = await pool.query(
      `UPDATE jobs 
       SET status = 'pending',
           picked_at = NULL,
           started_at = NULL,
           completed_at = NULL
       WHERE id = ANY($1) AND status IN ('failed', 'cancelled')
       RETURNING id`,
      [ids],
    );

    res.json({
      message: `${result.rowCount} jobs retried`,
      retriedIds: result.rows.map((r) => r.id),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error retrying jobs" });
  }
});

// ============ JOB TEMPLATES ============

router.get("/templates", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM job_templates ORDER BY name ASC",
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching templates" });
  }
});

router.post("/templates", async (req, res) => {
  try {
    const { name, task } = req.body;

    if (!name || !task) {
      return res.status(400).json({ error: "name and task required" });
    }

    const result = await pool.query(
      `INSERT INTO job_templates (name, task)
       VALUES ($1, $2)
       RETURNING *`,
      [name, task],
    );

    res.json({
      message: "Template created successfully",
      template: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error creating template" });
  }
});

router.delete("/templates/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM job_templates WHERE id = $1", [id]);
    res.json({ message: "Template deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error deleting template" });
  }
});

router.post("/templates/:id/use", async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduled_at } = req.body;

    if (!scheduled_at) {
      return res.status(400).json({ error: "scheduled_at required" });
    }

    const template = await pool.query(
      "SELECT * FROM job_templates WHERE id = $1",
      [id],
    );

    if (template.rows.length === 0) {
      return res.status(404).json({ error: "Template not found" });
    }

    const result = await pool.query(
      `INSERT INTO jobs (task, scheduled_at)
       VALUES ($1, $2)
       RETURNING *`,
      [template.rows[0].task, scheduled_at],
    );

    res.json({
      message: "Job created from template",
      job: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error creating job from template" });
  }
});

// ============ SINGLE JOB ACTIONS ============

router.post("/retry/:id", async (req, res) => {
  const { id } = req.params;

  await pool.query(
    `
    UPDATE jobs
    SET status = 'pending',
        picked_at = NULL,
        started_at = NULL,
        completed_at = NULL
    WHERE id = $1
  `,
    [id],
  );

  res.send("Job retried");
});

router.post("/cancel/:id", async (req, res) => {
  const { id } = req.params;

  await pool.query(
    `
    UPDATE jobs SET status = 'cancelled'
    WHERE id = $1
  `,
    [id],
  );

  res.send("Cancelled");
});

module.exports = router;
