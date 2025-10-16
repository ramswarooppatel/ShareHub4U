import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Lock } from "lucide-react";

interface JoinRequestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { anonymousName?: string; message?: string; password?: string }) => Promise<void>;
  roomType: string;
  requiresPassword: boolean;
}

export const JoinRequestDialog = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  roomType,
  requiresPassword 
}: JoinRequestDialogProps) => {
  const [anonymousName, setAnonymousName] = useState("");
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit({ 
        anonymousName: anonymousName.trim() || undefined,
        message: message.trim() || undefined,
        password: password.trim() || undefined
      });
      setAnonymousName("");
      setMessage("");
      setPassword("");
      onClose();
    } catch (error) {
      // Error handled by parent
    } finally {
      setSubmitting(false);
    }
  };

  const getTitle = () => {
    if (requiresPassword) return "Enter Room Password";
    if (roomType === "locked") return "Request to Join";
    return "Join Room";
  };

  const getDescription = () => {
    if (requiresPassword) return "This room is password protected. Enter the password to join.";
    if (roomType === "locked") return "This room requires approval from the host. Send a join request.";
    return "Enter your details to join the room.";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {requiresPassword && <Lock className="h-5 w-5 text-warning" />}
            {getTitle()}
          </DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {requiresPassword ? (
            <div>
              <Label htmlFor="password">Room Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                className="mt-2"
              />
            </div>
          ) : (
            <>
              <div>
                <Label htmlFor="anonymousName">Display Name (Optional)</Label>
                <Input
                  id="anonymousName"
                  value={anonymousName}
                  onChange={(e) => setAnonymousName(e.target.value)}
                  placeholder="Enter your name..."
                  className="mt-2"
                />
              </div>

              {roomType === "locked" && (
                <div>
                  <Label htmlFor="message">Message (Optional)</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell the host why you want to join..."
                    className="mt-2"
                  />
                </div>
              )}
            </>
          )}

          <div className="flex gap-2">
            <Button onClick={onClose} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="flex-1">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {requiresPassword ? "Verifying..." : roomType === "locked" ? "Sending..." : "Joining..."}
                </>
              ) : (
                requiresPassword ? "Join" : roomType === "locked" ? "Send Request" : "Join"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
