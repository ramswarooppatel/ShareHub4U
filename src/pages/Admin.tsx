import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, Plus, Users, Settings, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface ProCode {
  id: string;
  code: string;
  credits: number;
  max_rooms: number;
  rooms_created: number;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
}

interface Room {
  id: string;
  room_code: string;
  room_type: string;
  host_id: string;
  is_permanent: boolean;
  expires_at: string | null;
  created_at: string;
}

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Pro code creation
  const [newProCode, setNewProCode] = useState("");
  const [credits, setCredits] = useState("10");
  const [maxRooms, setMaxRooms] = useState("5");
  const [isCreating, setIsCreating] = useState(false);

  // Data
  const [proCodes, setProCodes] = useState<ProCode[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
      setupRealtimeSubscription();
    }
  }, [isAuthenticated]);

  const handleLogin = async () => {
    if (username === "admin_4u" && password === "rpX@6065") {
      setIsAuthenticated(true);
      toast({ title: "Login successful!" });
    } else {
      toast({
        title: "Invalid credentials",
        description: "Please check your username and password.",
        variant: "destructive",
      });
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Load pro codes
      const { data: proCodesData, error: proCodesError } = await supabase
        .from("pro_codes")
        .select("*")
        .order("created_at", { ascending: false });

      if (proCodesError) throw proCodesError;
      setProCodes(proCodesData || []);

      // Load rooms
      const { data: roomsData, error: roomsError } = await supabase
        .from("rooms")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (roomsError) throw roomsError;
      setRooms(roomsData || []);
    } catch (error: any) {
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('admin-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pro_codes'
        },
        () => {
          loadData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms'
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const createProCode = async () => {
    if (!newProCode.trim()) {
      toast({
        title: "Code required",
        description: "Please enter a pro code.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const { error } = await supabase.from("pro_codes").insert({
        code: newProCode.trim(),
        credits: parseInt(credits),
        max_rooms: parseInt(maxRooms),
      });

      if (error) throw error;

      toast({ title: "Pro code created!" });
      setNewProCode("");
      setCredits("10");
      setMaxRooms("5");
      loadData();
    } catch (error: any) {
      toast({
        title: "Error creating pro code",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const deleteRoom = async (roomId: string, roomCode: string) => {
    try {
      // Delete room files from storage
      const { data: files } = await supabase
        .from("room_files")
        .select("file_path")
        .eq("room_id", roomId);

      if (files && files.length > 0) {
        const filePaths = files.map(f => f.file_path);
        await supabase.storage.from("room-files").remove(filePaths);
      }

      // Delete room and related data (cascade should handle this)
      const { error } = await supabase
        .from("rooms")
        .delete()
        .eq("id", roomId);

      if (error) throw error;

      toast({
        title: "Room deleted",
        description: `Room ${roomCode} and all its files have been permanently deleted.`,
      });
      loadData();
    } catch (error: any) {
      toast({
        title: "Error deleting room",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 w-full max-w-md">
          <div className="flex items-center gap-2 mb-6">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Admin Login</h1>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username..."
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                className="mt-2"
              />
            </div>

            <Button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="w-full"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                "Login"
              )}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
            </div>
            <Button
              onClick={() => {
                setIsAuthenticated(false);
                setUsername("");
                setPassword("");
              }}
              variant="outline"
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Create Pro Code */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Plus className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Create Pro Code</h2>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="proCode">Pro Code</Label>
                <Input
                  id="proCode"
                  value={newProCode}
                  onChange={(e) => setNewProCode(e.target.value)}
                  placeholder="Enter pro code..."
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="credits">Credits</Label>
                <Input
                  id="credits"
                  type="number"
                  value={credits}
                  onChange={(e) => setCredits(e.target.value)}
                  placeholder="10"
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="maxRooms">Max Rooms</Label>
                <Input
                  id="maxRooms"
                  type="number"
                  value={maxRooms}
                  onChange={(e) => setMaxRooms(e.target.value)}
                  placeholder="5"
                  className="mt-2"
                />
              </div>

              <Button
                onClick={createProCode}
                disabled={isCreating}
                className="w-full"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Pro Code"
                )}
              </Button>
            </div>
          </Card>

          {/* Pro Codes List */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Settings className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Pro Codes ({proCodes.length})</h2>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : proCodes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No pro codes created yet</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {proCodes.map((code) => (
                  <div
                    key={code.id}
                    className="flex items-center justify-between p-3 border border-border rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-foreground">{code.code}</p>
                      <p className="text-sm text-muted-foreground">
                        {code.credits} credits • {code.max_rooms} max rooms • {code.rooms_created} used
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs rounded ${
                        code.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {code.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Rooms Management */}
          <Card className="p-6 lg:col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Rooms Management ({rooms.length})</h2>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : rooms.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No rooms found</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-foreground">{room.room_code}</p>
                      <p className="text-sm text-muted-foreground">
                        {room.room_type} • Created {new Date(room.created_at).toLocaleDateString()}
                        {room.is_permanent ? ' • Permanent' : room.expires_at ? ` • Expires ${new Date(room.expires_at).toLocaleString()}` : ''}
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Room Permanently</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the room "{room.room_code}"
                            and all associated files, participants, and data.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteRoom(room.id, room.room_code)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete Room
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Admin;