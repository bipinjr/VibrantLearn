import { ArrowUp, FileText, Paperclip } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import type { StudyFile } from "@/lib/demo/data";

type Props = {
  files: StudyFile[];
  sessionTitle: string;
  busy: boolean;
  onSend: (text: string) => void;
  onFiles: (files: File[]) => void;
  autoFocus?: boolean;
  placeholder?: string;
};

export function Composer({ files, sessionTitle, busy, onSend, onFiles, autoFocus, placeholder }: Props) {
  const [text, setText] = useState("");
  const [mention, setMention] = useState<{ query: string; index: number } | null>(null);
  const [drag, setDrag] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const listId = useId();

  const matches = mention ? files.filter((f) => f.name.toLowerCase().includes(mention.query.toLowerCase())).slice(0, 6) : [];

  function updateMention(value: string, caret: number) {
    const before = value.slice(0, caret);
    const m = before.match(/@([\w.\-]*)$/);
    setMention(m ? { query: m[1], index: 0 } : null);
  }

  function insertMention(name: string) {
    const el = area.current;
    if (!el) return;
    const caret = el.selectionStart;
    const before = text.slice(0, caret).replace(/@[\w.\-]*$/, `@${name} `);
    const next = before + text.slice(caret);
    setText(next);
    setMention(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(before.length, before.length);
    });
  }

  function submit() {
    const t = text.trim();
    if (!t || busy) return;
    onSend(t.slice(0, 4000));
    setText("");
    setMention(null);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (mention && matches.length) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const d = e.key === "ArrowDown" ? 1 : -1;
        setMention({ ...mention, index: (mention.index + d + matches.length) % matches.length });
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(matches[mention.index].name);
        return;
      }
      if (e.key === "Escape") {
        setMention(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div
      className="relative"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDrag(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (e.dataTransfer.files.length) onFiles([...e.dataTransfer.files]);
      }}
    >
      {mention && matches.length ? (
        <ul id={listId} role="listbox" aria-label="Files in this session" className="pop-in absolute inset-x-0 bottom-full mb-2 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface p-1 shadow-[var(--shadow-float)]">
          {matches.map((f, i) => (
            <li key={f.id} role="option" aria-selected={i === mention.index}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertMention(f.name)}
                className={`flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-sm ${i === mention.index ? "bg-text/[0.07]" : "hover:bg-text/[0.04]"}`}
              >
                <FileText size={15} strokeWidth={1.75} className="text-muted" aria-hidden="true" />
                <span className="truncate">{f.name}</span>
                <span className="ml-auto text-xs capitalize text-muted">{f.status}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className={`composer flex items-end gap-2 rounded-[var(--radius-sheet)] border bg-surface p-2 pl-3 shadow-[var(--shadow-float)] transition-colors ${drag ? "border-link border-dashed" : "border-line"}`}>
        <button type="button" className="grid size-10 shrink-0 place-items-center rounded-[12px] text-muted transition-colors hover:bg-text/[0.06] hover:text-text" aria-label="Attach notes" onClick={() => picker.current?.click()}>
          <Paperclip size={19} strokeWidth={1.75} />
        </button>
        <input
          ref={picker}
          type="file"
          multiple
          hidden
          accept=".pdf,.docx,.pptx,.txt,.md,.csv,.json,.xml,.html,.css,.js,.ts,.py,.java,.c,.cpp,.jpg,.jpeg,.png,.webp"
          onChange={(e) => {
            if (e.target.files?.length) onFiles([...e.target.files]);
            e.target.value = "";
          }}
        />
        <label htmlFor={`${listId}-input`} className="sr-only">
          Message
        </label>
        <textarea
          id={`${listId}-input`}
          ref={area}
          rows={1}
          autoFocus={autoFocus}
          value={text}
          maxLength={4000}
          placeholder={placeholder ?? "Ask for a plan, notes or a quiz. @ for files"}
          onChange={(e) => {
            setText(e.target.value);
            updateMention(e.target.value, e.target.selectionStart);
          }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={Boolean(mention && matches.length)}
          aria-controls={listId}
          aria-autocomplete="list"
          className="max-h-48 min-h-10 flex-1 resize-none bg-transparent py-2 text-[0.98rem] outline-none [field-sizing:content] placeholder:text-muted/80"
        />
        <button type="button" onClick={submit} disabled={!text.trim() || busy} aria-label="Send" className="btn btn-primary size-10 shrink-0 rounded-[12px] p-0">
          <ArrowUp size={19} strokeWidth={2.25} />
        </button>
      </div>

      {drag ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-[var(--radius-sheet)] bg-surface/90 text-sm font-medium">
          Drop to add to {sessionTitle}
        </div>
      ) : null}
    </div>
  );
}
