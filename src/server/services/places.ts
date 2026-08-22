import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getServerEnv } from "@/lib/env";
import { getDb } from "@/server/db";
import {
  businesses,
  discoveryResults,
  discoverySearches,
  leads,
} from "@/server/db/schema";

export const discoveryInputSchema = z.object({
  location: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(120),
  websiteFilter: z
    .enum(["any", "missing", "present", "unknown"])
    .default("any"),
  targetCount: z
    .union([z.literal(25), z.literal(50), z.literal(100)])
    .default(25),
});

export type DiscoveryInput = z.infer<typeof discoveryInputSchema>;

type GooglePlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  primaryType?: string;
  types?: string[];
  location?: { latitude?: number; longitude?: number };
  businessStatus?: string;
};

type GoogleTextSearchResponse = {
  places?: GooglePlace[];
  nextPageToken?: string;
};

export type DiscoveryCandidate = {
  discoveryResultId: string;
  businessId: string;
  placeId: string;
  name: string;
  address: string | null;
  phone: string | null;
  websiteUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  category: string | null;
  existingLeadId: string | null;
  rank: number;
};

export async function runDiscovery(
  input: DiscoveryInput,
  context: { organizationId: string; userId: string },
) {
  const env = getServerEnv();
  if (!env.GOOGLE_PLACES_API_KEY)
    throw new Error(
      "Google Places is not configured. Add GOOGLE_PLACES_API_KEY.",
    );

  const db = getDb();
  const query = `${input.category} in ${input.location}`;
  const [search] = await db
    .insert(discoverySearches)
    .values({
      organizationId: context.organizationId,
      createdBy: context.userId,
      query,
      location: input.location,
      category: input.category,
      websiteFilter: input.websiteFilter,
      targetCount: input.targetCount,
    })
    .returning({ id: discoverySearches.id });

  let pageToken: string | undefined;
  let pageCount = 0;
  let partialError: Error | undefined;
  const candidates: DiscoveryCandidate[] = [];
  const seen = new Set<string>();

  try {
    while (candidates.length < input.targetCount && pageCount < 5) {
      let payload: GoogleTextSearchResponse;
      try {
        const response = await fetch(
          "https://places.googleapis.com/v1/places:searchText",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": env.GOOGLE_PLACES_API_KEY,
              "X-Goog-FieldMask":
                "places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.rating,places.userRatingCount,places.primaryType,places.types,places.location,places.businessStatus,nextPageToken",
            },
            body: JSON.stringify({
              textQuery: query,
              pageSize: 20,
              ...(pageToken ? { pageToken } : {}),
            }),
            signal: AbortSignal.timeout(20_000),
          },
        );
        if (!response.ok) throw new Error(`Places returned ${response.status}`);
        payload = (await response.json()) as GoogleTextSearchResponse;
      } catch (error) {
        if (pageCount === 0) throw error;
        partialError =
          error instanceof Error
            ? error
            : new Error("Places pagination failed");
        break;
      }

      pageCount += 1;
      for (const place of payload.places ?? []) {
        if (!place.id || seen.has(place.id)) continue;
        seen.add(place.id);
        const hasWebsite = Boolean(place.websiteUri);
        if (input.websiteFilter === "missing" && hasWebsite) continue;
        if (input.websiteFilter === "present" && !hasWebsite) continue;

        const [business] = await db
          .insert(businesses)
          .values({
            googlePlaceId: place.id,
            name: place.displayName?.text ?? "Unnamed business",
            formattedAddress: place.formattedAddress,
            phone: place.internationalPhoneNumber,
            websiteUrl: place.websiteUri,
            googleMapsUrl: place.googleMapsUri,
            rating: place.rating,
            userRatingCount: place.userRatingCount,
            primaryCategory: place.primaryType,
            categories: place.types ?? [],
            latitude: place.location?.latitude,
            longitude: place.location?.longitude,
            businessStatus: place.businessStatus,
            providerData: { source: "google_places_text_search" },
          })
          .onConflictDoUpdate({
            target: businesses.googlePlaceId,
            set: {
              name: place.displayName?.text ?? "Unnamed business",
              formattedAddress: place.formattedAddress,
              phone: place.internationalPhoneNumber,
              websiteUrl: place.websiteUri,
              googleMapsUrl: place.googleMapsUri,
              rating: place.rating,
              userRatingCount: place.userRatingCount,
              primaryCategory: place.primaryType,
              categories: place.types ?? [],
              latitude: place.location?.latitude,
              longitude: place.location?.longitude,
              businessStatus: place.businessStatus,
              lastProviderSyncAt: new Date(),
              updatedAt: new Date(),
            },
          })
          .returning({ id: businesses.id });

        const rank = candidates.length + 1;
        const [discoveryResult] = await db
          .insert(discoveryResults)
          .values({
            organizationId: context.organizationId,
            searchId: search.id,
            businessId: business.id,
            rank,
          })
          .onConflictDoNothing()
          .returning({ id: discoveryResults.id });
        if (!discoveryResult) continue;
        candidates.push({
          discoveryResultId: discoveryResult.id,
          businessId: business.id,
          placeId: place.id,
          name: place.displayName?.text ?? "Unnamed business",
          address: place.formattedAddress ?? null,
          phone: place.internationalPhoneNumber ?? null,
          websiteUrl: place.websiteUri ?? null,
          rating: place.rating ?? null,
          reviewCount: place.userRatingCount ?? null,
          category: place.primaryType ?? null,
          existingLeadId: null,
          rank,
        });
        if (candidates.length >= input.targetCount) break;
      }
      pageToken = payload.nextPageToken;
      if (!pageToken) break;
    }

    const existing = candidates.length
      ? await db
          .select({ id: leads.id, businessId: leads.businessId })
          .from(leads)
          .where(
            and(
              eq(leads.organizationId, context.organizationId),
              inArray(
                leads.businessId,
                candidates.map((candidate) => candidate.businessId),
              ),
            ),
          )
      : [];
    const existingByBusiness = new Map(
      existing.map((lead) => [lead.businessId, lead.id]),
    );
    candidates.forEach((candidate) => {
      candidate.existingLeadId =
        existingByBusiness.get(candidate.businessId) ?? null;
    });

    await db
      .update(discoverySearches)
      .set({
        status: partialError ? "partial" : "completed",
        resultCount: candidates.length,
        providerPageCount: pageCount,
        isPartial: Boolean(partialError),
        errorCode: partialError ? "PLACES_PARTIAL" : null,
        errorMessage: partialError?.message ?? null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(discoverySearches.id, search.id));

    return {
      searchId: search.id,
      candidates,
      partial: Boolean(partialError),
      message: partialError?.message,
    };
  } catch (error) {
    await db
      .update(discoverySearches)
      .set({
        status: "failed",
        errorCode: "PLACES_FAILED",
        errorMessage:
          error instanceof Error ? error.message : "Discovery failed",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(discoverySearches.id, search.id));
    throw error;
  }
}

