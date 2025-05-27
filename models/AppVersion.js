
const mongoose = require('mongoose');

const AppVersionSchema = new mongoose.Schema({
  platform: {
    type: String,
    enum: ['Android', 'iOS'],
    required: true,
  },
  versionName: {
    type: String,
    required: true,
  },
  buildNumber: {
    type: String,
    required: true,
  },
  fileName: { // Original name of the uploaded file
    type: String,
    required: true,
  },
  fileSize: { // File size in a human-readable format e.g., "50.2 MB"
    type: String,
    required: true,
  },
  filePath: { // Path on the server where the file is stored
    type: String,
    required: true,
  },
  releaseNotes: {
    type: String,
    default: '',
  },
  uploadDate: {
    type: Date,
    default: Date.now,
  },
  downloadUrl: { // Fully qualified URL to download the file
    type: String,
    required: true,
  },
  qrCodeValue: { // Value for QR code, typically the downloadUrl
    type: String,
    required: true,
  },
  activeEnvironments: [{
    type: String,
    enum: ['Development', 'Staging', 'Production'],
    default: [],
  }],
  // projectId is implicitly part of the parent Project document
});

// Note: This schema is intended to be used as a subdocument.
// If you need to query AppVersions independently, consider making it a top-level model
// and referencing it in the Project model. For this app's scale, subdocuments are fine.
module.exports = AppVersionSchema;
