const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cors = require("cors");
const { Octokit } = require("@octokit/rest");
const dotenv = require("dotenv");
const {
  indexRepository,
  searchCodebase,
  createRepoId,
  constructEnhancedPrompt,
  embeddingsStore,
} = require("./rag-service");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
console.log("GEMINI_API_KEY:", process.env.GEMINI_API_KEY);

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

function formatFileStructure(paths) {
  const tree = {};
  for (const path of paths) {
    const parts = path.split("/");
    let current = tree;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) current[part] = null;
      else {
        if (!current[part]) current[part] = {};
        current = current[part];
      }
    }
  }
  function stringifyTree(node, prefix = "", isLast = true) {
    const entries = Object.entries(node || {});
    if (entries.length === 0) return "";
    let result = "";
    entries.forEach(([key, value], index) => {
      const isLastItem = index === entries.length - 1;
      const connector = isLast ? "└── " : "├── ";
      const childPrefix = isLast ? "    " : "│   ";
      result += `${prefix}${connector}${key}\n`;
      if (value !== null)
        result += stringifyTree(value, prefix + childPrefix, isLastItem);
    });
    return result;
  }
  return stringifyTree(tree);
}

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

function groupFiles(paths) {
  const groups = {
    "Frontend Layer": {
      "Core Pages": [],
      "Reusable Components": [],
      "Custom Hooks": [],
    },
    "Backend Layer": { "API Routes": [], "Data Layer": [] },
    Shared: { Utils: [], Config: [] },
  };
  paths.forEach((filePath) => {
    if (
      filePath.includes("migration") &&
      (filePath.endsWith(".sql") || filePath.includes("migration_lock"))
    )
      return;
    if (filePath.includes("pages"))
      groups["Frontend Layer"]["Core Pages"].push(filePath);
    if (filePath.includes("components"))
      groups["Frontend Layer"]["Reusable Components"].push(filePath);
    if (filePath.includes("hooks"))
      groups["Frontend Layer"]["Custom Hooks"].push(filePath);
    if (filePath.includes("routes"))
      groups["Backend Layer"]["API Routes"].push(filePath);
    if (filePath.includes("prisma"))
      groups["Backend Layer"]["Data Layer"].push(filePath);
    if (filePath.includes("utils")) groups["Shared"]["Utils"].push(filePath);
    if (filePath.includes("config")) groups["Shared"]["Config"].push(filePath);
  });
  return groups;
}

function formatGrouping(grouping) {
  let result = "";
  for (const [container, subgroups] of Object.entries(grouping)) {
    result += `${container}:\n`;
    for (const [groupName, files] of Object.entries(subgroups)) {
      result += `  ${groupName}:\n`;
      if (files.length === 0) result += "    (No files detected)\n";
      else files.forEach((file) => (result += `    - ${file}\n`));
    }
  }
  return result;
}

