import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, DoorOpen, Plus, Lock, Key, Globe, Infinity as InfinityIcon, Ticket, Clock, User, LogIn, UserPlus } from "lucide-react";
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

  useEffect(() => {
    initializeUser();
  }, []);

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toLowerCase();
  };

  const createRoom = async () => {
    // Validate inputs
    if (roomType === "private_key" && !roomPassword.trim()) {
      toast({
        title: "Password required",
        description: "Please enter a password for the private key room.",
        variant: "destructive",
      });
      return;
    }

    // Only require credentials for locked rooms if user is not logged in
    if (roomType === "locked" && !currentUser && (!hostUsername.trim() || !hostPasscode.trim())) {
      toast({
        title: "Credentials required",
        description: "Please enter username and passphrase for locked room.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const roomCode = customSlug.trim() || generateRoomCode();
      
      // Check if slug already exists
      const { data: existing } = await supabase
        .from("rooms")
        .select("id")
        .eq("room_code", roomCode)
        .maybeSingle();

      if (existing) {
        toast({
          title: "Room code already exists",
          description: "Please choose a different room code or leave it blank for auto-generation.",
          variant: "destructive",
        });
        return;
      }

      // Validate host_id: check if currentUser exists in database
      let hostId = null;
      if (currentUser?.id) {
        const { data: userExists } = await supabase
          .from("users")
          .select("id")
          .eq("id", currentUser.id)
          .maybeSingle();
        
        if (userExists) {
          hostId = currentUser.id;
        } else {
          // User was deleted, clear local storage and show message
          localStorage.removeItem("user_id");
          localStorage.removeItem("username");
          setCurrentUser(null);
          toast({
            title: "Account not found",
            description: "Your account was removed. Creating room as anonymous.",
            variant: "destructive",
          });
        }
      }

      // Validate pro code and determine if room should be permanent
      let validatedProCode = null;
      let roomIsPermanent = false;

      if (proCode.trim()) {
        const { data: proCodeData, error: proCodeError } = await supabase
          .from("pro_codes")
          .select("*")
          .eq("code", proCode.trim())
          .eq("is_active", true)
          .gt("expires_at", new Date().toISOString())
          .single();

        if (proCodeError || !proCodeData) {
          toast({
            title: "Invalid pro code",
            description: "The pro code is invalid, expired, or inactive.",
            variant: "destructive",
          });
          return;
        }

        // Check if user has already used this pro code for max rooms
        if (hostId && proCodeData.max_rooms > 0) {
          const { count: userRoomsCount } = await supabase
            .from("rooms")
            .select("*", { count: "exact", head: true })
            .eq("host_id", hostId)
            .eq("pro_code_used", true);

          if (userRoomsCount && userRoomsCount >= proCodeData.max_rooms) {
            toast({
              title: "Pro code limit reached",
              description: `You have reached the maximum number of rooms (${proCodeData.max_rooms}) for this pro code.`,
              variant: "destructive",
            });
            return;
          }
        }

        validatedProCode = proCodeData;
        roomIsPermanent = true;
      }

      // Calculate expiry date
      let expiresAt = null;
      if (!roomIsPermanent) {
        const now = new Date();
        switch (roomTiming) {
          case "1h":
            expiresAt = new Date(now.getTime() + 1 * 60 * 60 * 1000);
            break;
          case "12h":
            expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000);
            break;
          case "24h":
            expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            break;
          case "7d":
            expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            break;
          case "15d":
            expiresAt = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
            break;
          case "30d":
            expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            break;
        }
      }

      // Create room
      const { data: room, error } = await supabase
        .from("rooms")
        .insert({
          room_code: roomCode,
          room_type: roomType,
          host_id: hostId,
          room_password: roomType === "private_key" ? roomPassword : null,
          is_permanent: roomIsPermanent,
          expires_at: expiresAt,
          file_sharing_enabled: true,
          only_host_can_upload: false,
          auto_accept_requests: roomType === "locked" ? false : true,
          pro_code_used: !!validatedProCode,
        })
        .select()
        .single();

      if (error) throw error;

      // Update pro code usage if used
      if (validatedProCode) {
        await supabase
          .from("pro_codes")
          .update({
            rooms_created: validatedProCode.rooms_created + 1,
          })
          .eq("id", validatedProCode.id);
      }

      // Add host as participant if logged in and user exists
      if (hostId) {
        await supabase.from("room_participants").insert({
          room_id: room.id,
          user_id: hostId,
          role: "host",
        });
      }

      toast({
        title: "Room created successfully!",
        description: roomIsPermanent ? "This is a permanent room that never expires." : `Room code: ${roomCode}`,
      });

      // Navigate to room
      navigate(`/room/${roomCode}`);
    } catch (error: any) {
      console.error("Error creating room:", error);
      toast({
        title: "Error creating room",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  // User authentication functions
  const initializeUser = () => {
    const savedUser = localStorage.getItem("current_user");
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setCurrentUser(user);
      } catch (error) {
        localStorage.removeItem("current_user");
      }
    }
  };

  const loginUser = async () => {
    if (!loginUsername.trim() || !loginPassword.trim()) {
      toast({
        title: "Missing credentials",
        description: "Please enter both username and password.",
        variant: "destructive",
      });
      return;
    }

    setIsAuthenticating(true);
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("username", loginUsername.trim())
        .eq("passcode", loginPassword)
        .single();

      if (error || !data) {
        throw new Error("Invalid username or password");
      }

      const user = { id: data.id, username: data.username };
      setCurrentUser(user);
      localStorage.setItem("current_user", JSON.stringify(user));
      localStorage.setItem("user_id", data.id);

      toast({
        title: "Login successful!",
        description: `Welcome back, ${data.username || 'User'}!`,
      });

      setShowAuthModal(false);
      setLoginUsername("");
      setLoginPassword("");
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const registerUser = async () => {
    if (!registerUsername.trim() || !registerPassword.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter both username and password.",
        variant: "destructive",
      });
      return;
    }

    if (registerPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    setIsAuthenticating(true);
    try {
      // Check if username already exists
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("username", registerUsername.trim())
        .maybeSingle();

      if (existingUser) {
        throw new Error("Username already taken");
      }

      const { data, error } = await supabase
        .from("users")
        .insert({
          username: registerUsername.trim(),
          passcode: registerPassword,
        })
        .select()
        .single();

      if (error) throw error;

      const user = { id: data.id, username: data.username };
      setCurrentUser(user);
      localStorage.setItem("current_user", JSON.stringify(user));
      localStorage.setItem("user_id", data.id);

      toast({
        title: "Registration successful!",
        description: `Welcome, ${data.username}!`,
      });

      setShowAuthModal(false);
      setRegisterUsername("");
      setRegisterPassword("");
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const logoutUser = () => {
    setCurrentUser(null);
    localStorage.removeItem("current_user");
    localStorage.removeItem("user_id");
    toast({
      title: "Logged out",
      description: "You have been logged out successfully.",
    });
  };

  const joinRoom = async () => {
    if (!joinCode.trim()) {
      toast({
        title: "Enter a room code",
        description: "Please enter a room code to join.",
        variant: "destructive",
      });
      return;
    }

    setIsJoining(true);
    try {
      // First, check if room exists and get its details
      const { data: roomData, error: roomError } = await supabase
        .from("rooms")
        .select("id, room_code, room_type, room_password, auto_accept_requests, host_id, expires_at")
        .eq("room_code", joinCode.trim().toLowerCase())
        .maybeSingle();

      if (roomError) throw roomError;

      if (!roomData) {
        toast({
          title: "Room not found",
          description: "No room exists with this code.",
          variant: "destructive",
        });
        setIsJoining(false);
        return;
      }

      // Check if room has expired
      if (roomData.expires_at && new Date(roomData.expires_at) < new Date()) {
        toast({
          title: "Room expired",
          description: "This room has expired and is no longer accessible.",
          variant: "destructive",
        });
        setIsJoining(false);
        return;
      }

      // Handle different room types
      if (roomData.room_type === "public") {
        // Public rooms: direct access
        navigate(`/room/${roomData.room_code}`);
      } else if (roomData.room_type === "private_key") {
        // Private key rooms: require password
        setPendingRoomData({
          room_code: roomData.room_code,
          room_type: roomData.room_type,
          room_password: roomData.room_password || undefined,
        });
        setShowJoinPasswordDialog(true);
      } else if (roomData.room_type === "locked") {
        // Locked rooms: check approval requirements
        if (roomData.auto_accept_requests) {
          // Auto-accept enabled: direct access
          navigate(`/room/${roomData.room_code}`);
        } else {
          // Manual approval required: go to room page which will handle the request
          navigate(`/room/${roomData.room_code}`);
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      toast({
        title: "Error joining room",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
    }
  };

  const handleJoinPasswordSubmit = async () => {
    if (!pendingRoomData || !joinPassword.trim()) {
      toast({
        title: "Password required",
        description: "Please enter the room password.",
        variant: "destructive",
      });
      return;
    }

    if (joinPassword !== pendingRoomData.room_password) {
      toast({
        title: "Incorrect password",
        description: "The password you entered is incorrect.",
        variant: "destructive",
      });
      return;
    }

    // Password correct, navigate to room
    navigate(`/room/${pendingRoomData.room_code}?password=${encodeURIComponent(joinPassword)}`);
    setShowJoinPasswordDialog(false);
    setJoinPassword("");
    setPendingRoomData(null);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            ShareHub4U Room
          </h1>
          <p className="text-lg text-muted-foreground mb-6">
            Create secure, temporary rooms for file sharing and collaboration
          </p>

          {/* User Authentication Section */}
          <div className="flex items-center justify-center gap-4 mb-8">
            {currentUser ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full">
                  <User className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-primary">
                    Welcome, {currentUser.username || 'User'}!
                  </span>
                </div>
                <Button
                  onClick={logoutUser}
                  variant="outline"
                  size="sm"
                >
                  Logout
                </Button>
              </div>
            ) : (
              <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" />
                    Login / Register
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>User Account</DialogTitle>
                    <DialogDescription>
                      Create an account to be recognized across sessions and access exclusive features.
                    </DialogDescription>
                  </DialogHeader>

                  <Tabs value={authTab} onValueChange={setAuthTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="login">Login</TabsTrigger>
                      <TabsTrigger value="register">Register</TabsTrigger>
                    </TabsList>

                    <TabsContent value="login" className="space-y-4">
                      <div>
                        <Label htmlFor="loginUsername">Username</Label>
                        <Input
                          id="loginUsername"
                          value={loginUsername}
                          onChange={(e) => setLoginUsername(e.target.value)}
                          placeholder="Enter your username"
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label htmlFor="loginPassword">Password</Label>
                        <Input
                          id="loginPassword"
                          type="password"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          placeholder="Enter your password"
                          className="mt-2"
                        />
                      </div>
                      <Button
                        onClick={loginUser}
                        disabled={isAuthenticating}
                        className="w-full"
                      >
                        {isAuthenticating ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Logging in...
                          </>
                        ) : (
                          <>
                            <LogIn className="mr-2 h-4 w-4" />
                            Login
                          </>
                        )}
                      </Button>
                    </TabsContent>

                    <TabsContent value="register" className="space-y-4">
                      <div>
                        <Label htmlFor="registerUsername">Username</Label>
                        <Input
                          id="registerUsername"
                          value={registerUsername}
                          onChange={(e) => setRegisterUsername(e.target.value)}
                          placeholder="Choose a username"
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label htmlFor="registerPassword">Password</Label>
                        <Input
                          id="registerPassword"
                          type="password"
                          value={registerPassword}
                          onChange={(e) => setRegisterPassword(e.target.value)}
                          placeholder="Choose a password (min 6 chars)"
                          className="mt-2"
                        />
                      </div>
                      <Button
                        onClick={registerUser}
                        disabled={isAuthenticating}
                        className="w-full"
                      >
                        {isAuthenticating ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating account...
                          </>
                        ) : (
                          <>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Create Account
                          </>
                        )}
                      </Button>
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Plus className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-semibold text-foreground">Create Room</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="customSlug">Custom Slug (Optional)</Label>
                <Input
                  id="customSlug"
                  placeholder="my-awesome-room"
                  value={customSlug}
                  onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty for auto-generated code
                </p>
              </div>

              <div>
                <Label htmlFor="roomType">Room Type</Label>
                <Select value={roomType} onValueChange={setRoomType}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select room type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        <span>Public - Anyone can join</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="locked">
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        <span>Locked - Requires approval</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="private_key">
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        <span>Private Key - Password protected</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="roomTiming">Room Duration</Label>
                <Select value={roomTiming} onValueChange={setRoomTiming}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select room duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1h">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>1 Hour</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="12h">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>12 Hours</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="24h">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>1 Day (24 Hours)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="7d">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>7 Days</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="15d">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>15 Days</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="30d">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>30 Days</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  How long the room should remain active
                </p>
              </div>

              {roomType === "locked" && !currentUser && (
                <div className="space-y-4 p-4 bg-muted/50 rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground">
                    Set your credentials to approve join requests
                  </p>
                  <div>
                    <Label htmlFor="hostUsername">Username</Label>
                    <Input
                      id="hostUsername"
                      value={hostUsername}
                      onChange={(e) => setHostUsername(e.target.value)}
                      placeholder="Enter your username..."
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="hostPasscode">Passphrase</Label>
                    <Input
                      id="hostPasscode"
                      type="password"
                      value={hostPasscode}
                      onChange={(e) => setHostPasscode(e.target.value)}
                      placeholder="Enter your passphrase..."
                      className="mt-2"
                    />
                  </div>
                </div>
              )}

              {roomType === "private_key" && (
                <div>
                  <Label htmlFor="roomPassword">Room Password</Label>
                  <Input
                    id="roomPassword"
                    type="password"
                    value={roomPassword}
                    onChange={(e) => setRoomPassword(e.target.value)}
                    placeholder="Enter password..."
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Users will need this password to join
                  </p>
                </div>
              )}

              <div className="border-t border-border pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <InfinityIcon className="h-4 w-4 text-primary" />
                  <Label htmlFor="proCode">Pro Code (Optional)</Label>
                </div>
                <Input
                  id="proCode"
                  value={proCode}
                  onChange={(e) => setProCode(e.target.value)}
                  placeholder="Enter pro code for permanent room..."
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Ticket className="h-3 w-3" />
                  Pro codes create permanent rooms that never expire
                </p>
              </div>

              <Button
                onClick={createRoom}
                disabled={isCreating}
                className="w-full"
                size="lg"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Room"
                )}
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <DoorOpen className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-semibold text-foreground">Join Room</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="joinCode">Room Code</Label>
                <Input
                  id="joinCode"
                  placeholder="Enter room code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && joinRoom()}
                  className="mt-2"
                />
              </div>

              <Button
                onClick={joinRoom}
                disabled={isJoining}
                className="w-full"
                size="lg"
              >
                {isJoining ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Joining...
                  </>
                ) : (
                  "Join Room"
                )}
              </Button>
            </div>
          </Card>
        </div>

        {/* <div className="text-center mt-8">
          <a
            href="/admin"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Admin Panel
          </a>
        </div> */}

        {/* Password Dialog for Joining Private Rooms */}
        <Dialog open={showJoinPasswordDialog} onOpenChange={setShowJoinPasswordDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Enter Room Password</DialogTitle>
              <DialogDescription>
                This room requires a password to join. Please enter the correct password.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="joinPassword">Password</Label>
                <Input
                  id="joinPassword"
                  type="password"
                  value={joinPassword}
                  onChange={(e) => setJoinPassword(e.target.value)}
                  placeholder="Enter room password"
                  className="mt-2"
                  onKeyPress={(e) => e.key === "Enter" && handleJoinPasswordSubmit()}
                />
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowJoinPasswordDialog(false);
                    setJoinPassword("");
                    setPendingRoomData(null);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleJoinPasswordSubmit}>
                  Join Room
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Index;
