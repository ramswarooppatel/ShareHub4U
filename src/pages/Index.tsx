import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, DoorOpen, Plus, Lock, Key, Globe, Infinity, Ticket, Clock } from "lucide-react";

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
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

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

    if (roomType === "locked" && (!hostUsername.trim() || !hostPasscode.trim())) {
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
          title: "Slug already taken",
          description: "Please choose a different custom slug or leave it empty for auto-generation.",
          variant: "destructive",
        });
        setIsCreating(false);
        return;
      }

      // Create user if doesn't exist
      let userId = localStorage.getItem("user_id");
      if (!userId) {
        const { data: userData, error: userError } = await supabase
          .from("users")
          .insert({
            username: roomType === "locked" ? hostUsername : null,
            passcode: roomType === "locked" ? hostPasscode : null,
          })
          .select()
          .single();
        
        if (userError) throw userError;
        userId = userData.id;
        localStorage.setItem("user_id", userId);
      } else if (roomType === "locked") {
        // Update existing user with credentials
        const { error: updateError } = await supabase
          .from("users")
          .update({
            username: hostUsername,
            passcode: hostPasscode,
          })
          .eq("id", userId);
        
        if (updateError) throw updateError;
      }

      // Validate and consume pro code if provided
      let isPermanent = false;
      if (proCode.trim()) {
        const { data: proCodeData, error: proCodeError } = await supabase
          .from("pro_codes")
          .select("*")
          .eq("code", proCode.trim())
          .eq("is_active", true)
          .maybeSingle();

        if (proCodeError) throw proCodeError;

        if (!proCodeData) {
          toast({
            title: "Invalid pro code",
            description: "The pro code you entered is invalid or has expired.",
            variant: "destructive",
          });
          setIsCreating(false);
          return;
        }

        if (proCodeData.rooms_created >= proCodeData.max_rooms) {
          toast({
            title: "Pro code limit reached",
            description: "This pro code has reached its maximum room limit.",
            variant: "destructive",
          });
          setIsCreating(false);
          return;
        }

        if (proCodeData.credits <= 0) {
          toast({
            title: "No credits remaining",
            description: "This pro code has no credits remaining.",
            variant: "destructive",
          });
          setIsCreating(false);
          return;
        }

        // Update pro code usage
        await supabase
          .from("pro_codes")
          .update({
            rooms_created: proCodeData.rooms_created + 1,
            credits: proCodeData.credits - 1,
          })
          .eq("id", proCodeData.id);

        isPermanent = true;
        
        toast({
          title: "Pro code applied!",
          description: "Your room will be permanent and never expire.",
        });
      }

      // Calculate expiration time
      let expiresAt = null;
      if (!isPermanent) {
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
          default:
            expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Default to 24h
        }
      }

      // Create room
      const roomData: any = {
        room_code: roomCode,
        host_id: userId,
        room_type: roomType,
        is_permanent: isPermanent,
        pro_code_used: proCode.trim() !== "",
        expires_at: expiresAt?.toISOString(),
      };

      if (roomType === "private_key") {
        roomData.room_password = roomPassword;
      }

      if (roomType === "locked") {
        roomData.auto_accept_requests = false;
      }

      const { data, error } = await supabase
        .from("rooms")
        .insert(roomData)
        .select()
        .single();

      if (error) throw error;

      // Add host as participant
      const { error: participantError } = await supabase
        .from("room_participants")
        .insert({
          room_id: data.id,
          user_id: userId,
          role: "host",
        });

      if (participantError) throw participantError;

      toast({
        title: "Room created!",
        description: `Your room code is: ${roomCode}`,
      });

      navigate(`/room/${roomCode}`);
    } catch (error: any) {
      toast({
        title: "Error creating room",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
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
      const { data, error } = await supabase
        .from("rooms")
        .select("room_code")
        .eq("room_code", joinCode.trim().toLowerCase())
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast({
          title: "Room not found",
          description: "No room exists with this code.",
          variant: "destructive",
        });
        setIsJoining(false);
        return;
      }

      navigate(`/room/${data.room_code}`);
    } catch (error: any) {
      toast({
        title: "Error joining room",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            ShareHub4U Room
          </h1>
          <p className="text-lg text-muted-foreground">
            Create or join a room to share files instantly
          </p>
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

              {roomType === "locked" && (
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
                  <Infinity className="h-4 w-4 text-primary" />
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

        <div className="text-center mt-8">
          <a
            href="/admin"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Admin Panel
          </a>
        </div>
      </div>
    </div>
  );
};

export default Index;
