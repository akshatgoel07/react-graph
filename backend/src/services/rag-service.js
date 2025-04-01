const { Octokit } = require("@octokit/rest");

const {
  embeddingsStore,
  createRepoId,
  createFileId,
  generateEmbeddings,
  searchVectors,
} = require("./embedding-service");

const {
  shouldProcessFile,
  chunkCodeFile,
} = require("./code-processing-service");

const {
  fetchRepoContents,
  fetchFileContent,
  createOctokitClient,
} = require("./github-service");

async function indexRepository(accessToken, owner, repo, branch = "main") {
  console.log(`Indexing repository: ${owner}/${repo}`);
  const repoId = createRepoId(owner, repo);

  try {
    // Clear any existing embeddings
    await embeddingsStore.clearEmbeddings(repoId);

    // Create GitHub client
    const octokit = createOctokitClient(accessToken);

    // Get all file paths
    const paths = await fetchRepoContents(octokit, owner, repo, "", branch);
    console.log(`Found ${paths.length} files in repository`);

    // Process each file
    for (const filePath of paths) {
      try {
        // Skip files we shouldn't process
        if (!shouldProcessFile(filePath, 0)) continue;

        // Fetch file content
        const content = await fetchFileContent(
          octokit,
          owner,
          repo,
          filePath,
          branch,
        );
        if (!content) continue;

        // Chunk the file
        const chunks = chunkCodeFile(content, filePath);
        console.log(`Chunked ${filePath} into ${chunks.length} parts`);

        // Process each chunk
        for (const chunk of chunks) {
          const chunkId = createFileId(
            filePath + ":" + chunk.name,
            chunk.content,
          );

          // Generate embeddings
          const embedding = await generateEmbeddings(chunk.content);

          // Store embeddings
          await embeddingsStore.saveEmbeddings(
            repoId,
            chunkId,
            embedding,
            chunk.content,
            {
              filePath,
              chunkName: chunk.name,
              chunkType: chunk.type,
            },
          );
        }
      } catch (error) {
        console.error(`Error processing file ${filePath}:`, error.message);
      }
    }

    console.log(`Completed indexing repository: ${owner}/${repo}`);
    return repoId;
  } catch (error) {
    console.error(`Error indexing repository:`, error);
    throw error;
  }
}

async function searchCodebase(repoId, query, topK = 5) {
  try {
    // Generate embeddings for the query
    const queryEmbedding = await generateEmbeddings(query);

    // Search for similar chunks
    const results = await searchVectors(repoId, queryEmbedding, topK);

    return results;
  } catch (error) {
    console.error(`Error searching codebase:`, error);
    throw error;
  }
}

function constructEnhancedPrompt(
  query,
  retrievedChunks,
  fileStructure,
  packageMetadata,
  groupingSummary,
) {
  let contextSection = "";

  if (retrievedChunks && retrievedChunks.length > 0) {
    contextSection = "Retrieved code snippets:\n\n";

    retrievedChunks.forEach((chunk, index) => {
      contextSection += `--- Snippet ${index + 1} (${
        chunk.metadata.filePath
      }) ---\n`;
      contextSection += chunk.content + "\n\n";
    });
  }

  const structureSection = fileStructure
    ? `\nFile structure:\n${fileStructure}`
    : "";

  const packageSection = packageMetadata
    ? `\nPackage information:\n${packageMetadata}`
    : "";

  const groupingSection = groupingSummary
    ? `\nLogical file grouping:\n${groupingSummary}`
    : "";

  const prompt = `
You are a helpful assistant analyzing a codebase. Please answer the following query:

${query}

${contextSection}${structureSection}${packageSection}${groupingSection}

Based on the information provided, please answer the query in a clear and concise manner.
`;

  return prompt;
}

module.exports = {
  indexRepository,
  searchCodebase,
  constructEnhancedPrompt,
};
