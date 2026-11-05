"use client";

import { useRef } from "react";

import { PageHeader } from "@/components/brand";
import { ResumeDropzone } from "@/components/candidate/resume-dropzone";
import { ResumeStatus } from "@/components/candidate/resume-status";
import { SectionCard } from "@/components/candidate/section-card";
import { CardSkeleton, ErrorState } from "@/components/shared/states";
import { useResume, useUploadResume } from "@/hooks/use-candidate";

export default function CandidateResumePage() {
  const resume = useResume();
  const upload = useUploadResume();
  const inputRef = useRef<HTMLInputElement>(null);
  const lastFile = useRef<File | null>(null);

  function handleFile(file: File) {
    lastFile.current = file;
    upload.mutate(file);
  }

  function retry() {
    if (upload.isError && lastFile.current) upload.mutate(lastFile.current);
    else inputRef.current?.click();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Your"
        accent="resume"
        description="Upload a PDF and we'll read it. You'll get to check and correct everything we find."
      />
      {resume.isError ? (
        <ErrorState onRetry={() => resume.refetch()} />
      ) : resume.isPending ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title={resume.data ? "Replace your resume" : "Upload your resume"}>
            <ResumeDropzone
              onFile={handleFile}
              inputRef={inputRef}
              disabled={upload.isPending || resume.data?.parse_status === "pending"}
              progress={upload.isPending ? upload.progress : null}
            />
          </SectionCard>
          <ResumeStatus
            resume={resume.data}
            uploadError={upload.isError ? upload.error.message : null}
            onRetry={retry}
          />
        </div>
      )}
    </div>
  );
}