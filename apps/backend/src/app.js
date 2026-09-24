const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth.routes");
const attendanceRoutes = require("./routes/attendance.routes");
const meRoutes = require("./routes/me.routes");

const app = express();

app.use(cors());
app.use(express.json());

// Fotos servidas estáticamente (en producción: bucket S3-compatible)
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/me", meRoutes);

module.exports = app;
