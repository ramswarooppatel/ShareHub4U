import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Shield } from "lucide-react";

interface HostAuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onVerify: (username: string, passcode: string) => Promise<boolean>;
}

export const HostAuthDialog = ({ isOpen, onClose, onVerify }: HostAuthDialogProps) => {
  const [username, setUsername] = useState("");
  const [passcode, setPasscode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async () => {
    setError("");
    setVerifying(true);
    try {
      const success = await onVerify(username, passcode);
      if (!success) {
        setError("Invalid credentials");
      }
    } catch (err) {
      setError("Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Host Verification Required
          </DialogTitle>
          <DialogDescription>
            Enter your credentials to manage join requests.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username..."
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="passcode">Passphrase</Label>
            <Input
              id="passcode"
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter your passphrase..."
              className="mt-2"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex gap-2">
            <Button onClick={onClose} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleVerify} disabled={verifying || !username || !passcode} className="flex-1">
              {verifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
