import type { ReactNode } from "react";

export function Padding({
  className = "px-2 sm:px-4 md:px-8 lg:px-12 xl:px-16 2xl:px-24",
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return <div className={`${className} duration-300`}>{children}</div>;
}
