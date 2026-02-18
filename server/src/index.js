const express = require("express");
const cors = require("cors");
const jobRoutes = require("./api/job.routes");
const setupBullBoard = require("./bullBoard");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "../../client")));

app.use("/api", jobRoutes);
setupBullBoard(app);

app.get("/", (req, res) => {
  res.send("Task Scheduler Running 🚀");
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
