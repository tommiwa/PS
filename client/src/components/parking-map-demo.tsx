import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Car, Zap } from "lucide-react";
import floorPlanImage from "@assets/image_1765929660466.png";

interface ParkingSpot {
  id: string;
  number: string;
  x: number;
  y: number;
  status: "available" | "booked" | "reserved";
  type: "regular" | "ev";
}

interface PathPoint {
  x: number;
  y: number;
}

const sampleSpots: ParkingSpot[] = [
  { id: "1", number: "P32", x: 355, y: 295, status: "available", type: "regular" },
  { id: "2", number: "P33", x: 395, y: 355, status: "available", type: "ev" },
  { id: "3", number: "P34", x: 435, y: 355, status: "booked", type: "ev" },
  { id: "4", number: "P35", x: 475, y: 355, status: "available", type: "regular" },
  { id: "5", number: "P36", x: 520, y: 355, status: "reserved", type: "regular" },
  { id: "6", number: "P37", x: 560, y: 355, status: "available", type: "ev" },
  { id: "7", number: "P38", x: 600, y: 355, status: "available", type: "ev" },
  { id: "8", number: "P39", x: 640, y: 355, status: "available", type: "regular" },
];

// Entrance at top right (blue outline circle)
const entrancePoint: PathPoint = { x: 745, y: 95 };

// Main driving lane waypoints (following the blue lines on the floor plan)
const drivingLane = {
  topRight: { x: 745, y: 95 },
  topLeft: { x: 115, y: 95 },
  leftTop: { x: 115, y: 155 },
  leftMiddle: { x: 115, y: 270 },
  leftBottom: { x: 115, y: 355 },
  bottomLeft: { x: 355, y: 355 },
  bottomMiddle: { x: 520, y: 355 },
  bottomRight: { x: 745, y: 355 },
};

const getPathToSpot = (spot: ParkingSpot): PathPoint[] => {
  // Path follows the driving lanes: entrance (top right) → left across top → down left side → to spot
  const path: PathPoint[] = [
    entrancePoint,
    drivingLane.topLeft,
    drivingLane.leftTop,
    drivingLane.leftMiddle,
  ];
  
  // For P32 which is higher up
  if (spot.number === "P32") {
    path.push({ x: 355, y: 270 });
    path.push({ x: spot.x, y: spot.y });
  } else {
    // For bottom row spots (P33-P39)
    path.push(drivingLane.leftBottom);
    path.push({ x: spot.x, y: 355 });
    path.push({ x: spot.x, y: spot.y });
  }
  
  return path;
};

// Create smooth curved path using quadratic bezier curves at corners
const pathToSvgPath = (points: PathPoint[]): string => {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  
  const radius = 25; // Corner radius for smooth curves
  let path = `M ${points[0].x} ${points[0].y}`;
  
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    
    // Calculate direction vectors
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    
    // Normalize and apply radius
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    
    const r1 = Math.min(radius, len1 / 2);
    const r2 = Math.min(radius, len2 / 2);
    
    // Points before and after the corner
    const beforeX = curr.x - (dx1 / len1) * r1;
    const beforeY = curr.y - (dy1 / len1) * r1;
    const afterX = curr.x + (dx2 / len2) * r2;
    const afterY = curr.y + (dy2 / len2) * r2;
    
    // Line to before corner, then quadratic curve through corner
    path += ` L ${beforeX} ${beforeY} Q ${curr.x} ${curr.y} ${afterX} ${afterY}`;
  }
  
  // Line to final point
  const last = points[points.length - 1];
  path += ` L ${last.x} ${last.y}`;
  
  return path;
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
          <Badge variant="outline" className="gap-1">
            <Zap className="h-3 w-3 text-yellow-500" />
            EV Charging
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
              r="14"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="3"
            />
            <text
              x={entrancePoint.x}
              y={entrancePoint.y - 22}
              textAnchor="middle"
              fill="#3b82f6"
              fontSize="11"
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
                  strokeDasharray="2000"
                  strokeDashoffset="2000"
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
              const spotRadius = isSelected ? 16 : 12;
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
                    r={spotRadius}
                    fill={color}
                    stroke="white"
                    strokeWidth="2"
                    className={isSelected ? "animate-pulse" : ""}
                  />
                  {spot.type === "ev" ? (
                    <>
                      <path
                        d={`M ${spot.x - 4} ${spot.y - 5} L ${spot.x + 1} ${spot.y - 5} L ${spot.x - 1} ${spot.y} L ${spot.x + 4} ${spot.y} L ${spot.x - 2} ${spot.y + 6} L ${spot.x} ${spot.y + 1} L ${spot.x - 5} ${spot.y + 1} Z`}
                        fill="#fbbf24"
                        stroke="white"
                        strokeWidth="0.5"
                      />
                    </>
                  ) : (
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
                  )}
                  {isSelected && (
                    <text
                      x={spot.x}
                      y={spot.y - 22}
                      textAnchor="middle"
                      fill={color}
                      fontSize="11"
                      fontWeight="bold"
                    >
                      {spot.number} {spot.type === "ev" ? "⚡" : ""}
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
              {selectedSpot.type === "ev" ? (
                <Zap className="h-5 w-5 text-yellow-500" />
              ) : (
                <Car className="h-5 w-5 text-primary" />
              )}
              <div>
                <p className="font-medium flex items-center gap-2">
                  Spot {selectedSpot.number}
                  {selectedSpot.type === "ev" && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Zap className="h-3 w-3 text-yellow-500" />
                      EV Charging
                    </Badge>
                  )}
                </p>
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
          animation: draw-path 2.5s ease-out forwards;
        }
      `}</style>
    </Card>
  );
}
