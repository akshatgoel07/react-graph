const {
  indexRepository,
  searchCodebase,
  constructEnhancedPrompt,
} = require("../services/rag-service");
const { generateContent } = require("../services/ai-service");
const {
  createOctokitClient,
  fetchRepoContents,
  fetchFileContent,
} = require("../services/github-service");
const {
  formatFileStructure,
  groupFiles,
  formatGrouping,
} = require("../services/code-processing-service");

/**
 * Index a repository for RAG search
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
async function indexRepo(req, res) {
  try {
    const { accessToken, owner, repo, branch = "main" } = req.body;

    if (!accessToken || !owner || !repo) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters",
      });
    }

    // Index the repository
    const repoId = await indexRepository(accessToken, owner, repo, branch);

    res.json({
      success: true,
      data: { repoId },
    });
  } catch (error) {
    console.error("Error in indexRepo controller:", error);
    res.status(500).json({
      success: false,
      message: "Failed to index repository",
      error: error.message,
    });
  }
}

/**
 * Search an indexed repository
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
async function searchRepo(req, res) {
  try {
    const { repoId, query, topK = 5 } = req.body;

    if (!repoId || !query) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters",
      });
    }

    // Search the codebase
    const results = await searchCodebase(repoId, query, topK);

    res.json({
      success: true,
      data: { results },
    });
  } catch (error) {
    console.error("Error in searchRepo controller:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search repository",
      error: error.message,
    });
  }
}

/**
 * Ask a question about the codebase
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
async function askQuestion(req, res) {
  try {
    const {
      accessToken,
      owner,
      repo,
      branch = "main",
      repoId,
      query,
      topK = 5,
    } = req.body;

    if (!repoId || !query) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters",
      });
    }

    // Search the codebase
    const retrievedChunks = await searchCodebase(repoId, query, topK);

    // Get additional context if access token is provided
    let fileStructure = "";
    let packageMetadata = "";
    let groupingSummary = "";

    if (accessToken && owner && repo) {
      const octokit = createOctokitClient(accessToken);

      // Get file structure
      const paths = await fetchRepoContents(octokit, owner, repo, "", branch);
      fileStructure = formatFileStructure(paths);

      // Get package.json metadata
      const packageJsonContent = await fetchFileContent(
        octokit,
        owner,
        repo,
        "package.json",
        branch,
      );

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

      // Group files
      const groupedFiles = groupFiles(paths);
      groupingSummary = formatGrouping(groupedFiles);
    }

    // Construct enhanced prompt
    const prompt = constructEnhancedPrompt(
      query,
      retrievedChunks,
      fileStructure,
      packageMetadata,
      groupingSummary,
    );

    // Generate AI response
    const response = await generateContent(prompt);

    res.json({
      success: true,
      data: {
        response,
        retrievedChunks,
      },
    });
  } catch (error) {
    console.error("Error in askQuestion controller:", error);
    res.status(500).json({
      success: false,
      message: "Failed to answer question",
      error: error.message,
    });
  }
}

module.exports = {
  indexRepo,
  searchRepo,
  askQuestion,
};
