
const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const versionController = require('../controllers/versionController');
const bundleUpdateController = require('../controllers/bundleUpdateController');
const upload = require('../middleware/uploadMiddleware'); // For APK/IPA
const bundleUpload = require('../middleware/uploadMiddleware'); // Can reuse or create specific for bundles

// === Project Routes ===
router.post('/projects', projectController.createProject);
router.get('/projects', projectController.getAllProjects);
router.get('/projects/:projectId', projectController.getProjectById);
router.put('/projects/:projectId', projectController.updateProjectDetails); // For name, description, platforms
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
  bundleUpload.single('bundleFile'), // 'bundleFile' for RN bundles
  bundleUpdateController.uploadBundleUpdate
);

// Get latest bundle information for a client
// e.g., /api/projects/someProjectId/bundles/latest?platform=ios&currentClientBundleVersion=1.0.2
router.get('/projects/:projectId/bundles/latest', bundleUpdateController.getLatestBundleInfo);

// Delete a specific bundle update
router.delete('/projects/:projectId/bundles/:bundleUpdateId', bundleUpdateController.deleteBundleUpdate);


module.exports = router;