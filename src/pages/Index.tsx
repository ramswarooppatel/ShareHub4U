import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, Key, Globe, ArrowRight, Sparkles, Shield, Zap, Hash, Plus } from "lucide-react";
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

  const joinCodeInputRef = useRef<HTMLInputElement>(null);

  // --- LOGIC FUNCTIONS ---
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

      toast({ title: "Room created!", description: `Room code: ${roomCode}` });
      navigate(`/room/${roomCode}`);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Something went wrong.", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  // poll for nearby rooms (server-assisted) every 20s
  useEffect(() => {
    let mounted = true;
    let interval: any;
    const loadNearby = async () => {
      const { fetchNearbyRooms } = await import('@/lib/presence');
      const rooms = await fetchNearbyRooms();
      if (!mounted) return;
      setNearbyRooms(rooms || []);
    };
    loadNearby();
    interval = setInterval(loadNearby, 20_000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

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
        navigate(`/room/${roomData.room_code}`);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setIsJoining(false); }
  };

  const handleJoinPasswordSubmit = async () => {
    if (joinPassword !== pendingRoomData?.room_password) { toast({ title: "Incorrect", description: "Wrong password.", variant: "destructive" }); return; }
    navigate(`/room/${pendingRoomData.room_code}?password=${encodeURIComponent(joinPassword)}`);
    setShowJoinPasswordDialog(false); setJoinPassword(""); setPendingRoomData(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/30 selection:text-primary">
      {/* Header */}
      <header className="p-4 sm:p-6 flex items-center justify-center w-full max-w-5xl mx-auto border-b sm:border-none border-border">
        <div className="flex items-center gap-2 group cursor-pointer">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-md">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-extrabold text-2xl tracking-tight text-foreground uppercase">
            SHARE HUB 4 U
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12 w-full max-w-md mx-auto">
        {/* Nearby Rooms (server-assisted) */}
        {nearbyRooms.length > 0 && (
          <div className="w-full max-w-md mb-6">
            <Card className="p-4 bg-card rounded-xl border-border/40">
              <h4 className="text-sm font-bold mb-2">Nearby Rooms</h4>
              <div className="flex flex-col gap-2">
                {nearbyRooms.map(r => (
                  <div key={r.room_code} className="flex items-center justify-between px-3 py-2 rounded-lg bg-background/30">
                    <div>
                      <div className="font-semibold">{r.display_name || r.room_code}</div>
                      <div className="text-xs text-muted-foreground">{r.room_code}</div>
                    </div>
                    <div>
                      <Button onClick={() => navigate(`/room/${r.room_code}`)} size="sm">Join</Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        <div className="text-center mb-8 space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5" /> Fast & Secure
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">Connect Instantly</h1>
        </div>

        <Card className="w-full bg-card border-2 border-border/50 shadow-xl overflow-hidden rounded-3xl">
          <Tabs defaultValue="join" className="w-full">
            <TabsList className="grid w-full grid-cols-2 p-2 bg-muted h-16 rounded-t-3xl border-b-2 border-border/50">
              <TabsTrigger value="join" className="rounded-xl text-base font-bold data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-foreground text-muted-foreground h-full transition-all">Join Room</TabsTrigger>
              <TabsTrigger value="create" className="rounded-xl text-base font-bold data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-foreground text-muted-foreground h-full transition-all">Create Room</TabsTrigger>
            </TabsList>
            
            {/* JOIN TAB */}
            <TabsContent value="join" className="p-5 sm:p-6 space-y-6 mt-0">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-foreground ml-1">Room Code</Label>
                  <div className="relative flex items-center">
                    <Hash className="absolute left-4 h-5 w-5 text-muted-foreground" />
                    <Input
                      ref={joinCodeInputRef}
                      placeholder="ENTER CODE"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && joinRoom()}
                      className="h-14 pl-12 bg-background border-2 border-input focus-visible:border-primary focus-visible:ring-primary text-lg font-bold tracking-widest uppercase rounded-xl"
                    />
                  </div>
                </div>
                <Button onClick={joinRoom} disabled={isJoining} className="w-full h-14 rounded-xl text-lg font-bold shadow-md active:scale-[0.98] transition-transform">
                  {isJoining ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                    <>Join Space <ArrowRight className="h-5 w-5 ml-2" /></>
                  )}
                </Button>
              </div>
            </TabsContent>

            {/* CREATE TAB */}
            <TabsContent value="create" className="p-5 sm:p-6 space-y-5 mt-0">
              <div className="space-y-2">
                <Label className="text-sm font-bold text-foreground ml-1">Room Name (Optional)</Label>
                <Input
                  placeholder="e.g. daily-standup"
                  value={customSlug}
                  onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="h-14 bg-background border-2 border-input focus-visible:border-primary focus-visible:ring-primary font-mono text-base rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-foreground ml-1">Privacy</Label>
                  <Select value={roomType} onValueChange={setRoomType}>
                    <SelectTrigger className="h-14 bg-background border-2 border-input focus:border-primary focus:ring-primary rounded-xl text-base font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-2">
                      <SelectItem value="public"><span className="flex items-center gap-2 font-medium"><Globe className="h-4 w-4"/> Public</span></SelectItem>
                      <SelectItem value="locked"><span className="flex items-center gap-2 font-medium"><Lock className="h-4 w-4"/> Locked</span></SelectItem>
                      <SelectItem value="private_key"><span className="flex items-center gap-2 font-medium"><Key className="h-4 w-4"/> Private</span></SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-bold text-foreground ml-1">Lifespan</Label>
                  <Select value={roomTiming} onValueChange={setRoomTiming}>
                    <SelectTrigger className="h-14 bg-background border-2 border-input focus:border-primary focus:ring-primary rounded-xl text-base font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-2">
                      <SelectItem value="1h" className="font-medium">1 Hour</SelectItem>
                      <SelectItem value="24h" className="font-medium">24 Hours</SelectItem>
                      <SelectItem value="7d" className="font-medium">7 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Conditional Inputs */}
              {roomType === "private_key" && (
                <div className="space-y-2 pt-2 animate-in slide-in-from-top-2">
                  <Label className="text-sm font-bold text-foreground ml-1">Room Password</Label>
                  <Input type="password" value={roomPassword} onChange={(e) => setRoomPassword(e.target.value)} placeholder="Enter a secure password" className="h-14 bg-background border-2 border-input focus-visible:border-primary focus-visible:ring-primary rounded-xl" />
                </div>
              )}

              {roomType === "locked" && (
                <div className="space-y-3 pt-2 animate-in slide-in-from-top-2 p-4 bg-muted/50 rounded-2xl border-2 border-border">
                  <div className="text-sm text-foreground font-bold flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Temp Host Required</div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input value={hostUsername} onChange={(e) => setHostUsername(e.target.value)} placeholder="Host Name" className="h-12 bg-background border-2 border-input rounded-xl" />
                    <Input type="password" value={hostPasscode} onChange={(e) => setHostPasscode(e.target.value)} placeholder="Passcode" className="h-12 bg-background border-2 border-input rounded-xl" />
                  </div>
                </div>
              )}

              <Button onClick={createRoom} disabled={isCreating} className="w-full h-14 rounded-xl text-lg font-bold mt-4 shadow-md active:scale-[0.98] transition-transform">
                {isCreating ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                  <>Create Space <Plus className="h-5 w-5 ml-2" /></>
                )}
              </Button>
            </TabsContent>
          </Tabs>
        </Card>
      </main>

      {/* Password Dialog */}
      <Dialog open={showJoinPasswordDialog} onOpenChange={setShowJoinPasswordDialog}>
        <DialogContent className="w-[90vw] max-w-sm rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Enter Password</DialogTitle>
            <DialogDescription>This room requires a password to enter.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input 
              type="password" 
              value={joinPassword} 
              onChange={(e) => setJoinPassword(e.target.value)} 
              placeholder="Room password" 
              className="h-14 bg-background border-2 border-input rounded-xl text-lg focus-visible:border-primary focus-visible:ring-primary"
              onKeyPress={(e) => e.key === "Enter" && handleJoinPasswordSubmit()} 
            />
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-3">
            <Button variant="outline" className="h-12 rounded-xl border-2 w-full sm:w-auto font-bold" onClick={() => setShowJoinPasswordDialog(false)}>Cancel</Button>
            <Button className="h-12 rounded-xl w-full sm:w-auto font-bold" onClick={handleJoinPasswordSubmit}>Join Room</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;