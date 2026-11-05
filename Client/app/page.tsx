import { CtaBanner } from "@/components/landing/cta-banner";
import { Faq } from "@/components/landing/faq";
import { FeaturedJobs } from "@/components/landing/featured-jobs";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { SiteFooter } from "@/components/landing/site-footer";

export default function LandingPage() {
  return (
    <>
      <main>
        <Hero />
        <HowItWorks />
        <FeaturedJobs />
        <Faq />
        <CtaBanner />
      </main>
      <SiteFooter />
    </>
  );
}