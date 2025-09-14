const Project = require("../models/Project");
const { successResponse, errorResponse } = require("../utils/apiResponse");
const path = require("path");
const fs = require("fs-extra");
const semver = require("semver");
const mongoose = require("mongoose");
const { uploadToSpaces } = require("../middleware/uploadMiddleware");

// Hàm helper để normalize version
const normalizeVersion = (version) => {
  if (!version) return version;

  // Nếu đã là semantic version hợp lệ, giữ nguyên
  if (semver.valid(version)) return version;

  // Chuyển đổi các format thường gặp
  const parts = version.split(".");

  if (parts.length === 1) {
    // "1" -> "1.0.0"
    return `${parts[0]}.0.0`;
  } else if (parts.length === 2) {
    // "1.0" -> "1.0.0"
    return `${parts[0]}.${parts[1]}.0`;
  }

  return version; // Giữ nguyên nếu không match pattern nào
};

// Upload a new React Native bundle update
exports.uploadBundleUpdate = async (req, res) => {
  // Tăng timeout cho response
  req.setTimeout(300000); // 5 phút
  res.setTimeout(300000); // 5 phút

  try {
    const { projectId } = req.params;
    const { platform, bundleVersion, bundleHash, description, isMandatory } =
      req.body;

    if (!req.file) {
      return errorResponse(
        res,
        400,
        "Bundle file (.zip or .jsbundle) is required."
      );
    }
    if (!platform || !bundleVersion || !bundleHash) {
      return errorResponse(
        res,
        400,
        "Platform, bundle version, and bundle hash are required."
      );
    }

    // Validate platform
    const validPlatforms = ['ios', 'android'];
    if (!validPlatforms.includes(platform.toLowerCase())) {
      return errorResponse(
        res,
        400,
        `Invalid platform. Supported platforms: ${validPlatforms.join(', ')}`
      );
    }

    // Validate bundleHash format (basic validation)
    if (typeof bundleHash !== 'string' || bundleHash.length < 10) {
      return errorResponse(
        res,
        400,
        "Invalid bundle hash format. Hash must be a string with at least 10 characters."
      );
    }

    // ✅ Normalize version trước khi validate
    const normalizedVersion = normalizeVersion(bundleVersion);

    if (!semver.valid(normalizedVersion)) {
      return errorResponse(
        res,
        400,
        `Invalid bundle version format: ${bundleVersion}. Please use semantic versioning (e.g., 1.0.0, 1.0, or 1).`
      );
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return errorResponse(res, 404, "Project not found.");
    }

    // Check if project supports this platform
    const normalizedPlatform = platform.toLowerCase();
    const supportedPlatforms = project.rnPlatforms?.map(p => p.toLowerCase()) || [];
    
    if (!project.rnPlatforms || project.rnPlatforms.length === 0) {
      return errorResponse(
        res,
        400,
        `Project does not have React Native platforms configured. Please add platforms to the project first.`
      );
    }
    
    if (!supportedPlatforms.includes(normalizedPlatform)) {
      return errorResponse(
        res,
        400,
        `Project does not support platform: ${platform}. Supported platforms: ${project.rnPlatforms.join(', ')}`
      );
    }

    // ✅ BỎ CHECK VERSION DUPLICATE - Cho phép upload version trùng hoặc nhỏ hơn
    // Chỉ check duplicate theo bundleHash để tránh upload cùng một file
    const existingBundleWithSameHash = project.bundleUpdates.find(
      (b) => b.platform === platform.toLowerCase() && b.bundleHash === bundleHash
    );
    if (existingBundleWithSameHash) {
      return errorResponse(
        res,
        409,
        `Bundle with same hash already exists for platform ${platform}. Same content detected.`
      );
    }

    // ✅ Upload file với timeout handling
    let uploadResult;
    try {
      console.log(`Starting upload for file: ${req.file.originalname}, size: ${req.file.size} bytes`);
      
      // Check if uploadToSpaces function exists
      if (typeof uploadToSpaces !== 'function') {
        throw new Error('uploadToSpaces function not found in uploadMiddleware');
      }
      
      uploadResult = await Promise.race([
        uploadToSpaces(req.file, projectId),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Upload timeout')), 240000) // 4 phút timeout
        )
      ]);
      
      // Validate upload result
      if (!uploadResult || !uploadResult.url) {
        throw new Error('Upload completed but no URL returned');
      }
      
      console.log('Upload completed successfully:', uploadResult.url);
    } catch (uploadError) {
      console.error('Upload to spaces failed:', uploadError);
      
      // Clean up temp file on upload failure
      if (req.file && req.file.path) {
        try {
          if (await fs.pathExists(req.file.path)) {
            await fs.unlink(req.file.path);
            console.log('Cleaned up temp file after upload failure');
          }
        } catch (cleanupError) {
          console.error('Error cleaning up temp file:', cleanupError);
        }
      }
      
      return errorResponse(
        res,
        500,
        "Failed to upload file to cloud storage.",
        uploadError.message
      );
    }

    const { url } = uploadResult;
    const bundleUpdateId = new mongoose.Types.ObjectId();

    const newBundleUpdate = {
      _id: bundleUpdateId,
      platform: platform.toLowerCase(),
      bundleVersion: normalizedVersion, // ✅ Lưu normalized version
      bundleHash,
      fileName: req.file.originalname,
      fileSize: (req.file.size / (1024 * 1024)).toFixed(2) + " MB",
      filePath: url,
      description: description || "",
      isMandatory: isMandatory === "true" || isMandatory === true,
      createdAt: new Date(),
      bundleUrl: url,
    };

    // ✅ LUÔN LUÔN ĐẶT LEN ĐẦU MẢNG - không sort theo version
    project.bundleUpdates.unshift(newBundleUpdate);
    
    // ✅ Chỉ sort theo thời gian upload (mới nhất lên đầu)
    project.bundleUpdates.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    try {
      await project.save();
      const savedBundle = project.bundleUpdates.find((b) =>
        b._id.equals(bundleUpdateId)
      );

      console.log(`✅ Bundle saved to database: ${platform} v${normalizedVersion}`);
      return successResponse(
        res,
        201,
        savedBundle,
        "React Native bundle update uploaded successfully."
      );
    } catch (saveError) {
      console.error('Error saving bundle to database:', saveError);
      
      // Note: File is already uploaded to cloud storage, but database save failed
      // In production, you might want to implement a cleanup job or manual process
      // to remove orphaned files from cloud storage
      console.warn(`⚠️ File uploaded to cloud storage but database save failed. File URL: ${url}`);
      
      return errorResponse(
        res,
        500,
        "Bundle uploaded to cloud storage but failed to save to database. Please contact support.",
        saveError.message
      );
    }
  } catch (error) {
    console.error("Error uploading RN bundle update:", error);
    if (req.file && req.file.path) {
      try {
        if (await fs.pathExists(req.file.path)) await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.error(
          "Error cleaning up bundle file during error handling:",
          cleanupError
        );
      }
    }
    return errorResponse(
      res,
      500,
      "Server error while uploading RN bundle update.",
      error.message
    );
  }
};

