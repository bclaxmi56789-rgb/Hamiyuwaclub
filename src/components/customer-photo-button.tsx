import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Loader2, X } from "lucide-react";
import { getLocalityPhoto } from "@/lib/workspace.functions";
import { Button } from "@/components/ui/button";

interface CustomerPhotoButtonProps {
  /** Raw locality_photo value: `locality:{ward}:{card}` ref, Storage/data URL or empty. */
  value?: string | undefined;
  className?: string;
}

/**
 * "फोटो" button shown in map customer info cards. Opens a full-screen photo
 * viewer; the viewer closes via ✕, backdrop click or Escape and returns to
 * the underlying info card.
 */
export function CustomerPhotoButton({ value, className }: CustomerPhotoButtonProps) {
  const fetchPhotoFn = useServerFn(getLocalityPhoto);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [src, setSrc] = useState("");
  const [err, setErr] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const v = (value || "").trim();
    if (!v) {
      setErr(true);
      return;
    }
    if (!v.startsWith("locality:")) {
      setSrc(v);
      setErr(false);
      return;
    }
    const [, ward, card] = v.split(":");
    if (!ward || !card) {
      setErr(true);
      return;
    }
    let alive = true;
    setLoading(true);
    setErr(false);
    fetchPhotoFn({ data: { ward, card } })
      .then((url: string) => {
        if (!alive) return;
        setSrc(url || "");
        setErr(!url);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setErr(true);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, value, fetchPhotoFn]);

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

  if (!value) return null;

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className={`h-9 gap-1 text-xs ${className ?? ""}`}
        title="ग्राहकको घर/टोल फोटो फुल स्क्रिनमा हेर्नुहोस्"
      >
        <Camera className="size-3.5" />
        <span>फोटो</span>
      </Button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/90 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="ग्राहक फोटो"
            onClick={close}
          >
            <button
              type="button"
              onClick={close}
              aria-label="फोटो बन्द गर्नुहोस् (Back)"
              title="फिर्ता जानुहोस् (Back)"
              className="absolute right-3 top-3 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            >
              <X className="size-6" />
            </button>
            {loading && (
              <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
                <Loader2 className="size-5 animate-spin" /> फोटो लोड हुँदैछ…
              </div>
            )}
            {!loading && err && (
              <div className="text-sm font-semibold text-white/80">
                फोटो उपलब्ध छैन।
              </div>
            )}
            {!loading && !err && src && (
              <img
                src={src}
                alt="ग्राहक घर/टोल फोटो"
                onClick={(e) => e.stopPropagation()}
                className="max-h-full max-w-full cursor-zoom-out rounded-lg object-contain shadow-2xl"
              />
            )}
            <button
              type="button"
              onClick={close}
              className="mt-4 rounded-full bg-white/10 px-5 py-2 text-sm font-bold text-white transition hover:bg-white/20"
            >
              ← फिर्ता (Back)
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
