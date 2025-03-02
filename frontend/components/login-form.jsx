"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Clock, Shield, Sparkles } from "lucide-react";
import { FeatureCard } from "@/components/FeatureCards";

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2 bg-background text-foreground relative">
      <div className="relative flex flex-col justify-center items-center px-6 lg:px-12 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle,_rgba(0,0,0,0.08)_1px,_transparent_1px)] bg-[size:10px_10px] opacity-30 pointer-events-none"></div>
        <h1 className="text-3xl font-bold relative z-10">
          Welcome to React Graph
        </h1>
        <p className="mt-2 text-muted-foreground relative z-10">
          Your intelligent graph-based analytics tool for smarter insights.
        </p>
        <Button
          className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90 relative z-10"
          onClick={() => signIn("github")}
        >
          Login with GitHub
        </Button>
      </div>

      <div className="flex flex-col justify-center p-10 bg-muted/50">
        <div className="mb-6 text-center lg:text-left">
          <h2 className="text-2xl font-bold">Discover Powerful Analytics</h2>
          <p className="text-muted-foreground mt-1">
            Gain real-time insights and leverage AI-driven tools for better
            decision-making.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FeatureCard
            icon={<Calendar className="text-primary" />}
            title="Graph Visualization"
            description="Interactive and dynamic graph-based insights."
          />
          <FeatureCard
            icon={<Clock className="text-primary" />}
            title="Real-time Analytics"
            description="Monitor data changes in real-time."
          />
          <FeatureCard
            icon={<Sparkles className="text-primary" />}
            title="AI-Powered Insights"
            description="Leverage AI for better predictions."
          />
          <FeatureCard
            icon={<Shield className="text-primary" />}
            title="Secure Access"
            description="Enterprise-grade security for your data."
          />
        </div>
      </div>
    </div>
  );
}
