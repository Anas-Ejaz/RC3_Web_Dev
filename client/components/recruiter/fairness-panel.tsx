"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";

import { SectionCard } from "@/components/candidate/section-card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useJobApplications } from "@/hooks/use-recruiter-applications";
import { useRecruiterJobs } from "@/hooks/use-recruiter-jobs";
import { useFairnessTest } from "@/hooks/use-talent";
import type { FairnessAttribute } from "@/types/api";

const ATTRIBUTES: { value: FairnessAttribute; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "gender", label: "Gender" },
  { value: "age", label: "Age" },
  { value: "location", label: "Location" },
];

export function FairnessPanel() {
  const [jobId, setJobId] = useState("");
  const [appId, setAppId] = useState("");
  const [attrs, setAttrs] = useState<FairnessAttribute[]>(ATTRIBUTES.map((a) => a.value));

  const jobs = useRecruiterJobs({ page: 1, page_size: 100 });
  const applicants = useJobApplications(jobId === "" ? NaN : Number(jobId), { sort: "score", page: 1 });
  const test = useFairnessTest();

  function toggle(value: FairnessAttribute) {
    setAttrs((cur) => (cur.includes(value) ? cur.filter((a) => a !== value) : [...cur, value]));
  }

  function run() {
    test.mutate({ application_id: Number(appId), attributes: attrs });
  }

  const result = test.data;

  return (
    <SectionCard
      title="Fairness test"
      description="Re-scores an application with a protected detail changed. Scores should not move when only that detail changes."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fair-job">Job</Label>
          <Select
            value={jobId}
            onValueChange={(v) => {
              setJobId(v);
              setAppId("");
              test.reset();
            }}
          >
            <SelectTrigger id="fair-job">
              <SelectValue placeholder="Choose a job" />
            </SelectTrigger>
            <SelectContent>
              {(jobs.data?.items ?? []).map((j) => (
                <SelectItem key={j.id} value={String(j.id)}>
                  {j.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="fair-app">Application</Label>
          <Select value={appId} onValueChange={setAppId} disabled={jobId === "" || applicants.isPending}>
            <SelectTrigger id="fair-app">
              <SelectValue placeholder={jobId === "" ? "Choose a job first" : "Choose an applicant"} />
            </SelectTrigger>
            <SelectContent>
              {(applicants.data?.items ?? []).map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>
                  {a.candidate_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-forest-950">Details to vary</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          {ATTRIBUTES.map((a) => (
            <label key={a.value} className="flex items-center gap-2 text-sm text-forest-950">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-forest-900/30 accent-forest-800"
                checked={attrs.includes(a.value)}
                onChange={() => toggle(a.value)}
              />
              {a.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-5 flex justify-end">
        <Button type="button" variant="lime" disabled={appId === "" || attrs.length === 0 || test.isPending} onClick={run}>
          <ShieldCheck aria-hidden />
          {test.isPending ? "Running…" : "Run fairness test"}
        </Button>
      </div>

      <div className="mt-6" aria-live="polite">
        {result && (
          <div className="space-y-4">
            <div
              role="status"
              className={
                result.passed
                  ? "rounded-2xl bg-lime-soft p-4 text-sm font-medium text-forest-950"
                  : "rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-950"
              }
            >
              {result.passed
                ? `Passed. The score stayed consistent across every variant (original score ${result.original_score}).`
                : `Needs review. The score moved for at least one variant (original score ${result.original_score}). Look at the rows below before relying on this assessment.`}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <caption className="sr-only">Score for each changed detail compared with the original</caption>
                <thead>
                  <tr className="border-b border-forest-900/10 text-forest-900/70">
                    <th scope="col" className="py-2 pr-4 font-medium">Detail changed</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Changed to</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Score</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-forest-900/5">
                    <td className="py-2 pr-4 font-medium text-forest-950">Original</td>
                    <td className="py-2 pr-4 text-forest-900/70">None</td>
                    <td className="py-2 pr-4 tabular-nums">{result.original_score}</td>
                    <td className="py-2 pr-4 text-forest-900/70">0</td>
                  </tr>
                  {result.variants.map((v) => (
                    <tr key={`${v.attribute}-${v.changed_to}`} className="border-b border-forest-900/5">
                      <td className="py-2 pr-4 font-medium capitalize text-forest-950">{v.attribute}</td>
                      <td className="py-2 pr-4">{v.changed_to}</td>
                      <td className="py-2 pr-4 tabular-nums">{v.score}</td>
                      <td className={`py-2 pr-4 tabular-nums ${v.delta === 0 ? "text-forest-900/70" : "font-semibold text-amber-800"}`}>
                        {v.delta > 0 ? `+${v.delta}` : v.delta}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}