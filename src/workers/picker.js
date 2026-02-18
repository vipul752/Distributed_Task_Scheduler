const pool = require("../config/db");
const queue = require("../config/queue");

async function pickJobs() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const res = await client.query(
      `
            UPDATE jobs
            SET picked_at = NOW(),
                status = 'picked'   
            WHERE id IN (
                SELECT id FROM jobs
                WHERE scheduled_at <= NOW()
                AND picked_at IS NULL
                ORDER BY scheduled_at ASC
                LIMIT 10
                FOR UPDATE SKIP LOCKED
            )
            RETURNING *
        `,
    );

    await client.query("COMMIT");

    for (const job of res.rows) {
      await queue.add("job", job, {
        jobId: job.id,
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
      });
    }
    if (res.rowCount > 0) {
      console.log(`Picked ${res.rowCount} jobs`);
    }
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

setInterval(pickJobs, 2000);

console.log("Picking Start ......");
