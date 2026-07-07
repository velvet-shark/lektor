import { getTranslations, setRequestLocale } from "next-intl/server";
import JobView from "@/components/JobView";

export default async function JobPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("site");
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <JobView
        jobId={id}
        labels={{ original: t("original"), lektor: t("lektor") }}
      />
    </main>
  );
}
