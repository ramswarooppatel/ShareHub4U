import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Download, FileText, Loader2, Eye, Trash2, Search, X, AlertTriangle } from "lucide-react";
import { FilePreviewModal } from "./FilePreviewModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface File {
  id: string;
  file_name: string;
  file_size: number;
  file_url: string;
  file_type: string;
  file_path: string;
  uploaded_at: string;
  uploaded_by: string | null;
}

interface FileListProps {
  roomId: string;
  userId?: string;
  isHost?: boolean;
  onFileSelect?: (fileName: string, action: "view" | "download") => void;
  selectedFile?: string | null;
}

export const FileList = ({ roomId, userId, isHost, onFileSelect, selectedFile }: FileListProps) => {
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteFile, setDeleteFile] = useState<File | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadFiles();
    const cleanup = setupRealtimeSubscription();
    return cleanup;
  }, [roomId]);

  const loadFiles = async () => {
    try {
      const { data, error } = await supabase
        .from("room_files")
        .select("*")
        .eq("room_id", roomId)
        .eq("is_viewable", true)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading files",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('file-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_files',
          filter: `room_id=eq.${roomId}`
        },
        () => {
          loadFiles();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleDeleteFile = async (file: File) => {
    setIsDeleting(true);
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("room-files")
        .remove([file.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("room_files")
        .delete()
        .eq("id", file.id);

      if (dbError) throw dbError;

      toast({ title: "File deleted", description: `${file.file_name} has been removed.` });
      setDeleteFile(null);
    } catch (error: any) {
      toast({
        title: "Error deleting file",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) return "🖼️";
    if (fileType === "application/pdf") return "📄";
    if (fileType.startsWith("video/")) return "🎬";
    if (fileType.startsWith("audio/")) return "🎵";
    if (fileType.includes("zip") || fileType.includes("archive")) return "📦";
    if (fileType.includes("spreadsheet") || fileType.includes("csv")) return "📊";
    if (fileType.includes("document") || fileType.includes("word")) return "📝";
    return "📎";
  };

  const filteredFiles = files.filter(file =>
    file.file_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
          <p className="text-sm text-muted-foreground">Loading files...</p>
        </div>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
          <FileText className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <p className="text-muted-foreground font-medium">No files shared yet</p>
        <p className="text-sm text-muted-foreground/70 mt-1">Upload a file to get started</p>
      </div>
    );
  }

  return (
    <>
      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteFile} onOpenChange={() => setDeleteFile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete File
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold text-foreground">"{deleteFile?.file_name}"</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteFile && handleDeleteFile(deleteFile)}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FilePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        file={previewFile}
      />

      <div className="space-y-3">
        {/* Search Bar */}
        {files.length > 2 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9 h-9 bg-background/50 border-border/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* File Count */}
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>{filteredFiles.length} file{filteredFiles.length !== 1 ? 's' : ''}</span>
          {searchQuery && <span>matching "{searchQuery}"</span>}
        </div>

        {/* File List */}
        {filteredFiles.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No files match your search</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                className={`group flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-background/50 hover:bg-accent/30 hover:border-border transition-all duration-200 ${
                  selectedFile === file.file_name ? 'ring-2 ring-primary/50 bg-primary/5 border-primary/30' : ''
                }`}
              >
                {/* File Icon */}
                <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center text-lg flex-shrink-0">
                  {getFileIcon(file.file_type)}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">{file.file_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatFileSize(file.file_size)} · {formatDate(file.uploaded_at)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <Button
                    onClick={() => {
                      onFileSelect?.(file.file_name, "view");
                      setPreviewFile(file);
                      setIsPreviewOpen(true);
                    }}
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    title="Preview"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => {
                      onFileSelect?.(file.file_name, "download");
                      window.open(file.file_url, "_blank");
                    }}
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {(isHost || file.uploaded_by === userId) && (
                    <Button
                      onClick={() => setDeleteFile(file)}
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};
