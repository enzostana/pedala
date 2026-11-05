import { redirect } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  redirect("/app?bike=" + encodeURIComponent(code));
}
