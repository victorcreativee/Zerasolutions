import { useEffect, useRef, useState } from "react";

export default function LogoUpload({ value, onChange, disabled, onBusyChange }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef(0);
  useEffect(() => () => { request.current += 1; onBusyChange(false); }, [onBusyChange]);

  async function selectFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const id = ++request.current;
    setError("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError("Choose a PNG, JPG, or WebP image up to 5 MB.");
      return;
    }
    setBusy(true);
    onBusyChange(true);
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (!image.naturalWidth || !image.naturalHeight) throw new Error();
      const canvas = document.createElement("canvas");
      let size = 384;
      let data;
      do {
        const scale = Math.min(1, size / Math.max(image.naturalWidth, image.naturalHeight));
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        data = canvas.toDataURL("image/png");
        size = Math.floor(size * 0.75);
      } while (data.length > 60000 && size >= 64);
      if (data.length > 60000) throw new Error();
      if (request.current === id) onChange(data);
    } catch {
      if (request.current === id) setError("Unable to read this image. Try another PNG or JPG.");
    } finally {
      URL.revokeObjectURL(url);
      if (request.current === id) { setBusy(false); onBusyChange(false); }
    }
  }

  return <div className="space-y-2">
    <label className="block text-sm font-semibold">Organization logo
      <input type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled || busy} onChange={selectFile} className="mt-2 block w-full rounded-lg border border-zera-line p-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-zera-mint file:px-3 file:py-2 file:text-zera-green" />
    </label>
    <p className="text-xs text-zera-muted">PNG, JPG or WebP · Up to 5 MB. Save changes to apply.</p>
    {busy && <p role="status" className="text-sm">Preparing logo…</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {value && <div className="flex items-center gap-3"><img src={value} alt="Current organization logo" className="h-20 w-20 rounded-lg border border-zera-line bg-white object-contain" /><button type="button" disabled={disabled || busy} className="text-sm font-semibold text-red-700" onClick={() => { onChange(""); setError(""); }}>Remove logo</button></div>}
  </div>;
}
