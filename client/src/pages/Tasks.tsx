import Layout from "@/components/Layout";
import TaskSection from "@/components/TaskSection";

export default function Tasks() {
  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 pb-20">
        <TaskSection />
      </main>
    </Layout>
  );
}