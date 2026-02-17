import { NextRequest, NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/google/geocoder";
import { z } from "zod";

const schema = z.object({
  address: z.string().min(1, "Address is required"),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  try {
    const result = await geocodeAddress(parsed.data.address);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Geocode failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
