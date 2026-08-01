import { ReactNode } from "react";

interface ContainerProps {
  children: ReactNode;
  className?: string;
}

export default function Container({
  children,
  className = "",
}: ContainerProps) {
  return (
    <div
      className={`mx-auto w-full max-w-[1600px] overflow-x-hidden px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 ${className}`.trim()}
    >
      {children}
    </div>
  );
}