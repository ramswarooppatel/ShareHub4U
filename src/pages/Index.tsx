import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, Key, Globe, ArrowRight, Sparkles, Shield, Zap, Hash, Plus, Settings, Trash, Clock, MapPin, ChevronRight, RefreshCw, Info } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // State
  const [customSlug, setCustomSlug] = useState("");
  const [roomType, setRoomType] = useState("public");
  const [roomTiming, setRoomTiming] = useState("24h");
  const [roomPassword, setRoomPassword] = useState("");
  const [hostUsername, setHostUsername] = useState("");
  const [hostPasscode, setHostPasscode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [showJoinPasswordDialog, setShowJoinPasswordDialog] = useState(false);
  const [pendingRoomData, setPendingRoomData] = useState<{ room_code: string; room_type: string; room_password?: string; } | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  
  const [nearbyRooms, setNearbyRooms] = useState<{room_code:string; display_name?:string; last_seen?:string}[]>([]);
  const [isRefreshingNearby, setIsRefreshingNearby] = useState(false);
  const [recentRooms, setRecentRooms] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  
  const SETTINGS_KEY = "sharehub_settings"; 
  const defaultSettings = { hideNearbyRooms: false, saveRoomHistory: true };
  const [settings, setSettings] = useState<{ hideNearbyRooms: boolean; saveRoomHistory: boolean }>(defaultSettings);

  const joinCodeInputRef = useRef<HTMLInputElement>(null);

  // --- LOCAL STORAGE LOGIC FOR RECENT ROOMS ---
  const RECENT_ROOMS_KEY = "recent_room_codes";
  
  const loadRecentRooms = () => {
    try {
      const raw = localStorage.getItem(RECENT_ROOMS_KEY);
      if (!raw) return [] as string[];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [] as string[];
    }
  };

  const saveRecentRooms = (arr: string[]) => {
    try { localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(arr)); } catch (e) {}
  };

  const addRecentRoom = (roomCode: string) => {
    if (!roomCode) return;
    // Always persist recent rooms to localStorage (no duplicates).
    try {
      const existing = loadRecentRooms();
      const dedup = [roomCode, ...existing.filter(r => r !== roomCode)].slice(0, 20);
      saveRecentRooms(dedup);
      // update UI state only if user has history enabled
      if (settings.saveRoomHistory) setRecentRooms(dedup);
    } catch (e) {
      // best-effort
    }
  };

  const removeRecentRoom = (roomCode: string) => {
    setRecentRooms(prev => {
      const next = prev.filter(r => r !== roomCode);
      saveRecentRooms(next);
      return next;
    });
  };

  const clearAllRecentRooms = () => {
    setRecentRooms([]);
    saveRecentRooms([]);
    toast({ title: "History Cleared", className: "rounded-full" });
  };

  // --- SETTINGS LOGIC ---
  const saveSettingsToSession = (s: typeof settings) => {
    try { sessionStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) {}
  };

  const loadSettingsFromSession = () => {
    try {
      const raw = sessionStorage.getItem(SETTINGS_KEY);
      if (!raw) return defaultSettings;
      const parsed = JSON.parse(raw);
      return { ...defaultSettings, ...(parsed || {}) };
    } catch (e) { return defaultSettings; }
  };

  // Fetch Nearby Rooms Manually
  const handleRefreshNearby = async () => {
    setIsRefreshingNearby(true);
    try {
      const { fetchNearbyRooms } = await import('@/lib/presence');
      const rooms = await fetchNearbyRooms();
      setNearbyRooms(rooms || []);
      toast({ title: "Nearby network scanned!", className: "rounded-full" });
    } catch (e) {
      toast({ title: "Failed to scan nearby network", variant: "destructive" });
    } finally {
      setIsRefreshingNearby(false);
    }
  };

  useEffect(() => {
    const s = loadSettingsFromSession();
    setSettings(s);
    if (s.saveRoomHistory) {
      try { setRecentRooms(loadRecentRooms()); } catch (e) {}
    } else {
      setRecentRooms([]);
    }

    let mounted = true;
    let interval: any;
    const loadNearby = async () => {
      if (!mounted) return;
      if (s.hideNearbyRooms) { setNearbyRooms([]); return; }
      try {
        const { fetchNearbyRooms } = await import('@/lib/presence');
        const rooms = await fetchNearbyRooms();
        if (!mounted) return;
        setNearbyRooms(rooms || []);
      } catch (e) {
        // Module might not exist yet or failed
      }
    };
    loadNearby();
    interval = setInterval(loadNearby, 20_000);
    return () => { mounted = false; clearInterval(interval); };
  }, []); 

  useEffect(() => {
    if (settings.hideNearbyRooms) setNearbyRooms([]);
    saveSettingsToSession(settings);
    if (!settings.saveRoomHistory) {
      setRecentRooms([]);
      saveRecentRooms([]);
    } else {
      try { setRecentRooms(loadRecentRooms()); } catch (e) {}
    }
  }, [settings]);

  // --- ROOM LOGIC ---
  const generateRoomCode = () => Math.random().toString(36).substring(2, 8).toLowerCase();

  const createRoom = async () => {
    if (roomType === "private_key" && !roomPassword.trim()) {
      toast({ title: "Password required", description: "Please enter a password for the private key room.", variant: "destructive" });
      return;
    }
    if (roomType === "locked" && (!hostUsername.trim() || !hostPasscode.trim())) {
      toast({ title: "Credentials required", description: "Please enter username and passphrase for locked room.", variant: "destructive" });
      return;
    }

    setIsCreating(true);
    try {
      const roomCode = customSlug.trim() || generateRoomCode();
      const { data: existing } = await supabase.from("rooms").select("id").eq("room_code", roomCode).maybeSingle();
      if (existing) {
        toast({ title: "Room exists", description: "Choose a different code or leave blank.", variant: "destructive" });
        return;
      }

      const now = new Date();
      const hours = roomTiming.includes('h') ? parseInt(roomTiming) : parseInt(roomTiming) * 24;
      const expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000);

      const { data: room, error } = await supabase.from("rooms").insert({
        room_code: roomCode, 
        room_type: roomType, 
        host_id: null,
        room_password: roomType === "private_key" ? roomPassword : null,
        is_permanent: false, 
        expires_at: expiresAt, 
        file_sharing_enabled: true,
        only_host_can_upload: false, 
        auto_accept_requests: roomType === "locked" ? false : true,
      }).select().single();

      if (error) throw error;

      toast({ title: "Room created!", description: `Room code: ${roomCode}`, className: "rounded-full" });
      addRecentRoom(roomCode);
      navigate(`/room/${roomCode}`);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Something went wrong.", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const joinRoom = async () => {
    if (!joinCode.trim()) { toast({ title: "Enter a code", description: "Please enter a room code.", variant: "destructive" }); return; }
    setIsJoining(true);
    try {
      const { data: roomData, error } = await supabase.from("rooms").select("id, room_code, room_type, room_password, expires_at").eq("room_code", joinCode.trim().toLowerCase()).maybeSingle();
      if (error) throw error;
      if (!roomData) { toast({ title: "Not found", description: "Room doesn't exist.", variant: "destructive" }); return; }
      
      if (roomData.room_type === "private_key") {
        setPendingRoomData({ room_code: roomData.room_code, room_type: roomData.room_type, room_password: roomData.room_password || undefined });
        setShowJoinPasswordDialog(true);
      } else {
        addRecentRoom(roomData.room_code);
        navigate(`/room/${roomData.room_code}`);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setIsJoining(false); }
  };

  const handleJoinPasswordSubmit = async () => {
    if (joinPassword !== pendingRoomData?.room_password) { toast({ title: "Incorrect", description: "Wrong password.", variant: "destructive" }); return; }
    addRecentRoom(pendingRoomData!.room_code);
    navigate(`/room/${pendingRoomData.room_code}?password=${encodeURIComponent(joinPassword)}`);
    setShowJoinPasswordDialog(false); setJoinPassword(""); setPendingRoomData(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 font-sans selection:bg-primary/30 relative overflow-x-hidden pb-20">
      
      {/* Soft Ambient Background Elements */}
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* GLASSY HEADER */}
      <header className="sticky top-0 z-40 w-full bg-white/60 dark:bg-zinc-950/60 backdrop-blur-2xl border-b border-white/10 shadow-sm supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => navigate("/")}>
            <div className="w-10 h-10 rounded-[1rem] bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/20 transition-transform duration-300 group-active:scale-95">
              <Zap className="h-5 w-5 text-white drop-shadow-md" />
            </div>
            <span className="font-extrabold text-xl tracking-tight text-foreground uppercase hidden sm:block">
              SHAREHUB4U
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={() => { try { setRecentRooms(loadRecentRooms()); } catch (e) {} setHistoryOpen(true); }} className="h-10 w-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all relative" title="Recent Rooms">
              <Clock className="h-5 w-5 text-muted-foreground hover:text-foreground" />
              {recentRooms.length > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-primary border-2 border-background rounded-full" />}
            </Button>

            <Button size="icon" variant="ghost" onClick={() => navigate('/contributors')} className="h-10 w-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all" title="Contributors">
              <Info className="h-5 w-5 text-muted-foreground hover:text-foreground" />
            </Button>

            <Button size="icon" variant="ghost" onClick={() => setSettingsOpen(true)} className="h-10 w-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all" title="Settings">
              <Settings className="h-5 w-5 text-muted-foreground hover:text-foreground" />
            </Button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="relative z-10 max-w-xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 flex flex-col items-center w-full">
        
        {/* Hero Title */}
        <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-[10px] sm:text-xs font-extrabold uppercase tracking-widest mb-4 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" /> Fast & Secure
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tighter text-foreground">Connect Instantly</h1>
        </div>

        {/* 1. JOIN & CREATE CARD (At the top) */}
        <div className="w-full animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150 mb-8 sm:mb-12">
          <Card className="w-full bg-white/60 dark:bg-zinc-900/60 backdrop-blur-3xl border border-white/20 dark:border-white/10 shadow-[0_20px_60px_rgb(0,0,0,0.06)] dark:shadow-[0_20px_60px_rgb(0,0,0,0.2)] overflow-hidden rounded-[2.5rem] p-2">
            <Tabs defaultValue="join" className="w-full">
              <TabsList className="grid w-full grid-cols-2 p-1.5 bg-black/5 dark:bg-white/5 backdrop-blur-md rounded-[2rem] h-14 sm:h-16 mb-2">
                <TabsTrigger value="join" className="rounded-[1.5rem] text-xs sm:text-sm font-extrabold uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-foreground text-muted-foreground h-full transition-all">Join Room</TabsTrigger>
                <TabsTrigger value="create" className="rounded-[1.5rem] text-xs sm:text-sm font-extrabold uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-foreground text-muted-foreground h-full transition-all">Create Room</TabsTrigger>
              </TabsList>
              
              {/* JOIN TAB */}
              <TabsContent value="join" className="p-4 sm:p-6 space-y-6 mt-0">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground ml-1">Room Code</Label>
                    <div className="relative flex items-center group">
                      <Hash className="absolute left-5 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input
                        ref={joinCodeInputRef}
                        placeholder="ENTER CODE"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && joinRoom()}
                        className="h-16 pl-14 bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 focus-visible:border-primary/40 focus-visible:ring-4 focus-visible:ring-primary/10 text-xl font-extrabold tracking-widest uppercase rounded-[1.5rem] shadow-inner placeholder:text-muted-foreground/30"
                      />
                    </div>
                  </div>
                  <Button onClick={joinRoom} disabled={isJoining} className="w-full h-16 rounded-[1.5rem] text-base font-extrabold shadow-lg hover:shadow-xl hover:shadow-primary/20 active:scale-95 transition-all">
                    {isJoining ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                      <>Join Workspace <ArrowRight className="h-5 w-5 ml-2" /></>
                    )}
                  </Button>
                </div>
              </TabsContent>

              {/* CREATE TAB */}
              <TabsContent value="create" className="p-4 sm:p-6 space-y-6 mt-0">
                <div className="space-y-2">
                  <Label className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground ml-1">Room Name (Optional)</Label>
                  <Input
                    placeholder="e.g. daily-standup"
                    value={customSlug}
                    onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    className="h-14 bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 focus-visible:border-primary/40 focus-visible:ring-4 focus-visible:ring-primary/10 font-mono text-base rounded-2xl shadow-inner placeholder:text-muted-foreground/40 px-5"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground ml-1">Privacy</Label>
                    <Select value={roomType} onValueChange={setRoomType}>
                      <SelectTrigger className="h-14 bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 focus:ring-4 focus:ring-primary/10 rounded-2xl text-sm font-bold shadow-inner px-5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-white/10 bg-background/95 backdrop-blur-xl">
                        <SelectItem value="public"><span className="flex items-center gap-2 font-bold"><Globe className="h-4 w-4 text-emerald-500"/> Public</span></SelectItem>
                        <SelectItem value="locked"><span className="flex items-center gap-2 font-bold"><Shield className="h-4 w-4 text-amber-500"/> Locked</span></SelectItem>
                        <SelectItem value="private_key"><span className="flex items-center gap-2 font-bold"><Key className="h-4 w-4 text-primary"/> Private</span></SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground ml-1">Lifespan</Label>
                    <Select value={roomTiming} onValueChange={setRoomTiming}>
                      <SelectTrigger className="h-14 bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 focus:ring-4 focus:ring-primary/10 rounded-2xl text-sm font-bold shadow-inner px-5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-white/10 bg-background/95 backdrop-blur-xl">
                        <SelectItem value="1h" className="font-bold">1 Hour</SelectItem>
                        <SelectItem value="24h" className="font-bold">24 Hours</SelectItem>
                        <SelectItem value="7d" className="font-bold">7 Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Conditional Inputs */}
                {roomType === "private_key" && (
                  <div className="space-y-2 pt-2 animate-in slide-in-from-top-2">
                    <Label className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground ml-1">Room Password</Label>
                    <Input type="password" value={roomPassword} onChange={(e) => setRoomPassword(e.target.value)} placeholder="Enter a secure password" className="h-14 bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 focus-visible:ring-4 focus-visible:ring-primary/10 rounded-2xl shadow-inner px-5 font-bold" />
                  </div>
                )}

                {roomType === "locked" && (
                  <div className="space-y-4 pt-2 animate-in slide-in-from-top-2 p-5 bg-amber-500/10 border border-amber-500/20 rounded-3xl">
                    <div className="text-xs text-amber-700 dark:text-amber-400 font-extrabold uppercase tracking-widest flex items-center gap-2"><Shield className="h-4 w-4" /> Temp Host Required</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input value={hostUsername} onChange={(e) => setHostUsername(e.target.value)} placeholder="Host Name" className="h-12 bg-white/60 dark:bg-black/40 border-transparent rounded-2xl font-bold shadow-inner px-4" />
                      <Input type="password" value={hostPasscode} onChange={(e) => setHostPasscode(e.target.value)} placeholder="Passcode" className="h-12 bg-white/60 dark:bg-black/40 border-transparent rounded-2xl font-bold shadow-inner px-4" />
                    </div>
                  </div>
                )}

                <Button onClick={createRoom} disabled={isCreating} className="w-full h-16 rounded-[1.5rem] text-base font-extrabold mt-4 shadow-lg hover:shadow-xl hover:shadow-primary/20 active:scale-95 transition-all">
                  {isCreating ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                    <>Create Workspace <Plus className="h-5 w-5 ml-2 stroke-[3px]" /></>
                  )}
                </Button>
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        {/* 2. NEARBY ROOMS (Below Join/Create) */}
        {nearbyRooms.length > 0 && (
          <div className="w-full animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-300">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="h-px w-12 sm:w-24 bg-gradient-to-r from-transparent to-border" />
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-muted/40 border border-white/10 backdrop-blur-md">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Nearby Rooms</h3>
              </div>
              <div className="h-px w-12 sm:w-24 bg-gradient-to-l from-transparent to-border" />
            </div>

            <Card className="p-2 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl border border-white/20 dark:border-white/10 rounded-[2rem] shadow-lg">
              <div className="flex flex-col gap-2">
                {nearbyRooms.map(r => (
                  <div key={r.room_code} className="group flex items-center justify-between p-4 rounded-[1.5rem] bg-white/50 dark:bg-black/20 border border-transparent hover:border-white/20 transition-all hover:shadow-md cursor-pointer active:scale-[0.98]" onClick={() => navigate(`/room/${r.room_code}`)}>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                        <Globe className="h-5 w-5 text-emerald-500" />
                      </div>
                      <div>
                        <div className="font-extrabold text-sm sm:text-base text-foreground tracking-tight">{r.display_name || r.room_code}</div>
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{r.room_code}</div>
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full bg-background shadow-sm group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </main>

      {/* RECENT ROOMS MODAL (Clock Icon) */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="w-[90vw] max-w-sm rounded-[2.5rem] border-white/20 bg-background/80 backdrop-blur-3xl shadow-2xl p-8">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-2xl font-extrabold tracking-tight">Recent Rooms</DialogTitle>
            <DialogDescription className="text-sm font-medium mt-1">Quickly rejoin your previous workspaces.</DialogDescription>
          </DialogHeader>
          
          <div className="py-6 space-y-3 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
            {recentRooms.length === 0 ? (
              <div className="text-center py-10">
                <Clock className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm font-bold text-muted-foreground">No recent history.</p>
              </div>
            ) : (
              recentRooms.map(code => (
                <div key={code} className="group flex items-center justify-between p-3 pl-5 bg-white/50 dark:bg-black/20 border border-white/10 rounded-[1.5rem] shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.98]" onClick={() => { navigate(`/room/${code}`); setHistoryOpen(false); }}>
                  <div className="font-mono font-extrabold text-sm uppercase tracking-widest">{code}</div>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); removeRecentRoom(code); }}>
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-2">
            {recentRooms.length > 0 && (
              <Button variant="outline" className="w-full h-14 rounded-full font-extrabold border-border/50 text-destructive hover:bg-destructive/10" onClick={clearAllRecentRooms}>
                Clear All
              </Button>
            )}
            <Button className="w-full h-14 rounded-full font-extrabold shadow-lg active:scale-95 transition-all" onClick={() => setHistoryOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Private Room Password Dialog */}
      <Dialog open={showJoinPasswordDialog} onOpenChange={setShowJoinPasswordDialog}>
        <DialogContent className="w-[90vw] max-w-sm rounded-[2.5rem] border-white/20 bg-background/80 backdrop-blur-3xl shadow-2xl p-8">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-2xl font-extrabold tracking-tight">Enter Password</DialogTitle>
            <DialogDescription className="text-sm font-medium mt-1">This room requires a password to enter.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input 
              type="password" 
              value={joinPassword} 
              onChange={(e) => setJoinPassword(e.target.value)} 
              placeholder="Room password" 
              className="h-14 bg-white/50 dark:bg-black/20 border border-white/20 rounded-2xl text-lg font-bold focus-visible:ring-4 focus-visible:ring-primary/10 px-5 shadow-inner"
              onKeyPress={(e) => e.key === "Enter" && handleJoinPasswordSubmit()} 
            />
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-3">
            <Button variant="outline" className="h-14 rounded-full border-border/50 bg-background/50 w-full sm:w-auto font-extrabold" onClick={() => setShowJoinPasswordDialog(false)}>Cancel</Button>
            <Button className="h-14 rounded-full w-full sm:w-auto font-extrabold shadow-lg active:scale-95 transition-all" onClick={handleJoinPasswordSubmit}>Join Room</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="w-[90vw] max-w-sm rounded-[2.5rem] border-white/20 bg-background/80 backdrop-blur-3xl shadow-2xl p-8">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-2xl font-extrabold tracking-tight">Settings</DialogTitle>
            <DialogDescription className="text-sm font-medium mt-1">Preferences are saved to this browser.</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            
            {/* Nearby Rooms Scan Button */}
            {!settings.hideNearbyRooms && (
              <div className="flex items-center justify-between p-4 rounded-3xl bg-white/50 dark:bg-black/20 border border-white/10 shadow-inner">
                <div className="pr-4">
                  <div className="font-bold text-sm">Nearby Devices</div>
                  <div className="text-[10px] font-medium text-muted-foreground mt-1 leading-relaxed">Scan your local network for active rooms.</div>
                </div>
                <Button 
                  onClick={handleRefreshNearby} 
                  disabled={isRefreshingNearby}
                  variant="outline" 
                  size="sm" 
                  className="rounded-full shadow-sm font-bold h-10 px-4 shrink-0"
                >
                  {isRefreshingNearby ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between p-4 rounded-3xl bg-white/50 dark:bg-black/20 border border-white/10 shadow-inner">
              <div className="pr-4">
                <div className="font-bold text-sm">Hide Nearby Rooms</div>
                <div className="text-[10px] font-medium text-muted-foreground mt-1 leading-relaxed">Prevent automatic detection of rooms on your local network.</div>
              </div>
              <Switch checked={settings.hideNearbyRooms} onCheckedChange={(v: boolean) => setSettings(prev => ({...prev, hideNearbyRooms: v}))} />
            </div>

            <div className="flex items-center justify-between p-4 rounded-3xl bg-white/50 dark:bg-black/20 border border-white/10 shadow-inner">
              <div className="pr-4">
                <div className="font-bold text-sm">Save Room History</div>
                <div className="text-[10px] font-medium text-muted-foreground mt-1 leading-relaxed">Keep a local log of rooms you've recently visited or created.</div>
              </div>
              <Switch checked={settings.saveRoomHistory} onCheckedChange={(v: boolean) => setSettings(prev => ({...prev, saveRoomHistory: v}))} />
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full h-14 rounded-full font-extrabold shadow-lg active:scale-95 transition-all" onClick={() => setSettingsOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default Index;