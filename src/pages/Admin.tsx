import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, Plus, Users, Settings, Trash2, UserCheck, FileText, Upload } from "lucide-react";
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
  const [users, setUsers] = useState<any[]>([]);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [markdownNotes, setMarkdownNotes] = useState<any[]>([]);
  const [roomFiles, setRoomFiles] = useState<any[]>([]);
  const [roomParticipants, setRoomParticipants] = useState<any[]>([]);
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

      // Load users
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (usersError) throw usersError;
      setUsers(usersData || []);

      // Load join requests
      const { data: joinRequestsData, error: joinRequestsError } = await supabase
        .from("join_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (joinRequestsError) throw joinRequestsError;
      setJoinRequests(joinRequestsData || []);

      // Load markdown notes
      const { data: markdownNotesData, error: markdownNotesError } = await supabase
        .from("markdown_notes")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(50);

      if (markdownNotesError) throw markdownNotesError;
      setMarkdownNotes(markdownNotesData || []);

      // Load room files
      const { data: roomFilesData, error: roomFilesError } = await supabase
        .from("room_files")
        .select("*")
        .order("uploaded_at", { ascending: false })
        .limit(50);

      if (roomFilesError) throw roomFilesError;
      setRoomFiles(roomFilesData || []);

      // Load room participants
      const { data: roomParticipantsData, error: roomParticipantsError } = await supabase
        .from("room_participants")
        .select("*")
        .order("joined_at", { ascending: false })
        .limit(100);

      if (roomParticipantsError) throw roomParticipantsError;
      setRoomParticipants(roomParticipantsData || []);

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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users'
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
          table: 'join_requests'
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
          table: 'markdown_notes'
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
          table: 'room_files'
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
          table: 'room_participants'
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

  const makeRoomPermanent = async (roomId: string, roomCode: string) => {
    try {
      const { error } = await supabase
        .from("rooms")
        .update({ 
          is_permanent: true,
          expires_at: null 
        })
        .eq("id", roomId);

      if (error) throw error;

      toast({
        title: "Room made permanent",
        description: `Room ${roomCode} will never expire.`,
      });
      loadData();
    } catch (error: any) {
      toast({
        title: "Error updating room",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateRoomExpiry = async (roomId: string, roomCode: string, expiresAt: string) => {
    try {
      const { error } = await supabase
        .from("rooms")
        .update({ 
          expires_at: expiresAt,
          is_permanent: false 
        })
        .eq("id", roomId);

      if (error) throw error;

      toast({
        title: "Room expiry updated",
        description: `Room ${roomCode} expiry has been updated.`,
      });
      loadData();
    } catch (error: any) {
      toast({
        title: "Error updating room",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("users")
        .delete()
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: "User deleted",
        description: "User has been permanently deleted.",
      });
      loadData();
    } catch (error: any) {
      toast({
        title: "Error deleting user",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteJoinRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from("join_requests")
        .delete()
        .eq("id", requestId);

      if (error) throw error;

      toast({
        title: "Join request deleted",
        description: "Join request has been removed.",
      });
      loadData();
    } catch (error: any) {
      toast({
        title: "Error deleting join request",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteMarkdownNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from("markdown_notes")
        .delete()
        .eq("id", noteId);

      if (error) throw error;

      toast({
        title: "Note deleted",
        description: "Markdown note has been deleted.",
      });
      loadData();
    } catch (error: any) {
      toast({
        title: "Error deleting note",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteRoomFile = async (fileId: string, filePath: string) => {
    try {
      // Delete from storage
      await supabase.storage.from("room-files").remove([filePath]);

      // Delete from database
      const { error } = await supabase
        .from("room_files")
        .delete()
        .eq("id", fileId);

      if (error) throw error;

      toast({
        title: "File deleted",
        description: "File has been permanently deleted.",
      });
      loadData();
    } catch (error: any) {
      toast({
        title: "Error deleting file",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const removeParticipant = async (participantId: string) => {
    try {
      const { error } = await supabase
        .from("room_participants")
        .delete()
        .eq("id", participantId);

      if (error) throw error;

      toast({
        title: "Participant removed",
        description: "Participant has been removed from the room.",
      });
      loadData();
    } catch (error: any) {
      toast({
        title: "Error removing participant",
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
                    <div className="flex gap-2">
                      {!room.is_permanent && (
                        <Button
                          onClick={() => makeRoomPermanent(room.id, room.room_code)}
                          variant="outline"
                          size="sm"
                        >
                          Make Permanent
                        </Button>
                      )}
                      <Button
                        onClick={() => {
                          const newExpiry = prompt("Enter new expiry date (YYYY-MM-DD HH:mm)", 
                            room.expires_at ? new Date(room.expires_at).toISOString().slice(0, 16) : "");
                          if (newExpiry) {
                            updateRoomExpiry(room.id, room.room_code, new Date(newExpiry).toISOString());
                          }
                        }}
                        variant="outline"
                        size="sm"
                      >
                        Update Expiry
                      </Button>
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
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Users Management */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Users Management ({users.length})</h2>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No users found</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-foreground">{user.id}</p>
                      <p className="text-sm text-muted-foreground">
                        Created {new Date(user.created_at).toLocaleDateString()}
                        {user.username && ` • Username: ${user.username}`}
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
                          <AlertDialogTitle>Delete User Permanently</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the user
                            and all associated data.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteUser(user.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete User
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Join Requests Management */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <UserCheck className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Join Requests ({joinRequests.length})</h2>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : joinRequests.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No join requests found</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {joinRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-foreground">Room: {request.room_id}</p>
                      <p className="text-sm text-muted-foreground">
                        Status: {request.status} • Created {new Date(request.created_at).toLocaleDateString()}
                        {request.anonymous_name && ` • Name: ${request.anonymous_name}`}
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
                          <AlertDialogTitle>Delete Join Request</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this join request.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteJoinRequest(request.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete Request
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Markdown Notes Management */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Markdown Notes ({markdownNotes.length})</h2>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : markdownNotes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No notes found</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {markdownNotes.map((note) => (
                  <div
                    key={note.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-foreground">{note.title}</p>
                      <p className="text-sm text-muted-foreground">
                        Room: {note.room_id} • Updated {new Date(note.updated_at).toLocaleDateString()}
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
                          <AlertDialogTitle>Delete Note</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this markdown note.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMarkdownNote(note.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete Note
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Room Files Management */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Upload className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Room Files ({roomFiles.length})</h2>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : roomFiles.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No files found</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {roomFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-foreground">{file.file_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Room: {file.room_id} • {file.file_size} bytes • Uploaded {new Date(file.uploaded_at).toLocaleDateString()}
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
                          <AlertDialogTitle>Delete File Permanently</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this file from storage and database.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteRoomFile(file.id, file.file_path)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete File
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Room Participants Management */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Room Participants ({roomParticipants.length})</h2>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : roomParticipants.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No participants found</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {roomParticipants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-foreground">Room: {participant.room_id}</p>
                      <p className="text-sm text-muted-foreground">
                        User: {participant.user_id} • Role: {participant.role} • Joined {new Date(participant.joined_at).toLocaleDateString()}
                        {participant.anonymous_name && ` • Name: ${participant.anonymous_name}`}
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Participant</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove the participant from the room.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => removeParticipant(participant.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remove Participant
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