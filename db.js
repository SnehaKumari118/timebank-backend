require("dotenv").config();
const mysql = require("mysql2");
const fs = require("fs");

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    ca: fs.readFileSync(process.env.CA)
  }
});

// Optional test
db.getConnection((err, connection) => {
  if (err) {
    console.error("MySQL Pool Error:", err);
  } else {
    console.log("Connected to MYSQL (Pool)");
    connection.release();
  }
});

module.exports = db;
