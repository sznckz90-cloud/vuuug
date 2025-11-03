import { useState } from "react";
import { Link } from "wouter";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, TrendingUp, Wallet, PlusCircle, Settings } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import CwalletSetupDialog from "@/components/CwalletSetupDialog";

export default function HamburgerMenu() {
  const { isAdmin } = useAdmin();
  const [menuOpen, setMenuOpen] = useState(false);
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);

  const handleWalletClick = () => {
    setMenuOpen(false);
    setWalletDialogOpen(true);
  };

  return (
    <>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="w-[50px] h-[50px] text-[#4cd3ff] hover:text-[#6ddeff] hover:bg-[#4cd3ff]/10 p-0"
          >
            <Menu className="w-[45px] h-[45px]" strokeWidth={4} />
          </Button>
        </SheetTrigger>
        <SheetContent 
          side="right" 
          className="w-[200px] bg-gradient-to-br from-background to-background/95 border-l border-white/10 [&>button]:hidden"
        >
          <SheetHeader className="mb-4">
            <SheetTitle className="text-lg font-bold text-[#4cd3ff]">Menu</SheetTitle>
          </SheetHeader>
          
          <div className="flex flex-col gap-1">
            <Link href="/affiliates">
              <Button
                variant="ghost"
                className="w-full justify-start h-11 text-white hover:bg-[#4cd3ff]/10 hover:text-[#4cd3ff]"
                onClick={() => setMenuOpen(false)}
              >
                <TrendingUp className="w-5 h-5 mr-3" />
                <span className="text-sm">Profit</span>
              </Button>
            </Link>

            <Button
              variant="ghost"
              className="w-full justify-start h-11 text-white hover:bg-[#4cd3ff]/10 hover:text-[#4cd3ff]"
              onClick={handleWalletClick}
            >
              <Wallet className="w-5 h-5 mr-3" />
              <span className="text-sm">Wallet Setup</span>
            </Button>

            <Link href="/create-task">
              <Button
                variant="ghost"
                className="w-full justify-start h-11 text-white hover:bg-[#4cd3ff]/10 hover:text-[#4cd3ff]"
                onClick={() => setMenuOpen(false)}
              >
                <PlusCircle className="w-5 h-5 mr-3" />
                <span className="text-sm">Create a Task</span>
              </Button>
            </Link>

            {isAdmin && (
              <Link href="/admin">
                <Button
                  variant="ghost"
                  className="w-full justify-start h-11 text-white hover:bg-[#4cd3ff]/10 hover:text-[#4cd3ff]"
                  onClick={() => setMenuOpen(false)}
                >
                  <Settings className="w-5 h-5 mr-3" />
                  <span className="text-sm">Admin Panel</span>
                </Button>
              </Link>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <CwalletSetupDialog 
        open={walletDialogOpen}
        onOpenChange={setWalletDialogOpen}
      />
    </>
  );
}
