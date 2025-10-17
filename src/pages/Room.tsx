import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, Users, LogOut, Copy, Check, FileText, Edit, UserCheck, Eye, EyeOff, RefreshCw, Share2 } from "lucide-react";
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
  const [searchParams] = useSearchParams();
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
          // Check if password is provided in URL
          const urlPassword = searchParams.get("password");
          if (urlPassword && urlPassword === data.room_password) {
            // Auto-grant access with URL password
            await supabase.from("room_participants").insert({
              room_id: data.id,
              user_id: userId,
              device_id: deviceId,
              role: "member",
            });
            setHasAccess(true);
          } else {
            setShowPasswordModal(true);
            setHasAccess(false);
            setLoading(false);
            return;
          }
        } else if (data.room_type === "locked") {
          // Check if auto-accept is enabled for this room
          if (data.auto_accept_requests) {
            // Auto-accept: add user directly to participants
            await supabase.from("room_participants").insert({
              room_id: data.id,
              user_id: userId,
              device_id: deviceId,
              role: "member",
            });
            setHasAccess(true);
          } else {
            // Manual approval required: check existing request status
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

  const shareRoomWithPassword = () => {
    if (!room) return;
    
    let shareUrl = `${window.location.origin}/room/${room.room_code}`;
    
    if (room.room_type === "private_key" && room.room_password) {
      shareUrl += `?password=${encodeURIComponent(room.room_password)}`;
    }
    
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast({
      title: "Share link copied!",
      description: room.room_type === "private_key" 
        ? "Password-protected link copied. Recipients can join directly!"
        : "Room link copied. Share with others to invite them.",
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between flex-wrap gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-foreground bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
                    Room: {room.room_code}
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-2 h-2 rounded-full ${
                      room.room_type === "public" ? "bg-green-500" :
                      room.room_type === "locked" ? "bg-yellow-500" : "bg-blue-500"
                    }`} />
                    <p className="text-sm text-muted-foreground font-medium">
                      {room.room_type === "public" && "🌐 Public room - Anyone can join"}
                      {room.room_type === "locked" && "🔒 Locked room - Requires approval"}
                      {room.room_type === "private_key" && "🔑 Password protected room"}
                    </p>
                  </div>
                </div>
              </div>
              {room.room_type === "private_key" && room.room_password && room.host_id === userId && (
                <div className="flex items-center gap-3 mt-3 p-3 bg-muted/50 rounded-lg border border-border/50">
                  <span className="text-sm font-medium text-muted-foreground">Room Password:</span>
                  <code className="text-sm bg-background px-3 py-1 rounded-md font-mono border border-border/50 min-w-0 flex-1">
                    {showPassword ? room.room_password : "••••••••"}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPassword(!showPassword)}
                    className="h-8 w-8 p-0 hover:bg-muted"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                onClick={copyRoomLink}
                variant="outline"
                size="sm"
                className="hover:bg-black/100"
              >
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? "Copied!" : "Copy Link"}
              </Button>
              <Button
                onClick={shareRoomWithPassword}
                variant="default"
                size="sm"
                className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-sm"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share Room
              </Button>
              <Button
                onClick={refreshRoomData}
                variant="outline"
                size="sm"
                disabled={refreshing}
                className="hover:bg-blue-600/100"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? "Refreshing..." : "Refresh"}
              </Button>
              {room && (room.room_type === "public" || userId === room.host_id) && (
                <RoomSettings room={room} userId={userId} onRoomUpdate={() => loadRoom()} />
              )}
              <Button
                onClick={leaveRoom}
                variant="outline"
                size="sm"
                className="hover:bg-destructive/10 hover:border-destructive/20 hover:text-destructive"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Leave
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 shadow-sm overflow-hidden">
              <Tabs defaultValue="files" className="w-full">
                <div className="border-b border-border/50 bg-muted/30 px-6 py-4">
                  <TabsList className="grid w-full grid-cols-2 bg-background/50 p-1">
                    <TabsTrigger value="files" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <Upload className="h-4 w-4" />
                      <span className="font-medium">Files</span>
                    </TabsTrigger>
                    <TabsTrigger value="markdown" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <Edit className="h-4 w-4" />
                      <span className="font-medium">Notes</span>
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="files" className="p-6 space-y-6">
                  {room.file_sharing_enabled && (
                    <Card className="p-6 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20 shadow-sm">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Upload className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h2 className="text-xl font-semibold text-foreground">Upload Files</h2>
                          <p className="text-sm text-muted-foreground">Share files with room participants</p>
                        </div>
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

                  <Card className="p-6 bg-gradient-to-r from-secondary/5 to-secondary/10 border-secondary/20 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
                        <Download className="h-5 w-5 text-secondary-foreground" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-foreground">Shared Files</h2>
                        <p className="text-sm text-muted-foreground">Download files shared in this room</p>
                      </div>
                    </div>
                    <FileList roomId={room.id} />
                  </Card>
                </TabsContent>

                <TabsContent value="markdown" className="p-6">
                  <Card className="p-6 bg-gradient-to-r from-accent/5 to-accent/10 border-accent/20 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                        <Edit className="h-5 w-5 text-accent-foreground" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-foreground">Collaborative Notes</h2>
                        <p className="text-sm text-muted-foreground">Create and edit markdown notes together</p>
                      </div>
                    </div>
                    <MarkdownEditor roomId={room.id} userId={userId} />
                  </Card>
                </TabsContent>
            </Tabs>
            </div>
          </div>

          <div className="space-y-6">
            <RoomTimer expiresAt={room.expires_at} isPermanent={room.is_permanent} />
            
            <Card className="p-6 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Participants</h2>
                  <p className="text-sm text-muted-foreground">Room members and activity</p>
                </div>
              </div>
              <ParticipantList roomId={room.id} hostId={room.host_id} />
            </Card>

            {room.room_type === "locked" && room.host_id === userId && (
              <Card className="p-6 bg-gradient-to-r from-orange/5 to-orange/10 border-orange/20 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-orange/10 flex items-center justify-center">
                    <UserCheck className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">Join Requests</h2>
                    <p className="text-sm text-muted-foreground">Pending access requests</p>
                  </div>
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
