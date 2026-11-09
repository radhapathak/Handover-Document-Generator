"use client";
import { useEffect } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import { Bold, Italic, Underline, Heading3, Heading4, List, ListOrdered, Table as TableIcon, Undo2, Redo2, Rows3, Columns3, Trash2, Pilcrow } from "lucide-react";
import { cx } from "@/components/shared/ui";

export function RichEditor({ html, onChange, editable }: { html: string; onChange: (html: string) => void; editable: boolean }) {
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [StarterKit.configure({ heading: { levels: [3, 4] }, link: false }), Table.configure({ resizable: false }), TableRow, TableHeader, TableCell],
    content: html,
    editorProps: { attributes: { class: "doc-prose", "aria-label": "Section content" } },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });
  useEffect(() => { if (editor && editor.isEditable !== editable) editor.setEditable(editable, false); }, [editor, editable]);
  if (!editor) return <div className="min-h-[260px]" />;
  return (
    <div>
      {editable && <Toolbar editor={editor} />}
      <div className="px-5 py-4"><EditorContent editor={editor} /></div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const B = ({ on, active, label, icon: I, disabled }: { on: () => void; active?: boolean; label: string; icon: React.ComponentType<{ className?: string }>; disabled?: boolean }) => (
    <button type="button" title={label} aria-label={label} aria-pressed={active} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={on}
      className={cx("rounded p-1.5 text-muted hover:bg-surface hover:text-ink disabled:opacity-30", active && "bg-brand-100 text-brand-700")}>
      <I className="h-4 w-4" />
    </button>
  );
  const c = () => editor.chain().focus();
  const inTable = editor.isActive("table");
  return (
    <div className="sticky top-14 z-10 flex flex-wrap items-center gap-0.5 border-b border-line bg-white px-2 py-1" role="toolbar" aria-label="Formatting">
      <B label="Paragraph" icon={Pilcrow} on={() => c().setParagraph().run()} active={editor.isActive("paragraph")} />
      <B label="Heading" icon={Heading3} on={() => c().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} />
      <B label="Sub-heading" icon={Heading4} on={() => c().toggleHeading({ level: 4 }).run()} active={editor.isActive("heading", { level: 4 })} />
      <span className="mx-1 h-5 w-px bg-line" />
      <B label="Bold" icon={Bold} on={() => c().toggleBold().run()} active={editor.isActive("bold")} />
      <B label="Italic" icon={Italic} on={() => c().toggleItalic().run()} active={editor.isActive("italic")} />
      <B label="Underline" icon={Underline} on={() => c().toggleUnderline().run()} active={editor.isActive("underline")} />
      <span className="mx-1 h-5 w-px bg-line" />
      <B label="Bullet list" icon={List} on={() => c().toggleBulletList().run()} active={editor.isActive("bulletList")} />
      <B label="Numbered list" icon={ListOrdered} on={() => c().toggleOrderedList().run()} active={editor.isActive("orderedList")} />
      <span className="mx-1 h-5 w-px bg-line" />
      <B label="Insert table" icon={TableIcon} on={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
      <B label="Add row" icon={Rows3} disabled={!inTable} on={() => c().addRowAfter().run()} />
      <B label="Add column" icon={Columns3} disabled={!inTable} on={() => c().addColumnAfter().run()} />
      <B label="Delete table" icon={Trash2} disabled={!inTable} on={() => c().deleteTable().run()} />
      <span className="mx-1 h-5 w-px bg-line" />
      <B label="Undo" icon={Undo2} on={() => c().undo().run()} disabled={!editor.can().undo()} />
      <B label="Redo" icon={Redo2} on={() => c().redo().run()} disabled={!editor.can().redo()} />
    </div>
  );
}
