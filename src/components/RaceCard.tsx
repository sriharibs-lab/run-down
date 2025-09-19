import { Calendar, MapPin, Users, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface RaceCardProps {
  id: string;
  image: string;
  name: string;
  date: string;
  location: string;
  distances: string[];
  difficulty: "Easy" | "Moderate" | "Challenging" | "Beginner";
  participants?: number;
  onClick?: () => void;
}

const RaceCard = ({
  image,
  name,
  date,
  location,
  distances,
  difficulty,
  participants,
  onClick
}: RaceCardProps) => {
  const getDifficultyBadgeClass = (diff: string) => {
    switch (diff) {
      case "Easy":
        return "badge-easy";
      case "Moderate":
        return "badge-moderate";
      case "Challenging":
        return "badge-challenging";
      default:
        return "badge-easy";
    }
  };

  return (
    <Card 
      className="card-race cursor-pointer group h-full transition-all duration-300 hover:shadow-xl hover:scale-105 hover:border-primary/20"
      onClick={onClick}
    >
      {/* Race Image */}
      <div className="relative h-48 overflow-hidden">
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <div className="absolute top-3 right-3">
          <Badge className={`${getDifficultyBadgeClass(difficulty)} border font-medium`}>
            {difficulty}
          </Badge>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-4 space-y-3">
        {/* Race Title - Fixed height to ensure consistent alignment */}
        <h3 className="font-heading font-semibold text-lg text-foreground group-hover:text-primary transition-colors line-clamp-2 min-h-[3.5rem]">
          {name}
        </h3>

        {/* Date and Location */}
        <div className="space-y-2">
          <div className="flex items-center text-sm text-muted-foreground gap-2">
            <Calendar className="h-4 w-4" />
            <span className="font-medium">{date}</span>
          </div>
          <div className="flex items-center text-sm text-muted-foreground gap-2">
            <MapPin className="h-4 w-4" />
            <span>{location}</span>
          </div>
          {participants && (
            <div className="flex items-center text-sm text-muted-foreground gap-2">
              <Users className="h-4 w-4" />
              <span>{participants.toLocaleString()} participants</span>
            </div>
          )}
        </div>

        {/* Distance Badges */}
        <div className="flex flex-wrap gap-2">
          {distances && distances.length > 0 ? (
            distances.map((distance, index) => (
              <Badge key={index} variant="outline" className="text-xs bg-blue-50 border-blue-200 text-blue-700">
                {distance}
              </Badge>
            ))
          ) : (
            <Badge variant="outline" className="text-xs bg-gray-50 border-gray-200 text-gray-700">
              No distance info
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
};

export default RaceCard;