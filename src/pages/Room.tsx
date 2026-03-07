import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useKeyboardShortcuts, KeyboardShortcut } from "@/hooks/use-keyboard-shortcuts";
import { Upload, LogOut, Copy, Check, FileText, UserCheck, Eye, EyeOff, RefreshCw, Share2, Menu, Shield, Lock, Globe, Loader2, Info } from "lucide-react";
import { FileUpload } from "@/components/room/FileUpload";
import { FileList } from "@/components/room/FileList";
import { MarkdownEditor } from "@/components/room/MarkdownEditor";
import { JoinRequestDialog } from "@/components/room/JoinRequestDialog";
import { JoinRequestPanel } from "@/components/room/JoinRequestPanel";
import { PasswordEntryModal } from "@/components/room/PasswordEntryModal";
import { getDeviceId } from "@/utils/deviceId";
import { RoomSettings } from "@/components/room/RoomSettings";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";

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
  const [filesRefreshTrigger, setFilesRefreshTrigger] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("files");

  const roomShortcuts: KeyboardShortcut[] = [
    { key: 'f', alt: true, description: 'Switch to Files', action: () => setActiveTab("files"), context: 'Navigation' },
    { key: 'm', alt: true, description: 'Switch to Notes', action: () => setActiveTab("markdown"), context: 'Navigation' },
    { key: 'c', alt: true, description: 'Copy room link', action: () => copyRoomLink(), context: 'Room' },
    { key: 'r', alt: true, description: 'Refresh room', action: () => refreshRoomData(), context: 'Room' },
  ];

  useKeyboardShortcuts(roomShortcuts);

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
      if (!data) { toast({ title: "Room not found", description: "This room doesn't exist.", variant: "destructive" }); navigate("/"); return; }
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
  };

  const handleJoinRequest = async (data: { anonymousName?: string; message?: string }) => {
    if (!room) return;
    try {
      const deviceId = getDeviceId();
      await supabase.from("join_requests").insert({ room_id: room.id, user_id: userId, anonymous_name: data.anonymousName, message: data.message, device_id: deviceId, status: "pending" });
      navigate(`/room/${slug}/waiting`);
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
  };

  const copyRoomLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast({ title: "Link copied to clipboard", className: "rounded-full" });
    setTimeout(() => setCopied(false), 2000);
  };

  const shareRoomWithPassword = () => {
    if (!room) return;
    let shareUrl = `${window.location.origin}/room/${room.room_code}`;
    if (room.room_type === "private_key" && room.room_password) shareUrl += `?password=${encodeURIComponent(room.room_password)}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast({ title: "Link copied", description: "Password is included in the URL.", className: "rounded-full" });
    setTimeout(() => setCopied(false), 2000);
  };

  const refreshRoomData = async () => {
    if (!room) return;
    setRefreshing(true);
    try {
      const { data } = await supabase.from("rooms").select("*").eq("room_code", slug).maybeSingle();
      if (data) setRoom(data);
    } catch {} finally { setRefreshing(false); }
  };

  const isHost = room?.host_id === userId;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center selection:bg-primary/30">
        <Loader2 className="h-10 w-10 text-primary animate-spin mb-6 drop-shadow-md" />
        <p className="text-sm font-semibold tracking-widest uppercase text-muted-foreground">Loading workspace</p>
      </div>
    );
  }

  if (!hasAccess && room) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center p-4 selection:bg-primary/30">
        {/* Soft Ambient Background Elements */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
        
        <JoinRequestDialog isOpen={showJoinDialog} onClose={() => navigate("/")} onSubmit={handleJoinRequest} roomType={room.room_type} requiresPassword={false} />
        <PasswordEntryModal isOpen={showPasswordModal} onClose={() => navigate("/")} onSubmit={handlePasswordSubmit} />
        
        {/* Fallback Glass Card if dialogs are closed */}
        <Card className="p-10 text-center max-w-sm w-full bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl border border-white/20 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] rounded-[2rem] z-10">
          <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-1 ring-border/50">
             <Shield className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold mb-3 tracking-tight">Access Restricted</h2>
          <p className="text-sm text-muted-foreground">
            {room.room_type === "locked" ? "This workspace requires host approval." : "This workspace requires a password."}
          </p>
        </Card>
      </div>
    );
  }

  if (!room) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col font-sans selection:bg-primary/30 relative overflow-hidden">
      
      {/* Soft Ambient Background Elements */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* GLASSY HEADER */}
      <header className="sticky top-0 z-40 w-full bg-white/60 dark:bg-zinc-950/60 backdrop-blur-2xl border-b border-border/40 shadow-sm supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 group">
            <span className="font-extrabold text-foreground text-xl tracking-tight truncate uppercase">{room.room_code}</span>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/50 border border-border/50 shadow-inner">
              {room.room_type === "public" ? <Globe className="h-3.5 w-3.5 text-emerald-500" /> : room.room_type === "locked" ? <Shield className="h-3.5 w-3.5 text-amber-500" /> : <Lock className="h-3.5 w-3.5 text-primary" />}
              <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline-block text-muted-foreground">
                {room.room_type}
              </span>
            </div>
          </div>

          {/* Desktop Actions */}
          <div className="hidden sm:flex items-center gap-2">
            <Button onClick={copyRoomLink} variant="outline" size="sm" className="h-9 px-4 rounded-full text-xs font-bold border-border/50 bg-background/50 backdrop-blur-md shadow-sm hover:shadow active:scale-95 transition-all">
              {copied ? <Check className="h-4 w-4 mr-2 text-emerald-500" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? "COPIED" : "COPY LINK"}
            </Button>
            <Button onClick={refreshRoomData} variant="outline" size="icon" disabled={refreshing} className="h-9 w-9 rounded-full border-border/50 bg-background/50 backdrop-blur-md shadow-sm hover:shadow active:scale-95 transition-all">
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <div className="w-px h-5 bg-border/50 mx-1" />
            {(room.room_type === "public" || isHost) && (
              <RoomSettings room={room} userId={userId} onRoomUpdate={() => loadRoom()} />
            )}
            <Button onClick={() => navigate("/")} variant="ghost" size="sm" className="h-9 px-4 rounded-full text-xs font-bold text-destructive hover:bg-destructive/10 active:scale-95 transition-all">
              LEAVE
            </Button>
          </div>

          {/* Mobile Menu Toggle */}
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10 rounded-full border-border/50 bg-background/50 shadow-sm sm:hidden active:scale-95 transition-all">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85%] p-0 border-l border-white/10 bg-background/80 backdrop-blur-2xl flex flex-col rounded-l-[2rem]">
              <SheetHeader className="p-6 border-b border-border/40 text-left">
                <SheetTitle className="text-sm font-extrabold uppercase tracking-widest">Workspace Menu</SheetTitle>
              </SheetHeader>
              
              <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
                {room.room_type === "locked" && isHost && (
                  <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/20 backdrop-blur-md">
                    <div className="flex items-center gap-2 mb-3">
                      <UserCheck className="h-5 w-5 text-amber-600" />
                      <h3 className="text-xs font-extrabold text-amber-700 uppercase tracking-widest">Join Requests</h3>
                    </div>
                    <JoinRequestPanel roomId={room.id} hostId={room.host_id} />
                  </div>
                )}

                <div className="space-y-3">
                  {room.room_type === "private_key" && room.room_password && isHost && (
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-3xl border border-border/50">
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Password</span>
                      <div className="flex items-center gap-3">
                        <code className="text-sm font-mono font-bold tracking-widest">{showPassword ? room.room_password : "••••"}</code>
                        <Button variant="ghost" size="icon" onClick={() => setShowPassword(!showPassword)} className="h-8 w-8 rounded-full bg-background shadow-sm active:scale-95 transition-all">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  <Button onClick={() => { copyRoomLink(); setIsMobileMenuOpen(false); }} variant="outline" className="w-full justify-start h-14 rounded-full text-sm font-bold border-border/50 bg-background/50 shadow-sm active:scale-95 transition-all">
                    <Copy className="h-5 w-5 mr-3" /> COPY LINK
                  </Button>
                  <Button onClick={() => { shareRoomWithPassword(); setIsMobileMenuOpen(false); }} variant="outline" className="w-full justify-start h-14 rounded-full text-sm font-bold border-border/50 bg-background/50 shadow-sm active:scale-95 transition-all">
                    <Share2 className="h-5 w-5 mr-3" /> SHARE ROOM
                  </Button>
                  <Button onClick={() => { refreshRoomData(); setIsMobileMenuOpen(false); }} variant="outline" className="w-full justify-start h-14 rounded-full text-sm font-bold border-border/50 bg-background/50 shadow-sm active:scale-95 transition-all" disabled={refreshing}>
                    <RefreshCw className={`h-5 w-5 mr-3 ${refreshing ? 'animate-spin' : ''}`} /> REFRESH
                  </Button>
                  
                  {(room.room_type === "public" || isHost) && (
                    <div className="pt-2">
                      <RoomSettings room={room} userId={userId} onRoomUpdate={() => loadRoom()} />
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-6 border-t border-border/40">
                <Button onClick={() => navigate("/")} variant="destructive" className="w-full h-14 rounded-full text-sm font-bold shadow-md active:scale-95 transition-all">
                  <LogOut className="h-5 w-5 mr-3" /> LEAVE WORKSPACE
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      <main className="flex-1 w-full max-w-4xl mx-auto p-4 sm:p-6 pb-28 sm:pb-10 relative z-10">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          
          {/* iOS Segmented Control (Desktop Only) */}
          <div className="hidden sm:flex justify-center mb-8">
            <TabsList className="inline-flex bg-muted/40 backdrop-blur-md p-1.5 rounded-full border border-border/40 shadow-sm h-auto">
              <TabsTrigger value="files" className="text-xs font-bold uppercase tracking-widest px-8 py-2.5 rounded-full data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md transition-all">
                <Upload className="h-4 w-4 mr-2" /> Files
              </TabsTrigger>
              <TabsTrigger value="markdown" className="text-xs font-bold uppercase tracking-widest px-8 py-2.5 rounded-full data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md transition-all">
                <FileText className="h-4 w-4 mr-2" /> Notes
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Files Content */}
          <TabsContent value="files" className="mt-0 outline-none space-y-6 animate-in fade-in zoom-in-95 duration-500">
            {room.file_sharing_enabled && (
              <Card className="p-2 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] rounded-[2rem]">
                <FileUpload roomId={room.id} userId={userId} disabled={room.only_host_can_upload && !isHost} onFileUploaded={() => setFilesRefreshTrigger(prev => prev + 1)} />
              </Card>
            )}
            
            {room.only_host_can_upload && !isHost && (
              <div className="flex items-center p-4 text-sm font-semibold text-amber-800 dark:text-amber-200 bg-amber-500/10 backdrop-blur-md border border-amber-500/20 rounded-3xl mx-auto max-w-max shadow-sm">
                <Info className="h-5 w-5 mr-3" /> Only the host has permission to upload files.
              </div>
            )}
            
            <Card className="p-0 sm:p-6 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] rounded-[2rem] min-h-[50vh] overflow-hidden">
              <FileList roomId={room.id} userId={userId} isHost={isHost} refreshTrigger={filesRefreshTrigger} />
            </Card>
          </TabsContent>

          {/* Notes Content */}
          <TabsContent value="markdown" className="mt-0 outline-none animate-in fade-in zoom-in-95 duration-500">
            <Card className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] rounded-[2rem] min-h-[70vh] flex flex-col overflow-hidden">
              <MarkdownEditor roomId={room.id} userId={userId} />
            </Card>
          </TabsContent>
        </Tabs>

        {/* Desktop ONLY Host Join Requests (If Locked) */}
        {room.room_type === "locked" && isHost && (
          <div className="hidden sm:block mt-8 p-6 bg-amber-500/10 backdrop-blur-xl border border-amber-500/20 rounded-[2rem] shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <UserCheck className="h-6 w-6 text-amber-600" />
              <h3 className="text-sm font-extrabold text-amber-700 dark:text-amber-400 uppercase tracking-widest">Join Requests</h3>
            </div>
            <JoinRequestPanel roomId={room.id} hostId={room.host_id} />
          </div>
        )}
      </main>

      {/* MOBILE STICKY BOTTOM NAVIGATION (Glassy iOS Dock Style) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 p-4 pb-safe bg-gradient-to-t from-background via-background/90 to-transparent pointer-events-none">
        <div className="flex bg-white/60 dark:bg-zinc-900/60 backdrop-blur-2xl border border-white/20 dark:border-white/10 p-1.5 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] pointer-events-auto">
          <button 
            onClick={() => setActiveTab("files")} 
            className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-full transition-all duration-300 active:scale-95 ${activeTab === "files" ? "bg-background shadow-md text-primary" : "text-muted-foreground hover:bg-white/20"}`}
          >
            <Upload className={`h-5 w-5 mb-1 ${activeTab === "files" ? "stroke-[2.5px]" : ""}`} />
            <span className="text-[10px] font-extrabold uppercase tracking-widest">Files</span>
          </button>
          <button 
            onClick={() => setActiveTab("markdown")} 
            className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-full transition-all duration-300 active:scale-95 ${activeTab === "markdown" ? "bg-background shadow-md text-primary" : "text-muted-foreground hover:bg-white/20"}`}
          >
            <FileText className={`h-5 w-5 mb-1 ${activeTab === "markdown" ? "stroke-[2.5px]" : ""}`} />
            <span className="text-[10px] font-extrabold uppercase tracking-widest">Notes</span>
          </button>
        </div>
      </div>

    </div>
  );
};

export default Room;