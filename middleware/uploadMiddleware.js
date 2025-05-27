
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const tempUploadsPath = path.join(__dirname, '../uploads_temp');
    await fs.ensureDir(tempUploadsPath);
    cb(null, tempUploadsPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Buffer.from(file.originalname, 'latin1').toString('utf8')); // Handle special characters in filename
  }
});

// File filter to accept APK, IPA, ZIP, and JSBUNDLE files
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.apk', '.ipa', '.zip', '.jsbundle'];
  // Check fieldname to apply different rules if needed in future, e.g. different mimetypes for different fields
  // const fieldName = file.fieldname; 

  const extname = path.extname(file.originalname).toLowerCase();
  if (allowedExtensions.includes(extname)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Only ${allowedExtensions.join(', ')} files are allowed. Detected: ${extname}`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 500 // 500 MB limit
  }
});

module.exports = upload;