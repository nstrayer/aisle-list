import { useEffect, useRef } from "react";
import { annotate } from "rough-notation";

interface AnimatedTitleProps {
  className?: string;
}

export function AnimatedTitle({ className = "" }: AnimatedTitleProps) {
  const aiRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (aiRef.current) {
      const annotation = annotate(aiRef.current, {
        type: "underline",
        color: "#10b981",
        strokeWidth: 3,
        padding: 2,
        animationDuration: 800,
      });
      annotation.show();

      return () => annotation.remove();
    }
  }, []);

  return (
    <span className={className}>
      <span ref={aiRef} className="font-bold">AI</span>sle List
    </span>
  );
}
