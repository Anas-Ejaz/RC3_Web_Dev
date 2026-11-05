"use client";

import { PageHeader } from "@/components/brand";
import { AiNotice } from "@/components/recruiter/ai-notice";
import { DuplicateReview } from "@/components/recruiter/duplicate-review";
import { FairnessPanel } from "@/components/recruiter/fairness-panel";
import { TalentPool } from "@/components/recruiter/talent-pool";
import { TalentSearch } from "@/components/recruiter/talent-search";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function TalentPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Talent"
        accent="intelligence"
        description="Search past applicants, review duplicates and check that scoring is fair."
      />
      <AiNotice />
      <Tabs defaultValue="search">
        <TabsList>
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="pool">Talent pool</TabsTrigger>
          <TabsTrigger value="duplicates">Duplicates</TabsTrigger>
          <TabsTrigger value="fairness">Fairness</TabsTrigger>
        </TabsList>
        <TabsContent value="search" className="mt-6">
          <TalentSearch />
        </TabsContent>
        <TabsContent value="pool" className="mt-6">
          <TalentPool />
        </TabsContent>
        <TabsContent value="duplicates" className="mt-6">
          <DuplicateReview />
        </TabsContent>
        <TabsContent value="fairness" className="mt-6">
          <FairnessPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}