import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, Clock } from "lucide-react";

export default function Waiting() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [requestId, setRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;

    const deviceId = localStorage.getItem("device_id");
    if (!deviceId) {
      navigate(`/room/${code}`);
      return;
    }

    // Check existing request status
    const checkRequest = async () => {
      const { data, error } = await supabase
        .from("join_requests")
        .select("*")
        .eq("device_id", deviceId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error("Error checking request:", error);
        return;
      }

      if (data) {
        setRequestId(data.id);
        setStatus(data.status as "pending" | "approved" | "rejected");
        
        if (data.status === "approved") {
          toast({
            title: "Request Approved!",
            description: "You can now join the room.",
          });
        }
      }
    };

    checkRequest();

    // Set up real-time subscription
    const channel = supabase
      .channel(`join-request-${deviceId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "join_requests",
          filter: `device_id=eq.${deviceId}`,
        },
        (payload) => {
          const newStatus = payload.new.status as "pending" | "approved" | "rejected";
          setStatus(newStatus);
          
          if (newStatus === "approved") {
            toast({
              title: "✅ Request Approved!",
              description: "You can now join the room.",
            });
          } else if (newStatus === "rejected") {
            toast({
              title: "Request Rejected",
              description: "Your join request was not approved.",
              variant: "destructive",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [code, navigate, toast]);

  const handleJoinRoom = () => {
    if (status === "approved") {
      navigate(`/room/${code}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center space-y-6">
          {status === "pending" && (
            <>
              <div className="flex justify-center">
                <div className="relative">
                  <Clock className="h-16 w-16 text-primary animate-pulse" />
                  <Loader2 className="h-8 w-8 text-primary absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-spin" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold mb-2">Waiting for Approval</h1>
                <p className="text-muted-foreground">
                  Your join request has been sent to the room host.
                  <br />
                  Please wait for approval...
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
                <span>Checking status in real-time</span>
              </div>
            </>
          )}

          {status === "approved" && (
            <>
              <div className="flex justify-center">
                <CheckCircle2 className="h-16 w-16 text-green-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold mb-2 text-green-500">Request Approved!</h1>
                <p className="text-muted-foreground">
                  You have been approved to join the room.
                </p>
              </div>
              <Button onClick={handleJoinRoom} size="lg" className="w-full">
                View Room
              </Button>
            </>
          )}

          {status === "rejected" && (
            <>
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <span className="text-3xl">❌</span>
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold mb-2">Request Rejected</h1>
                <p className="text-muted-foreground">
                  Your join request was not approved by the host.
                </p>
              </div>
              <Button
                onClick={() => navigate("/")}
                variant="outline"
                className="w-full"
              >
                Back to Home
              </Button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
