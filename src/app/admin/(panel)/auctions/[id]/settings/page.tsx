import { SettingsForm } from "@/components/admin/settings-form";
import { auctionToDefaults, getAdminAuction } from "@/lib/admin/queries";

export const metadata = { title: "Rules | Admin" };

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await getAdminAuction(id);
  return <SettingsForm auction={a} current={auctionToDefaults(a)} sportDefaults={a.sportConfig.defaults} />;
}
