const express = require("express");
const pool = require("../config/db");

const router = express.Router();

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

router.get("/jobs", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM jobs ORDER BY id DESC LIMIT 50",
  );
  res.json(result.rows);
});

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
