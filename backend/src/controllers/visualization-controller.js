const {
  createOctokitClient,
  fetchRepoContents,
  fetchFileContent,
} = require("../services/github-service");
const {
  generateReactFlowVisualization,
} = require("../services/visualization-service");

/**
 * Generate React Flow visualization data for a repository
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
async function generateReactFlow(req, res) {
  try {
    const { accessToken, owner, repo, branch = "main" } = req.body;

    if (!accessToken || !owner || !repo) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters",
      });
    }

    // Create GitHub client
    const octokit = createOctokitClient(accessToken);

    // Fetch repository contents
    const paths = await fetchRepoContents(octokit, owner, repo, "", branch);

    // Fetch package.json for metadata
    const packageJsonContent = await fetchFileContent(
      octokit,
      owner,
      repo,
      "package.json",
      branch,
    );

    // Extract package metadata
    let packageMetadata = "";
    if (packageJsonContent) {
      try {
        const packageJson = JSON.parse(packageJsonContent);
        const dependencies = packageJson.dependencies
          ? Object.keys(packageJson.dependencies).join(", ")
          : "None";
        const devDependencies = packageJson.devDependencies
          ? Object.keys(packageJson.devDependencies).join(", ")
          : "None";
        packageMetadata = `Detected technologies:\nDependencies: ${dependencies}\nDev Dependencies: ${devDependencies}`;
      } catch (error) {
        console.error("Error parsing package.json:", error);
      }
    }

    // Generate visualization data
    const visualizationData = await generateReactFlowVisualization(
      paths,
      packageMetadata,
    );

    res.json({
      success: true,
      data: visualizationData,
    });
  } catch (error) {
    console.error("Error in generateReactFlow controller:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate flow visualization",
      error: error.message,
    });
  }
}

module.exports = {
  generateReactFlow,
};
