import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, FileText, Loader2, Eye } from "lucide-react";
import { FilePreviewModal } from "./FilePreviewModal";

interface File {
  id: string;
  file_name: string;
  file_size: number;
  file_url: string;
  file_type: string;
  uploaded_at: string;
}

interface FileListProps {
  roomId: string;
  onFileSelect?: (fileName: string, action: "view" | "download") => void;
  selectedFile?: string | null;
}

export const FileList = ({ roomId, onFileSelect, selectedFile }: FileListProps) => {
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    loadFiles();
    setupRealtimeSubscription();
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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const openPreview = (file: File) => {
    setPreviewFile(file);
    setIsPreviewOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No files shared yet</p>
      </div>
    );
  }

  return (
    <>
      <FilePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        file={previewFile}
      />
      
      <div className="space-y-3">
      {files.map((file) => (
        <div
          key={file.id}
          className={`flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors ${
            selectedFile === file.file_name ? 'ring-2 ring-primary bg-accent/30' : ''
          }`}
        >
          <div className="flex-1 min-w-0 mr-4">
            <p className="font-medium text-foreground truncate">{file.file_name}</p>
            <p className="text-sm text-muted-foreground">
              {formatFileSize(file.file_size)} • {formatDate(file.uploaded_at)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                onFileSelect?.(file.file_name, "view");
                openPreview(file);
              }}
              size="sm"
              variant="outline"
            >
              <Eye className="h-4 w-4 mr-2" />
              View
            </Button>
            <Button
              onClick={() => {
                onFileSelect?.(file.file_name, "download");
                window.open(file.file_url, "_blank");
              }}
              size="sm"
              variant="outline"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      ))}
      </div>
    </>
  );
};
