import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Loader2,
  Calendar,
  MapPin,
  TrendingUp,
  X,
  Zap,
  Wrench,
} from "lucide-react";

interface RaceResult {
  id: string;
  score: number;
  metadata: {
    name: string;
    city: string;
    state: string;
    distance: string;
    difficulty: string;
    date: string;
  };
}

interface SearchResponse {
  answer: string;
  tool_used: string;
  tool_args: Record<string, string>;
  races: RaceResult[];
  latency: {
    routing_ms: number;
    embedding_ms: number;
    search_ms: number;
    llm_ms: number;
    total_ms: number;
  };
}

interface NLSearchResultsProps {
  result: SearchResponse | null;
  error: string | null;
  isLoading: boolean;
  onClear: () => void;
}

const NLSearchResults = ({ result, error, isLoading, onClear }: NLSearchResultsProps) => {
  const navigate = useNavigate();

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Easy":
        return "bg-green-50 border-green-200 text-green-700";
      case "Moderate":
        return "bg-yellow-50 border-yellow-200 text-yellow-700";
      case "Challenging":
        return "bg-red-50 border-red-200 text-red-700";
      default:
        return "bg-gray-50 border-gray-200 text-gray-700";
    }
  };

  const formatDate = (dateStr: string): string => {
    try {
      let date: Date;
      if (dateStr.includes("/")) {
        const [month, day, year] = dateStr.split("/");
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else {
        date = new Date(dateStr);
      }
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">
            Searching across 4,891 races with AI...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="p-4 border-destructive/30 bg-destructive/5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    );
  }

  if (!result) return null;

  return (
    <div className="space-y-6">
      {/* AI Answer Card */}
      <Card className="p-5 bg-gradient-to-br from-primary/5 to-blue-500/5 border-primary/20 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-heading font-semibold text-sm text-primary">
                AI Recommendation
              </h4>
              {result.tool_used && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-primary/5 border-primary/20 text-primary">
                  <Wrench className="h-2.5 w-2.5 mr-1" />
                  {result.tool_used}
                </Badge>
              )}
            </div>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
              {result.answer}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClear} className="flex-shrink-0 -mt-1 -mr-1">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {/* Matched Races */}
      <div className="space-y-3">
        <h4 className="font-heading font-semibold text-sm text-muted-foreground">
          Top Matches
        </h4>
        <div className="grid gap-3">
          {result.races.map((race) => (
            <Card
              key={race.id}
              className="p-4 cursor-pointer hover:shadow-md hover:border-primary/20 transition-all duration-200 group"
              onClick={() => navigate(`/race/${race.id}`)}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h5 className="font-heading font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                    {race.metadata.name}
                  </h5>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatDate(race.metadata.date)}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {race.metadata.city}, {race.metadata.state}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <TrendingUp className="h-3 w-3" />
                      {race.metadata.distance}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge
                    variant="outline"
                    className={getDifficultyColor(race.metadata.difficulty)}
                  >
                    {race.metadata.difficulty}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="bg-primary/5 border-primary/20 text-primary text-xs tabular-nums"
                  >
                    {Math.round(race.score * 100)}% match
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Latency Footer */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Zap className="h-3 w-3" />
        <span>
          Found in {(result.latency.total_ms / 1000).toFixed(1)}s via Fireworks
          (route: {result.latency.routing_ms}ms | embed: {result.latency.embedding_ms}ms | search:{" "}
          {result.latency.search_ms}ms | LLM: {result.latency.llm_ms}ms)
        </span>
      </div>
    </div>
  );
};

export default NLSearchResults;
