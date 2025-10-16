import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, Users, LogOut, Copy, Check, FileText, Edit, UserCheck } from "lucide-react";
import { FileUpload } from "@/components/room/FileUpload";
import { FileList } from "@/components/room/FileList";
import { ParticipantList } from "@/components/room/ParticipantList";
import { MarkdownEditor } from "@/components/room/MarkdownEditor";
import { JoinRequestDialog } from "@/components/room/JoinRequestDialog";
import { JoinRequestPanel } from "@/components/room/JoinRequestPanel";

interface Room {
  id: string;
  room_code: string;
  host_id: string;
  room_type: string;
  room_password: string | null;
  file_sharing_enabled: boolean;
  only_host_can_upload: boolean;
  auto_accept_requests: boolean;
}

const Room = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    initializeUser();
  }, []);

  useEffect(() => {
    if (userId) {
      loadRoom();
    }
  }, [slug, userId]);

  const initializeUser = async () => {
    // Create or get user
    const storedUserId = localStorage.getItem("user_id");
    if (storedUserId) {
      setUserId(storedUserId);
    } else {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .insert({})
        .select()
        .single();
      
      if (userError) {
        toast({
          title: "Error",
          description: userError.message,
          variant: "destructive",
        });
        return;
      }
      localStorage.setItem("user_id", userData.id);
      setUserId(userData.id);
    }
  };

  const loadRoom = async () => {
    try {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("room_code", slug)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        toast({
          title: "Room not found",
          description: "This room doesn't exist or has expired.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setRoom(data);

      // Check if user needs to request access
      if (data.room_type === "locked" || data.room_type === "private_key") {
        const isHost = data.host_id === userId;
        
        if (!isHost) {
          setShowJoinDialog(true);
          setHasAccess(false);
          setLoading(false);
          return;
        }
      }

      setHasAccess(true);
      setupRealtimeSubscription();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  const handleJoinRequest = async (data: { anonymousName?: string; message?: string; password?: string }) => {
    if (!room) return;

    try {
      if (room.room_type === "private_key") {
        // Verify password
        if (data.password !== room.room_password) {
          toast({
            title: "Incorrect password",
            description: "The password you entered is incorrect.",
            variant: "destructive",
          });
          return;
        }
        setHasAccess(true);
        setShowJoinDialog(false);
        setupRealtimeSubscription();
        toast({ title: "Access granted!" });
      } else if (room.room_type === "locked") {
        // Submit join request
        const { error } = await supabase.from("join_requests").insert({
          room_id: room.id,
          user_id: userId,
          anonymous_name: data.anonymousName,
          message: data.message,
          status: "pending",
        });

        if (error) throw error;

        toast({
          title: "Request sent!",
          description: "Waiting for host approval...",
        });
        setShowJoinDialog(false);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('room-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_files',
          filter: `room_id=eq.${slug}`
        },
        () => {
          // Reload files when changes occur
          loadRoom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const copyRoomLink = () => {
    const link = window.location.href;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast({
      title: "Link copied!",
      description: "Share this link with others to invite them.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const leaveRoom = () => {
    navigate("/");
  };


  if (!hasAccess && room) {
    return (
      <>
        <JoinRequestDialog
          isOpen={showJoinDialog}
          onClose={() => navigate("/")}
          onSubmit={handleJoinRequest}
          roomType={room.room_type}
          requiresPassword={room.room_type === "private_key"}
        />
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Card className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-2">Access Required</h2>
            <p className="text-muted-foreground">
              {room.room_type === "locked" 
                ? "This room requires approval from the host."
                : "This room is password protected."}
            </p>
          </Card>
        </div>
      </>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading room...</div>
      </div>
    );
  }

  if (!room) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Room: {room.room_code}</h1>
              <p className="text-sm text-muted-foreground mt-1">Share files and collaborate</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={copyRoomLink}
                variant="outline"
                size="sm"
              >
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? "Copied!" : "Copy Link"}
              </Button>
              <Button
                onClick={leaveRoom}
                variant="outline"
                size="sm"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Leave
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Tabs defaultValue="files" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="files">
                  <Upload className="h-4 w-4 mr-2" />
                  Files
                </TabsTrigger>
                <TabsTrigger value="markdown">
                  <Edit className="h-4 w-4 mr-2" />
                  Notes
                </TabsTrigger>
              </TabsList>

              <TabsContent value="files" className="space-y-6 mt-6">
                {room.file_sharing_enabled && (
                  <Card className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Upload className="h-5 w-5 text-primary" />
                      <h2 className="text-xl font-semibold text-foreground">Upload Files</h2>
                    </div>
                    <FileUpload
                      roomId={room.id}
                      userId={userId}
                      disabled={room.only_host_can_upload && room.host_id !== userId}
                    />
                    {room.only_host_can_upload && room.host_id !== userId && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Only the host can upload files in this room.
                      </p>
                    )}
                  </Card>
                )}

                <Card className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Download className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-semibold text-foreground">Shared Files</h2>
                  </div>
                  <FileList roomId={room.id} />
                </Card>
              </TabsContent>

              <TabsContent value="markdown" className="mt-6">
                <Card className="p-6">
                  <MarkdownEditor roomId={room.id} userId={userId} />
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Participants</h2>
              </div>
              <ParticipantList roomId={room.id} hostId={room.host_id} />
            </Card>

            {room.room_type === "locked" && room.host_id === userId && (
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <UserCheck className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold text-foreground">Join Requests</h2>
                </div>
                <JoinRequestPanel roomId={room.id} hostId={room.host_id} />
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Room;
