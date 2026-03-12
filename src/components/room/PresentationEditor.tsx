import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Save, Download, Plus, Trash2, ChevronLeft, ChevronRight, Palette } from "lucide-react";
import PptxGenJS from "pptxgenjs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Slide {
  id: string;
  title: string;
  content: string;
  bgColor: string;
  textColor: string;
}

interface PresentationEditorProps {
  roomId: string;
  userId: string;
  onSaved?: () => void;
}

const BG_PRESETS = [
  { bg: "#1a1a2e", text: "#ffffff", label: "Dark Navy" },
  { bg: "#ffffff", text: "#1a1a2e", label: "Clean White" },
  { bg: "#0f172a", text: "#e2e8f0", label: "Slate" },
  { bg: "#fef3c7", text: "#92400e", label: "Warm" },
  { bg: "#ecfdf5", text: "#065f46", label: "Green" },
  { bg: "#eff6ff", text: "#1e40af", label: "Blue" },
  { bg: "#fdf2f8", text: "#9d174d", label: "Pink" },
  { bg: "#f5f3ff", text: "#5b21b6", label: "Purple" },
];

export const PresentationEditor = ({ roomId, userId, onSaved }: PresentationEditorProps) => {
  const [fileName, setFileName] = useState("Untitled Presentation");
  const [saving, setSaving] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [showColors, setShowColors] = useState(false);
  const [slides, setSlides] = useState<Slide[]>([
    { id: "1", title: "Title Slide", content: "Subtitle or description goes here", bgColor: "#1a1a2e", textColor: "#ffffff" },
  ]);
  const { toast } = useToast();

  const currentSlide = slides[currentSlideIndex];

  const addSlide = () => {
    const newSlide: Slide = {
      id: Date.now().toString(),
      title: "New Slide",
      content: "Add your content here",
      bgColor: slides[slides.length - 1]?.bgColor || "#ffffff",
      textColor: slides[slides.length - 1]?.textColor || "#1a1a2e",
    };
    setSlides([...slides, newSlide]);
    setCurrentSlideIndex(slides.length);
  };

  const deleteSlide = () => {
    if (slides.length <= 1) return;
    const updated = slides.filter((_, i) => i !== currentSlideIndex);
    setSlides(updated);
    setCurrentSlideIndex(Math.min(currentSlideIndex, updated.length - 1));
  };

  const updateSlide = (field: keyof Slide, value: string) => {
    const updated = [...slides];
    updated[currentSlideIndex] = { ...updated[currentSlideIndex], [field]: value };
    setSlides(updated);
  };

  const applyPreset = (preset: typeof BG_PRESETS[0]) => {
    updateSlide("bgColor", preset.bg);
    updateSlide("textColor", preset.text);
    setShowColors(false);
  };

  const exportToPptx = async (): Promise<Blob> => {
    const pptx = new PptxGenJS();
    pptx.author = "ShareUr";
    pptx.title = fileName;

    slides.forEach((slide, index) => {
      const pptSlide = pptx.addSlide();
      pptSlide.background = { color: slide.bgColor.replace("#", "") };

      if (index === 0) {
        // Title slide layout
        pptSlide.addText(slide.title, {
          x: 0.5, y: 1.5, w: 9, h: 1.5,
          fontSize: 36, bold: true, color: slide.textColor.replace("#", ""),
          align: "center",
        });
        pptSlide.addText(slide.content, {
          x: 1, y: 3.2, w: 8, h: 1,
          fontSize: 18, color: slide.textColor.replace("#", "") + "CC",
          align: "center",
        });
      } else {
        // Content slide layout
        pptSlide.addText(slide.title, {
          x: 0.5, y: 0.3, w: 9, h: 0.8,
          fontSize: 28, bold: true, color: slide.textColor.replace("#", ""),
        });
        pptSlide.addText(slide.content, {
          x: 0.5, y: 1.5, w: 9, h: 3.5,
          fontSize: 16, color: slide.textColor.replace("#", ""),
          valign: "top",
          paraSpaceAfter: 8,
        });
      }

      // Slide number
      pptSlide.addText(`${index + 1}`, {
        x: 9, y: 5, w: 0.5, h: 0.3,
        fontSize: 10, color: slide.textColor.replace("#", "") + "80",
        align: "right",
      });
    });

    const output = await pptx.write({ outputType: "blob" });
    return output as Blob;
  };

  const saveToStorage = async () => {
    setSaving(true);
    try {
      const blob = await exportToPptx();
      const fullFileName = `${fileName}.pptx`;
      const filePath = `${roomId}/${Date.now()}_${fullFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("room-files")
        .upload(filePath, blob, { contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("room-files").getPublicUrl(filePath);

      await supabase.from("room_files").insert([{
        room_id: roomId,
        file_name: fullFileName,
        file_size: blob.size,
        file_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        file_url: urlData.publicUrl,
        file_path: filePath,
        uploaded_by: userId,
        is_viewable: false,
      }]);

      toast({ title: "Presentation saved!", description: `${fullFileName} has been saved to the room.` });
      onSaved?.();
    } catch (error: any) {
      toast({ title: "Error saving presentation", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const downloadLocally = async () => {
    const blob = await exportToPptx();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}.pptx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      {/* File Name */}
      <div className="flex items-center gap-3 p-4 border-b border-border/40">
        <Input
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          className="text-lg font-bold border-none bg-transparent shadow-none focus-visible:ring-0 px-0 h-auto"
          placeholder="Presentation name..."
        />
        <span className="text-xs text-muted-foreground font-mono">.pptx</span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-border/40 bg-muted/20">
        <Button variant="ghost" size="sm" onClick={addSlide} className="h-8 text-xs rounded-full">
          <Plus className="h-3 w-3 mr-1" /> Add Slide
        </Button>
        <Button variant="ghost" size="sm" onClick={deleteSlide} disabled={slides.length <= 1} className="h-8 text-xs rounded-full text-destructive">
          <Trash2 className="h-3 w-3 mr-1" /> Delete Slide
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowColors(!showColors)} className="h-8 text-xs rounded-full">
          <Palette className="h-3 w-3 mr-1" /> Theme
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))} disabled={currentSlideIndex === 0}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs font-bold text-muted-foreground tabular-nums">{currentSlideIndex + 1} / {slides.length}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setCurrentSlideIndex(Math.min(slides.length - 1, currentSlideIndex + 1))} disabled={currentSlideIndex === slides.length - 1}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Color Presets */}
      {showColors && (
        <div className="flex flex-wrap gap-2 p-3 border-b border-border/40 bg-muted/10 animate-in fade-in slide-in-from-top-2 duration-200">
          {BG_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => applyPreset(preset)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/50 hover:border-primary/50 transition-all active:scale-95"
            >
              <div className="w-4 h-4 rounded-full border border-border/30" style={{ backgroundColor: preset.bg }} />
              <span className="text-[10px] font-bold uppercase tracking-wider">{preset.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-auto">
        {/* Slide Thumbnails */}
        <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto lg:w-24 shrink-0">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              onClick={() => setCurrentSlideIndex(index)}
              className={`relative w-20 h-14 lg:w-full lg:h-14 rounded-lg border-2 flex-shrink-0 overflow-hidden transition-all active:scale-95 ${index === currentSlideIndex ? 'border-primary shadow-md' : 'border-border/30 opacity-60 hover:opacity-100'}`}
              style={{ backgroundColor: slide.bgColor }}
            >
              <span className="absolute inset-0 flex items-center justify-center text-[7px] font-bold px-1 truncate" style={{ color: slide.textColor }}>
                {slide.title}
              </span>
              <span className="absolute bottom-0.5 right-1 text-[8px] font-bold" style={{ color: slide.textColor + "80" }}>{index + 1}</span>
            </button>
          ))}
        </div>

        {/* Slide Preview + Edit */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Live Preview */}
          <div
            className="relative aspect-video rounded-2xl overflow-hidden shadow-xl border border-border/20 flex flex-col items-center justify-center p-8 sm:p-12"
            style={{ backgroundColor: currentSlide.bgColor }}
          >
            {currentSlideIndex === 0 ? (
              <>
                <h2 className="text-xl sm:text-3xl font-extrabold text-center mb-3 tracking-tight" style={{ color: currentSlide.textColor }}>
                  {currentSlide.title}
                </h2>
                <p className="text-sm sm:text-base text-center opacity-70" style={{ color: currentSlide.textColor }}>
                  {currentSlide.content}
                </p>
              </>
            ) : (
              <div className="self-start w-full">
                <h3 className="text-lg sm:text-2xl font-bold mb-4 tracking-tight" style={{ color: currentSlide.textColor }}>
                  {currentSlide.title}
                </h3>
                <p className="text-sm sm:text-base whitespace-pre-wrap" style={{ color: currentSlide.textColor }}>
                  {currentSlide.content}
                </p>
              </div>
            )}
            <span className="absolute bottom-2 right-3 text-[10px] font-bold" style={{ color: currentSlide.textColor + "60" }}>
              {currentSlideIndex + 1}
            </span>
          </div>

          {/* Edit Fields */}
          <div className="space-y-3">
            <Input
              value={currentSlide.title}
              onChange={(e) => updateSlide("title", e.target.value)}
              placeholder="Slide title..."
              className="font-bold text-base rounded-xl border-border/40 bg-muted/20"
            />
            <Textarea
              value={currentSlide.content}
              onChange={(e) => updateSlide("content", e.target.value)}
              placeholder="Slide content..."
              rows={4}
              className="rounded-xl border-border/40 bg-muted/20 resize-none"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 p-4 border-t border-border/40 bg-muted/10">
        <p className="text-xs text-muted-foreground">Exports as .pptx (Microsoft PowerPoint)</p>
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
