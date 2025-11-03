import HamburgerMenu from "@/components/HamburgerMenu";

export default function Header() {
  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-gradient-to-b from-background to-background/95 backdrop-blur-sm border-b border-white/5">
      <div className="max-w-md mx-auto pl-1 pr-4 py-3 flex items-center justify-start">
        {/* Left: Hamburger Menu */}
        <HamburgerMenu />
      </div>
    </div>
  );
}
