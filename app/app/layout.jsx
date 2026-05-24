export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default function ServiceLayout({ children }) {
  return children;
}
