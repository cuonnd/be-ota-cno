
const express = require('express');
const mongoose = require('mongoose'); // ✅ PHẢI CÓ DÒNG NÀY
const router = express.Router();
const projectController = require('../controllers/projectController');
const versionController = require('../controllers/versionController');
const bundleUpdateController = require('../controllers/bundleUpdateController');
// const upload = require('../middleware/uploadMiddleware'); // For APK/IPA
const { upload } = require("../middleware/uploadMiddleware"); // nếu export thêm

// === Project Routes ===
router.post('/projects', projectController.createProject);
router.get('/projects', projectController.getAllProjects);
router.get('/projects/:projectId', projectController.getProjectById);
router.put('/projects/:projectId', projectController.updateProjectDetails); // For name, description, platforms
router.put('/projects/:projectId/rn-platforms', projectController.updateRNPlatforms); // For React Native platforms
router.delete('/projects/:projectId', projectController.deleteProject);

// === App Version Routes (APK/IPA) ===
router.post(
  '/projects/:projectId/versions',
  upload.single('appFile'), 
  versionController.addAppVersion
);
router.delete('/projects/:projectId/versions/:versionId', versionController.deleteAppVersion);
router.put('/projects/:projectId/versions/:versionId/environments', versionController.updateVersionEnvironments);


// === React Native Bundle Update Routes (CodePush-like) ===
router.post(
  '/projects/:projectId/bundles',
  upload.single('bundleFile'), // 'bundleFile' for RN bundles
  bundleUpdateController.uploadBundleUpdate
);

// Get latest bundle information for a client
// e.g., /api/projects/someProjectId/bundles/latest?platform=ios&currentClientBundleVersion=1.0.2
router.get('/projects/:projectId/bundles/latest', bundleUpdateController.getLatestBundleInfo);

// Delete a specific bundle update
router.delete('/projects/:projectId/bundles/:bundleUpdateId', bundleUpdateController.deleteBundleUpdate);

router.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  res.json({
    status: 'OK',
    database: dbStates[dbState],
    timestamp: new Date().toISOString()
  });
});


module.exports = router;