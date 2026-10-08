// One source for every translated study note in the demo. Style rule (PRD §4 F9): explain in the
// student's language, keep technical terms in English exactly as the exam paper writes them.
// Reviewed for grammar and natural phrasing; a native speaker should still sign off before launch.
import type { Topic } from "./syllabus";

export type Lang = "en" | "kn" | "hi";
export type Style = "short" | "detailed";

export const OVERRIDING: Record<Lang, Record<Style, string>> = {
  en: {
    short:
      "Method overriding means a subclass rewrites a method it inherits, keeping the same name and parameters. Which version runs is decided at runtime by the object's actual type. This is called dynamic method dispatch.",
    detailed:
      "Method overriding happens when a subclass gives its own body to a method it inherits, keeping the same name, parameters and return type. When the method is called through a parent class reference, Java looks at the object's actual type at runtime and runs that version. This is called dynamic method dispatch. Example: if Circle overrides area() from Shape, then Shape s = new Circle(); s.area(); runs Circle's area(). Use super.method() to call the parent class version.",
  },
  kn: {
    short:
      "Method overriding ಎಂದರೆ, subclass ತಾನು inherit ಮಾಡಿಕೊಂಡ method ಅನ್ನು ಅದೇ ಹೆಸರು ಮತ್ತು ಅದೇ parameters ಜೊತೆಗೆ ಪುನಃ ಬರೆಯುವುದು. ಯಾವ method ಚಲಾಯಿಸಬೇಕು ಎಂಬುದನ್ನು runtime ನಲ್ಲಿ object ನ ನಿಜವಾದ type ನಿರ್ಧರಿಸುತ್ತದೆ. ಇದನ್ನೇ dynamic method dispatch ಎನ್ನುತ್ತಾರೆ.",
    detailed:
      "Method overriding ಎಂದರೆ, subclass ತಾನು inherit ಮಾಡಿಕೊಂಡ method ಗೆ ತನ್ನದೇ ಆದ body ಕೊಡುವುದು; ಹೆಸರು, parameters ಮತ್ತು return type ಬದಲಾಗುವುದಿಲ್ಲ. Parent class ನ reference ಮೂಲಕ method ಅನ್ನು ಕರೆದಾಗ, ಯಾವ version ಚಲಾಯಿಸಬೇಕು ಎಂಬುದನ್ನು Java runtime ನಲ್ಲಿ object ನ ನಿಜವಾದ type ನೋಡಿ ನಿರ್ಧರಿಸುತ್ತದೆ. ಇದನ್ನೇ dynamic method dispatch ಎನ್ನುತ್ತಾರೆ. ಉದಾಹರಣೆ: Circle class, Shape ನ area() ಅನ್ನು override ಮಾಡಿದರೆ, Shape s = new Circle(); s.area(); ಎಂದು ಕರೆದಾಗ Circle ನ area() ಚಲಾಯಿಸಲ್ಪಡುತ್ತದೆ. Parent class ನ version ಬೇಕಾದರೆ super.method() ಬಳಸಿ.",
  },
  hi: {
    short:
      "Method overriding का मतलब है कि subclass, inherit किए गए method को उसी नाम और उन्हीं parameters के साथ दोबारा लिखती है। कौन-सा method चलेगा, यह runtime पर object के असली type से तय होता है। इसे dynamic method dispatch कहते हैं।",
    detailed:
      "Method overriding में subclass, inherit किए गए method को अपनी body देती है; नाम, parameters और return type वही रहते हैं। जब parent class के reference से method को call किया जाता है, तब Java runtime पर object का असली type देखकर तय करता है कि कौन-सा version चलेगा। इसे dynamic method dispatch कहते हैं। उदाहरण: अगर Circle class, Shape के area() को override करती है, तो Shape s = new Circle(); s.area(); चलाने पर Circle का area() चलेगा। Parent class का version चाहिए तो super.method() लिखें।",
  },
};

/** Note for any syllabus topic, built from its unit and subtopics. */
export function topicNote(t: Topic): Record<Lang, string> {
  if (/overriding/i.test(t.topic)) return { en: OVERRIDING.en.short, kn: OVERRIDING.kn.short, hi: OVERRIDING.hi.short };
  const subs = t.subtopics.join(", ");
  return {
    en: `${t.topic}: the key points are ${subs}. This topic is in Unit ${t.unit} (${t.unitTitle}) of ${t.subject} and comes up often in exams. Learn each definition first, then practise one example for every point.`,
    kn: `${t.topic}: ಈ topic ನ ಮುಖ್ಯ ಅಂಶಗಳು ${subs}. ಇದು ${t.subject} ನ Unit ${t.unit} (${t.unitTitle}) ಗೆ ಸೇರಿದ್ದು, exam ನಲ್ಲಿ ಆಗಾಗ ಕೇಳಲಾಗುತ್ತದೆ. ಮೊದಲು ಪ್ರತಿಯೊಂದು ಅಂಶದ definition ಕಲಿಯಿರಿ, ನಂತರ ಪ್ರತಿ ಅಂಶಕ್ಕೂ ಒಂದು example ಅಭ್ಯಾಸ ಮಾಡಿ.`,
    hi: `${t.topic}: इस topic के मुख्य points हैं ${subs}। यह ${t.subject} की Unit ${t.unit} (${t.unitTitle}) का हिस्सा है और exam में अक्सर पूछा जाता है। पहले हर point की definition याद करें, फिर हर point का एक example practice करें।`,
  };
}