// Get latest bundle information for a client
exports.getLatestBundleInfo = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { platform, currentClientBundleVersion } = req.query;

    if (!platform || !currentClientBundleVersion) {
      return errorResponse(
        res,
        400,
        "Platform and current client bundle version are required query parameters."
      );
    }

    // ✅ Normalize version từ client
    const normalizedClientVersion = normalizeVersion(
      currentClientBundleVersion
    );

    if (!semver.valid(normalizedClientVersion)) {
      return errorResponse(
        res,
        400,
        `Invalid current client bundle version format: ${currentClientBundleVersion}. Supported formats: 1.0.0, 1.0, or 1`
      );
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return errorResponse(res, 404, "Project not found.");
    }

    const relevantBundles = project.bundleUpdates
      .filter((b) => b.platform === platform.toLowerCase())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Sort theo thời gian mới nhất

    // ✅ TÌM BUNDLE MỚI NHẤT (theo thời gian upload, không cần so sánh version)
    const latestBundle = relevantBundles[0]; // Bundle mới nhất theo thời gian

    if (latestBundle && latestBundle.bundleHash) {
      return successResponse(res, 200, {
        version: latestBundle.bundleVersion,
        bundleUrl: latestBundle.bundleUrl,
        hash: latestBundle.bundleHash,
        createdAt: latestBundle.createdAt,
        description: latestBundle.description,
        isMandatory: latestBundle.isMandatory,
        fileName: latestBundle.fileName,
        fileSize: latestBundle.fileSize,
      });
    } else {
      return successResponse(res, 204, null, "No bundle update available.");
    }
  } catch (error) {
    console.error("Error fetching latest bundle info:", error);
    if (error.kind === "ObjectId") {
      return errorResponse(res, 400, "Invalid project ID format.");
    }
    return errorResponse(
      res,
      500,
      "Server error while fetching latest bundle info.",
      error.message
    );
  }
};

// Delete a React Native bundle update (giữ nguyên)
exports.deleteBundleUpdate = async (req, res) => {
  try {
    const { projectId, bundleUpdateId } = req.params;
    const project = await Project.findById(projectId);

    if (!project) {
      return errorResponse(res, 404, "Project not found.");
    }

    const bundleIndex = project.bundleUpdates.findIndex(
      (b) => b._id.toString() === bundleUpdateId
    );
    if (bundleIndex === -1) {
      return errorResponse(
        res,
        404,
        "Bundle update not found in this project."
      );
    }

    const bundleToDelete = project.bundleUpdates[bundleIndex];
    
    // Với cloud storage, không cần xóa file local
    console.log(`Bundle to delete: ${bundleToDelete.fileName} - ${bundleToDelete.bundleUrl}`);

    project.bundleUpdates.splice(bundleIndex, 1);
    await project.save();

    return successResponse(
      res,
      200,
      null,
      "Bundle update deleted successfully."
    );
  } catch (error) {
    console.error("Error deleting bundle update:", error);
    if (error.kind === "ObjectId") {
      return errorResponse(res, 400, "Invalid project or bundle ID format.");
    }
    return errorResponse(
      res,
      500,
      "Server error while deleting bundle update.",
      error.message
    );
  }
};