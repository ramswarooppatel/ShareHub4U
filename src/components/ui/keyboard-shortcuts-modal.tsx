import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Keyboard, Command } from "lucide-react";

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  description: string;
  context?: string;
}

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: KeyboardShortcut[];
}

const formatShortcut = (shortcut: KeyboardShortcut): string => {
  const parts: string[] = [];

  if (shortcut.ctrl) parts.push('Ctrl');
  if (shortcut.alt) parts.push('Alt');
  if (shortcut.shift) parts.push('Shift');
  if (shortcut.meta) parts.push('Cmd');

  parts.push(shortcut.key.toUpperCase());

  return parts.join(' + ');
};

const groupShortcutsByContext = (shortcuts: KeyboardShortcut[]) => {
  const groups: Record<string, KeyboardShortcut[]> = {};

  shortcuts.forEach(shortcut => {
    const context = shortcut.context || 'General';
    if (!groups[context]) {
      groups[context] = [];
    }
    groups[context].push(shortcut);
  });

  return groups;
};

export const KeyboardShortcutsModal = ({ isOpen, onClose, shortcuts }: KeyboardShortcutsModalProps) => {
  const groupedShortcuts = groupShortcutsByContext(shortcuts);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Press the key combinations below to quickly access features throughout the app.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {Object.entries(groupedShortcuts).map(([context, contextShortcuts]) => (
            <div key={context}>
              <h3 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wider">
                {context}
              </h3>
              <div className="space-y-2">
                {contextShortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-sm text-foreground">{shortcut.description}</span>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {formatShortcut(shortcut)}
                    </Badge>
                  </div>
                ))}
              </div>
              {context !== Object.keys(groupedShortcuts)[Object.keys(groupedShortcuts).length - 1] && (
                <Separator className="mt-4" />
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 p-3 bg-muted/20 rounded-lg border border-border/50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Command className="h-4 w-4" />
            <span>Tip: Shortcuts are disabled when typing in text fields</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};