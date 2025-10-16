import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, Users, LogOut, Copy, Check, FileText, Edit, UserCheck, Eye, EyeOff, RefreshCw } from "lucide-react";
import { FileUpload } from "@/components/room/FileUpload";
import { FileList } from "@/components/room/FileList";
import { ParticipantList } from "@/components/room/ParticipantList";
import { MarkdownEditor } from "@/components/room/MarkdownEditor";
import { JoinRequestDialog } from "@/components/room/JoinRequestDialog";
import { JoinRequestPanel } from "@/components/room/JoinRequestPanel";
import { RoomTimer } from "@/components/room/RoomTimer";
import { PasswordEntryModal } from "@/components/room/PasswordEntryModal";
import { getDeviceId } from "@/utils/deviceId";
import { RoomSettings } from "@/components/room/RoomSettings";

interface Room {
  id: string;
  room_code: string;
  host_id: string;
  room_type: string;
  room_password: string | null;
  file_sharing_enabled: boolean;
  only_host_can_upload: boolean;
  auto_accept_requests: boolean;
  is_permanent: boolean;
  expires_at: string | null;
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
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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
      const deviceId = getDeviceId();
      const isHost = data.host_id === userId;

      if (!isHost) {
        // Check if device already has access (approved before)
        const { data: participantData } = await supabase
          .from("room_participants")
          .select("*")
          .eq("room_id", data.id)
          .eq("device_id", deviceId)
          .maybeSingle();

        if (participantData) {
          // Device already approved
          setHasAccess(true);
        } else if (data.room_type === "private_key") {
          setShowPasswordModal(true);
          setHasAccess(false);
          setLoading(false);
          return;
        } else if (data.room_type === "locked") {
          // Check if there's a pending/approved request
          const { data: requestData } = await supabase
            .from("join_requests")
            .select("*")
            .eq("room_id", data.id)
            .eq("device_id", deviceId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (requestData?.status === "approved") {
            // Add to participants
            await supabase.from("room_participants").insert({
              room_id: data.id,
              user_id: userId,
              device_id: deviceId,
              role: "member",
            });
            setHasAccess(true);
          } else if (requestData?.status === "pending") {
            // Redirect to waiting page
            navigate(`/room/${slug}/waiting`);
            return;
          } else {
            setShowJoinDialog(true);
            setHasAccess(false);
            setLoading(false);
            return;
          }
        }
      }

      setHasAccess(true);
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


  const handlePasswordSubmit = async (password: string) => {
    if (!room) return;

    if (password !== room.room_password) {
      toast({
        title: "Incorrect password",
        description: "The password you entered is incorrect.",
        variant: "destructive",
      });
      return;
    }

    const deviceId = getDeviceId();
    
    // Add to participants with device tracking
    await supabase.from("room_participants").insert({
      room_id: room.id,
      user_id: userId,
      device_id: deviceId,
      role: "member",
    });

    setHasAccess(true);
    setShowPasswordModal(false);
    toast({ title: "Access granted!" });
  };

  const handleJoinRequest = async (data: { anonymousName?: string; message?: string; password?: string }) => {
    if (!room) return;

    try {
      if (room.room_type === "locked") {
        const deviceId = getDeviceId();
        
        // Submit join request
        const { error } = await supabase.from("join_requests").insert({
          room_id: room.id,
          user_id: userId,
          anonymous_name: data.anonymousName,
          message: data.message,
          device_id: deviceId,
          status: "pending",
        });

        if (error) throw error;

        toast({
          title: "Request sent!",
          description: "Redirecting to waiting page...",
        });
        
        // Redirect to waiting page
        navigate(`/room/${slug}/waiting`);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
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

  const refreshRoomData = async () => {
    if (!room) return;
    
    setRefreshing(true);
    try {
      // Force reload room data
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("room_code", slug)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setRoom(data);
        toast({
          title: "Data refreshed!",
          description: "Room data has been updated.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error refreshing data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
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
          requiresPassword={false}
        />
        <PasswordEntryModal
          isOpen={showPasswordModal}
          onClose={() => navigate("/")}
          onSubmit={handlePasswordSubmit}
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
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground">Room: {room.room_code}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {room.room_type === "public" && "Public room - Anyone can join"}
                {room.room_type === "locked" && "Locked room - Requires approval"}
                {room.room_type === "private_key" && "Password protected room"}
              </p>
              {room.room_type === "private_key" && room.room_password && room.host_id === userId && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-muted-foreground">Password:</span>
                  <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                    {showPassword ? room.room_password : "••••••••"}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPassword(!showPassword)}
                    className="h-6 w-6 p-0"
                  >
                    {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </Button>
                </div>
              )}
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
                onClick={refreshRoomData}
                variant="outline"
                size="sm"
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? "Refreshing..." : "Refresh"}
              </Button>
              {room && userId === room.host_id && (
                <RoomSettings room={room} onRoomUpdate={() => loadRoom()} />
              )}
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
            <RoomTimer expiresAt={room.expires_at} isPermanent={room.is_permanent} />
            
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
