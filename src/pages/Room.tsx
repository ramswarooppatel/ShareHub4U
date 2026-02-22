import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useKeyboardShortcuts, KeyboardShortcut } from "@/hooks/use-keyboard-shortcuts";
import { Upload, Download, Users, LogOut, Copy, Check, FileText, Edit, UserCheck, Eye, EyeOff, RefreshCw, Share2, Menu, Zap, Shield, Lock, Globe } from "lucide-react";
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

  // Define keyboard shortcuts for room functionality
  const roomShortcuts: KeyboardShortcut[] = [
    {
      key: 'f',
      alt: true,
      description: 'Switch to Files tab',
      action: () => document.querySelector('[data-shortcut="files-tab"]')?.click(),
      context: 'Navigation'
    },
    {
      key: 'm',
      alt: true,
      description: 'Switch to Notes tab',
      action: () => document.querySelector('[data-shortcut="notes-tab"]')?.click(),
      context: 'Navigation'
    },
    {
      key: 'u',
      alt: true,
      description: 'Upload files',
      action: () => {
        // Trigger file upload dialog
        const uploadArea = document.querySelector('[data-shortcut="upload-files"]');
        if (uploadArea && activeTab === 'files') uploadArea.click();
      },
      context: 'Files'
    },
    {
      key: 'd',
      alt: true,
      description: 'Download selected file',
      action: () => {
        // Find download button for selected/previewed file
        const downloadBtn = document.querySelector('[data-shortcut="download-file"]') || document.querySelector('button:has(.lucide-download)');
        if (downloadBtn && activeTab === 'files') downloadBtn.click();
      },
      context: 'Files'
    },
    {
      key: 'v',
      alt: true,
      description: 'Preview selected file',
      action: () => {
        // Find preview button for selected file
        const previewBtn = document.querySelector('[data-shortcut="preview-file"]') || document.querySelector('button:has(.lucide-eye)');
        if (previewBtn && activeTab === 'files') previewBtn.click();
      },
      context: 'Files'
    },
    {
      key: 'x',
      alt: true,
      description: 'Delete selected file',
      action: () => {
        // Find delete button for selected file
        const deleteBtn = document.querySelector('[data-shortcut="delete-file"]') || document.querySelector('button:has(.lucide-trash2)');
        if (deleteBtn && activeTab === 'files') deleteBtn.click();
      },
      context: 'Files'
    },
    {
      key: 'g',
      alt: true,
      description: 'Clear search & filters',
      action: () => {
        // Clear search and reset filters
        const clearBtn = document.querySelector('[data-shortcut="clear-search"]') || document.querySelector('button:has(.lucide-x)');
        if (clearBtn && activeTab === 'files') clearBtn.click();
      },
      context: 'Files'
    },
    {
      key: 'e',
      alt: true,
      description: 'Switch to Edit mode (Notes)',
      action: () => {
        const editTab = document.querySelector('[data-shortcut="edit-mode"]');
        if (editTab && activeTab === 'markdown') editTab.click();
      },
      context: 'Notes'
    },
    {
      key: 'p',
      alt: true,
      description: 'Switch to Preview mode (Notes)',
      action: () => {
        const previewTab = document.querySelector('[data-shortcut="preview-mode"]');
        if (previewTab && activeTab === 'markdown') previewTab.click();
      },
      context: 'Notes'
    },
    {
      key: 's',
      alt: true,
      description: 'Save note',
      action: () => {
        const saveBtn = document.querySelector('[data-shortcut="save-note"]');
        if (saveBtn && activeTab === 'markdown') saveBtn.click();
      },
      context: 'Notes'
    },
    {
      key: 'c',
      alt: true,
      description: 'Copy room link',
      action: () => document.querySelector('[data-shortcut="copy-link"]')?.click(),
      context: 'Room'
    },
    {
      key: 'h',
      alt: true,
      description: 'Share room with password',
      action: () => document.querySelector('[data-shortcut="share-room"]')?.click(),
      context: 'Room'
    },
    {
      key: 'r',
      alt: true,
      description: 'Refresh room data',
      action: () => document.querySelector('[data-shortcut="refresh-room"]')?.click(),
      context: 'Room'
    },
    {
      key: 'q',
      alt: true,
      description: 'Leave room',
      action: () => document.querySelector('[data-shortcut="leave-room"]')?.click(),
      context: 'Room'
    }
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

  // Smoother Access Required State
  if (!hasAccess && room) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-background flex items-center justify-center p-4">
        <JoinRequestDialog isOpen={showJoinDialog} onClose={() => navigate("/")} onSubmit={handleJoinRequest} roomType={room.room_type} requiresPassword={false} />
        <PasswordEntryModal isOpen={showPasswordModal} onClose={() => navigate("/")} onSubmit={handlePasswordSubmit} />
        <Card className="p-10 text-center max-w-md w-full shadow-lg border-border/40 bg-card/80 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-500 ease-out">
          <div className="mx-auto w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center mb-6 shadow-inner ring-1 ring-border/50">
            <Shield className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-semibold mb-3 tracking-tight">Access Required</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {room.room_type === "locked" ? "This room is locked. You need host approval to enter." : "This room is private and protected by a secure password."}
          </p>
        </Card>
      </div>
    );
  }

  // Smoother Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-background flex flex-col items-center justify-center animate-in fade-in duration-700">
        <div className="relative flex items-center justify-center w-20 h-20 mb-6">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse"></div>
          <div className="relative w-14 h-14 bg-background border border-border rounded-2xl flex items-center justify-center shadow-lg">
            <Zap className="h-6 w-6 text-primary animate-pulse" />
          </div>
        </div>
        <p className="text-sm font-semibold text-muted-foreground tracking-[0.2em] uppercase">Connecting...</p>
      </div>
    );
  }

  if (!room) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background flex flex-col font-sans selection:bg-primary/20">
      
      {/* Sleek, blurring header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/30 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">
          
          {/* Brand & Room Info */}
          <div className="flex items-center gap-4 min-w-0">
            <button 
              onClick={() => navigate("/")} 
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 hover:bg-primary/20 active:scale-95 transition-all duration-200 flex-shrink-0 group"
            >
              <Zap className="h-4 w-4 text-primary transition-transform duration-300 group-hover:scale-110" />
            </button>
            <div className="h-6 w-px bg-border/50 hidden sm:block" />
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-semibold text-foreground text-base tracking-tight truncate">{room.room_code}</span>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 border border-border/50 shadow-sm transition-colors duration-300">
                {room.room_type === "public" ? <Globe className="h-3 w-3 text-emerald-500" /> : room.room_type === "locked" ? <Shield className="h-3 w-3 text-amber-500" /> : <Lock className="h-3 w-3 text-primary" />}
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hidden sm:inline-block">
                  {room.room_type === "public" ? "Public" : room.room_type === "locked" ? "Locked" : "Private"}
                </span>
              </div>
            </div>
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-1.5">
            {room.room_type === "private_key" && room.room_password && isHost && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 rounded-lg mr-2 border border-border/40 transition-colors hover:bg-muted/50">
                <span className="text-xs text-muted-foreground font-medium">Password:</span>
                <code className="text-xs font-mono font-semibold text-foreground tracking-wider">{showPassword ? room.room_password : "••••"}</code>
                <Button variant="ghost" size="icon" onClick={() => setShowPassword(!showPassword)} className="h-6 w-6 ml-1 text-muted-foreground hover:text-foreground rounded-md transition-all">
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
            )}
            
            <Button onClick={copyRoomLink} data-shortcut="copy-link" variant="ghost" size="sm" className="h-9 px-3 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all rounded-lg active:scale-95">
              {copied ? <Check className="h-4 w-4 mr-2 text-emerald-500" /> : <Copy className="h-4 w-4 mr-2" />}
              <span className="text-xs font-medium">{copied ? "Copied" : "Copy"}</span>
            </Button>
            
            <Button onClick={shareRoomWithPassword} data-shortcut="share-room" variant="ghost" size="sm" className="h-9 px-3 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all rounded-lg active:scale-95">
              <Share2 className="h-4 w-4 mr-2" />
              <span className="text-xs font-medium">Share</span>
            </Button>
            
            <div className="w-px h-5 bg-border/50 mx-1.5" />
            
            <Button onClick={refreshRoomData} data-shortcut="refresh-room" variant="ghost" size="icon" disabled={refreshing} className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all rounded-lg active:scale-95">
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>

            {(room.room_type === "public" || isHost) && (
              <RoomSettings room={room} userId={userId} onRoomUpdate={() => loadRoom()} />
            )}
            
            <Button onClick={() => navigate("/")} data-shortcut="leave-room" variant="ghost" size="sm" className="h-9 px-3 ml-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all rounded-lg active:scale-95 group">
              <LogOut className="h-4 w-4 mr-2 group-hover:-translate-x-0.5 transition-transform" />
              <span className="text-xs font-medium">Leave</span>
            </Button>
          </div>

          {/* Mobile Menu */}
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 md:hidden rounded-xl bg-muted/30 border border-border/30 active:scale-95 transition-all">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85%] sm:w-80 p-0 border-l border-border/30 bg-background/95 backdrop-blur-xl">
              <div className="flex flex-col h-full">
                <div className="p-6 border-b border-border/30 bg-muted/10">
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest mb-1.5">Active Space</p>
                  <p className="text-xl font-bold tracking-tight">{room.room_code}</p>
                </div>
                
                <div className="p-4 flex-1 overflow-y-auto space-y-2">
                  {room.room_type === "private_key" && room.room_password && isHost && (
                    <div className="flex items-center justify-between p-3.5 bg-muted/40 rounded-xl mb-4 border border-border/40">
                      <span className="text-sm font-medium text-muted-foreground">Password</span>
                      <div className="flex items-center gap-3">
                        <code className="text-sm font-mono font-bold tracking-widest">{showPassword ? room.room_password : "••••"}</code>
                        <Button variant="ghost" size="icon" onClick={() => setShowPassword(!showPassword)} className="h-8 w-8 rounded-lg hover:bg-background shadow-sm">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  <Button onClick={() => { copyRoomLink(); setIsMobileMenuOpen(false); }} variant="ghost" className="w-full justify-start h-12 rounded-xl hover:bg-muted/50 transition-colors">
                    <Copy className="h-4 w-4 mr-3 text-muted-foreground" /> <span className="font-medium">Copy Link</span>
                  </Button>
                  
                  <Button onClick={() => { shareRoomWithPassword(); setIsMobileMenuOpen(false); }} variant="ghost" className="w-full justify-start h-12 rounded-xl hover:bg-muted/50 transition-colors">
                    <Share2 className="h-4 w-4 mr-3 text-muted-foreground" /> <span className="font-medium">Share Room</span>
                  </Button>
                  
                  <Button onClick={() => { refreshRoomData(); setIsMobileMenuOpen(false); }} variant="ghost" className="w-full justify-start h-12 rounded-xl hover:bg-muted/50 transition-colors" disabled={refreshing}>
                    <RefreshCw className={`h-4 w-4 mr-3 text-muted-foreground ${refreshing ? 'animate-spin' : ''}`} /> <span className="font-medium">Refresh Data</span>
                  </Button>

                  {(room.room_type === "public" || isHost) && (
                    <div className="pt-2">
                      <RoomSettings room={room} userId={userId} onRoomUpdate={() => loadRoom()} />
                    </div>
                  )}
                </div>
                
                <div className="p-4 border-t border-border/30 bg-muted/5">
                  <Button onClick={() => navigate("/")} variant="outline" className="w-full h-12 rounded-xl text-destructive border-destructive/20 hover:bg-destructive hover:text-destructive-foreground transition-colors">
                    <LogOut className="h-4 w-4 mr-2" /> <span className="font-medium">Leave Room</span>
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-6 lg:pb-6 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
          
          {/* Main Content Area (Tabs) */}
          <div className="lg:col-span-3 order-2 lg:order-1 flex flex-col h-[calc(100vh-11rem)] lg:h-auto min-h-[600px]">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
              
              {/* Smooth segmented control style tabs */}
              <TabsList className="w-full sm:w-auto self-start bg-muted/40 p-1.5 rounded-xl border border-border/30 mb-6 grid grid-cols-2 h-12 relative overflow-hidden">
                <TabsTrigger 
                  value="files"
                  data-shortcut="files-tab"
                  className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary transition-all duration-300 text-sm font-semibold z-10"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Files
                </TabsTrigger>
                <TabsTrigger 
                  value="markdown"
                  data-shortcut="notes-tab"
                  className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary transition-all duration-300 text-sm font-semibold z-10"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Notes
                </TabsTrigger>
              </TabsList>

              {/* Tab Contents with smooth fade/slide transitions */}
              <TabsContent 
                value="files" 
                className="flex-1 mt-0 outline-none flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-2 duration-500"
              >
                {room.file_sharing_enabled && (
                  <Card className="p-1 border-border/30 shadow-sm bg-card/80 backdrop-blur-sm rounded-2xl transition-shadow duration-300 hover:shadow-md">
                    <FileUpload roomId={room.id} userId={userId} disabled={room.only_host_can_upload && !isHost} onFileUploaded={() => setFilesRefreshTrigger(prev => prev + 1)} />
                  </Card>
                )}
                {room.only_host_can_upload && !isHost && (
                  <div className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground py-2 px-4 bg-muted/30 rounded-full w-fit mx-auto border border-border/30">
                    <Lock className="h-3.5 w-3.5" /> Only the host can upload files
                  </div>
                )}
                <Card className="flex-1 p-0 sm:p-5 border-border/30 shadow-sm bg-card/80 backdrop-blur-sm rounded-2xl overflow-hidden flex flex-col min-h-[400px] transition-shadow duration-300 hover:shadow-md">
                  <FileList roomId={room.id} userId={userId} isHost={isHost} refreshTrigger={filesRefreshTrigger} />
                </Card>
              </TabsContent>

              <TabsContent 
                value="markdown" 
                className="flex-1 mt-0 outline-none flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-500"
              >
                <Card className="flex-1 border-border/30 shadow-sm pb-20 sm:pb-2 bg-card/80 backdrop-blur-sm rounded-2xl overflow-hidden transition-shadow duration-300 hover:shadow-md">
                  <MarkdownEditor roomId={room.id} userId={userId} />
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar Area */}
          <div className="space-y-5 order-1 lg:order-2">
            
            {/* Smooth timer */}
            <div className="rounded-2xl border border-border/30 shadow-sm overflow-hidden bg-card/80 backdrop-blur-sm transition-shadow duration-300 hover:shadow-md">
              <RoomTimer expiresAt={room.expires_at} isPermanent={room.is_permanent} />
            </div>

            {/* Participants Card */}
            <Card className="p-5 border-border/30 shadow-sm rounded-2xl bg-card/80 backdrop-blur-sm transition-shadow duration-300 hover:shadow-md">
              <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-border/30">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-sm font-bold tracking-tight">Participants</h3>
              </div>
              <ParticipantList roomId={room.id} hostId={room.host_id} />
            </Card>

            {/* Join Requests (Host Only) */}
            {room.room_type === "locked" && isHost && (
              <Card className="p-5 border-amber-200/40 dark:border-amber-900/40 shadow-sm rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 backdrop-blur-sm transition-shadow duration-300 hover:shadow-md">
                <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-amber-200/50 dark:border-amber-900/40">
                  <div className="p-1.5 rounded-md bg-amber-100 dark:bg-amber-900/60">
                    <UserCheck className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                  </div>
                  <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200 tracking-tight">Pending Requests</h3>
                </div>
                <JoinRequestPanel roomId={room.id} hostId={room.host_id} />
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* Keyboard Shortcuts Display */}
      <div className="border-t border-white/5 bg-background/20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-3">
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Room Shortcuts:</span>
            {roomShortcuts.map((shortcut, index) => (
              <div key={index} className="flex items-center gap-1">
                <kbd className="px-2 py-1 bg-muted/50 border border-border/50 rounded text-xs font-mono">
                  {shortcut.alt && 'Alt+'}
                  {shortcut.ctrl && 'Ctrl+'}
                  {shortcut.shift && 'Shift+'}
                  {shortcut.key.toUpperCase()}
                </kbd>
                <span className="text-muted-foreground/80">{shortcut.description}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Smooth Mobile Bottom Navigation (Floating Pill Style) */}
      <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm z-50 animate-in slide-in-from-bottom-10 duration-500">
        <div className="flex items-center justify-between p-1.5 bg-background/80 backdrop-blur-xl border border-border/50 rounded-full shadow-2xl">
          <button
            onClick={() => setActiveTab("files")}
            className={`flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-full transition-all duration-300 ${
              activeTab === "files" 
                ? "bg-primary text-primary-foreground shadow-md scale-100" 
                : "text-muted-foreground hover:bg-muted/50 scale-95 hover:scale-100"
            }`}
          >
            <Upload className={`h-4 w-4 ${activeTab === "files" ? "stroke-[2.5px]" : ""}`} />
            <span className="text-xs font-semibold tracking-wide">Files</span>
          </button>
          
          <button
            onClick={() => setActiveTab("markdown")}
            className={`flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-full transition-all duration-300 ${
              activeTab === "markdown" 
                ? "bg-primary text-primary-foreground shadow-md scale-100" 
                : "text-muted-foreground hover:bg-muted/50 scale-95 hover:scale-100"
            }`}
          >
            <Edit className={`h-4 w-4 ${activeTab === "markdown" ? "stroke-[2.5px]" : ""}`} />
            <span className="text-xs font-semibold tracking-wide">Notes</span>
          </button>
        </div>
      </div>

    </div>
  );
};

export default Room;