import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import Layout from "@/components/Layout";
import TaskSection from "@/components/TaskSection";

export default function Tasks() {
  return (
    <Layout>
      <main className="max-w-md mx-auto px-4">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-foreground mb-1">Tasks</h1>
          <p className="text-sm text-muted-foreground">Earn PAD for completing tasks.</p>
        </div>
        <TaskSection />
      </main>
    </Layout>
  );
}