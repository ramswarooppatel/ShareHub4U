import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Save, Eye, Edit, Loader2, FileText, Plus, Trash2, Share2 } from "lucide-react";
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

// Glassy & Curvy Markdown Components
const MarkdownComponents = {
  code({ node, inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || '');
    return !inline && match ? (
      <div className="relative w-full overflow-hidden rounded-[2rem] border border-white/10 dark:border-white/5 bg-zinc-950 my-6 shadow-xl">
        <SyntaxHighlighter
          style={vscDarkPlus}
          language={match[1]}
          PreTag="div"
          className="text-sm md:text-base !m-0 !bg-transparent custom-scrollbar"
          customStyle={{ padding: '1.5rem', background: 'transparent' }}
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      </div>
    ) : (
      <code className="bg-primary/10 text-primary px-2 py-1 rounded-lg text-sm font-mono font-semibold break-words" {...props}>
        {children}
      </code>
    );
  },
  blockquote({ children }: any) {
    return (
      <blockquote className="border-l-4 border-primary bg-primary/5 py-4 px-6 italic text-muted-foreground my-6 rounded-r-3xl rounded-l-sm shadow-sm text-lg">
        {children}
      </blockquote>
    );
  },
  table({ children }: any) {
    return (
      <div className="w-full overflow-x-auto my-6 rounded-[2rem] border border-white/20 dark:border-white/10 bg-white/30 dark:bg-zinc-900/30 backdrop-blur-md shadow-sm">
        <table className="w-full min-w-[500px] border-collapse text-base">
          {children}
        </table>
      </div>
    );
  },
  th({ children }: any) {
    return (
      <th className="border-b border-black/5 dark:border-white/5 px-6 py-4 bg-black/5 dark:bg-white/5 font-bold text-left text-foreground">
        {children}
      </th>
    );
  },
  td({ children }: any) {
    return (
      <td className="border-b border-black/5 dark:border-white/5 px-6 py-4 text-muted-foreground">
        {children}
      </td>
    );
  },
  p({ children }: any) {
    return <p className="mb-6 leading-relaxed break-words">{children}</p>;
  },
  h1({ children }: any) {
    return <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mt-10 mb-6">{children}</h1>;
  },
  h2({ children }: any) {
    return <h2 className="text-3xl md:text-4xl font-bold tracking-tight mt-10 mb-6 border-b border-border/40 pb-3">{children}</h2>;
  },
  img({ src, alt }: any) {
    return <img src={src} alt={alt} className="rounded-[2rem] border border-white/20 shadow-lg my-8 max-w-full" />;
  }
};

