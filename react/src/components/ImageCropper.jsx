import { useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import { useLanguage } from "../context/LanguageContext";
import { getCroppedImageBlob } from "../utils/cropImage";

// zoom=1 is the "cover" point (image just fills the crop box, no gaps).
// Allowing zoom below that lets people back off from a tight cover-fit on
// oversized images, at the cost of letterboxing if they go far enough.
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

export default function ImageCropper({ file, aspect, onCancel, onCropped }) {
  const { t } = useLanguage();
  // Creation and cleanup live in the same effect on purpose: under React
  // StrictMode's dev-only double-invoke, an object URL created in a useMemo
  // and revoked by a separately-keyed cleanup effect can be revoked while the
  // <img> is still loading it (the memo doesn't recompute on the spurious
  // remount, but the cleanup still fires). Keeping both in one effect means
  // each invocation only ever revokes the URL it itself created.
  const [imageUrl, setImageUrl] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  const handleSave = async () => {
    if (!croppedAreaPixels || saving) return;
    setSaving(true);
    try {
      const blob = await getCroppedImageBlob(file, croppedAreaPixels);
      onCropped(blob);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="lightbox-overlay cropper-modal" onClick={onCancel}>
      <div className="cropper-panel" onClick={(e) => e.stopPropagation()}>
        <h2>{t("cropper.title")}</h2>

        <div className="cropper-canvas-area">
          {imageUrl && (
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
              aspect={aspect}
              objectFit="cover"
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
            />
          )}
        </div>

        <label className="cropper-zoom">
          {t("cropper.zoom")}
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>

        <div className="cropper-controls">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
            {t("cropper.cancel")}
          </button>
          <button type="button" className="btn btn-accent" onClick={handleSave} disabled={saving}>
            {t("cropper.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
