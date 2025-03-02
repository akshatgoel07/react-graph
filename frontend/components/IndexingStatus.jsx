"use client";

import { useState, useEffect } from "react";
import {
  analyzeReactFlowRepo,
  checkIndexStatus,
  indexRepository,
} from "@/app/utils/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, AlertTriangle, RefreshCw } from "lucide-react";

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
    <Card className="border-none shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          {selectedRepo.full_name} - Architecture Diagram
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm">
          {isRepoIndexed ? (
            <Badge
              variant="outline"
              className="bg-green-50 text-green-600 flex items-center gap-1 py-1"
            >
              <CheckCircle className="h-4 w-4" />
              Repository indexed ({indexedChunks} code chunks)
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="bg-amber-50 text-amber-600 flex items-center gap-1 py-1"
            >
              <AlertTriangle className="h-4 w-4" />
              Repository not indexed (answers may be limited)
            </Badge>
          )}

          {!isRepoIndexed && !isIndexing && (
            <Button
              variant="default"
              size="sm"
              onClick={handleIndex}
              disabled={isIndexing}
              className="ml-1 px-2 py-1 h-7 text-xs"
            >
              Index Now
            </Button>
          )}

          {isIndexing && (
            <Badge
              variant="outline"
              className="bg-blue-50 text-blue-600 flex items-center gap-1 py-1"
            >
              <RefreshCw className="h-4 w-4 animate-spin" />
              Indexing in progress...
            </Badge>
          )}
        </div>

        {indexingStatus && (
          <div className="text-xs text-gray-600 mt-1">{indexingStatus}</div>
        )}
      </CardContent>
    </Card>
  );
}
