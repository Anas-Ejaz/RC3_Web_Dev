"use client";

import { useRouter } from "next/navigation";

import { PageHeader } from "@/components/brand";
import { JobForm } from "@/components/recruiter/job-form";

export default function NewJobPage() {
  const router = useRouter();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Post a"
        accent="job"
        description="Describe the role and the skills it needs. Candidates are matched against what you list here."
      />
      <JobForm onCreated={() => router.push("/recruiter/jobs")} />
    </div>
  );
}