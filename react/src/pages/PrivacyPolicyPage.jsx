import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const CONTACT_EMAIL = "hello@justsomemanga.com";

// Plain content rather than the usual per-string i18n keys — this is one
// self-contained legal document, not UI copy reused across components, so a
// TH/EN block each is more maintainable than dozens of one-off t() keys.
const CONTENT = {
  th: {
    title: "นโยบายความเป็นส่วนตัว",
    updated: "ปรับปรุงล่าสุด: 18 สิงหาคม 2569",
    sections: [
      {
        heading: "ข้อมูลที่เราเก็บ",
        body: [
          "ข้อมูลบัญชี: ชื่อผู้ใช้ อีเมล (ถ้าให้ไว้) และรหัสผ่านที่เข้ารหัสแล้ว สำหรับบัญชีที่สมัครด้วยชื่อผู้ใช้/รหัสผ่าน",
          "ข้อมูลจากผู้ให้บริการเข้าสู่ระบบ: ถ้าคุณเลือกเข้าสู่ระบบด้วย Google หรือ Facebook เราจะได้รับชื่อ อีเมล และรหัสประจำตัวบัญชีนั้นๆ จากผู้ให้บริการ เพื่อใช้สร้าง/ผูกบัญชีของคุณกับเรา เราไม่เห็นรหัสผ่านของบัญชี Google/Facebook คุณ",
          "เนื้อหาที่คุณอัปโหลด: รูปโปรไฟล์ แบนเนอร์ ประวัติย่อ (bio) และผลงาน (มังงะ/นิยาย) ที่คุณเลือกอัปโหลดเอง",
          "การใช้งานเว็บไซต์: การให้เรตติ้ง รายการโปรด/คลังของคุณ และสถิติการเปิดอ่านตอน (ใช้เพื่อนับยอดวิวและแสดงสถิติในหน้าแดชบอร์ดของผู้ดูแลระบบเท่านั้น)",
          "คุกกี้: เราใช้คุกกี้ httpOnly หนึ่งตัวเพื่อจดจำการเข้าสู่ระบบของคุณเท่านั้น ไม่มีการใช้คุกกี้เพื่อโฆษณาหรือติดตามพฤติกรรมข้ามเว็บไซต์",
        ],
      },
      {
        heading: "เราใช้ข้อมูลของคุณเพื่ออะไร",
        body: [
          "เพื่อให้คุณเข้าสู่ระบบและใช้งานฟีเจอร์ต่างๆ ของเว็บไซต์ได้ (อัปโหลดผลงาน จัดการคลัง ให้เรตติ้ง)",
          "เพื่อแสดงหน้าโปรไฟล์สาธารณะของคุณ (ชื่อ รูป bio ผลงานที่อัปโหลด) ให้ผู้ใช้อื่นเห็น",
          "เพื่อส่งอีเมลยืนยันตัวตนหรือรีเซ็ตรหัสผ่าน กรณีสมัครด้วยชื่อผู้ใช้/รหัสผ่าน",
        ],
      },
      {
        heading: "เราแชร์ข้อมูลกับใครบ้าง",
        body: [
          "เราไม่ขายหรือให้เช่าข้อมูลส่วนตัวของคุณกับบุคคลที่สาม",
          "ข้อมูลจะถูกส่งไปยัง Google หรือ Facebook เฉพาะตอนที่คุณเลือกเข้าสู่ระบบผ่านช่องทางนั้นๆ (เพื่อยืนยันตัวตนเท่านั้น) และไปยังผู้ให้บริการอีเมล (Resend) เมื่อระบบต้องส่งอีเมลยืนยัน/รีเซ็ตรหัสผ่านให้คุณ",
        ],
      },
      {
        heading: "สิทธิ์ของคุณ",
        body: [
          "คุณแก้ไขชื่อที่แสดง ประวัติย่อ รูปโปรไฟล์/แบนเนอร์ได้เองในหน้าโปรไฟล์ตลอดเวลา",
          `คุณขอดู แก้ไข หรือลบข้อมูลบัญชีของคุณทั้งหมดได้ โดยติดต่อเราที่ ${CONTACT_EMAIL} — ดูขั้นตอนการขอลบบัญชีโดยละเอียดที่หน้า "การลบบัญชีและข้อมูล" ด้านล่าง`,
        ],
      },
      {
        heading: "ติดต่อเรา",
        body: [`มีคำถามเกี่ยวกับนโยบายนี้ ติดต่อได้ที่ ${CONTACT_EMAIL}`],
      },
    ],
  },
  en: {
    title: "Privacy Policy",
    updated: "Last updated: August 18, 2026",
    sections: [
      {
        heading: "Information we collect",
        body: [
          "Account information: username, email (if provided), and a hashed password, for accounts created with a username/password.",
          "Information from sign-in providers: if you choose to sign in with Google or Facebook, we receive your name, email, and that provider's account ID, used to create or link your account with us. We never see your Google/Facebook password.",
          "Content you upload: profile picture, banner, bio, and any manga/novel works you choose to upload.",
          "Site activity: ratings you give, your library/favorites, and chapter-open counts (used only to show view counts and admin-dashboard statistics).",
          "Cookies: we use a single httpOnly cookie to keep you signed in. We do not use cookies for advertising or cross-site tracking.",
        ],
      },
      {
        heading: "How we use your information",
        body: [
          "To let you sign in and use the site's features (uploading works, managing your library, rating manga).",
          "To display your public profile (name, picture, bio, uploaded works) to other users.",
          "To send email verification or password-reset messages, for accounts using username/password sign-in.",
        ],
      },
      {
        heading: "Who we share information with",
        body: [
          "We do not sell or rent your personal information to third parties.",
          "Information is sent to Google or Facebook only when you choose to sign in through them (for authentication only), and to our email provider (Resend) when the site needs to send you a verification or password-reset email.",
        ],
      },
      {
        heading: "Your rights",
        body: [
          "You can edit your display name, bio, and profile/banner pictures yourself at any time from your profile page.",
          `You can request to view, correct, or delete all data tied to your account by contacting us at ${CONTACT_EMAIL} — see the "Account & Data Deletion" page below for the full process.`,
        ],
      },
      {
        heading: "Contact",
        body: [`Questions about this policy can be sent to ${CONTACT_EMAIL}`],
      },
    ],
  },
};

export default function PrivacyPolicyPage() {
  const { lang, t } = useLanguage();
  const content = CONTENT[lang] || CONTENT.en;
  useDocumentTitle(content.title);

  return (
    <div className="page legal-page">
      <Link to="/" className="btn btn-ghost btn-sm">
        &larr; {t("browse.title")}
      </Link>

      <h1>{content.title}</h1>
      <p className="legal-updated">{content.updated}</p>

      <div className="manga-description">
        {content.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.body.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </section>
        ))}
        <p>
          <Link to="/data-deletion">{lang === "th" ? "การลบบัญชีและข้อมูล →" : "Account & Data Deletion →"}</Link>
        </p>
      </div>
    </div>
  );
}
