import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Save, Eye, Edit, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
}

export const MarkdownEditor = ({ roomId, userId }: MarkdownEditorProps) => {
  const { toast } = useToast();
  const [notes, setNotes] = useState<MarkdownNote[]>([]);
  const [currentNote, setCurrentNote] = useState<MarkdownNote | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      
      if (data && data.length > 0) {
        setCurrentNote(data[0]);
        setTitle(data[0].title || "");
        setContent(data[0].content || "");
      }
    } catch (error: any) {
      toast({
        title: "Error loading notes",
        description: error.message,
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
          .update({ title, content })
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
    } catch (error: any) {
      toast({
        title: "Error saving note",
        description: error.message,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Shared Notes</h3>
        <Button onClick={createNewNote} size="sm" variant="outline">
          <Edit className="h-4 w-4 mr-2" />
          New Note
        </Button>
      </div>

      {notes.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {notes.map((note) => (
            <Button
              key={note.id}
              onClick={() => selectNote(note)}
              variant={currentNote?.id === note.id ? "default" : "outline"}
              size="sm"
            >
              {note.title}
            </Button>
          ))}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title..."
            className="mt-2"
          />
        </div>

        <Tabs defaultValue="edit" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="edit">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="edit" className="space-y-4">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your markdown here..."
              className="min-h-[300px] font-mono"
            />
          </TabsContent>
          
          <TabsContent value="preview">
            <Card className="p-6 min-h-[300px] bg-card">
              <div className="prose prose-sm md:prose-base max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-code:text-primary prose-pre:bg-muted prose-pre:text-foreground prose-a:text-primary hover:prose-a:text-primary/80 prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground prose-li:text-muted-foreground">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content || "*Nothing to preview yet*"}
                </ReactMarkdown>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        <Button onClick={saveNote} disabled={saving} className="w-full">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Note
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
