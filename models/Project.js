
const mongoose = require('mongoose');
const AppVersionSchema = require('./AppVersion'); // For APK/IPA versions
const BundleUpdateSchema = require('./BundleUpdate'); // For React Native bundle updates

const ProjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  platforms: {
    type: [String],
    enum: ['ios', 'android',], // Add valid values here
    required: true
  },
  rnPlatforms: [{ // Platforms specifically for React Native bundle updates
    type: String,
    enum: ['android', 'ios'], // Lowercase to match common RN usage
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  versions: [AppVersionSchema], // Array of AppVersion subdocuments (for APK/IPA)
  bundleUpdates: [BundleUpdateSchema], // Array of BundleUpdate subdocuments (for RN hot updates)
});

// Pre-save middleware to sort versions and bundleUpdates by date descending
ProjectSchema.pre('save', function(next) {
  if (this.isModified('versions')) {
    this.versions.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
  }
  if (this.isModified('bundleUpdates')) {
    this.bundleUpdates.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  next();
});


module.exports = mongoose.model('Project', ProjectSchema);