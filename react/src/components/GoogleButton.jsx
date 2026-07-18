// A real page navigation rather than a fetch/Link: Google's OAuth flow needs
// a top-level browser redirect so it can show its own account-chooser page.
export default function GoogleButton({ children }) {
  return (
    <a href="/api/auth/google" className="btn btn-ghost google-btn">
      <img src="/uploads/image_icon/Google_Icon.png" alt="" className="google-btn-icon" />
      {children}
    </a>
  );
}
