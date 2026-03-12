import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, 
  List, ListOrdered, Save, Download, Type, Heading1, Heading2, 
  Strikethrough, Link, Undo, Redo
} from "lucide-react";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DocumentEditorProps {
  roomId: string;
  userId: string;
  existingFile?: {
    id: string;
    file_name: string;
    content?: string;
  };
  onSaved?: () => void;
}

export const DocumentEditor = ({ roomId, userId, existingFile, onSaved }: DocumentEditorProps) => {
  const [fileName, setFileName] = useState(existingFile?.file_name?.replace(/\.(docx|doc|html)$/i, '') || "Untitled Document");
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  }, []);

  const exportToDocx = async (): Promise<Blob> => {
    const content = editorRef.current?.innerHTML || "";
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = content;

    const paragraphs: Paragraph[] = [];
    const processNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || "";
        if (text.trim()) {
          paragraphs.push(new Paragraph({ children: [new TextRun(text)] }));
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();
        const text = el.textContent || "";

        if (tag === "h1") {
          paragraphs.push(new Paragraph({ text, heading: HeadingLevel.HEADING_1 }));
        } else if (tag === "h2") {
          paragraphs.push(new Paragraph({ text, heading: HeadingLevel.HEADING_2 }));
        } else if (tag === "p" || tag === "div") {
          const runs: TextRun[] = [];
          el.childNodes.forEach(child => {
            const childText = child.textContent || "";
            if (child.nodeType === Node.TEXT_NODE) {
              runs.push(new TextRun(childText));
            } else if (child.nodeType === Node.ELEMENT_NODE) {
              const childEl = child as HTMLElement;
              const childTag = childEl.tagName.toLowerCase();
              runs.push(new TextRun({
                text: childText,
                bold: childTag === "b" || childTag === "strong" || childEl.style.fontWeight === "bold",
                italics: childTag === "i" || childTag === "em",
                underline: childTag === "u" ? {} : undefined,
                strike: childTag === "s" || childTag === "strike",
              }));
            }
          });
          const alignment = el.style.textAlign === "center" ? AlignmentType.CENTER 
            : el.style.textAlign === "right" ? AlignmentType.RIGHT : AlignmentType.LEFT;
          paragraphs.push(new Paragraph({ children: runs.length ? runs : [new TextRun(text)], alignment }));
        } else {
          el.childNodes.forEach(processNode);
        }
      }
    };

    tempDiv.childNodes.forEach(processNode);
    if (paragraphs.length === 0) {
      paragraphs.push(new Paragraph({ children: [new TextRun("")] }));
    }

    const doc = new Document({
      sections: [{ properties: {}, children: paragraphs }],
    });

    return await Packer.toBlob(doc);
  };

  const saveToStorage = async () => {
    if (!editorRef.current) return;
    setSaving(true);
    try {
      const blob = await exportToDocx();
      const fullFileName = `${fileName}.docx`;
      const filePath = `${roomId}/${Date.now()}_${fullFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("room-files")
        .upload(filePath, blob, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("room-files").getPublicUrl(filePath);

      await supabase.from("room_files").insert([{
        room_id: roomId,
        file_name: fullFileName,
        file_size: blob.size,
        file_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        file_url: urlData.publicUrl,
        file_path: filePath,
        uploaded_by: userId,
        is_viewable: false,
      }]);

      toast({ title: "Document saved!", description: `${fullFileName} has been saved to the room.` });
      onSaved?.();
    } catch (error: any) {
      toast({ title: "Error saving document", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const downloadLocally = async () => {
    const blob = await exportToDocx();
    saveAs(blob, `${fileName}.docx`);
  };

  const ToolButton = ({ onClick, active, children, title }: { onClick: () => void; active?: boolean; children: React.ReactNode; title: string }) => (
    <button
      onClick={onClick}
      title={title}
      className={`p-2 rounded-lg transition-all hover:bg-muted active:scale-95 ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
    >
      {children}
    </button>
  );

  return (
    <div className="flex flex-col h-full">
      {/* File Name */}
      <div className="flex items-center gap-3 p-4 border-b border-border/40">
        <Input
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          className="text-lg font-bold border-none bg-transparent shadow-none focus-visible:ring-0 px-0 h-auto"
          placeholder="Document name..."
        />
        <span className="text-xs text-muted-foreground font-mono">.docx</span>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-border/40 bg-muted/20">
        <ToolButton onClick={() => execCommand("undo")} title="Undo"><Undo className="h-4 w-4" /></ToolButton>
        <ToolButton onClick={() => execCommand("redo")} title="Redo"><Redo className="h-4 w-4" /></ToolButton>
        <div className="w-px h-5 bg-border/50 mx-1" />
        <ToolButton onClick={() => execCommand("formatBlock", "H1")} title="Heading 1"><Heading1 className="h-4 w-4" /></ToolButton>
        <ToolButton onClick={() => execCommand("formatBlock", "H2")} title="Heading 2"><Heading2 className="h-4 w-4" /></ToolButton>
        <ToolButton onClick={() => execCommand("formatBlock", "P")} title="Normal text"><Type className="h-4 w-4" /></ToolButton>
        <div className="w-px h-5 bg-border/50 mx-1" />
        <ToolButton onClick={() => execCommand("bold")} title="Bold"><Bold className="h-4 w-4" /></ToolButton>
        <ToolButton onClick={() => execCommand("italic")} title="Italic"><Italic className="h-4 w-4" /></ToolButton>
        <ToolButton onClick={() => execCommand("underline")} title="Underline"><Underline className="h-4 w-4" /></ToolButton>
        <ToolButton onClick={() => execCommand("strikeThrough")} title="Strikethrough"><Strikethrough className="h-4 w-4" /></ToolButton>
        <div className="w-px h-5 bg-border/50 mx-1" />
        <ToolButton onClick={() => execCommand("justifyLeft")} title="Align left"><AlignLeft className="h-4 w-4" /></ToolButton>
        <ToolButton onClick={() => execCommand("justifyCenter")} title="Align center"><AlignCenter className="h-4 w-4" /></ToolButton>
        <ToolButton onClick={() => execCommand("justifyRight")} title="Align right"><AlignRight className="h-4 w-4" /></ToolButton>
        <div className="w-px h-5 bg-border/50 mx-1" />
        <ToolButton onClick={() => execCommand("insertUnorderedList")} title="Bullet list"><List className="h-4 w-4" /></ToolButton>
        <ToolButton onClick={() => execCommand("insertOrderedList")} title="Numbered list"><ListOrdered className="h-4 w-4" /></ToolButton>
        <ToolButton onClick={() => { const url = prompt("Enter URL:"); if (url) execCommand("createLink", url); }} title="Insert link"><Link className="h-4 w-4" /></ToolButton>
      </div>

      {/* Editor Area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="flex-1 p-6 sm:p-10 outline-none text-foreground prose prose-sm dark:prose-invert max-w-none overflow-y-auto min-h-[400px] focus:ring-0"
        style={{ fontFamily: "'Georgia', 'Times New Roman', serif", lineHeight: 1.8, fontSize: "15px" }}
        dangerouslySetInnerHTML={{ __html: existingFile?.content || "<p>Start typing your document here...</p>" }}
      />

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 p-4 border-t border-border/40 bg-muted/10">
        <p className="text-xs text-muted-foreground">Exports as .docx (Microsoft Word)</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadLocally} className="rounded-full text-xs font-bold h-9 active:scale-95 transition-all">
            <Download className="h-4 w-4 mr-2" /> Download
          </Button>
          <Button size="sm" onClick={saveToStorage} disabled={saving} className="rounded-full text-xs font-bold h-9 active:scale-95 transition-all">
            <Save className="h-4 w-4 mr-2" /> {saving ? "Saving..." : "Save to Room"}
          </Button>
        </div>
      </div>
    </div>
  );
};
