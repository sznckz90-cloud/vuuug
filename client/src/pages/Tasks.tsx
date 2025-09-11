import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import Layout from "@/components/Layout";
import TaskSection from "@/components/TaskSection";

export default function Tasks() {
  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 pb-20">
        {/* Header with Create Task Button */}
        <div className="flex items-center justify-between mb-6 pt-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Available Tasks</h1>
            <p className="text-sm text-muted-foreground">Complete tasks and earn rewards</p>
          </div>
          <div className="flex flex-col gap-2">
            <Link href="/create-task">
              <Button size="sm" className="gap-1">
                <i className="fas fa-plus"></i>
                Create Task
              </Button>
            </Link>
            <Link href="/my-promotions">
              <Button size="sm" variant="outline" className="gap-1">
                <i className="fas fa-list"></i>
                My Tasks
              </Button>
            </Link>
          </div>
        </div>
        <TaskSection />
      </main>
    </Layout>
  );
}