export const MarkdownEditor = ({ roomId, userId }: MarkdownEditorProps) => {
  const { toast } = useToast();
  const [notes, setNotes] = useState<MarkdownNote[]>([]);
  const [currentNote, setCurrentNote] = useState<MarkdownNote | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorMode, setEditorMode] = useState<"edit" | "preview">("edit");
  
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
        toast({ title: "Note saved!", className: "rounded-full" });
      } else {
        const { error } = await supabase.from("markdown_notes").insert({ room_id: roomId, created_by: userId, title, content });
        if (error) throw error;
        toast({ title: "New note created!", className: "rounded-full" });
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
      toast({ title: "Note deleted", className: "rounded-full" });
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
    toast({ title: "Link copied!", className: "rounded-full" });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 text-muted-foreground animate-in fade-in">
        <Loader2 className="h-12 w-12 animate-spin text-primary drop-shadow-md" />
        <p className="text-xs font-extrabold tracking-widest uppercase">Syncing Workspace</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full lg:min-h-[85vh] space-y-4 lg:space-y-6 relative z-10">
      
      {/* Sleek Minimal Header */}
      <div className="flex flex-row items-center justify-between shrink-0 px-2 lg:px-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10 shadow-inner">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-2xl font-extrabold text-foreground tracking-tight">Notes</h3>
          <span className="text-[11px] font-extrabold text-muted-foreground bg-white/50 dark:bg-zinc-800/50 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 dark:border-white/10 shadow-sm">
            {notes.length}
          </span>
        </div>
        
        <Button onClick={createNewNote} className="h-12 rounded-full px-6 text-sm font-extrabold shadow-lg hover:shadow-xl hover:shadow-primary/20 active:scale-95 transition-all">
          <Plus className="h-5 w-5 mr-2 stroke-[3px]" /> New Note
        </Button>
      </div>

      {/* Main Layout: Stacked on Mobile, Grid on Desktop */}
      <div className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-4 lg:gap-8 min-h-0 w-full">
        
        {/* Notes Directory (Left Sidebar) */}
        <div className="lg:col-span-4 xl:col-span-3 shrink-0 h-[250px] lg:h-full min-h-0 flex flex-col w-full">
          <div className="flex flex-col h-full border border-white/20 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.15)] bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl overflow-hidden rounded-[2.5rem]">
            <div className="px-6 py-5 border-b border-white/10 dark:border-white/5 bg-white/20 dark:bg-black/10 backdrop-blur-md">
              <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">Directory</h4>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
              {notes.length === 0 ? (
                <div className="text-center py-16 px-4 text-muted-foreground animate-in fade-in zoom-in-95">
                  <div className="w-20 h-20 mx-auto bg-muted/50 rounded-full flex items-center justify-center mb-5">
                    <FileText className="h-10 w-10 opacity-30" />
                  </div>
                  <p className="text-base font-bold">No notes yet.</p>
                </div>
              ) : (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className={`group p-5 rounded-[1.5rem] cursor-pointer transition-all duration-300 active:scale-[0.98] ${
                      currentNote?.id === note.id 
                        ? 'bg-primary/10 border border-primary/20 shadow-md scale-[1.02]' 
                        : 'bg-white/40 dark:bg-zinc-800/40 hover:bg-white/70 dark:hover:bg-zinc-700/60 border border-transparent hover:border-white/20 dark:hover:border-white/10'
                    }`}
                    onClick={() => selectNote(note)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold text-base truncate transition-colors ${currentNote?.id === note.id ? 'text-primary' : 'text-foreground'}`}>
                          {note.title || "Untitled Note"}
                        </p>
                        <p className="text-xs font-semibold text-muted-foreground mt-2 tracking-wider uppercase">
                          {new Date(note.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {note.created_by === userId && (
                        <Button
                          onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                          size="icon"
                          variant="ghost"
                          className="h-10 w-10 opacity-0 group-hover:opacity-100 transition-all text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 rounded-full"
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Massive Editor Area (Right Main Area) */}
        <div ref={editorRef} className="lg:col-span-8 xl:col-span-9 flex-none lg:flex-1 h-[600px] lg:h-auto lg:min-h-[75vh] flex flex-col scroll-mt-6 w-full">
          <div className="flex flex-col h-full border border-white/20 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] bg-white/60 dark:bg-zinc-900/60 backdrop-blur-3xl overflow-hidden rounded-[2.5rem]">
            
            {/* Editor Toolbar (Glassy Top) */}
            <div className="shrink-0 p-5 lg:p-6 border-b border-white/20 dark:border-white/10 bg-white/30 dark:bg-black/20 backdrop-blur-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                
                {/* Huge Title Input */}
                <div className="flex-1 flex items-center gap-3 w-full">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter Note Title..."
                    className="text-2xl md:text-3xl font-extrabold h-16 w-full border-transparent bg-transparent hover:bg-white/40 dark:hover:bg-white/5 focus-visible:bg-white/60 dark:focus-visible:bg-zinc-800/60 focus-visible:border-primary/40 focus-visible:ring-4 focus-visible:ring-primary/10 transition-all rounded-2xl shadow-none placeholder:text-muted-foreground/30"
                  />
                  {currentNote && (
                    <Button onClick={copyNoteLink} size="icon" variant="ghost" className="h-14 w-14 shrink-0 rounded-full hover:bg-white/60 dark:hover:bg-white/10 active:scale-95 transition-all shadow-sm border border-transparent hover:border-white/20">
                      <Share2 className="h-6 w-6 text-muted-foreground" />
                    </Button>
                  )}
                </div>

                {/* iOS Segmented Control */}
                <Tabs value={editorMode} onValueChange={(v) => setEditorMode(v as "edit" | "preview")} className="w-full sm:w-auto shrink-0">
                  <TabsList className="w-full sm:w-auto grid grid-cols-2 h-14 bg-black/5 dark:bg-white/5 backdrop-blur-md p-1.5 rounded-full border border-black/5 dark:border-white/5 shadow-inner">
                    <TabsTrigger value="edit" data-shortcut="edit-mode" className="text-xs font-extrabold uppercase tracking-widest rounded-full data-[state=active]:bg-background data-[state=active]:shadow-lg transition-all duration-300">
                      <Edit className="h-4 w-4 mr-2" /> Edit
                    </TabsTrigger>
                    <TabsTrigger value="preview" data-shortcut="preview-mode" className="text-xs font-extrabold uppercase tracking-widest rounded-full data-[state=active]:bg-background data-[state=active]:shadow-lg transition-all duration-300">
                      <Eye className="h-4 w-4 mr-2" /> View
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            {/* Expansive Content Area */}
            <div className="flex-1 relative overflow-hidden bg-transparent">
              {editorMode === "edit" ? (
                <div className="absolute inset-0 p-6 lg:p-10">
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Start typing your markdown here...&#10;&#10;# Huge Heading&#10;&#10;**Bold** and *Italic*&#10;- Bullet lists&#10;1. Numbered lists&#10;> Blockquotes&#10;&#10;```javascript&#10;console.log('Code blocks!');&#10;```"
                    className="w-full h-full resize-none border-0 focus-visible:ring-0 p-0 text-base md:text-lg lg:text-xl leading-relaxed font-mono custom-scrollbar shadow-none bg-transparent"
                  />
                </div>
              ) : (
                <div className="absolute inset-0 p-8 lg:p-12 overflow-y-auto overflow-x-hidden custom-scrollbar bg-background/30">
                  {/* Note: max-w-4xl and mx-auto center the text beautifully on large screens */}
                  <div className="prose prose-base sm:prose-lg lg:prose-xl dark:prose-invert max-w-4xl mx-auto w-full break-words
                      prose-headings:font-extrabold prose-headings:tracking-tight
                      prose-a:text-primary prose-a:underline-offset-4 prose-a:decoration-primary/30 hover:prose-a:decoration-primary
                      prose-hr:border-white/20 dark:prose-hr:border-white/10
                      prose-strong:font-extrabold">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm, remarkBreaks]}
                      components={MarkdownComponents}
                    >
                      {content || "*Nothing to preview yet. Switch to the Edit tab to start typing!*"}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Glass Bar (Save Button) */}
            <div className="shrink-0 p-5 lg:p-6 border-t border-white/20 dark:border-white/10 bg-white/40 dark:bg-black/30 backdrop-blur-3xl flex justify-end">
              <Button 
                onClick={saveNote}
                data-shortcut="save-note"
                disabled={saving || (!title.trim() && !content.trim())} 
                className="w-full sm:w-auto shadow-xl hover:shadow-2xl hover:shadow-primary/20 active:scale-95 transition-all duration-300 rounded-full h-14 px-10 text-base font-extrabold tracking-wide"
              >
                {saving ? (
                  <><Loader2 className="mr-3 h-6 w-6 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="mr-3 h-6 w-6" /> {currentNote ? "Save Changes" : "Create Note"}</>
                )}
              </Button>
            </div>
            
          </div>
        </div>

      </div>
    </div>
  );
};