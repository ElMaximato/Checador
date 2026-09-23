const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, process.env.UPLOADS_DIR || "./uploads/asistencia"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${Date.now()}-${uuidv4()}${ext}`);
  },
});

const uploadFoto = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Solo se aceptan imágenes"));
    cb(null, true);
  },
});

module.exports = { uploadFoto };