export async function getLatestDiscovery(organizationId: string) {
  const db = getDb();
  const [latest] = await db
    .select({
      id: discoverySearches.id,
      query: discoverySearches.query,
      status: discoverySearches.status,
    })
    .from(discoverySearches)
    .where(eq(discoverySearches.organizationId, organizationId))
    .orderBy(desc(discoverySearches.createdAt))
    .limit(1);
  if (!latest) return null;
  const rows = await db
    .select({
      discoveryResultId: discoveryResults.id,
      businessId: businesses.id,
      placeId: businesses.googlePlaceId,
      name: businesses.name,
      address: businesses.formattedAddress,
      phone: businesses.phone,
      websiteUrl: businesses.websiteUrl,
      rating: businesses.rating,
      reviewCount: businesses.userRatingCount,
      category: businesses.primaryCategory,
      rank: discoveryResults.rank,
      existingLeadId: leads.id,
    })
    .from(discoveryResults)
    .innerJoin(businesses, eq(businesses.id, discoveryResults.businessId))
    .leftJoin(
      leads,
      and(
        eq(leads.businessId, businesses.id),
        eq(leads.organizationId, organizationId),
      ),
    )
    .where(
      and(
        eq(discoveryResults.organizationId, organizationId),
        eq(discoveryResults.searchId, latest.id),
      ),
    )
    .orderBy(discoveryResults.rank);
  return { ...latest, candidates: rows };
}
