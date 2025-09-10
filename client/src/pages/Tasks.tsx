import Layout from "@/components/Layout";
import TaskSection from "@/components/TaskSection";

export default function Tasks() {
  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 pb-20">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Tasks</h1>
          <p className="text-muted-foreground">Complete tasks to earn rewards</p>
        </div>
        
        <TaskSection />
      </main>
    </Layout>
  );
}