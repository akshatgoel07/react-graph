"use client";

import { useState, useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2 } from "lucide-react";

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
    <Card className="border-t rounded-none shadow-none">
      <CardHeader className="pb-2 pt-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-sm font-medium">Chat</CardTitle>
          <Badge variant="outline" className="text-xs">
            {chatMessages.length > 1
              ? `${chatMessages.length - 1} messages`
              : "No messages yet"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0 px-4">
        <ScrollArea className="h-64 w-full pr-4">
          <div className="flex flex-col gap-2 py-2">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    msg.role === "user"
                      ? "bg-blue-100 text-blue-900"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg p-3 bg-gray-100 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-gray-500">Typing...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="pt-2 pb-4">
        <form onSubmit={handleSubmit} className="flex w-full gap-2">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder={
              selectedRepo
                ? "Ask about the codebase..."
                : "Select a repository first..."
            }
            className="flex-1"
            disabled={isLoading || !selectedRepo}
          />
          <Button type="submit" disabled={isLoading || !selectedRepo}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span className="ml-2">Send</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
