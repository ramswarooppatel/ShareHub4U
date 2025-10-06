import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: {
    file_name: string;
    file_url: string;
    file_type: string;
    file_size: number;
  } | null;
}

export const FilePreviewModal = ({ isOpen, onClose, file }: FilePreviewModalProps) => {
  if (!file) return null;

  const isImage = file.file_type.startsWith("image/");
  const isPDF = file.file_type === "application/pdf";
  const isText = file.file_type.startsWith("text/") || 
                 file.file_type === "application/json" ||
                 file.file_name.endsWith(".md");

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{file.file_name}</DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => window.open(file.file_url, "_blank")}
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatFileSize(file.file_size)} • {file.file_type}
          </p>
        </DialogHeader>

        <div className="mt-4">
          {isImage && (
            <img
              src={file.file_url}
              alt={file.file_name}
              className="w-full h-auto rounded-lg"
            />
          )}

          {isPDF && (
            <iframe
              src={file.file_url}
              className="w-full h-[600px] rounded-lg border border-border"
              title={file.file_name}
            />
          )}

          {isText && (
            <iframe
              src={file.file_url}
              className="w-full h-[600px] rounded-lg border border-border bg-card"
              title={file.file_name}
            />
          )}

          {!isImage && !isPDF && !isText && (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                Preview not available for this file type.
              </p>
              <Button onClick={() => window.open(file.file_url, "_blank")}>
                <Download className="h-4 w-4 mr-2" />
                Download to view
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