app.post("/generate-react-flow", async (req, res) => {
  try {
    const { accessToken, owner, repo, branch = "main" } = req.body;
    const octokit = new Octokit({ auth: accessToken });
    const paths = await fetchRepoContents(octokit, owner, repo, "", branch);
    const packageJsonContent = await fetchFileContent(
      octokit,
      owner,
      repo,
      "package.json",
      branch,
    );
    let packageMetadata = "";
    if (packageJsonContent) {
      const packageJson = JSON.parse(packageJsonContent);
      const dependencies = packageJson.dependencies
        ? Object.keys(packageJson.dependencies).join(", ")
        : "None";
      const devDependencies = packageJson.devDependencies
        ? Object.keys(packageJson.devDependencies).join(", ")
        : "None";
      packageMetadata = `Detected technologies:\nDependencies: ${dependencies}\nDev Dependencies: ${devDependencies}`;
    }
    const groupingSummary = formatGrouping(groupFiles(paths));
    const prompt = `
Given the following file structure of a web application:
${formatFileStructure(paths)}
${packageMetadata}
Additionally, here is a logical grouping of the files:
${groupingSummary}
Generate a React Flow compatible JSON with nodes and edges. Follow this exact structure from the example:
{
  "nodes": [{"id": "user", "type": "default", "position": { x: 300, y: 50 }, "data": { label: "User/Client" }}],
  "edges": [{"id": "edge-1", "source": "node1", "target": "node2", "animated": true, "type": "smoothstep"}]
}
    `;
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const rawResponse = result.response.text().trim();
    const cleanedResponse = rawResponse
      .replace(/^```(?:json)?\s*/, "")
      .replace(/\s*```$/, "");
    res.json({
      flowData: cleanedResponse,
      fileStructure: formatFileStructure(paths),
      packageMetadata,
      groupingSummary,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/verify-token", async (req, res) => {
  try {
    const { accessToken } = req.body;
    const octokit = new Octokit({ auth: accessToken });
    const { data: user } = await octokit.users.getAuthenticated();
    res.json({ valid: true, user });
  } catch (error) {
    res.json({ valid: false, error: error.message });
  }
});

app.post("/chat", async (req, res) => {
  try {
    const { messages, accessToken, owner, repo, branch = "main" } = req.body;
    if (!messages || !messages.length) {
      return res.status(400).json({ error: "No messages provided" });
    }

    const userMessage = messages[messages.length - 1].content;
    console.log(`[CHAT DEBUG] Query: "${userMessage}"`);
    console.log(`[CHAT DEBUG] Repository: ${owner}/${repo}`);

    const octokit = new Octokit({ auth: accessToken });
    const paths = await fetchRepoContents(octokit, owner, repo, "", branch);
    const fileStructure = formatFileStructure(paths);

    const packageJsonContent = await fetchFileContent(
      octokit,
      owner,
      repo,
      "package.json",
      branch,
    );
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
        packageMetadata = "Could not parse package.json";
      }
    }

    const groupingSummary = formatGrouping(groupFiles(paths));
    const repoId = createRepoId(owner, repo);
    const relevantChunks = await searchCodebase(repoId, userMessage, 3);

    console.log(`[CHAT DEBUG] Found ${relevantChunks.length} relevant chunks`);
    if (relevantChunks.length > 0) {
      console.log(
        `[CHAT DEBUG] Top ${Math.min(
          3,
          relevantChunks.length,
        )} relevant chunks:`,
      );
      relevantChunks.slice(0, 3).forEach((chunk, i) => {
        console.log(`[CHAT DEBUG] ${i + 1}. File: ${chunk.metadata.filePath}`);
        console.log(`[CHAT DEBUG]    Type: ${chunk.metadata.chunkType}`);
        console.log(
          `[CHAT DEBUG]    Similarity: ${chunk.similarity.toFixed(4)}`,
        );
        console.log(
          `[CHAT DEBUG]    First 100 chars: ${chunk.content
            .substring(0, 100)
            .replace(/\n/g, " ")}...`,
        );
      });
    }

    let prompt;
    if (relevantChunks.length === 0) {
      console.log("[CHAT DEBUG] No indexed content found, using basic prompt");
      prompt = `
        You are a helpful assistant for a knowledge transfer tool. Given the following repository context:
        File Structure: ${fileStructure}
        ${packageMetadata}
        File Grouping: ${groupingSummary}
        User Query: "${userMessage}"
        Provide a concise answer explaining the query in the context of this codebase.
      `;
    } else {
      prompt = constructEnhancedPrompt(
        userMessage,
        relevantChunks,
        fileStructure,
        packageMetadata,
        groupingSummary,
      );
    }

    console.log(
      `[CHAT DEBUG] Complete prompt length: ${prompt.length} characters`,
    );
    console.log(
      `[CHAT DEBUG] First 500 chars of prompt: ${prompt.substring(0, 500)}...`,
    );

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const geminiStream = await model.generateContentStream(prompt);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let completeResponse = "";
    for await (const chunk of geminiStream.stream) {
      const text = chunk.text();
      completeResponse += text;
      const aiMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: text,
      };
      res.write(`data: ${JSON.stringify(aiMessage)}\n\n`);
    }

    try {
      const highlightPrompt = `
        Based on this explanation about the codebase, what components or files should be highlighted?
        "${completeResponse}"
        Extract file names, component names, or module names mentioned as important.
        Return ONLY a JSON array of these names, like: ["page.js", "ReactFlowDiagram", "API Routes"]
      `;
      const highlightResult = await model.generateContent(highlightPrompt);
      const highlightText = highlightResult.response.text();

      let highlightData = [];
      try {
        const match = highlightText.match(/\[.*\]/s);
        if (match) highlightData = JSON.parse(match[0]);
      } catch (e) {
        console.error("Failed to parse highlight data:", e);
      }

      if (highlightData.length > 0) {
        const functionCall = {
          id: Date.now().toString(),
          role: "assistant",
          content: "",
          function_call: {
            name: "setHighlight",
            arguments: JSON.stringify({ highlight: highlightData }),
          },
        };
        res.write(`data: ${JSON.stringify(functionCall)}\n\n`);
      }
    } catch (e) {
      console.error("Error in highlight processing:", e);
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("Chat Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/index-repository", async (req, res) => {
  try {
    const { accessToken, owner, repo, branch = "main" } = req.body;
    console.log(`[INDEXING SERVER] Starting indexing of ${owner}/${repo}`);

    if (!accessToken || !owner || !repo) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const result = await indexRepository(accessToken, owner, repo, branch);
    res.json(result);
  } catch (error) {
    console.error("[INDEXING SERVER] Repository indexing failed:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/index-status", async (req, res) => {
  try {
    const { owner, repo } = req.query;

    if (!owner || !repo) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const repoId = createRepoId(owner, repo);
    const embeddings = await embeddingsStore.getEmbeddings(repoId);
    const isIndexed = Object.keys(embeddings).length > 0;

    res.json({
      indexed: isIndexed,
      chunkCount: Object.keys(embeddings).length,
    });
  } catch (error) {
    console.error("Error checking index status:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
