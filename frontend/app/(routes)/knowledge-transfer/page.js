"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import RepoList from "@/components/RepoList";
import DiagramViewer from "@/components/DiagramViewer";
import ChatBox from "@/components/ChatBox";
import IndexingStatus from "@/components/IndexingStatus";
import { fetchRepos } from "@/app/utils/api";

export default function KnowledgeTransfer() {
  const { data: session, status } = useSession();
  const router = useRouter();
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
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

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

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {showRepoList ? (
        <RepoList repos={repos} onRepoSelect={setSelectedRepo} />
      ) : (
        <div className="container py-6 max-w-6xl mx-auto">
          <div className="p-4">
            <button
              onClick={() => setShowRepoList(true)}
              className="text-blue-500 hover:underline"
            >
              Back to Repos
            </button>
          </div>
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
