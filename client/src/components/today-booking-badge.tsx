import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ParkingSquare, X } from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import {
  LEGACY_SESSION_KEY,
  getTodayStr,
  isDismissedForDate,
  recordDismissal,
} from "@/lib/pill-dismissal";

interface EnrichedBooking {
  id: string;
  bookingDate: string;
  status: string;
  spotNumber: string;
  location: string;
}

export function TodayBookingBadge() {
  const [, setLocation] = useLocation();

  const [todayStr, setTodayStr] = useState(getTodayStr);

  const [dismissed, setDismissed] = useState(() => {
    try {
      // Clean up the old session-based key from previous versions
      sessionStorage.removeItem(LEGACY_SESSION_KEY);
    } catch {
      // ignore
    }
    return isDismissedForDate(getTodayStr());
  });

  const [visible, setVisible] = useState(false);

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragState = useRef<{
    dragging: boolean;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const badgeRef = useRef<HTMLDivElement>(null);

  // Re-evaluate "today" when the date rolls over while the app stays open
  useEffect(() => {
    const check = () => {
      const now = getTodayStr();
      setTodayStr((prev) => {
        if (prev !== now) {
          setDismissed(isDismissedForDate(now));
          return now;
        }
        return prev;
      });
    };
    const interval = setInterval(check, 60 * 1000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, []);

  const { data: bookings } = useQuery<EnrichedBooking[]>({
    queryKey: ["/api/my-bookings"],
    enabled: !dismissed,
    staleTime: 5 * 60 * 1000,
  });

  const todayBookings = (bookings ?? []).filter(
    (b) => b.bookingDate === todayStr && b.status === "confirmed"
  );

  useEffect(() => {
    if (!dismissed && todayBookings.length > 0) {
      const timer = setTimeout(() => setVisible(true), 100);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [dismissed, todayBookings.length]);

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Capture the date at click time so a dismissal just before midnight
    // only applies to the day the user actually clicked.
    const clickDateStr = getTodayStr();
    setVisible(false);
    setTimeout(() => {
      // Only mark as dismissed if it's still the same day; if midnight
      // passed during the animation, the pill stays eligible for today.
      if (recordDismissal(clickDateStr)) {
        setDismissed(true);
      }
    }, 200);
  };

  const handleClick = () => {
    if (dragState.current?.dragging) return;
    setLocation("/my-bookings");
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-dismiss]")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = badgeRef.current?.getBoundingClientRect();
    dragState.current = {
      dragging: false,
      startX: e.clientX,
      startY: e.clientY,
      originX: pos ? pos.x : (rect ? window.innerWidth - rect.width - 24 : window.innerWidth - 200),
      originY: pos ? pos.y : (rect ? window.innerHeight - rect.height - 80 : window.innerHeight - 160),
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    if (!dragState.current.dragging && Math.abs(dx) + Math.abs(dy) > 4) {
      dragState.current.dragging = true;
    }
    if (dragState.current.dragging) {
      const bRect = badgeRef.current?.getBoundingClientRect();
      const w = bRect?.width ?? 200;
      const h = bRect?.height ?? 120;
      const newX = Math.max(8, Math.min(window.innerWidth - w - 8, dragState.current.originX + dx));
      const newY = Math.max(8, Math.min(window.innerHeight - h - 8, dragState.current.originY + dy));
      setPos({ x: newX, y: newY });
    }
  };

  const onPointerUp = () => {
    if (dragState.current && !dragState.current.dragging) {
      handleClick();
    }
    dragState.current = null;
  };

  if (dismissed || todayBookings.length === 0) return null;

  const firstBooking = todayBookings[0];
  const extraCount = todayBookings.length - 1;
  const dateLabel = format(new Date(), "EEE, MMM d");

  const style: React.CSSProperties = pos
    ? { position: "fixed", left: pos.x, top: pos.y, bottom: "unset", right: "unset" }
    : { position: "fixed", bottom: "5.5rem", right: "1.5rem" };

  return (
    <div
      ref={badgeRef}
      data-testid="today-booking-badge"
      style={style}
      className={[
        // Deliberately below dialogs/dropdowns/tooltips (z-50) and toasts (z-[100]) so any open
        // modal's overlay correctly dims and covers this floating widget instead of it poking
        // out on top — it should only float over plain page content, never over a dialog.
        "z-30 select-none cursor-grab active:cursor-grabbing",
        "transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0 pointer-events-none",
      ].join(" ")}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className="rounded-xl border bg-card text-card-foreground shadow-lg w-48 overflow-hidden">
        <div className="flex items-stretch">
          <div className="flex items-center justify-center bg-primary/10 px-3">
            <ParkingSquare className="h-5 w-5 text-primary shrink-0" />
          </div>
          <div className="flex-1 py-3 px-3 min-w-0">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide leading-none mb-1">
              Your spot today
            </p>
            <p className="text-lg font-bold text-foreground leading-tight truncate">
              {firstBooking.spotNumber}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{dateLabel}</p>
            {extraCount > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                +{extraCount} more
              </p>
            )}
          </div>
          <div className="flex items-start pt-2 pr-2">
            <button
              data-dismiss="true"
              type="button"
              aria-label="Dismiss"
              onClick={handleDismiss}
              className="rounded-md p-0.5 text-muted-foreground hover:text-foreground hover-elevate"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
