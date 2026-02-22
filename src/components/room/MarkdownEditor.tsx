import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Save, Eye, Edit, Loader2, FileText, Plus, Trash2, Copy, Share2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

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

// Fixed custom components to prevent horizontal overflows
const MarkdownComponents = {
  code({ node, inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || '');
    return !inline && match ? (
      <div className="relative w-full overflow-x-auto rounded-xl border border-border/50 bg-[#282c34] my-4 shadow-sm">
        <SyntaxHighlighter
          style={oneDark}
          language={match[1]}
          PreTag="div"
          className="text-[13px] sm:text-sm !m-0 !bg-transparent"
          customStyle={{ padding: '1rem', background: 'transparent' }}
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      </div>
    ) : (
      <code className="bg-muted/80 text-primary px-1.5 py-0.5 rounded-md text-[13px] font-mono break-words border border-border/50" {...props}>
        {children}
      </code>
    );
  },
  blockquote({ children }: any) {
    return (
      <blockquote className="border-l-4 border-primary/50 bg-muted/30 py-1.5 px-4 italic text-muted-foreground my-4 rounded-r-xl">
        {children}
      </blockquote>
    );
  },
  table({ children }: any) {
    return (
      <div className="w-full overflow-x-auto my-4 rounded-xl border border-border/50 shadow-sm">
        <table className="w-full min-w-[400px] border-collapse text-sm">
          {children}
        </table>
      </div>
    );
  },
  th({ children }: any) {
    return (
      <th className="border-b border-border/50 px-4 py-3 bg-muted/50 font-semibold text-left text-foreground">
        {children}
      </th>
    );
  },
  td({ children }: any) {
    return (
      <td className="border-b border-border/20 px-4 py-3 text-muted-foreground">
        {children}
      </td>
    );
  },
  p({ children }: any) {
    return <p className="mb-4 leading-relaxed break-words">{children}</p>;
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
  
  // Ref to seamlessly scroll to editor on mobile when a note is tapped
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadNotes();
    setupRealtimeSubscription();
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
      const err = error as Error;
      toast({
        title: "Error loading notes",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('markdown-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'markdown_notes',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            setNotes(prev => [payload.new as MarkdownNote, ...prev]);
          } else if (payload.eventType === 'DELETE' && payload.old) {
            setNotes(prev => prev.filter(n => n.id !== payload.old.id));
            if (currentNote?.id === payload.old.id) {
              setCurrentNote(null);
              setTitle("");
              setContent("");
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
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const saveNote = async () => {
    if (!title.trim() || !content.trim()) {
      toast({
        title: "Missing content",
        description: "Please provide both title and content",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (currentNote) {
        const { error } = await supabase
          .from("markdown_notes")
          .update({ title, content, updated_at: new Date().toISOString() })
          .eq("id", currentNote.id);

        if (error) throw error;
        toast({ title: "Note updated successfully!" });
      } else {
        const { error } = await supabase
          .from("markdown_notes")
          .insert({
            room_id: roomId,
            created_by: userId,
            title,
            content,
          });

        if (error) throw error;
        toast({ title: "New note created!" });
      }

      loadNotes();
    } catch (error: unknown) {
      const err = error as Error;
      toast({
        title: "Error saving note",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const createNewNote = () => {
    setCurrentNote(null);
    setTitle("");
    setContent("");
    setEditorMode("edit");
    scrollToEditor();
  };

  const selectNote = (note: MarkdownNote) => {
    setCurrentNote(note);
    setTitle(note.title);
    setContent(note.content);
    scrollToEditor();
  };

  // Smooth scroll helper for mobile devices
  const scrollToEditor = () => {
    if (window.innerWidth < 1024) {
      setTimeout(() => {
        editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from("markdown_notes")
        .delete()
        .eq("id", noteId);

      if (error) throw error;

      toast({ title: "Note deleted forever" });
      
      if (currentNote?.id === noteId) {
        setCurrentNote(null);
        setTitle("");
        setContent("");
      }
      
      loadNotes();
    } catch (error: unknown) {
      const err = error as Error;
      toast({
        title: "Error deleting note",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const copyNoteLink = () => {
    if (!currentNote) return;
    const link = `${window.location.origin}${window.location.pathname}?tab=notes&name=${encodeURIComponent(currentNote.title)}&mode=view`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link copied!",
      description: "Share this link to let others view this note.",
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground animate-in fade-in duration-500">
        <Loader2 className="h-8 w-8 animate-spin text-primary/70" />
        <p className="text-sm font-semibold tracking-widest uppercase">Syncing Workspace...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-5 bg-background/20">
      
      {/* Header Controls */}
      <div className="flex flex-row items-center justify-between gap-3 shrink-0 px-2 pt-2">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary shadow-inner">
            <FileText className="h-4 w-4" />
          </div>
          <h3 className="text-lg font-bold text-foreground tracking-tight">Live Notes</h3>
          <span className="text-xs font-bold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full border border-border/50">
            {notes.length}
          </span>
        </div>
        
        <Button onClick={createNewNote} size="sm" className="shadow-md hover:shadow-lg active:scale-95 transition-all rounded-xl font-semibold">
          <Plus className="h-4 w-4 mr-1.5" />
          New Note
        </Button>
      </div>

      {/* Main Layout: Stacks on mobile, Grid on desktop */}
      <div className="flex-1 flex flex-col lg:grid lg:grid-cols-4 gap-5 min-h-0 overflow-y-auto lg:overflow-hidden custom-scrollbar pb-safe">
        
        {/* Notes List (Top on mobile, Left on desktop) */}
        <div className="lg:col-span-1 shrink-0 h-[220px] lg:h-full min-h-0 flex flex-col">
          <Card className="flex flex-col h-full border-border/30 shadow-sm bg-card/60 backdrop-blur-md overflow-hidden rounded-[1.5rem] transition-shadow hover:shadow-md">
            <div className="p-3.5 border-b border-border/30 shrink-0 bg-muted/20">
              <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Directory</h4>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 custom-scrollbar">
              {notes.length === 0 ? (
                <div className="text-center py-10 px-4 text-muted-foreground animate-in fade-in">
                  <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">No notes yet.</p>
                  <p className="text-xs opacity-70 mt-1">Create one to get started!</p>
                </div>
              ) : (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className={`group p-3 rounded-xl border cursor-pointer transition-all duration-200 active:scale-[0.98] ${
                      currentNote?.id === note.id 
                        ? 'border-primary/40 bg-primary/10 shadow-sm' 
                        : 'border-transparent hover:border-border/50 hover:bg-muted/40'
                    }`}
                    onClick={() => selectNote(note)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm truncate transition-colors ${currentNote?.id === note.id ? 'text-primary' : 'text-foreground group-hover:text-primary/80'}`}>
                          {note.title || "Untitled Note"}
                        </p>
                        <p className="text-[11px] font-medium text-muted-foreground mt-1 tracking-wide">
                          {new Date(note.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {note.created_by === userId && (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNote(note.id);
                          }}
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 rounded-lg"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Editor Area (Bottom on mobile, Right on desktop) */}
        <div 
          ref={editorRef} 
          className="lg:col-span-3 flex-none lg:flex-1 h-[650px] lg:h-full min-h-0 flex flex-col scroll-mt-6"
        >
          <Card className="flex flex-col h-full border-border/30 shadow-md bg-card/80 backdrop-blur-xl overflow-hidden rounded-[1.5rem] transition-shadow hover:shadow-lg">
            
            {/* Title & Toolbar */}
            <div className="shrink-0 p-4 border-b border-border/30 bg-muted/10 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter Note Title..."
                  className="text-xl md:text-2xl font-bold h-12 border-transparent bg-transparent px-2 hover:bg-muted/30 focus-visible:bg-background focus-visible:border-primary/40 focus-visible:ring-2 transition-all rounded-xl shadow-none placeholder:text-muted-foreground/40"
                />
                {currentNote && (
                  <Button onClick={copyNoteLink} size="sm" variant="outline" className="shrink-0 rounded-xl hover:bg-muted/50 transition-colors active:scale-95">
                    <Share2 className="h-4 w-4 sm:mr-2 text-muted-foreground" />
                    <span className="hidden sm:inline font-semibold">Share</span>
                  </Button>
                )}
              </div>

              <Tabs value={editorMode} onValueChange={(v) => setEditorMode(v as "edit" | "preview")} className="w-full">
                <TabsList className="w-full sm:w-auto grid grid-cols-2 h-11 bg-muted/40 p-1 rounded-xl border border-border/30">
                  <TabsTrigger value="edit" className="text-xs font-bold uppercase tracking-wider rounded-lg data-[state=active]:shadow-sm transition-all duration-300">
                    <Edit className="h-3.5 w-3.5 mr-2" /> Edit
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="text-xs font-bold uppercase tracking-wider rounded-lg data-[state=active]:shadow-sm transition-all duration-300">
                    <Eye className="h-3.5 w-3.5 mr-2" /> Preview
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Editor / Preview Content Area */}
            <div className="flex-1 relative overflow-hidden bg-background/50 min-h-[400px]">
              
              {editorMode === "edit" ? (
                <div className="absolute inset-0 p-4 sm:p-5">
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Start typing your markdown here...&#10;&#10;**Bold** and *Italic*&#10;- Bullet lists&#10;1. Numbered lists&#10;```js&#10;Code blocks&#10;```"
                    className="w-full h-full resize-none border-0 focus-visible:ring-0 p-0 text-[15px] leading-relaxed font-mono custom-scrollbar shadow-none bg-transparent"
                    style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace' }}
                  />
                  <div className="absolute bottom-4 right-6 text-[10px] font-bold tracking-widest uppercase text-muted-foreground/40 bg-background/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-border/30 pointer-events-none shadow-sm">
                    Markdown Supported
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 p-5 sm:p-8 overflow-y-auto overflow-x-hidden custom-scrollbar bg-background">
                  <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none w-full break-words
                      prose-headings:font-bold prose-headings:tracking-tight
                      prose-a:text-primary prose-a:underline-offset-4 hover:prose-a:text-primary/80
                      prose-hr:border-border/50
                      prose-img:rounded-xl prose-img:border prose-img:border-border/50 prose-img:shadow-md">
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

            {/* Save Button Footer */}
            <div className="shrink-0 p-4 border-t border-border/30 bg-muted/10 flex justify-end">
              <Button 
                onClick={saveNote} 
                disabled={saving || (!title.trim() && !content.trim())} 
                className="w-full sm:w-auto shadow-md hover:shadow-lg active:scale-95 transition-all duration-200 rounded-xl h-11 px-8 text-sm font-bold"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {currentNote ? "Save Changes" : "Create Note"}
                  </>
                )}
              </Button>
            </div>
            
          </Card>
        </div>
      </div>
    </div>
  );
};