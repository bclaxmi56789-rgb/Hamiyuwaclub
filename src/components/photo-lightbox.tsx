import { useCallback, useEffect, useState } from "react";
import { Maximize2, X } from "lucide-react";
import { createPortal } from "react-dom";

interface PhotoLightboxProps {
  src: string;
  alt: string;
  className?: string;
}

/**
 * Inline photo preview that can be clicked to open a full-screen viewer.
 * The viewer closes via the ✕ button, backdrop click or the Escape key.
 */
export function PhotoLightbox({ src, alt, className }: PhotoLightboxProps) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  return (
    <>
      <div className="relative">
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onClick={() => setOpen(true)}
          className={`${className ?? ""} cursor-zoom-in rounded-lg border object-cover`}
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="फोटो फुल स्क्रिनमा हेर्नुहोस् (View fullscreen)"
          title="फुल स्क्रिन (Fullscreen)"
          className="absolute bottom-2 right-2 rounded-full bg-black/60 p-1.5 text-white transition hover:bg-black/80"
        >
          <Maximize2 className="size-4" />
        </button>
      </div>
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
            role="dialog"
            aria-modal="true"
            aria-label={alt}
            onClick={close}
          >
            <button
              type="button"
              onClick={close}
              aria-label="बन्द गर्नुहोस् (Close)"
              title="बन्द गर्नुहोस् (Close)"
              className="absolute right-3 top-3 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            >
              <X className="size-6" />
            </button>
            <img
              src={src}
              alt={alt}
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full cursor-zoom-out rounded-lg object-contain"
            />
          </div>,
          document.body,
        )}
    </>
  );
}
