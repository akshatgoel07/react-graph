const axios = require("axios");
const { createHash } = require("crypto");
const config = require("../config/env");

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

function createRepoId(owner, repo) {
  return createHash("md5").update(`${owner}/${repo}`).digest("hex");
}

function createFileId(filePath, content) {
  return createHash("md5").update(`${filePath}:${content}`).digest("hex");
}

async function generateEmbeddings(text) {
  try {
    const response = await axios.post(
      "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2",
      { inputs: text },
      {
        headers: {
          Authorization: `Bearer ${config.hfApiKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    const embedding = response.data;

    if (!Array.isArray(embedding)) {
      throw new Error(`Invalid embedding format: ${JSON.stringify(embedding)}`);
    }

    return embedding;
  } catch (error) {
    console.error("Error generating embeddings:", error.message);
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

async function searchVectors(repoId, queryVector, topK = 5) {
  const embeddings = await embeddingsStore.getEmbeddings(repoId);

  const results = Object.entries(embeddings)
    .map(([fileId, data]) => ({
      fileId,
      score: cosineSimilarity(queryVector, data.vector),
      content: data.content,
      metadata: data.metadata,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return results;
}

module.exports = {
  embeddingsStore,
  createRepoId,
  createFileId,
  generateEmbeddings,
  cosineSimilarity,
  searchVectors,
};
