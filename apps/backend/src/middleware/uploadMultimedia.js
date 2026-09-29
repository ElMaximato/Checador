const fs = require("fs");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

// Va dentro de backend/uploads/, que app.js ya sirve en /uploads.
const DIR_MULTIMEDIA = path.join(__dirname, "..", "..", "uploads", "multimedia");
fs.mkdirSync(DIR_MULTIMEDIA, { recursive: true });

const MAX_MB = Number(process.env.MULTIMEDIA_MAX_MB) > 0 ? Number(process.env.MULTIMEDIA_MAX_MB) : 100;

const TIPO_POR_MIME = { image: "imagen", video: "video", audio: "musica" };
const tipoDesdeMime = (mime) => TIPO_POR_MIME[String(mime).split("/")[0]] || null;

const uploadMultimedia = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, DIR_MULTIMEDIA),
    filename: (req, file, cb) => {
      // La extensión se limita a caracteres seguros; el nombre real es el uuid.
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 8);
      cb(null, `${Date.now()}-${uuidv4()}${ext}`);
    },
  }),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (tipoDesdeMime(file.mimetype)) return cb(null, true);
    cb(Object.assign(new Error("Solo se aceptan imágenes, videos o música"), { status: 400 }));
  },
}).single("archivo");

module.exports = { uploadMultimedia, tipoDesdeMime, DIR_MULTIMEDIA, MAX_MB };
