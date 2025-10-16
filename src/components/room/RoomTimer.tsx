import { useEffect, useState } from "react";
import { Clock, Infinity } from "lucide-react";
import { Card } from "@/components/ui/card";
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
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const difference = expiry - now;

      if (difference <= 0) {
        setTimeLeft("Expired");
        return;
      }

      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, isPermanent]);

  if (isPermanent) {
    return (
      <Card className="p-3 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <div className="flex items-center gap-2">
          <Infinity className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium">Permanent Room</p>
            <p className="text-xs text-muted-foreground">This room never expires</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-3 bg-gradient-to-r from-orange-500/10 to-orange-500/5 border-orange-500/20">
      <div className="flex items-center gap-2">
        <Clock className="h-5 w-5 text-orange-500" />
        <div className="flex-1">
          <p className="text-sm font-medium">Time Remaining</p>
          <p className="text-xs text-muted-foreground">
            {timeLeft === "Expired" ? (
              <Badge variant="destructive">Expired</Badge>
            ) : (
              <span className="font-mono text-orange-500">{timeLeft}</span>
            )}
          </p>
        </div>
      </div>
    </Card>
  );
};
