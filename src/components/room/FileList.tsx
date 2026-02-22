import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { 
  Download, 
  FileText, 
  Loader2, 
  Eye, 
  Trash2, 
  Search, 
  X, 
  AlertTriangle,
  Image as ImageIcon,
  Film,
  Archive,
  LayoutGrid,
  File,
  Music,
  FileSpreadsheet,
  Presentation
} from "lucide-react";
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
  refreshTrigger?: number;
}

type FilterCategory = "all" | "pdf" | "word" | "excel" | "powerpoint" | "images" | "video" | "audio" | "archives" | "text" | "other";

export const FileList = ({ roomId, userId, isHost, onFileSelect, selectedFile, refreshTrigger }: FileListProps) => {
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterCategory>("all");
  
  // Delete State
  const [deleteFile, setDeleteFile] = useState<File | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadFiles();
    const cleanup = setupRealtimeSubscription();
    return cleanup;
  }, [roomId, refreshTrigger]);

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
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            setFiles(prev => [payload.new as File, ...prev]);
          } else if (payload.eventType === 'DELETE' && payload.old) {
            setFiles(prev => prev.filter(f => f.id !== payload.old.id));
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            setFiles(prev => prev.map(f => f.id === payload.new.id ? payload.new as File : f));
          }
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
      const { error: storageError } = await supabase.storage
        .from("room-files")
        .remove([file.file_path]);

      if (storageError) throw storageError;

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

  // Helper to categorize files for filtering
  const getFileCategory = (fileType: string, fileName: string): FilterCategory => {
    const type = fileType.toLowerCase();
    const ext = fileName.split('.').pop()?.toLowerCase() || '';

    // PDF files
    if (type === "application/pdf" || ext === "pdf") return "pdf";

    // Microsoft Office files
    if (type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
        type === "application/msword" || 
        ext === "doc" || ext === "docx") return "word";
    
    if (type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || 
        type === "application/vnd.ms-excel" || 
        ext === "xls" || ext === "xlsx") return "excel";
    
    if (type === "application/vnd.openxmlformats-officedocument.presentationml.presentation" || 
        type === "application/vnd.ms-powerpoint" || 
        ext === "ppt" || ext === "pptx") return "powerpoint";

    // Images
    if (type.startsWith("image/")) return "images";

    // Video
    if (type.startsWith("video/")) return "video";

    // Audio
    if (type.startsWith("audio/")) return "audio";

    // Archives
    if (type.includes("zip") || type.includes("archive") || type.includes("tar") || type.includes("rar") || 
        ext === "zip" || ext === "rar" || ext === "7z" || ext === "tar" || ext === "gz") return "archives";

    // Text files
    if (type.startsWith("text/") || type === "application/json" || 
        ext === "txt" || ext === "md" || ext === "json" || ext === "xml" || ext === "csv") return "text";

    return "other"; // Default fallback
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

  // Combine Search + Category Filtering
  const filteredFiles = files.filter(file => {
    const query = searchQuery.toLowerCase();
    const fileName = file.file_name.toLowerCase();
    const fileExt = file.file_name.split('.').pop()?.toLowerCase() || '';
    
    // Search by filename or extension
    const matchesSearch = fileName.includes(query) || 
                         (query.startsWith('.') && fileExt === query.slice(1)) || 
                         fileExt.includes(query);
    
    if (!matchesSearch) return false;
    
    if (activeFilter === "all") return true;
    return getFileCategory(file.file_type, file.file_name) === activeFilter;
  });

  const filterTabs = [
    { id: "all", label: "All Files", icon: LayoutGrid },
    { id: "pdf", label: "PDF", icon: FileText },
    { id: "word", label: "Word", icon: FileText },
    { id: "excel", label: "Excel", icon: FileSpreadsheet },
    { id: "powerpoint", label: "PowerPoint", icon: Presentation },
    { id: "images", label: "Images", icon: ImageIcon },
    { id: "video", label: "Video", icon: Film },
    { id: "audio", label: "Audio", icon: Music },
    { id: "archives", label: "Archives", icon: Archive },
    { id: "text", label: "Text", icon: File },
    { id: "other", label: "Other", icon: File },
  ] as const;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
        <p className="text-sm font-medium text-muted-foreground tracking-wide uppercase">Syncing files...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-background/30 rounded-2xl">
      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteFile} onOpenChange={() => setDeleteFile(null)}>
        <AlertDialogContent className="rounded-3xl border-white/10 bg-background/95 backdrop-blur-2xl shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              Delete File
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Are you sure you want to delete <span className="font-bold text-foreground">"{deleteFile?.file_name}"</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0 mt-4">
            <AlertDialogCancel disabled={isDeleting} className="rounded-xl h-11 px-6">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteFile && handleDeleteFile(deleteFile)}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl h-11 px-6 shadow-md shadow-destructive/20"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FilePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        file={previewFile}
      />

      {/* Header / Search & Filter Area (Fixed at top) */}
      <div className="shrink-0 p-4 border-b border-border/30 bg-card/50 backdrop-blur-md rounded-t-2xl z-10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold tracking-tight uppercase text-foreground">File Directory</h3>
            <span className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full border border-primary/20">
              {filteredFiles.length}
            </span>
          </div>
          
          {files.length > 0 && (
            <div className="relative w-full sm:w-72 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Search by name or extension (.pdf, .doc)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9 h-10 rounded-xl bg-background border-border/50 hover:border-border focus-visible:ring-2 focus-visible:ring-primary/30 transition-all shadow-sm font-medium"
              />
              {searchQuery && (
                <button
                  data-shortcut="clear-search"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Smart Filter Pills */}
        {files.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-2 px-2 custom-scrollbar hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {filterTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeFilter === tab.id;
              
              // Only show filter tab if files of that category exist (except for 'all')
              const hasFilesInCategory = tab.id === "all" || files.some(f => getFileCategory(f.file_type, f.file_name) === tab.id);
              if (!hasFilesInCategory) return null;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id as FilterCategory)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 active:scale-95 whitespace-nowrap shrink-0 border ${
                    isActive 
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20' 
                      : 'bg-muted/50 text-muted-foreground border-border/40 hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? 'opacity-100' : 'opacity-70'}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Scrollable File List */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 custom-scrollbar">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[250px] text-center px-4 animate-in fade-in duration-500">
            <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-5 border border-border/50 shadow-inner">
              <FileText className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-foreground font-bold text-xl tracking-tight">No files shared yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-[200px]">Upload a document, image, or archive to begin collaboration.</p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center text-muted-foreground animate-in fade-in duration-300">
            <Search className="h-10 w-10 mb-3 opacity-20" />
            <p className="font-semibold text-foreground">No matches found</p>
            <p className="text-sm mt-1">Try adjusting your search or filter.</p>
            {(searchQuery || activeFilter !== "all") && (
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-4 rounded-full h-8 px-4"
                onClick={() => { setSearchQuery(""); setActiveFilter("all"); }}
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredFiles.map((file, index) => (
              <div
                key={file.id}
                className="animate-in fade-in slide-in-from-bottom-2"
                style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
              >
                <div className={`group flex items-center gap-3 sm:gap-4 p-3 rounded-2xl border transition-all duration-200 hover:-translate-y-[1px] ${
                  selectedFile === file.file_name 
                    ? 'border-primary/50 bg-primary/5 shadow-md' 
                    : 'border-border/40 bg-card/80 hover:bg-card hover:border-border/80 hover:shadow-sm'
                }`}>
                  {/* File Icon */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 shadow-inner transition-colors ${
                    selectedFile === file.file_name ? 'bg-background border border-primary/20' : 'bg-muted/40 border border-border/30 group-hover:bg-background'
                  }`}>
                    {getFileIcon(file.file_type)}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0 py-1">
                    <p className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors duration-200">
                      {file.file_name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] font-semibold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md">
                        {formatFileSize(file.file_size)}
                      </span>
                      <span className="text-[11px] font-medium text-muted-foreground/70">
                        {formatDate(file.uploaded_at)}
                      </span>
                    </div>
                  </div>

                  {/* Actions (Always visible on mobile, hover on desktop) */}
                  <div className="flex items-center gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0">
                    <Button
                      onClick={() => {
                        onFileSelect?.(file.file_name, "view");
                        setPreviewFile(file);
                        setIsPreviewOpen(true);
                      }}
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary active:scale-95 transition-all"
                      title="Preview"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => {
                        onFileSelect?.(file.file_name, "download");
                        window.open(file.file_url, "_blank");
                      }}
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary active:scale-95 transition-all"
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      onClick={() => setDeleteFile(file)}
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:scale-95 transition-all sm:ml-1"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};