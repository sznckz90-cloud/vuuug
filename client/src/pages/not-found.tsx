import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import Layout from "@/components/Layout";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 pt-6 pb-24">
        <Card className="minimal-card">
          <CardContent className="pt-6 pb-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">404 Not Found</h1>
            <p className="text-sm text-muted-foreground mb-4">
              This page doesn't exist
            </p>
            <Button 
              onClick={() => setLocation("/")}
              className="w-full btn-primary"
            >
              Go Back Home
            </Button>
          </CardContent>
        </Card>
      </main>
    </Layout>
  );
}
