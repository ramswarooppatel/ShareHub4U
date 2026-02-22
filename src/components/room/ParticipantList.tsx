import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Crown } from "lucide-react";

interface ParticipantListProps {
  roomId: string;
  hostId: string;
}

export const ParticipantList = ({ roomId, hostId }: ParticipantListProps) => {
  const [participantCount, setParticipantCount] = useState(1);

  useEffect(() => {
    loadParticipants();
    setupRealtimeSubscription();
  }, [roomId]);

  const loadParticipants = async () => {
    try {
      const { count, error } = await supabase
        .from("room_participants")
        .select("*", { count: "exact", head: true })
        .eq("room_id", roomId);

      if (error) throw error;
      setParticipantCount(count || 1);
    } catch (error) {
      console.error("Error loading participants:", error);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('participant-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_participants',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setParticipantCount(prev => prev + 1);
          } else if (payload.eventType === 'DELETE') {
            setParticipantCount(prev => Math.max(1, prev - 1));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-accent/30">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-warning" />
          <span className="font-medium text-foreground">Room Host</span>
        </div>
      </div>
      
      <div className="flex items-center justify-between p-3 border border-border rounded-lg">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Active participants</span>
        </div>
        <span className="font-semibold text-foreground">{participantCount}</span>
      </div>
    </div>
  );
};
