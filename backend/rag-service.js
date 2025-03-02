// rag-service.js
const { Octokit } = require("@octokit/rest");
const { createHash } = require("crypto");
const path = require("path");
const axios = require("axios"); // Add this
require("dotenv").config(); // Ensure .env is loaded

const embeddingsStore = {
  vectors: {},
  async saveEmbeddings(repoId, fileId, vector, content, metadata) {
    if (!this.vectors[repoId]) this.vectors[repoId] = {};
    this.vectors[repoId][fileId] = { vector, content, metadata };
  },
  async getEmbeddings(repoId) {
    return this.vectors[repoId] || {};
  },
  async clearEmbeddings(repoId) {
    delete this.vectors[repoId];
  },
};

// Create a unique ID for a repository
function createRepoId(owner, repo) {
  return createHash("md5").update(`${owner}/${repo}`).digest("hex");
}

// Create a unique ID for a file
function createFileId(filePath, content) {
  return createHash("md5").update(`${filePath}:${content}`).digest("hex");
}

// Exclude binary files, large files, and common build artifacts
function shouldProcessFile(filePath, size) {
  if (size > 1024 * 1024) return false;
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath).toLowerCase();
  if (
    [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".svg",
      ".ico",
      ".woff",
      ".ttf",
      ".eot",
      ".otf",
      ".pdf",
      ".zip",
      ".tar",
      ".gz",
      ".exe",
      ".dll",
    ].includes(ext)
  ) {
    return false;
  }
  if (
    filePath.includes("node_modules") ||
    filePath.includes("dist/") ||
    filePath.includes("build/") ||
    filePath.includes(".git/")
  ) {
    return false;
  }
  if (
    fileName === "package-lock.json" ||
    fileName === "yarn.lock" ||
    fileName === ".eslintcache"
  ) {
    return false;
  }
  return true;
}

// Split code into logical chunks (unchanged)
function chunkCodeFile(content, filePath) {
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();
  let chunks = [];
  if ([".js", ".jsx", ".ts", ".tsx"].includes(ext)) {
    const importSection = content.match(/^(import .+?\n)+/m);
    const imports = importSection ? importSection[0] : "";
    const functionRegex =
      /(\/\*\*[\s\S]*?\*\/)?\s*(async\s+)?function\s+(\w+)[\s\S]*?(?=\n\s*(\/\*\*|function\s+\w+|class\s+|export|const|let|var|$))/g;
    const classRegex =
      /(\/\*\*[\s\S]*?\*\/)?\s*class\s+(\w+)[\s\S]*?(?=\n\s*(\/\*\*|function\s+\w+|class\s+|export|const|let|var|$))/g;
    const arrowFnRegex =
      /(\/\*\*[\s\S]*?\*\/)?\s*(export\s+)?(const|let|var)\s+(\w+)\s*=\s*(async\s*)?\([\s\S]*?(?=\n\s*(\/\*\*|function\s+\w+|class\s+|export|const|let|var|$))/g;

    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      chunks.push({
        type: "function",
        name: match[3],
        content: imports + match[0],
        comment: match[1] || "",
      });
    }
    while ((match = classRegex.exec(content)) !== null) {
      chunks.push({
        type: "class",
        name: match[2],
        content: imports + match[0],
        comment: match[1] || "",
      });
    }
    while ((match = arrowFnRegex.exec(content)) !== null) {
      chunks.push({
        type: "variable",
        name: match[4],
        content: imports + match[0],
        comment: match[1] || "",
      });
    }
    if (chunks.length === 0 || content.length < 2000) {
      chunks.push({
        type: "file",
        name: fileName,
        content: content,
        comment: "",
      });
    }
  } else if ([".json", ".yml", ".yaml", ".md", ".html", ".css"].includes(ext)) {
    chunks.push({
      type: "file",
      name: fileName,
      content: content,
      comment: "",
    });
  } else {
    if (content.length > 5000) {
      const chunkSize = 5000;
      const overlap = 500;
      for (let i = 0; i < content.length; i += chunkSize - overlap) {
        const chunk = content.substring(i, i + chunkSize);
        chunks.push({
          type: "chunk",
          name: `${fileName} (part ${
            Math.floor(i / (chunkSize - overlap)) + 1
          })`,
          content: chunk,
          comment: "",
        });
      }
    } else {
      chunks.push({
        type: "file",
        name: fileName,
        content: content,
        comment: "",
      });
    }
  }
  return chunks;
}

