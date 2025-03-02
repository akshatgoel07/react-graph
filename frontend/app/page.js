"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import AuthButton from "../components/AuthButton";
import RepoList from "../components/RepoList";
import DiagramViewer from "../components/DiagramViewer";
import ChatBox from "../components/ChatBox";
import IndexingStatus from "../components/IndexingStatus";
import { fetchRepos } from "@/app/utils/api";

export default function Home() {
  const { data: session } = useSession();
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [showRepoList, setShowRepoList] = useState(true);
  const [reactFlowData, setReactFlowData] = useState(null);
  const [highlightedNodes, setHighlightedNodes] = useState([]);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexingStatus, setIndexingStatus] = useState(null);
  const [isRepoIndexed, setIsRepoIndexed] = useState(false);
  const [indexedChunks, setIndexedChunks] = useState(0);

  useEffect(() => {
    if (session?.accessToken) {
      fetchRepos(session.accessToken)
        .then(setRepos)
        .catch(() => setRepos([]));
    }
  }, [session]);

  useEffect(() => {
    if (selectedRepo) {
      setShowRepoList(false);
      setReactFlowData(null);
    }
  }, [selectedRepo]);

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <AuthButton />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="flex justify-between items-center p-4 border-b">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Flow</h1>
          {selectedRepo && (
            <button
              onClick={() => setShowRepoList(true)}
              className="text-blue-500 hover:underline"
            >
              Back to Repos
            </button>
          )}
        </div>
        <AuthButton session={session} />
      </nav>
      {showRepoList ? (
        <RepoList repos={repos} onRepoSelect={setSelectedRepo} />
      ) : (
        <div className="flex-1 flex flex-col">
          <IndexingStatus
            selectedRepo={selectedRepo}
            isIndexing={isIndexing}
            setIsIndexing={setIsIndexing}
            indexingStatus={indexingStatus}
            setIndexingStatus={setIndexingStatus}
            isRepoIndexed={isRepoIndexed}
            setIsRepoIndexed={setIsRepoIndexed}
            indexedChunks={indexedChunks}
            setIndexedChunks={setIndexedChunks}
            accessToken={session.accessToken}
          />
          <DiagramViewer
            reactFlowData={reactFlowData}
            setReactFlowData={setReactFlowData}
            highlightedNodes={highlightedNodes}
            selectedRepo={selectedRepo}
            accessToken={session.accessToken}
          />
          <ChatBox
            session={session}
            selectedRepo={selectedRepo}
            accessToken={session.accessToken}
            setHighlightedNodes={setHighlightedNodes}
          />
        </div>
      )}
    </div>
  );
}
