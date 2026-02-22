import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, DoorOpen, Plus, Lock, Key, Globe, Infinity as InfinityIcon, Ticket, Clock, User, LogIn, UserPlus, Eye, EyeOff, ArrowRight, Sparkles, Shield, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [customSlug, setCustomSlug] = useState("");
  const [roomType, setRoomType] = useState("public");
  const [roomTiming, setRoomTiming] = useState("24h");
  const [roomPassword, setRoomPassword] = useState("");
  const [hostUsername, setHostUsername] = useState("");
  const [hostPasscode, setHostPasscode] = useState("");
  const [proCode, setProCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [showJoinPasswordDialog, setShowJoinPasswordDialog] = useState(false);
  const [pendingRoomData, setPendingRoomData] = useState<{
    room_code: string;
    room_type: string;
    room_password?: string;
    auto_accept_requests?: boolean;
  } | null>(null);
  const [isPermanent, setIsPermanent] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  // User authentication state
  const [currentUser, setCurrentUser] = useState<{id: string, username: string | null} | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState("login");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showHostPasscode, setShowHostPasscode] = useState(false);
  const [showRoomPassword, setShowRoomPassword] = useState(false);
  const [showJoinPassword, setShowJoinPassword] = useState(false);

  useEffect(() => {
    initializeUser();
  }, []);

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toLowerCase();
  };

  const createRoom = async () => {
    if (roomType === "private_key" && !roomPassword.trim()) {
      toast({ title: "Password required", description: "Please enter a password for the private key room.", variant: "destructive" });
      return;
    }
    if (roomType === "locked" && !currentUser && (!hostUsername.trim() || !hostPasscode.trim())) {
      toast({ title: "Credentials required", description: "Please enter username and passphrase for locked room.", variant: "destructive" });
      return;
    }

    setIsCreating(true);
    try {
      const roomCode = customSlug.trim() || generateRoomCode();
      const { data: existing } = await supabase.from("rooms").select("id").eq("room_code", roomCode).maybeSingle();
      if (existing) {
        toast({ title: "Room code already exists", description: "Please choose a different room code or leave it blank for auto-generation.", variant: "destructive" });
        return;
      }

      let hostId = null;
      if (currentUser?.id) {
        const { data: userExists } = await supabase.from("users").select("id").eq("id", currentUser.id).maybeSingle();
        if (userExists) {
          hostId = currentUser.id;
        } else {
          localStorage.removeItem("user_id");
          localStorage.removeItem("username");
          setCurrentUser(null);
          toast({ title: "Account not found", description: "Your account was removed. Creating room as anonymous.", variant: "destructive" });
        }
      }

      let validatedProCode = null;
      let roomIsPermanent = false;

      if (proCode.trim()) {
        const { data: proCodeData, error: proCodeError } = await supabase
          .from("pro_codes").select("*").eq("code", proCode.trim()).eq("is_active", true).gt("expires_at", new Date().toISOString()).single();
        if (proCodeError || !proCodeData) {
          toast({ title: "Invalid pro code", description: "The pro code is invalid, expired, or inactive.", variant: "destructive" });
          return;
        }
        if (hostId && proCodeData.max_rooms > 0) {
          const { count: userRoomsCount } = await supabase.from("rooms").select("*", { count: "exact", head: true }).eq("host_id", hostId).eq("pro_code_used", true);
          if (userRoomsCount && userRoomsCount >= proCodeData.max_rooms) {
            toast({ title: "Pro code limit reached", description: `You have reached the maximum number of rooms (${proCodeData.max_rooms}) for this pro code.`, variant: "destructive" });
            return;
          }
        }
        validatedProCode = proCodeData;
        roomIsPermanent = true;
      }

      let expiresAt = null;
      if (!roomIsPermanent) {
        const now = new Date();
        switch (roomTiming) {
          case "1h": expiresAt = new Date(now.getTime() + 1 * 60 * 60 * 1000); break;
          case "12h": expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000); break;
          case "24h": expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); break;
          case "7d": expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); break;
          case "15d": expiresAt = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); break;
          case "30d": expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); break;
        }
      }

      const { data: room, error } = await supabase.from("rooms").insert({
        room_code: roomCode, room_type: roomType, host_id: hostId,
        room_password: roomType === "private_key" ? roomPassword : null,
        is_permanent: roomIsPermanent, expires_at: expiresAt, file_sharing_enabled: true,
        only_host_can_upload: false, auto_accept_requests: roomType === "locked" ? false : true,
        pro_code_used: !!validatedProCode,
      }).select().single();

      if (error) throw error;

      if (validatedProCode) {
        await supabase.from("pro_codes").update({ rooms_created: validatedProCode.rooms_created + 1 }).eq("id", validatedProCode.id);
      }

      if (hostId) {
        await supabase.from("room_participants").insert({ room_id: room.id, user_id: hostId, role: "host" });
      }

      toast({ title: "Room created!", description: roomIsPermanent ? "Permanent room created." : `Room code: ${roomCode}` });
      navigate(`/room/${roomCode}`);
    } catch (error: any) {
      console.error("Error creating room:", error);
      toast({ title: "Error creating room", description: error.message || "Something went wrong.", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const initializeUser = () => {
    const savedUser = localStorage.getItem("current_user");
    if (savedUser) {
      try { setCurrentUser(JSON.parse(savedUser)); } catch { localStorage.removeItem("current_user"); }
    }
  };

  const loginUser = async () => {
    if (!loginUsername.trim() || !loginPassword.trim()) { toast({ title: "Missing credentials", description: "Please enter both username and password.", variant: "destructive" }); return; }
    setIsAuthenticating(true);
    try {
      const { data, error } = await supabase.from("users").select("*").eq("username", loginUsername.trim()).eq("passcode", loginPassword).single();
      if (error || !data) throw new Error("Invalid username or password");
      const user = { id: data.id, username: data.username };
      setCurrentUser(user);
      localStorage.setItem("current_user", JSON.stringify(user));
      localStorage.setItem("user_id", data.id);
      toast({ title: "Login successful!", description: `Welcome back, ${data.username || 'User'}!` });
      setShowAuthModal(false); setLoginUsername(""); setLoginPassword("");
    } catch (error: any) { toast({ title: "Login failed", description: error.message, variant: "destructive" }); }
    finally { setIsAuthenticating(false); }
  };

  const registerUser = async () => {
    if (!registerUsername.trim() || !registerPassword.trim()) { toast({ title: "Missing information", description: "Please enter both username and password.", variant: "destructive" }); return; }
    if (registerPassword.length < 6) { toast({ title: "Password too short", description: "Password must be at least 6 characters long.", variant: "destructive" }); return; }
    setIsAuthenticating(true);
    try {
      const { data: existingUser } = await supabase.from("users").select("id").eq("username", registerUsername.trim()).maybeSingle();
      if (existingUser) throw new Error("Username already taken");
      const { data, error } = await supabase.from("users").insert({ username: registerUsername.trim(), passcode: registerPassword }).select().single();
      if (error) throw error;
      const user = { id: data.id, username: data.username };
      setCurrentUser(user);
      localStorage.setItem("current_user", JSON.stringify(user));
      localStorage.setItem("user_id", data.id);
      toast({ title: "Registration successful!", description: `Welcome, ${data.username}!` });
      setShowAuthModal(false); setRegisterUsername(""); setRegisterPassword("");
    } catch (error: any) { toast({ title: "Registration failed", description: error.message, variant: "destructive" }); }
    finally { setIsAuthenticating(false); }
  };

  const logoutUser = () => {
    setCurrentUser(null);
    localStorage.removeItem("current_user");
    localStorage.removeItem("user_id");
    toast({ title: "Logged out", description: "You have been logged out successfully." });
  };

  const joinRoom = async () => {
    if (!joinCode.trim()) { toast({ title: "Enter a room code", description: "Please enter a room code to join.", variant: "destructive" }); return; }
    setIsJoining(true);
    try {
      const { data: roomData, error: roomError } = await supabase.from("rooms").select("id, room_code, room_type, room_password, auto_accept_requests, host_id, expires_at").eq("room_code", joinCode.trim().toLowerCase()).maybeSingle();
      if (roomError) throw roomError;
      if (!roomData) { toast({ title: "Room not found", description: "No room exists with this code.", variant: "destructive" }); setIsJoining(false); return; }
      if (roomData.expires_at && new Date(roomData.expires_at) < new Date()) { toast({ title: "Room expired", description: "This room has expired.", variant: "destructive" }); setIsJoining(false); return; }
      if (roomData.room_type === "public") { navigate(`/room/${roomData.room_code}`); }
      else if (roomData.room_type === "private_key") {
        setPendingRoomData({ room_code: roomData.room_code, room_type: roomData.room_type, room_password: roomData.room_password || undefined });
        setShowJoinPasswordDialog(true);
      } else if (roomData.room_type === "locked") { navigate(`/room/${roomData.room_code}`); }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      toast({ title: "Error joining room", description: errorMessage, variant: "destructive" });
    } finally { setIsJoining(false); }
  };

  const handleJoinPasswordSubmit = async () => {
    if (!pendingRoomData || !joinPassword.trim()) { toast({ title: "Password required", description: "Please enter the room password.", variant: "destructive" }); return; }
    if (joinPassword !== pendingRoomData.room_password) { toast({ title: "Incorrect password", description: "The password you entered is incorrect.", variant: "destructive" }); return; }
    navigate(`/room/${pendingRoomData.room_code}?password=${encodeURIComponent(joinPassword)}`);
    setShowJoinPasswordDialog(false); setJoinPassword(""); setPendingRoomData(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="border-b border-border/30 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg text-foreground">ShareHub4U</span>
          </div>
          
          {currentUser ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="h-3 w-3 text-primary" />
                </div>
                <span className="text-sm font-medium text-primary">{currentUser.username}</span>
              </div>
              <Button onClick={logoutUser} variant="ghost" size="sm" className="text-muted-foreground h-8">
                Logout
              </Button>
            </div>
          ) : (
            <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5">
                  <LogIn className="h-3.5 w-3.5" />
                  Sign in
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                  <DialogTitle>Welcome back</DialogTitle>
                  <DialogDescription>Sign in to manage rooms and access features.</DialogDescription>
                </DialogHeader>
                <Tabs value={authTab} onValueChange={setAuthTab}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="login">Sign in</TabsTrigger>
                    <TabsTrigger value="register">Register</TabsTrigger>
                  </TabsList>
                  <TabsContent value="login" className="space-y-3 pt-2">
                    <div>
                      <Label htmlFor="loginUsername" className="text-xs">Username</Label>
                      <Input id="loginUsername" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} placeholder="Enter username" className="mt-1 h-9" />
                    </div>
                    <div>
                      <Label htmlFor="loginPassword" className="text-xs">Password</Label>
                      <div className="relative mt-1">
                        <Input id="loginPassword" type={showLoginPassword ? "text" : "password"} value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Enter password" className="pr-10 h-9" />
                        <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowLoginPassword(!showLoginPassword)}>
                          {showLoginPassword ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
                        </Button>
                      </div>
                    </div>
                    <Button onClick={loginUser} disabled={isAuthenticating} className="w-full h-9">
                      {isAuthenticating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
                    </Button>
                  </TabsContent>
                  <TabsContent value="register" className="space-y-3 pt-2">
                    <div>
                      <Label htmlFor="registerUsername" className="text-xs">Username</Label>
                      <Input id="registerUsername" value={registerUsername} onChange={(e) => setRegisterUsername(e.target.value)} placeholder="Choose a username" className="mt-1 h-9" />
                    </div>
                    <div>
                      <Label htmlFor="registerPassword" className="text-xs">Password</Label>
                      <div className="relative mt-1">
                        <Input id="registerPassword" type={showRegisterPassword ? "text" : "password"} value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} placeholder="Min 6 characters" className="pr-10 h-9" />
                        <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowRegisterPassword(!showRegisterPassword)}>
                          {showRegisterPassword ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
                        </Button>
                      </div>
                    </div>
                    <Button onClick={registerUser} disabled={isAuthenticating} className="w-full h-9">
                      {isAuthenticating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
                    </Button>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 md:py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6">
            <Sparkles className="h-3 w-3" />
            Fast, secure, temporary rooms
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-foreground tracking-tight leading-[1.1] mb-4">
            Share files and notes
            <br />
            <span className="text-primary">instantly</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10">
            Create a room, share the code, collaborate. No signup required. Rooms auto-expire for privacy.
          </p>

          {/* Quick Join */}
          <div className="max-w-md mx-auto">
            <div className="flex gap-2">
              <Input
                placeholder="Enter room code..."
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && joinRoom()}
                className="h-12 text-base bg-card border-border/50"
              />
              <Button onClick={joinRoom} disabled={isJoining} size="lg" className="h-12 px-6 gap-2">
                {isJoining ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <>
                    Join
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Strip */}
      <section className="border-y border-border/30 bg-muted/20 py-8">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div className="flex flex-col items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              <span className="text-xs md:text-sm font-medium text-foreground">Public Rooms</span>
              <span className="text-xs text-muted-foreground hidden md:block">Anyone can join instantly</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <span className="text-xs md:text-sm font-medium text-foreground">Locked Rooms</span>
              <span className="text-xs text-muted-foreground hidden md:block">Host approval required</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              <span className="text-xs md:text-sm font-medium text-foreground">Private Rooms</span>
              <span className="text-xs text-muted-foreground hidden md:block">Password protected access</span>
            </div>
          </div>
        </div>
      </section>

      {/* Create Room Section */}
      <section className="py-12 md:py-16 px-4">
        <div className="max-w-xl mx-auto">
          <Card className="p-6 md:p-8 border-border/50 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Plus className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Create a Room</h2>
                <p className="text-sm text-muted-foreground">Set up a new collaboration space</p>
              </div>
            </div>
            
            <div className="space-y-4">
              {/* Room Type Selection */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "public", icon: Globe, label: "Public" },
                  { value: "locked", icon: Lock, label: "Locked" },
                  { value: "private_key", icon: Key, label: "Private" },
                ].map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    onClick={() => setRoomType(value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200 ${
                      roomType === value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border/50 hover:border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                ))}
              </div>

              {/* Custom Slug */}
              <div>
                <Label htmlFor="customSlug" className="text-xs text-muted-foreground">Custom slug (optional)</Label>
                <Input
                  id="customSlug"
                  placeholder="my-room"
                  value={customSlug}
                  onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="mt-1 h-9"
                />
              </div>

              {/* Duration */}
              <div>
                <Label htmlFor="roomTiming" className="text-xs text-muted-foreground">Duration</Label>
                <Select value={roomTiming} onValueChange={setRoomTiming}>
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1h">1 Hour</SelectItem>
                    <SelectItem value="12h">12 Hours</SelectItem>
                    <SelectItem value="24h">1 Day</SelectItem>
                    <SelectItem value="7d">7 Days</SelectItem>
                    <SelectItem value="15d">15 Days</SelectItem>
                    <SelectItem value="30d">30 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Locked Room Credentials */}
              {roomType === "locked" && !currentUser && (
                <div className="space-y-3 p-3 rounded-xl bg-muted/30 border border-border/30">
                  <p className="text-xs text-muted-foreground">Host credentials for approvals</p>
                  <div>
                    <Label htmlFor="hostUsername" className="text-xs">Username</Label>
                    <Input id="hostUsername" value={hostUsername} onChange={(e) => setHostUsername(e.target.value)} placeholder="Username" className="mt-1 h-9" />
                  </div>
                  <div>
                    <Label htmlFor="hostPasscode" className="text-xs">Passphrase</Label>
                    <div className="relative mt-1">
                      <Input id="hostPasscode" type={showHostPasscode ? "text" : "password"} value={hostPasscode} onChange={(e) => setHostPasscode(e.target.value)} placeholder="Passphrase" className="pr-10 h-9" />
                      <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowHostPasscode(!showHostPasscode)}>
                        {showHostPasscode ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Private Key Password */}
              {roomType === "private_key" && (
                <div>
                  <Label htmlFor="roomPassword" className="text-xs text-muted-foreground">Room password</Label>
                  <div className="relative mt-1">
                    <Input id="roomPassword" type={showRoomPassword ? "text" : "password"} value={roomPassword} onChange={(e) => setRoomPassword(e.target.value)} placeholder="Set a password" className="pr-10 h-9" />
                    <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowRoomPassword(!showRoomPassword)}>
                      {showRoomPassword ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>
              )}

              {/* Pro Code */}
              <div className="pt-2 border-t border-border/30">
                <div className="flex items-center gap-1.5 mb-1">
                  <Ticket className="h-3 w-3 text-primary" />
                  <Label htmlFor="proCode" className="text-xs text-muted-foreground">Pro code (optional)</Label>
                </div>
                <Input id="proCode" value={proCode} onChange={(e) => setProCode(e.target.value)} placeholder="Enter for permanent room" className="h-9" />
              </div>

              <Button onClick={createRoom} disabled={isCreating} className="w-full h-11 gap-2 font-medium" size="lg">
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <>
                    Create Room
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 py-6 text-center">
        <p className="text-xs text-muted-foreground">ShareHub4U — Instant, secure file & note sharing</p>
      </footer>

      {/* Join Password Dialog */}
      <Dialog open={showJoinPasswordDialog} onOpenChange={setShowJoinPasswordDialog}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Enter Password</DialogTitle>
            <DialogDescription>This room is password protected.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Input
                type={showJoinPassword ? "text" : "password"}
                value={joinPassword}
                onChange={(e) => setJoinPassword(e.target.value)}
                placeholder="Room password"
                className="pr-10 h-9"
                onKeyPress={(e) => e.key === "Enter" && handleJoinPasswordSubmit()}
              />
              <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowJoinPassword(!showJoinPassword)}>
                {showJoinPassword ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
              </Button>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => { setShowJoinPasswordDialog(false); setJoinPassword(""); setPendingRoomData(null); }}>Cancel</Button>
              <Button size="sm" onClick={handleJoinPasswordSubmit}>Join</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
