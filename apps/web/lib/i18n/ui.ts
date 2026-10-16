// App interface text in Kannada and Hindi. The English string is the key, so a missing entry simply
// shows English. Style: plain everyday words, technical terms (AI, PDF, quiz topic names) left in
// English the way students say them. Reviewed for grammar; a native speaker should sign off before launch.
import type { Lang } from "@/lib/demo/notes-i18n";

export const UI_LANG_COOKIE = "vl_ui_lang";
export const isLang = (v: unknown): v is Lang => v === "en" || v === "kn" || v === "hi";

type Vars = Record<string, string | number>;

export const MODE_LABEL = { sprint: "Sprint plan", crash: "Crash plan", steady: "Steady plan", deep: "Deep plan" } as const;

// [Kannada, Hindi]
const DICT: Record<string, [string, string]> = {
  // navigation and shell
  Home: ["ಮುಖಪುಟ", "होम"],
  Plans: ["ಯೋಜನೆಗಳು", "प्लान"],
  Files: ["ಫೈಲ್‌ಗಳು", "फ़ाइलें"],
  Settings: ["ಸೆಟ್ಟಿಂಗ್‌ಗಳು", "सेटिंग्स"],
  New: ["ಹೊಸದು", "नया"],
  "New study session": ["ಹೊಸ ಅಧ್ಯಯನ ಸೆಷನ್", "नया स्टडी सेशन"],
  "Live classes": ["ಲೈವ್ ತರಗತಿಗಳು", "लाइव क्लास"],
  Soon: ["ಶೀಘ್ರದಲ್ಲೇ", "जल्द"],
  "Study sessions": ["ಅಧ್ಯಯನ ಸೆಷನ್‌ಗಳು", "स्टडी सेशन"],
  "No subject yet": ["ಇನ್ನೂ ವಿಷಯ ಇಲ್ಲ", "अभी कोई विषय नहीं"],
  "{course}, semester {n}": ["{course}, ಸೆಮಿಸ್ಟರ್ {n}", "{course}, सेमेस्टर {n}"],
  "Sign out": ["ಸೈನ್ ಔಟ್", "साइन आउट"],
  Dismiss: ["ಮುಚ್ಚಿ", "हटाएँ"],
  "Skip to content": ["ಮುಖ್ಯ ವಿಷಯಕ್ಕೆ ಹೋಗಿ", "सामग्री पर जाएँ"],
  "App navigation": ["ಆ್ಯಪ್ ನ್ಯಾವಿಗೇಶನ್", "ऐप नेविगेशन"],
  "Open menu": ["ಮೆನು ತೆರೆಯಿರಿ", "मेनू खोलें"],
  "Close menu": ["ಮೆನು ಮುಚ್ಚಿ", "मेनू बंद करें"],
  Menu: ["ಮೆನು", "मेनू"],
  Main: ["ಮುಖ್ಯ", "मुख्य"],
  Quick: ["ತ್ವರಿತ", "जल्दी"],
  "Couldn't save your last change. Check your connection; it will be lost if you reload.": [
    "ನಿಮ್ಮ ಕೊನೆಯ ಬದಲಾವಣೆಯನ್ನು ಉಳಿಸಲು ಆಗಲಿಲ್ಲ. ಇಂಟರ್ನೆಟ್ ಸಂಪರ್ಕ ಪರಿಶೀಲಿಸಿ; ಪುಟವನ್ನು reload ಮಾಡಿದರೆ ಅದು ಕಳೆದುಹೋಗುತ್ತದೆ.",
    "आपका पिछला बदलाव सेव नहीं हो पाया। इंटरनेट कनेक्शन जाँचें; पेज रीलोड करने पर यह खो जाएगा।",
  ],

  // dashboard
  "Good morning": ["ಶುಭೋದಯ", "सुप्रभात"],
  "Good afternoon": ["ಶುಭ ಮಧ್ಯಾಹ್ನ", "नमस्कार"],
  "Good evening": ["ಶುಭ ಸಂಜೆ", "शुभ संध्या"],
  "{date}. {plans} plans running, {steps} steps to go.": [
    "{date}. {plans} ಯೋಜನೆಗಳು ನಡೆಯುತ್ತಿವೆ, {steps} ಹಂತಗಳು ಬಾಕಿ ಇವೆ.",
    "{date}। {plans} प्लान चल रहे हैं, {steps} स्टेप बाकी हैं।",
  ],
  "Next up, {day}": ["ಮುಂದಿನದು, {day}", "अगला, {day}"],
  "Start block": ["ಶುರು ಮಾಡಿ", "शुरू करें"],
  "Mark done": ["ಮುಗಿದಿದೆ ಎಂದು ಗುರುತಿಸಿ", "पूरा हुआ मार्क करें"],
  "Mark not done": ["ಮುಗಿದಿಲ್ಲ ಎಂದು ಗುರುತಿಸಿ", "अधूरा मार्क करें"],
  "{subject} exam in": ["{subject} ಪರೀಕ್ಷೆಗೆ ಉಳಿದ ಸಮಯ", "{subject} परीक्षा में बाकी"],
  "{d} days {h} hours {m} minutes left": ["{d} ದಿನ {h} ಗಂಟೆ {m} ನಿಮಿಷ ಬಾಕಿ", "{d} दिन {h} घंटे {m} मिनट बाकी"],
  "Your progress": ["ನಿಮ್ಮ ಪ್ರಗತಿ", "आपकी प्रगति"],
  "Steps done": ["ಮುಗಿದ ಹಂತಗಳು", "पूरे हुए स्टेप"],
  "{done} of {total} steps done. {time} planned for the next 7 days.": [
    "{total} ರಲ್ಲಿ {done} ಹಂತಗಳು ಮುಗಿದಿವೆ. ಮುಂದಿನ 7 ದಿನಗಳಿಗೆ {time} ಯೋಜಿಸಲಾಗಿದೆ.",
    "{total} में से {done} स्टेप पूरे। अगले 7 दिनों के लिए {time} की योजना।",
  ],
  "In this demo, {pct}% of replies needed no AI call.": [
    "ಈ ಡೆಮೊದಲ್ಲಿ {pct}% ಉತ್ತರಗಳಿಗೆ AI ಕರೆ ಬೇಕಾಗಲಿಲ್ಲ.",
    "इस डेमो में {pct}% जवाबों के लिए AI कॉल की ज़रूरत नहीं पड़ी।",
  ],
  "{a} of {b}": ["{b} ರಲ್ಲಿ {a}", "{b} में से {a}"],
  "Planned for the next 7 days": ["ಮುಂದಿನ 7 ದಿನಗಳ ಯೋಜನೆ", "अगले 7 दिनों की योजना"],
  "{h} h {m} min": ["{h} ಗಂ {m} ನಿ", "{h} घं {m} मि"],
  "{d} d {h} h": ["{d} ದಿ {h} ಗಂ", "{d} दि {h} घं"],
  "{h} h": ["{h} ಗಂ", "{h} घं"],
  "{m} min": ["{m} ನಿ", "{m} मि"],
  "Answered without an AI call": ["AI ಇಲ್ಲದೆ ಉತ್ತರಿಸಿದ್ದು", "बिना AI कॉल के जवाब"],
  "Active plans": ["ಸಕ್ರಿಯ ಯೋಜನೆಗಳು", "चालू प्लान"],
  "All plans": ["ಎಲ್ಲಾ ಯೋಜನೆಗಳು", "सभी प्लान"],
  "Exam {day}, {time}. {left} left.": ["ಪರೀಕ್ಷೆ {day}, {time}. ಇನ್ನು {left}.", "परीक्षा {day}, {time}। {left} बाकी।"],
  "Sprint plan": ["ಸ್ಪ್ರಿಂಟ್ ಯೋಜನೆ", "स्प्रिंट प्लान"],
  "Crash plan": ["ಕ್ರ್ಯಾಶ್ ಯೋಜನೆ", "क्रैश प्लान"],
  "Steady plan": ["ಸ್ಥಿರ ಯೋಜನೆ", "स्टेडी प्लान"],
  "Deep plan": ["ಆಳವಾದ ಯೋಜನೆ", "डीप प्लान"],
  "Start something new": ["ಹೊಸದನ್ನು ಶುರು ಮಾಡಿ", "कुछ नया शुरू करें"],
  "One sentence is enough. Tap one or write your own.": [
    "ಒಂದು ವಾಕ್ಯ ಸಾಕು. ಒಂದನ್ನು ಟ್ಯಾಪ್ ಮಾಡಿ ಅಥವಾ ನಿಮ್ಮದೇ ಬರೆಯಿರಿ.",
    "एक वाक्य काफ़ी है। किसी एक पर टैप करें या अपना लिखें।",
  ],
  "Recent sessions": ["ಇತ್ತೀಚಿನ ಸೆಷನ್‌ಗಳು", "हाल के सेशन"],

  // new session
  "What’s your next test?": ["ನಿಮ್ಮ ಮುಂದಿನ ಪರೀಕ್ಷೆ ಯಾವುದು?", "आपका अगला टेस्ट कौन-सा है?"],
  "Subject and when it is. Kanglish and Hinglish are fine.": [
    "ವಿಷಯ ಮತ್ತು ಯಾವಾಗ ಎಂದು ತಿಳಿಸಿ. ಕನ್ನಡ, ಇಂಗ್ಲಿಷ್ ಅಥವಾ Kanglish ಎಲ್ಲವೂ ಸರಿ.",
    "विषय और कब है, बस इतना बताइए। हिंदी, अंग्रेज़ी या Hinglish, सब चलेगा।",
  ],
  "For example: Java internal tomorrow 10am": ["ಉದಾಹರಣೆ: nale 10 gantege Java internal", "जैसे: kal subah 10 baje Java internal"],
  Ideas: ["ಸಲಹೆಗಳು", "सुझाव"],
  "a new session": ["ಹೊಸ ಸೆಷನ್", "नया सेशन"],

  // session
  "Uploading {n}%": ["ಅಪ್‌ಲೋಡ್ ಆಗುತ್ತಿದೆ {n}%", "अपलोड हो रहा है {n}%"],
  "Uploading {name}": ["{name} ಅಪ್‌ಲೋಡ್ ಆಗುತ್ತಿದೆ", "{name} अपलोड हो रहा है"],
  Checking: ["ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ", "जाँच हो रही है"],
  Processing: ["ಸಿದ್ಧಪಡಿಸಲಾಗುತ್ತಿದೆ", "प्रोसेस हो रहा है"],
  Ready: ["ಸಿದ್ಧ", "तैयार"],
  Failed: ["ವಿಫಲವಾಗಿದೆ", "विफल"],
  "This session isn’t here": ["ಈ ಸೆಷನ್ ಇಲ್ಲಿ ಇಲ್ಲ", "यह सेशन यहाँ नहीं है"],
  "It may have been deleted. Start a new one with your next test.": [
    "ಇದನ್ನು ಅಳಿಸಿರಬಹುದು. ನಿಮ್ಮ ಮುಂದಿನ ಪರೀಕ್ಷೆಗೆ ಹೊಸದನ್ನು ಶುರು ಮಾಡಿ.",
    "शायद यह डिलीट हो गया है। अपने अगले टेस्ट के लिए नया शुरू करें।",
  ],
  "Tell me the subject and the exam date to get a plan": [
    "ಯೋಜನೆ ಬೇಕಾದರೆ ವಿಷಯ ಮತ್ತು ಪರೀಕ್ಷೆಯ ದಿನಾಂಕ ತಿಳಿಸಿ",
    "प्लान के लिए विषय और परीक्षा की तारीख बताइए",
  ],
  "Exam {day}, {time}": ["ಪರೀಕ್ಷೆ {day}, {time}", "परीक्षा {day}, {time}"],
  "{left} left": ["ಇನ್ನು {left}", "{left} बाकी"],
  "Delete session": ["ಸೆಷನ್ ಅಳಿಸಿ", "सेशन डिलीट करें"],
  Keep: ["ಇರಲಿ", "रहने दें"],
  "Subject and when it is. That’s all I need.": ["ವಿಷಯ ಮತ್ತು ಯಾವಾಗ ಎಂದು ತಿಳಿಸಿ. ಅಷ್ಟು ಸಾಕು.", "विषय और कब है, बस इतना चाहिए।"],
  "Thinking it through": ["ಯೋಚಿಸುತ್ತಿದ್ದೇನೆ", "सोच रहा हूँ"],
  "Building your plan": ["ನಿಮ್ಮ ಯೋಜನೆ ತಯಾರಾಗುತ್ತಿದೆ", "आपका प्लान बन रहा है"],
  "Writing your notes": ["ನಿಮ್ಮ ನೋಟ್ಸ್ ಬರೆಯುತ್ತಿದ್ದೇನೆ", "आपके नोट्स लिख रहा हूँ"],
  "Found it in your saved answers": ["ಉಳಿಸಿದ ಉತ್ತರಗಳಲ್ಲಿ ಸಿಕ್ಕಿತು", "सेव किए जवाबों में मिल गया"],
  "Reading your request": ["ನಿಮ್ಮ ಕೇಳಿಕೆಯನ್ನು ಓದುತ್ತಿದ್ದೇನೆ", "आपका सवाल पढ़ रहा हूँ"],
  "Session files and plan": ["ಸೆಷನ್ ಫೈಲ್‌ಗಳು ಮತ್ತು ಯೋಜನೆ", "सेशन की फ़ाइलें और प्लान"],
  Plan: ["ಯೋಜನೆ", "प्लान"],
  "{n} steps left": ["{n} ಹಂತಗಳು ಬಾಕಿ", "{n} स्टेप बाकी"],
  "Files in this session": ["ಈ ಸೆಷನ್‌ನ ಫೈಲ್‌ಗಳು", "इस सेशन की फ़ाइलें"],
  "Drop PDFs, slides or photos of your notes on the message box. Then ask about them with @.": [
    "ನಿಮ್ಮ ನೋಟ್ಸ್‌ನ PDF, ಸ್ಲೈಡ್‌ಗಳು ಅಥವಾ ಫೋಟೋಗಳನ್ನು ಮೆಸೇಜ್ ಬಾಕ್ಸ್ ಮೇಲೆ ಹಾಕಿ. ನಂತರ @ ಬಳಸಿ ಅವುಗಳ ಬಗ್ಗೆ ಕೇಳಿ.",
    "अपने नोट्स की PDF, स्लाइड या फ़ोटो मैसेज बॉक्स पर डालें। फिर @ लगाकर उनके बारे में पूछें।",
  ],
  "{n} pages": ["{n} ಪುಟಗಳು", "{n} पेज"],

  // composer
  "Attach notes": ["ನೋಟ್ಸ್ ಸೇರಿಸಿ", "नोट्स जोड़ें"],
  Message: ["ಸಂದೇಶ", "संदेश"],
  "Ask for a plan, notes or a quiz. @ for files": ["ಯೋಜನೆ, ನೋಟ್ಸ್ ಅಥವಾ ಕ್ವಿಜ್ ಕೇಳಿ. ಫೈಲ್‌ಗಳಿಗೆ @", "प्लान, नोट्स या क्विज़ माँगें। फ़ाइलों के लिए @"],
  Send: ["ಕಳುಹಿಸಿ", "भेजें"],
  "Drop to add to {title}": ["{title} ಗೆ ಸೇರಿಸಲು ಇಲ್ಲಿ ಬಿಡಿ", "{title} में जोड़ने के लिए यहाँ छोड़ें"],

  // plans
  "Every plan you're working on, soonest exam first.": ["ನೀವು ಮಾಡುತ್ತಿರುವ ಎಲ್ಲಾ ಯೋಜನೆಗಳು, ಹತ್ತಿರದ ಪರೀಕ್ಷೆ ಮೊದಲು.", "आपके सभी प्लान, सबसे पास वाली परीक्षा पहले।"],
  "New plan": ["ಹೊಸ ಯೋಜನೆ", "नया प्लान"],
  "No plans yet": ["ಇನ್ನೂ ಯಾವುದೇ ಯೋಜನೆ ಇಲ್ಲ", "अभी कोई प्लान नहीं"],
  "Tell us your next test and the plan appears in a few seconds.": [
    "ನಿಮ್ಮ ಮುಂದಿನ ಪರೀಕ್ಷೆ ತಿಳಿಸಿ, ಕೆಲವೇ ಸೆಕೆಂಡುಗಳಲ್ಲಿ ಯೋಜನೆ ಸಿದ್ಧ.",
    "अपना अगला टेस्ट बताइए, कुछ ही सेकंड में प्लान तैयार।",
  ],
  "Plan my next test": ["ನನ್ನ ಮುಂದಿನ ಪರೀಕ್ಷೆಗೆ ಯೋಜನೆ ಮಾಡಿ", "मेरे अगले टेस्ट का प्लान बनाओ"],
  "Exam {day} at {time}. {left} left, {done} of {total} steps done.": [
    "ಪರೀಕ್ಷೆ {day}, {time}. ಇನ್ನು {left}, {total} ರಲ್ಲಿ {done} ಹಂತಗಳು ಮುಗಿದಿವೆ.",
    "परीक्षा {day}, {time}। {left} बाकी, {total} में से {done} स्टेप पूरे।",
  ],
  Open: ["ತೆರೆಯಿರಿ", "खोलें"],
  "Plan not found": ["ಯೋಜನೆ ಸಿಗಲಿಲ್ಲ", "प्लान नहीं मिला"],
  "It may have been replaced by a newer plan in its session.": ["ಅದರ ಸೆಷನ್‌ನಲ್ಲಿ ಹೊಸ ಯೋಜನೆ ಬಂದಿರಬಹುದು.", "शायद उसके सेशन में नया प्लान बन गया है।"],
  "Back to plans": ["ಯೋಜನೆಗಳಿಗೆ ಹಿಂತಿರುಗಿ", "प्लान पर वापस"],
  "Exam {day} at {time}. {left} to go.": ["ಪರೀಕ್ಷೆ {day}, {time}. ಇನ್ನು {left}.", "परीक्षा {day}, {time}। {left} बाकी।"],
  "Open session": ["ಸೆಷನ್ ತೆರೆಯಿರಿ", "सेशन खोलें"],
  "Replan from now": ["ಈಗಿನಿಂದ ಮರುಯೋಜನೆ", "अभी से दोबारा प्लान करें"],
  "{done} of {total} steps done": ["{total} ರಲ್ಲಿ {done} ಹಂತಗಳು ಮುಗಿದಿವೆ", "{total} में से {done} स्टेप पूरे"],
  "About {h} h {m} min of study left.": ["ಸುಮಾರು {h} ಗಂ {m} ನಿ ಓದು ಬಾಕಿ.", "लगभग {h} घं {m} मि पढ़ाई बाकी।"],
  "Replanned. Finished steps stay ticked; everything else now starts from the current time, highest-mark topics first.": [
    "ಮರುಯೋಜನೆ ಆಯಿತು. ಮುಗಿದ ಹಂತಗಳು ಹಾಗೆಯೇ ಇರುತ್ತವೆ; ಉಳಿದವು ಈಗಿನಿಂದ ಶುರುವಾಗುತ್ತವೆ, ಹೆಚ್ಚು ಅಂಕದ topics ಮೊದಲು.",
    "दोबारा प्लान हो गया। पूरे हुए स्टेप टिक रहेंगे; बाकी सब अब से शुरू होंगे, ज़्यादा नंबर वाले topics पहले।",
  ],
  "{n} step is behind schedule. Replan from now to fit the time you have left.": [
    "{n} ಹಂತ ಸಮಯಕ್ಕಿಂತ ಹಿಂದೆ ಇದೆ. ಉಳಿದ ಸಮಯಕ್ಕೆ ಹೊಂದಿಸಲು ಈಗಿನಿಂದ ಮರುಯೋಜನೆ ಮಾಡಿ.",
    "{n} स्टेप समय से पीछे है। बचे समय के हिसाब से अभी से दोबारा प्लान करें।",
  ],
  "{n} steps are behind schedule. Replan from now to fit the time you have left.": [
    "{n} ಹಂತಗಳು ಸಮಯಕ್ಕಿಂತ ಹಿಂದೆ ಇವೆ. ಉಳಿದ ಸಮಯಕ್ಕೆ ಹೊಂದಿಸಲು ಈಗಿನಿಂದ ಮರುಯೋಜನೆ ಮಾಡಿ.",
    "{n} स्टेप समय से पीछे हैं। बचे समय के हिसाब से अभी से दोबारा प्लान करें।",
  ],
  Timeline: ["ಟೈಮ್‌ಲೈನ್", "टाइमलाइन"],
  Now: ["ಈಗ", "अभी"],
  Checkpoint: ["ಚೆಕ್‌ಪಾಯಿಂಟ್", "चेकपॉइंट"],

  // files
  All: ["ಎಲ್ಲಾ", "सभी"],
  "In progress": ["ಪ್ರಗತಿಯಲ್ಲಿ", "चल रहा है"],
  "Deleted session": ["ಅಳಿಸಿದ ಸೆಷನ್", "डिलीट हुआ सेशन"],
  "Notes, slides and photos you've added, across all sessions. Only you can see them.": [
    "ಎಲ್ಲಾ ಸೆಷನ್‌ಗಳಲ್ಲಿ ನೀವು ಸೇರಿಸಿದ ನೋಟ್ಸ್, ಸ್ಲೈಡ್‌ಗಳು ಮತ್ತು ಫೋಟೋಗಳು. ಇವು ನಿಮಗೆ ಮಾತ್ರ ಕಾಣುತ್ತವೆ.",
    "सभी सेशन में आपके जोड़े गए नोट्स, स्लाइड और फ़ोटो। इन्हें सिर्फ़ आप देख सकते हैं।",
  ],
  "Drop files here or choose them": ["ಫೈಲ್‌ಗಳನ್ನು ಇಲ್ಲಿ ಬಿಡಿ ಅಥವಾ ಆಯ್ಕೆ ಮಾಡಿ", "फ़ाइलें यहाँ छोड़ें या चुनें"],
  "PDF, Word, PowerPoint, text, code and photos. Up to 50 MB each.": [
    "PDF, Word, PowerPoint, text, code ಮತ್ತು ಫೋಟೋಗಳು. ಪ್ರತಿಯೊಂದೂ 50 MB ವರೆಗೆ.",
    "PDF, Word, PowerPoint, text, code और फ़ोटो। हर फ़ाइल 50 MB तक।",
  ],
  "Add to session": ["ಸೆಷನ್‌ಗೆ ಸೇರಿಸಿ", "सेशन में जोड़ें"],
  "Upload notes": ["ನೋಟ್ಸ್ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ", "नोट्स अपलोड करें"],
  "Filter files": ["ಫೈಲ್‌ಗಳನ್ನು ಫಿಲ್ಟರ್ ಮಾಡಿ", "फ़ाइलें फ़िल्टर करें"],
  "Nothing here. Upload your notes and they’ll show up with their status.": [
    "ಇಲ್ಲಿ ಏನೂ ಇಲ್ಲ. ನೋಟ್ಸ್ ಅಪ್‌ಲೋಡ್ ಮಾಡಿದರೆ ಅವುಗಳ ಸ್ಥಿತಿಯ ಜೊತೆ ಇಲ್ಲಿ ಕಾಣುತ್ತವೆ.",
    "यहाँ कुछ नहीं है। नोट्स अपलोड करें, वे अपने स्टेटस के साथ यहाँ दिखेंगे।",
  ],
  Name: ["ಹೆಸರು", "नाम"],
  Session: ["ಸೆಷನ್", "सेशन"],
  Size: ["ಗಾತ್ರ", "साइज़"],
  Status: ["ಸ್ಥಿತಿ", "स्टेटस"],
  Added: ["ಸೇರಿಸಿದ್ದು", "जोड़ा गया"],

  // settings
  "Your profile, how you like to study, and your data.": [
    "ನಿಮ್ಮ ಪ್ರೊಫೈಲ್, ನೀವು ಹೇಗೆ ಓದಲು ಇಷ್ಟಪಡುತ್ತೀರಿ, ಮತ್ತು ನಿಮ್ಮ ಡೇಟಾ.",
    "आपकी प्रोफ़ाइल, आप कैसे पढ़ना पसंद करते हैं, और आपका डेटा।",
  ],
  Profile: ["ಪ್ರೊಫೈಲ್", "प्रोफ़ाइल"],
  "Used to pick your syllabus and exam style.": ["ನಿಮ್ಮ ಸಿಲೆಬಸ್ ಮತ್ತು ಪರೀಕ್ಷಾ ಶೈಲಿ ಆಯ್ಕೆಗೆ ಬಳಸಲಾಗುತ್ತದೆ.", "आपका सिलेबस और परीक्षा का पैटर्न चुनने के लिए।"],
  Username: ["ಬಳಕೆದಾರ ಹೆಸರು", "यूज़रनेम"],
  "Usernames can’t be changed in the prototype.": ["ಈ ಪ್ರೋಟೋಟೈಪ್‌ನಲ್ಲಿ ಬಳಕೆದಾರ ಹೆಸರು ಬದಲಿಸಲು ಆಗುವುದಿಲ್ಲ.", "इस प्रोटोटाइप में यूज़रनेम नहीं बदला जा सकता।"],
  University: ["ವಿಶ್ವವಿದ್ಯಾಲಯ", "यूनिवर्सिटी"],
  Course: ["ಕೋರ್ಸ್", "कोर्स"],
  Semester: ["ಸೆಮಿಸ್ಟರ್", "सेमेस्टर"],
  "Semester {n}": ["ಸೆಮಿಸ್ಟರ್ {n}", "सेमेस्टर {n}"],
  "Study preferences": ["ಓದಿನ ಆದ್ಯತೆಗಳು", "पढ़ाई की पसंद"],
  "Changes apply to new notes and plans.": ["ಬದಲಾವಣೆಗಳು ಹೊಸ ನೋಟ್ಸ್ ಮತ್ತು ಯೋಜನೆಗಳಿಗೆ ಅನ್ವಯಿಸುತ್ತವೆ.", "बदलाव नए नोट्स और प्लान पर लागू होंगे।"],
  "Explain things in": ["ವಿವರಣೆ ಈ ಭಾಷೆಯಲ್ಲಿ", "समझाने की भाषा"],
  "Notes should be": ["ನೋಟ್ಸ್ ಹೀಗಿರಲಿ", "नोट्स कैसे हों"],
  Short: ["ಚಿಕ್ಕದು", "छोटे"],
  Detailed: ["ವಿವರವಾದ", "विस्तार से"],
  "I like": ["ನನಗೆ ಇಷ್ಟ", "मुझे पसंद है"],
  Quizzes: ["ಕ್ವಿಜ್‌ಗಳು", "क्विज़"],
  Flashcards: ["ಫ್ಲ್ಯಾಶ್‌ಕಾರ್ಡ್‌ಗಳು", "फ़्लैशकार्ड"],
  "Short notes": ["ಚಿಕ್ಕ ನೋಟ್ಸ್", "छोटे नोट्स"],
  "Important questions": ["ಪ್ರಮುಖ ಪ್ರಶ್ನೆಗಳು", "महत्वपूर्ण प्रश्न"],
  "Past-paper style questions": ["ಹಿಂದಿನ ಪ್ರಶ್ನೆಪತ್ರಿಕೆ ಶೈಲಿಯ ಪ್ರಶ್ನೆಗಳು", "पिछले पेपर जैसे प्रश्न"],
  Timetable: ["ವೇಳಾಪಟ್ಟಿ", "टाइमटेबल"],
  Appearance: ["ತೋರಿಕೆ", "दिखावट"],
  "App language": ["ಆ್ಯಪ್ ಭಾಷೆ", "ऐप की भाषा"],
  "Menus, buttons and labels. Notes use the language under Study preferences.": [
    "ಮೆನು, ಬಟನ್‌ಗಳು ಮತ್ತು ಲೇಬಲ್‌ಗಳು. ನೋಟ್ಸ್ ಭಾಷೆ ‘ಓದಿನ ಆದ್ಯತೆಗಳು’ ಆಯ್ಕೆಯಂತೆ.",
    "मेनू, बटन और लेबल। नोट्स की भाषा ‘पढ़ाई की पसंद’ से तय होती है।",
  ],
  Theme: ["ಥೀಮ್", "थीम"],
  System: ["ಸಿಸ್ಟಮ್", "सिस्टम"],
  Light: ["ಲೈಟ್", "लाइट"],
  Dark: ["ಡಾರ್ಕ್", "डार्क"],
  Usage: ["ಬಳಕೆ", "इस्तेमाल"],
  "Limits keep the free AI quota fair for everyone.": ["ಉಚಿತ AI ಕೋಟಾ ಎಲ್ಲರಿಗೂ ನ್ಯಾಯವಾಗಿ ಸಿಗಲು ಮಿತಿಗಳಿವೆ.", "सीमाएँ इसलिए हैं ताकि मुफ़्त AI कोटा सबको बराबर मिले।"],
  "Messages in the last 10 minutes": ["ಕಳೆದ 10 ನಿಮಿಷಗಳ ಸಂದೇಶಗಳು", "पिछले 10 मिनट के संदेश"],
  "Plans this hour": ["ಈ ಗಂಟೆಯ ಯೋಜನೆಗಳು", "इस घंटे के प्लान"],
  "Uploads today": ["ಇಂದಿನ ಅಪ್‌ಲೋಡ್‌ಗಳು", "आज के अपलोड"],
  "Upload size today": ["ಇಂದಿನ ಅಪ್‌ಲೋಡ್ ಗಾತ್ರ", "आज का अपलोड साइज़"],
  "Your data": ["ನಿಮ್ಮ ಡೇಟಾ", "आपका डेटा"],
  "Download everything, or start the demo fresh.": ["ಎಲ್ಲವನ್ನೂ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ, ಅಥವಾ ಡೆಮೊವನ್ನು ಹೊಸದಾಗಿ ಶುರು ಮಾಡಿ.", "सब कुछ डाउनलोड करें, या डेमो नए सिरे से शुरू करें।"],
  "Download everything you've saved.": ["ನೀವು ಉಳಿಸಿದ ಎಲ್ಲವನ್ನೂ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ.", "आपका सेव किया सब कुछ डाउनलोड करें।"],
  "Export my data": ["ನನ್ನ ಡೇಟಾ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ", "मेरा डेटा डाउनलोड करें"],
  "Reset demo data": ["ಡೆಮೊ ಡೇಟಾ ಮರುಹೊಂದಿಸಿ", "डेमो डेटा रीसेट करें"],
  "Delete account": ["ಖಾತೆ ಅಳಿಸಿ", "अकाउंट डिलीट करें"],
  "Removes your profile, sessions, plans and every uploaded file. This can't be undone.": [
    "ನಿಮ್ಮ ಪ್ರೊಫೈಲ್, ಸೆಷನ್‌ಗಳು, ಯೋಜನೆಗಳು ಮತ್ತು ಅಪ್‌ಲೋಡ್ ಮಾಡಿದ ಎಲ್ಲಾ ಫೈಲ್‌ಗಳನ್ನು ಅಳಿಸುತ್ತದೆ. ಇದನ್ನು ಹಿಂಪಡೆಯಲು ಆಗುವುದಿಲ್ಲ.",
    "आपकी प्रोफ़ाइल, सेशन, प्लान और सभी अपलोड की गई फ़ाइलें हट जाएँगी। इसे वापस नहीं किया जा सकता।",
  ],
  "Type {name} to confirm": ["ಖಚಿತಪಡಿಸಲು {name} ಎಂದು ಟೈಪ್ ಮಾಡಿ", "पुष्टि के लिए {name} टाइप करें"],
  "Delete my account": ["ನನ್ನ ಖಾತೆ ಅಳಿಸಿ", "मेरा अकाउंट डिलीट करें"],
  "Deleting…": ["ಅಳಿಸಲಾಗುತ್ತಿದೆ…", "डिलीट हो रहा है…"],
  "Preparing…": ["ಸಿದ್ಧಪಡಿಸಲಾಗುತ್ತಿದೆ…", "तैयार हो रहा है…"],
  "AI answers this hour": ["ಈ ಗಂಟೆಯ AI ಉತ್ತರಗಳು", "इस घंटे के AI जवाब"],
  "Not available in the demo account": ["ಡೆಮೊ ಖಾತೆಯಲ್ಲಿ ಲಭ್ಯವಿಲ್ಲ", "डेमो अकाउंट में उपलब्ध नहीं"],
  "Turned off for the demo account.": ["ಡೆಮೊ ಖಾತೆಗೆ ಆಫ್ ಮಾಡಲಾಗಿದೆ.", "डेमो अकाउंट के लिए बंद है।"],
  "Account deletion is coming soon.": ["ಖಾತೆ ಅಳಿಸುವ ಸೌಲಭ್ಯ ಶೀಘ್ರದಲ್ಲೇ ಬರಲಿದೆ.", "अकाउंट डिलीट करने की सुविधा जल्द आएगी।"],
  "Coming soon": ["ಶೀಘ್ರದಲ್ಲೇ", "जल्द आ रहा है"],

  // study blocks
  Sources: ["ಮೂಲಗಳು", "स्रोत"],
  Copied: ["ನಕಲಾಯಿತು", "कॉपी हो गया"],
  Copy: ["ನಕಲಿಸಿ", "कॉपी करें"],
  "Notes: {topic}": ["ನೋಟ್ಸ್: {topic}", "नोट्स: {topic}"],
  Language: ["ಭಾಷೆ", "भाषा"],
  "This plan was replaced by a newer one in this session.": ["ಈ ಸೆಷನ್‌ನಲ್ಲಿ ಇದರ ಬದಲು ಹೊಸ ಯೋಜನೆ ಬಂದಿದೆ.", "इस सेशन में इसकी जगह नया प्लान बन गया है।"],
  "Open plan": ["ಯೋಜನೆ ತೆರೆಯಿರಿ", "प्लान खोलें"],
  "{done} of {total} steps done. Tick a step when you finish it.": [
    "{total} ರಲ್ಲಿ {done} ಹಂತಗಳು ಮುಗಿದಿವೆ. ಒಂದು ಹಂತ ಮುಗಿದಾಗ ಟಿಕ್ ಮಾಡಿ.",
    "{total} में से {done} स्टेप पूरे। स्टेप पूरा होने पर टिक करें।",
  ],
  "Important questions: {topic}": ["ಪ್ರಮುಖ ಪ್ರಶ್ನೆಗಳು: {topic}", "महत्वपूर्ण प्रश्न: {topic}"],
  "{n} marks": ["{n} ಅಂಕ", "{n} अंक"],
  "Practise these as a quiz": ["ಇವುಗಳನ್ನು ಕ್ವಿಜ್ ಆಗಿ ಅಭ್ಯಾಸ ಮಾಡಿ", "इन्हें क्विज़ की तरह प्रैक्टिस करें"],
  "Quiz: {topic}": ["ಕ್ವಿಜ್: {topic}", "क्विज़: {topic}"],
  "Flashcards: {topic}": ["ಫ್ಲ್ಯಾಶ್‌ಕಾರ್ಡ್‌ಗಳು: {topic}", "फ़्लैशकार्ड: {topic}"],
  "Answered on our side, no AI call": ["ನಮ್ಮಲ್ಲೇ ಉತ್ತರಿಸಲಾಗಿದೆ, AI ಕರೆ ಇಲ್ಲ", "हमारी तरफ़ से जवाब, कोई AI कॉल नहीं"],
  "From saved answers": ["ಉಳಿಸಿದ ಉತ್ತರಗಳಿಂದ", "सेव किए जवाबों से"],
  "Written by AI, checked against your syllabus": ["AI ಬರೆದಿದೆ, ನಿಮ್ಮ ಸಿಲೆಬಸ್‌ಗೆ ಹೊಂದಿಸಲಾಗಿದೆ", "AI ने लिखा, आपके सिलेबस से मिलाया गया"],

  // quiz
  "Scored {s} of {n}": ["{n} ರಲ್ಲಿ {s} ಅಂಕ", "{n} में से {s} अंक"],
  "{s} of {n} right": ["{n} ರಲ್ಲಿ {s} ಸರಿ", "{n} में से {s} सही"],
  "Clean sweep. This checkpoint is done.": ["ಎಲ್ಲವೂ ಸರಿ. ಈ ಚೆಕ್‌ಪಾಯಿಂಟ್ ಮುಗಿಯಿತು.", "सब सही। यह चेकपॉइंट पूरा हुआ।"],
  "Good. Fix the few you missed before the exam.": ["ಚೆನ್ನಾಗಿದೆ. ತಪ್ಪಿದ ಕೆಲವನ್ನು ಪರೀಕ್ಷೆಗೆ ಮೊದಲು ಸರಿಪಡಿಸಿಕೊಳ್ಳಿ.", "बढ़िया। जो छूटे, उन्हें परीक्षा से पहले ठीक कर लें।"],
  "These need another pass. Revise, then try again.": ["ಇವುಗಳನ್ನು ಇನ್ನೊಮ್ಮೆ ಓದಬೇಕು. ಪುನರಾವರ್ತಿಸಿ, ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", "इन्हें एक बार और पढ़ना होगा। दोहराएँ, फिर दोबारा कोशिश करें।"],
  "Revise these": ["ಇವುಗಳನ್ನು ಪುನರಾವರ್ತಿಸಿ", "इन्हें दोहराएँ"],
  "Try again": ["ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ", "फिर से कोशिश करें"],
  "Explain what I missed": ["ತಪ್ಪಿದ್ದನ್ನು ವಿವರಿಸಿ", "जो गलत हुआ, समझाओ"],
  "Question {i} of {n}": ["{n} ರಲ್ಲಿ {i}ನೇ ಪ್ರಶ್ನೆ", "प्रश्न {i} / {n}"],
  "Correct answer": ["ಸರಿಯಾದ ಉತ್ತರ", "सही उत्तर"],
  "Your answer, wrong": ["ನಿಮ್ಮ ಉತ್ತರ, ತಪ್ಪು", "आपका उत्तर, गलत"],
  "Correct.": ["ಸರಿ.", "सही।"],
  "Not quite.": ["ಸ್ವಲ್ಪ ತಪ್ಪಾಯಿತು.", "पूरा सही नहीं।"],
  "Next question": ["ಮುಂದಿನ ಪ್ರಶ್ನೆ", "अगला प्रश्न"],
  "Checking…": ["ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ…", "जाँच हो रही है…"],
  "See my score": ["ನನ್ನ ಅಂಕ ನೋಡಿ", "मेरा स्कोर देखें"],

  // flashcards
  "{k} known, {a} to see again": ["{k} ಗೊತ್ತಿದೆ, {a} ಮತ್ತೆ ನೋಡಬೇಕು", "{k} याद हैं, {a} फिर से देखने हैं"],
  "Cards you marked “Again” come back first next time.": [
    "‘ಮತ್ತೆ’ ಎಂದು ಗುರುತಿಸಿದ ಕಾರ್ಡ್‌ಗಳು ಮುಂದಿನ ಸಲ ಮೊದಲು ಬರುತ್ತವೆ.",
    "‘फिर से’ मार्क किए कार्ड अगली बार पहले आएँगे।",
  ],
  "Go again": ["ಮತ್ತೊಮ್ಮೆ", "फिर से करें"],
  "Know it": ["ಗೊತ್ತಿದೆ", "याद है"],
  Again: ["ಮತ್ತೆ", "फिर से"],
  "Answer: {back}. Press to see the question.": ["ಉತ್ತರ: {back}. ಪ್ರಶ್ನೆ ನೋಡಲು ಒತ್ತಿ.", "उत्तर: {back}। प्रश्न देखने के लिए दबाएँ।"],
  "{front}. Press to see the answer.": ["{front}. ಉತ್ತರ ನೋಡಲು ಒತ್ತಿ.", "{front}। उत्तर देखने के लिए दबाएँ।"],
  "Card {i} of {n}": ["{n} ರಲ್ಲಿ {i}ನೇ ಕಾರ್ಡ್", "कार्ड {i} / {n}"],
  "Tap or press Space to flip": ["ತಿರುಗಿಸಲು ಟ್ಯಾಪ್ ಮಾಡಿ ಅಥವಾ Space ಒತ್ತಿ", "पलटने के लिए टैप करें या Space दबाएँ"],
  Answer: ["ಉತ್ತರ", "उत्तर"],
  "Swipe or use the arrow keys": ["ಸ್ವೈಪ್ ಮಾಡಿ ಅಥವಾ arrow keys ಬಳಸಿ", "स्वाइप करें या arrow keys इस्तेमाल करें"],

  // relative time (lib/format.ts)
  Tonight: ["ಇಂದು ರಾತ್ರಿ", "आज रात"],
  Today: ["ಇಂದು", "आज"],
  "Tomorrow morning": ["ನಾಳೆ ಬೆಳಿಗ್ಗೆ", "कल सुबह"],
  Tomorrow: ["ನಾಳೆ", "कल"],
  now: ["ಈಗ", "अभी"],
  "{n} day": ["{n} ದಿನ", "{n} दिन"],
  "{n} days": ["{n} ದಿನ", "{n} दिन"],
  "{n} weeks": ["{n} ವಾರ", "{n} हफ़्ते"],
  "just now": ["ಈಗಷ್ಟೇ", "अभी-अभी"],
  "{n} min ago": ["{n} ನಿಮಿಷದ ಹಿಂದೆ", "{n} मिनट पहले"],
  "{n} h ago": ["{n} ಗಂಟೆ ಹಿಂದೆ", "{n} घंटे पहले"],
  yesterday: ["ನಿನ್ನೆ", "कल"],
  "{n} days ago": ["{n} ದಿನಗಳ ಹಿಂದೆ", "{n} दिन पहले"],
};

const fill = (s: string, vars?: Vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s);

/** Interface text in `lang`; English (the key) when there's no translation. */
export function translate(lang: Lang, key: string, vars?: Vars): string {
  const row = lang === "en" ? undefined : DICT[key];
  return fill(row ? row[lang === "kn" ? 0 : 1] : key, vars);
}

export type T = (key: string, vars?: Vars) => string;

/** For tests: every key whose translation drops or invents a {placeholder}. */
export function placeholderMismatches(): string[] {
  const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
  return Object.entries(DICT)
    .filter(([en, [kn, hi]]) => names(kn) !== names(en) || names(hi) !== names(en))
    .map(([en]) => en);
}
