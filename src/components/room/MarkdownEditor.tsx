import { useState, useEffect } from "react";
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

// Custom components for enhanced markdown rendering
const MarkdownComponents = {
  code({ node, inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || '');
    return !inline && match ? (
      <SyntaxHighlighter
        style={oneDark}
        language={match[1]}
        PreTag="div"
        className="rounded-md text-sm"
        {...props}
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    ) : (
      <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
        {children}
      </code>
    );
  },
  blockquote({ children }: any) {
    return (
      <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground my-4">
        {children}
      </blockquote>
    );
  },
  table({ children }: any) {
    return (
      <div className="overflow-x-auto my-4">
        <table className="min-w-full border-collapse border border-border">
          {children}
        </table>
      </div>
    );
  },
  th({ children }: any) {
    return (
      <th className="border border-border px-4 py-2 bg-muted font-semibold text-left">
        {children}
      </th>
    );
  },
  td({ children }: any) {
    return (
      <td className="border border-border px-4 py-2">
        {children}
      </td>
    );
  },
};

export const MarkdownEditor = ({ roomId, userId }: MarkdownEditorProps) => {
  const { toast } = useToast();
  const [notes, setNotes] = useState<MarkdownNote[]>([]);
  const [currentNote, setCurrentNote] = useState<MarkdownNote | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showNoteList, setShowNoteList] = useState(true);
  const [editorMode, setEditorMode] = useState<"edit" | "preview">("edit");

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
        () => {
          loadNotes();
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
        toast({ title: "Note updated!" });
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
        toast({ title: "Note created!" });
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
  };

  const selectNote = (note: MarkdownNote) => {
    setCurrentNote(note);
    setTitle(note.title);
    setContent(note.content);
  };

  const deleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from("markdown_notes")
        .delete()
        .eq("id", noteId);

      if (error) throw error;

      toast({ title: "Note deleted!" });
      
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
      description: "Share this link to view the note.",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mobile-first header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Shared Notes</h3>
          <span className="text-sm text-muted-foreground">({notes.length})</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => setShowNoteList(!showNoteList)} 
            size="sm" 
            variant="outline"
            className="sm:hidden"
          >
            {showNoteList ? "Hide" : "Show"} Notes
          </Button>
          <Button onClick={createNewNote} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            New Note
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Notes List - Mobile responsive */}
        <div className={`lg:col-span-1 ${showNoteList ? 'block' : 'hidden lg:block'}`}>
          <Card className="p-4">
            <h4 className="font-medium text-foreground mb-3">Your Notes</h4>
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes yet</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      currentNote?.id === note.id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => selectNote(note)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">
                          {note.title || "Untitled"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(note.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                      {note.created_by === userId && (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNote(note.id);
                          }}
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Editor/Preview - Mobile responsive */}
        <div className="lg:col-span-3">
          <Card className="p-4">
            <div className="space-y-4">
              {/* Title input */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="title" className="text-sm font-medium">Note Title</Label>
                  {currentNote && (
                    <Button onClick={copyNoteLink} size="sm" variant="ghost">
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </Button>
                  )}
                </div>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter note title..."
                  className="text-lg font-medium"
                />
              </div>

              {/* Editor Tabs */}
              <Tabs value={editorMode} onValueChange={(value) => {
                const newMode = value as "edit" | "preview";
                setEditorMode(newMode);
              }} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="edit" className="flex items-center gap-2">
                    <Edit className="h-4 w-4" />
                    <span className="hidden sm:inline">Edit</span>
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    <span className="hidden sm:inline">Preview</span>
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="edit" className="space-y-4 mt-4">
                  <div className="relative">
                    <Textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Write your markdown here...&#10;&#10;**Bold text**&#10;*Italic text*&#10;`inline code`&#10;&#10;```javascript&#10;console.log('code block');&#10;```&#10;&#10;- List item&#10;1. Numbered item&#10;&#10;> Blockquote&#10;&#10;| Table | Header |&#10;|-------|--------|&#10;| Cell  | Content|"
                      className="min-h-[400px] font-mono text-sm leading-relaxed resize-none"
                      style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace' }}
                    />
                    <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background px-2 py-1 rounded">
                      Markdown supported
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="preview" className="mt-4">
                  <Card className="p-6 min-h-[400px] bg-card border-0">
                    <div className="prose prose-sm sm:prose-base lg:prose-lg max-w-none dark:prose-invert 
                      prose-headings:text-foreground prose-headings:font-semibold
                      prose-p:text-foreground prose-p:leading-relaxed
                      prose-strong:text-foreground prose-strong:font-semibold
                      prose-em:text-foreground prose-em:italic
                      prose-code:text-primary prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
                      prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0
                      prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground prose-blockquote:font-normal prose-blockquote:not-italic
                      prose-ul:text-foreground prose-ol:text-foreground prose-li:text-foreground
                      prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                      prose-hr:border-border
                      prose-table:text-foreground
                      prose-th:bg-muted prose-th:text-foreground prose-th:font-semibold prose-th:border-border
                      prose-td:border-border prose-td:text-foreground">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm, remarkBreaks]}
                        components={MarkdownComponents}
                      >
                        {content || "*Nothing to preview yet. Start writing in the Edit tab!*"}
                      </ReactMarkdown>
                    </div>
                  </Card>
                </TabsContent>
              </Tabs>

              {/* Save button */}
              <Button onClick={saveNote} disabled={saving} className="w-full" size="lg">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {currentNote ? "Update Note" : "Save Note"}
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
