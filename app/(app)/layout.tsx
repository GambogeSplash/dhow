import { CorridorProvider } from "@/components/CorridorProvider";
import { AppNav } from "@/components/AppNav";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CorridorProvider>
      <AppNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        {children}
      </main>
    </CorridorProvider>
  );
}
