const { Octokit } = require("@octokit/rest");
const path = require("path");

async function fetchRepoContents(
  octokit,
  owner,
  repo,
  path = "",
  branch = "main",
) {
  try {
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
  } catch (error) {
    console.error(`Error fetching repo contents: ${error.message}`);
    throw error;
  }
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

function createOctokitClient(accessToken) {
  return new Octokit({ auth: accessToken });
}

module.exports = {
  fetchRepoContents,
  fetchFileContent,
  createOctokitClient,
};
