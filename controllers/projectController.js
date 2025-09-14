
const Project = require('../models/Project');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const mongoose = require('mongoose'); // ✅ PHẢI CÓ DÒNG NÀY
const fs = require('fs-extra');
const path = require('path');

// Create a new project
exports.createProject = async (req, res) => {
  try {
    const { name, description, platforms } = req.body;
    if (!name || !platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return errorResponse(res, 400, 'Project name and at least one platform are required.');
    }

    const newProject = new Project({ name, description, platforms, versions: [] });
    await newProject.save();
    return successResponse(res, 201, newProject, 'Project created successfully.');
  } catch (error) {
    console.error('Error creating project:', error);
    return errorResponse(res, 500, 'Server error while creating project.', error.message);
  }
};

// Get all projects
exports.getAllProjects = async (req, res) => {
  console.log('Fetching all projects');
  console.log('MongoDB connection state:', mongoose.connection.readyState);
  
  try {
    const projects = await Project.find().sort({ createdAt: -1 });
    console.log(`Found ${projects.length} projects`);
    
    projects.forEach(project => {
        if (project.versions && project.versions.length > 0) {
            project.versions.sort((a,b) => new Date(b.uploadDate) - new Date(a.uploadDate));
        }
    });
    return successResponse(res, 200, projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return errorResponse(res, 500, 'Server error while fetching projects.', error.message);
  }
};

// Get a single project by ID
exports.getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return errorResponse(res, 404, 'Project not found.');
    }
    
    // ✅ Debug logs
    console.log('=== Project Data Debug ===');
    console.log('Project ID:', req.params.projectId);
    console.log('Total bundleUpdates:', project.bundleUpdates?.length || 0);
    
    if (project.bundleUpdates && project.bundleUpdates.length > 0) {
        console.log('Bundle updates before sort:');
        project.bundleUpdates.forEach((bundle, index) => {
            console.log(`  ${index}: ${bundle.platform} v${bundle.bundleVersion} (${bundle.createdAt})`);
        });
        
        // Sort bundleUpdates
        project.bundleUpdates.sort((a, b) => {
            const versionCompare = semver.rcompare(a.bundleVersion, b.bundleVersion);
            if (versionCompare !== 0) return versionCompare;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
        
        console.log('Bundle updates after sort:');
        project.bundleUpdates.forEach((bundle, index) => {
            console.log(`  ${index}: ${bundle.platform} v${bundle.bundleVersion} (${bundle.createdAt})`);
        });
    }
    
    // Sort versions (APK/IPA)
    if (project.versions && project.versions.length > 0) {
        project.versions.sort((a,b) => new Date(b.uploadDate) - new Date(a.uploadDate));
    }
    
    return successResponse(res, 200, project);
  } catch (error) {
    console.error('Error fetching project by ID:', error);
    if (error.kind === 'ObjectId') {
        return errorResponse(res, 400, 'Invalid project ID format.');
    }
    return errorResponse(res, 500, 'Server error while fetching project.', error.message);
  }
};

// Update project details (name, description)
exports.updateProjectDetails = async (req, res) => {
  try {
    const { name, description, platforms } = req.body;
    const project = await Project.findById(req.params.projectId);

    if (!project) {
      return errorResponse(res, 404, 'Project not found.');
    }

    if (name) project.name = name;
    if (description !== undefined) project.description = description;
    if (platforms && Array.isArray(platforms)) project.platforms = platforms; // Allow updating platforms

    await project.save();
    return successResponse(res, 200, project, 'Project details updated successfully.');
  } catch (error) {
    console.error('Error updating project details:', error);
     if (error.kind === 'ObjectId') {
        return errorResponse(res, 400, 'Invalid project ID format.');
    }
    return errorResponse(res, 500, 'Server error while updating project details.', error.message);
  }
};

// Update React Native platforms for a project
exports.updateRNPlatforms = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { rnPlatforms } = req.body;

    if (!rnPlatforms || !Array.isArray(rnPlatforms) || rnPlatforms.length === 0) {
      return errorResponse(res, 400, 'rnPlatforms array is required and must not be empty.');
    }

    // Validate platform values
    const validPlatforms = ['ios', 'android', 'iOS', 'Android'];
    const invalidPlatforms = rnPlatforms.filter(p => !validPlatforms.includes(p));
    if (invalidPlatforms.length > 0) {
      return errorResponse(res, 400, `Invalid platforms: ${invalidPlatforms.join(', ')}. Valid platforms: ${validPlatforms.join(', ')}`);
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return errorResponse(res, 404, 'Project not found.');
    }

    project.rnPlatforms = rnPlatforms;
    await project.save();

    return successResponse(res, 200, {
      projectId: project._id,
      name: project.name,
      rnPlatforms: project.rnPlatforms
    }, 'React Native platforms updated successfully.');
  } catch (error) {
    console.error('Error updating RN platforms:', error);
    if (error.kind === 'ObjectId') {
      return errorResponse(res, 400, 'Invalid project ID format.');
    }
    return errorResponse(res, 500, 'Server error while updating RN platforms.', error.message);
  }
};

// Delete a project
exports.deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return errorResponse(res, 404, 'Project not found.');
    }

    // Delete associated files from the uploads directory
    const projectUploadDir = path.join(__dirname, '../uploads', project._id.toString());
    if (await fs.pathExists(projectUploadDir)) {
      await fs.remove(projectUploadDir);
      console.log(`Deleted upload directory: ${projectUploadDir}`);
    }
    
    await Project.deleteOne({ _id: req.params.projectId }); // Use deleteOne or findByIdAndDelete

    return successResponse(res, 200, null, 'Project and associated files deleted successfully.');
  } catch (error) {
    console.error('Error deleting project:', error);
    if (error.kind === 'ObjectId') {
        return errorResponse(res, 400, 'Invalid project ID format.');
    }
    return errorResponse(res, 500, 'Server error while deleting project.', error.message);
  }
};
