import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Check, X, UserCheck, Shield } from "lucide-react";
import { HostAuthDialog } from "./HostAuthDialog";

interface JoinRequest {
  id: string;
  user_id: string;
  anonymous_name?: string;
  message?: string;
  status: string;
  created_at: string;
}

interface JoinRequestPanelProps {
  roomId: string;
  hostId: string;
}

export const JoinRequestPanel = ({ roomId, hostId }: JoinRequestPanelProps) => {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ requestId: string; action: "approve" | "reject" } | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadRequests();
    
    const channel = supabase
      .channel('join-requests-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'join_requests',
          filter: `room_id=eq.${roomId}`
        },
        () => {
          loadRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const loadRequests = async () => {
    try {
      const { data, error } = await supabase
        .from("join_requests")
        .select("*")
        .eq("room_id", roomId)
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (error) throw error;
      setRequests(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading requests",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyHost = async (username: string, passcode: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("username, passcode")
        .eq("id", hostId)
        .single();

      if (error) throw error;

      if (data.username === username && data.passcode === passcode) {
        setIsAuthenticated(true);
        setShowAuthDialog(false);
        
        if (pendingAction) {
          await handleRequestAction(pendingAction.requestId, pendingAction.action);
          setPendingAction(null);
        }
        
        return true;
      }
      return false;
    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const initiateAction = (requestId: string, action: "approve" | "reject") => {
    if (!isAuthenticated) {
      setPendingAction({ requestId, action });
      setShowAuthDialog(true);
    } else {
      handleRequestAction(requestId, action);
    }
  };

  const handleRequestAction = async (requestId: string, action: "approve" | "reject") => {
    try {
      const request = requests.find(r => r.id === requestId);
      if (!request) return;

      const { error: updateError } = await supabase
        .from("join_requests")
        .update({ 
          status: action === "approve" ? "approved" : "rejected",
          responded_at: new Date().toISOString()
        })
        .eq("id", requestId);

      if (updateError) throw updateError;

      if (action === "approve") {
        const { error: participantError } = await supabase
          .from("room_participants")
          .insert({
            room_id: roomId,
            user_id: request.user_id,
            anonymous_name: request.anonymous_name,
            role: "member"
          });

        if (participantError) throw participantError;
      }

      toast({
        title: action === "approve" ? "Request approved" : "Request rejected",
        description: `User ${request.anonymous_name || "Unknown"} has been ${action}d.`,
      });

      loadRequests();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading requests...</div>;
  }

  if (requests.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No pending join requests
      </div>
    );
  }

  return (
    <>
      <HostAuthDialog
        isOpen={showAuthDialog}
        onClose={() => {
          setShowAuthDialog(false);
          setPendingAction(null);
        }}
        onVerify={verifyHost}
      />
      
      <div className="space-y-3">
        {!isAuthenticated && (
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border">
            <Shield className="h-4 w-4 text-warning" />
            <span className="text-sm text-muted-foreground">
              Verification required to approve requests
            </span>
          </div>
        )}
        
        {requests.map((request) => (
          <Card key={request.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <UserCheck className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium text-foreground truncate">
                    {request.anonymous_name || "Anonymous User"}
                  </span>
                  <Badge variant="secondary" className="ml-auto">Pending</Badge>
                </div>
                {request.message && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                    {request.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(request.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => initiateAction(request.id, "approve")}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => initiateAction(request.id, "reject")}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
};
