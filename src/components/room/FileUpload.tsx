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

export const FileUpload = ({ roomId, userId, disabled }: FileUploadProps) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 50MB",
        variant: "destructive",
      });
      return;
    }
    setSelectedFile(file);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFileSelect(file);
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
    if (e.dataTransfer.files?.[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const uploadFile = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${roomId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("room-files")
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("room-files")
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase.from("room_files").insert({
        room_id: roomId,
        uploaded_by: userId,
        file_name: selectedFile.name,
        file_type: selectedFile.type,
        file_size: selectedFile.size,
        file_url: urlData.publicUrl,
        file_path: filePath,
        is_viewable: true,
      });

      if (dbError) throw dbError;

      toast({
        title: "File uploaded!",
        description: `${selectedFile.name} has been shared.`,
      });

      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      {!selectedFile ? (
        <div
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
            onChange={handleInputChange}
            disabled={disabled || uploading}
            className="hidden"
          />
          <FileUp className={`h-8 w-8 mx-auto mb-2 transition-colors ${
            dragActive ? "text-primary" : "text-muted-foreground/50"
          }`} />
          <p className="text-sm font-medium text-foreground">
            {dragActive ? "Drop file here" : "Click or drag file to upload"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Max 50MB per file</p>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-muted/20">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FileUp className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              onClick={() => {
                setSelectedFile(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              disabled={uploading}
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              onClick={uploadFile}
              disabled={uploading}
              size="sm"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-1" />
                  Upload
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
