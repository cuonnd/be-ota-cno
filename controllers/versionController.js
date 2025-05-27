
const Project = require('../models/Project');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const path = require('path');
const fs = require('fs-extra'); // Use fs-extra for convenient directory creation/deletion

// Add a new app version to a project
exports.addAppVersion = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { platform, versionName, buildNumber, releaseNotes } = req.body;

    if (!req.file) {
      return errorResponse(res, 400, 'App file is required.');
    }
    if (!platform || !versionName || !buildNumber) {
      return errorResponse(res, 400, 'Platform, version name, and build number are required.');
    }

    const project = await Project.findById(projectId);
    if (!project) {
      // If project not found, delete uploaded file to prevent orphans
      await fs.unlink(req.file.path);
      return errorResponse(res, 404, 'Project not found.');
    }

    // Check if the platform of the new version is allowed by the project
    if (!project.platforms.includes(platform)) {
        await fs.unlink(req.file.path); // Clean up uploaded file
        return errorResponse(res, 400, `Platform '${platform}' is not supported by this project. Supported platforms: ${project.platforms.join(', ')}.`);
    }
    
    // Construct file path relative to the 'uploads' directory root
    // e.g. uploads/projectId/versionId/fileName.apk
    const versionIdForPath = new require('mongoose').Types.ObjectId().toString(); // Temporary ID for path construction before actual save
    const relativeFilePath = path.join(projectId, versionIdForPath, req.file.originalname);
    const absoluteFilePath = path.join(__dirname, '../uploads', relativeFilePath);

    // Ensure the directory exists
    await fs.ensureDir(path.dirname(absoluteFilePath));
    // Move file from multer's temp storage to permanent location
    await fs.move(req.file.path, absoluteFilePath, { overwrite: true });

    const downloadUrl = `${process.env.BASE_URL}/files/${relativeFilePath}`;
    
    const newVersion = {
      _id: new require('mongoose').Types.ObjectId(versionIdForPath), // Use the generated ID
      platform,
      versionName,
      buildNumber,
      fileName: req.file.originalname,
      fileSize: (req.file.size / (1024 * 1024)).toFixed(2) + ' MB',
      filePath: relativeFilePath, // Store relative path
      releaseNotes: releaseNotes || '',
      uploadDate: new Date(),
      downloadUrl: downloadUrl,
      qrCodeValue: downloadUrl, // QR code will encode the direct download URL
      activeEnvironments: [],
    };

    project.versions.unshift(newVersion); // Add to the beginning of the array
    project.versions.sort((a,b) => new Date(b.uploadDate) - new Date(a.uploadDate)); // Ensure sort order

    await project.save();
    
    // Find the newly added version in the saved project to return it (with its MongoDB _id)
    const addedVersion = project.versions.find(v => v.filePath === newVersion.filePath);

    return successResponse(res, 201, addedVersion, 'App version added successfully.');

  } catch (error) {
    console.error('Error adding app version:', error);
    // Clean up uploaded file if an error occurs after file handling started
    if (req.file && req.file.path) {
      try {
        // Attempt to clean up the originally uploaded multer file
        if (await fs.pathExists(req.file.path)) await fs.unlink(req.file.path);
        // Also attempt to clean up if it was moved
        const versionIdForPath = new require('mongoose').Types.ObjectId().toString();
        const projectId = req.params.projectId;
        if (projectId && req.file.originalname) {
            const attemptedPath = path.join(__dirname, '../uploads', projectId, versionIdForPath, req.file.originalname);
            if (await fs.pathExists(attemptedPath)) await fs.remove(path.dirname(attemptedPath)); // remove version's dir
        }
      } catch (cleanupError) {
        console.error("Error cleaning up file during error handling:", cleanupError);
      }
    }
    return errorResponse(res, 500, 'Server error while adding app version.', error.message);
  }
};

// Delete an app version
exports.deleteAppVersion = async (req, res) => {
  try {
    const { projectId, versionId } = req.params;
    const project = await Project.findById(projectId);

    if (!project) {
      return errorResponse(res, 404, 'Project not found.');
    }

    const versionIndex = project.versions.findIndex(v => v._id.toString() === versionId);
    if (versionIndex === -1) {
      return errorResponse(res, 404, 'Version not found in this project.');
    }

    const versionToDelete = project.versions[versionIndex];

    // Delete the physical file
    const filePathToDelete = path.join(__dirname, '../uploads', versionToDelete.filePath);
    if (await fs.pathExists(filePathToDelete)) {
      await fs.remove(path.dirname(filePathToDelete)); // Remove the version's directory
      console.log(`Deleted version directory: ${path.dirname(filePathToDelete)}`);
    } else {
      console.warn(`File not found for deletion: ${filePathToDelete}`);
    }

    project.versions.splice(versionIndex, 1); // Remove version from array
    await project.save();

    return successResponse(res, 200, null, 'Version deleted successfully.');
  } catch (error) {
    console.error('Error deleting app version:', error);
    if (error.kind === 'ObjectId') {
        return errorResponse(res, 400, 'Invalid project or version ID format.');
    }
    return errorResponse(res, 500, 'Server error while deleting app version.', error.message);
  }
};

// Update active environments for an app version
exports.updateVersionEnvironments = async (req, res) => {
  try {
    const { projectId, versionId } = req.params;
    const { activeEnvironments } = req.body; // Expect an array of environments

    if (!Array.isArray(activeEnvironments)) {
      return errorResponse(res, 400, 'activeEnvironments must be an array.');
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return errorResponse(res, 404, 'Project not found.');
    }

    const version = project.versions.find(v => v._id.toString() === versionId);
    if (!version) {
      return errorResponse(res, 404, 'Version not found in this project.');
    }
    
    // Logic to set this version to active in specified environments
    // and deactivate it in others for this project (if only one version can be active per env)
    // For now, let's just update the current version's environments directly.
    // A more complex "code-push" like system would manage this across versions.
    
    // Option 1: Simple update (what's implemented below)
    // A version can be in multiple environments. Setting activeEnvironments replaces the old list.
    version.activeEnvironments = activeEnvironments;

    // Option 2: Ensure only one version is active per environment within a project (more complex)
    // If this is desired, you'd iterate through all versions of the project:
    // project.versions.forEach(v => {
    //   activeEnvironments.forEach(envToActivate => {
    //     if (v.activeEnvironments.includes(envToActivate) && v._id.toString() !== versionId) {
    //       // Deactivate this environment for other versions
    //       v.activeEnvironments = v.activeEnvironments.filter(e => e !== envToActivate);
    //     }
    //   });
    // });
    // // Then set the current version's environments
    // version.activeEnvironments = activeEnvironments;


    await project.save();
    return successResponse(res, 200, version, 'Version environments updated successfully.');

  } catch (error) {
    console.error('Error updating version environments:', error);
    if (error.kind === 'ObjectId') {
        return errorResponse(res, 400, 'Invalid project or version ID format.');
    }
    return errorResponse(res, 500, 'Server error while updating version environments.', error.message);
  }
};
