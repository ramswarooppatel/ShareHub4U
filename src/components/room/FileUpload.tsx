import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, FileUp, X, ClipboardPaste, Check } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface FileUploadProps {
  roomId: string;
  userId: string;
  disabled?: boolean;
  onFileUploaded?: () => void;
}

interface FileWithProgress {
  file: File;
  progress: number;
  uploading: boolean;
  error?: string;
}

export const FileUpload = ({ roomId, userId, disabled, onFileUploaded }: FileUploadProps) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileWithProgress[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles: FileWithProgress[] = [];

    for (const file of fileArray) {
      if (file.size > 50 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds the 50MB limit`,
          variant: "destructive",
        });
        continue;
      }

      // Check for duplicates
      const isDuplicate = selectedFiles.some(f => f.file.name === file.name && f.file.size === file.size);
      if (isDuplicate) {
        toast({
          title: "Duplicate file",
          description: `${file.name} is already selected`,
          variant: "destructive",
        });
        continue;
      }

      validFiles.push({
        file,
        progress: 0,
        uploading: false,
      });
    }

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  // Handle standard paste shortcut (Ctrl+V / Cmd+V)
  const handlePaste = (e: ClipboardEvent | React.ClipboardEvent<HTMLDivElement>) => {
    try {
      const clipboardData = (e as any).clipboardData || (window as any).clipboardData;
      if (!clipboardData) return;

      if (clipboardData.files && clipboardData.files.length > 0) {
        handleFileSelect(clipboardData.files);
        return;
      }

      const items = clipboardData.items || [];
      const files: File[] = [];
      for (const item of items) {
        if (item && item.kind === 'file' && item.type && item.type.startsWith('image')) {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }

      if (files.length > 0) {
        handleFileSelect(files);
      }
    } catch (err) {
      // no-op
    }
  };

  // Explicit Button to read from Clipboard
  const handlePasteFromButton = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the dropzone's file picker
    try {
      const clipboardItems = await navigator.clipboard.read();
      const files: File[] = [];

      for (const item of clipboardItems) {
        // Look for image formats in the clipboard
        const imageTypes = item.types.filter(type => type.startsWith('image/'));
        for (const type of imageTypes) {
          const blob = await item.getType(type);
          const ext = type.split('/')[1] || 'png';
          // Create a File object from the blob
          const file = new File([blob], `pasted-image-${Date.now()}.${ext}`, { type });
          files.push(file);
        }
      }

      if (files.length > 0) {
        handleFileSelect(files);
        toast({ title: "Pasted from clipboard!" });
      } else {
        toast({
          title: "Nothing to paste",
          description: "No supported files (like images) found in your clipboard.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Clipboard read error:", err);
      toast({
        title: "Clipboard Error",
        description: "Please allow clipboard permissions, or use Ctrl+V to paste.",
        variant: "destructive",
      });
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const uploadFile = async () => {
    if (selectedFiles.length === 0) return;
    setUploading(true);

    for (let i = 0; i < selectedFiles.length; i++) {
      const fileWithProgress = selectedFiles[i];

      setSelectedFiles(prev => prev.map((f, idx) =>
        idx === i ? { ...f, uploading: true, progress: 0 } : f
      ));

      try {
        const fileExt = fileWithProgress.file.name.split(".").pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${roomId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("room-files")
          .upload(filePath, fileWithProgress.file);

        if (uploadError) throw uploadError;

        setSelectedFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, progress: 50 } : f
        ));

        const { data: urlData } = supabase.storage
          .from("room-files")
          .getPublicUrl(filePath);

        const { error: dbError } = await supabase.from("room_files").insert({
          room_id: roomId,
          uploaded_by: userId,
          file_name: fileWithProgress.file.name,
          file_type: fileWithProgress.file.type,
          file_size: fileWithProgress.file.size,
          file_url: urlData.publicUrl,
          file_path: filePath,
          is_viewable: true,
        });

        if (dbError) throw dbError;

        onFileUploaded?.();

        setSelectedFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, progress: 100, uploading: false } : f
        ));

      } catch (error: any) {
        setSelectedFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, uploading: false, error: error.message } : f
        ));
      }
    }

    const successfulUploads = selectedFiles.filter(f => f.progress === 100);
    if (successfulUploads.length > 0) {
      toast({
        title: "Files uploaded!",
        description: `${successfulUploads.length} file${successfulUploads.length > 1 ? 's' : ''} shared successfully.`,
      });
    }

    setTimeout(() => {
      setSelectedFiles(prev => prev.filter(f => f.progress !== 100));
    }, 2000);

    setUploading(false);
  };

  return (
    <div className="space-y-3">
      {selectedFiles.length === 0 ? (
        <div
          data-shortcut="upload-files"
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onPaste={handlePaste}
          onClick={() => !disabled && inputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-[1.5rem] p-8 sm:p-10 text-center cursor-pointer transition-all duration-300 ${
            dragActive
              ? "border-primary bg-primary/5 scale-[1.02]"
              : "border-border/50 hover:border-primary/50 hover:bg-muted/30"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            onChange={handleInputChange}
            disabled={disabled || uploading}
            className="hidden"
          />
          <div className={`p-4 rounded-full mb-4 transition-colors duration-300 ${dragActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
            <FileUp className="h-8 w-8 sm:h-10 sm:w-10" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-1">
            {dragActive ? "Drop files to upload" : "Click or drag files"}
          </h3>
          <p className="text-xs font-medium text-muted-foreground mb-6">
            Max 50MB per file • Multiple files supported
          </p>

          {!disabled && !dragActive && (
            <Button 
              type="button"
              variant="secondary" 
              onClick={handlePasteFromButton}
              className="rounded-full shadow-sm hover:shadow-md active:scale-95 transition-all text-xs font-bold px-5 h-10"
            >
              <ClipboardPaste className="h-4 w-4 mr-2" /> Paste from Clipboard
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* File List */}
          <div className="max-h-64 overflow-y-auto space-y-2 custom-scrollbar pr-1">
            {selectedFiles.map((fileWithProgress, index) => (
              <div
                key={index}
                className={`flex items-center gap-3 p-3 rounded-2xl border transition-all duration-200 ${
                  fileWithProgress.error
                    ? "border-destructive/50 bg-destructive/5"
                    : fileWithProgress.progress === 100
                    ? "border-green-500/50 bg-green-500/5"
                    : "border-border/50 bg-muted/20"
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  fileWithProgress.error
                    ? "bg-destructive/10"
                    : fileWithProgress.progress === 100
                    ? "bg-green-500/10"
                    : "bg-primary/10 shadow-inner"
                }`}>
                  {fileWithProgress.error ? (
                    <X className="h-5 w-5 text-destructive" />
                  ) : fileWithProgress.progress === 100 ? (
                    <Check className="h-5 w-5 text-green-600" />
                  ) : (
                    <FileUp className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold truncate ${
                    fileWithProgress.error ? "text-destructive" : "text-foreground"
                  }`}>
                    {fileWithProgress.file.name}
                  </p>
                  <p className="text-[11px] font-semibold text-muted-foreground mt-0.5">
                    {(fileWithProgress.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  {fileWithProgress.uploading && (
                    <div className="mt-2.5">
                      <Progress value={fileWithProgress.progress} className="h-1.5" />
                    </div>
                  )}
                  {fileWithProgress.error && (
                    <p className="text-xs font-semibold text-destructive mt-1.5">{fileWithProgress.error}</p>
                  )}
                </div>
                {!fileWithProgress.uploading && fileWithProgress.progress !== 100 && (
                  <Button
                    onClick={() => removeFile(index)}
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground hidden sm:inline-block">
                {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''}
              </span>
              {selectedFiles.length > 1 && (
                <Button
                  onClick={clearAllFiles}
                  size="sm"
                  variant="ghost"
                  className="h-8 px-3 rounded-full text-xs font-bold text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  disabled={uploading}
                >
                  Clear All
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Secondary Paste Button */}
              <Button
                type="button"
                onClick={handlePasteFromButton}
                size="icon"
                variant="outline"
                disabled={uploading}
                className="rounded-full h-10 w-10"
                title="Paste from Clipboard"
              >
                <ClipboardPaste className="h-4 w-4 text-muted-foreground" />
              </Button>
              
              <Button
                onClick={() => {
                  setSelectedFiles([]);
                  if (inputRef.current) inputRef.current.value = "";
                }}
                size="sm"
                variant="outline"
                disabled={uploading}
                className="rounded-full h-10 px-4 font-bold text-xs"
              >
                Add More
              </Button>
              <Button
                onClick={uploadFile}
                disabled={uploading || selectedFiles.every(f => f.progress === 100)}
                size="sm"
                className="rounded-full h-10 px-5 font-bold shadow-md hover:shadow-lg active:scale-95 transition-all"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Upload
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};