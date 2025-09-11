import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Layout from "@/components/Layout";

export default function Promote() {
  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 pb-20">
        <div className="py-6">
          <h1 className="text-2xl font-bold text-foreground mb-6 text-center">
            Promote Your Content
          </h1>

          {/* Create Task Section */}
          <Card className="shadow-sm border border-border mb-6">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                <i className="fas fa-plus-circle text-primary"></i>
                Create Task
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Create promotional tasks for other users to complete and earn rewards
              </p>
              <Link href="/create-task">
                <Button className="w-full gap-2">
                  <i className="fas fa-rocket"></i>
                  Create New Task
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* My Task List Section */}
          <Card className="shadow-sm border border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                <i className="fas fa-list-alt text-secondary"></i>
                My Task List
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                View and manage your created promotional tasks
              </p>
              <Link href="/my-promotions">
                <Button variant="outline" className="w-full gap-2">
                  <i className="fas fa-tasks"></i>
                  Manage My Tasks
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    </Layout>
  );
}