const path = require("path");

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

/**
 * Format file structure for display
 * @param {Array<string>} paths - Array of file paths
 * @returns {string} - Formatted tree structure
 */
function formatFileStructure(paths) {
  const tree = {};

  // Build tree structure
  for (const path of paths) {
    const parts = path.split("/");
    let current = tree;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        current[part] = null;
      } else {
        if (!current[part]) current[part] = {};
        current = current[part];
      }
    }
  }

  // Recursively stringify tree
  function stringifyTree(node, prefix = "", isLast = true) {
    const entries = Object.entries(node || {});
    if (entries.length === 0) return "";

    let result = "";
    entries.forEach(([key, value], index) => {
      const isLastItem = index === entries.length - 1;
      const connector = isLast ? "└── " : "├── ";
      const childPrefix = isLast ? "    " : "│   ";

      result += `${prefix}${connector}${key}\n`;

      if (value !== null) {
        result += stringifyTree(value, prefix + childPrefix, isLastItem);
      }
    });

    return result;
  }

  return stringifyTree(tree);
}

/**
 * Group files by logical categories
 * @param {Array<string>} paths - Array of file paths
 * @returns {object} - Grouped files by category
 */
function groupFiles(paths) {
  const groups = {
    "Frontend Layer": {
      "Core Pages": [],
      "Reusable Components": [],
      "Custom Hooks": [],
    },
    "Backend Layer": {
      "API Routes": [],
      "Data Layer": [],
    },
    Shared: {
      Utils: [],
      Config: [],
    },
  };

  paths.forEach((filePath) => {
    // Skip migration files
    if (
      filePath.includes("migration") &&
      (filePath.endsWith(".sql") || filePath.includes("migration_lock"))
    ) {
      return;
    }

    // Frontend files
    if (filePath.includes("pages")) {
      groups["Frontend Layer"]["Core Pages"].push(filePath);
    }
    if (filePath.includes("components")) {
      groups["Frontend Layer"]["Reusable Components"].push(filePath);
    }
    if (filePath.includes("hooks")) {
      groups["Frontend Layer"]["Custom Hooks"].push(filePath);
    }

    // Backend files
    if (filePath.includes("routes") || filePath.includes("api")) {
      groups["Backend Layer"]["API Routes"].push(filePath);
    }
    if (filePath.includes("prisma") || filePath.includes("models")) {
      groups["Backend Layer"]["Data Layer"].push(filePath);
    }

    // Shared files
    if (filePath.includes("utils")) {
      groups["Shared"]["Utils"].push(filePath);
    }
    if (filePath.includes("config")) {
      groups["Shared"]["Config"].push(filePath);
    }
  });

  return groups;
}

/**
 * Format grouped files for display
 * @param {object} grouping - Grouped files object
 * @returns {string} - Formatted grouping text
 */
function formatGrouping(grouping) {
  let result = "";

  for (const [container, subgroups] of Object.entries(grouping)) {
    result += `${container}:\n`;

    for (const [groupName, files] of Object.entries(subgroups)) {
      result += `  ${groupName}:\n`;

      if (files.length === 0) {
        result += "    (No files detected)\n";
      } else {
        files.forEach((file) => (result += `    - ${file}\n`));
      }
    }
  }

  return result;
}

module.exports = {
  shouldProcessFile,
  chunkCodeFile,
  formatFileStructure,
  groupFiles,
  formatGrouping,
};
