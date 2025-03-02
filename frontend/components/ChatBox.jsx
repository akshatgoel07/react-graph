"use client";

import { useState, useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";

export default function ChatComponent({ session, selectedRepo }) {
  const chatContainerRef = useRef(null);
  const [chatMessages, setChatMessages] = useState([]);

  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: "http://localhost:3001/chat",
      initialMessages: [
        {
          id: "1",
          role: "system",
          content: "I'm here to help you understand your codebase!",
        },
      ],
      body: selectedRepo
        ? {
            accessToken: session.accessToken,
            owner: selectedRepo.owner.login,
            repo: selectedRepo.name,
            branch: selectedRepo.default_branch,
          }
        : {},
      functions: {
        setHighlight: (args) => {
          try {
            const parsedArgs = JSON.parse(args);
            if (parsedArgs.highlight) {
              console.log("Setting highlighted nodes:", parsedArgs.highlight);
            }
          } catch (error) {
            console.error("Error parsing highlight data:", error);
          }
        },
      },
      onResponse: (response) => {
        console.log("Chat response received:", response.status);
      },
      onFinish: (message) => {
        console.log("Chat message completed:", message);
      },
      onError: (error) => {
        console.error("Chat error:", error);
      },
    });

  useEffect(() => {
    setChatMessages(messages);
  }, [messages]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  return (
    <div className="p-4 border-t bg-white">
      <div className="text-xs text-gray-500 mb-1">
        {chatMessages.length > 1
          ? `${chatMessages.length - 1} messages`
          : "No messages yet"}
      </div>

      <div
        ref={chatContainerRef}
        className="max-h-64 overflow-y-auto mb-2 border border-gray-200 p-2 rounded"
      >
        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={`mb-2 ${
              msg.role === "user" ? "text-right" : "text-left"
            }`}
          >
            <span
              className={`inline-block p-2 rounded-lg ${
                msg.role === "user"
                  ? "bg-blue-100 text-blue-900"
                  : "bg-gray-100 text-gray-900"
              }`}
              style={{ maxWidth: "80%", wordBreak: "break-word" }}
            >
              {msg.content}
            </span>
          </div>
        ))}
        {isLoading && <div className="text-gray-500">Typing...</div>}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder={
            selectedRepo
              ? "Ask about the codebase..."
              : "Select a repository first..."
          }
          className="flex-1 p-2 border rounded-lg"
          disabled={isLoading || !selectedRepo}
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded-lg"
          disabled={isLoading || !selectedRepo}
        >
          Send
        </button>
      </form>
    </div>
  );
}
