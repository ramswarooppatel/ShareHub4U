import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, Users, LogOut, Copy, Check, FileText, Edit, UserCheck, Eye, EyeOff, RefreshCw, Share2, Menu, Zap } from "lucide-react";
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
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("files");

  useEffect(() => { initializeUser(); }, []);
  useEffect(() => { if (userId) loadRoom(); }, [slug, userId]);

  const initializeUser = async () => {
    const storedUserId = localStorage.getItem("user_id");
    if (storedUserId) {
      setUserId(storedUserId);
    } else {
      const { data: userData, error: userError } = await supabase.from("users").insert({}).select().single();
      if (userError) { toast({ title: "Error", description: userError.message, variant: "destructive" }); return; }
      localStorage.setItem("user_id", userData.id);
      setUserId(userData.id);
    }
  };

  const loadRoom = async () => {
    try {
      const { data, error } = await supabase.from("rooms").select("*").eq("room_code", slug).maybeSingle();
      if (error) throw error;
      if (!data) { toast({ title: "Room not found", description: "This room doesn't exist or has expired.", variant: "destructive" }); navigate("/"); return; }
      if (data.expires_at && new Date(data.expires_at) < new Date() && !data.is_permanent) { toast({ title: "Room expired", variant: "destructive" }); navigate("/"); return; }

      setRoom(data);
      const deviceId = getDeviceId();
      const isHost = data.host_id === userId;

      if (isHost) { setHasAccess(true); }
      else {
        const { data: participantData } = await supabase.from("room_participants").select("*").eq("room_id", data.id).eq("device_id", deviceId).maybeSingle();
        if (participantData) { setHasAccess(true); }
        else {
          if (data.room_type === "public") {
            await supabase.from("room_participants").insert({ room_id: data.id, user_id: userId, device_id: deviceId, role: "member" });
            setHasAccess(true);
          } else if (data.room_type === "private_key") {
            const urlPassword = searchParams.get("password");
            if (urlPassword && urlPassword === data.room_password) {
              await supabase.from("room_participants").insert({ room_id: data.id, user_id: userId, device_id: deviceId, role: "member" });
              setHasAccess(true);
            } else { setShowPasswordModal(true); setHasAccess(false); setLoading(false); return; }
          } else if (data.room_type === "locked") {
            if (data.auto_accept_requests) {
              await supabase.from("room_participants").insert({ room_id: data.id, user_id: userId, device_id: deviceId, role: "member" });
              setHasAccess(true);
            } else {
              const { data: requestData } = await supabase.from("join_requests").select("*").eq("room_id", data.id).eq("device_id", deviceId).order("created_at", { ascending: false }).limit(1).maybeSingle();
              if (requestData?.status === "approved") {
                await supabase.from("room_participants").insert({ room_id: data.id, user_id: userId, device_id: deviceId, role: "member" });
                setHasAccess(true);
              } else if (requestData?.status === "pending") { navigate(`/room/${slug}/waiting`); return; }
              else { setShowJoinDialog(true); setHasAccess(false); setLoading(false); return; }
            }
          }
        }
      }
      setHasAccess(true);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handlePasswordSubmit = async (password: string) => {
    if (!room) return;
    if (password !== room.room_password) { toast({ title: "Incorrect password", variant: "destructive" }); return; }
    const deviceId = getDeviceId();
    await supabase.from("room_participants").insert({ room_id: room.id, user_id: userId, device_id: deviceId, role: "member" });
    setHasAccess(true); setShowPasswordModal(false);
    toast({ title: "Access granted!" });
  };

  const handleJoinRequest = async (data: { anonymousName?: string; message?: string }) => {
    if (!room) return;
    try {
      const deviceId = getDeviceId();
      const { error } = await supabase.from("join_requests").insert({ room_id: room.id, user_id: userId, anonymous_name: data.anonymousName, message: data.message, device_id: deviceId, status: "pending" });
      if (error) throw error;
      toast({ title: "Request sent!", description: "Redirecting to waiting page..." });
      navigate(`/room/${slug}/waiting`);
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
  };

  const copyRoomLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast({ title: "Link copied!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const shareRoomWithPassword = () => {
    if (!room) return;
    let shareUrl = `${window.location.origin}/room/${room.room_code}`;
    if (room.room_type === "private_key" && room.room_password) shareUrl += `?password=${encodeURIComponent(room.room_password)}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast({ title: "Share link copied!", description: room.room_type === "private_key" ? "Password-protected link copied." : "Room link copied." });
    setTimeout(() => setCopied(false), 2000);
  };

  const refreshRoomData = async () => {
    if (!room) return;
    setRefreshing(true);
    try {
      const { data } = await supabase.from("rooms").select("*").eq("room_code", slug).maybeSingle();
      if (data) { setRoom(data); toast({ title: "Refreshed!" }); }
    } catch {} finally { setRefreshing(false); }
  };

  const isHost = room?.host_id === userId;

  if (!hasAccess && room) {
    return (
      <>
        <JoinRequestDialog isOpen={showJoinDialog} onClose={() => navigate("/")} onSubmit={handleJoinRequest} roomType={room.room_type} requiresPassword={false} />
        <PasswordEntryModal isOpen={showPasswordModal} onClose={() => navigate("/")} onSubmit={handlePasswordSubmit} />
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="p-8 text-center max-w-sm">
            <h2 className="text-xl font-bold mb-2">Access Required</h2>
            <p className="text-sm text-muted-foreground">{room.room_type === "locked" ? "This room requires host approval." : "This room is password protected."}</p>
          </Card>
        </div>
      </>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center animate-pulse">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Loading room...</p>
        </div>
      </div>
    );
  }

  if (!room) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/30 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Left */}
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate("/")} className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-shrink-0">
              <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
                <Zap className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            </button>
            <div className="h-5 w-px bg-border/50" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-semibold text-foreground truncate text-sm">{room.room_code}</h1>
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  room.room_type === "public" ? "bg-success" : room.room_type === "locked" ? "bg-warning" : "bg-primary"
                }`} />
                <span className="text-xs text-muted-foreground hidden sm:block">
                  {room.room_type === "public" ? "Public" : room.room_type === "locked" ? "Locked" : "Private"}
                </span>
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-1.5">
            {/* Desktop actions */}
            <div className="hidden md:flex items-center gap-1.5">
              {room.room_type === "private_key" && room.room_password && isHost && (
                <div className="flex items-center gap-1 px-2 py-1 bg-muted/50 rounded-md mr-1">
                  <code className="text-xs font-mono text-muted-foreground">{showPassword ? room.room_password : "••••"}</code>
                  <Button variant="ghost" size="sm" onClick={() => setShowPassword(!showPassword)} className="h-5 w-5 p-0">
                    {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </Button>
                </div>
              )}
              <Button onClick={copyRoomLink} variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span className="hidden lg:inline">{copied ? "Copied" : "Copy"}</span>
              </Button>
              <Button onClick={shareRoomWithPassword} variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
                <Share2 className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Share</span>
              </Button>
              <Button onClick={refreshRoomData} variant="ghost" size="sm" disabled={refreshing} className="h-8 w-8 p-0">
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
              {(room.room_type === "public" || isHost) && (
                <RoomSettings room={room} userId={userId} onRoomUpdate={() => loadRoom()} />
              )}
              <Button onClick={() => navigate("/")} variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive">
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Leave</span>
              </Button>
            </div>

            {/* Mobile menu */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 md:hidden">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <div className="space-y-4 pt-6">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Room</p>
                    <p className="font-semibold">{room.room_code}</p>
                  </div>
                  {room.room_type === "private_key" && room.room_password && isHost && (
                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                      <span className="text-xs text-muted-foreground">Password:</span>
                      <code className="text-xs font-mono flex-1">{showPassword ? room.room_password : "••••"}</code>
                      <Button variant="ghost" size="sm" onClick={() => setShowPassword(!showPassword)} className="h-6 w-6 p-0">
                        {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                    </div>
                  )}
                  <div className="space-y-1">
                    <Button onClick={() => { copyRoomLink(); setIsMobileMenuOpen(false); }} variant="ghost" size="sm" className="w-full justify-start">
                      <Copy className="h-4 w-4 mr-2" /> Copy Link
                    </Button>
                    <Button onClick={() => { shareRoomWithPassword(); setIsMobileMenuOpen(false); }} variant="ghost" size="sm" className="w-full justify-start">
                      <Share2 className="h-4 w-4 mr-2" /> Share Room
                    </Button>
                    <Button onClick={() => { refreshRoomData(); setIsMobileMenuOpen(false); }} variant="ghost" size="sm" className="w-full justify-start" disabled={refreshing}>
                      <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
                    </Button>
                    {(room.room_type === "public" || isHost) && (
                      <div className="pt-1">
                        <RoomSettings room={room} userId={userId} onRoomUpdate={() => loadRoom()} />
                      </div>
                    )}
                    <Button onClick={() => navigate("/")} variant="ghost" size="sm" className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10">
                      <LogOut className="h-4 w-4 mr-2" /> Leave Room
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-4 lg:py-6">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 lg:gap-6">
          {/* Content */}
          <div className="xl:col-span-3 order-2 xl:order-1">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 h-10 bg-muted/30 p-1">
                <TabsTrigger value="files" className="gap-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Upload className="h-4 w-4" />
                  Files
                </TabsTrigger>
                <TabsTrigger value="markdown" className="gap-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Edit className="h-4 w-4" />
                  Notes
                </TabsTrigger>
              </TabsList>

              <TabsContent value="files" className="mt-4 space-y-4">
                {room.file_sharing_enabled && (
                  <FileUpload
                    roomId={room.id}
                    userId={userId}
                    disabled={room.only_host_can_upload && !isHost}
                  />
                )}
                {room.only_host_can_upload && !isHost && (
                  <p className="text-xs text-muted-foreground text-center">Only the host can upload files.</p>
                )}
                <FileList roomId={room.id} userId={userId} isHost={isHost} />
              </TabsContent>

              <TabsContent value="markdown" className="mt-4">
                <MarkdownEditor roomId={room.id} userId={userId} />
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-4 order-1 xl:order-2">
            <RoomTimer expiresAt={room.expires_at} isPermanent={room.is_permanent} />

            <Card className="p-4 border-border/50">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Participants</h3>
              </div>
              <ParticipantList roomId={room.id} hostId={room.host_id} />
            </Card>

            {room.room_type === "locked" && isHost && (
              <Card className="p-4 border-border/50">
                <div className="flex items-center gap-2 mb-3">
                  <UserCheck className="h-4 w-4 text-warning" />
                  <h3 className="text-sm font-semibold text-foreground">Join Requests</h3>
                </div>
                <JoinRequestPanel roomId={room.id} hostId={room.host_id} />
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border/30 bg-card/95 backdrop-blur-md">
        <div className="grid grid-cols-2">
          <button
            onClick={() => setActiveTab("files")}
            className={`flex flex-col items-center justify-center py-2.5 transition-colors ${
              activeTab === "files" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Upload className="h-5 w-5 mb-0.5" />
            <span className="text-[10px] font-medium">Files</span>
          </button>
          <button
            onClick={() => setActiveTab("markdown")}
            className={`flex flex-col items-center justify-center py-2.5 transition-colors ${
              activeTab === "markdown" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Edit className="h-5 w-5 mb-0.5" />
            <span className="text-[10px] font-medium">Notes</span>
          </button>
        </div>
      </div>
      <div className="lg:hidden h-14" />
    </div>
  );
};

export default Room;
