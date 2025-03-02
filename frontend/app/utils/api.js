import { Octokit } from "@octokit/rest";

export async function fetchRepos(accessToken) {
  const octokit = new Octokit({ auth: accessToken });
  const { data } = await octokit.repos.listForAuthenticatedUser();
  return data;
}

export async function analyzeReactFlowRepo(repo, accessToken) {
  const response = await fetch("http://localhost:3001/generate-react-flow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accessToken,
      owner: repo.owner.login,
      repo: repo.name,
      branch: repo.default_branch,
    }),
  });
  if (!response.ok) throw new Error("Failed to generate React Flow data");
  return response.json();
}

export async function checkIndexStatus(repo) {
  const response = await fetch(
    `http://localhost:3001/index-status?owner=${repo.owner.login}&repo=${repo.name}`,
  );
  if (!response.ok) throw new Error("Failed to check index status");
  return response.json();
}

export async function indexRepository(repo, accessToken) {
  const response = await fetch("http://localhost:3001/index-repository", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accessToken,
      owner: repo.owner.login,
      repo: repo.name,
      branch: repo.default_branch,
    }),
  });
  if (!response.ok) throw new Error("Indexing failed");
  return response.json();
}
