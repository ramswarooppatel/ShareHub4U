import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Save, Eye, Edit, Loader2, FileText, Plus, Trash2, Share2, Type, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MarkdownEditorProps {
  roomId: string;
  userId: string;
}

interface MarkdownNote {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export const MarkdownEditor = ({ roomId, userId }: MarkdownEditorProps) => {
  const { toast } = useToast();
  const [notes, setNotes] = useState<MarkdownNote[]>([]);
  const [currentNote, setCurrentNote] = useState<MarkdownNote | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorMode, setEditorMode] = useState<"edit" | "preview">("edit");
  
  // User-adjustable font size state
  const [fontSize, setFontSize] = useState<"sm" | "base" | "lg">("base");
  
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadNotes();
    const cleanup = setupRealtimeSubscription();
    return () => { cleanup && cleanup(); };
  }, [roomId]);

  const loadNotes = async () => {
    try {
      const { data, error } = await supabase
        .from("markdown_notes")
        .select("*")
        .eq("room_id", roomId)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setNotes(data || []);
      
      if (data && data.length > 0 && !currentNote) {
        setCurrentNote(data[0]);
        setTitle(data[0].title || "");
        setContent(data[0].content || "");
      }
    } catch (error: unknown) {
      toast({ title: "Error loading notes", description: (error as Error).message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const setupRealtimeSubscription = () => {
    const channelName = `markdown-changes:${roomId}`;
    const channel = supabase.channel(channelName);

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'markdown_notes', filter: `room_id=eq.${roomId}` },
      (payload) => {
        if (payload.eventType === 'INSERT' && payload.new) {
          setNotes(prev => [payload.new as MarkdownNote, ...prev]);
        } else if (payload.eventType === 'DELETE' && payload.old) {
          setNotes(prev => prev.filter(n => n.id !== payload.old.id));
          if (currentNote?.id === payload.old.id) {
            setCurrentNote(null); setTitle(""); setContent("");
          }
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          setNotes(prev => prev.map(n => n.id === payload.new.id ? payload.new as MarkdownNote : n));
          if (currentNote?.id === payload.new.id) {
            setCurrentNote(payload.new as MarkdownNote);
            setTitle(payload.new.title || "");
            setContent(payload.new.content || "");
          }
        }
      }
    );
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  const saveNote = async () => {
    if (!title.trim() || !content.trim()) {
      toast({ title: "Missing content", description: "Please provide both title and content", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (currentNote) {
        const { error } = await supabase.from("markdown_notes").update({ title, content, updated_at: new Date().toISOString() }).eq("id", currentNote.id);
        if (error) throw error;
        toast({ title: "Note saved!", className: "rounded-full py-2 px-4 text-sm" });
      } else {
        const { error } = await supabase.from("markdown_notes").insert({ room_id: roomId, created_by: userId, title, content });
        if (error) throw error;
        toast({ title: "New note created!", className: "rounded-full py-2 px-4 text-sm" });
      }
      loadNotes();
    } catch (error: unknown) {
      toast({ title: "Error saving note", description: (error as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const createNewNote = () => {
    setCurrentNote(null); setTitle(""); setContent(""); setEditorMode("edit"); scrollToEditor();
  };

  const selectNote = (note: MarkdownNote) => {
    setCurrentNote(note); setTitle(note.title); setContent(note.content); scrollToEditor();
  };

  const scrollToEditor = () => {
    if (window.innerWidth < 1024) setTimeout(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const deleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase.from("markdown_notes").delete().eq("id", noteId);
      if (error) throw error;
      toast({ title: "Note deleted", className: "rounded-full py-2 px-4 text-sm" });
      if (currentNote?.id === noteId) { setCurrentNote(null); setTitle(""); setContent(""); }
      loadNotes();
    } catch (error: unknown) {
      toast({ title: "Error deleting note", description: (error as Error).message, variant: "destructive" });
    }
  };

  const copyNoteLink = () => {
    if (!currentNote) return;
    const link = `${window.location.origin}${window.location.pathname}?tab=notes&name=${encodeURIComponent(currentNote.title)}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Link copied!", className: "rounded-full py-2 px-4 text-sm" });
  };

  // Glassy & Curvy Markdown Components
  const MarkdownComponents = {
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 dark:border-white/5 bg-zinc-950 my-6 shadow-lg">
          <SyntaxHighlighter
            style={vscDarkPlus}
            language={match[1]}
            PreTag="div"
            className="text-[13px] !m-0 !bg-transparent custom-scrollbar"
            customStyle={{ padding: '1.25rem', background: 'transparent' }}
            {...props}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        </div>
      ) : (
        <code className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-md text-[13px] font-mono font-semibold break-words mx-0.5" {...props}>
          {children}
        </code>
      );
    },
    blockquote({ children }: any) {
      return (
        <blockquote className="border-l-[4px] border-primary bg-primary/5 py-3 px-5 italic text-muted-foreground my-6 rounded-r-2xl rounded-l-sm shadow-sm">
          {children}
        </blockquote>
      );
    },
    table({ children }: any) {
      return (
        <div className="w-full overflow-x-auto my-6 rounded-2xl border border-white/20 dark:border-white/10 bg-white/30 dark:bg-zinc-900/30 backdrop-blur-md shadow-sm p-1">
          <table className="w-full min-w-[500px] border-collapse text-sm">
            {children}
          </table>
        </div>
      );
    },
    th({ children }: any) {
      return <th className="border-b border-black/10 dark:border-white/10 px-4 py-3 bg-black/5 dark:bg-white/5 font-bold text-left text-foreground rounded-t-lg">{children}</th>;
    },
    td({ children }: any) {
      return <td className="border-b border-black/5 dark:border-white/5 px-4 py-3 text-muted-foreground">{children}</td>;
    },
    p({ children }: any) {
      return <p className="mb-5 leading-relaxed break-words">{children}</p>;
    },
    h1({ children }: any) {
      return <h1 className="text-2xl font-extrabold tracking-tight mt-8 mb-4">{children}</h1>;
    },
    h2({ children }: any) {
      return <h2 className="text-xl font-bold tracking-tight mt-6 mb-3 border-b border-border/40 pb-2">{children}</h2>;
    },
    img({ src, alt }: any) {
      return <img src={src} alt={alt} className="rounded-2xl border border-white/20 shadow-md my-6 max-w-full" />;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground animate-in fade-in">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs font-semibold tracking-widest uppercase">Syncing</p>
      </div>
    );
  }

  // Map our UI state to actual Tailwind classes
  const editorTextSizeClass = fontSize === "sm" ? "text-sm" : fontSize === "lg" ? "text-lg" : "text-base";
  const previewProseClass = fontSize === "sm" ? "prose-sm" : fontSize === "lg" ? "prose-lg" : "prose-base";

  return (
    <div className="flex flex-col h-full w-full space-y-4 relative z-10 px-2 sm:px-4 py-4 max-w-[1400px] mx-auto">
      
      {/* Sleek Minimal Header */}
      <div className="flex flex-row items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10 shadow-sm">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-foreground tracking-tight">Notes</h3>
          <span className="text-[10px] font-bold text-muted-foreground bg-white/50 dark:bg-zinc-800/50 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-white/20 shadow-sm">
            {notes.length}
          </span>
        </div>
        
        <Button onClick={createNewNote} size="sm" className="h-9 rounded-full px-4 text-xs font-bold shadow-md hover:shadow-lg active:scale-95 transition-all">
          <Plus className="h-4 w-4 mr-1.5 stroke-[3px]" /> New
        </Button>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-4 lg:gap-6 min-h-0 w-full">
        
        {/* Notes Directory (Left Sidebar) */}
        <div className="lg:col-span-4 xl:col-span-3 shrink-0 h-[200px] lg:h-full min-h-0 flex flex-col w-full">
          <div className="flex flex-col h-full border border-white/20 dark:border-white/10 shadow-sm bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl overflow-hidden rounded-[1.5rem]">
            <div className="px-5 py-3 border-b border-white/10 dark:border-white/5 bg-white/20 dark:bg-black/10 backdrop-blur-md">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Directory</h4>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              {notes.length === 0 ? (
                <div className="text-center py-10 px-4 text-muted-foreground animate-in fade-in">
                  <div className="w-12 h-12 mx-auto bg-muted/50 rounded-full flex items-center justify-center mb-3">
                    <FileText className="h-6 w-6 opacity-30" />
                  </div>
                  <p className="text-sm font-medium">No notes yet.</p>
                </div>
              ) : (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className={`group p-3 sm:p-4 rounded-xl cursor-pointer transition-all duration-200 active:scale-[0.98] ${
                      currentNote?.id === note.id 
                        ? 'bg-primary/10 border border-primary/20 shadow-sm' 
                        : 'bg-white/50 dark:bg-zinc-800/50 hover:bg-white/80 dark:hover:bg-zinc-700/80 border border-transparent hover:border-white/20'
                    }`}
                    onClick={() => selectNote(note)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm truncate transition-colors ${currentNote?.id === note.id ? 'text-primary' : 'text-foreground'}`}>
                          {note.title || "Untitled Note"}
                        </p>
                        <p className="text-[10px] font-medium text-muted-foreground mt-1.5 uppercase opacity-80 tracking-wider">
                          {new Date(note.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {note.created_by === userId && (
                        <Button
                          onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-all text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 rounded-full"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Editor Area (Right Main Area) */}
        <div ref={editorRef} className="lg:col-span-8 xl:col-span-9 flex-none lg:flex-1 h-[500px] lg:h-auto lg:min-h-[60vh] flex flex-col scroll-mt-4 w-full pb-safe">
          <div className="flex flex-col h-full border border-white/20 dark:border-white/10 shadow-md bg-white/60 dark:bg-zinc-900/60 backdrop-blur-2xl overflow-hidden rounded-[1.5rem]">
            
            {/* Editor Toolbar */}
            <div className="shrink-0 p-4 border-b border-white/20 dark:border-white/10 bg-white/30 dark:bg-black/10 backdrop-blur-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                
                {/* Title Input & Share */}
                <div className="flex-1 flex items-center gap-2 w-full">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Note Title..."
                    className="text-lg sm:text-xl border border-white/10 dark:border-white/10 font-bold h-10 w-full bg-transparent hover:bg-white/40 dark:hover:bg-white/5 focus-visible:bg-white/60 dark:focus-visible:bg-zinc-800/60 focus-visible:border-primary/30 focus-visible:ring-2 focus-visible:ring-primary/10 transition-all rounded-xl shadow-none placeholder:text-muted-foreground/40 px-3"
                  />
                  {currentNote && (
                    <Button onClick={copyNoteLink} size="icon" variant="ghost" className="h-9 w-9 shrink-0 rounded-full hover:bg-white/60 dark:hover:bg-white/10 active:scale-95 transition-all">
                      <Share2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                  
                  {/* Font Size Toggle */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full hover:bg-white/60 dark:hover:bg-white/10 active:scale-95 transition-all">
                        <Type className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl p-1 w-32 border-white/10 bg-background/95 backdrop-blur-xl">
                      {(["sm", "base", "lg"] as const).map((size) => (
                        <DropdownMenuItem 
                          key={size} 
                          onClick={() => setFontSize(size)}
                          className="rounded-lg text-xs font-medium cursor-pointer"
                        >
                          <span className="flex-1 capitalize">{size === "sm" ? "Small" : size === "lg" ? "Large" : "Medium"}</span>
                          {fontSize === size && <Check className="h-3 w-3 text-primary" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Segmented Control */}
                <Tabs value={editorMode} onValueChange={(v) => setEditorMode(v as "edit" | "preview")} className="w-full sm:w-auto shrink-0">
                  <TabsList className="w-full sm:w-auto grid grid-cols-2 h-10 bg-black/5 dark:bg-white/5 backdrop-blur-md p-1 rounded-full border border-black/5 dark:border-white/5 shadow-inner">
                    <TabsTrigger value="edit" className="text-[11px] font-bold uppercase tracking-widest rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-300">
                      <Edit className="h-3 w-3 mr-1.5" /> Edit
                    </TabsTrigger>
                    <TabsTrigger value="preview" className="text-[11px] font-bold uppercase tracking-widest rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-300">
                      <Eye className="h-3 w-3 mr-1.5" /> View
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 relative overflow-hidden bg-transparent">
              {editorMode === "edit" ? (
                <div className="absolute inset-0 p-4 sm:p-6 lg:p-8">
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Start typing your markdown here...&#10;&#10;# Heading&#10;&#10;**Bold** and *Italic*&#10;- Bullet lists&#10;1. Numbered lists&#10;> Blockquotes&#10;&#10;```js&#10;console.log('Code blocks!');&#10;```"
                    className={`w-full h-full resize-none border-2 border-white/60 focus-visible:ring-0 p-0 leading-relaxed font-mono custom-scrollbar shadow-none bg-transparent ${editorTextSizeClass}`}
                  />
                </div>
              ) : (
                <div className="absolute inset-0 p-6 sm:p-8 lg:p-10 overflow-y-auto overflow-x-hidden custom-scrollbar bg-background/20">
                  <div className={`prose dark:prose-invert max-w-3xl mx-auto w-full break-words
                      prose-headings:font-bold prose-headings:tracking-tight
                      prose-a:text-primary prose-a:underline-offset-4 prose-a:decoration-primary/30 hover:prose-a:decoration-primary
                      prose-hr:border-white/20 dark:prose-hr:border-white/10
                      prose-strong:font-bold ${previewProseClass}`}>
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={MarkdownComponents}>
                      {content || "*Nothing to preview yet. Switch to the Edit tab to start typing!*"}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Save Bar */}
            <div className="shrink-0 p-4 lg:p-5 border-t border-white/20 dark:border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur-2xl flex justify-end">
              <Button 
                onClick={saveNote}
                disabled={saving || (!title.trim() && !content.trim())} 
                className="w-full sm:w-auto shadow-md hover:shadow-lg active:scale-95 transition-all duration-300 rounded-full h-10 px-8 text-sm font-bold"
              >
                {saving ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving</>
                ) : (
                  <><Save className="mr-2 h-4 w-4" /> {currentNote ? "Save" : "Create"}</>
                )}
              </Button>
            </div>
            
          </div>
        </div>

      </div>
    </div>
  );
};