// Generate embeddings using Hugging Face Inference API
async function generateEmbeddings(text) {
  try {
    const response = await axios.post(
      "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2",
      { inputs: text },
      {
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );
    const embedding = response.data;
    if (!Array.isArray(embedding)) {
      throw new Error(`Invalid embedding format: ${JSON.stringify(embedding)}`);
    }
    console.log(
      `[INDEXING BACKEND] Embedding generated successfully (length: ${
        embedding.length
      }, first few: ${embedding.slice(0, 5)})`,
    );
    return embedding;
  } catch (error) {
    console.error(
      "[INDEXING BACKEND] Error generating embeddings:",
      error.message,
    );
    const hash = createHash("sha256").update(text).digest("hex");
    return Array.from(hash).map((char) => char.charCodeAt(0) / 255);
  }
}

function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Main function to index repository content
async function indexRepository(accessToken, owner, repo, branch = "main") {
  console.log(`[INDEXING BACKEND] Starting indexing for ${owner}/${repo}`);
  const repoId = createRepoId(owner, repo);

  try {
    await embeddingsStore.clearEmbeddings(repoId);
    console.log(`[INDEXING BACKEND] Cleared previous embeddings for ${repoId}`);

    const octokit = new Octokit({ auth: accessToken });
    const paths = await fetchRepoContents(octokit, owner, repo, "", branch);
    console.log(`[INDEXING BACKEND] Found ${paths.length} files to process`);

    let processedFiles = 0;
    const totalFiles = paths.length;

    for (const filePath of paths) {
      try {
        const fileContent = await fetchFileContent(
          octokit,
          owner,
          repo,
          filePath,
          branch,
        );
        if (!fileContent) {
          console.log(`[INDEXING BACKEND] Skipping ${filePath} (no content)`);
          continue;
        }

        if (!shouldProcessFile(filePath, fileContent.length)) {
          console.log(
            `[INDEXING BACKEND] Skipping ${filePath} (binary/large file)`,
          );
          continue;
        }

        const chunks = chunkCodeFile(fileContent, filePath);
        console.log(
          `[INDEXING BACKEND] Split ${filePath} into ${chunks.length} chunks`,
        );

        for (const chunk of chunks) {
          const chunkId = createFileId(filePath + chunk.name, chunk.content);
          const metadata = {
            filePath,
            fileName: path.basename(filePath),
            chunkType: chunk.type,
            chunkName: chunk.name,
            repo: `${owner}/${repo}`,
            branch,
          };

          const embedding = await generateEmbeddings(chunk.content);
          console.log(
            `[INDEXING BACKEND] Generated embedding for ${filePath} - ${chunk.name} (length: ${embedding.length})`,
          );

          await embeddingsStore.saveEmbeddings(
            repoId,
            chunkId,
            embedding,
            chunk.content,
            metadata,
          );
        }

        processedFiles++;
        if (processedFiles % 10 === 0) {
          console.log(
            `[INDEXING BACKEND] Progress: ${processedFiles}/${totalFiles} files processed`,
          );
        }
      } catch (error) {
        console.error(
          `[INDEXING BACKEND] Error processing ${filePath}:`,
          error,
        );
      }
    }

    console.log(
      `[INDEXING BACKEND] Indexing complete. Processed ${processedFiles}/${totalFiles} files`,
    );
    return { success: true, filesProcessed: processedFiles, totalFiles };
  } catch (error) {
    console.error("[INDEXING BACKEND] Repository indexing failed:", error);
    return { success: false, error: error.message };
  }
}

// Search for relevant code chunks
async function searchCodebase(repoId, query, topK = 5) {
  try {
    const queryEmbedding = await generateEmbeddings(query);
    const repoEmbeddings = await embeddingsStore.getEmbeddings(repoId);

    const results = [];
    for (const [chunkId, data] of Object.entries(repoEmbeddings)) {
      const similarity = cosineSimilarity(queryEmbedding, data.vector);
      results.push({
        chunkId,
        content: data.content,
        metadata: data.metadata,
        similarity,
      });
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
  } catch (error) {
    console.error("Search failed:", error);
    return [];
  }
}

// Recursive function to fetch all files in a repo
async function fetchRepoContents(
  octokit,
  owner,
  repo,
  path = "",
  branch = "main",
) {
  const { data } = await octokit.repos.getContent({
    owner,
    repo,
    path,
    ref: branch,
  });
  if (!Array.isArray(data)) return [path];
  let allPaths = [];
  for (const item of data) {
    if (item.type === "dir") {
      if (
        ["node_modules", ".git", ".next", "build", "dist"].includes(item.name)
      )
        continue;
      const subPaths = await fetchRepoContents(
        octokit,
        owner,
        repo,
        item.path,
        branch,
      );
      allPaths = [...allPaths, ...subPaths];
    } else {
      allPaths.push(item.path);
    }
  }
  return allPaths;
}

// Fetch content of a single file
async function fetchFileContent(octokit, owner, repo, path, branch = "main") {
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });
    return Buffer.from(data.content, "base64").toString("utf8");
  } catch (error) {
    console.error(`Could not fetch file ${path}: ${error.message}`);
    return null;
  }
}

// Construct enhanced prompt with retrieved code chunks (unchanged)
function constructEnhancedPrompt(
  query,
  retrievedChunks,
  fileStructure,
  packageMetadata,
  groupingSummary,
) {
  let codeContext = retrievedChunks
    .map((chunk, index) => {
      return `
------- Relevant Code Snippet ${index + 1} -------
File: ${chunk.metadata.filePath}
${
  chunk.metadata.chunkType === "function"
    ? `Function: ${chunk.metadata.chunkName}`
    : chunk.metadata.chunkType === "class"
    ? `Class: ${chunk.metadata.chunkName}`
    : chunk.metadata.chunkType === "variable"
    ? `Variable: ${chunk.metadata.chunkName}`
    : ""
}

\`\`\`
${chunk.content}
\`\`\`
`;
    })
    .join("\n\n");

  return `
You are a helpful assistant for a knowledge transfer tool. Given the following repository context:

File Structure Overview:
${fileStructure}

${packageMetadata}

File Grouping:
${groupingSummary}

RELEVANT CODE SNIPPETS FROM THE REPOSITORY:
${codeContext}

User Query: "${query}"

Provide a concise, accurate answer explaining the query in the context of this codebase. Refer to specific code snippets where relevant. Be precise and technical, but explain concepts clearly.
`;
}

module.exports = {
  indexRepository,
  searchCodebase,
  createRepoId,
  constructEnhancedPrompt,
  embeddingsStore,
};
