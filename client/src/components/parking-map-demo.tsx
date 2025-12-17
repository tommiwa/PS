import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Car } from "lucide-react";
import floorPlanImage from "@assets/image_1765929660466.png";

interface ParkingSpot {
  id: string;
  number: string;
  x: number;
  y: number;
  status: "available" | "booked" | "reserved";
}

interface PathPoint {
  x: number;
  y: number;
}

const sampleSpots: ParkingSpot[] = [
  { id: "1", number: "P32", x: 340, y: 290, status: "available" },
  { id: "2", number: "P33", x: 380, y: 340, status: "available" },
  { id: "3", number: "P34", x: 420, y: 340, status: "booked" },
  { id: "4", number: "P35", x: 460, y: 340, status: "available" },
  { id: "5", number: "P36", x: 500, y: 340, status: "reserved" },
  { id: "6", number: "P37", x: 540, y: 340, status: "available" },
  { id: "7", number: "P38", x: 580, y: 340, status: "available" },
  { id: "8", number: "P39", x: 620, y: 340, status: "available" },
];

const entrancePoint: PathPoint = { x: 280, y: 120 };

const getPathToSpot = (spot: ParkingSpot): PathPoint[] => {
  return [
    entrancePoint,
    { x: 280, y: 200 },
    { x: 280, y: 290 },
    { x: spot.x, y: 290 },
    { x: spot.x, y: spot.y },
  ];
};

const pathToSvgPath = (points: PathPoint[]): string => {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
};

export function ParkingMapDemo() {
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
  const [showPath, setShowPath] = useState(false);

  const handleSpotClick = (spot: ParkingSpot) => {
    if (spot.status === "reserved") return;
    setSelectedSpot(spot);
    setShowPath(true);
  };

  const getSpotColor = (spot: ParkingSpot, isSelected: boolean) => {
    if (isSelected) return "#3b82f6";
    switch (spot.status) {
      case "available": return "#22c55e";
      case "booked": return "#f59e0b";
      case "reserved": return "#6b7280";
      default: return "#22c55e";
    }
  };

  const path = selectedSpot ? getPathToSpot(selectedSpot) : [];
  const pathD = pathToSvgPath(path);

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Interactive Parking Map Demo
        </CardTitle>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            Available
          </Badge>
          <Badge variant="outline" className="gap-1">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            Booked
          </Badge>
          <Badge variant="outline" className="gap-1">
            <div className="w-3 h-3 rounded-full bg-gray-500" />
            Reserved
          </Badge>
          <Badge variant="outline" className="gap-1">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            Selected
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative overflow-auto border rounded-lg bg-muted/30">
          <svg
            viewBox="0 0 800 500"
            className="w-full h-auto min-w-[600px]"
            style={{ maxHeight: "500px" }}
          >
            <image
              href={floorPlanImage}
              x="0"
              y="0"
              width="800"
              height="500"
              preserveAspectRatio="xMidYMid slice"
              opacity="0.9"
            />
            
            <circle
              cx={entrancePoint.x}
              cy={entrancePoint.y}
              r="12"
              fill="#ef4444"
              stroke="white"
              strokeWidth="2"
            />
            <text
              x={entrancePoint.x}
              y={entrancePoint.y - 18}
              textAnchor="middle"
              fill="#ef4444"
              fontSize="12"
              fontWeight="bold"
            >
              Entrance
            </text>

            {showPath && selectedSpot && (
              <>
                <path
                  d={pathD}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="1000"
                  strokeDashoffset="1000"
                  opacity="0.8"
                  className="animate-draw-path"
                />
                <path
                  d={pathD}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.2"
                />
              </>
            )}

            {sampleSpots.map((spot) => {
              const isSelected = selectedSpot?.id === spot.id;
              const color = getSpotColor(spot, isSelected);
              return (
                <g
                  key={spot.id}
                  onClick={() => handleSpotClick(spot)}
                  className={spot.status !== "reserved" ? "cursor-pointer" : "cursor-not-allowed"}
                  data-testid={`parking-spot-${spot.number}`}
                >
                  <circle
                    cx={spot.x}
                    cy={spot.y}
                    r={isSelected ? 16 : 12}
                    fill={color}
                    stroke="white"
                    strokeWidth="2"
                    className={isSelected ? "animate-pulse" : ""}
                  />
                  <text
                    x={spot.x}
                    y={spot.y + 4}
                    textAnchor="middle"
                    fill="white"
                    fontSize="8"
                    fontWeight="bold"
                  >
                    {spot.number.replace("P", "")}
                  </text>
                  {isSelected && (
                    <text
                      x={spot.x}
                      y={spot.y - 22}
                      textAnchor="middle"
                      fill={color}
                      fontSize="11"
                      fontWeight="bold"
                    >
                      {spot.number}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {selectedSpot && (
          <div className="mt-4 p-4 bg-muted/50 rounded-lg flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Car className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Spot {selectedSpot.number}</p>
                <p className="text-sm text-muted-foreground">
                  Follow the blue path from the entrance
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowPath(false);
                  setTimeout(() => setShowPath(true), 50);
                }}
              >
                <Navigation className="h-4 w-4 mr-1" />
                Replay Path
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedSpot(null);
                  setShowPath(false);
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        <p className="text-sm text-muted-foreground mt-4">
          Click on any available (green) spot to see the animated path from the entrance.
        </p>
      </CardContent>

      <style>{`
        @keyframes draw-path {
          to {
            stroke-dashoffset: 0;
          }
        }
        .animate-draw-path {
          animation: draw-path 1.5s ease-out forwards;
        }
      `}</style>
    </Card>
  );
}
