import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useKeyboardShortcuts, KeyboardShortcut } from "@/hooks/use-keyboard-shortcuts";
import { Loader2, CheckCircle2, Clock, XCircle, ArrowLeft, ArrowRight, Zap } from "lucide-react";

export default function Waiting() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");

  // Define keyboard shortcuts for waiting page
  const waitingShortcuts: KeyboardShortcut[] = [
    {
      key: 'b',
      alt: true,
      description: 'Go back to home',
      action: () => document.querySelector('[data-shortcut="back-home"]')?.click() || navigate("/"),
      context: 'Navigation'
    },
    {
      key: 'j',
      alt: true,
      description: 'Join room (when approved)',
      action: () => {
        if (status === "approved") {
          document.querySelector('[data-shortcut="join-room"]')?.click() || navigate(`/room/${code}`);
        }
      },
      context: 'Room'
    }
  ];

  useKeyboardShortcuts(waitingShortcuts);

  useEffect(() => {
    if (!code) return;
    const deviceId = localStorage.getItem("device_id");
    if (!deviceId) { navigate(`/room/${code}`); return; }

    const checkRequest = async () => {
      const { data } = await supabase
        .from("join_requests").select("*").eq("device_id", deviceId)
        .order("created_at", { ascending: false }).limit(1).single();
      if (data) {
        setStatus(data.status as "pending" | "approved" | "rejected");
        if (data.status === "approved") toast({ title: "Request Approved!", description: "You can now join the room." });
      }
    };

    checkRequest();

    const channel = supabase
      .channel(`join-request-${deviceId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "join_requests", filter: `device_id=eq.${deviceId}` },
        (payload) => {
          const newStatus = payload.new.status as "pending" | "approved" | "rejected";
          setStatus(newStatus);
          if (newStatus === "approved") toast({ title: "✅ Approved!", description: "You can now join the room." });
          else if (newStatus === "rejected") toast({ title: "Request rejected", variant: "destructive" });
        }
      ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [code, navigate, toast]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/30 bg-card/50 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 hover:opacity-80">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <Zap className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm">ShareHub4U</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm p-8 border-border/50">
          <div className="text-center space-y-6">
            {status === "pending" && (
              <>
                <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Clock className="h-8 w-8 text-primary animate-pulse" />
                </div>
                <div>
                  <h1 className="text-xl font-bold mb-2">Waiting for Approval</h1>
                  <p className="text-sm text-muted-foreground">Your request has been sent to the host. Please wait...</p>
                </div>
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Listening for updates</span>
                </div>
              </>
            )}

            {status === "approved" && (
              <>
                <div className="w-16 h-16 mx-auto rounded-2xl bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-success" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-success mb-2">Approved!</h1>
                  <p className="text-sm text-muted-foreground">You have been approved to join the room.</p>
                </div>
                <Button data-shortcut="join-room" onClick={() => navigate(`/room/${code}`)} className="w-full gap-2">
                  Enter Room <ArrowRight className="h-4 w-4" />
                </Button>
              </>
            )}

            {status === "rejected" && (
              <>
                <div className="w-16 h-16 mx-auto rounded-2xl bg-destructive/10 flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
                <div>
                  <h1 className="text-xl font-bold mb-2">Request Rejected</h1>
                  <p className="text-sm text-muted-foreground">Your join request was not approved.</p>
                </div>
                <Button data-shortcut="back-home" onClick={() => navigate("/")} variant="outline" className="w-full gap-2">
                  <ArrowLeft className="h-4 w-4" /> Back to Home
                </Button>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
