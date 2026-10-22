import type { ReactNode, SVGProps } from "react";

type IconName = "overview" | "palette" | "type" | "shape" | "components" | "chevron" | "search" | "plus" | "more" | "spark" | "check";

type IconProps = SVGProps<SVGSVGElement> & { name: IconName };

const paths: Record<IconName, ReactNode> = {
  overview: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.4" /><rect x="13.5" y="3.5" width="7" height="4" rx="1.4" /><rect x="13.5" y="9.5" width="7" height="10" rx="1.4" /><rect x="3.5" y="13.5" width="7" height="6" rx="1.4" /></>,
  palette: <><path d="M12 3.5a8.5 8.5 0 1 0 0 17h1.1a2 2 0 0 0 1.4-3.4 1.7 1.7 0 0 1 1.2-2.9h1.4A3.4 3.4 0 0 0 20.5 11c0-4.1-3.8-7.5-8.5-7.5Z" /><circle cx="7.8" cy="11" r=".8" /><circle cx="10" cy="7.8" r=".8" /><circle cx="14" cy="7.8" r=".8" /></>,
  type: <><path d="M4 6V4.5h16V6" /><path d="M12 4.5v15M8.5 19.5h7" /><path d="m7.5 13.5 1-2.5h7l1 2.5" /></>,
  shape: <><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><path d="M8 8h8v8H8z" /></>,
  components: <><rect x="3.5" y="4" width="17" height="6" rx="2" /><rect x="3.5" y="14" width="8" height="6" rx="2" /><circle cx="17" cy="17" r="3" /></>,
  chevron: <path d="m9 18 6-6-6-6" />,
  search: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m15.5 15.5 4.2 4.2" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  more: <><circle cx="5" cy="12" r=".7" /><circle cx="12" cy="12" r=".7" /><circle cx="19" cy="12" r=".7" /></>,
  spark: <><path d="m12 3 1.5 6.2L20 11l-6.5 1.8L12 19l-1.5-6.2L4 11l6.5-1.8L12 3Z" /><path d="m19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6L19 16Z" /></>,
  check: <path d="m5 12.5 4.5 4L19 7.5" />,
};

export function Icon({ name, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
      {...props}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
    >
      {paths[name]}
    </svg>
  );
}
