import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const CONTACT_EMAIL = "hello@justsomemanga.com";

// Facebook's Data Deletion requirement accepts a plain instructions page
// (rather than an automated callback endpoint) as long as it's clear about
// what gets deleted and how to request it — there's no self-service delete
// button in the app yet, so email is the actual process this describes.
const CONTENT = {
  th: {
    title: "การลบบัญชีและข้อมูล",
    intro:
      "ถ้าคุณต้องการลบบัญชี NotAManga และข้อมูลทั้งหมดที่เกี่ยวข้อง ไม่ว่าจะสมัครด้วยชื่อผู้ใช้/รหัสผ่าน หรือเข้าสู่ระบบผ่าน Google/Facebook ก็ตาม ทำตามขั้นตอนนี้ได้เลย",
    steps: [
      `ส่งอีเมลมาที่ ${CONTACT_EMAIL} จากอีเมลที่ผูกกับบัญชีของคุณ (หรือแจ้งชื่อผู้ใช้ในเนื้อหาอีเมลถ้าไม่มีอีเมลผูกไว้)`,
      "ระบุหัวข้ออีเมลว่า \"ขอลบบัญชี\" พร้อมชื่อผู้ใช้ของคุณ",
      "เราจะยืนยันตัวตนและดำเนินการลบข้อมูลภายใน 30 วัน แล้วตอบกลับอีเมลยืนยันเมื่อเสร็จสิ้น",
    ],
    whatGetsDeleted: {
      heading: "ข้อมูลที่จะถูกลบ",
      items: [
        "ข้อมูลบัญชี: ชื่อผู้ใช้ อีเมล รหัสผ่านที่เข้ารหัส และการเชื่อมต่อกับ Google/Facebook",
        "รูปโปรไฟล์ แบนเนอร์ และประวัติย่อ (bio)",
        "เรตติ้งที่คุณให้ไว้ และรายการ/คลังที่คุณสร้าง",
      ],
    },
    whatStays: {
      heading: "ข้อมูลที่อาจไม่ถูกลบทันที",
      items: [
        "ผลงาน (มังงะ/นิยาย) ที่คุณอัปโหลดไว้จะยังอยู่บนเว็บไซต์ เว้นแต่คุณระบุในอีเมลว่าต้องการให้ลบผลงานเหล่านั้นไปด้วย",
        "สถิติยอดวิวที่นับไว้ก่อนหน้า (ไม่ผูกกับตัวตนคุณโดยตรง) อาจยังคงอยู่ในระบบเพื่อความถูกต้องของสถิติ",
      ],
    },
  },
  en: {
    title: "Account & Data Deletion",
    intro:
      "If you'd like to delete your NotAManga account and the data tied to it — whether you signed up with a username/password or through Google/Facebook — here's how.",
    steps: [
      `Email ${CONTACT_EMAIL} from the address on your account (or mention your username in the email if none is set).`,
      'Use the subject line "Account deletion request" and include your username.',
      "We'll verify it's you and delete your data within 30 days, then reply to confirm once it's done.",
    ],
    whatGetsDeleted: {
      heading: "What gets deleted",
      items: [
        "Account information: username, email, hashed password, and any Google/Facebook link.",
        "Profile picture, banner, and bio.",
        "Ratings you've given, and any lists/library you've created.",
      ],
    },
    whatStays: {
      heading: "What might not be deleted immediately",
      items: [
        "Works (manga/novels) you've uploaded stay on the site unless your email also asks for those to be removed.",
        "Previously-counted view statistics (not tied to your identity directly) may remain for accuracy of those counts.",
      ],
    },
  },
};

export default function DataDeletionPage() {
  const { lang, t } = useLanguage();
  const content = CONTENT[lang] || CONTENT.en;
  useDocumentTitle(content.title);

  return (
    <div className="page legal-page">
      <Link to="/" className="btn btn-ghost btn-sm">
        &larr; {t("browse.title")}
      </Link>

      <h1>{content.title}</h1>

      <div className="manga-description">
        <p>{content.intro}</p>

        <ol>
          {content.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>

        <h2>{content.whatGetsDeleted.heading}</h2>
        <ul>
          {content.whatGetsDeleted.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>

        <h2>{content.whatStays.heading}</h2>
        <ul>
          {content.whatStays.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>

        <p>
          <Link to="/privacy-policy">{lang === "th" ? "← นโยบายความเป็นส่วนตัว" : "← Privacy Policy"}</Link>
        </p>
      </div>
    </div>
  );
}
