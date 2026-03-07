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
  Presentation,
  Printer
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
  
  // Delete & Zip & Print State
  const [deleteFile, setDeleteFile] = useState<File | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState<number | null>(null);
  const [printingFileId, setPrintingFileId] = useState<string | null>(null);

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

      toast({ title: "File deleted", description: `${file.file_name} has been removed.`, className: "rounded-full" });
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

  const handleDownloadZip = async () => {
    if (filteredFiles.length === 0) return;
    setZipping(true);
    setZipProgress(0);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      for (let i = 0; i < filteredFiles.length; i++) {
        const f = filteredFiles[i];
        try {
          const res = await fetch(f.file_url);
          const blob = await res.blob();
          zip.file(f.file_name, blob);
        } catch (err) {
          console.error(`Failed to fetch ${f.file_name} for zipping`, err);
        }
        setZipProgress(Math.round(((i + 1) / filteredFiles.length) * 100));
      }

      const content = await zip.generateAsync({ type: 'blob' }, (metadata: any) => {
        if (Math.round(metadata.percent) % 5 === 0) {
          setZipProgress(Math.round(metadata.percent));
        }
      });

      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Workspace_${roomId}_Files.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      
      toast({ title: "ZIP Downloaded!", description: "All files successfully archived.", className: "rounded-full" });
    } catch (err: any) {
      toast({ title: 'Error creating ZIP', description: err?.message || String(err), variant: 'destructive' });
    } finally {
      setZipping(false);
      setZipProgress(null);
    }
  };

  const handlePrintFile = async (file: File) => {
    setPrintingFileId(file.id);
    toast({ title: "Preparing document...", description: "Opening print dialog shortly.", className: "rounded-full" });
    try {
      const response = await fetch(file.file_url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);

      const isImage = file.file_type.startsWith("image/");

      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          
          setTimeout(() => {
            document.body.removeChild(iframe);
            URL.revokeObjectURL(blobUrl);
          }, 1000);
        }, 500);
      };

      if (isImage) {
        iframe.contentDocument?.write(`
          <html>
            <head><title>Print - ${file.file_name}</title></head>
            <body style="margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh;">
              <img src="${blobUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
            </body>
          </html>
        `);
        iframe.contentDocument?.close();
      } else {
        iframe.src = blobUrl;
      }
    } catch (error) {
      console.error("Direct print failed:", error);
      toast({ title: "Print failed", description: "Falling back to new tab.", variant: "destructive" });
      window.open(file.file_url, "_blank");
    } finally {
      setPrintingFileId(null);
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

  // Helper to check if file can be natively printed via browser iframe
  const isPrintable = (file: File) => {
    const type = file.file_type.toLowerCase();
    const ext = file.file_name.split('.').pop()?.toLowerCase() || '';
    const isImage = type.startsWith("image/");
    const isPDF = type === "application/pdf" || ext === "pdf";
    const isCode = ['sql', 'json', 'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'py', 'java', 'c', 'cpp'].includes(ext);
    const isText = type.startsWith("text/") || ['txt', 'md', 'csv'].includes(ext) || isCode;
    return isImage || isPDF || isText;
  };

  const getFileCategory = (fileType: string, fileName: string): FilterCategory => {
    const type = fileType.toLowerCase();
    const ext = fileName.split('.').pop()?.toLowerCase() || '';

    if (type === "application/pdf" || ext === "pdf") return "pdf";
    if (type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || type === "application/msword" || ext === "doc" || ext === "docx") return "word";
    if (type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || type === "application/vnd.ms-excel" || ext === "xls" || ext === "xlsx") return "excel";
    if (type === "application/vnd.openxmlformats-officedocument.presentationml.presentation" || type === "application/vnd.ms-powerpoint" || ext === "ppt" || ext === "pptx") return "powerpoint";
    if (type.startsWith("image/")) return "images";
    if (type.startsWith("video/")) return "video";
    if (type.startsWith("audio/")) return "audio";
    if (type.includes("zip") || type.includes("archive") || type.includes("tar") || type.includes("rar") || ext === "zip" || ext === "rar" || ext === "7z" || ext === "tar" || ext === "gz") return "archives";
    if (type.startsWith("text/") || type === "application/json" || ext === "txt" || ext === "md" || ext === "json" || ext === "xml" || ext === "csv") return "text";
    return "other";
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

  const filteredFiles = files.filter(file => {
    const query = searchQuery.toLowerCase();
    const fileName = file.file_name.toLowerCase();
    const fileExt = file.file_name.split('.').pop()?.toLowerCase() || '';
    
    const matchesSearch = fileName.includes(query) || (query.startsWith('.') && fileExt === query.slice(1)) || fileExt.includes(query);
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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs font-bold text-muted-foreground tracking-widest uppercase">Syncing files...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-transparent rounded-[2rem]">
      
      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteFile} onOpenChange={() => setDeleteFile(null)}>
        <AlertDialogContent className="rounded-[2rem] border-white/10 bg-background/95 backdrop-blur-2xl shadow-2xl p-6 sm:p-8">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-3 text-xl font-extrabold">
              <div className="p-3 rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              Delete File
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base font-medium mt-4 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-foreground">"{deleteFile?.file_name}"</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 sm:gap-4 mt-6">
            <AlertDialogCancel disabled={isDeleting} className="rounded-full h-12 px-6 font-bold border-border/50 bg-muted/50 hover:bg-muted">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteFile && handleDeleteFile(deleteFile)}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full h-12 px-6 shadow-lg active:scale-95 transition-all font-bold"
            >
              {isDeleting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
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

      {/* Header / Search & Filter Area (Glassy Top) */}
      <div className="shrink-0 p-4 sm:p-6 border-b border-white/10 dark:border-white/5 bg-white/20 dark:bg-black/10 backdrop-blur-2xl rounded-t-[2rem] z-10 space-y-5">
        
        {/* Top Action Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
              <Archive className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-base sm:text-lg font-extrabold tracking-tight text-foreground">Directory</h3>
            <span className="text-xs font-bold bg-background text-foreground px-2.5 py-0.5 rounded-full border border-border/50 shadow-sm">
              {filteredFiles.length}
            </span>
          </div>
          
          {files.length > 0 && (
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* Search Bar */}
              <div className="relative flex-1 sm:w-64 group">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-10 h-12 rounded-full bg-background/50 backdrop-blur-md border-border/50 hover:border-border focus-visible:ring-2 focus-visible:ring-primary/30 transition-all shadow-sm font-semibold"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* DOWNLOAD ALL ZIP BUTTON */}
              <Button
                onClick={handleDownloadZip}
                disabled={zipping || filteredFiles.length === 0}
                className="h-12 rounded-full px-5 font-bold shadow-md hover:shadow-lg active:scale-95 transition-all shrink-0"
              >
                {zipping ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {zipProgress}%</>
                ) : (
                  <><Download className="h-4 w-4 mr-2 stroke-[3px]" /> <span className="hidden sm:inline">Zip All</span><span className="sm:hidden">Zip</span></>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Smart Filter Pills */}
        {files.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-2 px-2 custom-scrollbar hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {filterTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeFilter === tab.id;
              
              const hasFilesInCategory = tab.id === "all" || files.some(f => getFileCategory(f.file_type, f.file_name) === tab.id);
              if (!hasFilesInCategory) return null;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id as FilterCategory)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 active:scale-95 whitespace-nowrap shrink-0 border ${
                    isActive 
                      ? 'bg-primary text-primary-foreground border-primary shadow-md' 
                      : 'bg-background/40 backdrop-blur-md text-muted-foreground border-border/40 hover:bg-background/80 hover:text-foreground hover:border-border'
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
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-background/20">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center px-4 animate-in fade-in zoom-in-95 duration-500">
            <div className="w-20 h-20 rounded-full bg-muted/40 flex items-center justify-center mb-6 border border-border/50 shadow-inner">
              <Archive className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <p className="text-foreground font-extrabold text-2xl tracking-tight mb-2">No files shared yet</p>
            <p className="text-base text-muted-foreground max-w-xs leading-relaxed">Upload a document, image, or archive to begin collaboration.</p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[250px] text-center text-muted-foreground animate-in fade-in duration-300">
            <Search className="h-12 w-12 mb-4 opacity-20" />
            <p className="font-bold text-lg text-foreground mb-1">No matches found</p>
            <p className="text-sm font-medium">Try adjusting your search or filter.</p>
            {(searchQuery || activeFilter !== "all") && (
              <Button 
                variant="outline" 
                className="mt-6 rounded-full h-10 px-6 font-bold border-border/50 bg-background/50 shadow-sm"
                onClick={() => { setSearchQuery(""); setActiveFilter("all"); }}
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            {filteredFiles.map((file, index) => (
              <div
                key={file.id}
                className="animate-in fade-in zoom-in-[0.98] duration-300"
                style={{ animationDelay: `${index * 30}ms`, animationFillMode: 'both' }}
              >
                <div className={`group flex flex-col p-4 rounded-3xl border transition-all duration-300 hover:-translate-y-1 ${
                  selectedFile === file.file_name 
                    ? 'border-primary/50 bg-primary/5 shadow-md' 
                    : 'border-white/20 dark:border-white/5 bg-white/40 dark:bg-zinc-800/40 backdrop-blur-xl hover:bg-white/60 dark:hover:bg-zinc-700/60 hover:shadow-lg'
                }`}>
                  
                  {/* Top Row: Icon & Actions */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 shadow-inner bg-background border border-border/50">
                      {getFileIcon(file.file_type)}
                    </div>
                    
                    <div className="flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300 bg-background/80 backdrop-blur-md p-1.5 rounded-full border border-border/50 shadow-sm">
                      <Button
                        onClick={() => { onFileSelect?.(file.file_name, "view"); setPreviewFile(file); setIsPreviewOpen(true); }}
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary active:scale-95 transition-all"
                        title="Preview"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      
                      {isPrintable(file) && (
                        <Button
                          onClick={() => handlePrintFile(file)}
                          disabled={printingFileId === file.id}
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary active:scale-95 transition-all"
                          title="Print"
                        >
                          {printingFileId === file.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                        </Button>
                      )}

                      <Button
                        onClick={() => { onFileSelect?.(file.file_name, "download"); window.open(file.file_url, "_blank"); }}
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary active:scale-95 transition-all"
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        onClick={() => setDeleteFile(file)}
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:scale-95 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Bottom Row: Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-base text-foreground truncate group-hover:text-primary transition-colors duration-200 mb-2">
                      {file.file_name}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold text-muted-foreground bg-muted/60 px-2 py-1 rounded-md uppercase tracking-wider">
                        {formatFileSize(file.file_size)}
                      </span>
                      <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
                        {formatDate(file.uploaded_at)}
                      </span>
                    </div>
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