import { PublicMenu } from "@/components/public-menu"

export default async function MenuPage({
  params,
}: {
  params: Promise<{ storeId: string }>
}) {
  const { storeId } = await params
  return <PublicMenu key={storeId} storeId={storeId} />
}
