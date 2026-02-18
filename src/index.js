const express = require("express");
const jobRoutes = require("./api/job.routes");

const app = express();
app.use(express.json());

app.use("/api", jobRoutes);

app.get("/", (req, res) => {
  res.send("Task Scheduler Running 🚀");
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
