import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import Layout from "@/components/Layout";
import TaskSection from "@/TaskSection";

export default function Tasks() {
  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 pb-20">
        {/* Header */}
        <div className="mb-6 pt-4">
          <h1 className="text-2xl font-bold text-foreground">Available Tasks</h1>
          <p className="text-sm text-muted-foreground">Complete tasks and earn rewards</p>
        </div>
        <TaskSection />
      </main>
    </Layout>
  );
}