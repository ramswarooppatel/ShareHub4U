import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileSpreadsheet, FileText, Presentation, ArrowLeft } from "lucide-react";
import { DocumentEditor } from "./DocumentEditor";
import { SpreadsheetEditor } from "./SpreadsheetEditor";
import { PresentationEditor } from "./PresentationEditor";

interface CreateFileTabProps {
  roomId: string;
  userId: string;
  onFileSaved?: () => void;
}

type EditorType = null | "document" | "spreadsheet" | "presentation";

export const CreateFileTab = ({ roomId, userId, onFileSaved }: CreateFileTabProps) => {
  const [activeEditor, setActiveEditor] = useState<EditorType>(null);

  const handleSaved = () => {
    onFileSaved?.();
    setActiveEditor(null);
  };

  if (activeEditor) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 border-b border-border/40">
          <Button variant="ghost" size="sm" onClick={() => setActiveEditor(null)} className="rounded-full text-xs font-bold h-8 active:scale-95 transition-all">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to templates
          </Button>
        </div>
        <div className="flex-1 min-h-0">
          {activeEditor === "document" && <DocumentEditor roomId={roomId} userId={userId} onSaved={handleSaved} />}
          {activeEditor === "spreadsheet" && <SpreadsheetEditor roomId={roomId} userId={userId} onSaved={handleSaved} />}
          {activeEditor === "presentation" && <PresentationEditor roomId={roomId} userId={userId} onSaved={handleSaved} />}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-10">
      <div className="text-center mb-10">
        <h2 className="text-2xl font-extrabold tracking-tight mb-2">Create a File</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Choose a file type to create. Edit it right here and save it directly to this room.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
        <button
          onClick={() => setActiveEditor("document")}
          className="group p-6 rounded-3xl border border-border/50 bg-background/50 backdrop-blur-md hover:border-blue-500/40 hover:bg-blue-500/5 transition-all active:scale-[0.98] text-left"
        >
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-all">
            <FileText className="h-6 w-6 text-blue-500" />
          </div>
          <h3 className="font-bold text-base mb-1">Document</h3>
          <p className="text-xs text-muted-foreground">Rich text editor, exports as .docx</p>
        </button>

        <button
          onClick={() => setActiveEditor("spreadsheet")}
          className="group p-6 rounded-3xl border border-border/50 bg-background/50 backdrop-blur-md hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all active:scale-[0.98] text-left"
        >
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-all">
            <FileSpreadsheet className="h-6 w-6 text-emerald-500" />
          </div>
          <h3 className="font-bold text-base mb-1">Spreadsheet</h3>
          <p className="text-xs text-muted-foreground">Grid editor, exports as .xlsx</p>
        </button>

        <button
          onClick={() => setActiveEditor("presentation")}
          className="group p-6 rounded-3xl border border-border/50 bg-background/50 backdrop-blur-md hover:border-orange-500/40 hover:bg-orange-500/5 transition-all active:scale-[0.98] text-left"
        >
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center mb-4 group-hover:bg-orange-500/20 transition-all">
            <Presentation className="h-6 w-6 text-orange-500" />
          </div>
          <h3 className="font-bold text-base mb-1">Presentation</h3>
          <p className="text-xs text-muted-foreground">Slide editor, exports as .pptx</p>
        </button>
      </div>
    </div>
  );
};
