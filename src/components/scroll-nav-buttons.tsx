import { useEffect, useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";

export function ScrollNavigationButtons({
  scrollRef,
}: {
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const [canScroll, setCanScroll] = useState(true);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (scrollRef?.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const scrollToBottom = () => {
    const docHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      window.innerHeight,
    );
    window.scrollTo({ top: docHeight, behavior: "smooth" });
    if (scrollRef?.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  return (
    <div
      className="no-print fixed bottom-6 right-6 z-40 flex flex-col gap-1.5 rounded-full border border-border/80 bg-card/90 p-1 shadow-lg backdrop-blur-md transition-all hover:shadow-xl"
      role="group"
      aria-label="पृष्ठ स्क्रोल नेभिगेसन (Page scroll navigation)"
    >
      <button
        type="button"
        onClick={scrollToTop}
        className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all active:scale-95 shadow-xs"
        aria-label="माथि जानुहोस् (Scroll to top)"
        title="माथि जानुहोस् (Scroll to top)"
      >
        <ArrowUp className="size-4" />
      </button>

      <button
        type="button"
        onClick={scrollToBottom}
        className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all active:scale-95 shadow-xs"
        aria-label="तल जानुहोस् (Scroll to bottom)"
        title="तल जानुहोस् (Scroll to bottom)"
      >
        <ArrowDown className="size-4" />
      </button>
    </div>
  );
}

