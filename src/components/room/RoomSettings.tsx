import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Settings, Loader2, Clock } from "lucide-react";

interface RoomSettingsProps {
  room: {
    id: string;
    room_code: string;
    room_type: string;
    room_password: string | null;
    file_sharing_enabled: boolean;
    only_host_can_upload: boolean;
    auto_accept_requests: boolean;
    is_permanent: boolean;
    expires_at: string | null;
    host_id: string;
  };
  userId: string;
  onRoomUpdate: () => void;
}

export const RoomSettings = ({ room, userId, onRoomUpdate }: RoomSettingsProps) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Check permissions
  const isHost = userId === room.host_id;
  const isPublicRoom = room.room_type === "public";

  // Settings state
  const [roomType, setRoomType] = useState(room.room_type);
  const [roomPassword, setRoomPassword] = useState(room.room_password || "");
  const [fileSharingEnabled, setFileSharingEnabled] = useState(room.file_sharing_enabled);
  const [onlyHostCanUpload, setOnlyHostCanUpload] = useState(room.only_host_can_upload);
  const [autoAcceptRequests, setAutoAcceptRequests] = useState(room.auto_accept_requests);
  const [extendDuration, setExtendDuration] = useState("24h");

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates: any = {
        room_type: roomType,
        file_sharing_enabled: fileSharingEnabled,
        only_host_can_upload: onlyHostCanUpload,
      };

      // Handle password
      if (roomType === "private_key") {
        if (!roomPassword.trim()) {
          toast({
            title: "Password required",
            description: "Please enter a password for the private key room.",
            variant: "destructive",
          });
          setIsSaving(false);
          return;
        }
        updates.room_password = roomPassword;
      } else {
        updates.room_password = null;
      }

      // Handle auto accept for locked rooms
      if (roomType === "locked") {
        updates.auto_accept_requests = autoAcceptRequests;
      }

      // Handle room extension if not permanent
      if (!room.is_permanent && extendDuration !== "none") {
        let extendMs = 0;
        switch (extendDuration) {
          case "1h":
            extendMs = 1 * 60 * 60 * 1000;
            break;
          case "12h":
            extendMs = 12 * 60 * 60 * 1000;
            break;
          case "24h":
            extendMs = 24 * 60 * 60 * 1000;
            break;
          case "7d":
            extendMs = 7 * 24 * 60 * 60 * 1000;
            break;
          case "15d":
            extendMs = 15 * 24 * 60 * 60 * 1000;
            break;
          case "30d":
            extendMs = 30 * 24 * 60 * 60 * 1000;
            break;
        }

        if (extendMs > 0) {
          const currentExpiry = room.expires_at ? new Date(room.expires_at) : new Date();
          const newExpiry = new Date(currentExpiry.getTime() + extendMs);
          updates.expires_at = newExpiry.toISOString();
        }
      }

      const { error } = await supabase
        .from("rooms")
        .update(updates)
        .eq("id", room.id);

      if (error) throw error;

      toast({
        title: "Settings updated!",
        description: "Room settings have been saved successfully.",
      });

      onRoomUpdate();
      setIsOpen(false);
    } catch (error: any) {
      toast({
        title: "Error updating settings",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Room Settings</DialogTitle>
          <DialogDescription>
            {isPublicRoom 
              ? "Configure room settings. As this is a public room, all participants can modify settings."
              : "Configure your room settings. Only the room host can modify these settings."
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="settings-roomType">Room Type</Label>
            <Select value={roomType} onValueChange={setRoomType}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public - Anyone can join</SelectItem>
                <SelectItem value="locked">Locked - Requires approval</SelectItem>
                <SelectItem value="private_key">Private Key - Password protected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {roomType === "private_key" && (
            <div>
              <Label htmlFor="settings-password">Room Password</Label>
              <Input
                id="settings-password"
                type="password"
                value={roomPassword}
                onChange={(e) => setRoomPassword(e.target.value)}
                placeholder="Enter password..."
                className="mt-2"
              />
            </div>
          )}

          {roomType === "locked" && (
            <div className="flex items-center space-x-2">
              <input
                title="Accept Request"
                type="checkbox"
                id="auto-accept"
                checked={autoAcceptRequests}
                onChange={(e) => setAutoAcceptRequests(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="auto-accept">Auto-accept join requests</Label>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <input
              title="File Sharing"
              type="checkbox"
              id="file-sharing"
              checked={fileSharingEnabled}
              onChange={(e) => setFileSharingEnabled(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="file-sharing">Enable file sharing</Label>
          </div>

          <div className="flex items-center space-x-2">
            <input
              title="Host Only Upload"
              type="checkbox"
              id="host-only-upload"
              checked={onlyHostCanUpload}
              onChange={(e) => setOnlyHostCanUpload(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="host-only-upload">Only host can upload files</Label>
          </div>

          {!room.is_permanent && (
            <div>
              <Label htmlFor="extend-duration">Extend Room Duration</Label>
              <Select value={extendDuration} onValueChange={setExtendDuration}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Don't extend</SelectItem>
                  <SelectItem value="1h">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>+1 Hour</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="12h">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>+12 Hours</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="24h">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>+1 Day</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="7d">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>+7 Days</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="15d">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>+15 Days</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="30d">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>+30 Days</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};