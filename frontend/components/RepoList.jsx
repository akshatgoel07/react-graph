"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LayoutList,
  LayoutGrid,
  Star,
  GitFork,
  Clock,
  Lock,
  Globe,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function RepoList({ repos, onRepoSelect, loading = false }) {
  const [hoveredRepo, setHoveredRepo] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [filteredRepos, setFilteredRepos] = useState(repos || []);
  const [viewMode, setViewMode] = useState("list");
  const [sortOption, setSortOption] = useState("created");

  useEffect(() => {
    if (!repos) return;

    let filtered = repos.filter((repo) => {
      const matchesSearch =
        repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (repo.description &&
          repo.description.toLowerCase().includes(searchQuery.toLowerCase()));

      if (filter === "all") return matchesSearch;
      if (filter === "private") return matchesSearch && repo.private;
      if (filter === "public") return matchesSearch && !repo.private;

      return matchesSearch;
    });

    filtered = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case "name":
          return a.name.localeCompare(b.name);
        case "stars":
          return (b.stargazers_count || 0) - (a.stargazers_count || 0);
        case "updated":
          return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
        case "created":
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        default:
          return 0;
      }
    });

    setFilteredRepos(filtered);
  }, [repos, searchQuery, filter, sortOption]);

  useEffect(() => {
    const savedViewMode = localStorage.getItem("repoViewMode");
    const savedFilter = localStorage.getItem("repoFilter");
    const savedSort = localStorage.getItem("repoSort");

    if (savedViewMode) setViewMode(savedViewMode);
    if (savedFilter) setFilter(savedFilter);
    if (savedSort) setSortOption(savedSort);
  }, []);

  useEffect(() => {
    localStorage.setItem("repoViewMode", viewMode);
    localStorage.setItem("repoFilter", filter);
    localStorage.setItem("repoSort", sortOption);
  }, [viewMode, filter, sortOption]);

  const formatDate = (dateString) => {
    if (!dateString) return "Unknown";
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="container py-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-8 w-48" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>

        <div
          className={`pb-4 ${
            viewMode === "grid" ? "grid grid-cols-2 gap-4" : "grid gap-4"
          }`}
        >
          {Array(6)
            .fill(0)
            .map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <Skeleton className="h-6 w-3/4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-5 w-full" />
                </CardFooter>
              </Card>
            ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <h1 className="text-2xl font-bold">Repositories</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Find a repository..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-64"
          />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-full sm:w-[120px]">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="private">Private</SelectItem>
              <SelectItem value="public">Public</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortOption} onValueChange={setSortOption}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created">Recently created</SelectItem>
              <SelectItem value="updated">Recently updated</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="stars">Stars</SelectItem>
            </SelectContent>
          </Select>
          <Tabs value={viewMode} onValueChange={setViewMode}>
            <TabsList>
              <TabsTrigger value="list">
                <LayoutList className="h-4 w-4 mr-1" />
                List
              </TabsTrigger>
              <TabsTrigger value="grid">
                <LayoutGrid className="h-4 w-4 mr-1" />
                Grid
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div
          className={`pb-4 ${
            viewMode === "grid"
              ? "grid grid-cols-1 md:grid-cols-2 gap-4"
              : "grid gap-4"
          }`}
        >
          {filteredRepos && filteredRepos.length > 0 ? (
            filteredRepos.map((repo) => (
              <Card
                key={repo.id || repo.name}
                className={`cursor-pointer transition-colors border ${
                  hoveredRepo === repo.id
                    ? "border-blue-500 bg-slate-50 dark:bg-slate-800"
                    : ""
                }`}
                onClick={() => onRepoSelect(repo)}
                onMouseEnter={() => setHoveredRepo(repo.id || repo.name)}
                onMouseLeave={() => setHoveredRepo(null)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    {repo.private ? (
                      <Lock className="h-4 w-4 text-orange-500" />
                    ) : (
                      <Globe className="h-4 w-4 text-green-500" />
                    )}
                    <CardTitle className="text-lg font-semibold">
                      {repo.full_name || repo.name}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="min-h-[40px]">
                    {repo.description || "No description available"}
                  </CardDescription>
                </CardContent>
                <CardFooter className="pt-2 flex flex-wrap gap-2">
                  {repo.language && (
                    <Badge variant="outline" className="mr-1">
                      {repo.language}
                    </Badge>
                  )}
                  {repo.stargazers_count > 0 && (
                    <Badge
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      <Star className="h-3 w-3" /> {repo.stargazers_count}
                    </Badge>
                  )}
                  {repo.forks_count > 0 && (
                    <Badge
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      <GitFork className="h-3 w-3" /> {repo.forks_count}
                    </Badge>
                  )}
                  <div className="ml-auto flex flex-wrap gap-1">
                    {repo.created_at && (
                      <Badge
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        Created: {formatDate(repo.created_at)}
                      </Badge>
                    )}
                    {repo.updated_at && (
                      <Badge
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        <Clock className="h-3 w-3" /> Updated:{" "}
                        {formatDate(repo.updated_at)}
                      </Badge>
                    )}
                  </div>
                </CardFooter>
              </Card>
            ))
          ) : (
            <div
              className={`text-center py-8 text-gray-500 ${
                viewMode === "grid" ? "col-span-1 md:col-span-2" : ""
              }`}
            >
              {searchQuery
                ? "No matching repositories found."
                : "No repositories found. Make sure your GitHub account has repositories and proper permissions are granted."}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
