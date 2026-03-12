import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, Download, Plus, Trash2 } from "lucide-react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SpreadsheetEditorProps {
  roomId: string;
  userId: string;
  onSaved?: () => void;
}

const INITIAL_ROWS = 20;
const INITIAL_COLS = 10;
const COL_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const SpreadsheetEditor = ({ roomId, userId, onSaved }: SpreadsheetEditorProps) => {
  const [fileName, setFileName] = useState("Untitled Spreadsheet");
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState(INITIAL_ROWS);
  const [cols, setCols] = useState(INITIAL_COLS);
  const [data, setData] = useState<Record<string, string>>({});
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const { toast } = useToast();

  const getCellKey = (row: number, col: number) => `${COL_LETTERS[col]}${row + 1}`;

  const updateCell = useCallback((key: string, value: string) => {
    setData(prev => ({ ...prev, [key]: value }));
  }, []);

  const exportToExcel = async (): Promise<Blob> => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "ShareUr";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Sheet1");

    // Add data
    for (let r = 0; r < rows; r++) {
      const rowData: string[] = [];
      for (let c = 0; c < cols; c++) {
        const key = getCellKey(r, c);
        rowData.push(data[key] || "");
      }
      sheet.addRow(rowData);
    }

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE2E8F0" },
    };

    // Auto-fit columns
    sheet.columns.forEach((col) => {
      col.width = 15;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  };

  const saveToStorage = async () => {
    setSaving(true);
    try {
      const blob = await exportToExcel();
      const fullFileName = `${fileName}.xlsx`;
      const filePath = `${roomId}/${Date.now()}_${fullFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("room-files")
        .upload(filePath, blob, { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("room-files").getPublicUrl(filePath);

      await supabase.from("room_files").insert([{
        room_id: roomId,
        file_name: fullFileName,
        file_size: blob.size,
        file_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        file_url: urlData.publicUrl,
        file_path: filePath,
        uploaded_by: userId,
        is_viewable: false,
      }]);

      toast({ title: "Spreadsheet saved!", description: `${fullFileName} has been saved to the room.` });
      onSaved?.();
    } catch (error: any) {
      toast({ title: "Error saving spreadsheet", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const downloadLocally = async () => {
    const blob = await exportToExcel();
    saveAs(blob, `${fileName}.xlsx`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* File Name */}
      <div className="flex items-center gap-3 p-4 border-b border-border/40">
        <Input
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          className="text-lg font-bold border-none bg-transparent shadow-none focus-visible:ring-0 px-0 h-auto"
          placeholder="Spreadsheet name..."
        />
        <span className="text-xs text-muted-foreground font-mono">.xlsx</span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-border/40 bg-muted/20">
        <Button variant="ghost" size="sm" onClick={() => setRows(r => r + 5)} className="h-8 text-xs rounded-full">
          <Plus className="h-3 w-3 mr-1" /> Rows
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setCols(c => Math.min(c + 2, 26))} className="h-8 text-xs rounded-full">
          <Plus className="h-3 w-3 mr-1" /> Columns
        </Button>
        <Button variant="ghost" size="sm" onClick={() => { setData({}); }} className="h-8 text-xs rounded-full text-destructive">
          <Trash2 className="h-3 w-3 mr-1" /> Clear All
        </Button>
        {selectedCell && (
          <span className="ml-auto text-xs font-mono text-muted-foreground px-3 py-1 bg-muted/50 rounded-full">
            {selectedCell}: {data[selectedCell] || "empty"}
          </span>
        )}
      </div>

      {/* Spreadsheet Grid */}
      <div className="flex-1 overflow-auto">
        <table className="border-collapse w-max min-w-full">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="w-12 min-w-12 h-8 bg-muted/60 backdrop-blur-sm border border-border/30 text-[10px] font-bold text-muted-foreground sticky left-0 z-20" />
              {Array.from({ length: cols }).map((_, c) => (
                <th key={c} className="min-w-[120px] h-8 bg-muted/60 backdrop-blur-sm border border-border/30 text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2">
                  {COL_LETTERS[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r}>
                <td className="w-12 min-w-12 h-8 bg-muted/40 border border-border/30 text-[10px] font-bold text-muted-foreground text-center sticky left-0 z-10">
                  {r + 1}
                </td>
                {Array.from({ length: cols }).map((_, c) => {
                  const key = getCellKey(r, c);
                  const isSelected = selectedCell === key;
                  return (
                    <td key={c} className={`border border-border/30 p-0 ${isSelected ? 'ring-2 ring-primary ring-inset' : ''}`}>
                      <input
                        type="text"
                        value={data[key] || ""}
                        onChange={(e) => updateCell(key, e.target.value)}
                        onFocus={() => setSelectedCell(key)}
                        className="w-full h-8 px-2 text-sm bg-transparent outline-none text-foreground"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 p-4 border-t border-border/40 bg-muted/10">
        <p className="text-xs text-muted-foreground">Exports as .xlsx (Microsoft Excel)</p>
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
