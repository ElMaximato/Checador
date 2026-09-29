const express = require("express");
const { corsHttp, bloquearOrigenNoPermitido } = require("./config/cors");
const path = require("path");

const authRoutes = require("./routes/auth.routes");
const attendanceRoutes = require("./routes/attendance.routes");
const meRoutes = require("./routes/me.routes");
const adminRoutes = require("./routes/admin.routes");
const tvDeviceRoutes = require("./routes/tvDevice.routes");

const app = express();

app.use(bloquearOrigenNoPermitido);
app.use(corsHttp);
app.use(express.json());

// Fotos servidas estáticamente (en producción: bucket S3-compatible)
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// App de TV (HTML/JS sin build). Se abre en el navegador de la pantalla: http://<servidor>:4000/tv/
app.use("/tv", express.static(path.join(__dirname, "..", "..", "tv")));

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/me", meRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/tv", tvDeviceRoutes);

module.exports = app;
