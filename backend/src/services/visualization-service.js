const {
  formatFileStructure,
  groupFiles,
  formatGrouping,
} = require("./code-processing-service");
const { generateContent, parseJsonResponse } = require("./ai-service");

async function generateReactFlowVisualization(paths, packageMetadata) {
  try {
    // Format file structure
    const fileStructureText = formatFileStructure(paths);

    // Group files by logical categories
    const groupedFiles = groupFiles(paths);
    const groupingSummary = formatGrouping(groupedFiles);

    // Create prompt for AI
    const prompt = `
Given the following file structure of a web application:
${fileStructureText}
${packageMetadata || ""}

Additionally, here is a logical grouping of the files:
${groupingSummary}

Generate a React Flow compatible JSON with nodes and edges. Follow this exact structure from the example:
{
  "nodes": [{"id": "user", "type": "default", "position": { x: 300, y: 50 }, "data": { label: "User/Client" }}],
  "edges": [{"id": "edge-1", "source": "node1", "target": "node2", "animated": true, "type": "smoothstep"}]
}
`;

    // Generate content using AI service
    const aiResponse = await generateContent(prompt);

    // Parse the JSON response
    const flowData = parseJsonResponse(aiResponse);

    return {
      flowData,
      fileStructure: fileStructureText,
      packageMetadata,
      groupingSummary,
    };
  } catch (error) {
    console.error("Error generating visualization:", error);
    throw error;
  }
}

module.exports = {
  generateReactFlowVisualization,
};
