
const Project = require('../models/Project');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const path = require('path');
const fs = require('fs-extra');
const semver = require('semver'); // For semantic version comparison
const mongoose = require('mongoose');

// Upload a new React Native bundle update
exports.uploadBundleUpdate = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { platform, bundleVersion, bundleHash, description, isMandatory } = req.body;

    if (!req.file) {
      return errorResponse(res, 400, 'Bundle file (.zip or .jsbundle) is required.');
    }
    if (!platform || !bundleVersion || !bundleHash) {
      return errorResponse(res, 400, 'Platform, bundle version, and bundle hash are required.');
    }
    if (!semver.valid(bundleVersion)) {
        await fs.unlink(req.file.path); // Clean up temp file
        return errorResponse(res, 400, `Invalid bundle version format: ${bundleVersion}. Please use semantic versioning (e.g., 1.0.0).`);
    }

    const project = await Project.findById(projectId);
    if (!project) {
      await fs.unlink(req.file.path);
      return errorResponse(res, 404, 'Project not found.');
    }

    // Check if project supports this RN platform (optional, depends on how you manage rnPlatforms in Project model)
    // if (!project.rnPlatforms || !project.rnPlatforms.includes(platform.toLowerCase())) {
    //   await fs.unlink(req.file.path);
    //   return errorResponse(res, 400, `Project does not support React Native platform: ${platform}`);
    // }
    
    // Check for existing bundle with the same version and platform
    const existingBundle = project.bundleUpdates.find(
      b => b.platform === platform && b.bundleVersion === bundleVersion
    );
    if (existingBundle) {
      await fs.unlink(req.file.path); // Clean up temp file
      return errorResponse(res, 409, `Bundle version ${bundleVersion} for platform ${platform} already exists for this project.`);
    }

    const bundleUpdateId = new mongoose.Types.ObjectId();
    const relativeFilePath = path.join(projectId, 'bundles', bundleUpdateId.toString(), req.file.originalname);
    const absoluteFilePath = path.join(__dirname, '../uploads', relativeFilePath);

    await fs.ensureDir(path.dirname(absoluteFilePath));
    await fs.move(req.file.path, absoluteFilePath, { overwrite: true });

    const bundleUrl = `${process.env.BASE_URL}/files/${relativeFilePath.replace(/\\/g, '/')}`; // Ensure forward slashes for URL

    const newBundleUpdate = {
      _id: bundleUpdateId,
      platform: platform.toLowerCase(), // Store consistently
      bundleVersion,
      bundleHash,
      fileName: req.file.originalname,
      fileSize: (req.file.size / (1024 * 1024)).toFixed(2) + ' MB',
      filePath: relativeFilePath,
      description: description || '',
      isMandatory: isMandatory === 'true' || isMandatory === true,
      createdAt: new Date(),
      bundleUrl,
    };

    project.bundleUpdates.unshift(newBundleUpdate);
    project.bundleUpdates.sort((a,b) => semver.rcompare(a.bundleVersion, b.bundleVersion) || (new Date(b.createdAt) - new Date(a.createdAt)));


    await project.save();
    const savedBundle = project.bundleUpdates.find(b => b._id.equals(bundleUpdateId));

    return successResponse(res, 201, savedBundle, 'React Native bundle update uploaded successfully.');

  } catch (error) {
    console.error('Error uploading RN bundle update:', error);
    if (req.file && req.file.path) {
      try {
        if (await fs.pathExists(req.file.path)) await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.error("Error cleaning up bundle file during error handling:", cleanupError);
      }
    }
    return errorResponse(res, 500, 'Server error while uploading RN bundle update.', error.message);
  }
};

// Get latest bundle information for a client
exports.getLatestBundleInfo = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { platform, currentClientBundleVersion } = req.query;

    if (!platform || !currentClientBundleVersion) {
      return errorResponse(res, 400, 'Platform and current client bundle version are required query parameters.');
    }
    if (!semver.valid(currentClientBundleVersion)) {
        return errorResponse(res, 400, `Invalid current client bundle version format: ${currentClientBundleVersion}.`);
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return errorResponse(res, 404, 'Project not found.');
    }

    const relevantBundles = project.bundleUpdates
      .filter(b => b.platform === platform.toLowerCase())
      .sort((a, b) => semver.rcompare(a.bundleVersion, b.bundleVersion) || (new Date(b.createdAt) - new Date(a.createdAt))); // Sort by version (desc), then date (desc)

    const latestSuitableBundle = relevantBundles.find(b => 
      semver.valid(b.bundleVersion) && semver.gt(b.bundleVersion, currentClientBundleVersion)
    );

    if (latestSuitableBundle) {
      return successResponse(res, 200, {
        version: latestSuitableBundle.bundleVersion,
        bundleUrl: latestSuitableBundle.bundleUrl,
        hash: latestSuitableBundle.bundleHash,
        createdAt: latestSuitableBundle.createdAt,
        description: latestSuitableBundle.description,
        isMandatory: latestSuitableBundle.isMandatory,
        fileName: latestSuitableBundle.fileName, // Optional, but good for client
        fileSize: latestSuitableBundle.fileSize, // Optional
      });
    } else {
      // No newer version found
      return successResponse(res, 204, null, 'No new bundle update available.');
    }
  } catch (error) {
    console.error('Error fetching latest bundle info:', error);
    if (error.kind === 'ObjectId') {
        return errorResponse(res, 400, 'Invalid project ID format.');
    }
    return errorResponse(res, 500, 'Server error while fetching latest bundle info.', error.message);
  }
};

// Delete a React Native bundle update
exports.deleteBundleUpdate = async (req, res) => {
  try {
    const { projectId, bundleUpdateId } = req.params;
    const project = await Project.findById(projectId);

    if (!project) {
      return errorResponse(res, 404, 'Project not found.');
    }

    const bundleIndex = project.bundleUpdates.findIndex(b => b._id.toString() === bundleUpdateId);
    if (bundleIndex === -1) {
      return errorResponse(res, 404, 'Bundle update not found in this project.');
    }

    const bundleToDelete = project.bundleUpdates[bundleIndex];
    const filePathToDelete = path.join(__dirname, '../uploads', bundleToDelete.filePath);

    if (await fs.pathExists(filePathToDelete)) {
      // Delete the specific bundle file and its parent directory if empty, or just the file.
      // For simplicity, deleting the bundle's directory (e.g., uploads/projectId/bundles/bundleUpdateId/)
      await fs.remove(path.dirname(filePathToDelete)); 
      console.log(`Deleted bundle directory: ${path.dirname(filePathToDelete)}`);
    } else {
      console.warn(`Bundle file not found for deletion: ${filePathToDelete}`);
    }

    project.bundleUpdates.splice(bundleIndex, 1);
    await project.save();

    return successResponse(res, 200, null, 'Bundle update deleted successfully.');
  } catch (error) {
    console.error('Error deleting bundle update:', error);
    if (error.kind === 'ObjectId') {
        return errorResponse(res, 400, 'Invalid project or bundle ID format.');
    }
    return errorResponse(res, 500, 'Server error while deleting bundle update.', error.message);
  }
};
