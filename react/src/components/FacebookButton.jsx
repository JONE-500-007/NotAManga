// A real page navigation rather than a fetch/Link: Facebook's OAuth flow
// needs a top-level browser redirect so it can show its own login dialog —
// same reasoning as GoogleButton.
export default function FacebookButton({ children }) {
  return (
    <a href="/api/auth/facebook" className="btn btn-ghost facebook-btn">
      <img src="/uploads/image_icon/Facebook_icon.png" alt="" className="facebook-btn-icon" />
      {children}
    </a>
  );
}
