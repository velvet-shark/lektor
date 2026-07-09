import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import JobView from "@/components/JobView";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function JobPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("site");
  return (
    <div className="mx-auto max-w-[72ch] pt-6">
      <JobView
        jobId={id}
        labels={{ original: t("original"), lektor: t("lektor") }}
      />
    </div>
  );
}
