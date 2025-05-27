const mongoose = require('mongoose');

const BundleUpdateSchema = new mongoose.Schema({
  bundleVersion: { // e.g., "1.0.3" - Semantic version for the JS bundle itself
    type: String,
    required: true,
  },
  platform: { // Platform for the RN bundle
    type: String,
    enum: ['android', 'ios'], // Lowercase for consistency
    required: true,
  },
  bundleUrl: { // Fully qualified URL to download the .zip or .jsbundle
    type: String,
    required: true,
  },
  bundleHash: { // SHA256 hash of the bundle file for integrity checking
    type: String,
    required: true,
  },
  fileName: { // Original name of the uploaded bundle file (e.g., main.jsbundle or update.zip)
    type: String,
    required: true,
  },
  fileSize: { // File size in a human-readable format e.g., "1.2 MB"
    type: String,
    required: true,
  },
  filePath: { // Path on the server where the bundle file is stored (relative to uploads)
    type: String,
    required: true,
  },
  description: { // Optional description for this bundle update
    type: String,
    default: '',
  },
  isMandatory: { // Whether this update is mandatory for the client
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // projectId is implicitly part of the parent Project document
});

module.exports = BundleUpdateSchema;