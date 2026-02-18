
const { Pool } = require("pg");

const pool = new Pool({
  user: "vipulkumar",
  host: "localhost",
  database: "scheduler",
  password: "password",
  port: 5432,
});

module.exports = pool;
