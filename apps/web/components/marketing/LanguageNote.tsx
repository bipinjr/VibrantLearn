import { OVERRIDING } from "@/lib/demo/notes-i18n";
import styles from "./language-note.module.css";

const NOTES = [
  { id: "en", label: "English", lang: "en", text: OVERRIDING.en.short },
  { id: "kn", label: "ಕನ್ನಡ", lang: "kn", text: OVERRIDING.kn.short },
  { id: "hi", label: "हिन्दी", lang: "hi", text: OVERRIDING.hi.short },
] as const;

/** Language switch with no JavaScript: native radios + :has(). Keyboard works out of the box. */
export function LanguageNote() {
  return (
    <div className={styles.wrap}>
      <fieldset className={styles.switch}>
        <legend className="sr-only">Show notes in</legend>
        {NOTES.map((n, i) => (
          <label key={n.id} className="chip text-sm" lang={n.lang}>
            <input type="radio" name="note-lang" value={n.id} defaultChecked={i === 1} />
            {n.label}
          </label>
        ))}
      </fieldset>
      {NOTES.map((n) => (
        <p key={n.id} lang={n.lang} data-lang={n.id} className={styles.note}>
          {n.text}
        </p>
      ))}
    </div>
  );
}
