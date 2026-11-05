import { RoleGuard } from "@/components/auth/guards";
import { CandidateNav } from "@/components/layout/candidate-nav";

export default function CandidateLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard role="candidate">
      <div className="min-h-screen">
        <CandidateNav />
        <main className="container py-8">{children}</main>
      </div>
    </RoleGuard>
  );
}