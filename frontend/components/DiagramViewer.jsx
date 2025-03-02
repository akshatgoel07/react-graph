"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { analyzeReactFlowRepo } from "@/app/utils/api";

const ReactFlowDiagram = dynamic(() => import("./ReactFlowDiagram"), {
  ssr: false,
});

export default function DiagramViewer({
  reactFlowData,
  setReactFlowData,
  highlightedNodes,
  selectedRepo,
  accessToken,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (selectedRepo && !reactFlowData) {
      setLoading(true);
      setError(null);
      analyzeReactFlowRepo(selectedRepo, accessToken)
        .then((data) => setReactFlowData(data.flowData))
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [selectedRepo, reactFlowData, accessToken]);

  return (
    <div className="flex-1 p-4">
      {loading && <div className="text-center">Analyzing repository...</div>}
      {error && <div className="text-red-500 text-center">{error}</div>}
      {reactFlowData && !loading && (
        <ReactFlowDiagram
          flowData={reactFlowData}
          highlightedNodes={highlightedNodes}
        />
      )}
    </div>
  );
}
