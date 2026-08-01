"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { chargingSolutions } from "@/data/charging";

type ChargingSolution = (typeof chargingSolutions)[number];

interface ChargingImageModalProps {
  charger: ChargingSolution | null;
  onClose: () => void;
}

export default function ChargingImageModal({ charger, onClose }: ChargingImageModalProps) {
  if (!charger) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={charger.title}
    >
      <div
        className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[30px] border border-white/15 bg-[#04140F] shadow-[0_35px_100px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative h-[250px] sm:h-[320px] lg:h-[430px]">
          <Image
            src={charger.image}
            alt={charger.title}
            fill
            sizes="(max-width: 1024px) 100vw, 80vw"
            className="h-full w-full object-cover object-center"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/45 text-white transition hover:bg-black/65"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 pb-8 sm:p-7 sm:pb-9 lg:p-8 lg:pb-10">
          <h3 className="mt-4 text-2xl font-black text-white sm:text-3xl">{charger.title}</h3>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/80 sm:text-base">{charger.description}</p>
        </div>
      </div>
    </div>
  );
}
