import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, FileUp, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface FileUploadProps {
  roomId: string;
  userId: string;
  disabled?: boolean;
}

interface FileWithProgress {
  file: File;
  progress: number;
  uploading: boolean;
  error?: string;
}

export const FileUpload = ({ roomId, userId, disabled }: FileUploadProps) => {
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

    // Upload files sequentially to avoid overwhelming the server
    for (let i = 0; i < selectedFiles.length; i++) {
      const fileWithProgress = selectedFiles[i];

      // Mark as uploading
      setSelectedFiles(prev => prev.map((f, idx) =>
        idx === i ? { ...f, uploading: true, progress: 0 } : f
      ));

      try {
        const fileExt = fileWithProgress.file.name.split(".").pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${roomId}/${fileName}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("room-files")
          .upload(filePath, fileWithProgress.file);

        if (uploadError) throw uploadError;

        // Update progress to 50%
        setSelectedFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, progress: 50 } : f
        ));

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("room-files")
          .getPublicUrl(filePath);

        // Insert into database
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

        // Mark as completed
        setSelectedFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, progress: 100, uploading: false } : f
        ));

      } catch (error: any) {
        // Mark as error
        setSelectedFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, uploading: false, error: error.message } : f
        ));
      }
    }

    // Show success message for successfully uploaded files
    const successfulUploads = selectedFiles.filter(f => f.progress === 100);
    if (successfulUploads.length > 0) {
      toast({
        title: "Files uploaded!",
        description: `${successfulUploads.length} file${successfulUploads.length > 1 ? 's' : ''} shared successfully.`,
      });
    }

    // Remove successfully uploaded files after a delay
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
          onClick={() => !disabled && inputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
            dragActive
              ? "border-primary bg-primary/5 scale-[1.01]"
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
          <FileUp className={`h-8 w-8 mx-auto mb-2 transition-colors ${
            dragActive ? "text-primary" : "text-muted-foreground/50"
          }`} />
          <p className="text-sm font-medium text-foreground">
            {dragActive ? "Drop files here" : "Click or drag files to upload"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Max 50MB per file • Multiple files supported</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* File List */}
          <div className="max-h-64 overflow-y-auto space-y-2 custom-scrollbar">
            {selectedFiles.map((fileWithProgress, index) => (
              <div
                key={index}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${
                  fileWithProgress.error
                    ? "border-destructive/50 bg-destructive/5"
                    : fileWithProgress.progress === 100
                    ? "border-green-500/50 bg-green-500/5"
                    : "border-border/50 bg-muted/20"
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  fileWithProgress.error
                    ? "bg-destructive/10"
                    : fileWithProgress.progress === 100
                    ? "bg-green-500/10"
                    : "bg-primary/10"
                }`}>
                  {fileWithProgress.error ? (
                    <X className="h-5 w-5 text-destructive" />
                  ) : fileWithProgress.progress === 100 ? (
                    <Upload className="h-5 w-5 text-green-600" />
                  ) : (
                    <FileUp className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${
                    fileWithProgress.error ? "text-destructive" : "text-foreground"
                  }`}>
                    {fileWithProgress.file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(fileWithProgress.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  {fileWithProgress.uploading && (
                    <div className="mt-2">
                      <Progress value={fileWithProgress.progress} className="h-1" />
                    </div>
                  )}
                  {fileWithProgress.error && (
                    <p className="text-xs text-destructive mt-1">{fileWithProgress.error}</p>
                  )}
                </div>
                {!fileWithProgress.uploading && fileWithProgress.progress !== 100 && (
                  <Button
                    onClick={() => removeFile(index)}
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
              </span>
              {selectedFiles.length > 1 && (
                <Button
                  onClick={clearAllFiles}
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                  disabled={uploading}
                >
                  Clear all
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  setSelectedFiles([]);
                  if (inputRef.current) inputRef.current.value = "";
                }}
                size="sm"
                variant="outline"
                disabled={uploading}
                className="rounded-lg"
              >
                Add more
              </Button>
              <Button
                onClick={uploadFile}
                disabled={uploading || selectedFiles.every(f => f.progress === 100)}
                size="sm"
                className="rounded-lg"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Upload className="h-4 w-4 mr-1" />
                )}
                Upload {selectedFiles.length > 1 ? `(${selectedFiles.length})` : ''}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
