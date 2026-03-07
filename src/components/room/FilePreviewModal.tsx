import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileQuestion, FileText, Film, Music, Image as ImageIcon, X, Loader2, Table, Presentation, Code, Printer } from "lucide-react";

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
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);

  if (!file) return null;

  // Extract extension for accurate matching
  const ext = file.file_name.split('.').pop()?.toLowerCase() || "";

  // Categorize files
  const isImage = file.file_type.startsWith("image/") || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
  const isVideo = file.file_type.startsWith("video/") || ['mp4', 'webm', 'ogg', 'mov', 'mkv'].includes(ext);
  const isAudio = file.file_type.startsWith("audio/") || ['mp3', 'wav', 'ogg', 'm4a'].includes(ext);
  const isPDF = file.file_type === "application/pdf" || ext === 'pdf';
  
  // Office formats
  const isWord = ['doc', 'docx', 'rtf'].includes(ext);
  const isExcel = ['xls', 'xlsx'].includes(ext); 
  const isPowerPoint = ['ppt', 'pptx'].includes(ext);
  const isOffice = isWord || isExcel || isPowerPoint;

  // Code & Text formats
  const isCode = ['sql', 'json', 'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'py', 'java', 'c', 'cpp'].includes(ext);
  const isText = file.file_type.startsWith("text/") || ['txt', 'md', 'csv'].includes(ext) || isCode;

  // Format File Size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  // Dynamic Icon Selection
  const getHeaderIcon = () => {
    if (isImage) return <ImageIcon className="h-5 w-5 text-blue-500" />;
    if (isVideo) return <Film className="h-5 w-5 text-purple-500" />;
    if (isAudio) return <Music className="h-5 w-5 text-emerald-500" />;
    if (isWord || isPDF || ext === 'txt') return <FileText className="h-5 w-5 text-blue-600" />;
    if (isExcel || ext === 'csv') return <Table className="h-5 w-5 text-emerald-600" />;
    if (isPowerPoint) return <Presentation className="h-5 w-5 text-orange-500" />;
    if (isCode) return <Code className="h-5 w-5 text-amber-500" />;
    return <FileQuestion className="h-5 w-5 text-muted-foreground" />;
  };

  // Switch to Microsoft Office Viewer
  const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(file.file_url)}`;

  const handleForceDownload = async () => {
    if (!file) return;
    setIsDownloading(true);
    try {
      const response = await fetch(file.file_url);
      if (!response.ok) throw new Error("Network response failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.file_name;
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Forced download failed, falling back to new tab:", error);
      window.open(file.file_url, "_blank");
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = async () => {
    if (!file) return;
    setIsPrinting(true);
    try {
      // Fetch the file as a blob to bypass Cross-Origin iframe print restrictions
      const response = await fetch(file.file_url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Create a hidden iframe to hold the document for printing
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);

      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          
          // Cleanup after print dialog closes
          setTimeout(() => {
            document.body.removeChild(iframe);
            URL.revokeObjectURL(blobUrl);
          }, 1000);
        }, 500); // Short delay to ensure rendering completes
      };

      if (isImage) {
        // For images, we write an HTML structure into the iframe to ensure it fills the page properly
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
        // For PDFs and Text, directly assign the blob URL
        iframe.src = blobUrl;
      }
    } catch (error) {
      console.error("Direct print failed, falling back to new tab:", error);
      window.open(file.file_url, "_blank");
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl w-[96vw] h-[96vh] p-0 overflow-hidden flex flex-col rounded-[2rem] border-white/10 bg-background/95 backdrop-blur-2xl shadow-2xl">
        
        {/* Sticky Header */}
        <div className="shrink-0 p-4 sm:p-5 border-b border-border/30 bg-muted/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 z-20">
          <DialogHeader className="text-left space-y-1 overflow-hidden pr-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-background shadow-sm border border-border/50 shrink-0">
                {getHeaderIcon()}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight truncate">
                  {file.file_name}
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm font-medium mt-1 flex items-center flex-wrap gap-2">
                  <span className="bg-muted px-2 py-0.5 rounded-md text-foreground/70 uppercase tracking-wider text-[10px] font-bold">
                    {ext || file.file_type.split('/')[1] || "FILE"}
                  </span>
                  <span>{formatFileSize(file.file_size)}</span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            
            {/* Show Print button ONLY if it's printable natively (Images, PDFs, Text/Code). 
                We hide it for Office docs because the iframe handles its own printing. */}
            {(!isVideo && !isAudio && !isOffice) && (
              <Button
                onClick={handlePrint}
                disabled={isPrinting || isDownloading}
                variant="outline"
                className="rounded-xl border-border/50 bg-background/50 backdrop-blur-md shadow-sm hover:shadow-md active:scale-95 transition-all duration-200 h-11 px-4 sm:px-5"
              >
                {isPrinting ? (
                  <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4 sm:mr-2" />
                )}
                <span className="hidden sm:inline font-semibold">{isPrinting ? "Printing..." : "Print"}</span>
              </Button>
            )}

            <Button
              onClick={handleForceDownload}
              disabled={isDownloading || isPrinting}
              className="rounded-xl shadow-md hover:shadow-lg active:scale-95 transition-all duration-200 h-11 px-4 sm:px-5"
            >
              {isDownloading ? (
                <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 sm:mr-2" />
              )}
              <span className="hidden sm:inline font-semibold">{isDownloading ? "Downloading..." : "Download"}</span>
            </Button>
            
            <div className="w-px h-6 bg-border/50 mx-1 hidden sm:block" />

            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="rounded-xl h-11 w-11 bg-muted/50 hover:bg-destructive/10 hover:text-destructive active:scale-95 transition-all duration-200 border border-transparent hover:border-destructive/20"
              title="Close Preview"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 relative min-h-0 bg-black/5 dark:bg-black/40 overflow-hidden">
          
          {isImage && (
            <img
              src={file.file_url}
              alt={file.file_name}
              className="absolute inset-0 w-full h-full object-contain p-2 sm:p-6 drop-shadow-2xl animate-in zoom-in-95 duration-300"
            />
          )}

          {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-6">
              <video 
                controls 
                className="max-w-full max-h-full w-full h-full object-contain rounded-xl shadow-2xl bg-black/90 animate-in zoom-in-95 duration-300 outline-none ring-1 ring-white/10"
                autoPlay={false}
              >
                <source src={file.file_url} type={file.file_type} />
                Your browser does not support the video tag.
              </video>
            </div>
          )}

          {isAudio && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
              <div className="w-full max-w-md p-8 rounded-[2rem] bg-background/80 backdrop-blur-xl border border-border/50 shadow-2xl flex flex-col items-center gap-8 animate-in zoom-in-95 duration-300">
                <div className="w-32 h-32 rounded-full bg-emerald-500/10 flex items-center justify-center border-4 border-emerald-500/20 animate-[spin_10s_linear_infinite]">
                  <Music className="h-14 w-14 text-emerald-500" />
                </div>
                <audio controls className="w-full h-14 outline-none" src={file.file_url}>
                  Your browser does not support the audio element.
                </audio>
              </div>
            </div>
          )}

          {/* Documents, PDF, Text, and Code rendering via iFrame */}
          {(isPDF || isText || isOffice) && (
            <div className="absolute inset-0 sm:p-4">
              {iframeLoading && isOffice && (
                <div className="absolute inset-0 flex flex-col gap-3 items-center justify-center bg-white/50 dark:bg-black/50 backdrop-blur-sm z-10 rounded-2xl">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading secure viewer...</p>
                </div>
              )}
              <iframe
                src={isOffice ? officeViewerUrl : file.file_url}
                onLoad={() => setIframeLoading(false)}
                className="w-full h-full border-0 bg-white dark:bg-[#0d1117] rounded-none sm:rounded-2xl shadow-inner sm:shadow-2xl animate-in fade-in duration-300"
                title={file.file_name}
              />
            </div>
          )}

          {/* Fallback for unsupported obscure types */}
          {!isImage && !isVideo && !isAudio && !isPDF && !isText && !isOffice && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="w-24 h-24 mx-auto mb-6 rounded-[2rem] bg-background border border-border/50 shadow-inner flex items-center justify-center">
                <FileQuestion className="h-12 w-12 text-muted-foreground/50" />
              </div>
              <h3 className="text-2xl font-bold tracking-tight text-foreground mb-3">
                No Preview Available
              </h3>
              <p className="text-base text-muted-foreground mb-8 max-w-[300px] mx-auto leading-relaxed">
                We cannot generate a native preview for this specialized file format.
              </p>
              <Button 
                onClick={handleForceDownload}
                disabled={isDownloading}
                size="lg"
                className="rounded-xl shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200 h-14 px-8 text-lg font-bold"
              >
                {isDownloading ? <Loader2 className="h-5 w-5 mr-3 animate-spin" /> : <Download className="h-5 w-5 mr-3" />}
                {isDownloading ? "Downloading..." : "Download to View"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};