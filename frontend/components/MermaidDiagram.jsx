"use client";

import { useEffect, useRef } from "react";
import mermaid from "mermaid";

export default function MermaidDiagram({ diagram, nodeDescriptions = {} }) {
  const containerRef = useRef(null);

  const createTooltip = (e, text) => {
    const tooltip = document.createElement("div");
    tooltip.className =
      "tooltip absolute bg-gray-800 text-white p-2 rounded text-sm max-w-xs z-50";
    tooltip.textContent = text;
    document.body.appendChild(tooltip);
    tooltip.style.left = `${e.pageX + 10}px`;
    tooltip.style.top = `${e.pageY + 10}px`;
    return tooltip;
  };

  const showTooltip = (e, text) => {
    const tooltip = createTooltip(e, text);
    e.target.tooltipElement = tooltip;
    console.log("DEBUG: Showing tooltip for node:", text);
  };

  const hideTooltip = (e) => {
    if (e.target.tooltipElement) {
      console.log("DEBUG: Hiding tooltip");
      e.target.tooltipElement.remove();
      e.target.tooltipElement = null;
    }
  };

  useEffect(() => {
    if (containerRef.current) {
      // Mermaid configuration settings
      const mermaidConfig = {
        startOnLoad: true,
        securityLevel: "loose",
        theme: "default",
        flowchart: {
          diagramPadding: 50,
          nodeSpacing: 80,
          rankSpacing: 100,
          curve: "linear",
        },
        htmlLabels: true,
      };

      console.log("DEBUG: Mermaid configuration:", mermaidConfig);
      mermaid.initialize(mermaidConfig);

      // Clean the diagram string
      const cleanDiagram = diagram
        .replace(/```mermaid/g, "")
        .replace(/```/g, "")
        .trim();
      console.log("DEBUG: Cleaned diagram string:", cleanDiagram);

      const uniqueId = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
      console.log("DEBUG: Unique diagram ID:", uniqueId);

      mermaid
        .render(uniqueId, cleanDiagram)
        .then(({ svg }) => {
          containerRef.current.innerHTML = svg;
          console.log("DEBUG: SVG rendered successfully");
          console.log("DEBUG: Rendered SVG:", containerRef.current.innerHTML);

          // Attempt to select nodes by checking for <g class="node">
          const nodes = containerRef.current.querySelectorAll(".node");
          console.log("DEBUG: Found", nodes.length, "nodes");

          nodes.forEach((node, index) => {
            console.log(`DEBUG: Processing node ${index + 1}:`, node);
            // Try to find a text element within the node
            const textElement = node.querySelector("text");
            if (!textElement) {
              console.log(
                `DEBUG: No <text> element found in node ${index + 1}`,
              );
              return;
            }

            const nodeText = textElement.textContent.trim();
            if (!nodeText) {
              console.log(`DEBUG: Node ${index + 1} has empty text content`);
              return;
            }

            const nodeId = nodeText.replace(/\s+/g, "_").toLowerCase();
            console.log(`DEBUG: Attaching events for node: ${nodeId}`);

            const nodeData = nodeDescriptions[nodeId] || {};
            const description =
              nodeData.description || `Component: ${nodeText}`;
            const link = nodeData.link;

            textElement.style.cursor = link ? "pointer" : "default";

            textElement.addEventListener("mouseenter", (e) => {
              showTooltip(e, description);
            });
            textElement.addEventListener("mouseleave", hideTooltip);

            textElement.addEventListener("click", (e) => {
              e.stopPropagation();
              console.log(`DEBUG: Node clicked: ${nodeId}`, "Link:", link);
              if (link) {
                window.open(link, "_blank");
              } else {
                console.log(`DEBUG: No link provided for node ${nodeId}`);
              }
            });
          });
        })
        .catch((error) => {
          console.error("Mermaid rendering error:", error);
          containerRef.current.innerHTML = `
            <div class="text-red-500">
              Failed to render diagram. Please check the diagram syntax.
            </div>
          `;
        });
    }

    return () => {
      const tooltips = document.querySelectorAll(".tooltip");
      tooltips.forEach((tooltip) => tooltip.remove());
    };
  }, [diagram, nodeDescriptions]);

  return (
    <div
      ref={containerRef}
      className="overflow-auto p-6 border rounded-lg bg-white shadow-sm min-h-[400px] w-full"
    />
  );
}
