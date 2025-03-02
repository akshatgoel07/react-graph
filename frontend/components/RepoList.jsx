"use client";

export default function RepoList({ repos, onRepoSelect }) {
  return (
    <div className="p-8">
      <h2 className="text-xl mb-4">Your Repositories</h2>
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {repos.map((repo) => (
          <div
            key={repo.id}
            onClick={() => onRepoSelect(repo)}
            className="p-4 border rounded-lg cursor-pointer hover:bg-gray-50"
          >
            <h3 className="font-medium">{repo.full_name}</h3>
            <p className="text-sm text-gray-600">{repo.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
