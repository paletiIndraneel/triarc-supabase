import Image from "next/image";
import Link from "next/link";

interface LogoProps {
  dark?: boolean;
}

export default function Logo({ dark = false }: LogoProps) {
  return (
    <Link
      href="/"
      className="flex items-center"
    >
      <Image
        src="/images/stations/bhadrachalam/TriArcLogo.png"
        alt="TriArc EV Hub"
        width={150}
        height={45}
        priority
        className={dark ? "" : "brightness-0 invert"}
      />
    </Link>
  );
}