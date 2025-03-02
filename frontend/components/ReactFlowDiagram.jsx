import { useCallback, useMemo } from "react";
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MiniMap,
} from "reactflow";
import "reactflow/dist/style.css";

function cleanupFlowData(rawData) {
  console.log("Raw data received:", rawData);

  if (typeof rawData === "string") {
    console.log("Attempting to parse string data:", rawData);
    try {
      const parsed = JSON.parse(rawData);
      return parsed; // Proceed with further processing
    } catch (error) {
      console.error("JSON Parsing Error:", error);
      console.log("Invalid JSON string:", rawData);
      return { nodes: [], edges: [] }; // Fallback to avoid crashes
    }
  } else {
    console.log("Using object data directly:", rawData);
    return rawData; // Assuming it's already an object
  }
}

export default function ReactFlowDiagram({ flowData, highlightedNodes = [] }) {
  console.log("Component rendered with flowData:", flowData);
  console.log("Highlighted nodes:", highlightedNodes);

  const cleanedData = useMemo(() => {
    const result = cleanupFlowData(flowData);
    console.log("Cleaned data result:", result);
    return result;
  }, [flowData]);

  const [nodes, setNodes, onNodesChange] = useNodesState(
    useMemo(() => {
      return cleanedData.nodes.map((node) => ({
        ...node,
        style: highlightedNodes.includes(node.id)
          ? {
              backgroundColor: "#ffeb3b", // Yellow background for highlight
              borderColor: "#f00", // Red border
              borderWidth: 2,
            }
          : {
              backgroundColor: "#fff", // Default background
              borderColor: "#000",
              borderWidth: 1,
            },
      }));
    }, [cleanedData.nodes, highlightedNodes]), // Recompute when flowData or highlightedNodes change
  );

  const [edges, setEdges, onEdgesChange] = useEdgesState(cleanedData.edges);

  console.log("Current nodes:", nodes);
  console.log("Current edges:", edges);

  const onInit = useCallback((reactFlowInstance) => {
    console.log("ReactFlow initialized:", reactFlowInstance);
    reactFlowInstance.fitView();
  }, []);

  // Early return with debug info if no data
  if (!flowData) {
    return (
      <div className="p-4 text-red-500">
        <p>No flow data available</p>
        <p>Received: {JSON.stringify(flowData)}</p>
      </div>
    );
  }

  // Early return with debug info if no nodes/edges
  if (!nodes.length && !edges.length) {
    return (
      <div className="p-4 text-red-500">
        <p>No nodes or edges available after processing</p>
        <p>
          Original data:{" "}
          {typeof flowData === "string" ? flowData : JSON.stringify(flowData)}
        </p>
        <p>Cleaned nodes: {JSON.stringify(nodes)}</p>
        <p>Cleaned edges: {JSON.stringify(edges)}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-[600px] border border-gray-200 rounded-lg">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={onInit}
        fitView
        className="bg-white"
      >
        <Controls />
        <MiniMap />
        <Background color="#f8f8f8" gap={16} />
      </ReactFlow>
    </div>
  );
}
