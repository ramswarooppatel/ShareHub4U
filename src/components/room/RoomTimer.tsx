import { useEffect, useState } from "react";
import { Clock, Infinity } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RoomTimerProps {
  expiresAt: string | null;
  isPermanent: boolean;
}

export const RoomTimer = ({ expiresAt, isPermanent }: RoomTimerProps) => {
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    if (isPermanent || !expiresAt) return;

    const calculateTimeLeft = () => {
      const difference = new Date(expiresAt).getTime() - Date.now();
      if (difference <= 0) { setTimeLeft("Expired"); return; }

      const d = Math.floor(difference / (1000 * 60 * 60 * 24));
      const h = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft(d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, isPermanent]);

  if (isPermanent) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
        <Infinity className="h-4 w-4 text-primary flex-shrink-0" />
        <div>
          <p className="text-xs font-medium text-foreground">Permanent Room</p>
          <p className="text-[10px] text-muted-foreground">Never expires</p>
        </div>
      </div>
    );
  }

  const isExpired = timeLeft === "Expired";

  return (
    <div className={`flex items-center gap-2 p-3 rounded-xl border ${
      isExpired ? "bg-destructive/5 border-destructive/10" : "bg-warning/5 border-warning/10"
    }`}>
      <Clock className={`h-4 w-4 flex-shrink-0 ${isExpired ? "text-destructive" : "text-warning"}`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground">Time Remaining</p>
        {isExpired ? (
          <Badge variant="destructive" className="text-[10px] h-4 mt-0.5">Expired</Badge>
        ) : (
          <p className="text-xs font-mono text-warning">{timeLeft}</p>
        )}
      </div>
    </div>
  );
};
