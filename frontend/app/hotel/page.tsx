import { redirect } from "next/navigation";
import { api } from "@/lib/api";

export const revalidate = 0;

export default async function HotelIndexPage() {
  let targetHotelId = "htl_06d140bd";
  try {
    const res = await api.getHotels({ page_size: 1 });
    if (res?.items?.[0]?.hotel_id) {
      targetHotelId = res.items[0].hotel_id;
    }
  } catch (err) {
    // keep fallback target
  }
  redirect(`/hotel/${targetHotelId}`);
}
