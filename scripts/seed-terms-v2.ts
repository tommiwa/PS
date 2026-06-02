import { db } from "../server/db";
import { termsVersions } from "../shared/schema";
import { eq } from "drizzle-orm";

const NEW_TERMS_CONTENT = `# BCI ParkShare

## Terms and Conditions

**Effective Date: May 29, 2025**

These Terms and Conditions ("Terms") govern your use of BCI's ParkShare application (the "App"). In these Terms, "we," "us," and "our" refer to BCI. "You" and "your" refer to the User accessing or using the App. By accessing or using the App, you agree to be bound by these Terms.

Please read the ParkShare Privacy Notice, which describes how we collect and use personal information.

---

## Definitions

- "App" means BCI's ParkShare application.
- "BCI" means British Columbia Investment Management Corporation.
- "Tenant" means a User who lists their parking stall through the App.
- "Subtenant" means a User who books a parking stall through the App.
- "Sublease Agreement" means the agreement between a Tenant and BCI governing the terms and conditions under which the Tenant is permitted to sublease their parking stall.
- "User" means any BCI personnel who access or use the App, whether as a Tenant or Subtenant.

---

## Access and Use

Subject to and conditioned on your compliance with these Terms, BCI grants you the right to access and use the App solely for the purpose of listing or booking parking stalls as contemplated herein.

For Tenants, use of the App is also subject to the terms of your Sublease Agreement. In the event of any conflict between these Terms and your Sublease Agreement, your Sublease Agreement shall prevail. Nothing in these Terms modifies, amends, or supersedes any obligation or right under your Sublease Agreement.

---

## Listing Parking Stalls

Tenants may list their parking stall for temporary use by other BCI personnel through the App, subject to the following conditions:

- The Tenant may only list the parking stall assigned to them under their Sublease Agreement.
- The Tenant may not list their parking stall to the same Subtenant for more than six (6) consecutive months.
- The Tenant remains fully responsible for all obligations under their Sublease Agreement, including any damage or non-compliance caused by Subtenants.

BCI may list parking stalls owned or managed by BCI through the App. Such listings are not subject to sections 3.1 or 4, and BCI is not considered a Tenant for purposes of these Terms.

---

## Pricing Restrictions

The price charged for a parking stall listing must not exceed the pro-rated amount that the Tenant pays for the stall under their Sublease Agreement.

---

## Booking and Cancellations

Subtenants may book available parking stalls through the App subject to availability. Bookings are made on a daily basis and may cover one or more consecutive days. Each booked day entitles the Subtenant to use the parking stall until 11:59 p.m. on that day.

Both Tenants and Subtenants must provide a minimum of twenty-four (24) hours' notice for any cancellation.

BCI reserves the right to cancel any booking at its sole discretion.

---

## Payment

BCI does not process or guarantee any payments between Users. All payment arrangements between Tenants and Subtenants are made outside the App and are the sole responsibility of the parties involved.

Users must settle all payments within thirty (30) days of the booking date. Users may not make bookings through the App until all outstanding payments are settled.

Users are responsible for resolving any payment disputes directly with one another.

---

## User Conduct and Record-Keeping

Users are responsible for maintaining their own records of all bookings, cancellations, and payments made through or in connection with the App.

---

## Unauthorized Use of Parking Stalls and Wage Assignment

For purposes of these Terms, a User's use, occupation of, parking in, or accessing of any service or amenity associated with any parking stall, including an electric vehicle charger, without an active booking through the App for that parking stall constitutes unauthorized use. Unauthorized use includes use, occupation, parking, or access to any service or amenity associated with a parking stall even if the User has a parking lease for a different parking stall, uses the parking stall or associated service or amenity only briefly, or was unaware that a booking through the App was required.

By accessing or using the App and accepting these Terms, each User authorizes BCI to deduct from the User's wages an amount equal to one day's cost of leasing the applicable parking stall for each day on which the User engages in unauthorized use of that parking stall or any service or amenity associated with that parking stall, including an electric vehicle charger. This authorization constitutes an assignment of wages by the User to BCI in respect of such unauthorized use.

The charge described in section 8.2 is a daily flat rate for the applicable parking stall and will not be prorated based on the duration or nature of the unauthorized use, including where the unauthorized use occurs for only part of a day or involves accessing an electric vehicle charger without otherwise parking in the stall. This amount is intended to reflect the daily leasing cost of the applicable parking stall and is not a disciplinary or administrative penalty.

BCI is not required to provide a warning or notice of unauthorized use before applying the charge described in section 8.2. However, as an administrative practice, BCI may issue a warning in respect of unauthorized use. Any such warning is provided at BCI's discretion and does not limit BCI's right to apply the charge for the same or any subsequent instance of unauthorized use.

---

## Liability and Indemnification

BCI provides the App on an "as is" basis and makes no warranties, express or implied, regarding its availability, accuracy, or fitness for any particular purpose.

BCI is not responsible or liable for any injury, death, property damage, theft, disappearance, or any other loss occurring in, on, or about the parking facility in connection with use of the App.

Users are responsible for, and shall reimburse BCI for, any claims, damages, or liabilities arising from their use of the App or any parking stall booked or listed through the App, including any damage to property owned, leased, or managed by BCI.

The Tenant acknowledges that BCI may seek recovery from the Tenant for any claims, damages, or liabilities arising from the use of their parking stall listed through the App, including where caused by a Subtenant. To the extent such claims, damages, or liabilities are caused by a Subtenant, the Subtenant shall indemnify, defend, and hold harmless the Tenant against the same.

Any disputes between Tenants and Subtenants regarding damage or liability are solely between those parties, and BCI has no obligation to mediate, investigate, or resolve such disputes.

---

## Suspension and Termination

BCI may suspend or terminate a User's access to the App at any time, with or without cause, including for:

- violation of these Terms;
- violation of the User's Sublease Agreement;
- misuse of the App;
- unauthorized use; or
- any conduct that BCI determines, in its sole discretion, is detrimental to other Users or BCI.

Any conduct described in section 10.1 may result in disciplinary action by BCI and may be escalated internally, including to BCI's Chief Operating Officer or their designate. Any disciplinary action taken by BCI is separate from any charge or wage assignment described in section 8.

Termination of a User's Sublease Agreement will terminate their access to the App as a Tenant.

---

## Amendments

BCI may amend these Terms at any time by posting updated Terms through the App. Continued use of the App following any amendment constitutes acceptance of the amended Terms.

---

## General Provisions

These Terms are governed by the laws of British Columbia and the federal laws of Canada applicable therein.

If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.

BCI's failure to enforce any right or provision of these Terms shall not constitute a waiver of such right or provision.

---

## Contact

Questions regarding these Terms or the App should be directed to workplaceservices@bci.ca.

---

**By using the App, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.**

---

# ParkShare Privacy Notice

**Last Updated: May 29, 2025**

This Privacy Notice explains how we collect, use, disclose and protect your personal information when you use BCI's ParkShare application (the "App"). In this Privacy Notice, "we," "us," and "our" refer to BCI. "You" and "your" refer to the individual using the App.

By using the App, you acknowledge and agree to the collection, use, and disclosure of your personal information as described in this ParkShare Privacy Notice and in BCI's Privacy Notice - Canada. All personal information will be collected, used and disclosed in accordance with the Freedom of Information and Protection of Privacy Act (British Columbia) ("FIPPA").

BCI collects the following personal information through the App:

- identification information, including your name, work email, department, and vehicle details such as make and colour
- booking and listing information, including dates, times, parking stall numbers, and the identity of other users involved in each transaction
- cancellation records, including dates, times, and whether cancellations were made within the required notice period
- payment dispute information, including complaints received or made and their resolution status
- App usage information, including login timestamps and activity logs

For clarity, if you make a payment via Interac, the individual whose stall you have booked may see your Interac email ID, but this information is not collected or visible to BCI.

BCI collects this personal information for the following purposes:

- to administer and operate the App, including facilitating bookings between users
- to investigate and enforce breaches of these Terms
- to improve the App and related services
- for any other purpose specified in BCI's Privacy Notice – Canada

BCI will use and disclose your personal information only for the purposes described in this ParkShare Privacy Notice, for purposes consistent with those purposes, or as otherwise permitted or required under FIPPA. Your personal information may be disclosed to other users to the extent necessary to facilitate bookings (for example, when you book a stall, the individual whose stall you have booked will see your name).

If you have questions about the collection of your personal information through the App, please refer to BCI's Privacy Notice – Canada or contact BCI's Privacy Officer at privacy@bci.ca.`;

async function seedTermsV2() {
  console.log("[seed-terms-v2] Starting...");

  const existing = await db
    .select()
    .from(termsVersions)
    .where(eq(termsVersions.version, 2));

  if (existing.length > 0) {
    console.log("[seed-terms-v2] Version 2 already exists, skipping insert.");
  } else {
    await db.insert(termsVersions).values({
      version: 2,
      content: NEW_TERMS_CONTENT,
      isActive: true,
      publishedAt: new Date("2025-05-29"),
    });
    console.log("[seed-terms-v2] Inserted new terms version 2.");
  }

  await db
    .update(termsVersions)
    .set({ isActive: false })
    .where(eq(termsVersions.version, 1));
  console.log("[seed-terms-v2] Deactivated version 1.");

  const active = await db
    .select()
    .from(termsVersions)
    .where(eq(termsVersions.isActive, true));
  console.log(`[seed-terms-v2] Active versions: ${active.map(v => v.version).join(", ")}`);
  console.log("[seed-terms-v2] Done.");
}

seedTermsV2().catch(console.error).finally(() => process.exit(0));
