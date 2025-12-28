import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary to-secondary text-primary-foreground">
        <div className="max-w-md mx-auto px-4 py-8 text-center">
          <div className="bg-white/20 p-3 rounded-full inline-block mb-4">
            <i className="fas fa-coins text-3xl"></i>
          </div>
          <h1 className="text-3xl font-bold mb-3">CashWatch</h1>
          <p className="text-lg mb-2 text-primary-foreground/90">Earn Money Watching Ads</p>
          <p className="text-primary-foreground/80 mb-6 text-sm">
            Join thousands of users earning real money daily by watching advertisements
          </p>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="grid gap-4">
          <Card className="border border-border shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="bg-primary/10 p-2 rounded-full inline-block mb-3">
                <i className="fas fa-dollar-sign text-primary text-xl"></i>
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">Instant Rewards</h3>
              <p className="text-muted-foreground text-xs">
                Earn 0.000086 TON for every ad you watch. Payments are instant and secure.
              </p>
            </CardContent>
          </Card>

          <Card className="border border-border shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="bg-secondary/10 p-2 rounded-full inline-block mb-3">
                <i className="fas fa-fire text-secondary text-xl"></i>
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">Daily Streaks</h3>
              <p className="text-muted-foreground text-xs">
                Maintain your daily streak to earn bonus rewards and unlock achievements.
              </p>
            </CardContent>
          </Card>

        </div>

        {/* Call to Action */}
        <div className="mt-6 text-center">
          <Button 
            onClick={() => window.location.href = '/api/login'}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-4 text-base font-semibold"
            data-testid="button-login"
          >
            Get Started - Sign In
          </Button>
          <p className="text-muted-foreground text-xs mt-3">
            Free to join • No hidden fees • Instant withdrawals
          </p>
        </div>
      </div>
    </div>
  );
}
