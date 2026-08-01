"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { ExplorePlace } from "@/data/explore";

interface ExploreImageModalProps {
  place: ExplorePlace | null;
  onClose: () => void;
}

export default function ExploreImageModal({ place, onClose }: ExploreImageModalProps) {
  if (!place) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={place.title}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-[30px] border border-white/15 bg-[#04140F] shadow-[0_35px_100px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative h-[90vh] w-full bg-black/30 p-4 sm:p-6 lg:p-8">
          <Image
            src={place.image}
            alt={place.title}
            fill
            sizes="(max-width: 1024px) 100vw, 80vw"
            className="object-contain object-center"
            priority
          />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/45 text-white transition hover:bg-black/65"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
