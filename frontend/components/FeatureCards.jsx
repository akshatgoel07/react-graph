import { Card, CardContent } from "@/components/ui/card";

export function FeatureCard({ icon, title, description }) {
  return (
    <Card className="bg-muted text-foreground border border-border shadow-sm scale-95">
      <CardContent className="p-4 flex flex-col items-start gap-2">
        <div className="p-2 bg-primary/10 rounded-lg">{icon}</div>
        <h3 className="font-semibold text-sm">{title}</h3>
        <p className="text-muted-foreground text-xs">{description}</p>
      </CardContent>
    </Card>
  );
}
