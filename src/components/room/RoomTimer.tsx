import { useEffect, useState } from "react";
import { Clock, Infinity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface RoomTimerProps {
  expiresAt: string | null;
  isPermanent: boolean;
}

export const RoomTimer = ({ expiresAt, isPermanent }: RoomTimerProps) => {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [open, setOpen] = useState(false);

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
      <>
        <button onClick={() => setOpen(true)} className="flex items-center gap-3 p-2 rounded-lg hover:shadow-md transition-all">
          <div className="flex items-center justify-center rounded-md bg-primary/6 p-2">
            <Infinity className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Permanent</p>
            <p className="text-[11px] text-muted-foreground">Never expires</p>
          </div>
        </button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="w-[95vw] max-w-2xl rounded-2xl p-8 text-center">
            <DialogHeader>
              <DialogTitle className="text-2xl font-extrabold">Room Timer</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">This room is permanent and does not expire.</DialogDescription>
            </DialogHeader>

            <div className="py-8">
              <Infinity className="mx-auto h-14 w-14 text-primary mb-4" />
              <h3 className="text-4xl font-extrabold">Permanent Room</h3>
              <p className="mt-3 text-sm text-muted-foreground">No expiration is set for this workspace.</p>
            </div>

            <DialogFooter>
              <Button onClick={() => setOpen(false)} className="w-full">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const isExpired = timeLeft === "Expired";

  let formattedLocale = "";
  let formatted12 = "";
  if (expiresAt) {
    try {
      const d = new Date(expiresAt);
      formattedLocale = d.toLocaleString();
      formatted12 = d.toLocaleString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch (e) {
      formattedLocale = expiresAt;
      formatted12 = expiresAt;
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={`flex items-center gap-3 p-3 rounded-lg hover:shadow-lg transition-all ${isExpired ? 'bg-destructive/5 border-destructive/10' : 'bg-warning/5 border-warning/10'}`}>
        <div className={`flex items-center justify-center rounded-md p-3 ${isExpired ? 'bg-destructive/10' : 'bg-warning/10'}`}>
          <Clock className={`h-6 w-6 ${isExpired ? 'text-destructive' : 'text-warning'}`} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Time Remaining</p>
          {isExpired ? (
            <Badge variant="destructive" className="text-sm h-6 mt-1">Expired</Badge>
          ) : (
            <p className="text-lg font-mono text-warning mt-1">{timeLeft}</p>
          )}
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] max-w-3xl rounded-2xl p-8 text-center">
          <DialogHeader>
            <DialogTitle className="text-3xl font-extrabold">Room Timer</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">Details and countdown for this room.</DialogDescription>
          </DialogHeader>

          <div className="py-8">
            <Clock className={`mx-auto h-16 w-16 ${isExpired ? 'text-destructive' : 'text-warning'}`} />
            {isExpired ? (
              <h3 className="text-5xl font-extrabold mt-4">Expired</h3>
            ) : (
              <h3 className="text-5xl font-extrabold mt-4">{timeLeft}</h3>
            )}

            {expiresAt && (
              <>
                <p className="mt-4 text-sm text-muted-foreground">Expires at: {formattedLocale}</p>
                <p className="mt-1 text-sm text-muted-foreground">Time: {formatted12}</p>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(expiresAt || ''); }} className="mr-2">Copy Expiry</Button>
            <Button onClick={() => setOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
