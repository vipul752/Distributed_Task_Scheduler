const express = require("express");
const pool = require("../config/db");

const router = express.Router();

router.post("/job", async (req, res) => {
  try {
    const { task, scheduled_at } = req.body;

    const result = await pool.query(
      `INSERT INTO jobs (task, scheduled_at) VALUES ($1, $2) RETURNING *`,
      [task, scheduled_at],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
