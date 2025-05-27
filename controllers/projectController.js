
const Project = require('../models/Project');
const { successResponse, errorResponse } = require('../utils/apiResponse');
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
  try {
    const projects = await Project.find().sort({ createdAt: -1 });
    // Sort versions within each project manually if needed, though pre-save hook should handle it.
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
