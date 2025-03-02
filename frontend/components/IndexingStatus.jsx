"use client";

import { useState, useEffect } from "react";
import {
  analyzeReactFlowRepo,
  checkIndexStatus,
  indexRepository,
} from "@/app/utils/api";

export default function IndexingStatus({
  selectedRepo,
  isIndexing,
  setIsIndexing,
  indexingStatus,
  setIndexingStatus,
  isRepoIndexed,
  setIsRepoIndexed,
  indexedChunks,
  setIndexedChunks,
  accessToken,
}) {
  useEffect(() => {
    if (selectedRepo) {
      checkIndexStatus(selectedRepo)
        .then((data) => {
          setIsRepoIndexed(data.indexed);
          setIndexedChunks(data.chunkCount || 0);
        })
        .catch(() => {
          setIsRepoIndexed(false);
          setIndexedChunks(0);
        });
    }
  }, [selectedRepo]);

  const handleIndex = () => {
    setIsIndexing(true);
    setIndexingStatus("Starting indexing process...");
    indexRepository(selectedRepo, accessToken)
      .then((data) => {
        if (data.success) {
          setIndexingStatus(
            `Indexing complete! Processed ${data.filesProcessed} files.`,
          );
          setIsRepoIndexed(true);
          setIndexedChunks(data.filesProcessed || 0);
        } else {
          setIndexingStatus(`Indexing failed: ${data.error}`);
        }
      })
      .catch((err) => setIndexingStatus(`Error: ${err.message}`))
      .finally(() => setIsIndexing(false));
  };

  return (
    <div className="p-4 flex justify-between items-center">
      <div>
        <h2 className="text-xl">
          {selectedRepo.full_name} - Architecture Diagram
        </h2>
        <div className="mt-2 text-sm">
          {isRepoIndexed ? (
            <span className="text-green-600">
              ✓ Repository indexed ({indexedChunks} code chunks)
            </span>
          ) : (
            <span className="text-amber-600">
              ⚠ Repository not indexed (answers may be limited)
            </span>
          )}
          {!isRepoIndexed && !isIndexing && (
            <button
              onClick={handleIndex}
              className="ml-2 bg-blue-500 text-white px-2 py-1 rounded text-xs"
              disabled={isIndexing}
            >
              Index Now
            </button>
          )}
          {isIndexing && (
            <span className="ml-2 text-blue-600 animate-pulse">
              Indexing in progress...
            </span>
          )}
          {indexingStatus && (
            <div className="text-xs text-gray-600 mt-1">{indexingStatus}</div>
          )}
        </div>
      </div>
    </div>
  );
}
