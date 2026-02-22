import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useKeyboardShortcuts, KeyboardShortcut } from "@/hooks/use-keyboard-shortcuts";
import { KeyboardShortcutsModal } from "@/components/ui/keyboard-shortcuts-modal";
import { Loader2, Plus, Lock, Key, Globe, Ticket, User, LogIn, Eye, EyeOff, ArrowRight, Sparkles, Shield, Zap, Hash } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  const [proCode, setProCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [showJoinPasswordDialog, setShowJoinPasswordDialog] = useState(false);
  const [pendingRoomData, setPendingRoomData] = useState<{ room_code: string; room_type: string; room_password?: string; auto_accept_requests?: boolean; } | null>(null);
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

  // Keyboard shortcuts
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const joinCodeInputRef = useRef<HTMLInputElement>(null);
  const customSlugInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    initializeUser();
  }, []);

  // Define keyboard shortcuts
  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'j',
      alt: true,
      description: 'Focus join room input',
      action: () => joinCodeInputRef.current?.focus(),
      context: 'Navigation'
    },
    {
      key: 'k',
      alt: true,
      description: 'Focus room name input',
      action: () => customSlugInputRef.current?.focus(),
      context: 'Navigation'
    },
    {
      key: '1',
      alt: true,
      description: 'Select Public room',
      action: () => {
        const publicBtn = document.querySelector('[data-room-type="public"]');
        if (publicBtn) publicBtn.click();
      },
      context: 'Room Settings'
    },
    {
      key: '2',
      alt: true,
      description: 'Select Locked room',
      action: () => {
        const lockedBtn = document.querySelector('[data-room-type="locked"]');
        if (lockedBtn) lockedBtn.click();
      },
      context: 'Room Settings'
    },
    {
      key: '3',
      alt: true,
      description: 'Select Private room',
      action: () => {
        const privateBtn = document.querySelector('[data-room-type="private_key"]');
        if (privateBtn) privateBtn.click();
      },
      context: 'Room Settings'
    },
    {
      key: 't',
      alt: true,
      description: 'Focus room timing',
      action: () => {
        const timingSelect = document.querySelector('[data-shortcut="room-timing"]');
        if (timingSelect) timingSelect.click();
      },
      context: 'Room Settings'
    },
    {
      key: 'n',
      alt: true,
      description: 'Create new room',
      action: () => document.querySelector('[data-shortcut="create-room"]')?.click(),
      context: 'Rooms'
    },
    {
      key: 'a',
      alt: true,
      description: 'Sign in / Sign out',
      action: () => {
        if (currentUser) {
          logoutUser();
        } else {
          document.querySelector('[data-shortcut="auth"]')?.click();
        }
      },
      context: 'Account'
    },
    {
      key: '?',
      description: 'Show keyboard shortcuts',
      action: () => setShowShortcutsModal(true),
      context: 'Help'
    }
  ];

  useKeyboardShortcuts(shortcuts);

  // --- LOGIC FUNCTIONS ---
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
    <div className="min-h-screen relative overflow-hidden selection:bg-primary/30 selection:text-primary">
      {/* Modern Ambient Background */}
      <div className="fixed inset-0 -z-10 bg-background pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] opacity-50 mix-blend-screen animate-pulse duration-10000" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[150px] opacity-50 mix-blend-screen" />
      </div>

      {/* Floating Glass Top Bar */}
      <header className="sticky top-4 z-50 mx-4 md:mx-auto max-w-5xl rounded-2xl border border-white/10 dark:border-white/5 hover:border-white/20 bg-background/50 backdrop-blur-xl backdrop-saturate-150 shadow-lg shadow-black/5 transition-all duration-300">
        <div className="px-4 md:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer active:scale-95 transition-transform duration-200">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-inner group-hover:shadow-primary/30 transition-all duration-300">
              <Zap className="h-4 w-4 text-white drop-shadow-md group-hover:scale-110 transition-transform duration-300" />
            </div>
            <span className="font-extrabold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70 group-hover:from-primary group-hover:to-blue-500 transition-all duration-300">
              ShareHub
            </span>
          </div>
          
          {currentUser ? (
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-primary/5 border border-primary/10 rounded-full shadow-sm">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="h-3 w-3 text-primary" />
                </div>
                <span className="text-sm font-medium text-primary">{currentUser.username}</span>
              </div>
              <Button onClick={logoutUser} variant="ghost" size="sm" className="hover:bg-destructive/10 hover:text-destructive active:scale-95 transition-all duration-200 rounded-full px-4">
                Logout
              </Button>
            </div>
          ) : (
            <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
              <DialogTrigger asChild>
                <Button data-shortcut="auth" className="rounded-full shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background" size="sm">
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign In
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[400px] rounded-[2rem] border-white/10 bg-background/80 backdrop-blur-2xl shadow-2xl p-6">
                <DialogHeader className="mb-4">
                  <DialogTitle className="text-2xl font-bold tracking-tight">Welcome back</DialogTitle>
                  <DialogDescription>Sign in to manage rooms and access features.</DialogDescription>
                </DialogHeader>
                <Tabs value={authTab} onValueChange={setAuthTab}>
                  <TabsList className="grid w-full grid-cols-2 h-12 rounded-xl bg-muted/50 border border-white/5 p-1 mb-4">
                    <TabsTrigger value="login" className="rounded-lg font-medium data-[state=active]:shadow-sm transition-all duration-300">Sign in</TabsTrigger>
                    <TabsTrigger value="register" className="rounded-lg font-medium data-[state=active]:shadow-sm transition-all duration-300">Register</TabsTrigger>
                  </TabsList>
                  <TabsContent value="login" className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="loginUsername" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Username</Label>
                      <Input id="loginUsername" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} placeholder="Enter username" className="h-11 rounded-xl bg-background/50 border-white/10 hover:border-white/20 focus-visible:bg-background focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 transition-all duration-200" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="loginPassword" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Password</Label>
                      <div className="relative group">
                        <Input id="loginPassword" type={showLoginPassword ? "text" : "password"} value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Enter password" className="pr-10 h-11 rounded-xl bg-background/50 border-white/10 hover:border-white/20 focus-visible:bg-background focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 transition-all duration-200" />
                        <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent rounded-r-xl active:scale-95 transition-transform" onClick={() => setShowLoginPassword(!showLoginPassword)}>
                          {showLoginPassword ? <EyeOff className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" /> : <Eye className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />}
                        </Button>
                      </div>
                    </div>
                    <Button onClick={loginUser} disabled={isAuthenticating} className="w-full h-12 rounded-xl text-base font-semibold shadow-md hover:shadow-lg active:scale-95 transition-all duration-200 mt-2">
                      {isAuthenticating ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sign in"}
                    </Button>
                  </TabsContent>
                  <TabsContent value="register" className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="registerUsername" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Username</Label>
                      <Input id="registerUsername" value={registerUsername} onChange={(e) => setRegisterUsername(e.target.value)} placeholder="Choose a username" className="h-11 rounded-xl bg-background/50 border-white/10 hover:border-white/20 focus-visible:bg-background focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 transition-all duration-200" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="registerPassword" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Password</Label>
                      <div className="relative group">
                        <Input id="registerPassword" type={showRegisterPassword ? "text" : "password"} value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} placeholder="Min 6 characters" className="pr-10 h-11 rounded-xl bg-background/50 border-white/10 hover:border-white/20 focus-visible:bg-background focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 transition-all duration-200" />
                        <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent rounded-r-xl active:scale-95 transition-transform" onClick={() => setShowRegisterPassword(!showRegisterPassword)}>
                          {showRegisterPassword ? <EyeOff className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" /> : <Eye className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />}
                        </Button>
                      </div>
                    </div>
                    <Button onClick={registerUser} disabled={isAuthenticating} className="w-full h-12 rounded-xl text-base font-semibold shadow-md hover:shadow-lg active:scale-95 transition-all duration-200 mt-2">
                      {isAuthenticating ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create account"}
                    </Button>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-16 pb-24 space-y-24">
        
        {/* Hero Section */}
        <section className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-semibold uppercase tracking-wider backdrop-blur-md shadow-sm hover:shadow-md hover:bg-primary/10 transition-all duration-300 cursor-default">
            <Sparkles className="h-3.5 w-3.5 animate-pulse" />
            Instant • Secure • Ephemeral
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold text-foreground tracking-tighter leading-[1.05]">
            Share at the <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-blue-500 to-purple-600 drop-shadow-sm">
              speed of thought.
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto font-light leading-relaxed">
            Create a frictionless room, drop your files or notes, and collaborate instantly. No signup required. Rooms auto-vanish to protect your privacy.
          </p>

          {/* MASSIVE Quick Join Floating Pill */}
          <div className="max-w-2xl mx-auto relative group mt-12">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary via-blue-500 to-purple-600 rounded-full blur-md opacity-30 group-hover:opacity-60 transition duration-700"></div>
            <div className="relative flex gap-3 p-2.5 bg-background/80 backdrop-blur-2xl rounded-full border border-white/20 shadow-2xl focus-within:ring-4 focus-within:ring-primary/30 transition-all duration-300">
              <div className="flex-1 relative flex items-center">
                <Hash className="absolute left-6 h-7 w-7 text-muted-foreground/50" />
                <Input
                  ref={joinCodeInputRef}
                  placeholder="ENTER ROOM CODE"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && joinRoom()}
                  className="h-16 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 pl-16 pr-6 text-2xl font-black tracking-widest w-full placeholder:text-muted-foreground/40 placeholder:font-bold placeholder:tracking-wider uppercase shadow-none"
                />
              </div>
              <Button onClick={joinRoom} disabled={isJoining} className="h-16 px-10 rounded-full shadow-lg hover:shadow-primary/50 hover:shadow-xl active:scale-[0.98] transition-all duration-300 shrink-0 text-lg font-bold group/btn">
                {isJoining ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                  <>
                    Join Room <ArrowRight className="h-6 w-6 ml-3 group-hover/btn:translate-x-2 transition-transform" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </section>

        {/* Feature Pills */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-150">
          {[
            { icon: Globe, title: "Public", desc: "Open to anyone instantly", color: "text-blue-500", bg: "bg-blue-500/10", border: "group-hover:border-blue-500/30" },
            { icon: Shield, title: "Locked", desc: "Host approval required", color: "text-amber-500", bg: "bg-amber-500/10", border: "group-hover:border-amber-500/30" },
            { icon: Key, title: "Private", desc: "Password protected access", color: "text-emerald-500", bg: "bg-emerald-500/10", border: "group-hover:border-emerald-500/30" }
          ].map((feat, i) => (
            <div key={i} className={`group flex flex-col items-center text-center p-6 rounded-3xl bg-background/30 border border-white/5 backdrop-blur-md hover:bg-background/50 hover:-translate-y-1 hover:shadow-xl ${feat.border} transition-all duration-300 cursor-default`}>
              <div className={`w-14 h-14 rounded-2xl ${feat.bg} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300 shadow-inner`}>
                <feat.icon className={`h-7 w-7 ${feat.color}`} />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1.5">{feat.title}</h3>
              <p className="text-sm font-medium text-muted-foreground">{feat.desc}</p>
            </div>
          ))}
        </section>

        {/* Glass Create Room Card */}
        <section className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
          <div className="relative group/card">
            {/* Soft glow behind the card */}
            <div className="absolute -inset-1 bg-gradient-to-b from-primary/20 to-transparent rounded-[2.5rem] blur-xl opacity-50 group-hover/card:opacity-75 transition-opacity duration-700"></div>
            
            <Card className="relative p-6 md:p-10 rounded-[2rem] border-white/10 hover:border-white/20 bg-background/50 backdrop-blur-2xl backdrop-saturate-150 shadow-2xl overflow-hidden transition-all duration-500">
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl group-hover/card:bg-primary/30 transition-colors duration-700"></div>

              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10 shadow-inner group-hover/card:shadow-primary/20 transition-all duration-500">
                    <Plus className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">Launch Space</h2>
                    <p className="text-sm text-muted-foreground font-medium mt-1">Configure your new environment</p>
                  </div>
                </div>
                
                <div className="space-y-8">
                  
                  {/* MASSIVE Highlighted Custom Slug Input */}
                  <div className="space-y-3 pb-8 border-b border-border/30">
                    <Label htmlFor="customSlug" className="text-sm font-bold text-foreground uppercase tracking-widest flex items-center gap-2 ml-1">
                      <Sparkles className="h-4 w-4 text-primary" /> Name Your Space (Optional)
                    </Label>
                    <div className="relative group/slug">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/40 to-blue-500/40 rounded-2xl blur opacity-0 group-focus-within/slug:opacity-100 transition duration-500"></div>
                      <div className="relative flex items-center bg-background/80 backdrop-blur-xl border-2 border-border/50 hover:border-primary/50 focus-within:border-primary rounded-2xl transition-all duration-300 overflow-hidden shadow-inner">
                        <div className="px-4 md:px-6 py-5 bg-muted/50 border-r border-border/50 text-muted-foreground font-mono text-sm md:text-lg font-semibold flex items-center justify-center">
                          s4u/
                        </div>
                        <Input
                          ref={customSlugInputRef}
                          id="customSlug"
                          placeholder="my-epic-room"
                          value={customSlug}
                          onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                          className="h-16 md:h-20 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-4 md:px-6 text-2xl md:text-3xl font-black tracking-wider w-full placeholder:text-muted-foreground/30 font-mono shadow-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Settings Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Privacy Level */}
                    <div className="space-y-3">
                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Privacy Level</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { value: "public", icon: Globe, label: "Public" },
                          { value: "locked", icon: Lock, label: "Locked" },
                          { value: "private_key", icon: Key, label: "Private" },
                        ].map(({ value, icon: Icon, label }) => (
                          <button
                            key={value}
                            data-room-type={value}
                            onClick={() => setRoomType(value)}
                            className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all duration-300 active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none ${
                              roomType === value
                                ? "border-primary bg-primary/10 text-primary shadow-md shadow-primary/20 ring-1 ring-primary"
                                : "border-border/50 bg-background/30 hover:bg-background/60 hover:border-border text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <Icon className={`h-5 w-5 ${roomType === value ? "scale-110" : ""} transition-transform duration-300`} />
                            <span className="text-xs font-bold tracking-wide">{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Duration */}
                    <div className="space-y-3">
                      <Label htmlFor="roomTiming" className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Lifespan</Label>
                      <Select value={roomTiming} onValueChange={setRoomTiming}>
                        <SelectTrigger data-shortcut="room-timing" className="h-[76px] rounded-2xl bg-background/50 border-white/10 hover:border-white/20 focus-visible:bg-background focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 transition-all duration-200 text-lg font-semibold px-6">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-white/10 bg-background/90 backdrop-blur-2xl">
                          <SelectItem value="1h" className="font-medium cursor-pointer py-3">1 Hour</SelectItem>
                          <SelectItem value="12h" className="font-medium cursor-pointer py-3">12 Hours</SelectItem>
                          <SelectItem value="24h" className="font-medium cursor-pointer py-3">24 Hours</SelectItem>
                          <SelectItem value="7d" className="font-medium cursor-pointer py-3">7 Days</SelectItem>
                          <SelectItem value="15d" className="font-medium cursor-pointer py-3">15 Days</SelectItem>
                          <SelectItem value="30d" className="font-medium cursor-pointer py-3">30 Days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Locked Credentials */}
                  {roomType === "locked" && !currentUser && (
                    <div className="space-y-4 p-5 rounded-2xl bg-muted/20 border border-white/5 animate-in fade-in slide-in-from-top-4 duration-300 ease-out">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-2"><Shield className="h-3.5 w-3.5" /> Temporary host credentials required for approvals</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="hostUsername" className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Host Name</Label>
                          <Input id="hostUsername" value={hostUsername} onChange={(e) => setHostUsername(e.target.value)} placeholder="Username" className="h-12 rounded-xl bg-background/50 border-white/10 hover:border-white/20 focus-visible:bg-background focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 transition-all duration-200" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="hostPasscode" className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Passphrase</Label>
                          <div className="relative group">
                            <Input id="hostPasscode" type={showHostPasscode ? "text" : "password"} value={hostPasscode} onChange={(e) => setHostPasscode(e.target.value)} placeholder="Passphrase" className="pr-10 h-12 rounded-xl bg-background/50 border-white/10 hover:border-white/20 focus-visible:bg-background focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 transition-all duration-200" />
                            <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent rounded-r-xl active:scale-95 transition-transform" onClick={() => setShowHostPasscode(!showHostPasscode)}>
                              {showHostPasscode ? <EyeOff className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" /> : <Eye className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Private Password */}
                  {roomType === "private_key" && (
                     <div className="space-y-2 animate-in fade-in slide-in-from-top-4 duration-300 ease-out">
                       <Label htmlFor="roomPassword" className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Access Password</Label>
                       <div className="relative group">
                         <Input id="roomPassword" type={showRoomPassword ? "text" : "password"} value={roomPassword} onChange={(e) => setRoomPassword(e.target.value)} placeholder="Secure your room..." className="h-12 rounded-xl bg-background/50 border-white/10 hover:border-white/20 focus-visible:bg-background focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 transition-all duration-200 pr-10" />
                         <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent rounded-r-xl active:scale-95 transition-transform" onClick={() => setShowRoomPassword(!showRoomPassword)}>
                           {showRoomPassword ? <EyeOff className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" /> : <Eye className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />}
                         </Button>
                       </div>
                     </div>
                  )}

                  {/* Pro Code */}
                  <div className="pt-6 border-t border-white/5">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 ml-1 mb-1.5">
                        <Ticket className="h-4 w-4 text-primary" />
                        <Label htmlFor="proCode" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pro Code (Optional)</Label>
                      </div>
                      <Input id="proCode" value={proCode} onChange={(e) => setProCode(e.target.value)} placeholder="Unlock permanent rooms..." className="h-12 rounded-xl bg-background/50 border-white/10 hover:border-white/20 focus-visible:bg-background focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 transition-all duration-200" />
                    </div>
                  </div>

                  {/* Primary Call to Action */}
                  <Button onClick={createRoom} disabled={isCreating} data-shortcut="create-room" className="w-full h-16 mt-8 rounded-2xl text-xl font-bold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all duration-300 group overflow-hidden relative" size="lg">
                    {/* Subtle shine effect on hover */}
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-[shimmer_1.5s_infinite] transition-all"></div>
                    
                    {isCreating ? <Loader2 className="h-7 w-7 animate-spin relative z-10" /> : (
                      <div className="flex items-center justify-center relative z-10">
                        Initialize Room
                        <ArrowRight className="h-6 w-6 ml-3 transition-transform duration-300 group-hover:translate-x-2" />
                      </div>
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </section>
      </main>

      {/* Keyboard Shortcuts Display */}
      <div className="border-t border-white/5 bg-background/20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-4">
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Keyboard Shortcuts:</span>
            {shortcuts.map((shortcut, index) => (
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
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowShortcutsModal(true)}
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50"
            >
              View All
            </Button>
          </div>
        </div>
      </div>

      {/* Modern Footer */}
      <footer className="mt-auto py-8 border-t border-white/5 bg-background/20 backdrop-blur-md relative z-10">
        <div className="text-center">
          <p className="text-sm font-semibold tracking-wide text-muted-foreground/60 flex items-center justify-center gap-2 hover:text-muted-foreground transition-colors duration-300 cursor-default">
            Built with <Sparkles className="h-4 w-4 text-primary/70 animate-pulse" /> ShareHub4U
          </p>
        </div>
      </footer>

      {/* Join Password Dialog */}
      <Dialog open={showJoinPasswordDialog} onOpenChange={setShowJoinPasswordDialog}>
        <DialogContent className="sm:max-w-[400px] rounded-[2rem] border-white/10 bg-background/80 backdrop-blur-2xl shadow-2xl p-6">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-2xl font-bold tracking-tight">Enter Password</DialogTitle>
            <DialogDescription>This room is private and requires a password to enter.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div className="relative group">
              <Input
                type={showJoinPassword ? "text" : "password"}
                value={joinPassword}
                onChange={(e) => setJoinPassword(e.target.value)}
                placeholder="Room password"
                className="pr-10 h-12 rounded-xl bg-background/50 border-white/10 hover:border-white/20 focus-visible:bg-background focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 transition-all duration-200"
                onKeyPress={(e) => e.key === "Enter" && handleJoinPasswordSubmit()}
              />
              <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent rounded-r-xl active:scale-95 transition-transform" onClick={() => setShowJoinPassword(!showJoinPassword)}>
                {showJoinPassword ? <EyeOff className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" /> : <Eye className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />}
              </Button>
            </div>
            <DialogFooter className="gap-3 sm:gap-0 mt-4">
              <Button variant="outline" className="rounded-xl border-white/10 hover:border-white/20 hover:bg-muted/50 active:scale-95 transition-all duration-200 h-11 px-6 font-semibold" onClick={() => { setShowJoinPasswordDialog(false); setJoinPassword(""); setPendingRoomData(null); }}>Cancel</Button>
              <Button className="rounded-xl shadow-md hover:shadow-lg active:scale-95 transition-all duration-200 h-11 px-6 font-semibold" onClick={handleJoinPasswordSubmit}>Join Room</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal 
        open={showShortcutsModal} 
        onOpenChange={setShowShortcutsModal} 
        shortcuts={shortcuts} 
      />
    </div>
  );
};

export default Index;