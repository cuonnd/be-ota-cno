const multer = require("multer");
const { S3Client } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const path = require("path");
require("dotenv").config();

// S3Client cho DigitalOcean Spaces
const s3Client = new S3Client({
  endpoint: `https://${process.env.DO_SPACES_ENDPOINT}`,
  region: "sfo3",
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET,
  },
  forcePathStyle: false,
});

// Multer lưu file vào RAM
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = [".apk", ".ipa", ".zip", ".jsbundle", ".bundle"];
    allowed.includes(ext)
      ? cb(null, true)
      : cb(new Error(`Invalid file type: ${ext}`), false);
  },
  limits: { fileSize: 1024 * 1024 * 500 }, // 500MB
});

// Hàm upload file lên DO Spaces
async function uploadToSpaces(file, projectId) {
  const safeName = path.basename(
    Buffer.from(file.originalname, "latin1").toString("utf8")
  ).replace(/[^\w\-\.]/g, "_");

  const key = `ota-cno/${projectId || "general"}/${Date.now()}-${safeName}`;
  console.log(3333, key);
  
  const parallelUpload = new Upload({
    client: s3Client,
    params: {
      Bucket: process.env.DO_SPACES_BUCKET,
      Key: key,
      Body: file.buffer,
      ACL: "public-read",
      ContentType: file.mimetype,
    },
  });

  await parallelUpload.done();

  const url = `https://${process.env.DO_SPACES_BUCKET}.${process.env.DO_SPACES_ENDPOINT}/${key}`;
  return { key, url };
}

module.exports = { upload, uploadToSpaces };
